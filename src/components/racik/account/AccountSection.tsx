import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useRacik } from "@/lib/racik/state";
import { useAccount } from "@/lib/racik/backend/useAccount";
import { libraryRecipeCount } from "@/lib/racik/store";
import { ConfirmSheet } from "./AccountSheets";

/**
 * Pengaturan › Akun & data: sign in/out, "Unduh dataku", "Hapus akun" and
 * "Hapus semua data". Every destructive action has a confirm sheet that says
 * plainly what happens on this phone and what happens to the account.
 */
export function AccountSection() {
  const { account, available, refresh } = useAccount();
  const { state, syncStatus, signOutAndClear, eraseDevice, exportData } = useRacik();
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<null | "signout" | "signout-unsynced" | "erase">(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const count = libraryRecipeCount(state);

  const syncLine = !account
    ? count > 0
      ? `${count} resep tersimpan di HP ini saja. Masuk supaya tidak hilang kalau ganti HP.`
      : "Masuk gratis supaya resep yang kamu simpan tidak hilang kalau ganti HP."
    : syncStatus === "syncing"
      ? "Menyimpan ke akun…"
      : syncStatus === "off"
        ? "Resep di HP ini belum digabung ke akunmu. Buka lagi Racik untuk memilih."
      : syncStatus === "error"
        ? "Belum tersambung. Perubahan disimpan di HP dulu dan dikirim ke akun saat ada internet."
        : "Resep, rencana belanja, dan catatan masakmu tersimpan di akun.";

  const doSignOut = async (force: boolean) => {
    setBusy(true);
    const res = await signOutAndClear({ force });
    setBusy(false);
    if (res === "unsynced") return setSheet("signout-unsynced");
    setSheet(null);
    refresh();
    setNote("Kamu sudah keluar. Resepmu tetap aman di akun.");
  };

  return (
    <section className="border-b border-border py-5" aria-labelledby="akun-data">
      <h2 id="akun-data" className="text-body font-bold">Akun &amp; data</h2>
      {available ? (
        <div className="mt-3 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-14 font-semibold">{account ? (account.name ? `Masuk sebagai ${account.name}` : "Kamu sudah masuk") : "Belum masuk"}</p>
            <p className="mt-1 text-14 text-muted-foreground" role="status">{syncLine}</p>
          </div>
          {account ? (
            <Button size="sm" variant="outline" onClick={() => setSheet("signout")}>Keluar</Button>
          ) : (
            <Button asChild size="sm">
              <Link to="/masuk" search={{ next: "/pengaturan" }}>Masuk</Link>
            </Button>
          )}
        </div>
      ) : null}
      {note ? <p className="mt-3 rounded-xl bg-tint p-3 text-14 text-ink-2" role="status">{note}</p> : null}

      <div className="mt-4 flex flex-col gap-2">
        <Button variant="outline" className="w-full" onClick={() => void exportData()}>
          Unduh dataku
        </Button>
        <p className="text-label text-ink-3">Salinan semua data Racik milikmu dalam satu berkas (JSON).</p>
        {account ? (
          <Button asChild variant="outline" className="mt-2 w-full text-destructive">
            <Link to="/hapus-akun">Hapus akun</Link>
          </Button>
        ) : null}
        <Button variant="outline" className="mt-2 w-full text-destructive" onClick={() => setSheet("erase")}>
          Hapus semua data di HP ini
        </Button>
      </div>

      <ConfirmSheet
        open={sheet === "signout"}
        title="Keluar dari akun?"
        confirmLabel="Keluar"
        destructive={false}
        busy={busy}
        onCancel={() => setSheet(null)}
        onConfirm={() => void doSignOut(false)}
      >
        <p>Resep, rencana belanja, dan catatan masakmu akan dihapus dari HP ini, tapi tetap aman di akunmu. Masuk lagi kapan saja untuk mengambilnya.</p>
        <p className="mt-2">Ukuran tulisan, satuan, dan jumlah porsi tetap seperti sekarang.</p>
      </ConfirmSheet>

      <ConfirmSheet
        open={sheet === "signout-unsynced"}
        title="Ada perubahan yang belum tersimpan"
        confirmLabel="Keluar saja"
        busy={busy}
        onCancel={() => setSheet(null)}
        onConfirm={() => void doSignOut(true)}
      >
        <p>Perubahan terakhir di HP ini belum sempat dikirim ke akunmu (sepertinya tidak ada internet). Kalau keluar sekarang, perubahan itu hilang.</p>
        <p className="mt-2">Sambungkan internet lalu coba lagi, atau keluar saja.</p>
      </ConfirmSheet>

      <ConfirmSheet
        open={sheet === "erase"}
        title="Hapus semua data di HP ini?"
        confirmLabel="Hapus dari HP ini"
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
            <Button asChild variant="ghost" size="lg" className="mt-2 w-full text-destructive">
              <Link to="/hapus-akun">Hapus akun juga</Link>
            </Button>
          ) : null
        }
      >
        {account ? (
          <>
            <p>Semua data Racik di HP ini dihapus dan kamu keluar dari akun di HP ini. Pengaturan kembali ke awal.</p>
            <p className="mt-2 font-semibold text-ink">Akunmu tidak terhapus: resepmu tetap aman di akun dan kembali saat kamu masuk lagi.</p>
            <p className="mt-2">Mau menghapus akun dan semua isinya? Pilih “Hapus akun juga”.</p>
          </>
        ) : (
          <>
            <p>
              Koleksimu{count > 0 ? ` (${count} resep)` : ""}, resep dari luar, rencana belanja, catatan masak, foto, dan pengaturan akan hilang dari HP ini.
            </p>
            <p className="mt-2 font-semibold text-ink">Ini tidak bisa dibatalkan.</p>
          </>
        )}
      </ConfirmSheet>
    </section>
  );
}
