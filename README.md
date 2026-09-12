# Adi Bot Builder

BANGUN WEBSITE FULL STACK PROFESIONAL BERNAMA:

ADI BUILDER BOT

Tagline: AI Builder untuk membuat, memperbaiki, menganalisis, dan mengembangkan Bot Telegram, Bot WhatsApp, serta project kode.

TUJUAN UTAMA

Jangan membuat mockup atau UI saja.

Buat aplikasi yang benar-benar berfungsi untuk:

Membuat project Bot Telegram.

Membuat project Bot WhatsApp.

Upload project/file.

Menganalisa kode.

Memperbaiki error.

Menambah fitur.

Mengedit file menggunakan AI.

Menampilkan struktur project.

Membuat backup/version sebelum perubahan.

Download project sebagai ZIP.

Jangan membuat fitur kredit, login, register, deposit, QRIS, e-wallet, voucher, referral, paket PRO, atau sistem pembayaran.

1. AI UTAMA

JANGAN gunakan Lovable AI sebagai AI utama aplikasi.

Gunakan OpenAI-compatible API Marketku Router melalui backend.

Default Base URL:

https://router.marketku.id/v1

Contoh model:

nk/sonnet-4.5

nk/haiku-4.5

nk/deepseek-3.2

nk/qwen3-coder-next

nk/g1m-5

nk/auto

nk/auto-thinking

nk/deepseek-v4-flash

nk/gemini-3.1-pro

nk/gemini-3.1-flash-lite

nk/kimi-k2.7-code

nk/g1m-5.2

Model jangan hardcode.

Buat konfigurasi backend:

MARKETKU_BASE_URL

MARKETKU_API_KEY

MARKETKU_MODEL

API Key tidak boleh dikirim ke frontend atau ditampilkan kepada pengguna.

Gunakan backend endpoint:

POST /api/ai/chat

POST /api/ai/generate-project

POST /api/ai/analyze-project

POST /api/ai/fix-project

POST /api/ai/add-feature

2. HALAMAN UTAMA

Buat satu dashboard utama yang langsung dapat digunakan tanpa login.

Header:

ADI BUILDER BOT

Menu:

AI Builder

Telegram Bot

WhatsApp Bot

Upload Project

Project Files

Hero:

Bangun dan Perbaiki Project dengan AI

Subjudul:

"Buat, analisa, perbaiki, dan kembangkan project Bot Telegram, Bot WhatsApp, dan berbagai project kode."

Tombol:

Buat Project Upload Project

3. AI BUILDER

Layout desktop:

LEFT: Project/Chat

CENTER: AI Chat

RIGHT: File Explorer

Mobile: Gunakan drawer/tab agar tetap nyaman digunakan.

Pilihan project:

Bot Telegram

Bot WhatsApp

Node.js

Python

HTML

JavaScript

Project lainnya

Form:

Nama Project

Deskripsi:

"Jelaskan project yang ingin dibuat atau perubahan yang ingin dilakukan."

Dropdown Model AI.

Tombol:

Buat dengan AI

4. UPLOAD PROJECT

Support upload:

ZIP

JS

JSON

HTML

CSS

PY

TXT

file kode lain yang aman

Validasi ukuran dan tipe file.

Jangan pernah menjalankan file upload secara otomatis.

Untuk ZIP:

Extract secara aman.

Tampilkan struktur:

project/
├── package.json
├── index.js
├── config.js
├── commands/
│   ├── start.js
│   └── admin.js
└── README.md


5. AI ANALISA PROJECT

Saat user meminta analisa:

Jangan mengirim seluruh project ke AI jika tidak diperlukan.

Pertama scan struktur project.

Identifikasi file yang relevan.

Kirim hanya file/konten yang diperlukan untuk tugas tersebut.

Tampilkan:

Bahasa

Framework

Dependency

Struktur

Error

Warning

File terkait

Rekomendasi

Contoh:

Error ditemukan

index.js Baris 45

Syntax error.

Tombol:

Perbaiki dengan AI

6. AI FIX

Ketika user meminta perbaikan:

Analisa struktur.

Tentukan file yang perlu diubah.

Tampilkan rencana perubahan.

Buat backup/version.

Terapkan perubahan.

Tampilkan hasil perubahan.

Contoh:

File yang akan diubah:

index.js
config.js
database.js


Tombol:

Terapkan Perubahan

Jangan langsung menimpa file tanpa backup/version.

7. TAMBAH FITUR

User dapat mengetik:

"Tambahkan fitur login."

AI harus:

Membaca struktur project.

Menentukan file yang relevan.

Menjelaskan rencana.

Membuat backup.

Mengubah file yang diperlukan.

Menampilkan perubahan.

Jangan mengubah file yang tidak diperlukan.

8. AI CHAT MEMORY

Setiap project mempunyai context.

AI dapat mengetahui:

Jenis project

Struktur file

File yang sebelumnya diubah

Perubahan sebelumnya

Percakapan project

Contoh:

User: "Tambahkan login."

Kemudian:

User: "Tambahkan juga tombol logout."

AI harus memahami bahwa logout berkaitan dengan fitur login sebelumnya.

Simpan context hanya seperlunya agar penggunaan API efisien.

9. FILE EXPLORER + CODE EDITOR

