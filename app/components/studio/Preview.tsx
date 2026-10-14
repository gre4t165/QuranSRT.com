import { useEffect, useRef, useState } from 'react';
import type { LayerCfg, LayerId, StyleSettings } from '~/lib/project';
import type { TimelinePlayer } from '~/lib/player';
import type { Cue } from '~/lib/subtitles';
import { canvasSize, cueAt, drawFrame, ensureFonts, type Hit } from '~/lib/renderer';

interface Props {
	player: TimelinePlayer;
	cues: Cue[];
	style: StyleSettings;
	header?: { ar: string; latin: string };
	bgImage: HTMLImageElement | null;
	bgVideo: HTMLVideoElement | null;
	bgVideoIsMedia: boolean;
	placeholder: string;
	label: string;
	/** Saat dijeda di luar subtitle, tampilkan baris terpilih agar gaya tetap terlihat. */
	selectedRow?: number;
	/** Teks penanda saat satu ayat dibagi jadi beberapa subtitle, mis. “Bagian 2 dari 4”. */
	partText?: (i: number, n: number) => string;
	/** Lapisan terpilih (diatur Studio agar panel & pratinjau sinkron). */
	layer?: LayerId | null;
	onSelectLayer?: (id: LayerId | null) => void;
	/** Ubah satu lapisan (geser/ukuran) — patch digabung ke style.layers[id]. */
	onLayer?: (id: LayerId, patch: LayerCfg) => void;
	/** Teks lapisan pada baris aktif untuk diedit langsung; null bila tidak bisa diedit. */
	getText?: (row: number, id: LayerId) => string | null;
	onEditText?: (row: number, id: LayerId, text: string) => void;
	hintText?: string;
	editLabel?: string;
}

interface Box { x: number; y: number; w: number; h: number }

