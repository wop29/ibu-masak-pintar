import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useRacik } from "@/lib/racik/state";
import { useAccount } from "@/lib/racik/backend/useAccount";
import { libraryRecipeCount } from "@/lib/racik/store";
import { ConfirmSheet } from "./AccountSheets";
import { ENGLISH_ENABLED, t } from "@/lib/racik/i18n";
import { LanguageSwitch } from "../LanguageSwitch";

/**
 * Pengaturan › Akun & data: sign in/out, "Unduh dataku", "Hapus akun" and
 * "Hapus semua data". Every destructive action has a confirm sheet that says
 * plainly what happens on this phone and what happens to the account.
 */
/**
 * `withLanguage`: show the interface-language row here too (the account area
 * is where people look for it). Pengaturan has its own row, so it leaves this off.
 */
export function AccountSection({ withLanguage = false }: { withLanguage?: boolean } = {}) {
  const { account, available, refresh } = useAccount();
  const { state, syncStatus, signOutAndClear, eraseDevice, exportData } = useRacik();
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<null | "signout" | "signout-unsynced" | "erase">(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const count = libraryRecipeCount(state);

  const syncLine = !account
    ? count > 0
      ? t("acct_local_count", { count })
      : t("acct_local_none")
    : syncStatus === "syncing"
      ? t("acct_syncing")
      : syncStatus === "off"
        ? t("acct_off")
      : syncStatus === "error"
        ? t("acct_error")
        : t("acct_ok");

  const doSignOut = async (force: boolean) => {
    setBusy(true);
    const res = await signOutAndClear({ force });
    setBusy(false);
    if (res === "unsynced") return setSheet("signout-unsynced");
    setSheet(null);
    refresh();
    setNote(t("acct_signed_out"));
  };

  return (
    <section className="border-b border-border py-5" aria-labelledby="akun-data">
      <h2 id="akun-data" className="text-body font-bold">{t("akun_data")}</h2>
      {withLanguage && ENGLISH_ENABLED ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 flex-1 basis-[8rem] text-14 font-semibold">{t("language")}</p>
          <LanguageSwitch />
        </div>
      ) : null}
      {available ? (
        <div className="mt-3 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-14 font-semibold">{account ? (account.name ? t("signed_in_as", { name: account.name }) : t("kamu_sudah_masuk")) : t("belum_masuk")}</p>
            <p className="mt-1 text-14 text-muted-foreground" role="status">{syncLine}</p>
          </div>
          {account ? (
            <Button size="sm" variant="outline" onClick={() => setSheet("signout")}>{t("sign_out")}</Button>
          ) : (
            <Button asChild size="sm">
              <Link to="/masuk" search={{ next: "/pengaturan" }}>{t("sign_in")}</Link>
            </Button>
          )}
        </div>
      ) : null}
      {note ? <p className="mt-3 rounded-xl bg-tint p-3 text-14 text-ink-2" role="status">{note}</p> : null}

      <div className="mt-4 flex flex-col gap-2">
        <Button variant="outline" className="w-full" onClick={() => void exportData()}>
          
          {t("unduh_dataku")}
        </Button>
        <p className="text-label text-ink-3">{t("salinan_semua_data_racik_milikmu")}</p>
        {account ? (
          <Button asChild variant="outline" className="mt-2 w-full text-danger-ink">
            <Link to="/hapus-akun">{t("hapus_akun")}</Link>
          </Button>
        ) : null}
        <Button variant="outline" className="mt-2 w-full text-danger-ink" onClick={() => setSheet("erase")}>
          
          {t("hapus_semua_data_di_hp")}
        </Button>
      </div>

      <ConfirmSheet
        open={sheet === "signout"}
        title={t("keluar_dari_akun")}
        confirmLabel={t("sign_out")}
        destructive={false}
        busy={busy}
        onCancel={() => setSheet(null)}
        onConfirm={() => void doSignOut(false)}
      >
        <p>{t("resep_rencana_belanja_dan_catatan")}</p>
        <p className="mt-2">{t("ukuran_tulisan_satuan_dan_jumlah")}</p>
      </ConfirmSheet>

      <ConfirmSheet
        open={sheet === "signout-unsynced"}
        title={t("ada_perubahan_yang_belum_tersimpan")}
        confirmLabel={t("keluar_saja")}
        busy={busy}
        onCancel={() => setSheet(null)}
        onConfirm={() => void doSignOut(true)}
      >
        <p>{t("perubahan_terakhir_di_hp_ini")}</p>
        <p className="mt-2">{t("sambungkan_internet_lalu_coba_lagi")}</p>
      </ConfirmSheet>

      <ConfirmSheet
        open={sheet === "erase"}
        title={t("hapus_semua_data_di_hp_2")}
        confirmLabel={t("hapus_dari_hp_ini")}
        busy={busy}
        onCancel={() => setSheet(null)}
        onConfirm={async () => {
          setBusy(true);
          await eraseDevice();
          setBusy(false);
          setSheet(null);
          refresh();
          navigate({ to: "/" });
        }}
        extra={
          account ? (
            <Button asChild variant="ghost" size="lg" className="mt-2 w-full text-danger-ink">
              <Link to="/hapus-akun">{t("hapus_akun_juga")}</Link>
            </Button>
          ) : null
        }
      >
        {account ? (
          <>
            <p>{t("semua_data_racik_di_hp")}</p>
            <p className="mt-2 font-semibold text-ink">{t("akunmu_tidak_terhapus_resepmu_tetap")}</p>
            <p className="mt-2">{t("mau_menghapus_akun_dan_semua")}</p>
          </>
        ) : (
          <>
            <p>
              
              {t("koleksimu")}{count > 0 ? t("resep_4", { count }) : ""}{t("resep_dari_luar_rencana_belanja")}
            </p>
            <p className="mt-2 font-semibold text-ink">{t("ini_tidak_bisa_dibatalkan")}</p>
          </>
        )}
      </ConfirmSheet>
    </section>
  );
}
