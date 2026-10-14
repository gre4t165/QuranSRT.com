// Penggambar frame subtitle ke <canvas>. Dipakai untuk pratinjau DAN ekspor video,
// sehingga hasil video sama persis dengan yang terlihat di pratinjau.
import type { LayerId, StyleSettings } from './project';
import type { CueLine } from './subtitles';

export const LATIN_FONT = '"Plus Jakarta Sans Variable", "Plus Jakarta Sans", system-ui, sans-serif';

export function canvasSize(ratio: StyleSettings['ratio'], long = 1920): [number, number] {
	const short = Math.round((long * 9) / 16);
	if (ratio === '9:16') return [short, long];
	if (ratio === '1:1') return [short, short];
	return [long, short];
}

export interface FrameInput {
	style: StyleSettings;
	lines: CueLine[];
	/** 0..1 untuk efek muncul/hilang */
	alpha: number;
	header?: { ar: string; latin: string };
	bgImage?: CanvasImageSource | null;
	bgVideo?: HTMLVideoElement | null;
	watermark?: string;
	placeholder?: string;
}

/** Kotak lapisan di kanvas (piksel kanvas) — dipakai pratinjau untuk klik & geser. */
export interface Hit {
	id: LayerId;
	x: number;
	y: number;
	w: number;
	h: number;
}

const layerOf = (k: CueLine['kind']): LayerId => k;

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
	const words = text.split(/\s+/).filter(Boolean);
	const lines: string[] = [];
	let cur = '';
	for (const w of words) {
		const test = cur ? cur + ' ' + w : w;
		if (ctx.measureText(test).width > maxW && cur) {
			lines.push(cur);
			cur = w;
		} else cur = test;
	}
	if (cur) lines.push(cur);
	return lines;
}

function cover(ctx: CanvasRenderingContext2D, src: CanvasImageSource, W: number, H: number) {
	const sw = (src as HTMLVideoElement).videoWidth || (src as HTMLImageElement).naturalWidth || (src as ImageBitmap).width;
	const sh = (src as HTMLVideoElement).videoHeight || (src as HTMLImageElement).naturalHeight || (src as ImageBitmap).height;
	if (!sw || !sh) return false;
	const s = Math.max(W / sw, H / sh);
	const dw = sw * s;
	const dh = sh * s;
	ctx.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
	return true;
}

function hexA(hex: string, a: number) {
	const h = hex.replace('#', '');
	const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h.slice(0, 6), 16);
	return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
	for (let k = 0; k < 2; k++) {
		ctx.save();
		ctx.translate(cx, cy);
		ctx.rotate((Math.PI / 4) * k);
		ctx.strokeRect(-r, -r, r * 2, r * 2);
		ctx.restore();
	}
	ctx.beginPath();
	ctx.arc(cx, cy, r * 0.42, 0, Math.PI * 2);
	ctx.stroke();
}

function background(ctx: CanvasRenderingContext2D, W: number, H: number, f: FrameInput) {
	const s = f.style;
	ctx.fillStyle = s.bg1;
	ctx.fillRect(0, 0, W, H);
	let media = false;
	if (s.bgType === 'video' && f.bgVideo && f.bgVideo.readyState >= 2) media = cover(ctx, f.bgVideo, W, H);
	else if (s.bgType === 'image' && f.bgImage) media = cover(ctx, f.bgImage, W, H);
	if (media) {
		if (!s.box) {
			const g = ctx.createLinearGradient(0, 0, 0, H);
			g.addColorStop(0, 'rgba(0,0,0,0.25)');
			g.addColorStop(1, 'rgba(0,0,0,0.5)');
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, W, H);
		}
		return;
	}
	if (s.bgType === 'gradient' || s.bgType === 'image' || s.bgType === 'video') {
		const g = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, Math.hypot(W, H) * 0.62);
		g.addColorStop(0, s.bg1);
		g.addColorStop(1, s.bg2);
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, W, H);
	}
}

