# Perkuat workspace, unggahan besar, dan perubahan AI

## Hasil yang akan dibuat
- Unggahan proyek mendukung sampai 1 GB dan 10.000 file, termasuk folder, ZIP bertingkat, aset, dan folder kosong, melalui unggahan bertahap agar browser tidak harus mengirim semuanya sekaligus.
- Foto referensi tidak dibatasi pada pemilihannya. Semua foto tetap terlihat dan dapat dihapus, sementara pengiriman ke AI dilakukan dalam kelompok aman agar permintaan panjang tidak terus ditolak.
- File contoh dapat lebih panjang dan lebih banyak, dengan pemilihan konteks relevan per tahap. AI tidak menerima satu payload tanpa batas; project besar diproses bertahap agar hasil tetap lengkap.
- Foto pratinjau memakai ukuran proporsional sesuai gambar asli, tidak dipaksa kotak atau memanjang.
- Panel perubahan memakai satu pilihan mode: Build, Fix, Tambah Fitur, atau Analisis Error. Setiap mode terlebih dahulu menampilkan rencana, file yang akan disentuh, alasan, dan perbandingan sebelum/sesudah; perubahan baru diterapkan setelah persetujuan.
- Riwayat Fix/Tambah Fitur tetap tersimpan dan dapat dibuka/tutup per file. Kode dapat disalin, file lama dapat dipulihkan, dan temuan error ditampilkan jelas dengan warna merah.
- Nama proyek dapat diganti dari workspace.
- Proyek dapat diberi PIN. Membuka, mengubah, mengunduh, mengganti nama, dan menghapus proyek wajib memiliki sesi PIN server yang valid. PIN disimpan sebagai hash dan tidak dapat ditampilkan kembali.
- Penghapusan proyek memakai konfirmasi dan PIN.

## Batas keamanan dan kejujuran
- Batas 1 GB/10.000 file adalah batas aplikasi; batas jaringan/perangkat tetap dapat membuat unggahan sangat besar gagal. Unggahan bertahap, progres, validasi ukuran, dan pesan kegagalan akan disediakan.
- Executable, metadata `.git`, dependency hasil instalasi, path traversal, dan arsip berbahaya tetap ditolak. Fitur lama tidak dihapus.
- “Foto tanpa batas” berarti tidak dibatasi di daftar pilihan. AI tetap menerima kelompok foto terukur karena model dan router memiliki batas konteks.
- PIN tidak disimpan di localStorage dan tidak dapat “dilihat kembali”. Browser menyimpan cookie sesi terenkripsi setelah PIN benar; jika lupa, PIN tidak bisa dipulihkan sebagai teks.

## Tahapan implementasi
1. Tambahkan hash PIN dan status proteksi pada proyek, endpoint pengaturan/verifikasi/kunci PIN, serta sesi terenkripsi untuk akses proyek.
2. Terapkan pemeriksaan PIN pada seluruh endpoint baca/tulis proyek dan pindahkan operasi sensitif yang masih langsung dari browser ke server.
3. Tambahkan layar buka PIN, pengaturan/ganti nama proyek, tombol kunci, dan konfirmasi hapus.
4. Ubah upload menjadi sesi bertahap dengan progres, batas 1 GB/10.000 file, pelestarian struktur folder/ZIP, dan finalisasi atomik.
5. Ubah foto/file referensi menjadi daftar besar dengan kompresi, pratinjau proporsional, dan pemrosesan AI per kelompok/konteks relevan.
6. Satukan Build/Fix/Tambah Fitur/Analisis Error dalam dropdown dan pertahankan alur rencana → tinjau file → setujui → backup → terapkan.
7. Tingkatkan tampilan proposal/riwayat: accordion per file, salin kode, penanda error merah, before/after, serta restore.
8. Verifikasi project lama tanpa PIN, project baru ber-PIN, buka/kunci ulang, rename/delete, upload folder/ZIP besar bertahap, seluruh mode AI, riwayat, desktop, dan ponsel.

## Detail teknis
- Gunakan migrasi Lovable Cloud untuk kolom hash PIN dan metadata sesi unggahan; setiap tabel baru mendapat GRANT dan RLS.
- Hash PIN dilakukan server-side dengan salt acak dan pembandingan aman. Sesi akses memakai cookie terenkripsi, bukan PIN mentah di browser.
- Endpoint proyek menerima bukti sesi akses dan memvalidasi project ID sebelum membaca atau mengubah data.
- Upload besar memakai beberapa request chunk/batch lalu finalisasi; data sementara dibersihkan ketika gagal atau kedaluwarsa.
- Konteks AI memakai peta struktur seluruh proyek, lalu file lengkap yang paling relevan dalam beberapa tahap. Tidak memotong diam-diam tanpa memberi tahu pengguna.
- Seluruh route halaman mempertahankan metadata unik yang sudah ada.
