// Utilitas audio: decode, puncak waveform, gabung buffer, ekspor WAV, ambil audio qari.

let sharedCtx: AudioContext | null = null;
export function audioCtx(): AudioContext {
	if (!sharedCtx) sharedCtx = new AudioContext();
	if (sharedCtx.state === 'suspended') void sharedCtx.resume();
	return sharedCtx;
}

export async function decodeBlob(blob: Blob): Promise<AudioBuffer> {
	const buf = await blob.arrayBuffer();
	return await audioCtx().decodeAudioData(buf);
}

export interface Peaks {
	perSec: number;
	min: Float32Array;
	max: Float32Array;
	duration: number;
}

/** Ringkasan bentuk gelombang: nilai min/maks per 1/perSec detik. */
export function computePeaks(b: AudioBuffer, perSec = 100): Peaks {
	const n = Math.max(1, Math.ceil(b.duration * perSec));
	const min = new Float32Array(n);
	const max = new Float32Array(n);
	const chans = Array.from({ length: Math.min(2, b.numberOfChannels) }, (_, c) => b.getChannelData(c));
	const step = b.sampleRate / perSec;
	for (let i = 0; i < n; i++) {
		const s0 = Math.floor(i * step);
		const s1 = Math.min(b.length, Math.floor((i + 1) * step));
		let lo = 1;
		let hi = -1;
		for (let s = s0; s < s1; s += 2) {
			let v = 0;
			for (const ch of chans) v += ch[s];
			v /= chans.length;
			if (v < lo) lo = v;
			if (v > hi) hi = v;
		}
		min[i] = lo > hi ? 0 : lo;
		max[i] = lo > hi ? 0 : hi;
	}
	return { perSec, min, max, duration: b.duration };
}

export function concatBuffers(buffers: AudioBuffer[]): AudioBuffer {
	const ctx = audioCtx();
	const rate = buffers[0].sampleRate;
	const channels = Math.max(...buffers.map((b) => b.numberOfChannels));
	const length = buffers.reduce((s, b) => s + Math.round(b.duration * rate), 0);
	const out = ctx.createBuffer(channels, length, rate);
	for (let c = 0; c < channels; c++) {
		const data = out.getChannelData(c);
		let off = 0;
		for (const b of buffers) {
			const src = b.getChannelData(Math.min(c, b.numberOfChannels - 1));
			const len = Math.round(b.duration * rate);
			if (b.sampleRate === rate) data.set(src.subarray(0, len), off);
			else for (let i = 0; i < len; i++) data[off + i] = src[Math.min(src.length - 1, Math.floor((i * b.sampleRate) / rate))];
			off += len;
		}
	}
	return out;
}

export function bufferToWav(b: AudioBuffer): Blob {
	const ch = b.numberOfChannels;
	const rate = b.sampleRate;
	const len = b.length * ch * 2 + 44;
	const view = new DataView(new ArrayBuffer(len));
	const w = (o: number, s: string) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
	w(0, 'RIFF');
	view.setUint32(4, len - 8, true);
	w(8, 'WAVE');
	w(12, 'fmt ');
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, ch, true);
	view.setUint32(24, rate, true);
	view.setUint32(28, rate * ch * 2, true);
	view.setUint16(32, ch * 2, true);
	view.setUint16(34, 16, true);
	w(36, 'data');
	view.setUint32(40, len - 44, true);
	const data = Array.from({ length: ch }, (_, c) => b.getChannelData(c));
	let o = 44;
	for (let i = 0; i < b.length; i++) {
		for (let c = 0; c < ch; c++) {
			const s = Math.max(-1, Math.min(1, data[c][i]));
			view.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
			o += 2;
		}
	}
	return new Blob([view.buffer], { type: 'audio/wav' });
}

/** Durasi file audio jarak jauh tanpa perlu izin CORS (lewat elemen <audio>). */
export function probeDuration(url: string, timeoutMs = 20000): Promise<number> {
	return new Promise((resolve, reject) => {
		const a = new Audio();
		a.preload = 'metadata';
		const done = (fn: () => void) => {
			clearTimeout(timer);
			a.removeAttribute('src');
			a.load();
			fn();
		};
		const timer = setTimeout(() => done(() => reject(new Error('timeout'))), timeoutMs);
		a.onloadedmetadata = () => {
			const d = a.duration;
			done(() => (Number.isFinite(d) && d > 0 ? resolve(d) : reject(new Error('durasi tidak terbaca'))));
		};
		a.onerror = () => done(() => reject(new Error('gagal memuat ' + url)));
		a.src = url;
	});
}

/** Menjalankan tugas async dengan batas paralel. */
export async function pool<T, R>(items: T[], limit: number, fn: (x: T, i: number) => Promise<R>, onProgress?: (done: number) => void): Promise<R[]> {
	const out = new Array<R>(items.length);
	let next = 0;
	let done = 0;
	const worker = async () => {
		while (next < items.length) {
			const i = next++;
			out[i] = await fn(items[i], i);
			onProgress?.(++done);
		}
	};
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
	return out;
}

export interface QariResult {
	durations: number[];
	/** Tersedia bila audio boleh diunduh (CORS). Memungkinkan waveform, unduh audio, dan ekspor video. */
	buffer?: AudioBuffer;
	urls: string[];
}

/**
 * Ambil audio per ayat. Cara utama: unduh + decode lalu gabungkan (akurat, ada waveform).
 * Bila server audio menolak unduhan lintas domain, beralih ke mode playlist: durasi dibaca
 * dari metadata dan audio diputar berurutan.
 */
export async function fetchQari(urls: string[], onProgress: (done: number, total: number) => void): Promise<QariResult> {
	const total = urls.length;
	try {
		const ctx = audioCtx();
		const buffers = await pool(urls, 4, async (u) => {
			const r = await fetch(u, { mode: 'cors' });
			if (!r.ok) throw new Error(`HTTP ${r.status}`);
			return await ctx.decodeAudioData(await r.arrayBuffer());
		}, (d) => onProgress(d, total));
		return { durations: buffers.map((b) => b.duration), buffer: concatBuffers(buffers), urls };
	} catch {
		onProgress(0, total);
		const durations = await pool(urls, 6, (u) => probeDuration(u), (d) => onProgress(d, total));
		return { durations, urls };
	}
}
