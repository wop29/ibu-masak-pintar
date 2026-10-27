import { BrandIcon } from "@/components/racik/BrandIcon";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, CircleAlert, Plus, Share2, Timer, Trash2, X,  } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PortionStepper } from "@/components/racik/PortionStepper";
import { HandleForm } from "@/components/racik/share/HandleForm";
import { ShareSheet } from "@/components/racik/share/ShareSheet";
import { ING } from "@/lib/racik/data";
import { fmtQty, fmtSeconds, unitOf } from "@/lib/racik/engine";
import { useAccount } from "@/lib/racik/backend/useAccount";
import { myRecipes, publish, saveDraft, unpublish, uploadPhoto } from "@/lib/racik/backend/recipes";
import { dataUrlToBlob, myHandle } from "@/lib/racik/backend/share";
import type { UserRecipe } from "@/lib/racik/backend/types";
import { shrinkPhoto } from "@/lib/racik/store";
import {
  deleteDraftLocal,
  draftById,
  emptyDraft,
  saveDraftLocal,
  type TulisDraft,
} from "@/lib/racik/tulis/drafts";
import { parseIngredientLine, parseSteps, UNMATCHED_ID } from "@/lib/racik/tulis/parse";
import { toIngLines, validateDraft, type Issue } from "@/lib/racik/tulis/validate";
import type { IngLine, Recipe } from "@/lib/racik/types";
import { t } from "@/lib/racik/i18n";

export const Route = createFileRoute("/tulis_/baru")({
  validateSearch: (search: Record<string, unknown>): { d?: string } =>
    typeof search["d"] === "string" && search["d"] ? { d: search["d"] as string } : {},
  head: () => ({
    meta: [{ title: "Tulis resep — Racik" }, { name: "robots", content: "noindex" }],
  }),
  component: Editor,
});

/** A stored engine line back to the words she would have typed. */
function lineToText(line: IngLine): string {
  if (line[0] === UNMATCHED_ID || !ING[line[0]]) return String(line[2] ?? "");
  const name = ING[line[0]]!.name.toLowerCase();
  const prep = line[2] ? `, ${line[2]}` : "";
  if (line[1] == null) return `${name} secukupnya${prep}`;
  return `${fmtQty(line[1])} ${unitOf(line)} ${name}${prep}`;
}

function fromServer(r: UserRecipe): TulisDraft {
  return {
    ...emptyDraft(),
    remoteId: r.id,
    status: r.status,
    hiddenReason: r.hiddenReason,
    title: r.title,
    serv: r.serv,
    time: r.time || null,
    note: r.note,
    ings: [...r.ings.map(lineToText), ...r.unmatched],
    steps: r.steps.map((s) => s[0]),
    photo: r.photoUrl,
    photoPath: null,
    sourceCreator: r.sourceCreator ?? undefined,
    sourceUrl: r.sourceUrl ?? undefined,
  };
}

const field =
  "w-full rounded-xl border border-rule bg-card px-3 text-body outline-none focus:border-primary";

type Stage =
  | { kind: "edit" }
  | { kind: "signin" }
  | { kind: "handle" }
  | { kind: "busy"; label: string }
  | { kind: "done"; id: string };

