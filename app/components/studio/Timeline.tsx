import { useCallback, useEffect, useRef, useState } from 'react';
import { ZoomIn } from 'lucide-react';
import type { Peaks } from '~/lib/audio';
import type { Row } from '~/lib/project';
import type { TimelinePlayer } from '~/lib/player';
import { fmtClock } from '~/lib/time';
import { useT } from '~/lib/i18n';

interface Props {
	player: TimelinePlayer;
	peaks: Peaks | null;
	duration: number;
	rows: Row[];
	selected: number;
	onSelect: (i: number) => void;
	onEdge: (i: number, edge: 'start' | 'end', t: number, done: boolean) => void;
	version: number;
}

const H = 132;
const RULER = 20;
const CUE_Y = 98;
const CUE_H = 26;

function cssVar(name: string) {
	return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function Timeline({ player, peaks, duration, rows, selected, onSelect, onEdge, version }: Props) {
	const { t } = useT();
	const scrollRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [pps, setPps] = useState(40);
	const [follow, setFollow] = useState(true);
	const drag = useRef<{ i: number; edge: 'start' | 'end' } | null>(null);
	const stateRef = useRef({ rows, selected, peaks, duration, pps });
	stateRef.current = { rows, selected, peaks, duration, pps };
	const [hoverEdge, setHoverEdge] = useState(false);

	const total = Math.max(duration, rows.reduce((a, r) => Math.max(a, r.end), 0), 5) + 2;

	const draw = useCallback(() => {
		const c = canvasRef.current;
		const sc = scrollRef.current;
		if (!c || !sc) return;
		const { rows, selected, peaks, pps } = stateRef.current;
		const w = sc.clientWidth;
		const dpr = window.devicePixelRatio || 1;
		if (c.width !== Math.round(w * dpr) || c.height !== Math.round(H * dpr)) {
			c.width = Math.round(w * dpr);
			c.height = Math.round(H * dpr);
			c.style.width = w + 'px';
		}
		const ctx = c.getContext('2d')!;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		const x0 = sc.scrollLeft;
		const t0 = x0 / pps;
		const t1 = (x0 + w) / pps;
		const col = { line: cssVar('--line'), muted: cssVar('--muted'), action: cssVar('--action'), gold: cssVar('--gold'), surface: cssVar('--surface'), s2: cssVar('--surface-2'), ink: cssVar('--ink'), danger: cssVar('--danger') };
		ctx.fillStyle = col.surface;
		ctx.fillRect(0, 0, w, H);
		ctx.fillStyle = col.s2;
		ctx.fillRect(0, 0, w, RULER);
		// Penggaris waktu
		const step = pps >= 120 ? 1 : pps >= 50 ? 2 : pps >= 20 ? 5 : pps >= 8 ? 10 : 30;
		ctx.font = '600 10px system-ui, sans-serif';
		ctx.textBaseline = 'middle';
		for (let s = Math.floor(t0 / step) * step; s <= t1; s += step) {
			const x = s * pps - x0;
			ctx.fillStyle = col.line;
			ctx.fillRect(Math.round(x), RULER - 6, 1, 6);
			ctx.fillStyle = col.muted;
			ctx.fillText(fmtClock(s, false), x + 3, RULER / 2);
		}
		// Gelombang suara
		const mid = RULER + (CUE_Y - RULER) / 2;
		const amp = (CUE_Y - RULER) / 2 - 6;
		if (peaks) {
			ctx.fillStyle = col.action;
			ctx.globalAlpha = 0.55;
			for (let x = 0; x < w; x++) {
				const a = Math.floor(((x0 + x) / pps) * peaks.perSec);
				const b = Math.max(a + 1, Math.floor(((x0 + x + 1) / pps) * peaks.perSec));
				if (a >= peaks.max.length) break;
				let lo = 0;
				let hi = 0;
				for (let k = a; k < b && k < peaks.max.length; k++) {
					if (peaks.min[k] < lo) lo = peaks.min[k];
					if (peaks.max[k] > hi) hi = peaks.max[k];
				}
				ctx.fillRect(x, mid - hi * amp, 1, Math.max(1, (hi - lo) * amp));
			}
			ctx.globalAlpha = 1;
		} else {
			ctx.fillStyle = col.line;
			ctx.fillRect(0, mid, w, 1);
			ctx.fillStyle = col.muted;
			ctx.font = '500 12px system-ui, sans-serif';
			ctx.fillText(t('Gelombang suara muncul setelah audio dimuat', 'Waveform appears once audio is loaded'), 12, mid - 14);
		}
		// Blok cue
		ctx.font = '700 11px system-ui, sans-serif';
		rows.forEach((r, i) => {
			if (r.end < t0 || r.start > t1) return;
			const xa = r.start * pps - x0;
			const xb = r.end * pps - x0;
			const bad = r.end <= r.start || (i > 0 && r.start < rows[i - 1].end - 0.001);
			ctx.fillStyle = bad ? col.danger : i === selected ? col.action : col.gold;
			ctx.globalAlpha = i === selected ? 0.95 : 0.55;
			ctx.beginPath();
			ctx.roundRect(xa, CUE_Y, Math.max(2, xb - xa - 1), CUE_H, 5);
			ctx.fill();
			ctx.globalAlpha = 1;
			ctx.fillStyle = '#fff';
			let label = r.kind === 'ayah' ? String(r.ayah) : r.kind === 'basmalah' ? 'B' : 'T';
			if (r.group) {
				let k = 0;
				while (i - k - 1 >= 0 && rows[i - k - 1].group === r.group) k++;
				label += String.fromCharCode(97 + k);
			}
			if (xb - xa > 18) ctx.fillText(label, xa + 6, CUE_Y + CUE_H / 2);
			if (i === selected) {
				ctx.fillStyle = col.ink;
				ctx.fillRect(xa - 1, CUE_Y - 4, 3, CUE_H + 8);
				ctx.fillRect(xb - 2, CUE_Y - 4, 3, CUE_H + 8);
			}
		});
		// Playhead
		const px = player.time() * pps - x0;
		ctx.fillStyle = col.danger;
		ctx.fillRect(Math.round(px), 0, 2, H);
	}, [player, t]);

	// Gambar ulang saat data berubah
	useEffect(() => {
		draw();
	}, [draw, rows, selected, peaks, pps, duration, version]);

	// Loop animasi saat memutar
	useEffect(() => {
		let raf = 0;
		const loop = () => {
			const sc = scrollRef.current;
			if (sc && player.playing && follow && !drag.current) {
				const x = player.time() * stateRef.current.pps;
				if (x < sc.scrollLeft + 40 || x > sc.scrollLeft + sc.clientWidth - 60) sc.scrollLeft = Math.max(0, x - 80);
			}
			draw();
			raf = requestAnimationFrame(loop);
		};
		const start = () => {
			cancelAnimationFrame(raf);
			if (player.playing) raf = requestAnimationFrame(loop);
			else draw();
		};
		const off = player.on(start);
		start();
		const onResize = () => draw();
		window.addEventListener('resize', onResize);
		const mo = new MutationObserver(() => draw());
		mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
		return () => {
			off();
			cancelAnimationFrame(raf);
			window.removeEventListener('resize', onResize);
			mo.disconnect();
		};
	}, [player, draw, follow]);

	const hit = (clientX: number, clientY: number) => {
		const sc = scrollRef.current!;
		const rect = sc.getBoundingClientRect();
		const x = clientX - rect.left + sc.scrollLeft;
		const y = clientY - rect.top;
		const tt = x / pps;
		let edge: { i: number; edge: 'start' | 'end' } | null = null;
		let cue = -1;
		if (y >= CUE_Y - 6 && y <= CUE_Y + CUE_H + 6) {
			rows.forEach((r, i) => {
				if (Math.abs(r.start * pps - x) < 7) edge = { i, edge: 'start' };
				else if (Math.abs(r.end * pps - x) < 7) edge = { i, edge: 'end' };
				if (tt >= r.start && tt < r.end) cue = i;
			});
		}
		return { t: tt, edge: edge as { i: number; edge: 'start' | 'end' } | null, cue };
	};

	const onPointerDown = (e: React.PointerEvent) => {
		const h = hit(e.clientX, e.clientY);
		if (h.edge) {
			drag.current = h.edge;
			onSelect(h.edge.i);
			(e.target as Element).setPointerCapture(e.pointerId);
			return;
		}
		if (h.cue >= 0) onSelect(h.cue);
		player.seek(h.t);
		draw();
	};
	const onPointerMove = (e: React.PointerEvent) => {
		if (drag.current) {
			const h = hit(e.clientX, e.clientY);
			onEdge(drag.current.i, drag.current.edge, Math.max(0, Math.round(h.t * 1000) / 1000), false);
			return;
		}
		if (e.pointerType === 'mouse') setHoverEdge(!!hit(e.clientX, e.clientY).edge);
	};
	const onPointerUp = (e: React.PointerEvent) => {
		if (drag.current) {
			const h = hit(e.clientX, e.clientY);
			onEdge(drag.current.i, drag.current.edge, Math.max(0, Math.round(h.t * 1000) / 1000), true);
			drag.current = null;
		}
	};

	return (
		<section className="card timeline" aria-label={t('Linimasa', 'Timeline')}>
			<div className="tl-scroll" ref={scrollRef} onScroll={draw}>
				<div style={{ width: total * pps, height: H }}>
					<canvas
						ref={canvasRef}
						className="tl-canvas"
						style={{ cursor: hoverEdge ? 'ew-resize' : undefined }}
						onPointerDown={onPointerDown}
						onPointerMove={onPointerMove}
						onPointerUp={onPointerUp}
						role="slider"
						aria-label={t('Posisi pemutaran', 'Playback position')}
						aria-valuemin={0}
						aria-valuemax={Math.round(total)}
						aria-valuenow={Math.round(player.time())}
						tabIndex={0}
					/>
				</div>
			</div>
			<div className="tl-tools">
				<ZoomIn size={15} aria-hidden="true" />
				<label className="sr-only" htmlFor="tl-zoom">{t('Perbesar linimasa', 'Timeline zoom')}</label>
				<input id="tl-zoom" type="range" min={6} max={240} value={pps} onChange={(e) => setPps(Number(e.target.value))} />
				<label className="check" style={{ fontSize: 13 }}>
					<input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> {t('Ikuti playhead', 'Follow playhead')}
				</label>
				<span style={{ marginLeft: 'auto' }}>{t('Tarik tepi blok untuk mengubah waktu. Klik untuk melompat.', 'Drag block edges to retime. Click to jump.')}</span>
			</div>
		</section>
	);
}
