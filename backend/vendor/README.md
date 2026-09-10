# vendor/

Letakkan binari FFmpeg di sini **sebelum** build backend desktop:

- `ffmpeg.exe`
- `ffprobe.exe`

`quransrt-backend.spec` akan otomatis menyertakannya ke dalam executable backend
sehingga fitur ekspor video MP4 (Pipeline 3) berfungsi tanpa perlu FFmpeg
terpasang terpisah di PC pengguna.

Binari `.exe` tidak di-commit ke git (lihat `.gitignore`). Hanya README ini
yang di-track agar folder tetap ada.

Unduh FFmpeg untuk Windows: https://www.gyan.dev/ffmpeg/builds/ atau
https://github.com/BtbN/FFmpeg-Builds/releases
