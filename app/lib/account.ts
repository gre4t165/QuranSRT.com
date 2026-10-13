// Klien API akun, proyek cloud, dan pembayaran (PHP + MySQL di /api).
export type Plan = 'free' | 'pro' | 'lembaga';

export interface CloudUser {
	id: number;
	email: string;
	name: string;
	plan: Plan;
	planUntil: number; // unix detik, 0 = tidak ada masa aktif
	verified: boolean;
	marketing: boolean;
	lang: 'id' | 'en';
}

export class ApiError extends Error {
	constructor(message: string, public status: number, public code?: string) {
		super(message);
	}
}

export async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
	const method = init.method ?? (init.body === undefined ? 'GET' : 'POST');
	const headers: Record<string, string> = {};
	if (method !== 'GET') headers['X-QSS'] = '1';
	if (init.body !== undefined) headers['Content-Type'] = 'application/json';
	let r: Response;
	try {
		r = await fetch(path, { method, headers, credentials: 'same-origin', body: init.body === undefined ? undefined : JSON.stringify(init.body) });
	} catch {
		throw new ApiError('Tidak bisa terhubung ke server.', 0);
	}
	const j = (await r.json().catch(() => ({}))) as T & { error?: string; code?: string };
	if (!r.ok) throw new ApiError(j.error || `HTTP ${r.status}`, r.status, j.code);
	return j;
}

// ---------- Akun ----------
export const apiMe = () => call<{ user: CloudUser | null }>('/api/auth.php?a=me').then((r) => r.user);
export const apiSignup = (b: { email: string; password: string; name: string; lang: 'id' | 'en'; marketing: boolean }) => call<{ ok: true }>('/api/auth.php?a=signup', { body: b });
export const apiLogin = (email: string, password: string) => call<{ user: CloudUser }>('/api/auth.php?a=login', { body: { email, password } }).then((r) => r.user);
export const apiLogout = () => call<{ ok: true }>('/api/auth.php?a=logout', { body: {} });
export const apiVerify = (token: string) => call<{ user: CloudUser }>('/api/auth.php?a=verify', { body: { token } }).then((r) => r.user);
export const apiResend = () => call<{ ok: true }>('/api/auth.php?a=resend', { body: {} });
export const apiForgot = (email: string) => call<{ ok: true }>('/api/auth.php?a=forgot', { body: { email } });
export const apiReset = (token: string, password: string) => call<{ ok: true }>('/api/auth.php?a=reset', { body: { token, password } });
export const apiProfile = (b: { name?: string; marketing?: boolean }) => call<{ user: CloudUser }>('/api/auth.php?a=profile', { body: b }).then((r) => r.user);

// ---------- Pembayaran ----------
export interface PayProduct {
	id: string;
	plan: Plan;
	months: number;
	idr: number;
	usd: number;
	label: string;
}
export interface PayConfig {
	xendit: boolean;
	paypal: boolean;
	products: PayProduct[];
	donation: { minIdr: number; minUsd: number; url: string };
}
let payCfgP: Promise<PayConfig | null> | null = null;
export const loadPayConfig = () => (payCfgP ??= call<PayConfig>('/api/pay.php?a=config').catch(() => null));
export const apiCheckout = (b: { product: string; provider: 'xendit' | 'paypal'; amount?: number; email?: string }) => call<{ url: string; paymentId: number }>('/api/pay.php?a=checkout', { body: b });
export const apiPaypalCapture = (orderId: string) => call<{ status: 'paid' }>('/api/pay.php?a=paypal_capture', { body: { orderId } });
export interface PaymentRow {
	id: number;
	product: string;
	provider: string;
	amount: string;
	currency: 'IDR' | 'USD';
	status: 'pending' | 'paid' | 'failed' | 'expired';
	created_at: number;
	paid_at: number;
}
export const apiHistory = () => call<{ items: PaymentRow[] }>('/api/pay.php?a=history').then((r) => r.items);

export const money = (cur: 'IDR' | 'USD', n: number | string) => {
	const v = Number(n);
	return cur === 'IDR' ? 'Rp' + Math.round(v).toLocaleString('id-ID') : '$' + v.toFixed(2);
};
