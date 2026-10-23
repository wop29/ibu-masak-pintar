import { createFileRoute, Link } from "@tanstack/react-router";
import { LEGAL } from "@/lib/racik/legal";
import { LegalPage, Mail, Section } from "@/components/racik/LegalPage";

export const Route = createFileRoute("/syarat")({
  head: () => ({
    meta: [
      { title: "Syarat Penggunaan — Racik" },
      { name: "description", content: "Aturan singkat memakai Racik: resep, takaran, label halal, Tambah Resep, dan resep yang kamu tulis." },
      { property: "og:title", content: "Syarat Penggunaan — Racik" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Syarat,
});

function Syarat() {
  return (
    <LegalPage
      eyebrow="SYARAT PENGGUNAAN"
      title="Aturan singkat memakai Racik"
      intro={<p>Dengan memakai Racik, kamu setuju dengan aturan di bawah ini. Bahasanya sengaja dibuat singkat.</p>}
    >
      <Section title="Resep dan takaran">
        <p>
          Takaran, perkiraan gizi, dan waktu masak adalah perkiraan untuk memasak di rumah, bukan nasihat medis atau diet. Perhatikan alergi dan kondisi kesehatanmu sendiri.
        </p>
      </Section>
      <Section title="Label halal">
        <p>
          Racik bukan lembaga sertifikasi halal dan tidak memberi sertifikat apa pun. Label “perlu cek bahan” dan “cek sembelihan” hanya membaca daftar bahan resep. Merek bahan,
          cara penyembelihan, dan kebersihan dapur tetap tanggung jawab yang memasak.
        </p>
      </Section>
      <Section title="Tambah Resep">
        <ul>
          <li>Kirim hanya tautan, teks, foto, atau video yang boleh kamu pakai, dan jangan kirim data pribadi orang lain.</li>
          <li>
            Resep disusun otomatis oleh AI (Google Gemini) dan bisa keliru. Periksa takaran dan langkahnya sebelum memasak. Hasil yang aneh atau tidak pantas bisa kamu laporkan ke{" "}
            <Mail />.
          </li>
          <li>Resep dari luar tetap milik pembuat aslinya. Racik menyimpannya untuk pemakaian pribadimu dan selalu menautkan sumbernya.</li>
          <li>Pemakaian dibatasi supaya adil untuk semua; batas yang berlaku ditampilkan di aplikasi.</li>
        </ul>
      </Section>
      <Section title="Resep yang kamu tulis">
        <ul>
          <li>Resep dan foto yang kamu tulis tetap milikmu. Dengan membagikannya, kamu mengizinkan Racik menampilkannya kepada orang yang membuka tautanmu.</li>
          <li>Jangan menulis atau mengunggah sesuatu yang melanggar hukum, menyinggung, menipu, atau melanggar hak cipta orang lain.</li>
          <li>Racik boleh menyembunyikan resep yang dilaporkan dan melanggar aturan ini, dan menangguhkan akun yang berulang kali melanggar.</li>
        </ul>
      </Section>
      <Section title="Akun">
        <p>
          Jaga akses ke emailmu, karena itulah kunci akunmu. Kamu bisa berhenti kapan saja dan menghapus akun di Pengaturan atau di{" "}
          <a href="/hapus-akun" className="font-semibold text-primary underline underline-offset-2">
            {LEGAL.SITE}/hapus-akun
          </a>
          .
        </p>
      </Section>
      <Section title="Layanan">
        <p>
          Racik disediakan apa adanya. Kami berusaha agar selalu bisa dipakai, termasuk tanpa sinyal, tetapi fitur bisa berubah atau berhenti. Sejauh diizinkan hukum, Racik tidak
          bertanggung jawab atas kerugian karena memakai resep atau perkiraan di aplikasi. Aturan ini tunduk pada hukum Republik Indonesia.
        </p>
      </Section>
      <Section title="Kontak">
        <p>
          {LEGAL.OPERATOR_NAME} · <Mail />. Cara kami mengelola datamu ada di{" "}
          <Link to="/privasi" className="font-semibold text-primary underline underline-offset-2">
            Kebijakan Privasi
          </Link>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
