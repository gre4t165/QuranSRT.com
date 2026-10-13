import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration, useLocation } from 'react-router';
import { useEffect } from 'react';
import type { Route } from './+types/root';
import '@fontsource-variable/plus-jakarta-sans/wght.css';
import '@fontsource-variable/plus-jakarta-sans/wght-italic.css';
import '@fontsource/amiri-quran/arabic-400.css';
import '@fontsource/scheherazade-new/arabic-400.css';
import '@fontsource/noto-naskh-arabic/arabic-400.css';
import '@fontsource/reem-kufi/arabic-400.css';
import stylesheet from './styles/app.css?url';
import { AppProvider } from './lib/i18n';
import { SITE_URL } from './lib/seo';

export const links: Route.LinksFunction = () => [
	{ rel: 'stylesheet', href: stylesheet },
	{ rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
	{ rel: 'apple-touch-icon', href: '/icon-192.png' },
	{ rel: 'manifest', href: '/manifest.webmanifest' },
];

// Terapkan tema sebelum halaman tergambar (mencegah kedipan putih di mode gelap).
const themeScript = `(function(){try{var t=localStorage.getItem('qss.theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';var l=localStorage.getItem('qss.lang');if(l)document.documentElement.lang=l;}catch(e){}})();`;

export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="id" data-theme="light">
			<head>
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<meta name="theme-color" content="#0e3b33" />
				<script dangerouslySetInnerHTML={{ __html: themeScript }} />
				<Meta />
				<Links />
			</head>
			<body>
				{children}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

function CanonicalFallback() {
	const { pathname } = useLocation();
	useEffect(() => {
		if (SITE_URL) return;
		let el = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
		if (!el) {
			el = document.createElement('link');
			el.rel = 'canonical';
			document.head.appendChild(el);
		}
		el.href = location.origin + pathname;
		document.querySelectorAll<HTMLMetaElement>('meta[property="og:image"],meta[name="twitter:image"]').forEach((m) => {
			if (m.content.startsWith('/')) m.content = location.origin + m.content;
		});
	}, [pathname]);
	return null;
}

export default function App() {
	return (
		<AppProvider>
			<CanonicalFallback />
			<Outlet />
		</AppProvider>
	);
}

export function HydrateFallback() {
	return null;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	let title = 'Terjadi kesalahan';
	let detail = 'Muat ulang halaman. Bila masih terjadi, kembali ke beranda.';
	if (isRouteErrorResponse(error) && error.status === 404) {
		title = 'Halaman tidak ditemukan';
		detail = 'Alamat yang Anda buka tidak ada.';
	} else if (import.meta.env.DEV && error instanceof Error) detail = error.message;
	return (
		<main className="prose-page">
			<h1>{title}</h1>
			<p className="lead">{detail}</p>
			<a className="btn btn-primary" href="/">Kembali ke beranda</a>
		</main>
	);
}
