import { getSurah } from '~/data/surahs';

export interface AyahText {
	n: number;
	ar: string;
	tr: string;
	id: string;
	en: string;
}

const cache = new Map<number, Promise<AyahText[]>>();

/** Memuat teks satu surah dari /data/quran/{n}.json (di-host bersama situs, tanpa API pihak ketiga). */
export function loadSurah(n: number): Promise<AyahText[]> {
	if (!cache.has(n)) {
		const p = fetch(`/data/quran/${n}.json`)
			.then((r) => {
				if (!r.ok) throw new Error(`HTTP ${r.status}`);
				return r.json() as Promise<{ verses: AyahText[] }>;
			})
			.then((d) => {
				if (d.verses.length !== getSurah(n).verses) throw new Error('Data surah tidak lengkap');
				return d.verses;
			});
		p.catch(() => cache.delete(n));
		cache.set(n, p);
	}
	return cache.get(n)!;
}

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
export const arabicDigits = (n: number) => String(n).replace(/\d/g, (d) => AR_DIGITS[Number(d)]);

/** Penanda nomor ayat gaya mushaf, mis. ﴿٥﴾ */
export const ayahMarker = (n: number) => `﴿${arabicDigits(n)}﴾`;

/** Basmalah diambil dari Al-Fatihah ayat 1 (teks yang sama dengan sumber). */
export async function loadBasmalah(): Promise<AyahText> {
	const f = await loadSurah(1);
	return f[0];
}

/** Panjang teks Arab tanpa harakat — dipakai untuk memperkirakan durasi bacaan. */
export const arabicWeight = (s: string) => s.replace(/[ؐ-ًؚ-ٰٟۖ-ۭ\s]/g, '').length || 1;

export const SOURCES = {
	quran: 'Teks Utsmani: QuranEnc.com (Ensiklopedia Al-Qur\'an Al-Karim)',
	id: 'Terjemahan Indonesia: QuranEnc.com',
	en: 'Terjemahan Inggris: Saheeh International (QuranEnc.com)',
	tr: 'Transliterasi: Tanzil.net',
	audio: 'Audio murotal per ayat: EveryAyah.com',
};
