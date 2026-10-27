import { BrandIcon } from "../BrandIcon";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/racik/Sheet";
import { t } from "@/lib/racik/i18n";

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
      title={t("simpan_resepmu_ke_akun")}
      subtitle={t("supaya_tidak_hilang_kalau_ganti")}
    >
      <div className="flex gap-3 rounded-2xl bg-tint p-4 text-14 leading-relaxed text-ink-2">
        <BrandIcon name="sinkron" className="size-9" />
        <p>
          {kind === "import" ? t("resep_dari_luar_ini_sudah") : t("resep_ini_sudah_tersimpan_di")}
          
          {t("masuk_gratis_lalu_resep_simpanan")}
        </p>
      </div>
      <Button size="lg" className="mt-5 w-full" onClick={onSignIn}>
        
        {t("masuk_atau_daftar_gratis")}
      </Button>
      <Button variant="ghost" size="lg" className="mt-2 w-full text-muted-foreground" onClick={onLater}>
        
        {t("offer_later")}
      </Button>
      <p className="mt-1 text-center text-label text-ink-3">{t("untuk_sekarang_resepnya_tetap_ada")}</p>
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
    <Sheet open={open} onClose={onLater} title={t("gabungkan_resep_di_hp_ini", { count })}>
      <p className="read-line text-ink-2">
        
        {t("ada")}{" "}{count} {" "}{t("resep_yang_kamu_simpan_di")}
      </p>
      <Button size="lg" className="mt-5 w-full" onClick={onMerge}>
        
        {t("gabungkan_ke_akunku")}
      </Button>
      <Button variant="outline" size="lg" className="mt-2 w-full" onClick={onReplace}>
        
        {t("jangan_pakai_isi_akunku_saja")}
      </Button>
      <p className="mt-2 text-label text-ink-3">
        
        {t("kalau_tidak_digabung_resep_di")}
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
        {busy ? t("sebentar") : confirmLabel}
      </Button>
      {extra}
      <Button variant="ghost" size="lg" className="mt-2 w-full text-muted-foreground" disabled={busy} onClick={onCancel}>
        
        {t("batal")}
      </Button>
    </Sheet>
  );
}
