import { BrandIcon } from "@/components/racik/BrandIcon";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { ChevronRight, Search, X } from "lucide-react";
import { AppTabs } from "@/components/racik/AppTabs";
import { RecipeList, ViewToggle } from "@/components/racik/RecipeList";
import { ImportButton } from "@/components/racik/ImportDemo";
import { Sheet } from "@/components/racik/Sheet";
import { FILIPINO, INGREDIENTS, NUSANTARA, RECIPES, REG, WESTERN } from "@/lib/racik/data";
import { buildIndex, EXACT_ONLY, normalise, passesHalalMode, proteinPerPortion, search } from "@/lib/racik/engine";
import { DIET_SHELVES } from "@/lib/racik/diet";
import { useRacik } from "@/lib/racik/state";
import type { Recipe } from "@/lib/racik/types";
import { PHOTO, thumbOf } from "@/components/racik/photos";
import { RecipePhoto } from "@/components/racik/RecipePhoto";
import { t, type Key } from "@/lib/racik/i18n";

/**
 * Search, the picked tile and the kitchen-ingredient pick live in the URL, so
 * opening a recipe and pressing back lands on the same list, and back after
 * picking a tile returns to the shelves instead of leaving Eksplor.
 */
const searchSchema = z.object({
  q: z.string().max(80).optional().catch(undefined),
  t: z.string().max(80).optional().catch(undefined),
  b: z.string().max(400).optional().catch(undefined),
});

declare module "@tanstack/history" {
  interface HistoryState {
    /** Set on an Eksplor entry pushed on top of the shelves, so "clear" can go back instead of stacking. */
    fromShelves?: boolean;
  }
}

export const Route = createFileRoute("/cari")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Eksplor Resep — Racik" }, { name: "description", content: "Temukan resep dari waktu, bahan utama, cara masak, protein, atau daerah." }, { property: "og:title", content: "Eksplor Resep — Racik" }, { property: "og:description", content: "Cari resep Indonesia dengan kata dan nama bahan yang biasa dipakai di rumah." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: Eksplor,
});

type Tile = { key: string; label: string; recipes: Recipe[] };
type ShelfDef = { title: string; items: Tile[] };
const slug = (s: string) => normalise(s).replace(/ /g, "-");

/** Photo on top, label and count underneath — no scrim over the food. */
function PhotoTile({ tile, onPick, cover }: { tile: Tile; onPick: (t: Tile) => void; cover: Recipe | undefined }) {
  return (
    <button type="button" onClick={() => onPick(tile)} className="photo-tile w-[132px] shrink-0 text-left">
      <div className="h-[108px] w-[132px] overflow-hidden rounded-2xl bg-primary-track">
        <RecipePhoto src={cover ? thumbOf(cover.id) : undefined} alt="" title={tile.label} />
      </div>
      <p className="mt-2 text-caption font-bold leading-tight text-ink">{tile.label}</p>
      <p className="mt-0.5 text-micro text-ink-3">{tile.recipes.length} {" "}{t("resep")}</p>
    </button>
  );
}

const SHELF_ICON: Record<string, string> = { cepat: "timer", bahan: "bahan", masak: "masak", protein: "daging", pilihan: "menu-harian", daerah: "nusantara", barat: "barat", filipina: "asia" };
function Shelf({ title, icon, items, onPick }: { title: string; icon?: string | undefined; items: Tile[]; onPick: (t: Tile) => void }) {
  const populated = items.filter((item) => item.recipes.length > 0);
  if (!populated.length) return null;
  // Each tile in a shelf gets a different photograph where the shelf allows it.
  const used = new Set<string>();
  const covers = populated.map((t) => {
    const pick = t.recipes.find((r) => PHOTO[r.id] && !used.has(r.id)) ?? t.recipes.find((r) => PHOTO[r.id]) ?? t.recipes[0];
    if (pick) used.add(pick.id);
    return pick;
  });
  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center gap-2.5 px-5">{icon ? <BrandIcon name={icon} className="size-8" /> : null}<h2 className="heading-sm">{title}</h2></div>
      <div className="no-scrollbar flex gap-3 overflow-x-auto px-5">
        {populated.map((t, i) => <PhotoTile key={t.key} tile={t} onPick={onPick} cover={covers[i]} />)}
      </div>
    </section>
  );
}

