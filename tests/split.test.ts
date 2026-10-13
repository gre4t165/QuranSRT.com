// Uji pemecahan ayat & potongan: node scripts/run-tests.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { splitArabic, splitByFractions, fractionsOf, sameText, arabicWords } from '../app/lib/segment';
import { splitRow, mergeNext, unsplit, applyAlignment, groupIntact, partInfo } from '../app/lib/parts';
import { buildCues, toSRT } from '../app/lib/subtitles';
import { DEFAULT_CONTENT, DEFAULT_EXPORT, rowsFromAyat } from '../app/lib/project';

const surah = (n: number) => JSON.parse(fs.readFileSync(`public/data/quran/${n}.json`, 'utf8')).verses.map((v: any) => ({ n: v.n, ar: v.ar, tr: v.tr, id: v.id, en: v.en }));

// 1) Integritas: semua ayat, dipecah 2..6 bagian, gabungannya sama persis.
let checked = 0;
let waqfHits = 0;
let waqfCuts = 0;
for (let s = 1; s <= 114; s++) {
	for (const v of surah(s)) {
		for (const p of [2, 3, 6]) {
			if (arabicWords(v.ar).length < p) continue;
			const parts = splitArabic(v.ar, p);
			assert.equal(parts.length, p);
			assert.ok(sameText(parts.join(' '), v.ar), `Arab berubah di ${s}:${v.n}`);
			const fr = fractionsOf(parts);
			for (const k of ['id', 'en', 'tr'] as const) assert.ok(sameText(splitByFractions(v[k], fr, 'latin').filter(Boolean).join(' '), v[k]), `${k} berubah di ${s}:${v.n}`);
			if (p === 2) {
				const hasWaqf = /[ۖۗۘۚ]/.test(v.ar.split(' ').slice(0, -1).join(' '));
				if (hasWaqf) {
					waqfCuts++;
					if (/[ۖ-ۛ]$/.test(parts[0])) waqfHits++;
				}
			}
			checked++;
		}
	}
}
console.log(`✓ integritas ${checked} pemecahan; potongan jatuh di tanda waqaf: ${waqfHits}/${waqfCuts} (${Math.round((waqfHits / waqfCuts) * 100)}%)`);

// 2) Al-Baqarah 282: potongan 4 bagian
const b = surah(2);
const v282 = b[281];
const p4 = splitArabic(v282.ar, 4);
console.log('  2:282 → panjang potongan:', p4.map((x) => x.length).join(', '), '| akhir potongan:', p4.map((x) => x.slice(-1).codePointAt(0)!.toString(16)).join(' '));

// 3) splitRow / merge / unsplit / alignment
const rows = rowsFromAyat(2, b, 282, 283, null);
const split = splitRow(rows[0], p4);
assert.equal(split.length, 4);
assert.ok(split.every((r) => r.group === split[0].group));
assert.equal(split[0].start, rows[0].start);
assert.equal(split[3].end, rows[0].end);
let rs = [...split, rows[1]];
assert.deepEqual(partInfo(rs, 2), { n: 3, of: 4 });
assert.ok(groupIntact(rs, 0));
rs = mergeNext(rs, 0);
assert.equal(rs.length, 4);
assert.ok(groupIntact(rs, 0));
const back = unsplit(rs, 1);
assert.equal(back.length, 2);
assert.equal(back[0].ar, rows[0].ar, 'satukan kembali = teks asli persis');
assert.equal(back[0].id, rows[0].id);
assert.equal(back[0].group, undefined);
// Alignment: valid diterima, yang mengubah teks ditolak
const w = rows[0].id.split(/\s+/);
const good = [w.slice(0, 10).join(' '), w.slice(10, 60).join(' '), w.slice(60, 120).join(' '), w.slice(120).join(' ')];
const ok = applyAlignment(split, 0, { id: good });
assert.notEqual(ok, split);
assert.ok(ok.every((r) => r.aligned));
const bad = applyAlignment(split, 0, { id: [...good.slice(0, 3), good[3] + ' tambahan'] });
assert.equal(bad, split, 'hasil yang mengubah teks harus ditolak');
console.log('✓ potong, gabung, satukan, verifikasi penyelarasan');

// 4) Cue: penanda ayat hanya di potongan terakhir; fit memecah
const cues = buildCues(split, DEFAULT_CONTENT, DEFAULT_EXPORT);
assert.equal(cues.length, 4);
assert.ok(!cues[0].lines[0].text.includes('﴿'));
assert.ok(cues[3].lines[0].text.includes('﴿'));
const fitShort = (lines: { text: string }[]) => lines.reduce((a, l) => a + l.text.length, 0) < 600;
const auto = buildCues([rows[0]], DEFAULT_CONTENT, DEFAULT_EXPORT, fitShort);
assert.ok(auto.length > 1 && auto.every((c) => fitShort(c.lines)), 'autoFit memecah sampai muat');
assert.ok(Math.abs(auto.at(-1)!.end - rows[0].end) < 1e-9);
const srt = toSRT(auto, DEFAULT_EXPORT);
assert.ok(sameText(auto.map((c) => c.lines.find((l) => l.kind === 'ar')!.text).join(' ').replace(/ ﴿.*$/, ''), rows[0].ar));
console.log(`✓ cue: 2:282 dipecah otomatis jadi ${auto.length} subtitle, ${srt.length} karakter SRT`);
