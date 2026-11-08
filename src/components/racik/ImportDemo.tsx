import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Camera, Check, ImageIcon, Link2, PenLine, RotateCcw, Upload, X } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  canonicalUrl,
  getImportQuota,
  importRecipeFromPhoto,
  importRecipeFromUpload,
  importRecipeFromVideo,
  MAX_CAPTION_CHARS,
  MIN_CAPTION_CHARS,
  resumeImport,
} from "@/lib/racik/import-recipe.functions";
import type { ImportResult } from "@/lib/racik/import-recipe.functions";
import {
  CLIENT_TIMEOUT_MS,
  claimRecovery,
  clearInFlight,
  clearStash,
  compressPhoto,
  identity,
  ImportClientError,
  INFLIGHT_MAX_AGE_MS,
  markInFlight,
  newRequestId,
  notifySavedSignedOut,
  readInFlight,
  setImportSheetOpen,
  stashResult,
  takeStashed,
  videoFileProblem,
  withTimeout,
} from "@/lib/racik/import-client";
import {
  codeFromThrown,
  errorMessage,
  isOutage,
  isRetryable,
  noRecipeMessage,
  type ImportAction,
  type ImportErrorCode,
  type ImportMessage,
} from "@/lib/racik/import-messages";
import {
  quotaLabel,
  remaining,
  resetLabel,
  type ImportSource,
  type QuotaInfo,
} from "@/lib/racik/import-quota";
import { useRacik } from "@/lib/racik/state";
import type { Negara } from "@/lib/racik/locale";
import type { ImportedRecipe } from "@/lib/racik/types";
import { Sheet } from "./Sheet";
import { ImportProgress } from "./ImportProgress";
import { BrandIcon } from "./BrandIcon";
import { t, type Key } from "@/lib/racik/i18n";

type Tab = "tautan" | "keterangan" | "foto";