/** Regions with fewer than five recipes share one "Daerah lain" tile rather than opening onto a near-empty list. */
const MIN_PER_REGION = 5;
function regionShelves(nusantara: Recipe[]): Omit<Tile, "key">[] {
  const all = Object.values(REG).map((reg) => ({ label: reg.name, recipes: nusantara.filter((r) => r.region === reg.id) }));
  const named = all.filter((g) => g.recipes.length >= MIN_PER_REGION).sort((a, b) => b.recipes.length - a.recipes.length);
  const rest = all.filter((g) => g.recipes.length > 0 && g.recipes.length < MIN_PER_REGION).flatMap((g) => g.recipes);
  return rest.length ? [...named, { label: t("daerah_lain"), recipes: rest }] : named;
}

/** Western recipes (public-domain US government cookbooks) keep their own shelf so the Nusantara shelves stay Nusantara. */
const WESTERN_ORDER = ["Sup, Stew & Chili", "Pasta", "Sandwich, Wrap & Pizza", "Sarapan", "Ayam & kalkun", "Daging sapi", "Ikan", "Salad", "Kue & Camilan"];
/** Display names for the Western shelf groups; the stored kategori stays as written. */
const WESTERN_KEY: Record<string, Key> = {
  "Sup, Stew & Chili": "kat_barat_1",
  "Pasta": "kat_barat_2",
  "Sandwich, Wrap & Pizza": "kat_barat_3",
  "Sarapan": "kat_barat_4",
  "Ayam & kalkun": "kat_barat_5",
  "Daging sapi": "kat_barat_6",
  "Ikan": "kat_barat_7",
  "Salad": "kat_barat_8",
  "Kue & Camilan": "kat_barat_9",
};
const westernLabel = (k: string) => (WESTERN_KEY[k] ? t(WESTERN_KEY[k]!) : k);
function westernShelves(western: Recipe[]): Omit<Tile, "key">[] {
  const groups = WESTERN_ORDER.map((k) => ({ label: westernLabel(k), recipes: western.filter((r) => r.kategori === k) }));
  const rest = western.filter((r) => !r.kategori || !WESTERN_ORDER.includes(r.kategori));
  return [{ label: t("semua"), recipes: western }, ...groups, ...(rest.length ? [{ label: t("lainnya"), recipes: rest }] : [])];
}

/** Filipino recipes: their own shelf, grouped like a Filipino cookbook. */
const FILIPINO_ORDER = ["Ulam Daging & Unggas", "Ulam Ikan & Seafood", "Sup & Rebusan", "Sayur", "Pansit & Mi", "Nasi & Bubur", "Gorengan & Jajanan", "Panghimagas", "Roti & Kue Kering", "Acar & Sambal"];
const FILIPINO_KEY: Record<string, Key> = {
  "Ulam Daging & Unggas": "kat_ph_1",
  "Ulam Ikan & Seafood": "kat_ph_2",
  "Sup & Rebusan": "kat_ph_3",
  "Sayur": "kat_ph_4",
  "Pansit & Mi": "kat_ph_5",
  "Nasi & Bubur": "kat_ph_6",
  "Gorengan & Jajanan": "kat_ph_7",
  "Panghimagas": "kat_ph_8",
  "Roti & Kue Kering": "kat_ph_9",
  "Acar & Sambal": "kat_ph_10",
};
function filipinoShelves(filipino: Recipe[]): Omit<Tile, "key">[] {
  const groups = FILIPINO_ORDER.map((k) => ({ label: FILIPINO_KEY[k] ? t(FILIPINO_KEY[k]!) : k, recipes: filipino.filter((r) => r.kategori === k) }));
  const rest = filipino.filter((r) => !r.kategori || !FILIPINO_ORDER.includes(r.kategori));
  return [{ label: t("semua"), recipes: filipino }, ...groups, ...(rest.length ? [{ label: t("lainnya"), recipes: rest }] : [])];
}