Buat file explorer modern.

Klik file → tampilkan code editor.

Fitur:

Syntax highlighting

Copy

Edit

Save

AI Explain

AI Fix

AI Add Feature

Download file

Jangan membuat editor terlalu berat.

10. VERSION HISTORY

Sebelum perubahan AI:

Version 1
Version 2
Version 3


Simpan backup.

User dapat:

Preview

Compare

Restore

Jangan menghapus versi sebelumnya secara otomatis.

11. BOT TELEGRAM BUILDER

Buat generator khusus Bot Telegram.

Input:

Nama project

Telegram Bot Token

Owner Telegram ID

Deskripsi bot

Token harus disimpan dengan aman dan jangan ditampilkan lengkap setelah disimpan.

AI dapat membuat struktur bot seperti:

telegram-bot/
├── package.json
├── index.js
├── config.js
├── database/
├── commands/
├── handlers/
├── utils/
└── README.md


Dukungan fitur:

/start

Register

Login

Profile

Menu

Admin

Owner

Database

Button

Inline Keyboard

Broadcast

Referral

Saldo

Shop

API Integration

AI Chat

Custom Command

Gunakan struktur kode yang rapi dan mudah dikembangkan.

12. BOT WHATSAPP BUILDER

Fokus pada project Node.js/Baileys.

Pilihan:

Baileys

Node.js

AI dapat membuat:

Menu

Owner

Admin

Database

Register

Login

Profile

Custom Command

Group Feature

Welcome

Anti Spam

API Integration

AI Chat

Contoh struktur:

whatsapp-bot/
├── package.json
├── index.js
├── config.js
├── database/
├── commands/
├── handlers/
├── utils/
└── README.md


Tambahkan panduan menjalankan project.

Contoh:

pkg update
pkg install nodejs
npm install
node index.js


Sesuaikan command dengan dependency/project yang benar.

Jangan otomatis menjalankan akun WhatsApp pengguna di server.

13. DOWNLOAD

Tombol:

Download File

Download ZIP

ZIP harus berisi project terbaru.

Tambahkan README.md berisi:

Instalasi

Dependency

Konfigurasi

Cara menjalankan

Struktur project

14. DESAIN

Gunakan desain:

Modern SaaS AI Coding Platform

Tema:

Dark mode

Light mode

Blue

Indigo

Dark Slate

White

Gunakan:

Rounded cards

Clean spacing

Modern icons

Subtle animation

Loading state

Skeleton loading

Toast notification

Jangan terlalu ramai.

Mobile-first dan responsive.

15. ERROR HANDLING

Gunakan pesan aman:

AI error: "AI sedang mengalami gangguan. Silakan coba lagi."

Network: "Koneksi bermasalah."

File: "File tidak dapat diproses."

Jangan pernah menampilkan:

API Key

Secret

Stack trace sensitif

Credential backend

16. KEAMANAN

Wajib:

API AI hanya melalui backend.

API Key hanya server-side.

Validasi upload.

Batasi ukuran file.

Batasi jumlah file.

Jangan execute uploaded code secara otomatis.

Sanitize nama file/path.

Cegah path traversal.

Backup sebelum perubahan.

Jangan mengekspos credential project.

17. SYSTEM PROMPT INTERNAL

Gunakan system prompt internal:

"Kamu adalah ADI BUILDER AI.

Kamu membantu pengguna membuat, memperbaiki, menganalisa, dan mengembangkan project software.

Sebelum mengubah project:

Analisa struktur project.

Identifikasi file terkait.

Jelaskan rencana perubahan.

Buat backup/version.

Lakukan perubahan.

Tampilkan hasil.

Jika menemukan error:

Jelaskan error.

Jelaskan penyebab.

Berikan solusi.

Perbaiki kode jika diminta.

Jangan menghapus file tanpa alasan. Jangan membuat perubahan yang tidak diperlukan. Jaga konsistensi struktur project.

Gunakan hanya file yang relevan untuk tugas agar context dan penggunaan API tetap efisien."

18. BRANDING

Footer:

ADI BUILDER BOT

Dibuat dan dikembangkan oleh Agung Adi

Instagram: agungadi57

TikTok: pphitampro9

YouTube: Channel Mod Agung Adi

WhatsApp: 085769302532

Tambahkan tombol sosial media.

19. PRIORITAS IMPLEMENTASI

Bangun hanya fitur penting berikut:

PRIORITAS 1

Dashboard

AI Builder

Marketku API backend

Model selector

Upload project

File explorer

PRIORITAS 2

AI Chat

Analyze

Fix

Add Feature

Project context

PRIORITAS 3

Telegram Builder

WhatsApp Builder

Code editor

Version history

ZIP download

Jangan membangun fitur di luar daftar ini.

HASIL AKHIR

ADI BUILDER BOT harus terasa seperti:

AI Coding Assistant + Telegram Bot Builder + WhatsApp Bot Builder + Project Analyzer + AI Code Repair.

Fokus pada fungsi yang benar-benar bekerja.

Jangan membuat mockup kosong, dummy button, atau fitur pembayaran/kredit yang tidak diperlukan.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://bulldwebadi.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c5e57feb-7460-473b-8404-fea5911dcf7a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
