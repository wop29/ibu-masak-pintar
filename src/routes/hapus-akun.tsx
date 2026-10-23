import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmSheet } from "@/components/racik/account/AccountSheets";
import { useAccount } from "@/lib/racik/backend/useAccount";
import { useRacik } from "@/lib/racik/state";

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
          <Link to="/pengaturan" aria-label="Kembali"><ArrowLeft /></Link>
        </Button>
        <div>
          <h1 className="text-title font-bold">Hapus akun</h1>
        </div>
      </header>

      {done ? (
        <section className="rounded-2xl bg-tint p-5" role="status">
          <h2 className="text-head font-bold">Akunmu sudah dihapus</h2>
          <p className="mt-2 read-line text-ink-2">Semua data akunmu sudah kami hapus. Resep bawaan Racik tetap bisa kamu pakai tanpa akun.</p>
          <Button className="mt-4 w-full" onClick={() => navigate({ to: "/" })}>Ke beranda</Button>
        </section>
      ) : (
        <>
          <p className="read-line text-ink-2">
            Kamu bisa menghapus akun Racik kapan saja, gratis, langsung dari aplikasi atau dari halaman ini.
          </p>

          <h2 className="mt-6 text-body font-bold">Caranya</h2>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5 read-line text-ink-2">
            <li>Buka Racik, lalu <b>Koleksi › Pengaturan › Akun &amp; data › Hapus akun</b> — atau buka halaman ini: <b>racik.online/hapus-akun</b>.</li>
            <li>Masuk dengan email atau akun Google yang sama dengan yang kamu pakai di Racik.</li>
            <li>Ketuk <b>Hapus akunku</b>, lalu konfirmasi.</li>
          </ol>

          <h2 className="mt-6 text-body font-bold">Yang dihapus</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 read-line text-ink-2">
            <li>Akun dan alamat email atau login Google-mu.</li>
            <li>Profil: nama dan foto profil.</li>
            <li>Koleksimu: resep yang disimpan, resep dari luar, rencana belanja, catatan masak, dan penilaian.</li>
            <li>Resep yang kamu tulis, beserta fotonya.</li>
            <li>Laporan dan blokir yang kamu buat.</li>
            <li>Data Racik di HP yang kamu pakai untuk menghapus.</li>
          </ul>
          <p className="mt-3 read-line text-ink-2">
            Penghapusan langsung berlaku dan tidak bisa dibatalkan. Kalau mau menyimpan salinannya dulu, pakai <b>Unduh dataku</b> di Pengaturan.
          </p>
          <p className="mt-3 text-14 leading-relaxed text-ink-3">
            Racik di HP lain yang masih terbuka tetap menyimpan salinan di HP itu sampai kamu menghapus datanya di sana (Pengaturan › Hapus semua data di HP ini).
            Butuh bantuan? Lihat kontak di <a href="/privasi" className="font-semibold text-primary underline">Kebijakan Privasi</a>.
          </p>

          <div className="mt-8">
            {!available ? (
              <p className="rounded-2xl border border-rule bg-notice p-4 read-line">Racik belum tersambung ke server, jadi akun belum bisa dihapus dari sini.</p>
            ) : !ready ? null : account ? (
              <>
                <Button size="lg" variant="destructive" className="w-full" onClick={() => { setError(""); setOpen(true); }}>
                  Hapus akunku
                </Button>
                {error ? <p className="mt-3 text-14 text-danger-ink" role="alert">{error}</p> : null}
              </>
            ) : (
              <Button asChild size="lg" className="w-full">
                <Link to="/masuk" search={{ next: "/hapus-akun" }}>Masuk untuk menghapus akun</Link>
              </Button>
            )}
          </div>
        </>
      )}

      <ConfirmSheet
        open={open}
        title="Hapus akunmu untuk selamanya?"
        confirmLabel="Ya, hapus akunku"
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
        <p>Akun, profil, koleksi resep, resep yang kamu tulis, dan foto-fotomu akan dihapus dari server Racik dan dari HP ini.</p>
        <p className="mt-2 font-semibold text-ink">Ini tidak bisa dibatalkan.</p>
      </ConfirmSheet>
    </main>
  );
}
