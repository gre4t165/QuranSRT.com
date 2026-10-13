// Sinkronisasi otomatis: mendeteksi jeda hening di audio lalu mencocokkannya
// dengan panjang teks tiap ayat. Hasilnya perkiraan — tetap perlu dicek.
import type { Row } from './project';
import { arabicWeight } from './quran';

interface Gap {
	start: number;
	end: number;
	len: number;
}

function frameRms(b: AudioBuffer, frame: number) {
	const n = Math.floor(b.duration / frame);
	const data = Array.from({ length: Math.min(2, b.numberOfChannels) }, (_, c) => b.getChannelData(c));
	const size = Math.floor(b.sampleRate * frame);
	const rms = new Float32Array(n);
	for (let i = 0; i < n; i++) {
		let sum = 0;
		const s0 = i * size;
		for (let s = s0; s < s0 + size; s += 2) {
			let v = 0;
			for (const ch of data) v += ch[s] ?? 0;
			v /= data.length;
			sum += v * v;
		}
		rms[i] = Math.sqrt(sum / (size / 2));
	}
	return rms;
}

function percentile(arr: Float32Array, p: number) {
	const s = Array.from(arr).sort((a, b) => a - b);
	return s[Math.min(s.length - 1, Math.floor(s.length * p))] ?? 0;
}

export function detectGaps(b: AudioBuffer, from = 0, to = b.duration, minGap = 0.18, sensitivity = 0.5) {
	const frame = 0.02;
	const rms = frameRms(b, frame);
	const lo = percentile(rms, 0.1);
	const hi = percentile(rms, 0.9);
	const thr = lo + (hi - lo) * (0.06 + 0.18 * sensitivity);
	const gaps: Gap[] = [];
	let runStart = -1;
	const i0 = Math.floor(from / frame);
	const i1 = Math.min(rms.length, Math.ceil(to / frame));
	for (let i = i0; i <= i1; i++) {
		const silent = i < i1 && rms[i] < thr;
		if (silent && runStart < 0) runStart = i;
		if (!silent && runStart >= 0) {
			const s = runStart * frame;
			const e = i * frame;
			if (e - s >= minGap || runStart === i0 || i === i1) gaps.push({ start: s, end: e, len: e - s });
			runStart = -1;
		}
	}
	return gaps;
}

/**
 * Mengisi waktu mulai/akhir untuk rows[iFrom..iTo] di rentang audio [from, to].
 * Mengembalikan salinan rows dengan waktu baru.
 */
export function autoSync(b: AudioBuffer, rows: Row[], iFrom: number, iTo: number, from: number, to: number, sensitivity = 0.5): Row[] {
	const target = rows.slice(iFrom, iTo + 1);
	const N = target.length;
	if (!N) return rows;
	const gaps = detectGaps(b, from, to, 0.18, sensitivity);
	// Bagian hening di awal dan akhir dibuang dari rentang bacaan.
	let speechStart = from;
	let speechEnd = to;
	if (gaps.length && gaps[0].start <= from + 0.03) speechStart = gaps.shift()!.end;
	if (gaps.length && gaps[gaps.length - 1].end >= to - 0.05) speechEnd = gaps.pop()!.start;
	const span = Math.max(0.5, speechEnd - speechStart);

	const weights = target.map((r) => arabicWeight(r.ar || r.id || r.en || 'x'));
	const wsum = weights.reduce((a, c) => a + c, 0);
	const expected: number[] = [];
	let acc = 0;
	for (let k = 0; k < N - 1; k++) {
		acc += weights[k];
		expected.push(speechStart + (span * acc) / wsum);
	}
	const avg = span / N;

	// Kandidat batas: jeda hening + posisi perkiraan (bila jeda tidak cukup).
	const cands: Gap[] = gaps.filter((g) => g.start > speechStart && g.end < speechEnd);
	for (const e of expected) cands.push({ start: e, end: e, len: 0 });
	cands.sort((a, c) => a.start - c.start);
	const M = cands.length;
	const K = N - 1;
	const bounds: Gap[] = [];
	if (K > 0) {
		const mid = cands.map((g) => (g.start + g.end) / 2);
		const cost = (k: number, j: number) => ((mid[j] - expected[k]) / avg) ** 2 * 1.0 - Math.min(cands[j].len, 1.2) * 4 + (cands[j].len === 0 ? 1.5 : 0);
		const INF = 1e18;
		let prev = new Float64Array(M).fill(INF);
		const back: Int32Array[] = [];
		for (let j = 0; j < M; j++) prev[j] = cost(0, j);
		back.push(new Int32Array(M).fill(-1));
		for (let k = 1; k < K; k++) {
			const cur = new Float64Array(M).fill(INF);
			const bk = new Int32Array(M).fill(-1);
			let best = INF;
			let bestJ = -1;
			for (let j = 0; j < M; j++) {
				if (j > 0 && prev[j - 1] < best) {
					best = prev[j - 1];
					bestJ = j - 1;
				}
				if (bestJ >= 0) {
					cur[j] = best + cost(k, j);
					bk[j] = bestJ;
				}
			}
			back.push(bk);
			prev = cur;
		}
		let j = 0;
		for (let x = 1; x < M; x++) if (prev[x] < prev[j]) j = x;
		const picked: number[] = [];
		for (let k = K - 1; k >= 0; k--) {
			picked.unshift(j);
			j = back[k][j];
		}
		for (const p of picked) bounds.push(cands[p]);
	}

	const out = rows.map((r) => ({ ...r }));
	for (let k = 0; k < N; k++) {
		const s = k === 0 ? speechStart : bounds[k - 1].end - 0.05;
		const e = k === N - 1 ? speechEnd + 0.15 : bounds[k].start + 0.15;
		out[iFrom + k].start = Math.max(from, Math.round(s * 1000) / 1000);
		out[iFrom + k].end = Math.min(to, Math.round(Math.max(e, s + 0.3) * 1000) / 1000);
	}
	// Pastikan tidak saling tumpang tindih.
	for (let k = iFrom + 1; k <= iTo; k++) if (out[k].start < out[k - 1].end) out[k - 1].end = out[k].start;
	return out;
}

/** Bagi rentang waktu secara proporsional terhadap panjang teks (tanpa analisis audio). */
export function distribute(rows: Row[], iFrom: number, iTo: number, from: number, to: number): Row[] {
	const target = rows.slice(iFrom, iTo + 1);
	const w = target.map((r) => arabicWeight(r.ar || r.id || r.en || 'x'));
	const sum = w.reduce((a, b) => a + b, 0);
	const out = rows.map((r) => ({ ...r }));
	let t = from;
	target.forEach((_, k) => {
		const d = ((to - from) * w[k]) / sum;
		out[iFrom + k].start = Math.round(t * 1000) / 1000;
		out[iFrom + k].end = Math.round((t + d) * 1000) / 1000;
		t += d;
	});
	return out;
}