function Editor() {
  const { d } = Route.useSearch();
  const navigate = useNavigate();
  const { account, ready, available } = useAccount();
  const [draft, setDraft] = useState<TulisDraft | null>(null);
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [stage, setStage] = useState<Stage>({ kind: "edit" });
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [showSource, setShowSource] = useState(false);
  const [sharing, setSharing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const loaded = useRef(false);

  // Open a local draft, a server recipe, or start fresh.
  useEffect(() => {
    if (loaded.current) return;
    const local = d ? draftById(d) : null;
    if (local) {
      loaded.current = true;
      setDraft(local);
      setShowSource(Boolean(local.sourceCreator));
      return;
    }
    if (d && /^[0-9a-f-]{36}$/i.test(d)) {
      if (!ready) return;
      loaded.current = true;
      myRecipes().then((list) => {
        const r = list.find((x) => x.id === d);
        setDraft(r ? fromServer(r) : emptyDraft());
      });
      return;
    }
    loaded.current = true;
    setDraft(emptyDraft());
  }, [d, ready]);

  // Autosave on the device, quietly, half a second after she stops typing.
  useEffect(() => {
    if (!draft) return;
    const t = setTimeout(() => saveDraftLocal(draft), 500);
    return () => clearTimeout(t);
  }, [draft]);

  const parsed = useMemo(() => (draft ? draft.ings.map(parseIngredientLine) : []), [draft]);
  const steps = useMemo(() => (draft ? parseSteps(draft.steps) : []), [draft]);

  if (!draft) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-[430px] bg-card px-5 pt-16 text-ink-3">
        
        {t("membuka_draf")}
      </main>
    );
  }

  const set = (patch: Partial<TulisDraft>) => {
    setDraft((cur) => (cur ? { ...cur, ...patch } : cur));
    setIssues(null);
    setSavedNote(null);
  };
  const setLine = (key: "ings" | "steps", i: number, value: string) => {
    const list = [...draft[key]];
    // Pasting a whole list into one box splits it into lines.
    const parts = value.split(/\r?\n/);
    if (parts.length > 1) list.splice(i, 1, ...parts.map((p) => p.trim()).filter(Boolean));
    else list[i] = value;
    set({ [key]: list } as Partial<TulisDraft>);
  };
  const removeLine = (key: "ings" | "steps", i: number) =>
    set({ [key]: draft[key].filter((_, j) => j !== i) } as Partial<TulisDraft>);

  const issuesFor = (kind: "ing" | "step", i: number) =>
    // The unmatched note already sits under the line as a hint; do not say it twice.
    (issues ?? []).filter(
      (x) => x.field?.kind === kind && x.field.index === i && x.code !== "unmatched",
    );

  const hidden = draft.status === "hidden" || draft.status === "removed";
  const errors = (issues ?? []).filter((i) => i.level === "error");
  const warnings = (issues ?? []).filter((i) => i.level === "warn");

  const check = (): Issue[] => {
    const found = validateDraft({
      title: draft.title,
      serv: draft.serv,
      time: draft.time,
      lines: parsed,
      steps,
    });
    setIssues(found);
    return found;
  };

  const doPublish = async () => {
    setError(null);
    if (!available) {
      setError(
        t("tulis_offline"),
      );
      return;
    }
    if (!account) {
      setStage({ kind: "signin" });
      return;
    }
    const h = await myHandle();
    if (!h?.handle) {
      setStage({ kind: "handle" });
      return;
    }
    setStage({ kind: "busy", label: t("menyimpan_resep") });
    let photoPath = draft.photoPath ?? null;
    if (draft.photo?.startsWith("data:")) {
      // Not fetch(): the CSP has no data: in connect-src.
      const blob = dataUrlToBlob(draft.photo);
      const up = await uploadPhoto(blob);
      if ("error" in up) {
        setStage({ kind: "edit" });
        setError(up.error);
        return;
      }
      photoPath = up.path;
    }
    const saved = await saveDraft({
      ...(draft.remoteId ? { id: draft.remoteId } : {}),
      title: draft.title,
      serv: draft.serv,
      note: draft.note,
      ...(photoPath ? { photoPath } : {}),
      ings: toIngLines(parsed),
      steps,
      timeMin: draft.time,
      sourceCreator: draft.sourceCreator?.trim() || null,
      sourceUrl: draft.sourceUrl?.trim().startsWith("https://") ? draft.sourceUrl.trim() : null,
    });
    if ("error" in saved) {
      setStage({ kind: "edit" });
      setError(saved.error);
      return;
    }
    const next = { ...draft, remoteId: saved.id, photoPath, photo: draft.photo };
    setDraft(next);
    saveDraftLocal(next);
    setStage({ kind: "busy", label: t("menerbitkan") });
    const err = await publish(saved.id);
    if (err) {
      setStage({ kind: "edit" });
      setError(t("tulis_err_saved", { err }));
      return;
    }
    const live = { ...next, status: "live" as const };
    setDraft(live);
    saveDraftLocal(live);
    setStage({ kind: "done", id: saved.id });
  };

  const onPublishTap = () => {
    const found = check();
    if (found.some((i) => i.level === "error")) {
      setError(t("tulis_fix_first"));
      return;
    }
    if (found.some((i) => i.level === "warn") && !issues) {
      // First tap shows the warnings; publishing anyway is one more tap.
      setError(null);
      return;
    }
    void doPublish();
  };

  const previewRecipe: Recipe & { unmatched: string[] } = {
    id: draft.remoteId ?? draft.id,
    title: draft.title || t("resep_5"),
    region: "lainnya",
    slots: [],
    serv: draft.serv,
    time: draft.time ?? 0,
    diff: "sedang",
    spice: 0,
    glyph: "\u{1F372}",
    note: draft.note,
    ings: toIngLines(parsed).filter((l) => l[0] !== UNMATCHED_ID),
    steps,
    precise: false,
    imported: false,
    unmatched: parsed.filter((p) => p && !p.id).map((p) => p!.raw),
  };

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[430px] bg-card pb-[calc(8rem+env(safe-area-inset-bottom))]">
      <header className="flex items-center gap-3 px-5 pb-4 pt-[calc(2rem+env(safe-area-inset-top))]">
        <Link
          to="/tulis"
          aria-label={t("back")}
          className="flex size-11 items-center justify-center rounded-full border border-rule"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0">
          <p className="text-caption text-ink-3">{t("tersimpan_otomatis_di_hp_ini")}</p>
        </div>
      </header>

      {hidden ? (
        <p className="mx-5 mb-4 rounded-2xl border border-notice-line bg-notice p-4 text-14 text-notice-ink">
          
          {t("resep_ini_disembunyikan_oleh_moderator")}
          {draft.hiddenReason ? `: ${draft.hiddenReason}` : "."} {" "}{t("kamu_masih_bisa_mengubahnya_tapi")}
        </p>
      ) : null}

      <div className="grid gap-6 px-5">
        {/* Photo */}
        <div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-rule bg-ground"
          >
            {draft.photo ? (
              <img src={draft.photo} alt={t("foto_masakan")} className="h-full w-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-2 text-14 text-ink-3">
                <BrandIcon name="dari-foto" className="size-9" /> {" "}{t("foto_masakan_boleh_nanti")}
              </span>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              try {
                // Redrawn on a canvas: no EXIF, no location, small enough for the device.
                set({ photo: await shrinkPhoto(file), photoPath: null });
              } catch {
                setError(t("photo_unreadable"));
              }
            }}
          />
        </div>

        <label className="grid gap-1">
          <span className="text-label font-bold text-ink-2">{t("nama_resep")}</span>
          <input
            value={draft.title}
            onChange={(e) => set({ title: e.target.value })}
            maxLength={80}
            placeholder={t("misalnya_sayur_asem_kampung")}
            className={`${field} min-h-12`}
          />
          {(issues ?? [])
            .filter((i) => i.field?.kind === "title")
            .map((i) => (
              <IssueLine key={i.message} issue={i} />
            ))}
        </label>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1">
            <span className="text-label font-bold text-ink-2">{t("untuk_berapa_porsi")}</span>
            <PortionStepper value={draft.serv} onChange={(v) => set({ serv: v })} />
          </div>
          <label className="grid gap-1">
            <span className="text-label font-bold text-ink-2">{t("waktu_masak_menit")}</span>
            <input
              inputMode="numeric"
              value={draft.time ?? ""}
              onChange={(e) => {
                const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
                set({ time: Number.isFinite(n) && n > 0 ? Math.min(n, 1440) : null });
              }}
              placeholder="45"
              className={`${field} min-h-12`}
            />
          </label>
        </div>
        {(issues ?? [])
          .filter((i) => i.field?.kind === "serv" || i.field?.kind === "time")
          .map((i) => (
            <IssueLine key={i.message} issue={i} />
          ))}

        {/* Ingredients */}
        <section>
          <h2 className="text-head font-extrabold">{t("bahan")}</h2>
          <p className="mt-1 text-14 text-ink-3">
            
            {t("satu_bahan_per_baris_takaran")}
          </p>
          <ul className="mt-3 grid gap-3">
            {draft.ings.map((text, i) => {
              const p = parsed[i];
              return (
                <li key={i}>
                  <div className="flex items-start gap-2">
                    <input
                      value={text}
                      onChange={(e) => setLine("ings", i, e.target.value)}
                      onPaste={(e) => {
                        const pasted = e.clipboardData.getData("text");
                        if (pasted.includes("\n")) {
                          e.preventDefault();
                          setLine("ings", i, `${text}${pasted}`);
                        }
                      }}
                      placeholder={
                        i === 0
                          ? "500 gram daging sapi" // i18n-ok: example line in the language the recipe parser reads
                          : i === 1
                            ? "5 siung bawang merah" // i18n-ok: example line in the language the recipe parser reads
                            : "garam secukupnya" // i18n-ok: example line in the language the recipe parser reads
                      }
                      aria-label={t("bahan_2", { v1: i + 1 })}
                      className={`${field} min-h-12 flex-1`}
                    />
                    <button
                      type="button"
                      onClick={() => removeLine("ings", i)}
                      aria-label={t("hapus_bahan", { v1: i + 1 })}
                      className="flex size-12 shrink-0 items-center justify-center rounded-xl text-ink-3"
                    >
                      <X className="size-5" />
                    </button>
                  </div>
                  {p ? <ParsedHint line={p} /> : null}
                  {issuesFor("ing", i).map((x) => (
                    <IssueLine key={x.message} issue={x} />
                  ))}
                </li>
              );
            })}
          </ul>
          {issuesFor("ing", 0).length === 0
            ? (issues ?? [])
                .filter((x) => x.code === "no_ings")
                .map((x) => <IssueLine key={x.message} issue={x} />)
            : null}
          <Button
            variant="outline"
            className="mt-3 min-h-11 w-full"
            onClick={() => set({ ings: [...draft.ings, ""] })}
          >
            <Plus /> {" "}{t("tambah_bahan")}
          </Button>
        </section>

        {/* Steps */}
        <section>
          <h2 className="text-head font-extrabold">{t("cara_memasak")}</h2>
          <p className="mt-1 text-14 text-ink-3">
            
            {t("satu_langkah_per_kotak_tulis")}
          </p>
          <ol className="mt-3 grid gap-3">
            {draft.steps.map((text, i) => {
              const secs = parseSteps([text])[0]?.[1] ?? null;
              return (
                <li key={i}>
                  <div className="flex items-start gap-2">
                    <span className="mt-3 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-14 font-extrabold text-primary-deep">
                      {i + 1}
                    </span>
                    <textarea
                      value={text}
                      onChange={(e) => {
                        const list = [...draft.steps];
                        list[i] = e.target.value;
                        set({ steps: list });
                      }}
                      rows={2}
                      placeholder={
                        i === 0
                          ? "Tumis bumbu halus sampai harum, 3 menit." // i18n-ok: example line in the language the recipe parser reads
                          : "Masukkan daging, aduk rata." // i18n-ok: example line in the language the recipe parser reads
                      }
                      aria-label={t("langkah_2", { v1: i + 1 })}
                      className={`${field} min-h-12 flex-1 py-3`}
                    />
                    <button
                      type="button"
                      onClick={() => removeLine("steps", i)}
                      aria-label={t("hapus_langkah", { v1: i + 1 })}
                      className="flex size-12 shrink-0 items-center justify-center rounded-xl text-ink-3"
                    >
                      <X className="size-5" />
                    </button>
                  </div>
                  {secs ? (
                    <p className="mt-1 ml-9 flex items-center gap-1 text-caption text-primary">
                      <Timer className="size-3.5" aria-hidden /> {" "}{t("timer")}{" "}{fmtSeconds(secs)}
                    </p>
                  ) : null}
                  {issuesFor("step", i).map((x) => (
                    <IssueLine key={x.message} issue={x} />
                  ))}
                </li>
              );
            })}
          </ol>
          {(issues ?? [])
            .filter((x) => x.code === "no_steps" || x.code === "few_steps")
            .map((x) => (
              <IssueLine key={x.message} issue={x} />
            ))}
          <Button
            variant="outline"
            className="mt-3 min-h-11 w-full"
            onClick={() => set({ steps: [...draft.steps, ""] })}
          >
            <Plus /> {" "}{t("tambah_langkah")}
          </Button>
        </section>

        <label className="grid gap-1">
          <span className="text-label font-bold text-ink-2">{t("catatan_boleh_kosong")}</span>
          <textarea
            value={draft.note}
            onChange={(e) => set({ note: e.target.value.slice(0, 300) })}
            rows={3}
            placeholder={t("tips_asal_resep_atau_enak")}
            className={`${field} py-3`}
          />
        </label>

        {/* Credit */}
        <div className="rounded-2xl border border-rule p-4">
          <label className="flex min-h-11 items-center gap-3 text-body">
            <input
              type="checkbox"
              checked={showSource}
              onChange={(e) => {
                setShowSource(e.target.checked);
                if (!e.target.checked) set({ sourceCreator: undefined, sourceUrl: undefined });
              }}
              className="size-5 accent-[var(--primary)]"
            />
            
            {t("resep_ini_dari_video_atau")}
          </label>
          {showSource ? (
            <div className="mt-3 grid gap-3">
              <p className="text-caption text-ink-3">
                
                {t("nama_kreatornya_akan_tertulis_di")}
              </p>
              <input
                value={draft.sourceCreator ?? ""}
                onChange={(e) => set({ sourceCreator: e.target.value.slice(0, 60) })}
                placeholder={t("kreator")}
                aria-label={t("nama_kreator_asli")}
                className={`${field} min-h-12`}
              />
              <input
                value={draft.sourceUrl ?? ""}
                onChange={(e) => set({ sourceUrl: e.target.value.slice(0, 300) })}
                placeholder={t("https_tautan_videonya")}
                inputMode="url"
                aria-label={t("tautan_sumber")}
                className={`${field} min-h-12`}
              />
            </div>
          ) : null}
        </div>

        {issues && (errors.length || warnings.length) ? (
          <section aria-live="polite" className="rounded-2xl border border-rule bg-ground p-4">
            <h2 className="text-body font-extrabold">
              {errors.length
                ? t("hal_perlu_dilengkapi", { v1: errors.length })
                : t("sudah_bisa_terbit_cek_dulu")}
            </h2>
            <ul className="mt-2 grid gap-2">
              {[...errors, ...warnings].map((x) => (
                <IssueLine key={`${x.code}-${x.message}`} issue={x} />
              ))}
            </ul>
          </section>
        ) : issues ? (
          <p className="flex items-center gap-2 text-14 font-bold text-primary">
            <Check className="size-4" /> {" "}{t("resepnya_lengkap_dan_runtut")}
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="text-14 text-danger-ink">
            {error}
          </p>
        ) : null}
        {savedNote ? (
          <p role="status" className="text-14 text-primary-deep">
            {savedNote}
          </p>
        ) : null}

        {stage.kind === "signin" ? (
          <div className="rounded-2xl border border-primary-line bg-primary-soft p-4">
            <p className="text-body font-bold">{t("masuk_dulu_untuk_menerbitkan")}</p>
            <p className="mt-1 text-14 text-ink-2">
              
              {t("drafnya_sudah_tersimpan_di_hp")}
            </p>
            <Button asChild className="mt-3 min-h-11 w-full">
              <Link to="/masuk">{t("sign_in")}</Link>
            </Button>
          </div>
        ) : null}

        {stage.kind === "handle" ? (
          <div className="rounded-2xl border border-primary-line bg-primary-soft p-4">
            <p className="mb-3 text-body font-bold">{t("pilih_nama_pengguna_untuk_resepmu")}</p>
            <HandleForm initialHandle={null} initialName={null} onSaved={() => void doPublish()} />
          </div>
        ) : null}

        {stage.kind === "done" ? (
          <div className="rounded-2xl border border-primary-line bg-primary-soft p-4">
            <p className="flex items-center gap-2 text-body font-extrabold text-primary-deep">
              <Check className="size-5" /> {" "}{t("resepmu_sudah_terbit")}
            </p>
            <div className="mt-3 grid gap-2">
              <Button className="min-h-11 w-full" onClick={() => setSharing(true)}>
                <Share2 /> {" "}{t("bagikan_resep")}
              </Button>
              <Button asChild variant="outline" className="min-h-11 w-full">
                <Link to="/tulisan/$id" params={{ id: stage.id }}>
                  
                  {t("lihat_halamannya")}
                </Link>
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[430px] border-t border-rule bg-card px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="min-h-12 flex-1"
            onClick={() => {
              const ok = saveDraftLocal(draft);
              setSavedNote(
                ok
                  ? t("draft_saved")
                  : t("draft_storage_full"),
              );
            }}
          >
            
            {t("simpan_draf")}
          </Button>
          {draft.status === "live" ? (
            <Button
              variant="outline"
              className="min-h-12 flex-1"
              onClick={async () => {
                if (!draft.remoteId) return;
                const err = await unpublish(draft.remoteId);
                if (err) setError(err);
                else set({ status: "draft" });
              }}
            >
              
              {t("tarik_dari_publik")}
            </Button>
          ) : null}
          <Button
            className="min-h-12 flex-[1.4]"
            disabled={stage.kind === "busy" || hidden}
            onClick={onPublishTap}
          >
            {stage.kind === "busy"
              ? stage.label
              : issues && !errors.length && warnings.length
                ? t("terbitkan_saja")
                : draft.status === "live"
                  ? t("simpan_perubahan")
                  : t("periksa_terbitkan")}
          </Button>
        </div>
        {!draft.remoteId ? (
          <button
            type="button"
            className="mt-1 flex min-h-11 w-full items-center justify-center gap-1 text-caption text-ink-3"
            onClick={() => {
              deleteDraftLocal(draft.id);
              navigate({ to: "/tulis" });
            }}
          >
            <Trash2 className="size-3.5" /> {" "}{t("hapus_draf_ini")}
          </button>
        ) : null}
      </div>

      {stage.kind === "done" ? (
        <ShareSheet
          open={sharing}
          onClose={() => setSharing(false)}
          target={{
            kind: "user",
            ref: stage.id,
            title: draft.title,
            sourceCreator: draft.sourceCreator ?? null,
            sourceUrl: draft.sourceUrl ?? null,
          }}
          card={{
            recipe: { ...previewRecipe, sourceCreator: draft.sourceCreator ?? null },
            kind: "user",
            authorHandle: null,
            myPhoto: draft.photo?.startsWith("data:") ? draft.photo : null,
            recipePhoto: draft.photo,
            servings: draft.serv,
          }}
        />
      ) : null}
    </main>
  );
}

