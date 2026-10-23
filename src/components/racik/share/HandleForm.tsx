import { useState } from "react";
import { Button } from "@/components/ui/button";
import { HANDLE_RE, saveHandle } from "@/lib/racik/backend/share";

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
          Orang lain hanya melihat nama pengguna ini dan resep yang kamu terbitkan. Nama akunmu
          tetap pribadi.
        </p>
      )}
      <label className="grid gap-1">
        <span className="text-label font-bold text-ink-2">Nama pengguna</span>
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
            placeholder="dapur.sore"
            className="min-w-0 flex-1 bg-transparent py-2 pl-0.5 text-body outline-none"
            aria-invalid={clean.length > 0 && !HANDLE_RE.test(clean)}
          />
        </span>
        <span className="text-caption text-ink-3">
          3–24 huruf kecil, angka, titik, atau garis bawah.
        </span>
      </label>
      <label className="grid gap-1">
        <span className="text-label font-bold text-ink-2">Nama tampilan (boleh kosong)</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="Kosongkan kalau cukup nama pengguna"
          className="min-h-12 rounded-xl border border-rule bg-card px-3 text-body outline-none focus:border-primary"
        />
      </label>
      {error ? (
        <p role="alert" className="text-14 text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={busy || !HANDLE_RE.test(clean)} className="min-h-11">
        {busy ? "Menyimpan…" : "Simpan nama pengguna"}
      </Button>
    </form>
  );
}
