# Lengkapi unggahan proyek dan referensi gambar AI

## Hasil yang akan dibuat
- Unggahan menerima ZIP, banyak file, dan pemilihan folder; jalur subfolder tetap utuh.
- Isi ZIP tidak lagi membuang aset penting seperti gambar, font, dan berkas biner yang aman.
- File teks tetap dapat diedit; gambar dapat dipratinjau; aset lain tetap tersimpan dan ikut saat ZIP diunduh.
- AI Chat dapat mengirim hingga empat foto, menampilkan pratinjau, menghapus foto sebelum kirim, dan meminta AI merangkum serta meniru desain.
- Form pembuatan proyek serta Fix / Add Feature juga dapat menerima foto referensi desain.
- Pesan dan aktivitas tetap disimpan di backend; foto tidak dimasukkan mentah ke riwayat teks agar penyimpanan tetap ringan.

## Batas keamanan
- Tetap menolak executable, metadata `.git`, dependency hasil instalasi, path traversal, file terlalu besar, dan arsip berlebihan.
- Foto dikompresi sebelum dikirim ke AI; API key tetap hanya digunakan di server.
- Tidak menghapus fitur lama dan tidak menjalankan isi unggahan.

## Detail teknis
- Tambahkan format penyimpanan aset biner yang dapat dibedakan dari teks dan dikembalikan ke bytes ketika download ZIP.
- Gunakan `webkitdirectory` sebagai dukungan pemilihan folder di browser, sambil mempertahankan unggahan file/ZIP biasa.
- Perluas request builder/fix/add-feature agar menerima blok multimodal `image_url`, sama seperti chat.
- Tambahkan tampilan file berdasarkan jenis: editor untuk teks, preview untuk gambar, dan informasi/download untuk biner lain.
- Verifikasi upload folder, round-trip ZIP, kirim foto, kompilasi, serta tampilan desktop dan ponsel.

## Catatan
- “Generate gambar AI” diperlakukan sebagai penggunaan foto untuk menghasilkan atau memperbaiki kode/desain. Generator gambar mandiri tidak ditambahkan karena backend Marketku yang tersedia saat ini adalah chat multimodal.
