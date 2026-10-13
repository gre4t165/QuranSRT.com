import { useEffect, useSyncExternalStore } from 'react';
import { apiLogout, apiMe, type CloudUser } from './account';
import { serverStatus } from './api';

interface AuthState {
	user: CloudUser | null;
	/** true bila server punya database akun (api/config.php terisi). */
	enabled: boolean;
	/** true setelah status akun selesai dicek. */
	ready: boolean;
}

// Satu sumber kebenaran untuk seluruh aplikasi: login di satu halaman langsung terlihat di semua komponen.
let state: AuthState = { user: null, enabled: false, ready: false };
const subs = new Set<() => void>();
const SERVER_STATE: AuthState = { user: null, enabled: false, ready: false };
const set = (p: Partial<AuthState>) => {
	state = { ...state, ...p };
	subs.forEach((f) => f());
};

let started = false;
async function init() {
	if (started) return;
	started = true;
	const st = await serverStatus();
	if (!st.accounts) {
		set({ ready: true, enabled: false });
		return;
	}
	try {
		set({ enabled: true, user: await apiMe(), ready: true });
	} catch {
		set({ enabled: true, ready: true });
	}
}

export const setAuthUser = (user: CloudUser | null) => set({ user });
export const refreshAuth = async () => {
	try {
		set({ user: await apiMe() });
	} catch {
		/* biarkan state lama */
	}
};
export async function signOut() {
	try {
		await apiLogout();
	} finally {
		set({ user: null });
	}
}

export function useAuth() {
	const s = useSyncExternalStore(
		(f) => {
			subs.add(f);
			return () => subs.delete(f);
		},
		() => state,
		() => SERVER_STATE,
	);
	useEffect(() => {
		void init();
	}, []);
	return s;
}
