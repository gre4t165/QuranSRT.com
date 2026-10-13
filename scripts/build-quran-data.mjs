// Membuat data Al-Qur'an statis dari paket npm "quran-json" (sumber: QuranEnc + Tanzil).
// Jalankan: npm run data   → menulis public/data/quran/{1..114}.json dan app/data/surahs.ts
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const base = path.dirname(require.resolve('quran-json/package.json'));
const dist = path.join(base, 'dist', 'chapters');
const outDir = path.resolve('public/data/quran');
fs.mkdirSync(outDir, { recursive: true });

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const idIndex = readJson(path.join(dist, 'id', 'index.json'));
const enIndex = readJson(path.join(dist, 'en', 'index.json'));

const meta = [];
for (const s of idIndex) {
  const id = readJson(path.join(dist, 'id', `${s.id}.json`));
  const en = readJson(path.join(dist, 'en', `${s.id}.json`));
  if (id.verses.length !== en.verses.length) throw new Error(`Jumlah ayat beda di surah ${s.id}`);
  const verses = id.verses.map((v, i) => ({
    n: v.id,
    ar: v.text,
    tr: v.transliteration,
    id: v.translation,
    en: en.verses[i].translation,
  }));
  fs.writeFileSync(path.join(outDir, `${s.id}.json`), JSON.stringify({ number: s.id, verses }));
  const e = enIndex.find((x) => x.id === s.id);
  meta.push([s.id, s.name, s.transliteration, s.translation, e.translation, s.type === 'meccan' ? 'M' : 'D', s.total_verses]);
}

const total = meta.reduce((a, m) => a + m[6], 0);
if (total !== 6236) throw new Error(`Total ayat ${total}, seharusnya 6236`);

const ts = `// File ini dibuat otomatis oleh scripts/build-quran-data.mjs — jangan diedit manual.
export interface SurahMeta {
\tnumber: number;
\tname: string;
\tlatin: string;
\tmeaningId: string;
\tmeaningEn: string;
\ttype: 'M' | 'D';
\tverses: number;
}

const RAW: [number, string, string, string, string, 'M' | 'D', number][] = ${JSON.stringify(meta)};

export const SURAHS: SurahMeta[] = RAW.map(([number, name, latin, meaningId, meaningEn, type, verses]) => ({ number, name, latin, meaningId, meaningEn, type, verses }));

export const getSurah = (n: number): SurahMeta => SURAHS[Math.min(114, Math.max(1, n)) - 1];
`;
fs.writeFileSync(path.resolve('app/data/surahs.ts'), ts);
console.log(`OK: 114 surah, ${total} ayat → ${outDir}`);

// Sampel Al-Fatihah 1–4 untuk animasi beranda (verbatim).
const fat = JSON.parse(fs.readFileSync(path.join(outDir, '1.json'), 'utf8')).verses.slice(0, 4).map(({ n, ar, id, en }) => ({ n, ar, id, en }));
fs.writeFileSync(path.resolve('app/data/sample.ts'), `// Dibuat dari public/data/quran/1.json — teks verbatim untuk animasi beranda.\nexport const FATIHAH_SAMPLE = ${JSON.stringify(fat, null, '\t')} as const;\n`);
