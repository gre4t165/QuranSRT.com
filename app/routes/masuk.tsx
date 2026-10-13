import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { Loader2, MailCheck } from 'lucide-react';
import type { Route } from './+types/masuk';
import { seo } from '~/lib/seo';
import { useT } from '~/lib/i18n';
import { setAuthUser, useAuth } from '~/lib/useAuth';
import { apiLogin, apiSignup } from '~/lib/account';
import { safeNext } from '~/lib/nav';

export const meta: Route.MetaFunction = ({ location }) =>
	seo({ title: location.pathname.startsWith('/daftar') ? 'Daftar' : 'Masuk', description: 'Masuk atau daftar akun Quran SRT Studio untuk menyimpan proyek di cloud.', path: location.pathname, noindex: true });

export default function Masuk() {
	const { t, lang } = useT();
	const { pathname } = useLocation();
	const signup = pathname.startsWith('/daftar');
	const auth = useAuth();
	const nav = useNavigate();
	const [sp] = useSearchParams();
	const next = safeNext(sp.get('next'));
	const [f, setF] = useState({ name: '', email: '', password: '', marketing: false });
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState('');
	const [sent, setSent] = useState(false);

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		setBusy(true);
		setErr('');
		try {
			if (signup) {
				await apiSignup({ email: f.email, password: f.password, name: f.name, lang, marketing: f.marketing });
				setSent(true);
			} else {
				setAuthUser(await apiLogin(f.email, f.password));
				nav(next);
			}
		} catch (x) {
			setErr((x as Error).message);
		} finally {
			setBusy(false);
		}
	};

	if (auth.ready && !auth.enabled) {
		return (
			<div className="auth-wrap">
				<div className="card auth-card">
					<h1>{t('Akun belum diaktifkan', 'Accounts are not enabled')}</h1>
					<p className="sub">{t('Semua fitur Studio bisa dipakai tanpa akun. Proyek disimpan di browser Anda dan bisa diekspor sebagai file .json.', 'Every Studio feature works without an account. Projects are kept in your browser and can be exported as .json.')}</p>
					<Link className="btn btn-primary" to="/studio">{t('Buka Studio', 'Open Studio')}</Link>
				</div>
			</div>
		);
	}

	if (sent) {
		return (
			<div className="auth-wrap">
				<div className="card auth-card">
					<h1><MailCheck size={26} style={{ verticalAlign: '-4px' }} /> {t('Cek email Anda', 'Check your email')}</h1>
					<p className="sub">{t(`Kami mengirim tautan aktivasi ke ${f.email}. Klik tautan itu untuk mengaktifkan akun. Bila tidak ada, periksa folder spam.`, `We sent an activation link to ${f.email}. Click it to activate your account. If you do not see it, check spam.`)}</p>
					<Link className="btn" to="/masuk">{t('Ke halaman masuk', 'Go to sign in')}</Link>
				</div>
			</div>
		);
	}

	return (
		<div className="auth-wrap">
			<form className="card auth-card" onSubmit={submit}>
				<h1>{signup ? t('Buat akun', 'Create account') : t('Masuk', 'Sign in')}</h1>
				<p className="sub">{t('Simpan proyek di cloud dan buka dari perangkat mana pun.', 'Keep projects in the cloud and open them on any device.')}</p>
				{signup && <label className="field"><span>{t('Nama', 'Name')}</span><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" maxLength={120} /></label>}
				<label className="field"><span>Email</span><input className="input" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" /></label>
				<label className="field"><span>{t('Kata sandi', 'Password')}</span><input className="input" type="password" required minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete={signup ? 'new-password' : 'current-password'} />{signup && <small className="sub">{t('Minimal 8 karakter.', 'At least 8 characters.')}</small>}</label>
				{signup && (
					<label className="check"><input type="checkbox" checked={f.marketing} onChange={(e) => setF({ ...f, marketing: e.target.checked })} /> {t('Kirimi saya tips dan kabar fitur baru lewat email (bisa berhenti kapan saja).', 'Send me tips and product news by email (unsubscribe any time).')}</label>
				)}
				{err && <div className="notice error">{err}</div>}
				<button className="btn btn-primary btn-lg" disabled={busy || !auth.ready}>{busy && <Loader2 size={17} className="spin" />} {signup ? t('Daftar', 'Sign up') : t('Masuk', 'Sign in')}</button>
				{!signup && <p className="sub"><Link to="/lupa-sandi">{t('Lupa kata sandi?', 'Forgot password?')}</Link></p>}
				{signup && <p className="sub">{t('Dengan mendaftar Anda menyetujui', 'By signing up you agree to the')} <Link to="/syarat">{t('Syarat layanan', 'Terms')}</Link> {t('dan', 'and')} <Link to="/privasi">{t('Kebijakan privasi', 'Privacy policy')}</Link>.</p>}
				<p className="sub">
					{signup ? t('Sudah punya akun?', 'Already have an account?') : t('Belum punya akun?', 'No account yet?')} <Link to={(signup ? '/masuk' : '/daftar') + (sp.get('next') ? `?next=${encodeURIComponent(next)}` : '')}>{signup ? t('Masuk', 'Sign in') : t('Daftar gratis', 'Sign up free')}</Link>
				</p>
			</form>
		</div>
	);
}
