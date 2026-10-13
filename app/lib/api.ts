// Endpoint PHP opsional di /api (Asisten Konten Claude & formulir kontak).
// Bila PHP belum dikonfigurasi, fitur terkait otomatis disembunyikan/diganti.

export interface ServerStatus {
	ai: boolean;
	contact: boolean;
	accounts: boolean;
}

let statusP: Promise<ServerStatus> | null = null;
export function serverStatus(): Promise<ServerStatus> {
	if (!statusP) {
		statusP = fetch('/api/status.php', { cache: 'no-cache' })
			.then(async (r) => {
				if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) throw new Error('no php');
				const j = (await r.json()) as Partial<ServerStatus>;
				return { ai: !!j.ai, contact: !!j.contact, accounts: !!j.accounts };
			})
			.catch(() => ({ ai: false, contact: false, accounts: false }));
	}
	return statusP;
}

async function post<T>(path: string, body: unknown): Promise<T> {
	const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
	const j = (await r.json().catch(() => ({}))) as T & { error?: string };
	if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
	return j;
}

export interface AiResult {
	titles: string[];
	description: string;
	hashtags: string[];
	thumbnail: string[];
}

export const aiSuggest = (payload: { surah: string; meaning: string; range: string; reciter: string; translations: string[]; lang: 'id' | 'en'; platform: string }) =>
	post<AiResult>('/api/claude.php', payload);

export const sendContact = (payload: { name: string; email: string; topic: string; message: string; website: string }) => post<{ ok: true }>('/api/contact.php', payload);

export interface AlignResult {
	id?: string[];
	en?: string[];
	model?: string;
}

/** Claude memilih titik potong terjemahan untuk potongan ayat; server memotong teks aslinya. */
export const aiAlign = (payload: { surah: string; ayah: number; ar: string[]; translations: { id?: string; en?: string } }) => post<AlignResult>('/api/align.php', payload);

/** Statistik pemakaian anonim (tanpa data pribadi). Gagal diam-diam bila PHP tidak ada. */
export function track(event: string) {
	if (typeof window === 'undefined' || /^(localhost|127\.)/.test(location.hostname)) return;
	try {
		const body = JSON.stringify({ event });
		if (navigator.sendBeacon) navigator.sendBeacon('/api/stats.php', new Blob([body], { type: 'application/json' }));
		else void fetch('/api/stats.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => undefined);
	} catch {
		/* abaikan */
	}
}