export function Preview({ player, cues, style, header, bgImage, bgVideo, bgVideoIsMedia, placeholder, label, selectedRow = 0, partText, layer = null, onSelectLayer, onLayer, getText, onEditText, hintText, editLabel }: Props) {
	const ref = useRef<HTMLCanvasElement>(null);
	const [part, setPart] = useState<[number, number] | null>(null);
	const partRef = useRef<[number, number] | null>(null);
	const live = useRef({ cues, style, header, bgImage, bgVideo, bgVideoIsMedia, placeholder, selectedRow });
	live.current = { cues, style, header, bgImage, bgVideo, bgVideoIsMedia, placeholder, selectedRow };
	const hitsRef = useRef<Hit[]>([]);
	const curRow = useRef(-1);
	const [boxes, setBoxes] = useState<Record<string, Box>>({});
	const boxesRef = useRef('');
	const drag = useRef<{ mode: 'move' | 'size'; id: LayerId; px: number; py: number; dx: number; dy: number; scale: number; cx: number; cy: number; d0: number } | null>(null);
	const [editing, setEditing] = useState<{ id: LayerId; row: number; text: string } | null>(null);
	const ui = useRef({ layer, onSelectLayer, onLayer, getText, onEditText });
	ui.current = { layer, onSelectLayer, onLayer, getText, onEditText };

	const paint = () => {
		const c = ref.current;
		if (!c) return;
		const L = live.current;
		const [W, H] = canvasSize(L.style.ratio, 1280);
		if (c.width !== W || c.height !== H) {
			c.width = W;
			c.height = H;
		}
		const t = player.time();
		// Video latar terpisah diputar berulang mengikuti linimasa.
		if (L.bgVideo && !L.bgVideoIsMedia && L.style.bgType === 'video' && L.bgVideo.duration) {
			const want = t % L.bgVideo.duration;
			if (player.playing) {
				if (L.bgVideo.paused) void L.bgVideo.play().catch(() => undefined);
				if (Math.abs(L.bgVideo.currentTime - want) > 0.5) L.bgVideo.currentTime = want;
			} else {
				if (!L.bgVideo.paused) L.bgVideo.pause();
				if (Math.abs(L.bgVideo.currentTime - want) > 0.05) L.bgVideo.currentTime = want;
			}
		}
		let { cue, alpha } = cueAt(L.cues, t, L.style.fade && player.playing);
		if (!cue && !player.playing && L.cues.length) {
			cue = L.cues.find((c) => c.row === L.selectedRow) ?? L.cues.find((c) => c.start >= t) ?? L.cues[0];
			alpha = 1;
		}
		// Penanda bagian: ayat panjang dibagi beberapa subtitle yang tampil bergiliran.
		let np: [number, number] | null = null;
		if (cue) {
			const same = L.cues.filter((x) => x.row === cue!.row);
			if (same.length > 1) np = [same.indexOf(cue) + 1, same.length];
		}
		if (np?.[0] !== partRef.current?.[0] || np?.[1] !== partRef.current?.[1]) {
			partRef.current = np;
			setPart(np);
		}
		curRow.current = cue ? cue.row : -1;
		hitsRef.current = drawFrame(c.getContext('2d')!, W, H, {
			style: L.style,
			lines: cue?.lines ?? [],
			alpha: cue ? alpha : 1,
			header: L.header,
			bgImage: L.bgImage,
			bgVideo: L.bgVideo,
			placeholder: !L.cues.length ? L.placeholder : undefined,
		});
		// Kotak lapisan (px CSS) untuk bingkai pilihan; hanya setState bila berubah.
		const k = c.clientWidth / W;
		const next: Record<string, Box> = {};
		for (const h of hitsRef.current) next[h.id] = { x: c.offsetLeft + h.x * k, y: c.offsetTop + h.y * k, w: h.w * k, h: h.h * k };
		const sig = JSON.stringify(next, (_k, v) => (typeof v === 'number' ? Math.round(v) : v));
		if (sig !== boxesRef.current) {
			boxesRef.current = sig;
			setBoxes(next);
		}
	};

	/** Titik pointer → koordinat kanvas. */
	const toCanvas = (e: { clientX: number; clientY: number }) => {
		const c = ref.current!;
		const r = c.getBoundingClientRect();
		return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height, W: c.width, H: c.height };
	};
	const hitAt = (x: number, y: number): Hit | null => {
		const pad = 10;
		const found = hitsRef.current.filter((h) => x >= h.x - pad && x <= h.x + h.w + pad && y >= h.y - pad && y <= h.y + h.h + pad);
		found.sort((a, b) => a.w * a.h - b.w * b.h);
		return found[0] ?? null;
	};
	const cfgOf = (id: LayerId): LayerCfg => live.current.style.layers?.[id] ?? {};
	const onDown = (e: React.PointerEvent) => {
		if (editing) return;
		const p = toCanvas(e);
		const h = hitAt(p.x, p.y);
		ui.current.onSelectLayer?.(h ? h.id : null);
		if (!h || !ui.current.onLayer) return;
		const c = cfgOf(h.id);
		drag.current = { mode: 'move', id: h.id, px: p.x, py: p.y, dx: c.dx ?? 0, dy: c.dy ?? 0, scale: c.scale ?? 1, cx: 0, cy: 0, d0: 1 };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		e.preventDefault();
	};
	const onSizeDown = (e: React.PointerEvent) => {
		const id = ui.current.layer;
		const hit = hitsRef.current.find((h) => h.id === id);
		if (!id || !hit) return;
		const p = toCanvas(e);
		const cx = hit.x + hit.w / 2, cy = hit.y + hit.h / 2;
		drag.current = { mode: 'size', id, px: p.x, py: p.y, dx: 0, dy: 0, scale: cfgOf(id).scale ?? 1, cx, cy, d0: Math.max(8, Math.hypot(p.x - cx, p.y - cy)) };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		e.stopPropagation();
		e.preventDefault();
	};
	const onMove = (e: React.PointerEvent) => {
		const d = drag.current;
		const c = ref.current;
		if (!c) return;
		const p = toCanvas(e);
		if (!d) {
			const h = hitAt(p.x, p.y);
			c.style.cursor = h ? 'move' : 'default';
			return;
		}
		if (d.mode === 'move') {
			let dx = d.dx + (p.x - d.px) / p.W;
			let dy = d.dy + (p.y - d.py) / p.H;
			if (Math.abs(dx) * p.W < 8) dx = 0; // tarik ke tengah = menempel
			if (Math.abs(dx) > 0.5) dx = Math.sign(dx) * 0.5;
			if (Math.abs(dy) > 0.5) dy = Math.sign(dy) * 0.5;
			ui.current.onLayer?.(d.id, { dx: Math.round(dx * 10000) / 10000, dy: Math.round(dy * 10000) / 10000 });
		} else {
			const k = Math.hypot(p.x - d.cx, p.y - d.cy) / d.d0;
			ui.current.onLayer?.(d.id, { scale: Math.round(Math.max(0.3, Math.min(3, d.scale * k)) * 100) / 100 });
		}
	};
	const onUp = () => {
		drag.current = null;
	};
	const onDouble = (e: React.MouseEvent) => {
		const p = toCanvas(e);
		const h = hitAt(p.x, p.y);
		if (!h || curRow.current < 0 || !ui.current.getText) return;
		const text = ui.current.getText(curRow.current, h.id);
		if (text === null) return;
		ui.current.onSelectLayer?.(h.id);
		setEditing({ id: h.id, row: curRow.current, text });
	};
	const onKey = (e: React.KeyboardEvent) => {
		const id = ui.current.layer;
		if (!id || editing) return;
		const step = e.shiftKey ? 0.02 : 0.005;
		const c = cfgOf(id);
		const mv: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
		if (mv[e.key]) {
			ui.current.onLayer?.(id, { dx: Math.max(-0.5, Math.min(0.5, (c.dx ?? 0) + mv[e.key][0])), dy: Math.max(-0.5, Math.min(0.5, (c.dy ?? 0) + mv[e.key][1])) });
			e.preventDefault();
		} else if (e.key === '+' || e.key === '=' || e.key === '-') {
			ui.current.onLayer?.(id, { scale: Math.max(0.3, Math.min(3, Math.round(((c.scale ?? 1) * (e.key === '-' ? 0.95 : 1.05)) * 100) / 100)) });
			e.preventDefault();
		} else if (e.key === 'Enter' && curRow.current >= 0) {
			const text = ui.current.getText?.(curRow.current, id);
			if (text != null) setEditing({ id, row: curRow.current, text });
			e.preventDefault();
		} else if (e.key === 'Escape') ui.current.onSelectLayer?.(null);
	};
	const commit = () => {
		if (editing) ui.current.onEditText?.(editing.row, editing.id, editing.text);
		setEditing(null);
	};

	useEffect(() => {
		let raf = 0;
		let alive = true;
		const loop = () => {
			paint();
			if (player.playing || (live.current.bgVideo && live.current.style.bgType === 'video' && !live.current.bgVideo.paused)) raf = requestAnimationFrame(loop);
		};
		const kick = () => {
			cancelAnimationFrame(raf);
			raf = requestAnimationFrame(loop);
		};
		const off = player.on(kick);
		void ensureFonts(style.arabicFont).then(() => alive && kick());
		kick();
		const v = bgVideo;
		v?.addEventListener('seeked', kick);
		v?.addEventListener('loadeddata', kick);
		return () => {
			alive = false;
			off();
			cancelAnimationFrame(raf);
			v?.removeEventListener('seeked', kick);
			v?.removeEventListener('loadeddata', kick);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [player, cues, style, header, bgImage, bgVideo, placeholder, selectedRow]);

	return (
		<div className="preview-frame" tabIndex={onLayer ? 0 : undefined} onKeyDown={onKey}>
			<canvas
				ref={ref}
				role="img"
				aria-label={label}
				onPointerDown={onDown}
				onPointerMove={onMove}
				onPointerUp={onUp}
				onPointerCancel={onUp}
				onDoubleClick={onDouble}
				style={{ touchAction: onLayer ? 'none' : undefined }}
			/>
			{layer && boxes[layer] && !editing && (
				<div className="layer-sel" style={{ left: boxes[layer].x - 4, top: boxes[layer].y - 4, width: boxes[layer].w + 8, height: boxes[layer].h + 8 }} aria-hidden="true">
					<i className="layer-handle" onPointerDown={onSizeDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
				</div>
			)}
			{editing && boxes[editing.id] && (
				<textarea
					className="layer-edit"
					autoFocus
					aria-label={editLabel}
					dir={editing.id === 'ar' ? 'rtl' : 'ltr'}
					value={editing.text}
					style={{ left: Math.max(4, boxes[editing.id].x - 8), top: boxes[editing.id].y - 6, width: Math.max(220, boxes[editing.id].w + 16), minHeight: Math.max(48, boxes[editing.id].h + 12), fontFamily: editing.id === 'ar' ? `"${style.arabicFont}", serif` : undefined }}
					onChange={(e) => setEditing({ ...editing, text: e.target.value })}
					onBlur={commit}
					onKeyDown={(e) => {
						if (e.key === 'Escape') setEditing(null);
						else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
						e.stopPropagation();
					}}
				/>
			)}
			{hintText && onLayer && <span className="layer-hint">{hintText}</span>}
			{part && partText && <span className="part-badge" aria-live="polite">{partText(part[0], part[1])}</span>}
		</div>
	);
}
