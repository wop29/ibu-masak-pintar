# Perbaikan indikator, skala, ikon, onboarding, dan preview resep

## Perubahan
- Hapus semua indikator tingkat pedas yang terlihat: chip di detail, metadata kartu, dan filter "Tidak pedas". Kolom `spice` tetap di data dan mesin internal.
- Pertahankan kurva bumbu yang benar, lalu tambahkan regresi khusus Ayam Betutu: 5 sdm minyak goreng pada 6 porsi menjadi 4 sdm pada 4 porsi. Pastikan pembulatan satuan non-countable tetap ke setengah terdekat.
- Ubah skema ikon bahan dari `emoji` ke `em` secara konsisten pada tipe, pembaca UI, normalisasi impor, dan seluruh 172 record saat ini; periksa keenam record yang disebut secara khusus.
- Kunci empat eyebrow dan title onboarding tepat seperti yang diberikan, tanpa mengubah body atau copy lain.
- Kembalikan SSR per URL resep agar crawler WhatsApp menerima title, og:title, og:description, dan og:image resep. Ubah worker menjadi NetworkFirst untuk navigasi dengan timeout 3 detik dan fallback ke shell yang diprecache.

## Verifikasi
- Tes unit untuk angka mentah, faktor skala, dan hasil pembulatan Ayam Betutu 6→4 porsi.
- Tes katalog memastikan semua bahan memakai `em`, tidak ada `emoji`, dan enam record terkait valid.
- Pemeriksaan source untuk memastikan tidak ada indikator pedas yang masih dirender.
- Build dan seluruh tes lulus.
- Uji preview HTML resep secara langsung untuk metadata per resep.
- Uji offline penuh dengan resep belum pernah dibuka, gambar gagal, stepper porsi, bahan/langkah, dan mode masak; pastikan shell fallback tetap bekerja tanpa ikon gambar rusak atau layout bergeser.
