// Ekspor video langsung di browser: canvas + audio → MediaRecorder (MP4 bila didukung, kalau tidak WebM).
import { audioCtx } from './audio';

export function pickMime(): { mime: string; ext: 'mp4' | 'webm' } | null {
	if (typeof MediaRecorder === 'undefined') return null;
	const list: [string, 'mp4' | 'webm'][] = [
		['video/mp4;codecs=avc1.42E01F,mp4a.40.2', 'mp4'],
		['video/mp4;codecs=avc1.4D401F,mp4a.40.2', 'mp4'],
		['video/mp4;codecs=avc1,mp4a', 'mp4'],
		['video/webm;codecs=vp9,opus', 'webm'],
		['video/webm;codecs=vp8,opus', 'webm'],
		['video/webm', 'webm'],
		['video/mp4', 'mp4'],
	];
	for (const [m, ext] of list) if (MediaRecorder.isTypeSupported(m)) return { mime: m, ext };
	return null;
}

export interface RenderOptions {
	buffer: AudioBuffer;
	from: number;
	to: number;
	width: number;
	height: number;
	fps?: number;
	bitrate?: number;
	draw: (ctx: CanvasRenderingContext2D, t: number) => void;
	bgVideo?: HTMLVideoElement | null;
	/** true bila video latar adalah klip pendek yang diulang */
	bgLoop?: boolean;
	onProgress: (p: number) => void;
	signal: AbortSignal;
	monitor?: boolean;
}

export async function renderVideo(o: RenderOptions): Promise<{ blob: Blob; ext: string }> {
	const picked = pickMime();
	if (!picked) throw new Error('Browser ini belum mendukung perekaman video. Gunakan Chrome atau Edge versi terbaru.');
	const canvas = document.createElement('canvas');
	canvas.width = o.width;
	canvas.height = o.height;
	const ctx = canvas.getContext('2d')!;
	const fps = o.fps ?? 30;
	o.draw(ctx, o.from);
	const stream = canvas.captureStream(fps);
	const actx = audioCtx();
	await actx.resume();
	const dest = actx.createMediaStreamDestination();
	const src = actx.createBufferSource();
	src.buffer = o.buffer;
	src.connect(dest);
	let gain: GainNode | null = null;
	if (o.monitor) {
		gain = actx.createGain();
		gain.gain.value = 0.6;
		src.connect(gain).connect(actx.destination);
	}
	stream.addTrack(dest.stream.getAudioTracks()[0]);
	const rec = new MediaRecorder(stream, { mimeType: picked.mime, videoBitsPerSecond: o.bitrate ?? 8_000_000, audioBitsPerSecond: 192_000 });
	const chunks: Blob[] = [];
	rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
	const stopped = new Promise<void>((r) => (rec.onstop = () => r()));

	const bgWant = (t: number) => (o.bgLoop && o.bgVideo?.duration ? t % o.bgVideo.duration : t);
	const wasMuted = o.bgVideo?.muted ?? false;
	if (o.bgVideo) {
		o.bgVideo.muted = true;
		o.bgVideo.loop = !!o.bgLoop;
		o.bgVideo.currentTime = bgWant(o.from);
		await o.bgVideo.play().catch(() => undefined);
	}
	rec.start(500);
	const t0 = actx.currentTime + 0.05;
	src.start(t0, o.from, o.to - o.from);
	const len = o.to - o.from;

	await new Promise<void>((resolve, reject) => {
		const tick = () => {
			if (o.signal.aborted) {
				reject(new DOMException('Dibatalkan', 'AbortError'));
				return;
			}
			const el = Math.max(0, actx.currentTime - t0);
			const t = o.from + el;
			if (o.bgVideo && Math.abs(o.bgVideo.currentTime - bgWant(t)) > 0.3) o.bgVideo.currentTime = bgWant(t);
			o.draw(ctx, t);
			o.onProgress(Math.min(1, el / len));
			if (el >= len) resolve();
			else requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	}).finally(() => {
		try {
			src.stop();
		} catch {
			/* sudah berhenti */
		}
		src.disconnect();
		gain?.disconnect();
		if (o.bgVideo) {
			o.bgVideo.pause();
			o.bgVideo.muted = wasMuted;
		}
		if (rec.state !== 'inactive') rec.stop();
		stream.getTracks().forEach((t) => t.stop());
	});
	await stopped;
	return { blob: new Blob(chunks, { type: picked.mime.split(';')[0] }), ext: picked.ext };
}
