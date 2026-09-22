# Racik — roadmap

Data contoh (15 resep, ~60 bahan, 7 daerah) sudah masuk. Ganti dengan ekspor
199 resep nanti: cukup tukar file JSON di `src/data/`.

## Milestone 1 — mesin masak, halaman resep, mode masak (selesai)

- [x] Data contoh: bahan, daerah, tabel (TAKAR/BERAT/PROT100/SUBS), 15 resep
- [x] Mesin sebagai fungsi murni + 35 tes (skala porsi, pembulatan, takaran
      rumah, protein, halal, pencarian, langkah → bahan)
- [x] Token desain: hijau #1A6B3C, ground #FAFAF8, skala 12 langkah,
      baris bahan & langkah 18px, tidak ada yang di bawah 11px
- [x] Huruf: Plus Jakarta Sans
- [x] Penyimpanan di perangkat (IndexedDB, cadangan localStorage, foto dibuang
      lebih dulu kalau penuh, foto dikecilkan ke 640px)
- [x] Halaman resep: foto, keterangan jujur, protein perkiraan, keterangan
      halal dengan ⓘ, pengatur porsi yang mengubah takaran langsung
- [x] Mode masak: layar gelap, satu langkah, "Siapkan dulu", penghitung waktu
- [x] Layar selesai: foto hasil, tiga pilihan tingkat kesulitan, kesimpulan
      setelah tiga catatan
- [x] Daftar resep + pencarian + saringan kategori (sementara)
- [x] Foto asli untuk 6 resep

## Milestone 2 — tiga tab (selesai)

- [x] MASAK APA: sapaan sesuai waktu, kartu urutan (recency 55 / waktu 28 /
      slot 17 + jitter), pemilih bahan
- [x] CARI RESEP: rak cepat & gampang, bahan utama, cara masak, protein tinggi,
      daerah
- [x] BUKU RESEP: resep tersimpan, Rencana (maks 3 resep), daftar belanja per
      lorong, Kirim ke WhatsApp
- [x] Bilah tab putih, ikon garis tipis
- [x] Pengaturan: porsi, satuan takaran, ukuran huruf, sembunyikan resep tidak
      halal, Tentang Racik, Hapus semua data

## Milestone 3 — onboarding, PWA, impor (demo selesai)

- [x] Empat slide, urutan: skala porsi (angka rendang) → takaran rumah →
      perkiraan protein → impor
- [x] Kulit PWA: manifest, service worker, portrait saja
- [x] Alur impor sebagai peragaan yang jujur disebut peragaan

## Menunggu di luar kendali

- Impor asli dari TikTok/Instagram perlu server (unduh video, salin suara,
  baca tulisan di layar, cocokkan ke daftar bahan). Belum bisa dikerjakan di
  sini.

## Aturan tulisan

- Tidak pernah menyapa pembaca dengan "Ibu". Netral untuk semua orang, hindari
  kata ganti kalau bisa.
- Tanpa tanda seru, tanpa emoji di teks sistem (emoji hanya lambang bahan).
- Pedas ditulis dengan kata, bukan ikon cabai. Halal tidak pernah tanda centang.
  Protein selalu disebut perkiraan.
