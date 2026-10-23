import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmSheet } from "@/components/racik/account/AccountSheets";
import { useAccount } from "@/lib/racik/backend/useAccount";
import { useRacik } from "@/lib/racik/state";
import { t } from "@/lib/racik/i18n";

/**
 * Account deletion — in the app (Pengaturan › Akun & data › Hapus akun) and on
 * the web at racik.online/hapus-akun. This URL is the one to put in Google
 * Play's Data safety form ("Delete account URL"). It explains the steps to
 * anyone, signed in or not, and offers the button once she is signed in.
 */
export const Route = createFileRoute("/hapus-akun")({
  head: () => ({
    meta: [
      { title: "Hapus akun — Racik" },
      { name: "description", content: "Cara menghapus akun Racik dan semua data di dalamnya." },
      { property: "og:title", content: "Hapus akun Racik" },
      { property: "og:description", content: "Cara menghapus akun Racik dan semua data di dalamnya." },
    ],
  }),
  component: HapusAkun,
});

function HapusAkun() {
  const { account, ready, available } = useAccount();
  const { deleteAccount } = useRacik();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[430px] bg-card px-5 pb-12">
      <header className="flex items-center gap-3 py-5">
        <Button asChild variant="ghost" size="icon">
          <Link to="/pengaturan" aria-label={t("back")}><ArrowLeft /></Link>
        </Button>
        <div>
          <h1 className="text-title font-bold">{t("hapus_akun")}</h1>
        </div>
      </header>

      {done ? (
        <section className="rounded-2xl bg-tint p-5" role="status">
          <h2 className="text-head font-bold">{t("akunmu_sudah_dihapus")}</h2>
          <p className="mt-2 read-line text-ink-2">{t("semua_data_akunmu_sudah_kami")}</p>
          <Button className="mt-4 w-full" onClick={() => navigate({ to: "/" })}>{t("ke_beranda")}</Button>
        </section>
      ) : (
        <>
          <p className="read-line text-ink-2">
            
            {t("kamu_bisa_menghapus_akun_racik")}
          </p>

          <h2 className="mt-6 text-body font-bold">{t("caranya")}</h2>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 read-line text-ink-2">
            <li>{t("buka_racik_lalu")}{" "}<b>{t("koleksi_pengaturan_akun_data_hapus")}</b> {" "}{t("atau_buka_halaman_ini")}{" "}<b>{t("racik_online_hapus_akun")}</b>.</li>
            <li>{t("masuk_dengan_email_atau_akun")}</li>
            <li>{t("ketuk")}{" "}<b>{t("hapus_akunku")}</b>{t("lalu_konfirmasi")}</li>
          </ol>

          <h2 className="mt-6 text-body font-bold">{t("yang_dihapus")}</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 read-line text-ink-2">
            <li>{t("akun_dan_alamat_email_atau")}</li>
            <li>{t("profil_nama_dan_foto_profil")}</li>
            <li>{t("koleksimu_resep_yang_disimpan_resep")}</li>
            <li>{t("resep_yang_kamu_tulis_beserta")}</li>
            <li>{t("laporan_dan_blokir_yang_kamu")}</li>
            <li>{t("data_racik_di_hp_yang")}</li>
          </ul>
          <p className="mt-3 read-line text-ink-2">
            
            {t("penghapusan_langsung_berlaku_dan_tidak")}{" "}<b>{t("unduh_dataku")}</b> {" "}{t("di_pengaturan")}
          </p>
          <p className="mt-3 text-14 leading-relaxed text-ink-3">
            
            {t("racik_di_hp_lain_yang")}{" "}<a href="/privasi" className="font-semibold text-primary underline">{t("kebijakan_privasi")}</a>.
          </p>

          <div className="mt-8">
            {!available ? (
              <p className="rounded-2xl border border-rule bg-notice p-4 read-line">{t("racik_belum_tersambung_ke_server")}</p>
            ) : !ready ? null : account ? (
              <>
                <Button size="lg" variant="destructive" className="w-full" onClick={() => { setError(""); setOpen(true); }}>
                  
                  {t("hapus_akunku")}
                </Button>
                {error ? <p className="mt-3 text-14 text-danger-ink" role="alert">{error}</p> : null}
              </>
            ) : (
              <Button asChild size="lg" className="w-full">
                <Link to="/masuk" search={{ next: "/hapus-akun" }}>{t("masuk_untuk_menghapus_akun")}</Link>
              </Button>
            )}
          </div>
        </>
      )}

      <ConfirmSheet
        open={open}
        title={t("hapus_akunmu_untuk_selamanya")}
        confirmLabel={t("ya_hapus_akunku")}
        busy={busy}
        onCancel={() => setOpen(false)}
        onConfirm={async () => {
          setBusy(true);
          const err = await deleteAccount();
          setBusy(false);
          setOpen(false);
          if (err) return setError(err);
          setDone(true);
        }}
      >
        <p>{t("akun_profil_koleksi_resep_resep")}</p>
        <p className="mt-2 font-semibold text-ink">{t("ini_tidak_bisa_dibatalkan")}</p>
      </ConfirmSheet>
    </main>
  );
}
