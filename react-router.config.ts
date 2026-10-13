import type { Config } from '@react-router/dev/config';

// Situs statis: semua halaman pemasaran di-prerender jadi HTML (bagus untuk SEO),
// halaman lain berjalan sebagai SPA. Hasil build ada di build/client → unggah ke hosting.
export default {
	appDirectory: 'app',
	ssr: false,
	prerender: ['/', '/studio', '/panduan', '/harga', '/tentang', '/kontak', '/privasi', '/syarat', '/proyek', '/masuk', '/daftar', '/lupa-sandi', '/atur-ulang', '/verifikasi', '/akun', '/donasi'],
} satisfies Config;
