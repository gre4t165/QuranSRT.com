// Format & parsing waktu untuk tampilan dan file subtitle.

export const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
export const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** 65.432 → "01:05.432" (atau "1:01:05.432" bila ≥ 1 jam) */
export function fmtClock(sec: number, ms = true): string {
	if (!Number.isFinite(sec) || sec < 0) sec = 0;
	const total = Math.round(sec * 1000);
	const h = Math.floor(total / 3600000);
	const m = Math.floor(total / 60000) % 60;
	const s = Math.floor(total / 1000) % 60;
	const f = total % 1000;
	const core = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}${ms ? '.' + String(f).padStart(3, '0') : ''}`;
	return h ? `${h}:${core}` : core;
}

/** Menerima "5", "5.2", "0:05.2", "1:02:03,5" → detik. null bila tidak valid. */
export function parseClock(input: string): number | null {
	const v = input.trim().replace(',', '.');
	if (!v) return null;
	const parts = v.split(':');
	if (parts.length > 3 || parts.some((p) => p === '' || !/^\d+(\.\d+)?$/.test(p))) return null;
	let sec = 0;
	for (const p of parts) sec = sec * 60 + Number(p);
	return Number.isFinite(sec) ? round3(sec) : null;
}

function hms(sec: number) {
	const total = Math.max(0, Math.round(sec * 1000));
	return {
		h: Math.floor(total / 3600000),
		m: Math.floor(total / 60000) % 60,
		s: Math.floor(total / 1000) % 60,
		ms: total % 1000,
	};
}
const p2 = (n: number) => String(n).padStart(2, '0');

export const stampSrt = (sec: number) => {
	const t = hms(sec);
	return `${p2(t.h)}:${p2(t.m)}:${p2(t.s)},${String(t.ms).padStart(3, '0')}`;
};
export const stampVtt = (sec: number) => stampSrt(sec).replace(',', '.');
export const stampAss = (sec: number) => {
	const t = hms(sec);
	return `${t.h}:${p2(t.m)}:${p2(t.s)}.${p2(Math.floor(t.ms / 10))}`;
};
/** Stempel bab YouTube: "0:05", "1:02:03" */
export const stampChapter = (sec: number) => {
	const t = hms(sec);
	return t.h ? `${t.h}:${p2(t.m)}:${p2(t.s)}` : `${t.m}:${p2(t.s)}`;
};