function ornament(ctx: CanvasRenderingContext2D, W: number, H: number, s: StyleSettings, u: number) {
	ctx.save();
	ctx.strokeStyle = hexA(s.accent, 0.5);
	ctx.lineWidth = 2 * u;
	const m = 34 * u;
	ctx.strokeRect(m, m, W - m * 2, H - m * 2);
	ctx.strokeStyle = hexA(s.accent, 0.22);
	ctx.lineWidth = 1 * u;
	ctx.strokeRect(m + 10 * u, m + 10 * u, W - (m + 10 * u) * 2, H - (m + 10 * u) * 2);
	ctx.strokeStyle = hexA(s.accent, 0.6);
	ctx.lineWidth = 1.5 * u;
	for (const [x, y] of [[m, m], [W - m, m], [m, H - m], [W - m, H - m]]) star(ctx, x, y, 12 * u);
	ctx.strokeStyle = hexA(s.accent, 0.06);
	ctx.lineWidth = 2 * u;
	star(ctx, W / 2, H / 2, Math.min(W, H) * 0.3);
	ctx.restore();
}

interface Laid {
	kind: CueLine['kind'];
	text: string;
	font: string;
	size: number;
	lh: number;
	color: string;
	rtl: boolean;
	gapBefore: number;
}

/** Skala huruf terkecil yang masih dianggap nyaman dibaca (relatif ke ukuran pilihan pengguna). */
export const MIN_READABLE_SCALE = 0.85;

/** Batas baris per layar agar subtitle nyaman diikuti (Arab + terjemahan + transliterasi). */
const MAX_LINES: Record<StyleSettings['ratio'], number> = { '16:9': 5, '1:1': 7, '9:16': 9 };

interface Layout {
	laid: Laid[];
	totalH: number;
	scale: number;
	topLimit: number;
	bottomLimit: number;
	avail: number;
}

export function layoutText(ctx: CanvasRenderingContext2D, W: number, H: number, s: StyleSettings, lines: CueLine[], hasHeader: boolean, minScale = 0.3): Layout {
	const u = Math.min(W, H) / 1080;
	const headerAtBottom = s.position === 'top';
	const maxW = W * (s.ratio === '9:16' ? 0.84 : 0.8);
	const topLimit = hasHeader && !headerAtBottom ? 170 * u : 70 * u;
	const bottomLimit = (hasHeader && headerAtBottom ? H - 170 * u : H - 70 * u) - (s.brand?.trim() ? 30 * u : 0);
	const avail = bottomLimit - topLimit;
	let k = 1;
	let laid: Laid[] = [];
	let totalH = 0;
	for (;;) {
		laid = [];
		totalH = 0;
		let prevKind: string | null = null;
		for (const l of lines) {
			const isAr = l.kind === 'ar';
			const lc = s.layers?.[layerOf(l.kind)];
			if (lc?.hidden) continue;
			const size = (isAr ? s.arabicSize : l.kind === 'trans' ? s.transSize : s.transSize * 0.78) * u * k * (lc?.scale ?? 1);
			const font = isAr ? `${Math.round(size)}px "${s.arabicFont}", "Amiri Quran", serif` : `${l.kind === 'translit' ? 'italic 500' : l.kind === 'label' ? '600' : '500'} ${Math.round(size)}px ${LATIN_FONT}`;
			ctx.font = font;
			ctx.direction = isAr ? 'rtl' : 'ltr';
			const lh = size * (isAr ? (s.arabicFont === 'Reem Kufi' ? 1.5 : 1.85) : 1.45);
			const color = lc?.color ? lc.color : isAr ? s.textColor : l.kind === 'label' ? s.accent : l.kind === 'translit' ? hexA(s.transColor, 0.85) : s.transColor;
			const parts = wrap(ctx, l.text, maxW);
			parts.forEach((p, pi) => {
				const gap = pi === 0 && prevKind && prevKind !== l.kind ? size * 0.45 : 0;
				laid.push({ kind: l.kind, text: p, font, size, lh, color, rtl: isAr, gapBefore: gap });
				totalH += lh + gap;
			});
			prevKind = l.kind;
		}
		if (totalH <= avail || k * 0.94 < minScale) break;
		k *= 0.94;
	}
	return { laid, totalH, scale: k, topLimit, bottomLimit, avail };
}

/**
 * Membuat penguji "muat di layar" untuk gaya tertentu: true bila teks muat tanpa
 * mengecilkan huruf di bawah MIN_READABLE_SCALE. Dipakai untuk memecah ayat panjang otomatis.
 */
