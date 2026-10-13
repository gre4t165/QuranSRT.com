// Pemecah ayat panjang. Titik potong teks Arab mengutamakan tanda waqaf
// (ۘ ۗ ۖ ۚ), sedangkan terjemahan & transliterasi mengikuti proporsi potongan Arab
// dengan mengutamakan tanda baca. Teks tidak pernah diubah: potongan selalu
// berupa irisan kata utuh, sehingga gabungannya (dengan satu spasi) = teks asli.

export type SegKind = 'ar' | 'latin';

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
export const sameText = (a: string, b: string) => norm(a) === norm(b);

/** Biaya memotong SETELAH kata ini (makin kecil makin baik). */
function boundaryCost(word: string, kind: SegKind): number {
	if (kind === 'ar') {
		// Tanda waqaf berupa huruf kecil di atas yang menempel di akhir kata.
		if (word.includes('ۘ')) return 0.02; // ۘ  waqaf lazim (harus berhenti)
		if (word.includes('ۗ')) return 0.08; // ۗ  qala: lebih utama berhenti
		if (word.includes('ۚ')) return 0.12; // ۚ  jaiz
		if (word.includes('ۖ')) return 0.2; // ۖ  sala: lebih utama lanjut
		if (word.includes('ۛ')) return 0.45; // ۛ  mu'anaqah
		if (word.includes('ۙ')) return 3; // ۙ  la: jangan berhenti
		return 1;
	}
	if (/[.!?…]["'”’)]*$/.test(word)) return 0.06;
	if (/[;:]["'”’)]*$/.test(word)) return 0.12;
	if (/[,—–]["'”’)]*$/.test(word) || /^[—–-]$/.test(word)) return 0.3;
	return 1;
}

/**
 * Bagi `text` menjadi `fractions.length` potongan kata utuh. `fractions` = target
 * proporsi panjang tiap potongan (jumlahnya 1). Memakai program dinamis yang
 * menyeimbangkan kedekatan ke target dan kualitas titik potong.
 */
export function splitByFractions(text: string, fractions: number[], kind: SegKind): string[] {
	const words = norm(text).split(' ').filter(Boolean);
	const p = fractions.length;
	if (p <= 1 || !words.length) return [norm(text)];
	if (words.length <= p) {
		// Kata lebih sedikit dari jumlah potongan: satu kata per potongan, sisanya kosong.
		return Array.from({ length: p }, (_, i) => words[i] ?? '');
	}
	const len = words.map((w) => w.length + 1);
	const pre = [0];
	for (const l of len) pre.push(pre[pre.length - 1] + l);
	const total = pre[pre.length - 1];
	const targets: number[] = [];
	let acc = 0;
	for (const f of fractions) {
		acc += f;
		targets.push(acc * total);
	}
	const n = words.length;
	const INF = 1e18;
	// dp[k][j] = biaya terbaik untuk k potongan pertama yang berakhir setelah kata j-1
	const dp: number[][] = Array.from({ length: p + 1 }, () => new Array(n + 1).fill(INF));
	const back: number[][] = Array.from({ length: p + 1 }, () => new Array(n + 1).fill(-1));
	dp[0][0] = 0;
	const lambda = 0.55;
	for (let k = 1; k <= p; k++) {
		const target = (fractions[k - 1] || 1 / p) * total;
		for (let j = k; j <= n - (p - k); j++) {
			const cut = k === p ? 0 : boundaryCost(words[j - 1], kind) * lambda;
			if (k === p && j !== n) continue;
			for (let i = k - 1; i < j; i++) {
				if (dp[k - 1][i] >= INF) continue;
				const segLen = pre[j] - pre[i];
				const dev = (segLen - target) / Math.max(1, target);
				// posisi kumulatif juga dijaga supaya potongan tidak bergeser jauh
				const drift = k < p ? (pre[j] - targets[k - 1]) / total : 0;
				const c = dp[k - 1][i] + dev * dev + drift * drift * 2 + cut;
				if (c < dp[k][j]) {
					dp[k][j] = c;
					back[k][j] = i;
				}
			}
		}
	}
	const cuts: number[] = [];
	let j = n;
	for (let k = p; k > 0; k--) {
		cuts.unshift(j);
		j = back[k][j];
		if (j < 0) return equalWords(words, p);
	}
	const out: string[] = [];
	let s = 0;
	for (const c of cuts) {
		out.push(words.slice(s, c).join(' '));
		s = c;
	}
	return out;
}

function equalWords(words: string[], p: number) {
	const out: string[] = [];
	const per = Math.ceil(words.length / p);
	for (let i = 0; i < p; i++) out.push(words.slice(i * per, (i + 1) * per).join(' '));
	return out;
}

export const evenFractions = (p: number) => Array.from({ length: p }, () => 1 / p);

/** Proporsi panjang tiap potongan (untuk menyelaraskan terjemahan & membagi waktu). */
export function fractionsOf(parts: string[]): number[] {
	const l = parts.map((x) => Math.max(1, x.length));
	const s = l.reduce((a, b) => a + b, 0);
	return l.map((x) => x / s);
}

/** Pecah teks Arab menjadi p bagian, mengutamakan tanda waqaf. */
export const splitArabic = (ar: string, p: number) => splitByFractions(ar, evenFractions(p), 'ar');

/** Pecah teks Arab tepat setelah kata ke-k (0-based) untuk potongan manual. */
export function splitArabicAt(ar: string, wordIndex: number): [string, string] {
	const w = norm(ar).split(' ');
	return [w.slice(0, wordIndex + 1).join(' '), w.slice(wordIndex + 1).join(' ')];
}

export const arabicWords = (ar: string) => norm(ar).split(' ').filter(Boolean);
