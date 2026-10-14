import { getSurah } from '~/data/surahs';
import type { AyahText } from './quran';

export type RowKind = 'ayah' | 'basmalah' | 'custom';

export interface Row {
	key: string;
	kind: RowKind;
	surah?: number;
	ayah?: number;
	ar: string;
	tr: string;
	id: string;
	en: string;
	start: number;
	end: number;
	/** Potongan ayat (mid-verse cut): baris-baris dengan `group` sama adalah satu ayat. */
	group?: string;
	/** Teks utuh ayat sebelum dipotong — untuk verifikasi & menggabungkan kembali. */
	full?: { ar: string; tr: string; id: string; en: string };
	/** Terjemahan potongan ini sudah dirapikan Claude (dan lolos verifikasi). */
	aligned?: boolean;
}

export type Ratio = '16:9' | '9:16' | '1:1';
export type TransLang = 'id' | 'en' | 'none';

export interface ContentSettings {
	arabic: boolean;
	translation: TransLang;
	translit: boolean;
	arabicFirst: boolean;
	verseNumber: boolean;
	surahLabel: boolean;
}

export interface ExportSettings {
	splitLong: boolean;
	maxChars: number;
	closeGaps: boolean;
	maxGap: number;
	rtlMark: boolean;
	/** Pecah otomatis ayat yang tidak muat di layar dengan ukuran huruf yang masih terbaca. */
	autoFit: boolean;
}

export type LayerId = 'ar' | 'trans' | 'translit' | 'label' | 'header';
/** Penyesuaian satu lapisan teks: geser (pecahan lebar/tinggi layar), skala, warna, sembunyikan. */
export interface LayerCfg {
	dx?: number;
	dy?: number;
	scale?: number;
	color?: string;
	hidden?: boolean;
}
export const LAYER_IDS: LayerId[] = ['ar', 'translit', 'trans', 'label', 'header'];

export interface StyleSettings {
	template: string;
	ratio: Ratio;
	arabicFont: string;
	arabicSize: number;
	transSize: number;
	textColor: string;
	transColor: string;
	accent: string;
	shadow: boolean;
	box: boolean;
	boxOpacity: number;
	position: 'top' | 'center' | 'bottom';
	bgType: 'solid' | 'gradient' | 'image' | 'video';
	bg1: string;
	bg2: string;
	ornament: boolean;
	header: boolean;
	fade: boolean;
	/** Ketebalan garis tepi teks (0 = mati). */
	outline: number;
	outlineColor: string;
	/** Tampilkan nama qari di bawah nama surah. */
	reciterName: boolean;
	/** Teks branding kreator, mis. @namakanal (kosong = tidak tampil). */
	brand: string;
	/** Kustomisasi per lapisan (hasil geser/ubah ukuran langsung di pratinjau). */
	layers?: Partial<Record<LayerId, LayerCfg>>;
}

