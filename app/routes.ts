import { type RouteConfig, index, route, layout } from '@react-router/dev/routes';

export default [
	layout('components/SiteLayout.tsx', [
		index('routes/home.tsx'),
		route('panduan', 'routes/panduan.tsx'),
		route('harga', 'routes/harga.tsx'),
		route('tentang', 'routes/tentang.tsx'),
		route('kontak', 'routes/kontak.tsx'),
		route('privasi', 'routes/privasi.tsx'),
		route('syarat', 'routes/syarat.tsx'),
		route('proyek', 'routes/proyek.tsx'),
		route('masuk', 'routes/masuk.tsx', { id: 'masuk' }),
		route('daftar', 'routes/masuk.tsx', { id: 'daftar' }),
		route('lupa-sandi', 'routes/auth-flow.tsx', { id: 'lupa' }),
		route('atur-ulang', 'routes/auth-flow.tsx', { id: 'atur-ulang' }),
		route('verifikasi', 'routes/auth-flow.tsx', { id: 'verifikasi' }),
		route('akun', 'routes/akun.tsx'),
		route('donasi', 'routes/donasi.tsx'),
		route('studio', 'routes/studio.tsx'),
		route('*', 'routes/not-found.tsx'),
	]),
] satisfies RouteConfig;
