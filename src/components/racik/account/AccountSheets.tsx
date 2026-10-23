import { Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/racik/Sheet";

/**
 * The gentle "keep it in your account" sheet, shown when she saves a recipe
 * or an import finishes while signed out. Never a wall: "Nanti saja" keeps
 * the recipe on this phone, and the app asks again only now and then.
 *
 * Rendered once by RacikProvider; screens trigger it with
 * useRacik().promptSaveSignIn(kind), or get it for free — the provider opens
 * it by itself when a save or import lands while signed out.
 */
export function SaveSignInSheet({
  open,
  kind,
  onSignIn,
  onLater,
}: {
  open: boolean;
  kind: "save" | "import";
  onSignIn: () => void;
  onLater: () => void;
}) {
  return (
    <Sheet
      open={open}
      onClose={onLater}
      title="Simpan resepmu ke akun"
      subtitle="Supaya tidak hilang kalau ganti HP."
    >
      <div className="flex gap-3 rounded-2xl bg-tint p-4 text-14 leading-relaxed text-ink-2">
        <Cloud aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
        <p>
          {kind === "import" ? "Resep dari luar ini sudah ada di HP-mu. " : "Resep ini sudah tersimpan di HP-mu. "}
          Masuk gratis, lalu resep simpanan, resep dari luar, dan rencana belanjamu ikut tersimpan di akun — aman walau HP hilang atau ganti.
        </p>
      </div>
      <Button size="lg" className="mt-5 w-full" onClick={onSignIn}>
        Masuk atau daftar gratis
      </Button>
      <Button variant="ghost" size="lg" className="mt-2 w-full text-muted-foreground" onClick={onLater}>
        Nanti saja
      </Button>
      <p className="mt-1 text-center text-label text-ink-3">Untuk sekarang resepnya tetap ada di HP ini.</p>
    </Sheet>
  );
}

/** Asked once, right after sign-in, when the phone holds recipes saved while signed out. */
export function MergeLibrarySheet({
  open,
  count,
  onMerge,
  onReplace,
  onLater,
}: {
  open: boolean;
  count: number;
  onMerge: () => void;
  onReplace: () => void;
  onLater: () => void;
}) {
  return (
    <Sheet open={open} onClose={onLater} title={`Gabungkan ${count} resep di HP ini ke akunmu?`}>
      <p className="read-line text-ink-2">
        Ada {count} resep yang kamu simpan di HP ini sebelum masuk. Gabungkan supaya ikut tersimpan di akunmu dan muncul di HP lain.
      </p>
      <Button size="lg" className="mt-5 w-full" onClick={onMerge}>
        Gabungkan ke akunku
      </Button>
      <Button variant="outline" size="lg" className="mt-2 w-full" onClick={onReplace}>
        Jangan, pakai isi akunku saja
      </Button>
      <p className="mt-2 text-label text-ink-3">
        Kalau tidak digabung, resep di HP ini dihapus dari HP ini dan diganti isi akunmu.
      </p>
    </Sheet>
  );
}

/** A plain yes/no sheet for anything that cannot be undone. */
export function ConfirmSheet({
  open,
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
  busy = false,
  destructive = true,
  extra,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  destructive?: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <Sheet open={open} onClose={busy ? () => {} : onCancel} title={title}>
      <div className="read-line text-ink-2">{children}</div>
      <Button
        size="lg"
        variant={destructive ? "destructive" : "default"}
        className="mt-5 w-full"
        disabled={busy}
        onClick={onConfirm}
      >
        {busy ? "Sebentar…" : confirmLabel}
      </Button>
      {extra}
      <Button variant="ghost" size="lg" className="mt-2 w-full text-muted-foreground" disabled={busy} onClick={onCancel}>
        Batal
      </Button>
    </Sheet>
  );
}
