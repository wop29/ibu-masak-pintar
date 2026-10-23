import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, Mail, Section } from "@/components/racik/LegalPage";
import { LEGAL } from "@/lib/racik/legal";

export const Route = createFileRoute("/privasi")({
  head: () => ({
    meta: [
      { title: "Kebijakan Privasi — Racik" },
      { name: "description", content: "Data apa yang dipakai Racik, untuk apa, disimpan di mana, dan cara meminta salinan atau penghapusannya." },
      { property: "og:title", content: "Kebijakan Privasi — Racik" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Privasi,
});

function Privasi() {
  return (
    <LegalPage
      kicker="Kebijakan privasi"
      title="Data kamu di Racik"
      intro={
        <p>
          Racik bisa dipakai tanpa akun. Selama kamu tidak masuk, resep, favorit, daftar Belanja, dan foto masakanmu hanya tersimpan di HP ini. Halaman ini menjelaskan
          apa yang berubah saat kamu memakai akun atau fitur Tambah Resep, sesuai UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP).
        </p>
      }
    >
      <Section title="Siapa yang mengelola data">
        <p>
          Racik ({LEGAL.SITE}) dikelola oleh <b>{LEGAL.OPERATOR_NAME}</b>, yang bertindak sebagai pengendali data pribadi. Pertanyaan dan permintaan soal datamu:
          <> </>
          <Mail />.
        </p>
      </Section>

      <Section title="Data yang kami pakai">
        <p>
          <b>Tanpa akun</b> — disimpan di HP ini saja:
        </p>
        <ul>
          <li>pengaturan (porsi, satuan, ukuran tulisan), jawaban perkenalan, favorit, daftar Belanja, catatan masak, dan foto masakan yang kamu ambil;</li>
          <li>resep yang kamu tambahkan dari luar;</li>
          <li>
            negara untuk takaran (Indonesia, Malaysia, atau Filipina). Racik menebaknya dari negara koneksi internetmu yang dikirim Cloudflare, zona waktu, dan bahasa HP —
            bukan GPS, tanpa izin lokasi — hanya untuk memilih nama takaran, nama bahan setempat, dan pembulatan daftar belanja. Bisa diubah di Pengaturan.
          </li>
        </ul>
        <p>
          <b>Dengan akun</b>:
        </p>
        <ul>
          <li>alamat email (untuk masuk), nama dan foto profil kalau kamu mengisinya, serta nama pengguna publik kalau kamu memilih membuatnya;</li>
          <li>koleksimu (favorit, resep dari luar, daftar Belanja, catatan masak), supaya bisa dibuka lagi di HP lain;</li>
          <li>resep yang kamu tulis dan foto yang kamu unggah untuknya, beserta jumlah orang yang membuka atau memasaknya.</li>
        </ul>
        <p>
          <b>Saat memakai Tambah Resep</b> (dengan atau tanpa akun):
        </p>
        <ul>
          <li>tautan, teks, foto, atau video yang kamu kirim, untuk disusun menjadi resep;</li>
          <li>
            catatan pemakaian: kapan, dari sumber apa (tautan/teks/foto), berhasil atau tidak, dan biayanya — dikaitkan dengan akunmu, atau dengan kode acak perangkat kalau kamu
            tidak masuk;
          </li>
          <li>sidik acak (hash) dari alamat IP untuk mencegah penyalahgunaan. Alamat IP-nya sendiri tidak disimpan;</li>
          <li>nama bahan yang belum dikenali Racik, tanpa keterangan siapa yang mengirimnya.</li>
        </ul>
        <p>Racik tidak memakai iklan, tidak menjual data, dan tidak memasang pelacak pihak ketiga.</p>
      </Section>

      <Section title="Untuk apa">
        <ul>
          <li>menjalankan fitur yang kamu minta: menyusun resep, menyimpan dan menyinkronkan koleksi, menampilkan resep yang kamu bagikan;</li>
          <li>menjaga layanan: membatasi pemakaian supaya tidak disalahgunakan dan menghitung biaya;</li>
          <li>memperbaiki daftar bahan Racik.</li>
        </ul>
        <p>Dasarnya adalah persetujuanmu saat memakai fitur itu dan pelaksanaan layanan yang kamu minta.</p>
      </Section>

      <Section title="Pihak lain yang ikut memproses">
        <ul>
          <li>
            <b>Google Gemini</b> (Google LLC) — isi yang kamu kirim lewat Tambah Resep dikirim ke Gemini untuk dibaca dan disusun. Diproses di luar Indonesia. Jangan kirim foto
            yang memuat wajah atau data pribadi orang lain.
          </li>
          <li>
            <b>Supabase</b> — tempat menyimpan akun, koleksi yang disinkronkan, resep yang kamu tulis, dan catatan pemakaian. Server di {LEGAL.SUPABASE_REGION}, di luar Indonesia.
          </li>
          <li>
            <b>Cloudflare</b> — menjalankan situs dan aplikasi Racik; alamat IP dan permintaanmu melewati jaringannya.
          </li>
          <li>
            <b>Google Fonts</b> — huruf di aplikasi dimuat dari Google, sehingga Google menerima alamat IP saat huruf diunduh.
          </li>
          <li>
            <b>TikTok, Instagram, YouTube</b>, atau situs lain — saat kamu menempel tautan, Racik mengambil keterangan video dari situs tersebut.
          </li>
        </ul>
        <p>Pengiriman data ke luar Indonesia hanya untuk menjalankan fitur di atas, ke penyedia yang menerapkan perlindungan data yang setara.</p>
      </Section>

      <Section title="Berapa lama disimpan">
        <ul>
          <li>data di HP: sampai kamu menghapusnya (Pengaturan › Hapus semua data) atau menghapus aplikasi;</li>
          <li>akun, koleksi, dan resep yang kamu tulis: selama akunmu ada. Saat akun dihapus, semuanya ikut dihapus;</li>
          <li>hasil resep dari Tambah Resep di server: paling lama 2 hari; hash alamat IP: 7 hari;</li>
          <li>catatan pemakaian tanpa isi resep: selama dibutuhkan untuk penagihan dan pencegahan penyalahgunaan, lalu dihapus bersama akun.</li>
        </ul>
      </Section>

      <Section title="Hak kamu">
        <p>Sesuai UU PDP, kamu berhak:</p>
        <ul>
          <li>
            <b>melihat dan meminta salinan</b> data akunmu — kirim email ke <Mail />, kami tanggapi paling lambat 3 × 24 jam sejak permintaan diterima;
          </li>
          <li>
            <b>membetulkan</b> data — nama dan foto bisa diubah sendiri di aplikasi, selebihnya lewat email;
          </li>
          <li>
            <b>menghapus akun dan semua datanya</b> — di aplikasi (Pengaturan) atau lewat halaman{" "}
            <a href="/hapus-akun" className="font-semibold text-primary underline underline-offset-2">
              {LEGAL.SITE}/hapus-akun
            </a>
            ;
          </li>
          <li>
            <b>menarik persetujuan</b> — berhenti memakai fitur yang bersangkutan atau menghapus akun;
          </li>
          <li>mengajukan keberatan atau pengaduan ke kami, dan ke lembaga pelindungan data pribadi yang berwenang.</li>
        </ul>
      </Section>

      <Section title="Anak-anak">
        <p>
          Racik ditujukan untuk orang dewasa yang memasak. Akun dan Tambah Resep tidak untuk anak di bawah 18 tahun tanpa izin orang tua atau wali. Kalau kamu tahu ada anak yang
          membuat akun, kabari kami di <Mail /> dan datanya akan kami hapus.
        </p>
      </Section>

      <Section title="Keamanan">
        <p>
          Data dikirim lewat koneksi terenkripsi (HTTPS). Akses ke data akun dibatasi sehingga hanya kamu yang bisa membaca koleksimu. Kalau terjadi kebocoran data, kami akan
          memberi tahu kamu dan pihak berwenang sesuai UU PDP.
        </p>
      </Section>

      <Section title="Perubahan">
        <p>
          Kalau kebijakan ini berubah, tanggal di atas ikut berubah. Perubahan penting akan kami sampaikan di aplikasi sebelum berlaku.
        </p>
      </Section>

      <Section title="Kontak">
        <p>
          {LEGAL.OPERATOR_NAME} · <Mail />
        </p>
        <p>
          Lihat juga{" "}
          <Link to="/syarat" className="font-semibold text-primary underline underline-offset-2">
            Syarat Penggunaan
          </Link>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
