import { BrandIcon } from "@/components/racik/BrandIcon";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HandleForm } from "@/components/racik/share/HandleForm";
import { byId } from "@/lib/racik/data";
import { useAccount } from "@/lib/racik/backend/useAccount";
import { myRecipes } from "@/lib/racik/backend/recipes";
import { myHandle, myShareStats, summarise, type StatsSummary } from "@/lib/racik/backend/share";
import type { UserRecipe } from "@/lib/racik/backend/types";
import { ENGLISH_ENABLED, t } from "@/lib/racik/i18n";
import { LanguageSwitch } from "@/components/racik/LanguageSwitch";

export const Route = createFileRoute("/resepku")({
  head: () => ({ meta: [{ title: "Resepku — Racik" }, { name: "robots", content: "noindex" }] }),
  component: Resepku,
});

const n = (v: number) => v.toLocaleString("id-ID");

/**
 * Her own numbers, visible only to her: how often her links were opened,
 * and how many people saved or finished cooking a recipe because of them.
 */
function Resepku() {
  const { account, ready, available } = useAccount();
  const [profile, setProfile] = useState<
    { handle: string | null; publicName: string | null } | null | undefined
  >(undefined);
  const [stats, setStats] = useState<StatsSummary | null | undefined>(undefined);
  const [mine, setMine] = useState<UserRecipe[]>([]);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!account) return;
    myHandle().then(setProfile);
    myRecipes().then(setMine);
    myShareStats().then((rows) => {
      if (!rows) return setStats(null);
      // Catalogue titles come from the app; user and imported ones from the server.
      setStats(
        summarise(rows, (kind, ref) => (kind === "catalogue" ? (byId(ref)?.title ?? null) : null)),
      );
    });
  }, [account]);

  const shell = (body: React.ReactNode) => (
    <main className="mx-auto min-h-dvh w-full max-w-[430px] bg-card pb-16">
      <header className="flex items-center gap-3 px-5 pb-4 pt-[calc(2rem+env(safe-area-inset-top))]">
        <Link
          to="/tulis"
          aria-label={t("back")}
          className="flex size-11 items-center justify-center rounded-full border border-rule"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="text-head font-extrabold">{t("siapa_yang_memasaknya")}</h1>
        </div>
      </header>
      {ENGLISH_ENABLED ? (
        <div className="mx-5 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rule p-4">
          <div className="min-w-0 flex-1 basis-[9rem]">
            <p className="text-body font-bold">{t("language")}</p>
            <p className="text-14 text-ink-3">{t("language_hint")}</p>
          </div>
          <LanguageSwitch />
        </div>
      ) : null}
      <div className="px-5">{body}</div>
    </main>
  );

  if (!available) {
    return shell(
      <p className="rounded-2xl border border-rule bg-notice p-4 read-line">
        
        {t("racik_belum_tersambung_ke_server_2")}
      </p>,
    );
  }
  if (!ready) return shell(null);
  if (!account) {
    return shell(
      <div className="grid gap-3">
        <p className="read-line text-ink-2">
          
          {t("masuk_untuk_memilih_nama_pengguna")}
        </p>
        <Button asChild size="lg">
          <Link to="/masuk">{t("sign_in")}</Link>
        </Button>
      </div>,
    );
  }

  return shell(
    <div className="grid gap-8">
      <section className="rounded-2xl border border-rule p-4">
        {profile === undefined ? (
          <p className="text-14 text-ink-3">{t("memuat")}</p>
        ) : profile?.handle && !editing ? (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-body font-extrabold">@{profile.handle}</p>
              <p className="truncate text-14 text-ink-3">
                {profile.publicName || t("tanpa_nama_tampilan")}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button asChild variant="outline" className="min-h-11">
                <Link to="/u/$handle" params={{ handle: profile.handle }}>
                  
                  {t("lihat_profil")}
                </Link>
              </Button>
              <Button variant="ghost" className="min-h-11" onClick={() => setEditing(true)}>
                
                {t("ubah")}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="mb-2 text-body font-extrabold">{t("nama_pengguna")}</h2>
            <HandleForm
              initialHandle={profile?.handle ?? null}
              initialName={profile?.publicName ?? null}
              onSaved={(handle, publicName) => {
                setProfile({ handle, publicName });
                setEditing(false);
              }}
            />
          </>
        )}
      </section>

      <section>
        <h2 className="heading-sm">{t("dari_tautan_yang_kamu_bagikan")}</h2>
        {stats === undefined ? (
          <p className="mt-3 text-14 text-ink-3">{t("memuat_angka")}</p>
        ) : stats === null ? (
          <p className="mt-3 text-14 text-ink-3">
            
            {t("angkanya_belum_bisa_diambil_sekarang")}
          </p>
        ) : stats.recipes.length === 0 ? (
          <p className="mt-3 read-line text-ink-2">
            
            {t("belum_ada_setelah_selesai_memasak")}{" "}<b>{t("bagikan")}</b> {" "}{t("untuk_membuat_kartu_hasil_masakanmu")}
          </p>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-3 rounded-2xl bg-primary-soft py-4 text-center">
              {[
                [stats.opens, "dibuka"],
                [stats.saves, "disimpan"],
                [stats.cooks, "dimasak"],
              ].map(([v, l], i) => (
                <div key={String(l)} className={i ? "border-l border-primary-line" : ""}>
                  <p className="text-2xl font-extrabold text-primary-deep tabular-nums">
                    {n(Number(v))}
                  </p>
                  <p className="text-micro text-ink-3">{l}</p>
                </div>
              ))}
            </div>
            {stats.cooks > 0 ? (
              <p className="mt-3 text-body font-bold">
                
                {t("dimasak")}{" "}{n(stats.cooks)} {" "}{t("orang_lewat_tautanmu")}
              </p>
            ) : null}
            {stats.top ? (
              <p className="mt-2 text-14 text-ink-2">
                
                {t("paling_banyak")}{" "}<b>{stats.top.title}</b> ({n(stats.top.opens)} {" "}{t("kali_dibuka")}
                {stats.top.cooks ? t("dimasak_orang", { cooks: n(stats.top.cooks) }) : ""}).
              </p>
            ) : null}
            {stats.byFormat.story + stats.byFormat.feed > 0 ? (
              <p className="mt-2 text-14 text-ink-2">
                
                {t("kartu_story_status_dibuka")}{" "}{n(stats.byFormat.story)} {" "}{t("kali_kartu_feed")}{" "}
                {n(stats.byFormat.feed)} {" "}{t("kali")}
                {stats.byFormat.story !== stats.byFormat.feed
                  ? t("lebih_banyak_dibuka", { v1: stats.byFormat.story > stats.byFormat.feed ? "Story/Status" : "feed" })
                  : "."}
              </p>
            ) : null}

            <ul className="mt-5">
              {stats.recipes.map((r) => (
                <li
                  key={r.key}
                  className="flex items-center justify-between gap-3 border-b border-rule py-3"
                >
                  <span className="min-w-0 flex-1 text-body font-bold">{r.title}</span>
                  <span className="shrink-0 text-right text-caption text-ink-3 tabular-nums">
                    {n(r.opens)} {" "}{t("dibuka")}{" "}{n(r.saves)} {" "}{t("disimpan")}{" "}{n(r.cooks)} {" "}{t("dimasak_2")}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-caption text-ink-3">
              
              {t("satu_hp_dihitung_sekali_sehari")}
            </p>
          </>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="heading-sm">{t("my_recipes")}</h2>
          <Link
            to="/tulis/baru"
            className="flex min-h-11 items-center gap-1 text-14 font-bold text-primary"
          >
            <BrandIcon name="edit" className="size-6 rounded-md" /> {" "}{t("tulis")}
          </Link>
        </div>
        {mine.length ? (
          <ul className="mt-2">
            {mine.map((r) => (
              <li key={r.id}>
                <Link
                  to="/tulis/baru"
                  search={{ d: r.id }}
                  className="flex min-h-14 items-center justify-between gap-3 border-b border-rule py-3"
                >
                  <span className="min-w-0 flex-1 text-body font-bold">{r.title}</span>
                  <span className="shrink-0 text-caption text-ink-3">
                    {r.status === "live"
                      ? t("terbit_dimasak", { cookedCount: n(r.cookedCount) })
                      : r.status === "draft"
                        ? t("draft")
                        : t("hidden")}
                  </span>
                  <ChevronRight aria-hidden className="size-4 text-ink-3" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-14 text-ink-3">{t("belum_ada_resep_yang_kamu")}</p>
        )}
      </section>
    </div>,
  );
}
