import { useState } from "react";
import { Button } from "@/components/ui/button";
import { HANDLE_RE, saveHandle } from "@/lib/racik/backend/share";
import { t } from "@/lib/racik/i18n";

/**
 * Choosing a public handle is the opt-in to having a public profile. The
 * private account name never appears to anyone else; a display name is
 * optional and shown only if she types one here.
 */
export function HandleForm({
  initialHandle,
  initialName,
  onSaved,
  compact = false,
}: {
  initialHandle: string | null;
  initialName: string | null;
  onSaved: (handle: string, publicName: string | null) => void;
  compact?: boolean;
}) {
  const [handle, setHandle] = useState(initialHandle ?? "");
  const [name, setName] = useState(initialName ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const clean = handle.trim().replace(/^@/, "").toLowerCase();

  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const err = await saveHandle(clean, name);
        setBusy(false);
        if (err) setError(err);
        else onSaved(clean, name.trim() || null);
      }}
    >
      {compact ? null : (
        <p className="text-14 text-ink-2">
          
          {t("orang_lain_hanya_melihat_nama")}
        </p>
      )}
      <label className="grid gap-1">
        <span className="text-label font-bold text-ink-2">{t("nama_pengguna")}</span>
        <span className="flex min-h-12 items-center rounded-xl border border-rule bg-card px-3 focus-within:border-primary">
          <span aria-hidden className="text-ink-3">
            @
          </span>
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value.replace(/\s/g, "").toLowerCase())}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={25}
            placeholder={t("dapur_sore")}
            className="min-w-0 flex-1 bg-transparent py-2 pl-0.5 text-body outline-none"
            aria-invalid={clean.length > 0 && !HANDLE_RE.test(clean)}
          />
        </span>
        <span className="text-caption text-ink-3">
          
          {t("n3_24_huruf_kecil_angka")}
        </span>
      </label>
      <label className="grid gap-1">
        <span className="text-label font-bold text-ink-2">{t("nama_tampilan_boleh_kosong")}</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder={t("kosongkan_kalau_cukup_nama_pengguna")}
          className="min-h-12 rounded-xl border border-rule bg-card px-3 text-body outline-none focus:border-primary"
        />
      </label>
      {error ? (
        <p role="alert" className="text-14 text-danger-ink">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={busy || !HANDLE_RE.test(clean)} className="min-h-11">
        {busy ? t("menyimpan") : t("simpan_nama_pengguna")}
      </Button>
    </form>
  );
}
