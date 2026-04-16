# Supabase Setup Guide for QuranSRT
=====================================

## Database Schema

Jalankan SQL berikut di Supabase SQL Editor untuk membuat tabel yang diperlukan:

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

## Environment Variables

Pastikan variabel environment berikut sudah diset di `.env` file atau platform deployment:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-or-service-role-key
```

## Frontend Integration (Next.js)

Install Supabase client di frontend:

```bash
cd frontend
npm install @supabase/supabase-js
```

Buat file `lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

Contoh penggunaan autentikasi di komponen React:

```typescript
// Login dengan email/password
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123',
})

// Dapatkan token untuk API calls
const { data: { session } } = await supabase.auth.getSession()
const token = session?.access_token

// Gunakan token untuk call backend API
const response = await fetch('/api/generate/zip', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(requestData),
})
```

## Testing

Test endpoint dengan curl:

```bash
# Test health check
curl http://localhost:8000/health

# Test get history (butuh token)
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:8000/api/user/history
```