const MAIN: { label: string; ids: string[] }[] = [
  { get label() { return t("ayam"); }, ids: ["ayam_utuh", "ayam"] },
  { get label() { return t("ikan_udang"); }, ids: ["ikan_kembung", "ikan_cakalang", "udang"] },
  { get label() { return t("telur"); }, ids: ["telur"] },
  { get label() { return t("tahu_tempe"); }, ids: ["tahu", "tempe"] },
  { get label() { return t("daging"); }, ids: ["daging_sapi"] },
];
const withAny = (pool: Recipe[], ids: string[]) => pool.filter((r) => r.ings.some((l) => ids.includes(l[0])));

/**
 * "Goreng" used to list every soto because of "bawang goreng", and "Bakar"
 * listed wedang jahe because of "bakar jahe". Garnish and prep phrases are
 * removed before looking for the method.
 */
const NOT_THE_METHOD = /\b(bawang|minyak|kacang|kerupuk|emping|ikan asin|teri) goreng\b|\bbakar (jahe|kunyit|lengkuas|terasi|kemiri|kelapa|cabai|bawang)\b/g;
const METHOD_WORD: Record<string, RegExp> = {
  Goreng: /\b(di|meng)?goreng/,
  Tumis: /\b(di)?tumis|\bmenumis/,
  Kukus: /\b(di)?kukus|\bmengukus/,
  Rebus: /\b(di|me)?rebus/,
  Bakar: /\b(di|mem)?bakar|\bpanggang/,
};
const usesMethod = (r: Recipe, method: string) => {
  const re = METHOD_WORD[method];
  return Boolean(re) && r.steps.some((s) => re!.test(s[0].toLowerCase().replace(NOT_THE_METHOD, "")));
};

function buildShelves(nusantara: Recipe[], western: Recipe[], filipino: Recipe[], negara: string): { id: string; def: ShelfDef }[] {
  const keyed = (id: string, items: Omit<Tile, "key">[]): ShelfDef["items"] => items.map((t) => ({ ...t, key: `${id}.${slug(t.label)}` }));
  const methods = ["Goreng", "Tumis", "Kukus", "Rebus", "Bakar"];
  const shelves: [string, string, Omit<Tile, "key">[]][] = [
    ["cepat", t("shelf_cepat"), [20, 30, 45].map((n) => ({ label: t("menit", { n }), recipes: nusantara.filter((r) => r.time <= n) }))],
    ["bahan", t("shelf_bahan"), [...MAIN.map((m) => ({ label: m.label, recipes: withAny(nusantara, m.ids) })), { label: t("sayur"), recipes: withAny(nusantara, INGREDIENTS.filter((i) => i.cat === "sayur").map((i) => i.id)) }]],
    ["masak", t("shelf_masak"), methods.map((m) => ({ label: t(`method_${m.toLowerCase()}` as Key), recipes: nusantara.filter((r) => usesMethod(r, m)) }))],
    ["protein", t("shelf_protein"), [15, 20, 25].map((g) => ({ label: t("g_protein", { g }), recipes: nusantara.filter((r) => proteinPerPortion(r) >= g) }))],
    ["pilihan", t("shelf_pilihan"), DIET_SHELVES.map((d) => ({ label: d.label, recipes: nusantara.filter(d.match) }))],
    ["daerah", t("shelf_daerah"), regionShelves(nusantara)],
    ["filipina", t("shelf_filipina"), filipinoShelves(filipino)],
    ["barat", t("shelf_barat"), westernShelves(western)],
  ];
  // In the Philippines the Filipino shelf leads.
  if (negara === "PH") shelves.unshift(...shelves.splice(shelves.findIndex(([id]) => id === "filipina"), 1));
  return shelves.map(([id, title, items]) => ({ id, def: { title, items: keyed(id, items) } }));
}