export function makeFitTest(style: StyleSettings, hasHeader: boolean): ((lines: CueLine[]) => boolean) | undefined {
	if (typeof document === 'undefined') return undefined;
	const c = document.createElement('canvas');
	const ctx = c.getContext('2d');
	if (!ctx) return undefined;
	const [W, H] = canvasSize(style.ratio, 1280);
	const cache = new Map<string, boolean>();
	return (lines) => {
		const key = lines.map((l) => l.kind + '\u0001' + l.text).join('\u0002');
		let v = cache.get(key);
		if (v === undefined) {
			const L = layoutText(ctx, W, H, style, lines, hasHeader, MIN_READABLE_SCALE * 0.94);
			v = L.totalH <= L.avail && L.scale >= MIN_READABLE_SCALE - 1e-6 && L.laid.length <= MAX_LINES[style.ratio];
			if (cache.size > 4000) cache.clear();
			cache.set(key, v);
		}
		return v;
	};
}

export function drawFrame(ctx: CanvasRenderingContext2D, W: number, H: number, f: FrameInput): Hit[] {
	const hits: Hit[] = [];
	const s = f.style;
	const u = Math.min(W, H) / 1080;
	ctx.save();
	ctx.textBaseline = 'middle';
	background(ctx, W, H, f);
	if (s.ornament) ornament(ctx, W, H, s, u);

	const headerAtBottom = s.position === 'top';
	const hasHeader = !!(s.header && f.header);
	const hc = s.layers?.header;
	if (hasHeader && f.header && !hc?.hidden) {
		ctx.save();
		ctx.textAlign = 'center';
		const hs = hc?.scale ?? 1;
		const hx = W / 2 + (hc?.dx ?? 0) * W;
		const y = (headerAtBottom ? H - 92 * u : 92 * u) + (hc?.dy ?? 0) * H;
		ctx.direction = 'rtl';
		ctx.fillStyle = hc?.color || s.accent;
		ctx.font = `${Math.round(40 * u * hs)}px "${s.arabicFont}", serif`;
		const w1 = ctx.measureText(f.header.ar).width;
		ctx.fillText(f.header.ar, hx, y - 12 * u * hs);
		ctx.direction = 'ltr';
		ctx.globalAlpha = 0.8;
		ctx.font = `600 ${Math.round(19 * u * hs)}px ${LATIN_FONT}`;
		ctx.fillStyle = hc?.color || s.transColor;
		const w2 = ctx.measureText(f.header.latin).width;
		ctx.fillText(f.header.latin, hx, y + 30 * u * hs);
		const hw = Math.max(w1, w2);
		hits.push({ id: 'header', x: hx - hw / 2, y: y - 12 * u * hs - 28 * u * hs, w: hw, h: 80 * u * hs });
		ctx.restore();
	}

	const lines = f.lines.length ? f.lines : f.placeholder ? [{ kind: 'label' as const, text: f.placeholder }] : [];
	if (lines.length) {
		const { laid, totalH, topLimit, bottomLimit, avail } = layoutText(ctx, W, H, s, lines, hasHeader);
		let y0: number;
		if (s.position === 'top') y0 = topLimit + 20 * u;
		else if (s.position === 'bottom') y0 = bottomLimit - totalH - 20 * u;
		else y0 = topLimit + (avail - totalH) / 2;
		// Jangan pernah keluar dari bingkai atas.
		y0 = Math.max(y0, Math.min(topLimit, 30 * u));

		ctx.globalAlpha = Math.max(0, Math.min(1, f.alpha));
		const offX = (l: { kind: CueLine['kind'] }) => (s.layers?.[layerOf(l.kind)]?.dx ?? 0) * W;
		const offY = (l: { kind: CueLine['kind'] }) => (s.layers?.[layerOf(l.kind)]?.dy ?? 0) * H;
		if (s.box) {
			let x0 = Infinity, x1 = -Infinity, ya = Infinity, yb = -Infinity, yy = y0;
			for (const l of laid) {
				ctx.font = l.font;
				ctx.direction = l.rtl ? 'rtl' : 'ltr';
				const w = ctx.measureText(l.text).width;
				yy += l.gapBefore;
				x0 = Math.min(x0, W / 2 + offX(l) - w / 2);
				x1 = Math.max(x1, W / 2 + offX(l) + w / 2);
				ya = Math.min(ya, yy + offY(l));
				yb = Math.max(yb, yy + l.lh + offY(l));
				yy += l.lh;
			}
			const px = 34 * u;
			const py = 18 * u;
			ctx.fillStyle = `rgba(0,0,0,${s.boxOpacity})`;
			ctx.beginPath();
			ctx.roundRect(x0 - px, ya - py, x1 - x0 + px * 2, yb - ya + py * 2, 18 * u);
			ctx.fill();
		}
		const boxes = new Map<LayerId, { x0: number; x1: number; y0: number; y1: number }>();
		ctx.textAlign = 'center';
		const outline = Math.max(0, s.outline || 0);
		let y = y0;
		for (const l of laid) {
			y += l.gapBefore;
			ctx.font = l.font;
			ctx.direction = l.rtl ? 'rtl' : 'ltr';
			const cy = y + l.lh / 2 + offY(l);
			const cx = W / 2 + offX(l);
			const tw = ctx.measureText(l.text).width;
			const bx = boxes.get(layerOf(l.kind));
			const b = { x0: cx - tw / 2, x1: cx + tw / 2, y0: cy - l.lh / 2, y1: cy + l.lh / 2 };
			if (bx) { bx.x0 = Math.min(bx.x0, b.x0); bx.x1 = Math.max(bx.x1, b.x1); bx.y0 = Math.min(bx.y0, b.y0); bx.y1 = Math.max(bx.y1, b.y1); } else boxes.set(layerOf(l.kind), b);
			if (outline > 0) {
				ctx.save();
				ctx.shadowColor = 'transparent';
				ctx.lineJoin = 'round';
				ctx.miterLimit = 2;
				ctx.strokeStyle = s.outlineColor || '#000000';
				ctx.lineWidth = outline * 2 * u * (l.size / (l.rtl ? s.arabicSize * u : s.transSize * u) || 1);
				ctx.strokeText(l.text, cx, cy);
				ctx.restore();
			}
			if (s.shadow) {
				ctx.shadowColor = 'rgba(0,0,0,0.55)';
				ctx.shadowBlur = 14 * u;
				ctx.shadowOffsetY = 2 * u;
			}
			ctx.fillStyle = l.color;
			ctx.fillText(l.text, cx, cy);
			ctx.shadowColor = 'transparent';
			y += l.lh;
		}
		for (const [id, b] of boxes) hits.push({ id, x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 });
	}
	ctx.globalAlpha = 1;
	if (s.brand?.trim()) {
		ctx.textAlign = 'left';
		ctx.direction = 'ltr';
		ctx.font = `700 ${Math.round(20 * u)}px ${LATIN_FONT}`;
		ctx.fillStyle = hexA(s.accent, 0.9);
		ctx.fillText(s.brand.trim().slice(0, 40), (s.ornament ? 70 : 52) * u, H - (s.ornament ? 70 : 52) * u);
	}
	if (f.watermark) {
		ctx.textAlign = 'right';
		ctx.direction = 'ltr';
		ctx.font = `600 ${Math.round(18 * u)}px ${LATIN_FONT}`;
		ctx.fillStyle = 'rgba(255,255,255,0.55)';
		ctx.fillText(f.watermark, W - 52 * u, H - 52 * u);
	}
	ctx.restore();
	return hits;
}

