# Racik — penerapan panduan desain dan copy

## Tujuan
Menyelaraskan semua layar Racik dengan referensi visual: hijau, Plus Jakarta Sans, tampilan mobile portrait, tiga tab utama, serta bahasa Indonesia yang netral untuk semua gender.

## Yang akan dibangun
1. **Fondasi visual**
   - Ganti palet magenta/serif menjadi token hijau, latar putih hangat, permukaan abu terang, garis tipis, dan Plus Jakarta Sans.
   - Pertahankan keterbacaan wajib: isi dan deskripsi minimal 16px; bahan dan langkah tetap 18px; metadata minimal 12px.
   - Gunakan sudut dan tata letak sesuai lima referensi, tanpa bayangan dekoratif.

2. **Navigasi dan Beranda “Masak Apa”**
   - Tambah bilah tiga tab: Masak Apa, Cari Resep, Buku Resep.
   - Terapkan sapaan waktu tanpa perbedaan server/perangkat, pemilih porsi, kolom cari, kategori, filter, urutan saran, keadaan kosong, dan tombol Ganti.
   - Pertahankan mesin pencarian dan aturan saran yang sudah diuji.

3. **Cari Resep**
   - Buat layar rak Cepat & Gampang, Bahan Utama, Cara Masak, Protein Tinggi, dan Daerah.
   - Setiap pilihan membuka hasil nyata dari 15 resep contoh; jumlah yang ditampilkan berasal dari data, bukan angka rekaan.
   - Tambah pemilih bahan dari dapur dan tautan ke resep tersimpan.

4. **Buku Resep dan rencana belanja**
   - Buat tab Diambil, Disimpan, dan Rencana dengan batas tiga resep.
   - Gabungkan bahan berdasarkan bahan+satuan, kelompokkan per lorong, sediakan centang, pengatur porsi, Kirim ke WhatsApp, dan Kosongkan rencana.
   - Tampilkan kartu impor video sebagai **demo**, termasuk alur validasi, pemrosesan bertahap, kredit pembuat, dan cabang resep yang sudah ada; tidak mengaku benar-benar mengimpor.

5. **Onboarding dan pengaturan**
   - Buat onboarding empat layar bergambar serta pengaturan porsi, satuan, ukuran teks, penyaring halal, Tentang Racik, dan hapus data.
   - Susunan onboarding mengikuti kekuatan produk yang benar-benar tersedia: skala porsi, takaran rumah, perkiraan protein, lalu demo impor.

6. **Penyelarasan layar resep**
   - Terapkan token visual dan tipografi baru pada detail resep, mode masak, layar selesai, sheet, kartu, dan semua tombol.
   - Pertahankan aturan produk: halal tanpa centang, pedas tanpa ikon cabai, protein selalu “perkiraan”, serta takaran dan langkah 18px.

## Penyesuaian copy yang diperlukan
- “Ribuan resep teruji” diganti menjadi “15 resep contoh” pada versi ini; data aplikasi belum mendukung klaim ribuan atau 199 resep.
- Klaim gizi diubah menjadi **perkiraan protein per porsi**, karena mesin belum menghitung gizi lengkap.
- Impor video selalu ditandai demo karena belum ada layanan impor nyata.
- Emoji dekoratif tidak dipakai untuk tingkat pedas atau status; emoji kategori diperlakukan sebagai lambang bahan/jenis masakan.
- Semua sapaan netral; kata “Ibu” tidak digunakan.

## Verifikasi
- Jalankan tes mesin yang ada.
- Periksa semua rute pada lebar 393px dan 430px, termasuk onboarding, tiga tab, detail, mode masak, selesai, pengaturan, rencana, dan demo impor.
- Pastikan navigasi, penyaringan, simpan, rencana, daftar belanja, WhatsApp, dan perubahan porsi berfungsi.
- Periksa tidak ada teks terpotong, tumpang tindih, kesalahan konsol, atau kegagalan build.