function ParsedHint({ line }: { line: NonNullable<ReturnType<typeof parseIngredientLine>> }) {
  if (!line.id) {
    return (
      <p className="mt-1 flex items-center gap-1 text-caption text-notice-ink">
        <CircleAlert className="size-3.5 shrink-0" aria-hidden /> {" "}{t("racik_belum_kenal_bahan_ini")}
      </p>
    );
  }
  const name = ING[line.id]?.name ?? line.id;
  const amount =
    line.qty != null
      ? `${fmtQty(line.qty)} ${unitOf(line.line)}`
      : line.toTaste
        ? "secukupnya"
        : t("no_amount_yet");
  return (
    <p className="mt-1 flex items-center gap-1 text-caption text-primary">
      <Check className="size-3.5 shrink-0" aria-hidden /> {name} · {amount}
      {line.prep ? <span className="text-ink-3"> · {line.prep}</span> : null}
    </p>
  );
}

function IssueLine({ issue }: { issue: Issue }) {
  const err = issue.level === "error";
  return (
    <p
      className={`mt-1 flex items-start gap-1.5 text-caption ${err ? "text-danger-ink" : "text-notice-ink"}`}
    >
      {err ? (
        <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      ) : (
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      )}
      <span>{issue.message}</span>
    </p>
  );
}
