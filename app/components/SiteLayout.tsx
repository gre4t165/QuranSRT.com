import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { useEffect, useState } from 'react';
import { Menu, Moon, Sun, X, FolderOpen, LogIn, UserRound } from 'lucide-react';
import { Logo } from './Logo';
import { useT } from '~/lib/i18n';
import { useAppConfig } from '~/lib/config';
import { useAuth } from '~/lib/useAuth';

export default function SiteLayout() {
	const { t, lang, setLang, theme, setTheme } = useT();
	const cfg = useAppConfig();
	const auth = useAuth();
	const [open, setOpen] = useState(false);
	const loc = useLocation();
	const isStudio = loc.pathname.startsWith('/studio');
	useEffect(() => setOpen(false), [loc.pathname]);

	const nav = [
		{ to: '/studio', label: 'Studio' },
		{ to: '/panduan', label: t('Panduan', 'Guide') },
		{ to: '/harga', label: t('Harga', 'Pricing') },
		{ to: '/tentang', label: t('Tentang', 'About') },
		{ to: '/kontak', label: t('Kontak', 'Contact') },
	];
	const dark = theme === 'dark' || (theme === 'system' && typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark');

	return (
		<>
			<a className="skip" href="#konten">{t('Lewati ke konten', 'Skip to content')}</a>
			{cfg.announcement && <div className="announce">{cfg.announcement}</div>}
			<header className="site-header">
				<div className="inner" style={isStudio ? { maxWidth: 1600 } : undefined}>
					<Link to="/" className="logo" aria-label="Quran SRT Studio — beranda">
						<Logo />
					</Link>
					<nav className="main-nav" aria-label={t('Navigasi utama', 'Main navigation')}>
						{nav.map((n) => (
							<NavLink key={n.to} to={n.to}>
								{n.label}
							</NavLink>
						))}
					</nav>
					<div className="header-tools">
						<button className="btn btn-ghost btn-sm" onClick={() => setLang(lang === 'id' ? 'en' : 'id')} aria-label={t('Ganti bahasa ke English', 'Switch language to Indonesian')}>
							{lang === 'id' ? 'EN' : 'ID'}
						</button>
						<button className="btn btn-ghost btn-icon" onClick={() => setTheme(dark ? 'light' : 'dark')} aria-label={dark ? t('Mode terang', 'Light mode') : t('Mode gelap', 'Dark mode')}>
							{dark ? <Sun size={18} /> : <Moon size={18} />}
						</button>
						<Link to="/proyek" className="btn btn-ghost btn-sm hide-sm">
							<FolderOpen size={16} /> {t('Proyek', 'Projects')}
						</Link>
						{auth.enabled && !auth.user && (
							<Link to="/masuk" className="btn btn-ghost btn-sm hide-sm">
								<LogIn size={16} /> {t('Masuk', 'Sign in')}
							</Link>
						)}
						{auth.enabled && auth.user && (
							<Link to="/akun" className="btn btn-ghost btn-sm hide-sm" title={auth.user.email}>
								<UserRound size={16} /> {t('Akun', 'Account')}
							</Link>
						)}
						{!isStudio && (
							<Link to="/studio" className="btn btn-primary btn-sm hide-sm">
								{t('Buka Studio', 'Open Studio')}
							</Link>
						)}
						<button className="btn btn-ghost btn-icon menu-btn" aria-expanded={open} aria-controls="mnav" onClick={() => setOpen(!open)} aria-label="Menu">
							{open ? <X size={20} /> : <Menu size={20} />}
						</button>
					</div>
				</div>
				<nav id="mnav" className="mobile-nav" data-open={open} aria-label={t('Navigasi seluler', 'Mobile navigation')}>
					{nav.map((n) => (
						<Link key={n.to} to={n.to}>
							{n.label}
						</Link>
					))}
					<Link to="/proyek">{t('Proyek saya', 'My projects')}</Link>
					{auth.enabled && !auth.user && <Link to="/masuk">{t('Masuk', 'Sign in')}</Link>}
					{auth.enabled && auth.user && <Link to="/akun">{t('Akun', 'Account')}</Link>}
					<Link to="/donasi">{t('Donasi', 'Donate')}</Link>
				</nav>
			</header>
			<main id="konten">
				<Outlet />
			</main>
			{!isStudio && <SiteFooter />}
		</>
	);
}

function SiteFooter() {
	const { t } = useT();
	const year = new Date().getFullYear();
	return (
		<footer className="site-footer">
			<div className="inner">
				<div>
					<Link to="/" className="logo">
						<Logo />
					</Link>
					<p className="about">{t('Alat gratis untuk membuat subtitle Al-Qur’an yang sinkron dengan murotal. Semua diproses di perangkat Anda.', 'A free tool for Quran subtitles in sync with recitation. Everything runs on your device.')}</p>
				</div>
				<div>
					<h4>{t('Produk', 'Product')}</h4>
					<ul>
						<li><Link to="/studio">Studio</Link></li>
						<li><Link to="/proyek">{t('Proyek saya', 'My projects')}</Link></li>
						<li><Link to="/harga">{t('Harga', 'Pricing')}</Link></li>
						<li><Link to="/donasi">{t('Donasi', 'Donate')}</Link></li>
					</ul>
				</div>
				<div>
					<h4>{t('Belajar', 'Learn')}</h4>
					<ul>
						<li><Link to="/panduan">{t('Panduan lengkap', 'Full guide')}</Link></li>
						<li><Link to="/panduan#capcut">{t('Subtitle di CapCut', 'Subtitles in CapCut')}</Link></li>
						<li><Link to="/panduan#tap-sync">{t('Cara tap-sync', 'How to tap-sync')}</Link></li>
					</ul>
				</div>
				<div>
					<h4>{t('Tentang', 'About')}</h4>
					<ul>
						<li><Link to="/tentang">{t('Tentang kami', 'About us')}</Link></li>
						<li><Link to="/kontak">{t('Kontak', 'Contact')}</Link></li>
						<li><Link to="/privasi">{t('Kebijakan privasi', 'Privacy policy')}</Link></li>
						<li><Link to="/syarat">{t('Syarat layanan', 'Terms of service')}</Link></li>
					</ul>
				</div>
			</div>
			<div className="legal">
				<span>© {year} Quran SRT Studio</span>
				<span>{t('Teks Al-Qur’an & terjemahan: QuranEnc.com · Transliterasi: Tanzil.net · Audio: EveryAyah.com', 'Quran text & translations: QuranEnc.com · Transliteration: Tanzil.net · Audio: EveryAyah.com')}</span>
			</div>
		</footer>
	);
}