export interface Project {
	version: 2;
	id: string;
	name: string;
	surah: number;
	from: number;
	to: number;
	basmalah: boolean;
	/** Sisipkan baris ta'awudz di awal. */
	taawudz?: boolean;
	reciter: string;
	rows: Row[];
	content: ContentSettings;
	exp: ExportSettings;
	style: StyleSettings;
	audioName?: string;
	createdAt: number;
	updatedAt: number;
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const ARABIC_FONTS = [
	{ id: 'Amiri Quran', label: 'Amiri Quran (mushaf)' },
	{ id: 'Scheherazade New', label: 'Scheherazade New' },
	{ id: 'Noto Naskh Arabic', label: 'Noto Naskh Arabic' },
	{ id: 'Reem Kufi', label: 'Reem Kufi (kufi modern)' },
];

export const DEFAULT_CONTENT: ContentSettings = {
	arabic: true,
	translation: 'id',
	translit: false,
	arabicFirst: true,
	verseNumber: true,
	surahLabel: false,
};

export const DEFAULT_EXPORT: ExportSettings = {
	splitLong: false,
	maxChars: 90,
	closeGaps: true,
	maxGap: 1.2,
	rtlMark: false,
	autoFit: true,
};

export interface Template {
	id: string;
	name: string;
	style: Partial<StyleSettings>;
}

export const TEMPLATES: Template[] = [
	{ id: 'mushaf', name: 'Mushaf hijau', style: { bgType: 'gradient', bg1: '#0E3B33', bg2: '#06201B', textColor: '#F6F2E4', transColor: '#CFE2DA', accent: '#C9A04A', box: false, shadow: true, ornament: true, header: true, arabicFont: 'Amiri Quran', position: 'center' } },
	{ id: 'malam', name: 'Langit malam', style: { bgType: 'gradient', bg1: '#141B3A', bg2: '#05070F', textColor: '#FFFFFF', transColor: '#C9D1F2', accent: '#E3C27A', box: false, shadow: true, ornament: true, header: true, arabicFont: 'Amiri Quran', position: 'center' } },
	{ id: 'kertas', name: 'Kertas terang', style: { bgType: 'solid', bg1: '#F4F1E6', bg2: '#E8E2CF', textColor: '#1D2A26', transColor: '#4C5B55', accent: '#8A6A1F', box: false, shadow: false, ornament: true, header: true, arabicFont: 'Scheherazade New', position: 'center' } },
	{ id: 'overlay', name: 'Overlay video', style: { bgType: 'solid', bg1: '#000000', bg2: '#000000', textColor: '#FFFFFF', transColor: '#F1F1F1', accent: '#FFD166', box: true, boxOpacity: 0.55, shadow: true, ornament: false, header: false, arabicFont: 'Noto Naskh Arabic', position: 'bottom' } },
	{ id: 'shorts', name: 'Shorts tebal', style: { ratio: '9:16', bgType: 'gradient', bg1: '#1F2937', bg2: '#030712', textColor: '#FFFFFF', transColor: '#FDE68A', accent: '#FBBF24', box: false, shadow: true, ornament: false, header: true, arabicFont: 'Noto Naskh Arabic', position: 'center', arabicSize: 96, transSize: 46 } },
	{ id: 'emas', name: 'Emas & arang', style: { bgType: 'gradient', bg1: '#2A2622', bg2: '#0F0D0B', textColor: '#F3D58B', transColor: '#E8E2D2', accent: '#D4A64A', box: false, shadow: true, ornament: true, header: true, arabicFont: 'Amiri Quran', position: 'center' } },
	{ id: 'kufi', name: 'Kufi minimalis', style: { bgType: 'solid', bg1: '#0F172A', bg2: '#0F172A', textColor: '#E2E8F0', transColor: '#94A3B8', accent: '#38BDF8', box: false, shadow: false, ornament: false, header: true, arabicFont: 'Reem Kufi', position: 'center' } },
	{ id: 'layar-masjid', name: 'Layar masjid', style: { ratio: '16:9', bgType: 'solid', bg1: '#062A24', bg2: '#062A24', textColor: '#FFFFFF', transColor: '#FFE9A8', accent: '#FFE9A8', box: false, shadow: false, ornament: true, header: true, arabicFont: 'Amiri Quran', position: 'center', arabicSize: 76, transSize: 40 } },
];

export const DEFAULT_STYLE: StyleSettings = {
	template: 'mushaf',
	ratio: '16:9',
	arabicFont: 'Amiri Quran',
	arabicSize: 64,
	transSize: 34,
	textColor: '#F6F2E4',
	transColor: '#CFE2DA',
	accent: '#C9A04A',
	shadow: true,
	box: false,
	boxOpacity: 0.45,
	position: 'center',
	bgType: 'gradient',
	bg1: '#0E3B33',
	bg2: '#06201B',
	ornament: true,
	header: true,
	fade: true,
	outline: 0,
	outlineColor: '#000000',
	reciterName: false,
	brand: '',
};

export function rowsFromAyat(surah: number, ayat: AyahText[], from: number, to: number, basmalah: AyahText | null, durations?: number[]): Row[] {
	const rows: Row[] = [];
	let t = 0;
	let di = 0;
	const next = (fallback: number) => {
		const d = durations?.[di++] ?? fallback;
		const r = { start: t, end: t + d };
		t += d;
		return r;
	};
	if (basmalah) {
		rows.push({ key: uid(), kind: 'basmalah', ar: basmalah.ar, tr: basmalah.tr, id: basmalah.id, en: basmalah.en, ...next(4) });
	}
	for (const a of ayat.slice(from - 1, to)) {
		const est = Math.min(30, Math.max(3, a.ar.length / 9));
		rows.push({ key: uid(), kind: 'ayah', surah, ayah: a.n, ar: a.ar, tr: a.tr, id: a.id, en: a.en, ...next(Math.round(est * 10) / 10) });
	}
	return rows;
}

/** Ta'awudz (isti'adzah) — bukan ayat Al-Qur'an, dimasukkan sebagai teks bebas. */
export const TAAWUDZ = {
	ar: 'أَعُوذُ بِاللَّهِ مِنَ الشَّيْطَانِ الرَّجِيمِ',
	tr: "A'ūżu billāhi minasy-syaiṭānir-rajīm",
	id: 'Aku berlindung kepada Allah dari setan yang terkutuk.',
	en: 'I seek refuge in Allah from the accursed Satan.',
};

export const taawudzRow = (start = 0): Row => ({ key: uid(), kind: 'custom', ...TAAWUDZ, start, end: start + 4 });

export const shouldOfferBasmalah = (surah: number, from: number) => surah !== 1 && surah !== 9 && from === 1;

export function newProject(partial: Partial<Project> = {}): Project {
	const now = Date.now();
	return {
		version: 2,
		id: uid(),
		name: '',
		surah: 1,
		from: 1,
		to: 7,
		basmalah: false,
		reciter: 'alafasy',
		rows: [],
		content: { ...DEFAULT_CONTENT },
		exp: { ...DEFAULT_EXPORT },
		style: { ...DEFAULT_STYLE },
		createdAt: now,
		updatedAt: now,
		...partial,
	};
}

export function projectTitle(p: Pick<Project, 'name' | 'surah' | 'from' | 'to'>) {
	if (p.name.trim()) return p.name.trim();
	const s = getSurah(p.surah);
	return `${s.latin} ${p.from}${p.to !== p.from ? `–${p.to}` : ''}`;
}

/** Validasi & normalisasi proyek hasil impor (file .json atau cloud). */
export function normalizeProject(raw: unknown): Project {
	const r = (raw ?? {}) as Partial<Project> & { verses?: unknown };
	if (!Array.isArray(r.rows)) throw new Error('Bukan file proyek Quran SRT Studio');
	const rows: Row[] = r.rows
		.filter((x): x is Row => !!x && typeof x === 'object')
		.map((x) => ({
			key: typeof x.key === 'string' ? x.key : uid(),
			kind: x.kind === 'basmalah' || x.kind === 'custom' ? x.kind : 'ayah',
			surah: typeof x.surah === 'number' ? x.surah : undefined,
			ayah: typeof x.ayah === 'number' ? x.ayah : undefined,
			ar: String(x.ar ?? ''),
			tr: String(x.tr ?? ''),
			id: String(x.id ?? ''),
			en: String(x.en ?? ''),
			start: Number(x.start) || 0,
			end: Number(x.end) || 0,
			...(typeof x.group === 'string' && x.group ? { group: x.group } : {}),
			...(x.full && typeof x.full === 'object' ? { full: { ar: String(x.full.ar ?? ''), tr: String(x.full.tr ?? ''), id: String(x.full.id ?? ''), en: String(x.full.en ?? '') } } : {}),
			...(x.aligned ? { aligned: true } : {}),
		}));
	const base = newProject();
	return {
		...base,
		...r,
		version: 2,
		id: typeof r.id === 'string' && r.id ? r.id : base.id,
		name: String(r.name ?? ''),
		rows,
		content: { ...DEFAULT_CONTENT, ...(r.content ?? {}) },
		exp: { ...DEFAULT_EXPORT, ...(r.exp ?? {}) },
		style: { ...DEFAULT_STYLE, ...(r.style ?? {}), layers: cleanLayers((r.style as StyleSettings | undefined)?.layers) },
	};
}

function cleanLayers(raw: unknown): StyleSettings['layers'] {
	const out: NonNullable<StyleSettings['layers']> = {};
	if (!raw || typeof raw !== 'object') return out;
	const num = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && isFinite(v) ? Math.max(lo, Math.min(hi, v)) : undefined);
	for (const id of LAYER_IDS) {
		const c = (raw as Record<string, LayerCfg>)[id];
		if (!c || typeof c !== 'object') continue;
		const v: LayerCfg = {};
		const dx = num(c.dx, -1, 1), dy = num(c.dy, -1, 1), sc = num(c.scale, 0.3, 3);
		if (dx !== undefined) v.dx = dx;
		if (dy !== undefined) v.dy = dy;
		if (sc !== undefined) v.scale = sc;
		if (typeof c.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(c.color)) v.color = c.color;
		if (c.hidden === true) v.hidden = true;
		out[id] = v;
	}
	return out;
}
