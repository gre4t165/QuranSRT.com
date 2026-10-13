import { useEffect, useRef } from 'react';
import type { StyleSettings } from '~/lib/project';
import type { TimelinePlayer } from '~/lib/player';
import type { Cue } from '~/lib/subtitles';
import { canvasSize, cueAt, drawFrame, ensureFonts } from '~/lib/renderer';

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
}

export function Preview({ player, cues, style, header, bgImage, bgVideo, bgVideoIsMedia, placeholder, label, selectedRow = 0 }: Props) {
	const ref = useRef<HTMLCanvasElement>(null);
	const live = useRef({ cues, style, header, bgImage, bgVideo, bgVideoIsMedia, placeholder, selectedRow });
	live.current = { cues, style, header, bgImage, bgVideo, bgVideoIsMedia, placeholder, selectedRow };

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
		drawFrame(c.getContext('2d')!, W, H, {
			style: L.style,
			lines: cue?.lines ?? [],
			alpha: cue ? alpha : 1,
			header: L.header,
			bgImage: L.bgImage,
			bgVideo: L.bgVideo,
			placeholder: !L.cues.length ? L.placeholder : undefined,
		});
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
		<div className="preview-frame">
			<canvas ref={ref} role="img" aria-label={label} />
		</div>
	);
}
