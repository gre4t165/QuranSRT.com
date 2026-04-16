# 🚀 Quick Start Deployment

## Langkah Cepat Deploy (15 Menit)

### 1. Setup Supabase (3 menit)
```bash
1. Buka https://supabase.com → New Project
2. Tunggu project siap
3. SQL Editor → Run SQL schema (lihat DEPLOYMENT_GUIDE.md Step 1.2)
4. Settings → API → Copy URL dan anon key
```

### 2. Deploy Backend ke Railway (5 menit)
```bash
1. Push code ke GitHub
2. Buka https://railway.app → New Project → Deploy from GitHub
3. Pilih repository quransrt
4. Variables tab → Add:
   - SUPABASE_URL=https://xxx.supabase.co
   - SUPABASE_KEY=eyJhbG...
   - CORS_ORIGINS=http://localhost:3000
5. Tunggu deploy selesai
6. Copy URL Railway Anda
```

### 3. Deploy Frontend ke Vercel (5 menit)
```bash
1. Update package.json frontend (sudah done ✅)
2. Buka https://vercel.com → Add New → Project
3. Import dari GitHub
4. Root Directory: frontend
5. Environment Variables:
   - NEXT_PUBLIC_API_URL=https://your-railway-url.up.railway.app
   - NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
   - NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
6. Deploy
```

### 4. Update CORS di Railway (2 menit)
```bash
1. Kembali ke Railway dashboard
2. Edit CORS_ORIGINS:
   https://quransrt.vercel.app,http://localhost:3000
```

✅ **Done!** Aplikasi Anda sudah live!

---

## Testing Checklist

- [ ] Frontend load tanpa error
- [ ] Pilih surah → Preview muncul
- [ ] Download SRT berhasil
- [ ] Download ZIP dengan MP3 berhasil
- [ ] Multi-translation ZIP berhasil

---

## Files yang Sudah Disiapkan

✅ `/workspace/DEPLOYMENT_GUIDE.md` - Panduan lengkap detail  
✅ `/workspace/.env.template` - Template environment variables  
✅ `/workspace/frontend/lib/supabase.ts` - Supabase client  
✅ `/workspace/frontend/package.json` - Updated dengan @supabase/supabase-js  
✅ `/workspace/.github/workflows/deploy.yml` - CI/CD pipeline  
✅ `/workspace/.gitignore` - Proper ignore rules  

---

## Butuh Bantuan?

Lihat **DEPLOYMENT_GUIDE.md** untuk panduan lengkap dengan troubleshooting.
