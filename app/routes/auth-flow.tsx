import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { CheckCircle2, Loader2 } from 'lucide-react';
import type { Route } from './+types/auth-flow';
import { seo } from '~/lib/seo';
import { useT } from '~/lib/i18n';
import { apiForgot, apiReset, apiVerify } from '~/lib/account';
import { setAuthUser } from '~/lib/useAuth';

export const meta: Route.MetaFunction = ({ location }) => seo({ title: 'Akun', description: 'Verifikasi email dan atur ulang kata sandi Quran SRT Studio.', path: location.pathname, noindex: true });

/** Satu modul untuk /lupa-sandi, /atur-ulang (dengan ?t=token) dan /verifikasi (dengan ?t=token). */
export default function AuthFlow() {
	const { pathname } = useLocation();
	if (pathname.startsWith('/verifikasi')) return <Verify />;
	if (pathname.startsWith('/atur-ulang')) return <ResetPw />;
	return <Forgot />;
}

function Shell({ children }: { children: React.ReactNode }) {
	return (
		<div className="auth-wrap">
			<div className="card auth-card">{children}</div>
		</div>
	);
}

function Verify() {
	const { t } = useT();
	const [sp] = useSearchParams();
	const nav = useNavigate();
	const [state, setState] = useState<'busy' | 'ok' | 'err'>('busy');
	const [msg, setMsg] = useState('');
	const ran = useRef(false);
	useEffect(() => {
		if (ran.current) return; // StrictMode: token hanya sekali pakai
		ran.current = true;
		apiVerify(sp.get('t') ?? '')
			.then((u) => {
				setAuthUser(u);
				setState('ok');
				setTimeout(() => nav('/akun'), 1800);
			})
			.catch((e: Error) => {
				setMsg(e.message);
				setState('err');
			});
	}, [sp, nav]);
	return (
		<Shell>
			{state === 'busy' && <h1><Loader2 className="spin" size={22} /> {t('Mengaktifkan akun…', 'Activating account…')}</h1>}
			{state === 'ok' && (<><h1><CheckCircle2 size={26} style={{ verticalAlign: '-4px' }} /> {t('Email terverifikasi', 'Email verified')}</h1><p className="sub">{t('Akun Anda aktif dan sudah masuk. Mengalihkan…', 'Your account is active and you are signed in. Redirecting…')}</p></>)}
			{state === 'err' && (<><h1>{t('Tautan tidak berlaku', 'Link not valid')}</h1><div className="notice error">{msg}</div><p className="sub">{t('Masuk, lalu minta kirim ulang email verifikasi dari halaman Akun.', 'Sign in, then resend the verification email from the Account page.')}</p><Link className="btn btn-primary" to="/masuk?next=/akun">{t('Masuk', 'Sign in')}</Link></>)}
		</Shell>
	);
}

function Forgot() {
	const { t } = useT();
	const [email, setEmail] = useState('');
	const [busy, setBusy] = useState(false);
	const [done, setDone] = useState(false);
	const [err, setErr] = useState('');
	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		setBusy(true);
		setErr('');
		try {
			await apiForgot(email);
			setDone(true);
		} catch (x) {
			setErr((x as Error).message);
		} finally {
			setBusy(false);
		}
	};
	if (done) return <Shell><h1>{t('Cek email Anda', 'Check your email')}</h1><p className="sub">{t('Bila email itu terdaftar, tautan untuk membuat kata sandi baru sudah dikirim. Tautan berlaku 1 jam.', 'If that email is registered, a link to choose a new password has been sent. It is valid for 1 hour.')}</p></Shell>;
	return (
		<div className="auth-wrap">
			<form className="card auth-card" onSubmit={submit}>
				<h1>{t('Lupa kata sandi', 'Forgot password')}</h1>
				<p className="sub">{t('Masukkan email akun Anda. Kami kirim tautan untuk membuat kata sandi baru.', 'Enter your account email. We will send a link to choose a new password.')}</p>
				<label className="field"><span>Email</span><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
				{err && <div className="notice error">{err}</div>}
				<button className="btn btn-primary btn-lg" disabled={busy}>{busy && <Loader2 size={17} className="spin" />} {t('Kirim tautan', 'Send link')}</button>
			</form>
		</div>
	);
}

function ResetPw() {
	const { t } = useT();
	const [sp] = useSearchParams();
	const [pw, setPw] = useState('');
	const [busy, setBusy] = useState(false);
	const [done, setDone] = useState(false);
	const [err, setErr] = useState('');
	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		setBusy(true);
		setErr('');
		try {
			await apiReset(sp.get('t') ?? '', pw);
			setDone(true);
		} catch (x) {
			setErr((x as Error).message);
		} finally {
			setBusy(false);
		}
	};
	if (done) return <Shell><h1><CheckCircle2 size={26} style={{ verticalAlign: '-4px' }} /> {t('Kata sandi diganti', 'Password changed')}</h1><p className="sub">{t('Semua perangkat dikeluarkan demi keamanan. Silakan masuk dengan kata sandi baru.', 'All devices were signed out for safety. Please sign in with your new password.')}</p><Link className="btn btn-primary" to="/masuk">{t('Masuk', 'Sign in')}</Link></Shell>;
	return (
		<div className="auth-wrap">
			<form className="card auth-card" onSubmit={submit}>
				<h1>{t('Kata sandi baru', 'New password')}</h1>
				<label className="field"><span>{t('Kata sandi', 'Password')}</span><input className="input" type="password" required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /><small className="sub">{t('Minimal 8 karakter.', 'At least 8 characters.')}</small></label>
				{err && <div className="notice error">{err} <Link to="/lupa-sandi">{t('Minta tautan baru', 'Request a new link')}</Link></div>}
				<button className="btn btn-primary btn-lg" disabled={busy}>{busy && <Loader2 size={17} className="spin" />} {t('Simpan', 'Save')}</button>
			</form>
		</div>
	);
}
