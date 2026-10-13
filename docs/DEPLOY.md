# Deploy otomatis ke Hostinger (GitHub Actions)

Setiap `git push` ke `main` akan: cek tipe → uji → build → kirim ke Hostinger.

## Setup sekali saja
1. **Repo GitHub:** buat repo *private*, lalu `git init && git add . && git commit -m "awal" && git branch -M main && git remote add origin ... && git push -u origin main`.
2. **Akun FTP:** hPanel → Files → **FTP Accounts**. Catat host, username, password. Folder tujuan = folder situs, mis. `/domains/DOMAINANDA.com/public_html/` (lihat di File Manager; diakhiri `/`).
3. **Rahasia di GitHub:** repo → Settings → Secrets and variables → Actions:
   - Secrets: `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`, `FTP_DIR`
   - Variables (opsional): `SITE_URL` = `https://DOMAINANDA.com`
4. **Sekali di hosting:** salin `api/config.sample.php` jadi `api/config.php` lewat File Manager dan isi kuncinya. Deploy tidak pernah menimpa atau menghapus file ini.
5. Push perubahan apa pun, lalu lihat tab **Actions**. Hijau = situs sudah ter-update.

## Aturan penting
- Jangan commit `api/config.php` (sudah ada di `.gitignore`).
- `app-config.json` di server tidak ditimpa, jadi pengaturan yang Anda ubah di hosting aman. Untuk mengubah bawaannya, edit di File Manager.
- Rollback: `git revert` commit yang bermasalah lalu push.
- Bila FTPS ditolak, ganti `protocol: ftps` dengan `ftp`.

## Kerja dengan Claude Code
Buka repo ini di Claude Code, minta perubahan ("tambah paket Lembaga bulanan"), minta ia menjalankan `npm run typecheck`, lalu `git push`. Deploy jalan sendiri.
