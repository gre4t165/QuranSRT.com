# 🚀 Panduan Deployment QuranSRT
## Deploy Otomatis ke Vercel, Railway, dan Supabase

Panduan lengkap untuk men-deploy aplikasi QuranSRT secara mandiri dan otomatis ke tiga platform: **Supabase** (database & auth), **Railway** (backend API), dan **Vercel** (frontend).

---

## 📋 Daftar Isi

1. [Prerequisites](#prerequisites)
2. [Step 1: Setup Supabase](#step-1-setup-supabase)
3. [Step 2: Deploy Backend ke Railway](#step-2-deploy-backend-ke-railway)
4. [Step 3: Deploy Frontend ke Vercel](#step-3-deploy-frontend-ke-vercel)
5. [Testing & Verification](#testing--verification)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Sebelum memulai, pastikan Anda memiliki:

- ✅ Akun GitHub (wajib untuk integrasi CI/CD)
- ✅ Akun Supabase (gratis di https://supabase.com)
- ✅ Akun Railway (gratis dengan limit $5/bulan di https://railway.app)
- ✅ Akun Vercel (gratis di https://vercel.com)
- ✅ Node.js 18+ terinstall di lokal (untuk testing)
- ✅ Python 3.10+ terinstall di lokal (untuk testing)

---

## Step 1: Setup Supabase

### 1.1 Buat Project Baru

1. Login ke https://supabase.com
2. Klik **"New Project"**
3. Isi detail project:
   - **Name**: `quransrt`
   - **Database Password**: (simpan password ini dengan aman)
   - **Region**: Pilih yang terdekat dengan target user (misal: `Singapore` untuk Indonesia)
4. Klik **"Create new project"** dan tunggu ±2 menit hingga project siap

### 1.2 Jalankan Database Schema

1. Di dashboard Supabase, klik menu **"SQL Editor"** di sidebar kiri
2. Klik **"New query"**
3. Copy-paste SQL berikut:

```sql
-- Tabel untuk menyimpan riwayat generate pengguna
CREATE TABLE IF NOT EXISTS generate_history (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    surah INTEGER NOT NULL CHECK (surah >= 1 AND surah <= 114),
    start_verse INTEGER NOT NULL CHECK (start_verse >= 1),
    end_verse INTEGER NOT NULL CHECK (end_verse >= start_verse),
    reciter_id VARCHAR(50) NOT NULL,
    translation_key VARCHAR(50) NOT NULL DEFAULT 'none',
    mode VARCHAR(20) NOT NULL DEFAULT 'WAQOF',
    filename VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index untuk query yang lebih cepat
CREATE INDEX IF NOT EXISTS idx_generate_history_user_id ON generate_history(user_id);
CREATE INDEX IF NOT EXISTS idx_generate_history_created_at ON generate_history(created_at DESC);

-- Tabel untuk menyimpan preset favorit pengguna
CREATE TABLE IF NOT EXISTS user_presets (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    surah INTEGER NOT NULL CHECK (surah >= 1 AND surah <= 114),
    start_verse INTEGER NOT NULL CHECK (start_verse >= 1),
    end_verse INTEGER NOT NULL,
    reciter_id VARCHAR(50) NOT NULL,
    translation_keys JSONB DEFAULT '[]'::jsonb,
    mode VARCHAR(20) NOT NULL DEFAULT 'WAQOF',
    show_arabic BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index untuk query yang lebih cepat
CREATE INDEX IF NOT EXISTS idx_user_presets_user_id ON user_presets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_presets_created_at ON user_presets(created_at DESC);

-- Row Level Security (RLS) - WAJIB untuk keamanan
ALTER TABLE generate_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_presets ENABLE ROW LEVEL SECURITY;

-- Policy: Pengguna hanya bisa melihat/mengubah data mereka sendiri
CREATE POLICY "Users can view own history" ON generate_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own history" ON generate_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own history" ON generate_history
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own presets" ON user_presets
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own presets" ON user_presets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own presets" ON user_presets
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own presets" ON user_presets
    FOR DELETE USING (auth.uid() = user_id);
```

4. Klik **"Run"** atau tekan `Ctrl+Enter`
5. Pastikan muncul notifikasi **"Success"** tanpa error

### 1.3 Dapatkan API Credentials

1. Di dashboard Supabase, klik menu **"Settings"** (ikon gear) → **"API"**
2. Catat kedua nilai berikut:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbG...` (panjang, dimulai dengan eyJhb)

> ⚠️ **PENTING**: Gunakan `anon public key` untuk frontend dan backend. Jangan gunakan `service_role key` kecuali untuk operasi admin!

### 1.4 Konfigurasi Authentication (Opsional)

Jika ingin mengaktifkan user registration:

1. Masuk ke **"Authentication"** → **"Providers"**
2. Untuk email/password:
   - Pastikan **Email** provider enabled
   - Aktifkan **"Enable email signup"**
3. Untuk OAuth (Google, GitHub, dll):
   - Klik provider yang diinginkan
   - Ikuti instruksi untuk mendapatkan Client ID & Secret
   - Masukkan credentials dan klik **"Save"**

---

## Step 2: Deploy Backend ke Railway

### 2.1 Persiapkan Repository GitHub

Jika belum ada di GitHub:

```bash
cd /workspace
git init
git add .
git commit -m "Initial commit: QuranSRT ready for deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/quransrt.git
git push -u origin main
```

### 2.2 Buat Aplikasi di Railway

1. Login ke https://railway.app
2. Klik **"New Project"**
3. Pilih **"Deploy from GitHub repo"**
4. Pilih repository `quransrt` dari dropdown
5. Railway akan otomatis mendeteksi `railway.toml` di folder `/backend`

### 2.3 Konfigurasi Environment Variables

Di Railway dashboard:

1. Klik service yang baru dibuat (biasanya bernama `quransrt`)
2. Klik tab **"Variables"**
3. Tambahkan variabel berikut satu per satu:

| Variable Name | Value | Description |
|--------------|-------|-------------|
| `SUPABASE_URL` | `https://xxxxx.supabase.co` | URL project Supabase Anda |
| `SUPABASE_KEY` | `eyJhbG...` | Anon key dari Supabase |
| `CORS_ORIGINS` | `https://quransrt.vercel.app,https://www.quransrt.com` | Domain frontend (nanti diisi setelah deploy Vercel) |
| `MAX_CONCURRENT_DOWNLOADS` | `5` | Limit download MP3 bersamaan |
| `DOWNLOAD_TIMEOUT` | `30` | Timeout download MP3 dalam detik |
| `MAX_RETRIES` | `3` | Maksimal retry jika download gagal |

> 💡 **Tips**: Untuk `CORS_ORIGINS`, isi dulu dengan `http://localhost:3000` untuk testing, nanti update setelah dapat domain dari Vercel.

### 2.4 Konfigurasi Build & Start

Railway otomatis membaca `railway.toml`, tapi pastikan:

1. Klik tab **"Settings"**
2. Di bagian **"Build"**, pastikan:
   - **Builder**: `Nixpacks` (default)
   - **Root Directory**: `backend`
3. Di bagian **"Deploy"**, pastikan:
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

### 2.5 Deploy & Dapatkan URL

1. Railway akan otomatis mulai build setelah variabel ditambahkan
2. Tunggu proses build selesai (±2-3 menit)
3. Setelah sukses, Railway akan memberikan URL seperti:
   ```
   https://quransrt-production.up.railway.app
   ```
4. **Copy URL ini** — akan digunakan untuk konfigurasi Vercel

### 2.6 Test Backend

Test health endpoint:

```bash
curl https://YOUR_RAILWAY_URL.up.railway.app/health
```

Expected response:
```json
{"status": "healthy"}
```

Test API endpoint:

```bash
curl https://YOUR_RAILWAY_URL.up.railway.app/api/quran/surahs
```

---

## Step 3: Deploy Frontend ke Vercel

### 3.1 Install Supabase Client di Frontend

Update `package.json` frontend untuk menambahkan Supabase:

```bash
cd frontend
npm install @supabase/supabase-js
```

### 3.2 Buat File Environment Variables

Buat file `.env.local` di folder `/frontend`:

```bash
NEXT_PUBLIC_API_URL=https://YOUR_RAILWAY_URL.up.railway.app
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
```

> ⚠️ **PENTING**: 
> - File `.env.local` tidak boleh di-commit ke Git (sudah ada di `.gitignore`)
> - Gunakan `NEXT_PUBLIC_` prefix agar variabel bisa diakses di client-side

### 3.3 Buat File Supabase Client

Buat file baru di `/frontend/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### 3.4 Deploy ke Vercel

#### Opsi A: Via Vercel Dashboard (Recommended untuk pemula)

1. Login ke https://vercel.com
2. Klik **"Add New..."** → **"Project"**
3. Import dari GitHub:
   - Pilih repository `quransrt`
   - Klik **"Import"**
4. Konfigurasi project:
   - **Framework Preset**: Next.js (otomatis terdeteksi)
   - **Root Directory**: Klik **"Edit"** → masukkan `frontend`
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)
5. **Environment Variables** — klik **"Add"** dan isi:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_API_URL` | `https://YOUR_RAILWAY_URL.up.railway.app` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbG...` |

6. Klik **"Deploy"**
7. Tunggu ±2-3 menit hingga deploy selesai

#### Opsi B: Via Vercel CLI (Untuk advanced users)

```bash
# Install Vercel CLI globally
npm install -g vercel

# Login ke Vercel
vercel login

# Navigate ke folder frontend
cd frontend

# Deploy pertama kali (akan ada wizard interaktif)
vercel

# Jawab pertanyaan wizard:
# - Set up and deploy? Y
# - Which scope? (pilih akun Anda)
# - Link to existing project? N
# - Project name? quransrt
# - Directory? ./ (karena sudah di folder frontend)
# - Override settings? N

# Set environment variables via CLI
vercel env add NEXT_PUBLIC_API_URL production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production

# Deploy ke production
vercel --prod
```

### 3.5 Update CORS di Railway

Setelah frontend deploy, Vercel akan memberikan domain seperti:
```
https://quransrt.vercel.app
```

**PENTING**: Update CORS di Railway:

1. Kembali ke Railway dashboard
2. Buka service backend → tab **"Variables"**
3. Edit `CORS_ORIGINS` menjadi:
   ```
   https://quransrt.vercel.app,https://www.quransrt.com,http://localhost:3000
   ```
4. Railway akan otomatis restart service

### 3.6 Custom Domain (Opsional)

Jika ingin menggunakan custom domain (misal: `quransrt.com`):

#### Di Vercel:
1. Buka project di Vercel dashboard
2. Klik tab **"Domains"**
3. Masukkan domain Anda: `quransrt.com`
4. Ikuti instruksi untuk setup DNS records di registrar domain Anda

#### Di Railway:
1. Update `CORS_ORIGINS` dengan menambahkan domain custom
2. Tidak perlu setup khusus di Railway untuk custom domain

---

## Testing & Verification

### Checklist Post-Deployment

Setelah semua deploy, lakukan testing berikut:

#### ✅ 1. Test Frontend Loading
- Buka URL Vercel di browser
- Pastikan halaman home load tanpa error
- Cek console browser (F12) untuk error JavaScript

#### ✅ 2. Test API Connection
- Pilih surah (misal: Al-Fatihah)
- Klik **"Preview"**
- Pastikan preview subtitle muncul

#### ✅ 3. Test Download SRT
- Klik **"Download SRT"**
- Pastikan file terdownload dengan nama yang benar
- Buka file SRT di text editor, pastikan format benar

#### ✅ 4. Test Download ZIP (dengan MP3)
- Centang **"Include MP3"**
- Klik **"Download ZIP"**
- Extract ZIP file
- Pastikan berisi:
  - File `.srt`
  - File `.mp3`
  - File `README.txt`

#### ✅ 5. Test Multi-Translation
- Pilih mode **"Multi-Translation"**
- Pilih 3-5 bahasa
- Klik **"Download Multi ZIP"**
- Pastikan ZIP berisi multiple file SRT

#### ✅ 6. Test Authentication (jika diaktifkan)
- Klik tombol login/register
- Register akun baru dengan email
- Cek email untuk verification link
- Login dan test fitur user-specific (history, presets)

### Automated Health Check Script

Buat script untuk monitoring:

```bash
#!/bin/bash
# health-check.sh

BACKEND_URL="https://YOUR_RAILWAY_URL.up.railway.app"
FRONTEND_URL="https://quransrt.vercel.app"

echo "🔍 Checking Backend Health..."
curl -s "$BACKEND_URL/health" | jq .

echo -e "\n🔍 Checking Frontend..."
curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL"

echo -e "\n🔍 Testing API Endpoint..."
curl -s "$BACKEND_URL/api/quran/surahs" | jq '.surahs | length'

echo -e "\n✅ All checks completed!"
```

---

## Troubleshooting

### ❌ Error: CORS Policy Blocked

**Symptom**: Frontend tidak bisa call API, error di console:
```
Access to fetch at '...' from origin '...' has been blocked by CORS policy
```

**Solution**:
1. Pastikan `CORS_ORIGINS` di Railway sudah include domain Vercel
2. Restart backend di Railway (klik **"Deployments"** → **"Redeploy"**)
3. Clear browser cache dan hard refresh (Ctrl+Shift+R)

### ❌ Error: Supabase Connection Failed

**Symptom**: Error saat save history atau login:
```
Supabase configuration missing
```

**Solution**:
1. Cek apakah `SUPABASE_URL` dan `SUPABASE_KEY` sudah set di Railway
2. Pastikan URL Supabase benar (harus https, bukan http)
3. Test koneksi manual:
   ```bash
   curl -H "apikey: YOUR_KEY" \
        https://YOUR_PROJECT.supabase.co/rest/v1/generate_history
   ```

### ❌ Error: Build Failed di Vercel

**Symptom**: Deploy gagal dengan error:
```
Module not found: Can't resolve '@supabase/supabase-js'
```

**Solution**:
1. Pastikan `@supabase/supabase-js` ada di `dependencies` di `package.json`
2. Run lokal: `npm install` lalu commit perubahan
3. Vercel akan auto-redeploy setelah push ke GitHub

### ❌ Error: Build Failed di Railway

**Symptom**: Build gagal dengan error Python:
```
ModuleNotFoundError: No module named 'fastapi'
```

**Solution**:
1. Pastikan `requirements.txt` ada di folder `/backend`
2. Pastikan `railway.toml` pointing ke directory yang benar
3. Cek log build di Railway untuk detail error

### ❌ Download ZIP Kosong atau Tanpa MP3

**Symptom**: ZIP terdownload tapi hanya berisi README, tidak ada MP3

**Solution**:
1. Cek log Railway untuk error download MP3
2. Pastikan timeout cukup (minimal 30 detik)
3. Cek apakah `MAX_CONCURRENT_DOWNLOADS` tidak terlalu tinggi (rekomendasi: 5)
4. Test manual download MP3 dari qurancdn.com

### ❌ Frontend Menampilkan "Loading..." Terus

**Symptom**: Halaman stuck di "Memuat data surah & reciter..."

**Solution**:
1. Cek console browser untuk error network
2. Pastikan `NEXT_PUBLIC_API_URL` benar di Vercel environment variables
3. Test API URL langsung di browser:
   ```
   https://YOUR_RAILWAY_URL.up.railway.app/api/quran/surahs
   ```
4. Jika API tidak respond, cek Railway logs untuk error

---

## Monitoring & Maintenance

### Logging

- **Railway**: Klik **"Deployments"** → pilih deployment → lihat real-time logs
- **Vercel**: Klik project → **"Deployment"** → klik deployment → **"View Logs"**
- **Supabase**: Klik **"Logs"** di sidebar untuk query logs

### Uptime Monitoring

Gunakan layanan gratis untuk monitoring uptime:

1. **UptimeRobot** (https://uptimerobot.com):
   - Setup monitor HTTP untuk backend URL
   - Interval: 5 menit
   - Alert via email jika down

2. **Vercel Analytics**:
   - Aktifkan di Vercel dashboard
   - Monitor performance dan errors

### Backup Database

Export database Supabase secara berkala:

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref YOUR_PROJECT_REF

# Backup database
supabase db dump -f backup.sql
```

Setup cron job untuk backup mingguan.

---

## Cost Estimation

### Free Tier Limits

| Platform | Free Tier | Upgrade Threshold |
|----------|-----------|-------------------|
| **Supabase** | 500 MB DB, 50K MAU | >50K monthly active users |
| **Railway** | $5 credit/month | >$5 usage |
| **Vercel** | Unlimited deployments, 100 GB bandwidth | >100 GB bandwidth/month |

### Expected Monthly Cost

Untuk traffic rendah-sedang (<10K users/month):
- **Supabase**: $0 (free tier cukup)
- **Railway**: ~$0-5 (tergantung usage)
- **Vercel**: $0 (free tier cukup)

**Total**: $0-5/month

---

## Next Steps & Enhancements

Setelah deployment berhasil, pertimbangkan enhancement berikut:

1. **CI/CD Pipeline**: Setup GitHub Actions untuk auto-deploy on push
2. **Analytics**: Integrate Google Analytics atau Plausible
3. **SEO Optimization**: Add meta tags, sitemap, robots.txt
4. **Performance**: Enable caching di Railway (Redis)
5. **Security**: Rate limiting, DDoS protection
6. **Features**: User favorites, share links, social media integration

---

## Support & Resources

- **Documentation**:
  - [FastAPI Docs](https://fastapi.tiangolo.com)
  - [Next.js Docs](https://nextjs.org/docs)
  - [Supabase Docs](https://supabase.com/docs)
  - [Railway Docs](https://docs.railway.app)
  - [Vercel Docs](https://vercel.com/docs)

- **Community**:
  - GitHub Issues untuk bug report
  - Discord Supabase untuk pertanyaan database
  - Vercel Community Forum

---

**🎉 Selamat!** Aplikasi QuranSRT Anda sekarang live dan siap digunakan oleh pengguna di seluruh dunia!