/** Ambil cue aktif + alpha fade untuk waktu t. */
export function cueAt<T extends { start: number; end: number }>(cues: T[], t: number, fade: boolean): { cue: T | null; alpha: number } {
	let lo = 0;
	let hi = cues.length - 1;
	while (lo <= hi) {
		const mid = (lo + hi) >> 1;
		const c = cues[mid];
		if (t < c.start) hi = mid - 1;
		else if (t >= c.end) lo = mid + 1;
		else {
			if (!fade) return { cue: c, alpha: 1 };
			const d = 0.22;
			const prevTouch = mid > 0 && Math.abs(cues[mid - 1].end - c.start) < 0.01;
			const nextTouch = mid < cues.length - 1 && Math.abs(cues[mid + 1].start - c.end) < 0.01;
			const a1 = prevTouch ? 1 : Math.min(1, (t - c.start) / d);
			const a2 = nextTouch ? 1 : Math.min(1, (c.end - t) / d);
			return { cue: c, alpha: Math.max(0, Math.min(a1, a2)) };
		}
	}
	return { cue: null, alpha: 0 };
}

export async function ensureFonts(arabicFont: string) {
	if (typeof document === 'undefined' || !document.fonts) return;
	await Promise.allSettled([
		document.fonts.load(`48px "${arabicFont}"`, 'بِسۡمِ ٱللَّهِ'),
		document.fonts.load(`48px "Plus Jakarta Sans Variable"`, 'Aa'),
		document.fonts.load(`italic 48px "Plus Jakarta Sans Variable"`, 'Aa'),
	]);
}
