# Percepat proses AI dan tampilkan progres

## Yang akan dibuat
- Tambahkan panel status saat AI membuat project, memperbaiki project, atau menambah fitur.
- Tampilkan tahap yang sedang dikerjakan dan penghitung waktu berjalan agar pengguna tahu proses masih aktif.
- Ubah teks tombol selama proses supaya aksi aktif terlihat jelas dan tombol lain tetap terkunci aman.
- Kurangi data kode yang dikirim ke AI dengan pemilihan file yang lebih relevan, tanpa menghapus file atau fitur lama.

## Detail teknis
- Buat utilitas status waktu yang dapat dipakai ulang pada formulir builder dan workspace.
- Gunakan tahapan berbasis waktu seperti menyiapkan konteks, menulis kode, dan merapikan hasil; ini indikator aktivitas, bukan persentase palsu.
- Perketat batas konteks dan prioritaskan file berdasarkan nama serta kata-kata instruksi agar respons lebih cepat dan tetap relevan.
- Pertahankan streaming AI dan retry error sementara yang sudah ada; tidak menambahkan batas waktu yang dapat memutus hasil di tengah proses.

## Verifikasi
- Uji Buat Project serta tombol Fix/Tambah Fitur untuk memastikan status dan waktu muncul lalu berhenti saat selesai atau gagal.
- Periksa tampilan pada ponsel dan desktop, lalu pastikan build tidak memiliki error.