/** The green "Tambah Resep" card used in Koleksi and /ambil; opens the shared import sheet. */
export function ImportDemo({ onImported }: { compact?: boolean; onImported?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <section className="rounded-2xl bg-primary p-5 text-primary-foreground">
        <div className="mb-4 flex items-start gap-3">
          <BrandIcon name="import-link" className="size-12" />
          <div>
            <h2 className="text-17 font-extrabold leading-tight tracking-[-0.02em]">
              {t("punya_resep_dari_luar_racik")}
            </h2>
            <p className="mt-0.5 text-caption text-primary-foreground/95">
              {t("dari_link_video_teks_resep_2")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-h-12 w-full rounded-xl bg-card text-14 font-extrabold text-primary"
        >
          {t("tab_import")}
        </button>
      </section>
      <ImportSheet
        open={open}
        onClose={() => setOpen(false)}
        {...(onImported ? { onImported } : {})}
      />
    </>
  );
}

/** A quiet "Tambah resep" row for Masak and Cari; opens the same import sheet as Koleksi. */
export function ImportButton() {
  const [open, setOpen] = useState(false);
  // Computers import too (Octavia, 30 Okt 2026, reversing the phone-only rule from earlier that day).
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-rule-strong bg-card px-3.5 py-3 text-left"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <Link2 aria-hidden className="size-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-15 font-bold text-ink-strong">{t("tambah_resep")}</span>
          <span className="block text-label text-ink-3">{t("dari_link_video_teks_atau")}</span>
        </span>
      </button>
      <ImportSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

const VIDEO_LINK =
  /https?:\/\/(www\.|vt\.|vm\.|m\.)?(tiktok\.com|instagram\.com|youtube\.com|youtu\.be)\/\S+/i;
export const isVideoLink = (s: string) => VIDEO_LINK.test(s.trim());
/** The first TikTok / Instagram / YouTube link inside any shared text. */
export function findVideoLink(text: string): string | null {
  const m = text.match(VIDEO_LINK);
  return m ? m[0].replace(/[).,!?]+$/, "") : null;
}

const MODE: Record<Tab, { label: string; action: string }> = {
  tautan: {
    get label() {
      return t("link_video");
    },
    get action() {
      return t("ubah_jadi_resep");
    },
  },
  keterangan: {
    get label() {
      return t("teks_resep");
    },
    get action() {
      return t("ubah_jadi_resep");
    },
  },
  foto: {
    get label() {
      return t("foto_resep");
    },
    get action() {
      return t("pick_recipe_photo");
    },
  },
};

type Stage = "form" | "working" | "listening" | "done" | "kosong" | "habis" | "istirahat";

/** One line for the alert under the form: title and body of a message. */
type FormError = { message: ImportMessage; code: ImportErrorCode | null };

/** Shared import flow: source → working → saved. Opened from the bottom bar, Koleksi and /ambil. */
export function ImportSheet({
  open,
  onClose,
  onImported,
  shared,
}: {
  open: boolean;
  onClose: () => void;
  onImported?: () => void;
  shared?: { url?: string; text?: string } | undefined;
}) {
  useEffect(() => {
    if (!open) return;
    setImportSheetOpen(true);
    return () => setImportSheetOpen(false);
  }, [open]);
  const { state, update, ready } = useRacik();
  const importRecipe = useServerFn(importRecipeFromVideo);
  const importUpload = useServerFn(importRecipeFromUpload);
  const importPhoto = useServerFn(importRecipeFromPhoto);
  const fetchQuota = useServerFn(getImportQuota);
  const resume = useServerFn(resumeImport);
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const openRef = useRef(open);
  openRef.current = open;
  const busyRef = useRef(false);
  const retryRef = useRef<(() => void) | null>(null);

  const [tab, setTab] = useState<Tab>("tautan");
  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [stage, setStage] = useState<Stage>("form");
  const [source, setSource] = useState<ImportSource>("link");
  const [title, setTitle] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState<FormError | null>(null);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [fromLanguage, setFromLanguage] = useState<string | null>(null);
  const [needCaption, setNeedCaption] = useState(false);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [banner, setBanner] = useState<{ title: string } | null>(null);
  /** After an outage the button rests a few minutes, so nobody hammers a broken service. */
  const [restUntil, setRestUntil] = useState(0);
  const [, setTick] = useState(0);
  const resting = restUntil > Date.now();
  useEffect(() => {
    if (!restUntil) return;
    const timer = setTimeout(() => setTick((n) => n + 1), Math.max(0, restUntil - Date.now()) + 50);
    return () => clearTimeout(timer);
  }, [restUntil]);
  const valid = isVideoLink(url);
  const captionLength = caption.trim().length;
  const captionReady = captionLength > 0 && captionLength <= MAX_CAPTION_CHARS;

  const setOpen = (v: boolean) => {
    if (!v) onClose();
  };

  // On open: reset a finished screen, and fetch how much of this month is left.
  useEffect(() => {
    if (!open) return;
    setStage((s) => (s === "working" || s === "listening" ? s : "form"));
    setError(null);
    let alive = true;
    void (async () => {
      try {
        const who = await identity();
        const status = await withTimeout(fetchQuota({ data: who }), 8_000);
        if (!alive) return;
        if (status.disabled) {
          setStage((s) => (s === "working" || s === "listening" ? s : "istirahat"));
          return;
        }
        if (status.quota) {
          setQuota(status.quota);
          if (remaining(status.quota) === 0) setStage((s) => (s === "form" ? "habis" : s));
        }
      } catch (caught) {
        console.warn("[racik-import] quota check failed", caught);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, fetchQuota]);

  /** Saves into Racik's state (persisted to IndexedDB at once) and tells the account prompt. */
  const save = useCallback(
    (recipe: ImportedRecipe, signedIn: boolean) => {
      update((current) =>
        current.imported.some((r) => r.id === recipe.id)
          ? {}
          : { imported: [recipe, ...current.imported] },
      );
      // The stash is only a bridge over a reload; once state has been written it must go,
      // or a recipe deleted later would come back on the next load.
      setTimeout(() => clearStash(), 3_000);
      if (!signedIn) notifySavedSignedOut(recipe);
    },
    [update],
  );

  // After a reload mid-import: pick up the stashed result, or ask the server for it.
  useEffect(() => {
    if (!ready || !claimRecovery()) return;
    const stashed = takeStashed();
    if (stashed) {
      clearInFlight();
      void identity().then((who) => {
        save(stashed.recipe, Boolean(who.token));
        setBanner({ title: stashed.recipe.title });
      });
      return;
    }
    const pending = readInFlight();
    if (!pending) return;
    let alive = true;
    void (async () => {
      const who = await identity();
      while (alive && Date.now() - pending.startedAt < INFLIGHT_MAX_AGE_MS) {
        try {
          const answer = await withTimeout(
            resume({ data: { ...who, requestId: pending.requestId } }),
            10_000,
          );
          if (answer.status === "ok") {
            save(answer.recipe, Boolean(who.token));
            setBanner({ title: answer.recipe.title });
            break;
          }
          if (answer.status === "gone") break;
        } catch (caught) {
          console.warn("[racik-import] resume check failed", caught);
        }
        await new Promise((r) => setTimeout(r, 4_000));
      }
      clearInFlight(pending.requestId);
    })();
    return () => {
      alive = false;
    };
  }, [ready, resume, save]);

  // Shared from TikTok / Reels / Shorts through the Android share sheet: the
  // link arrives in `url` or buried in `text` ("Lihat video ini… https://vt.tiktok.com/…").
  // A recognisable video link starts right away; other shared text lands in the
  // text tab so nothing she shared is thrown away.
  const sharedHandled = useRef(false);
  useEffect(() => {
    // Wait for saved recipes to load: the duplicate check needs them, or a
    // shared link already in Koleksi is imported (and counted) a second time.
    if (!open || !shared || !ready || sharedHandled.current) return;
    sharedHandled.current = true;
    const link = findVideoLink(`${shared.url ?? ""} ${shared.text ?? ""}`);
    if (link) {
      setTab("tautan");
      setUrl(link);
      void submitLink(false, link);
    } else if (shared.text?.trim()) {
      setTab("keterangan");
      setCaption(shared.text.trim());
    } else if (shared.url?.trim()) {
      // Not a video link: show it in the field, so the "use a TikTok, Instagram or
      // YouTube link" message explains why nothing happened.
      setTab("tautan");
      setUrl(shared.url.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, shared, ready]);

  const showError = (code: ImportErrorCode, from: ImportSource) => {
    if (code === "quota") {
      setStage("habis");
      return;
    }
    if (code === "disabled") {
      setStage("istirahat");
      return;
    }
    if (isOutage(code)) setRestUntil(Date.now() + OUTAGE_REST_MS);
    setError({ message: errorMessage(code, from), code });
    setTab(
      from === "teks"
        ? "keterangan"
        : from === "foto"
          ? "foto"
          : from === "berkas" && !valid
            ? "keterangan"
            : tab,
    );
    setStage("form");
  };

  const handle = (result: ImportResult, from: ImportSource, signedIn: boolean) => {
    if (result.quota) setQuota(result.quota);
    if (result.ok) {
      save(result.recipe, signedIn);
      setTitle(result.recipe.title);
      setUnmatched(result.unmatched);
      setFromLanguage(result.recipe.bahasaAsal ?? null);
      setNotice(result.notice ?? "");
      setCaption("");
      setNeedCaption(false);
      setStage("done");
      if (!openRef.current) setBanner({ title: result.recipe.title });
      onImported?.();
      return;
    }
    if (result.kind === "error") {
      showError(result.code, from);
      return;
    }
    if (result.kind === "noRecipe") {
      setStage("kosong");
      return;
    }
    // The three link-only outcomes: the text tab is the way forward.
    setNeedCaption(true);
    setTab("keterangan");
    if (result.kind === "needCaption" && result.partial) setCaption(result.partial);
    setError({
      code: null,
      message:
        result.kind === "limited"
          ? {
              title: t("aplikasi_videonya_sedang_menahan_permintaan"),
              body: t("tunggu_sebentar_lalu_coba_lagi"),
              actions: [],
            }
          : result.kind === "unavailable"
            ? {
                title: t("videonya_tidak_bisa_dibuka"),
                body: t("mungkin_sudah_dihapus_atau_disetel"),
                actions: [],
              }
            : {
                title: t("racik_belum_bisa_membaca_videonya"),
                // Instagram never lets a server fetch the video itself, so say that plainly.
                body: /instagram\.com/i.test(url)
                  ? t("instagram_tidak_membagikan_videonya")
                  : t("tempel_teks_resep_lengkapnya_di"),
                actions: [],
              },
    });
    setStage("form");
  };

  /** One guarded run: in-flight marker, timeout, result stashed before any UI. */
  const run = async (
    from: ImportSource,
    call: (who: {
      deviceId: string;
      token?: string;
      requestId: string;
      negara: Negara;
    }) => Promise<ImportResult>,
  ) => {
    if (busyRef.current) return;
    busyRef.current = true;
    retryRef.current = () => void run(from, call);
    setError(null);
    setSource(from);
    setStage(from === "suara" || from === "berkas" ? "listening" : "working");
    const requestId = newRequestId();
    markInFlight({ requestId, source: from, startedAt: Date.now() });
    let keepMarker = false;
    try {
      const who = await identity();
      // The country only steers which swaps the importer suggests.
      const result = await withTimeout(
        call({ ...who, requestId, negara: state.negara }),
        CLIENT_TIMEOUT_MS[from],
      );
      if (result.ok) stashResult(result.recipe, result.notice ?? null);
      handle(result, from, Boolean(who.token));
    } catch (caught) {
      console.warn("[racik-import] request failed", caught);
      const online = typeof navigator === "undefined" || navigator.onLine !== false;
      const code =
        caught instanceof ImportClientError ? caught.code : codeFromThrown(caught, online);
      // On a timeout the server may still finish; a later reload can pick the result up.
      keepMarker = code === "timeout";
      showError(code, from);
    } finally {
      if (!keepMarker) clearInFlight(requestId);
      busyRef.current = false;
    }
  };

  const submitLink = async (listen = false, link: string = url) => {
    if (!isVideoLink(link)) return;
    // The duplicate check compares canonical links, not pasted ones.
    const canon = canonicalUrl(link).url;
    const duplicate = state.imported.find(
      (recipe) => canonicalUrl(recipe.sourceUrl ?? "").url === canon,
    );
    if (duplicate && !listen) {
      setTitle(duplicate.title);
      setUnmatched(duplicate.unmatched ?? []);
      setFromLanguage(duplicate.bahasaAsal ?? null);
      setNotice(t("import_duplicate"));
      setStage("done");
      return;
    }
    await run(listen ? "suara" : "link", (who) =>
      importRecipe({ data: { url: link.trim(), listen, ...who } }),
    );
  };

  const submitCaption = async () => {
    if (!captionReady) {
      if (captionLength > MAX_CAPTION_CHARS) showError("text_too_long", "teks");
      return;
    }
    await run("teks", (who) =>
      importRecipe({
        data: { caption: caption.trim(), ...(valid ? { url: url.trim() } : {}), ...who },
      }),
    );
  };

  const submitFile = async (file: File) => {
    const problem = videoFileProblem(file);
    if (problem) {
      setSource("berkas");
      showError(problem, "berkas");
      return;
    }
    await run("berkas", (who) => {
      const form = new FormData();
      if (valid) form.append("url", url.trim());
      form.append("file", file);
      form.append("deviceId", who.deviceId);
      form.append("requestId", who.requestId);
      form.append("negara", who.negara);
      if (who.token) form.append("token", who.token);
      return importUpload({ data: form });
    });
  };

  const submitPhotos = async (files: File[]) => {
    if (files.length > 4) {
      setSource("foto");
      showError("too_many_photos", "foto");
      return;
    }
    await run("foto", async (who) => {
      const form = new FormData();
      // Shrunk on the phone first: ~1600 px JPEG, no EXIF/location.
      for (const file of files) form.append("photo", await compressPhoto(file));
      form.append("deviceId", who.deviceId);
      form.append("requestId", who.requestId);
      form.append("negara", who.negara);
      if (who.token) form.append("token", who.token);
      return importPhoto({ data: form });
    });
  };

  const doAction = (action: ImportAction) => {
    switch (action) {
      case "listen":
        void submitLink(true);
        break;
      case "upload":
        fileRef.current?.click();
        break;
      case "paste":
      case "edit_text":
        setError(null);
        setStage("form");
        setTab("keterangan");
        break;
      case "photo_again":
        setError(null);
        setStage("form");
        setTab("foto");
        photoRef.current?.click();
        break;
      case "retry":
        retryRef.current?.();
        break;
      case "new_link":
        setError(null);
        setNeedCaption(false);
        setUrl("");
        setStage("form");
        setTab("tautan");
        break;
      case "write":
        break;
    }
  };

  const actionButton = (action: ImportAction, primary: boolean) => {
    const cls = `mt-3 min-h-12 w-full rounded-xl text-14 font-bold`;
    const variant = primary ? "default" : "outline";
    switch (action) {
      case "listen":
        return valid ? (
          <div key={action}>
            <Button variant={variant} className={cls} onClick={() => doAction(action)}>
              <BrandIcon name="suara" className="size-6 rounded-md" />{" "}
              {t("dengarkan_suara_videonya")}
            </Button>
            <p className="mt-1.5 text-label text-ink-3">{t("bisa_sampai_satu_menit_racik")}</p>
          </div>
        ) : null;
      case "upload":
        return (
          <div key={action}>
            <Button variant={variant} className={cls} onClick={() => doAction(action)}>
              <Upload /> {t("unggah_videonya")}
            </Button>
            <p className="mt-1.5 text-label text-ink-3">{t("video_atau_rekaman_suara_paling")}</p>
          </div>
        );
      case "paste":
        return (
          <Button key={action} variant={variant} className={cls} onClick={() => doAction(action)}>
            <BrandIcon name="tempel" className="size-6 rounded-md" /> {t("tempel_teks_resep")}
          </Button>
        );
      case "edit_text":
        return (
          <Button key={action} variant={variant} className={cls} onClick={() => doAction(action)}>
            <PenLine /> {t("ubah_teksnya")}
          </Button>
        );
      case "photo_again":
        return (
          <Button key={action} variant={variant} className={cls} onClick={() => doAction(action)}>
            <Camera /> {t("pilih_foto_lain")}
          </Button>
        );
      case "retry":
        return retryRef.current ? (
          <Button key={action} variant={variant} className={cls} onClick={() => doAction(action)}>
            <RotateCcw /> {t("coba_lagi")}
          </Button>
        ) : null;
      case "new_link":
        return (
          <Button key={action} variant={variant} className={cls} onClick={() => doAction(action)}>
            <Link2 /> {t("coba_link_lain")}
          </Button>
        );
      case "write":
        return (
          <Button key={action} asChild variant={variant} className={cls}>
            <Link to="/tulis" onClick={() => setOpen(false)}>
              <PenLine /> {t("write_recipe")}
            </Link>
          </Button>
        );
    }
  };

  const alert = error ? (
    <div role="alert" className="mt-3 rounded-xl bg-danger-soft p-3">
      <p className="text-14 font-bold text-danger-ink">{error.message.title}</p>
      <p className="mt-0.5 text-14 leading-normal text-ink-2">{error.message.body}</p>
      {error.code && isRetryable(error.code) && retryRef.current ? (
        <button
          type="button"
          onClick={() => doAction("retry")}
          className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-14 font-bold text-primary"
        >
          <RotateCcw className="size-4" /> {t("coba_lagi")}
        </button>
      ) : null}
      {error.code && !isRetryable(error.code) && error.message.actions.includes("write") ? (
        <Link
          to="/tulis"
          onClick={() => setOpen(false)}
          className="mt-2 inline-flex min-h-11 items-center text-14 font-bold text-primary"
        >
          {t("write_recipe")}
        </Link>
      ) : null}
    </div>
  ) : null;

  const tabButton = (value: Tab, label: string) => (
    <button
      type="button"
      onClick={() => {
        setTab(value);
        setError(null);
      }}
      className={`flex min-h-[46px] items-center justify-center gap-2 rounded-lg text-caption font-bold ${tab === value || (value === "tautan" && tab === "keterangan") ? "bg-card text-ink shadow-chip" : "text-ink-3"}`}
    >
      <BrandIcon
        name={value === "foto" ? "dari-foto" : "import-link"}
        className="size-6 rounded-md"
      />
      {label}
    </button>
  );

  const label = quota ? quotaLabel(quota) : null;
  const empty = noRecipeMessage(source);
  const sheetTitle =
    stage === "done"
      ? t("resep_tersimpan")
      : stage === "working" || stage === "listening"
        ? t("import_working")
        : t("ubah_jadi_resep");

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="video/*,audio/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void submitFile(file);
        }}
      />
      {/* No `capture`: Android then offers both camera and gallery. */}
      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const arr = e.target.files ? Array.from(e.target.files) : [];
          e.target.value = "";
          if (arr.length) void submitPhotos(arr);
        }}
      />
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={sheetTitle}
        large={stage === "working" || stage === "listening"}
        {...(stage === "form"
          ? {
              subtitle: t("masukkan_link_video_teks_resep"),
            }
          : {})}
      >
        {stage === "form" ? (
          <>
            <div className="grid grid-cols-2 rounded-xl bg-tint p-1">
              {tabButton("tautan", MODE.tautan.label)}
              {tabButton("foto", MODE.foto.label)}
            </div>
            {label ? <p className="mt-3 text-label font-bold text-ink-3">{label}</p> : null}
            {tab === "tautan" ? (
              <>
                <label className="mt-4 flex min-h-[52px] items-center gap-3 rounded-xl border border-rule bg-ground px-3.5 focus-within:border-primary">
                  <Link2 aria-hidden className="size-[18px] shrink-0 text-ink-3" />
                  <span className="sr-only">{t("link_video")}</span>
                  <input
                    value={url}
                    onChange={(e) => {
                      setError(null);
                      setUrl(findVideoLink(e.target.value) ?? e.target.value);
                    }}
                    type="url"
                    placeholder={t("link_tiktok_reels_atau_youtube")}
                    className="min-w-0 flex-1 bg-transparent text-14 outline-none placeholder:text-ink-3"
                  />
                </label>
                {url && !valid ? (
                  <p className="mt-2 text-14 text-danger-ink">
                    {t("gunakan_link_tiktok_instagram_atau")}
                  </p>
                ) : null}
                {alert}
                <Button
                  variant="outline"
                  className="mt-3 min-h-11 w-full rounded-xl text-14 font-bold text-ink-2"
                  onClick={async () => {
                    try {
                      const t = await navigator.clipboard.readText();
                      setError(null);
                      setUrl(findVideoLink(t) ?? t);
                    } catch {
                      setError({
                        code: null,
                        message: {
                          title: t("belum_bisa_membaca_yang_kamu"),
                          body: t("tempel_langsung_di_kolomnya"),
                          actions: [],
                        },
                      });
                    }
                  }}
                >
                  <BrandIcon name="tempel" className="size-6 rounded-md" />{" "}
                  {t("tempel_dari_clipboard")}
                </Button>
                <Button
                  variant="cta"
                  className="mt-5 min-h-[54px] w-full rounded-xl text-body font-bold disabled:bg-rule disabled:text-ink-3 disabled:opacity-100 disabled:shadow-none"
                  disabled={!valid || resting}
                  onClick={() => void submitLink(false)}
                >
                  {MODE.tautan.action}
                </Button>
                {resting ? (
                  <p className="mt-2 text-center text-14 text-ink-3">
                    {t("bisa_dicoba_lagi_beberapa_menit")}
                  </p>
                ) : null}
              </>
            ) : tab === "foto" ? (
              <>
                <button
                  type="button"
                  onClick={() => photoRef.current?.click()}
                  className="mt-4 flex min-h-[168px] w-full flex-col items-center justify-center rounded-2xl border-[1.5px] border-dashed border-primary-line bg-primary-wash text-primary"
                >
                  <ImageIcon aria-hidden className="size-[30px]" strokeWidth={1.8} />
                  <span className="mt-2.5 text-15 font-bold">
                    {t("ambil_atau_pilih_foto_resep")}
                  </span>
                  <span className="mt-1 text-label text-ink-3">
                    {t("bisa_berupa_tulisan_tangan_atau")}
                  </span>
                </button>
                {alert}
                <Button
                  variant="cta"
                  className="mt-5 min-h-[54px] w-full rounded-xl text-body font-bold"
                  onClick={() => photoRef.current?.click()}
                >
                  <Camera /> {MODE.foto.action}
                </Button>
              </>
            ) : (
              <>
                <label className="mt-4 block">
                  <span className="sr-only">{t("teks_resep")}</span>
                  <textarea
                    value={caption}
                    onChange={(e) => {
                      setError(null);
                      setCaption(e.target.value);
                    }}
                    rows={6}
                    placeholder={t("tempel_bahan_dan_cara_memasak")}
                    className="min-h-[132px] w-full resize-none rounded-xl border border-rule bg-ground p-3.5 text-body leading-relaxed outline-none focus:border-primary"
                  />
                </label>
                {captionLength > MAX_CAPTION_CHARS * 0.75 ? (
                  <p
                    className={`mt-1 text-right text-label tabular-nums ${captionLength > MAX_CAPTION_CHARS ? "font-bold text-danger-ink" : "text-ink-3"}`}
                  >
                    {captionLength.toLocaleString("id-ID")} /{" "}
                    {MAX_CAPTION_CHARS.toLocaleString("id-ID")} {t("huruf")}
                  </p>
                ) : null}
                <p className="mt-2 text-14 text-muted-foreground">
                  {t("dari_video_buka_videonya_tahan")}
                </p>
                {alert}
                <Button
                  variant="outline"
                  className="mt-3 min-h-11 w-full rounded-xl text-14 font-bold text-ink-2"
                  onClick={async () => {
                    try {
                      setCaption(await navigator.clipboard.readText());
                      setError(null);
                    } catch {
                      setError({
                        code: null,
                        message: {
                          title: t("belum_bisa_membaca_yang_kamu"),
                          body: t("tempel_teksnya_langsung_di_kolomnya"),
                          actions: [],
                        },
                      });
                    }
                  }}
                >
                  <BrandIcon name="tempel" className="size-6 rounded-md" />{" "}
                  {t("tempel_dari_clipboard")}
                </Button>
                <Button
                  variant="cta"
                  className="mt-5 min-h-[54px] w-full rounded-xl text-body font-bold disabled:bg-rule disabled:text-ink-3 disabled:opacity-100 disabled:shadow-none"
                  disabled={!captionReady || resting}
                  onClick={() => void submitCaption()}
                >
                  {MODE.keterangan.action}
                </Button>
                {captionLength > 0 && captionLength < MIN_CAPTION_CHARS ? (
                  <p className="mt-2 text-14 text-muted-foreground">
                    {t("teks_sependek_ini_biasanya_belum")}
                  </p>
                ) : null}
                {captionLength > MAX_CAPTION_CHARS ? (
                  <p className="mt-2 text-14 text-danger-ink">
                    {t("teksnya_terlalu_panjang_hapus_bagian")}
                  </p>
                ) : null}
                {needCaption && valid ? (
                  <>
                    {/* Racik already listened on its own; offering it again would only fail again. */}
                    <Button
                      variant="outline"
                      className="mt-5 min-h-12 w-full rounded-xl text-14 font-bold"
                      onClick={() => fileRef.current?.click()}
                    >
                      <Upload /> {t("unggah_videonya")}
                    </Button>
                    <p className="mt-1.5 text-label text-ink-3">
                      {t("video_atau_rekaman_suara_paling")}
                    </p>
                  </>
                ) : null}
              </>
            )}
            {tab === "foto" ? (
              <p className="mt-4 text-label text-ink-3">{t("boleh_sampai_4_foto_sekaligus")}</p>
            ) : tab === "tautan" ? (
              <p className="mt-4 text-label text-ink-3">{t("bisa_dari_bahasa_apa_saja")}</p>
            ) : (
              <p className="mt-4 text-label text-ink-3">{t("bisa_dari_bahasa_apa_saja_2")}</p>
            )}
            <Link
              to="/tulis"
              onClick={() => setOpen(false)}
              className="mt-4 block text-center text-14 font-bold text-primary"
            >
              {t("atau_tulis_resep_sendiri")}
            </Link>
          </>
        ) : stage === "working" || stage === "listening" ? (
          <ImportProgress source={source} />
        ) : stage === "kosong" ? (
          <div className="py-2">
            <h3 className="text-title font-bold">{empty.title}</h3>
            <p className="mt-2 text-body text-muted-foreground">{empty.body}</p>
            <div className="mt-3">
              {empty.actions.map((action, i) => actionButton(action, i === 0))}
            </div>
            <Link
              to="/tulis"
              onClick={() => setOpen(false)}
              className="mt-5 block text-center text-14 font-bold text-primary"
            >
              {t("atau_tulis_resep_sendiri")}
            </Link>
          </div>
        ) : stage === "habis" ? (
          <div className="py-2">
            <h3 className="text-title font-bold">{t("jatah_bulan_ini_sudah_habis")}</h3>
            <p className="mt-2 text-body text-muted-foreground">
              {quota?.limit != null
                ? t("kamu_sudah_menambah_resep_bulan", { limit: quota.limit })
                : ""}
              {t("jatahnya_terisi_lagi_tanggal")} {quota ? resetLabel(quota) : t("n1_bulan_depan")}
              {t("resep_yang_sudah_tersimpan_tetap")}
            </p>
            {actionButton("write", true)}
            <Button
              variant="outline"
              className="mt-3 min-h-12 w-full rounded-xl text-14 font-bold"
              onClick={() => setOpen(false)}
            >
              {t("tutup")}
            </Button>
          </div>
        ) : stage === "istirahat" ? (
          <div className="py-2">
            <h3 className="text-title font-bold">{errorMessage("disabled", source).title}</h3>
            <p className="mt-2 text-body text-muted-foreground">
              {errorMessage("disabled", source).body}
            </p>
            {actionButton("write", true)}
            <Button
              variant="outline"
              className="mt-3 min-h-12 w-full rounded-xl text-14 font-bold"
              onClick={() => setOpen(false)}
            >
              {t("tutup")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center px-3 pt-2 pb-4 text-center">
            <span className="flex size-[72px] items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="size-9" strokeWidth={2.2} />
            </span>
            <p className="mt-5 break-words text-body font-bold text-ink-2 [overflow-wrap:anywhere]">
              {title}
            </p>
            {fromLanguage ? (
              <p className="mt-2 text-caption leading-normal text-ink-3">
                {t("diterjemahkan_dari")} {fromLanguage}
                {t("takaran_asingnya_sudah_diubah_ke")}
              </p>
            ) : null}
            {notice ? (
              <p className="mt-3 text-caption leading-normal text-ink-3">{notice}</p>
            ) : null}
            {unmatched.length ? (
              <p className="mt-2 text-caption leading-normal text-ink-3">
                {unmatched.length} {t("bahan_ditulis_apa_adanya_takarannya")}
              </p>
            ) : null}
            <p className="mt-3 rounded-xl bg-notice p-3 text-caption leading-normal text-notice-ink">
              {t("periksa_kembali_bahan_takaran_dan")}
            </p>
            {label ? <p className="mt-3 text-label text-ink-3">{label}</p> : null}
            <Button asChild className="mt-6 min-h-[54px] w-full rounded-xl text-body font-bold">
              <Link to="/buku" search={{ tab: "diambil" }} onClick={() => setOpen(false)}>
                {t("lihat_di_koleksi")}
              </Link>
            </Button>
          </div>
        )}
      </Sheet>
      {banner && !open ? (
        <div
          role="status"
          className="fixed inset-x-4 bottom-[calc(84px+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-[400px] items-center gap-3 rounded-2xl bg-dark px-4 py-3 text-white shadow-toast"
        >
          <Check aria-hidden className="size-5 shrink-0" />
          <p className="min-w-0 flex-1 text-14 leading-snug">
            <span className="font-bold">{t("resep_tersimpan")}</span>
            <span className="block truncate text-white/75">{banner.title}</span>
          </p>
          <Link
            to="/buku"
            search={{ tab: "diambil" }}
            onClick={() => setBanner(null)}
            className="shrink-0 text-14 font-bold text-primary-line"
          >
            {t("lihat_di_koleksi")}
          </Link>
          <button
            type="button"
            aria-label={t("tutup")}
            onClick={() => setBanner(null)}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-white/70"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}
    </>
  );
}

/** How long the import button rests after the service itself failed. */
const OUTAGE_REST_MS = 3 * 60_000;