/** The order a kitchen is actually searched. */
const ING_GROUPS: { label: string; cats: string[] }[] = [
  { get label() { return t("daging_ikan_tahu_tempe"); }, cats: ["daging"] },
  { get label() { return t("sayur_buah"); }, cats: ["sayur"] },
  { get label() { return t("bumbu"); }, cats: ["bumbu"] },
  { get label() { return t("sembako"); }, cats: ["sembako", "lain"] },
];

function Eksplor() {
  const { state } = useRacik();
  const { q = "", t: tileKey, b } = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const [query, setQuery] = useState(q);
  // Back/forward changes the URL under the input; follow it.
  useEffect(() => setQuery(q), [q]);
  const [ingredients, setIngredients] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [ingFilter, setIngFilter] = useState("");

  // Pengaturan › "Sembunyikan resep yang perlu dicek atau tidak halal" applies here too.
  const halal = state.halalMode;
  const pool = useMemo(() => [...RECIPES, ...state.imported].filter((r) => passesHalalMode(r, halal)), [halal, state.imported]);
  const nusantara = useMemo(() => NUSANTARA.filter((r) => passesHalalMode(r, halal)), [halal]);
  const western = useMemo(() => WESTERN.filter((r) => passesHalalMode(r, halal)), [halal]);
  const filipino = useMemo(() => FILIPINO.filter((r) => passesHalalMode(r, halal)), [halal]);
  const hiddenCount = RECIPES.length - nusantara.length - western.length - filipino.length;
  const shelves = useMemo(() => buildShelves(nusantara, western, filipino, state.negara), [nusantara, western, filipino, state.negara]);
  const index = useMemo(() => buildIndex(pool), [pool]);

  const kitchen = useMemo(() => (b ? b.split(",").filter(Boolean) : []), [b]);
  const picked: Tile | null = useMemo(() => {
    if (tileKey === "dapur" && kitchen.length)
      return { key: "dapur", label: t("bahan_di_dapur"), recipes: pool.filter((r) => kitchen.every((id) => r.ings.some((l) => l[0] === id))) };
    if (!tileKey) return null;
    for (const { def } of shelves) for (const tile of def.items) if (tile.key === tileKey) return tile;
    return null;
  }, [tileKey, kitchen, pool, shelves]);

  const ingredientRecipes = pool.filter((r) => selected.every((id) => r.ings.some((line) => line[0] === id)));
  const onShelves = !q && !tileKey;
  const fromShelves = () => Boolean(router.state.location.state.fromShelves);

  const pick = (tile: Tile) => {
    navigate({ search: { t: tile.key }, state: { fromShelves: true }, replace: !onShelves });
    window.scrollTo({ top: 0 });
  };
  const pickKitchen = (ids: string[]) => {
    navigate({ search: { t: "dapur", b: ids.join(",") }, state: { fromShelves: true }, replace: !onShelves });
    window.scrollTo({ top: 0 });
  };
  const typed = (value: string) => {
    setQuery(value);
    const next = value.trim() ? { q: value } : {};
    // The first letter pushes an entry, so back returns to the shelves; the rest replace it.
    navigate({ search: next, state: { fromShelves: onShelves || fromShelves() }, replace: !onShelves });
  };
  const clear = () => {
    setQuery("");
    if (fromShelves()) router.history.back();
    else navigate({ search: {}, replace: true });
  };

  const trimmed = query.trim();
  const results = trimmed ? search(index, trimmed) : picked?.recipes ?? [];
  const filtered = Boolean(trimmed || picked);
  const sensitive = trimmed && normalise(trimmed).split(" ").some((w) => EXACT_ONLY.has(w));
  const tileCls = "min-h-11 shrink-0 rounded-full border border-rule bg-card px-[15px] text-caption font-bold text-ink";
  const ingWords = normalise(ingFilter);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-ground pb-24">
      <header className="border-b border-rule-soft bg-card px-5 pb-4 pt-[calc(3.5rem+env(safe-area-inset-top))]">
        <h1 className="mb-3.5 text-hero font-extrabold leading-[1.1] tracking-[-0.03em] text-ink-strong">{t("temukan_masakan_baru")}</h1>
        <label className="flex min-h-12 items-center gap-3 rounded-xl border border-rule-strong bg-tint pl-3.5 focus-within:border-primary">
          <Search aria-hidden className="size-4 text-ink-faint" />
          <input type="search" enterKeyHint="search" value={query} onChange={(e) => typed(e.target.value)} placeholder={t("cari_resep_atau_bahan")} aria-label={t("cari_resep_atau_bahan")} className="min-w-0 flex-1 bg-transparent py-3 text-15 text-ink-strong outline-none placeholder:text-ink-3 [&::-webkit-search-cancel-button]:hidden" />
          {query ? <button type="button" onClick={clear} aria-label={t("hapus_pencarian")} className="flex size-11 shrink-0 items-center justify-center"><X className="size-4 text-ink-3" /></button> : <span className="w-3.5" />}
        </label>
        {!query ? <p className="mt-2 text-label text-ink-3">{t("coba_cari_ayam_tempe_atau")}</p> : null}
      </header>

      {!filtered ? (
        <div className="flex-1">
          {halal && hiddenCount > 0 ? (
            <p className="mx-5 mt-4 rounded-xl bg-tint px-3.5 py-2.5 text-label text-ink-2">
              {hiddenCount} {" "}{t("resep_yang_perlu_dicek_atau")}{" "}
              <Link to="/pengaturan" className="font-bold text-primary">{t("ubah")}</Link>
            </p>
          ) : null}
          <div className="mt-5">
            <p className="meta-label mb-2.5 px-5">{t("pilih_protein_utama")}</p>
            <div className="no-scrollbar flex gap-2 overflow-x-auto px-5">
              {MAIN.map((m) => {
                const tile = shelves.find((s) => s.id === "bahan")?.def.items.find((t) => t.label === m.label);
                return tile ? <button key={m.label} type="button" onClick={() => pick(tile)} className={tileCls}>{m.label}</button> : null;
              })}
            </div>
          </div>

          <div className="mx-5 mt-4"><ImportButton /></div>
          <div className="mx-5 mt-3 overflow-hidden rounded-2xl border border-rule-strong bg-card">
            <Link to="/buku" search={{ tab: "disimpan" }} className="flex min-h-14 items-center gap-3 px-4 py-4">
              <BrandIcon name="resep-favorit" className="size-9" />
              <span className="flex-1 text-15 font-medium text-ink-strong">{t("buka_favorit")}</span>
              <b className="mr-1.5 text-caption text-primary">{state.saved.length}</b>
              <ChevronRight aria-hidden className="size-4 text-ink-faint" />
            </Link>
            <button type="button" onClick={() => setIngredients(true)} className="flex min-h-14 w-full items-center gap-3 border-t border-rule-soft px-4 py-4 text-left">
              <BrandIcon name="bahan" className="size-9" />
              <span className="flex-1 text-15 font-medium text-ink-strong">{t("cari_dari_bahan_yang_ada")}</span>
              <ChevronRight aria-hidden className="size-4 text-ink-faint" />
            </button>
          </div>

          {shelves.map(({ id, def }) => <Shelf key={id} title={def.title} icon={SHELF_ICON[id]} onPick={pick} items={def.items} />)}
          <div className="h-6" />
        </div>
      ) : (
        <div className="flex-1 px-5 pt-4">
          <div className="mb-4 flex">
            <span className="flex items-center gap-1 rounded-full bg-primary py-0.5 pl-3 text-primary-foreground">
              <span className="text-label font-bold">{trimmed || picked?.label}</span>
              <button type="button" onClick={clear} aria-label={t("hapus_filter")} className="flex size-11 items-center justify-center rounded-full"><X className="size-3.5" strokeWidth={2.5} /></button>
            </span>
          </div>
          <div className="mb-2 flex items-center justify-between">
            <span className="heading-sm">{results.length} {" "}{t("resep")}</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={clear} className="min-h-11 px-1 text-14 font-bold text-primary">{t("hapus_filter")}</button>
              <ViewToggle />
            </div>
          </div>
          {results.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-[52px] text-center">
              {sensitive ? (
                <>
                  <p className="text-17 font-extrabold">{t("tidak_ada_resep_berbahan")}{trimmed}{t("di_racik")}</p>
                  <p className="mt-1.5 text-14 leading-normal text-ink-3">{t("kata_ini_dicari_persis_tanpa")}</p>
                </>
              ) : (
                <>
                  <p className="text-17 font-extrabold">{t("belum_ada_resep_yang_cocok")}</p>
                  <p className="mt-1.5 text-14 leading-normal text-ink-3">{t("coba_gunakan_nama_bahan_yang")}</p>
                </>
              )}
              <button type="button" onClick={clear} className="mt-[18px] min-h-11 rounded-full border border-primary bg-card px-[18px] text-caption font-bold text-primary">{t("kembali_ke_eksplor")}</button>
            </div>
          ) : <RecipeList recipes={results} />}
        </div>
      )}

      <Sheet open={ingredients} onClose={() => setIngredients(false)} title={t("bahan_di_dapur")} subtitle={t("pilih_bahan_yang_ada_hasil")}>
        <input value={ingFilter} onChange={(e) => setIngFilter(e.target.value)} placeholder={t("cari_bahan_mis_tempe")} aria-label={t("cari_bahan")} className="mb-5 min-h-12 w-full rounded-xl border border-rule-strong bg-tint px-3.5 text-15 outline-none focus:border-primary" />
        {ING_GROUPS.map((group) => {
          const items = INGREDIENTS.filter((i) => !i.staple && group.cats.includes(i.cat) && (!ingWords || normalise(`${i.name} ${i.aliases.join(" ")}`).includes(ingWords) || selected.includes(i.id)));
          if (!items.length) return null;
          return (
            <section key={group.label} className="mb-6">
              <h3 className="meta-label mb-3">{group.label}</h3>
              <div className="flex flex-wrap gap-2">
                {items.map((ing) => {
                  const on = selected.includes(ing.id);
                  return <button key={ing.id} type="button" aria-pressed={on} onClick={() => setSelected((s) => (on ? s.filter((x) => x !== ing.id) : [...s, ing.id]))} className={`min-h-11 rounded-full px-3.5 text-caption font-semibold ${on ? "bg-primary text-primary-foreground" : "border border-rule bg-card text-icon-muted"}`}>{ing.em} {ing.name}</button>;
                })}
              </div>
            </section>
          );
        })}
        <div className="sticky bottom-0 -mx-5 bg-card px-5 pt-3">
          <p className="text-body font-semibold">{selected.length ? t("resep_cocok", { v1: ingredientRecipes.length }) : t("belum_ada_bahan_dipilih")}</p>
          <button type="button" disabled={!selected.length} onClick={() => { setIngredients(false); pickKitchen(selected); }} className="mt-3 min-h-[54px] w-full rounded-xl bg-primary text-body font-bold text-primary-foreground shadow-glow disabled:bg-rule disabled:text-ink-3 disabled:shadow-none">{t("lihat_resep")}</button>
        </div>
      </Sheet>
      <AppTabs />
    </main>
  );
}
