// Proyek cloud milik akun yang sedang masuk (API PHP + MySQL).
import { call } from './account';
import { normalizeProject, projectTitle, type Project } from './project';

export type { Plan, CloudUser } from './account';
export const FREE_CLOUD_LIMIT = 3;

export interface CloudMeta {
	id: string;
	title: string;
	surah: number;
	updatedAt: number;
}

export async function listCloud(): Promise<CloudMeta[]> {
	const r = await call<{ items: { id: number; title: string; surah: number; updatedAt: number }[] }>('/api/projects.php');
	return r.items.map((x) => ({ id: String(x.id), title: x.title, surah: x.surah, updatedAt: x.updatedAt }));
}

export async function getCloud(id: string): Promise<Project> {
	const r = await call<{ id: number; data: Record<string, unknown> }>(`/api/projects.php?id=${encodeURIComponent(id)}`);
	return normalizeProject({ ...r.data, cloudId: String(r.id) });
}

/** Simpan ke cloud. Mengembalikan id proyek. Melempar ApiError(code 'limit') bila batas paket tercapai. */
export async function saveCloud(p: Project, cloudId?: string): Promise<string> {
	const r = await call<{ id: number }>('/api/projects.php', { body: { id: cloudId ? Number(cloudId) : undefined, name: projectTitle(p).slice(0, 120), surah: p.surah, data: p } });
	return String(r.id);
}

export const deleteCloud = (id: string) => call<{ ok: true }>(`/api/projects.php?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
