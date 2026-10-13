import type { Row } from '~/lib/project';

export interface HistState {
	rows: Row[];
	past: Row[][];
	future: Row[][];
	lastKey: string | null;
	lastAt: number;
	rev: number;
}

export type HistAction =
	| { type: 'set'; rows: Row[] | ((r: Row[]) => Row[]); coalesce?: string }
	| { type: 'reset'; rows: Row[] }
	| { type: 'undo' }
	| { type: 'redo' };

const LIMIT = 100;

export function histReducer(s: HistState, a: HistAction): HistState {
	switch (a.type) {
		case 'set': {
			const next = typeof a.rows === 'function' ? a.rows(s.rows) : a.rows;
			if (next === s.rows) return s;
			const now = Date.now();
			// Ketikan beruntun di kolom yang sama digabung jadi satu langkah undo.
			if (a.coalesce && a.coalesce === s.lastKey && now - s.lastAt < 1200) return { ...s, rows: next, lastAt: now, rev: s.rev + 1 };
			return { rows: next, past: [...s.past, s.rows].slice(-LIMIT), future: [], lastKey: a.coalesce ?? null, lastAt: now, rev: s.rev + 1 };
		}
		case 'reset':
			return { rows: a.rows, past: [], future: [], lastKey: null, lastAt: 0, rev: s.rev + 1 };
		case 'undo': {
			if (!s.past.length) return s;
			return { rows: s.past[s.past.length - 1], past: s.past.slice(0, -1), future: [s.rows, ...s.future].slice(0, LIMIT), lastKey: null, lastAt: 0, rev: s.rev + 1 };
		}
		case 'redo': {
			if (!s.future.length) return s;
			return { rows: s.future[0], past: [...s.past, s.rows].slice(-LIMIT), future: s.future.slice(1), lastKey: null, lastAt: 0, rev: s.rev + 1 };
		}
	}
}
