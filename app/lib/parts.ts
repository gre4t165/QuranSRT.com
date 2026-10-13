// Operasi potongan ayat (mid-verse cut). Satu ayat bisa dipecah menjadi beberapa
// baris berurutan dengan `group` yang sama. Teks Arab tiap potongan selalu irisan
// kata utuh dari teks aslinya; gabungannya diverifikasi sama dengan `full.ar`.

import { uid, type Row } from './project';
import { fractionsOf, sameText, splitByFractions } from './segment';

export const fullOf = (r: Row) => r.full ?? { ar: r.ar, tr: r.tr, id: r.id, en: r.en };

/** Indeks awal & akhir (inklusif) kelompok potongan yang memuat baris i. */
export function groupRange(rows: Row[], i: number): [number, number] {
	const g = rows[i]?.group;
	if (!g) return [i, i];
	let a = i;
	let b = i;
	while (a > 0 && rows[a - 1].group === g) a--;
	while (b < rows.length - 1 && rows[b + 1].group === g) b++;
	return [a, b];
}

export const isLastPart = (rows: Row[], i: number) => !rows[i]?.group || rows[i + 1]?.group !== rows[i].group;

/** Nomor potongan (1-based) dan jumlahnya, atau null bila bukan potongan. */
export function partInfo(rows: Row[], i: number): { n: number; of: number } | null {
	if (!rows[i]?.group) return null;
	const [a, b] = groupRange(rows, i);
	return { n: i - a + 1, of: b - a + 1 };
}

/** Pecah baris menjadi beberapa potongan sesuai potongan teks Arab yang diberikan. */
export function splitRow(row: Row, arParts: string[]): Row[] {
	const parts = arParts.filter((x) => x.trim());
	if (parts.length < 2 || !sameText(parts.join(' '), row.ar)) return [row];
	const fr = fractionsOf(parts);
	const tr = splitByFractions(row.tr, fr, 'latin');
	const id = splitByFractions(row.id, fr, 'latin');
	const en = splitByFractions(row.en, fr, 'latin');
	const group = row.group ?? uid();
	const full = fullOf(row);
	const dur = Math.max(0, row.end - row.start);
	let t = row.start;
	return parts.map((ar, k) => {
		const d = dur * fr[k];
		const start = Math.round(t * 1000) / 1000;
		t += d;
		const end = k === parts.length - 1 ? row.end : Math.round(t * 1000) / 1000;
		return { ...row, key: uid(), group, full, aligned: false, ar, tr: tr[k] ?? '', id: id[k] ?? '', en: en[k] ?? '', start, end };
	});
}

function collapse(rows: Row[], a: number, b: number): Row {
	const seg = rows.slice(a, b + 1);
	const first = seg[0];
	const joined = {
		ar: seg.map((r) => r.ar).join(' '),
		tr: seg.map((r) => r.tr).filter(Boolean).join(' '),
		id: seg.map((r) => r.id).filter(Boolean).join(' '),
		en: seg.map((r) => r.en).filter(Boolean).join(' '),
	};
	const full = fullOf(first);
	const whole = a === groupRange(rows, a)[0] && b === groupRange(rows, a)[1];
	// Bila tidak ada suntingan, kembalikan teks asli persis (termasuk spasi aslinya).
	const pick = (k: keyof typeof joined) => (whole && sameText(joined[k], full[k]) ? full[k] : joined[k]);
	const merged: Row = { ...first, ar: pick('ar'), tr: pick('tr'), id: pick('id'), en: pick('en'), start: first.start, end: seg[seg.length - 1].end, aligned: seg.every((r) => r.aligned) };
	if (whole) {
		delete merged.group;
		delete merged.full;
		delete merged.aligned;
	}
	return merged;
}

/** Gabungkan potongan i dengan potongan sesudahnya. */
export function mergeNext(rows: Row[], i: number): Row[] {
	const r = rows[i];
	const n = rows[i + 1];
	if (!r?.group || n?.group !== r.group) return rows;
	const [a, b] = groupRange(rows, i);
	if (b - a === 1) return [...rows.slice(0, a), collapse(rows, a, b), ...rows.slice(b + 1)];
	return [...rows.slice(0, i), collapse(rows, i, i + 1), ...rows.slice(i + 2)];
}

/** Satukan kembali semua potongan dalam kelompok baris i. */
export function unsplit(rows: Row[], i: number): Row[] {
	const [a, b] = groupRange(rows, i);
	if (a === b) return rows;
	return [...rows.slice(0, a), collapse(rows, a, b), ...rows.slice(b + 1)];
}

/** Ganti terjemahan potongan dengan hasil penyelarasan (sudah diverifikasi). */
export function applyAlignment(rows: Row[], i: number, seg: { id?: string[]; en?: string[] }): Row[] {
	const [a, b] = groupRange(rows, i);
	const n = b - a + 1;
	const ok = (arr: string[] | undefined, full: string) => !!arr && arr.length === n && sameText(arr.join(' '), full);
	const full = fullOf(rows[a]);
	const useId = ok(seg.id, full.id);
	const useEn = ok(seg.en, full.en);
	if (!useId && !useEn) return rows;
	return rows.map((r, k) => (k < a || k > b ? r : { ...r, id: useId ? seg.id![k - a] : r.id, en: useEn ? seg.en![k - a] : r.en, aligned: true }));
}

/** Teks Arab kelompok masih utuh (tidak ada kata hilang/berubah)? */
export function groupIntact(rows: Row[], i: number) {
	const [a, b] = groupRange(rows, i);
	return sameText(rows.slice(a, b + 1).map((r) => r.ar).join(' '), fullOf(rows[a]).ar);
}
