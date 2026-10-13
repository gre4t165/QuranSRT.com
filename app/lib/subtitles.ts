import { getSurah } from '~/data/surahs';
import type { ContentSettings, ExportSettings, Row, StyleSettings } from './project';
import { ayahMarker, SOURCES } from './quran';
import { stampAss, stampChapter, stampSrt, stampVtt } from './time';
import { evenFractions, fractionsOf, splitByFractions } from './segment';
import { fullOf, isLastPart } from './parts';

export type LineKind = 'ar' | 'translit' | 'trans' | 'label';
export interface CueLine {
	kind: LineKind;
	text: string;
}
export interface Cue {
	start: number;
	end: number;
	row: number;
	lines: CueLine[];
}

const RLM = '‏';

function transOf(r: Row, c: ContentSettings) {
	return c.translation === 'none' ? '' : (c.translation === 'en' ? r.en : r.id).trim();
}

function labelOf(r: Row, c: ContentSettings) {
	if (!c.surahLabel || r.kind !== 'ayah' || !r.surah) return '';
	const s = getSurah(r.surah);
	return c.translation === 'en' ? `(Quran ${s.latin} ${r.surah}:${r.ayah})` : `(QS. ${s.latin} [${r.surah}]: ${r.ayah})`;
}

/** Baris-baris teks untuk satu ayat sesuai pengaturan konten. */
export function rowLines(r: Row, c: ContentSettings, last = true): CueLine[] {
	const marker = last && c.verseNumber && r.kind === 'ayah' && r.ayah;
	const ar = c.arabic && r.ar.trim() ? r.ar.trim() + (marker ? ' ' + ayahMarker(r.ayah!) : '') : '';
	let trans = transOf(r, c);
	if (trans && marker && !c.arabic) trans = `${trans} (${r.ayah})`;
	const tl = c.translit && r.tr.trim() ? r.tr.trim() : '';
	const label = last ? labelOf(r, c) : '';
	const arBlock: CueLine[] = [];
	if (ar) arBlock.push({ kind: 'ar', text: ar });
	if (tl) arBlock.push({ kind: 'translit', text: tl });
	const trBlock: CueLine[] = trans ? [{ kind: 'trans', text: trans }] : [];
	const lines = c.arabicFirst ? [...arBlock, ...trBlock] : [...trBlock, ...arBlock];
	if (label) lines.push({ kind: 'label', text: label });
	return lines;
}

/** Uji apakah sekumpulan baris teks muat di layar dengan ukuran yang masih terbaca. */
export type FitTest = (lines: CueLine[]) => boolean;

/** Pecah baris-baris satu cue menjadi p bagian: Arab di tanda waqaf, lainnya mengikuti proporsi Arab. */
function splitLines(lines: CueLine[], p: number): { lines: CueLine[]; weight: number }[] {
	const ar = lines.find((l) => l.kind === 'ar');
	const lead = ar ?? lines.find((l) => l.kind === 'trans') ?? lines[0];
	const leadParts = splitByFractions(lead.text, evenFractions(p), lead.kind === 'ar' ? 'ar' : 'latin');
	const fr = fractionsOf(leadParts);
	const split = lines.map((l) => (l === lead ? leadParts : l.kind === 'label' ? [] : splitByFractions(l.text, fr, 'latin')));
	return fr.map((w, j) => ({
		weight: w,
		lines: lines.flatMap((l, li) => (l.kind === 'label' ? (j === p - 1 ? [l] : []) : split[li][j] ? [{ kind: l.kind, text: split[li][j] }] : [])),
	}));
}

/**
 * Menyusun daftar cue akhir. Ayat yang tidak muat di layar (fit) atau melebihi batas
 * karakter (splitLong) dipecah di titik yang wajar, dengan waktu dibagi proporsional.
 */
export function buildCues(rows: Row[], c: ContentSettings, e: ExportSettings, fit?: FitTest): Cue[] {
	const sorted = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.end > r.start);
	const cues: Cue[] = [];
	for (let k = 0; k < sorted.length; k++) {
		const { r, i } = sorted[k];
		let end = r.end;
		const nxt = sorted[k + 1]?.r;
		if (e.closeGaps && nxt && nxt.start > end && nxt.start - end <= e.maxGap) end = nxt.start;
		const lines = rowLines(r, c, isLastPart(rows, i));
		if (!lines.length) continue;
		const primary = lines.find((l) => l.kind === 'trans') ?? lines.find((l) => l.kind === 'ar') ?? lines[0];
		let p = e.splitLong ? Math.max(1, Math.ceil(primary.text.length / Math.max(20, e.maxChars))) : 1;
		let pieces = p > 1 ? splitLines(lines, p) : [{ lines, weight: 1 }];
		if (fit && e.autoFit) {
			const words = Math.max(...lines.map((l) => l.text.split(/\s+/).length));
			while (p < Math.min(12, words) && !pieces.every((x) => fit(x.lines))) {
				p++;
				pieces = splitLines(lines, p);
			}
		}
		let t = r.start;
		pieces.forEach((x, j) => {
			const d = (end - r.start) * x.weight;
			cues.push({ start: t, end: j === pieces.length - 1 ? end : t + d, row: i, lines: x.lines });
			t += d;
		});
	}
	return cues;
}

