import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Lang = 'id' | 'en';
export type Theme = 'light' | 'dark' | 'system';

interface Ctx {
	lang: Lang;
	setLang: (l: Lang) => void;
	t: (id: string, en: string) => string;
	theme: Theme;
	setTheme: (t: Theme) => void;
}

const LangCtx = createContext<Ctx>({ lang: 'id', setLang: () => {}, t: (id) => id, theme: 'system', setTheme: () => {} });

export function applyTheme(t: Theme) {
	const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
	document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

export function AppProvider({ children }: { children: ReactNode }) {
	// Prerender selalu dalam Bahasa Indonesia; pilihan pengguna diterapkan setelah halaman dimuat.
	const [lang, setLangState] = useState<Lang>('id');
	const [theme, setThemeState] = useState<Theme>('system');

	useEffect(() => {
		try {
			const l = localStorage.getItem('qss.lang');
			if (l === 'en' || l === 'id') setLangState(l);
			const th = localStorage.getItem('qss.theme');
			if (th === 'light' || th === 'dark' || th === 'system') setThemeState(th);
		} catch {
			/* abaikan */
		}
	}, []);

	useEffect(() => {
		document.documentElement.lang = lang;
	}, [lang]);

	useEffect(() => {
		applyTheme(theme);
		if (theme !== 'system') return;
		const mq = window.matchMedia('(prefers-color-scheme: dark)');
		const fn = () => applyTheme('system');
		mq.addEventListener('change', fn);
		return () => mq.removeEventListener('change', fn);
	}, [theme]);

	const setLang = useCallback((l: Lang) => {
		setLangState(l);
		try {
			localStorage.setItem('qss.lang', l);
		} catch {
			/* abaikan */
		}
	}, []);
	const setTheme = useCallback((t: Theme) => {
		setThemeState(t);
		try {
			localStorage.setItem('qss.theme', t);
		} catch {
			/* abaikan */
		}
	}, []);
	const t = useCallback((id: string, en: string) => (lang === 'en' ? en : id), [lang]);
	const value = useMemo(() => ({ lang, setLang, t, theme, setTheme }), [lang, setLang, t, theme, setTheme]);
	return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>;
}

export const useT = () => useContext(LangCtx);
