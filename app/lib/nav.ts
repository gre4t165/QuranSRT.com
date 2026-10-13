/** Tujuan setelah masuk: hanya jalur internal, mencegah open-redirect. */
export function safeNext(v: string | null | undefined, fallback = '/proyek'): string {
	return v && /^\/(?![/\\])/.test(v) ? v : fallback;
}