const lineText = (l: CueLine, rtl: boolean) => (l.kind === 'ar' && rtl ? RLM + l.text + RLM : l.text);

export function toSRT(cues: Cue[], e: ExportSettings) {
	return cues.map((q, i) => `${i + 1}\n${stampSrt(q.start)} --> ${stampSrt(q.end)}\n${q.lines.map((l) => lineText(l, e.rtlMark)).join('\n')}`).join('\n\n') + '\n';
}

export function toVTT(cues: Cue[], e: ExportSettings, title = '') {
	return `WEBVTT${title ? ' - ' + title : ''}\n\n` + cues.map((q, i) => `${i + 1}\n${stampVtt(q.start)} --> ${stampVtt(q.end)}\n${q.lines.map((l) => lineText(l, e.rtlMark)).join('\n')}`).join('\n\n') + '\n';
}

function assColor(hex: string, alpha = 0) {
	const h = hex.replace('#', '').padEnd(6, '0');
	const a = Math.round(alpha * 255).toString(16).padStart(2, '0').toUpperCase();
	return `&H${a}${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}`.toUpperCase();
}

export function toASS(cues: Cue[], s: StyleSettings, title = '') {
	const [W, H] = s.ratio === '9:16' ? [1080, 1920] : s.ratio === '1:1' ? [1080, 1080] : [1920, 1080];
	const scale = Math.min(W, H) / 1080;
	const align = s.position === 'top' ? 8 : s.position === 'center' ? 5 : 2;
	const box = s.box ? 3 : 1;
	const back = assColor('#000000', 1 - s.boxOpacity);
	const style = (name: string, font: string, size: number, color: string) =>
		`Style: ${name},${font},${Math.round(size * scale)},${assColor(color)},${assColor(color)},${assColor(s.outline > 0 ? s.outlineColor || '#000000' : '#000000')},${back},0,0,0,0,100,100,0,0,${box},${s.outline > 0 ? s.outline : s.shadow ? 2 : 0},${s.shadow ? 1 : 0},${align},60,60,${Math.round(70 * scale)},1`;
	const head = `[Script Info]
; Dibuat dengan Quran SRT Studio
Title: ${title || 'Quran SRT Studio'}
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: ${W}
PlayResY: ${H}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
${style('Quran', s.arabicFont, s.arabicSize, s.textColor)}
${style('Terjemah', 'Plus Jakarta Sans', s.transSize, s.transColor)}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
	const tSize = Math.round(s.transSize * scale);
	const body = cues
		.map((q) => {
			const text = q.lines
				.map((l) => (l.kind === 'ar' ? l.text : `{\\fnPlus Jakarta Sans\\fs${l.kind === 'trans' ? tSize : Math.round(tSize * 0.8)}\\c${assColor(l.kind === 'trans' ? s.transColor : s.accent)}}${l.text}{\\r}`))
				.join('\\N');
			return `Dialogue: 0,${stampAss(q.start)},${stampAss(q.end)},Quran,,0,0,0,,${text}`;
		})
		.join('\n');
	return head + body + '\n';
}

/** Teks deskripsi YouTube: bab (chapters), teks ayat, dan sumber. */
export function toDescription(rows: Row[], c: ContentSettings, info: { surah: number; reciter?: string; lang: 'id' | 'en' }) {
	const s = getSurah(info.surah);
	const en = info.lang === 'en';
	// Potongan ayat dihitung sekali (pakai potongan pertama + teks utuhnya).
	rows = rows.filter((r, i) => !r.group || rows[i - 1]?.group !== r.group).map((r) => (r.group ? { ...r, ...fullOf(r) } : r));
	const ayat = rows.filter((r) => r.kind === 'ayah');
	const first = ayat[0]?.ayah ?? 1;
	const last = ayat.at(-1)?.ayah ?? first;
	const out: string[] = [];
	out.push(`${en ? 'Surah' : 'Surah'} ${s.latin} (${s.name}) — ${en ? s.meaningEn : s.meaningId}, ${en ? 'verses' : 'ayat'} ${first}${last !== first ? '–' + last : ''}`);
	if (info.reciter) out.push(`${en ? 'Reciter' : 'Qari'}: ${info.reciter}`);
	out.push('');
	const timed = rows.filter((r) => r.end > r.start).sort((x, y) => x.start - y.start);
	if (timed.length) {
		// Bab YouTube: mulai 0:00, berurutan, dan tiap bab minimal 10 detik — ayat pendek digabung.
		type Ch = { start: number; a?: number; b?: number; label?: string };
		const chapters: Ch[] = [];
		if (timed[0].start >= 10) chapters.push({ start: 0, label: en ? 'Intro' : 'Pembuka' });
		const labelOf = (c: Ch) => (c.label ? c.label : c.a !== undefined ? `${en ? 'Verse' : 'Ayat'} ${c.a}${c.b !== undefined && c.b !== c.a ? '–' + c.b : ''}` : en ? 'Intro' : 'Pembuka');
		for (const r of timed) {
			const cur = chapters[chapters.length - 1];
			const start = chapters.length ? r.start : 0;
			if (cur && r.start - cur.start < 10) {
				if (r.kind === 'ayah') {
					if (cur.a === undefined) cur.a = r.ayah;
					cur.b = r.ayah;
					if (cur.label === 'Basmalah') cur.label = undefined;
				}
				continue;
			}
			chapters.push(r.kind === 'ayah' ? { start, a: r.ayah, b: r.ayah } : { start, label: r.kind === 'basmalah' ? 'Basmalah' : (r.id || r.en || (en ? 'Text' : 'Teks')).slice(0, 40) });
		}
		out.push(en ? 'Chapters:' : 'Daftar waktu (chapters):');
		for (const c of chapters) out.push(`${stampChapter(c.start)} ${labelOf(c)}`);
		out.push('');
	}
	out.push(en ? 'Text & translation:' : 'Teks & terjemahan:');
	for (const r of rows) {
		if (r.kind === 'custom') continue;
		out.push('');
		out.push(r.kind === 'basmalah' ? r.ar : `${r.ar} ${ayahMarker(r.ayah ?? 0)}`);
		if (c.translit && r.tr) out.push(r.tr);
		const t = c.translation === 'en' ? r.en : c.translation === 'id' ? r.id : en ? r.en : r.id;
		out.push(r.kind === 'basmalah' ? t : `${r.ayah}. ${t}`);
	}
	out.push('');
	out.push(en ? 'Sources:' : 'Sumber:');
	out.push(`- ${SOURCES.quran}`);
	out.push(`- ${c.translation === 'en' ? SOURCES.en : SOURCES.id}`);
	if (c.translit) out.push(`- ${SOURCES.tr}`);
	out.push('');
	out.push(en ? 'Subtitles made with Quran SRT Studio.' : 'Subtitle dibuat dengan Quran SRT Studio.');
	return out.join('\n');
}

export interface RowIssue {
	level: 'error' | 'warn';
	msg: string;
}

/** Pemeriksaan waktu sebelum ekspor. */
export function validateRows(rows: Row[], duration: number, lang: 'id' | 'en'): Map<number, RowIssue[]> {
	const t = (id: string, en: string) => (lang === 'en' ? en : id);
	const map = new Map<number, RowIssue[]>();
	const add = (i: number, x: RowIssue) => map.set(i, [...(map.get(i) ?? []), x]);
	rows.forEach((r, i) => {
		if (!Number.isFinite(r.start) || !Number.isFinite(r.end) || r.start < 0) add(i, { level: 'error', msg: t('Waktu tidak valid', 'Invalid time') });
		else if (r.end <= r.start) add(i, { level: 'error', msg: t('Waktu akhir harus setelah waktu mulai', 'End must be after start') });
		if (i > 0 && r.start < rows[i - 1].end - 0.001) add(i, { level: 'error', msg: t('Tumpang tindih dengan baris sebelumnya', 'Overlaps the previous row') });
		if (duration > 0 && r.start > duration + 0.05) add(i, { level: 'warn', msg: t('Melewati durasi audio', 'Beyond audio length') });
		if (r.end - r.start > 0 && r.end - r.start < 0.6) add(i, { level: 'warn', msg: t('Terlalu singkat untuk dibaca', 'Too short to read') });
		if (r.kind === 'custom' && !r.ar.trim() && !r.id.trim() && !r.en.trim()) add(i, { level: 'warn', msg: t('Teks kosong', 'Empty text') });
	});
	return map;
}

export function fileBase(surah: number, rows: Row[], lang: string) {
	const s = getSurah(surah);
	const ayat = rows.filter((r) => r.kind === 'ayah' && r.ayah);
	const a = ayat[0]?.ayah;
	const b = ayat.at(-1)?.ayah;
	const range = a ? `_${a}${b && b !== a ? '-' + b : ''}` : '';
	return `${s.latin.replace(/[^A-Za-z0-9-]+/g, '-')}${range}_${lang}`;
}
