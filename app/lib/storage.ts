// Penyimpanan proyek di browser (localStorage). Audio tidak disimpan — hanya teks & waktu.
import { normalizeProject, projectTitle, type Project } from './project';

const INDEX = 'qss.projects.v2';
const KEY = (id: string) => `qss.project.v2.${id}`;
const DRAFT = 'qss.draft.v2';

export interface ProjectMeta {
	id: string;
	title: string;
	surah: number;
	rows: number;
	updatedAt: number;
}

function read<T>(k: string, fallback: T): T {
	try {
		const v = localStorage.getItem(k);
		return v ? (JSON.parse(v) as T) : fallback;
	} catch {
		return fallback;
	}
}
function write(k: string, v: unknown) {
	try {
		localStorage.setItem(k, JSON.stringify(v));
		return true;
	} catch {
		return false;
	}
}

export const listLocal = (): ProjectMeta[] => read<ProjectMeta[]>(INDEX, []).sort((a, b) => b.updatedAt - a.updatedAt);

export function saveLocal(p: Project): boolean {
	const updated = { ...p, updatedAt: Date.now() };
	if (!write(KEY(p.id), updated)) return false;
	const meta: ProjectMeta = { id: p.id, title: projectTitle(p), surah: p.surah, rows: p.rows.length, updatedAt: updated.updatedAt };
	write(INDEX, [meta, ...listLocal().filter((m) => m.id !== p.id)]);
	return true;
}

export function getLocal(id: string): Project | null {
	const raw = read<unknown>(KEY(id), null);
	if (!raw) return null;
	try {
		return normalizeProject(raw);
	} catch {
		return null;
	}
}

export function deleteLocal(id: string) {
	try {
		localStorage.removeItem(KEY(id));
	} catch {
		/* abaikan */
	}
	write(INDEX, listLocal().filter((m) => m.id !== id));
}

export const saveDraft = (p: Project) => write(DRAFT, p);
export function getDraft(): Project | null {
	const raw = read<unknown>(DRAFT, null);
	if (!raw) return null;
	try {
		return normalizeProject(raw);
	} catch {
		return null;
	}
}

export function getPref<T>(k: string, fallback: T): T {
	return read<T>(`qss.pref.${k}`, fallback);
}
export function setPref(k: string, v: unknown) {
	write(`qss.pref.${k}`, v);
}
