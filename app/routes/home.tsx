import { Link } from 'react-router';
import { useEffect, useState } from 'react';
import { ArrowRight, AudioLines, Check, Clapperboard, FileText, Hand, Languages, Layers, MonitorSmartphone, Palette, ShieldCheck, Sparkles, Timer, Users, School, Mic2, Scissors, Type, BookOpen } from 'lucide-react';
import type { Route } from './+types/home';
import { seo, SITE_URL } from '~/lib/seo';
import { useT } from '~/lib/i18n';
import { FATIHAH_SAMPLE } from '~/data/sample';
import { ayahMarker } from '~/lib/quran';
import { stampSrt } from '~/lib/time';

const FAQ_ID: [string, string][] = [
	['Apakah Quran SRT Studio gratis?', 'Ya. Semua fitur inti — memilih ayat, sinkron dengan qari, tap-sync, ekspor SRT/VTT/ASS, dan ekspor video — bisa dipakai gratis tanpa daftar.'],
	['Apakah audio saya diunggah ke server?', 'Tidak. File audio atau video yang Anda pilih diproses langsung di browser Anda dan tidak pernah dikirim ke server kami.'],
	['Dari mana teks Al-Qur’an dan terjemahannya?', 'Teks Utsmani dan terjemahan Indonesia/Inggris berasal dari QuranEnc.com, transliterasi dari Tanzil.net. Teks Arab dikunci di Studio agar tidak berubah.'],
	['Bisa dipakai di CapCut?', 'Bisa. Unduh file .SRT, lalu di CapCut pilih Teks → Impor subtitle (atau Captions → Import). Untuk video vertikal, pilih rasio 9:16 di Studio agar pratinjau sesuai.'],
	['Qari siapa saja yang tersedia?', 'Lebih dari 20 qari, antara lain Mishary Alafasy, Abdul Basit, Al-Husary, Al-Minshawi, As-Sudais, Asy-Syuraim, Maher Al-Muaiqly, dan Yasser Ad-Dossari.'],
	['Bagaimana kalau saya punya rekaman murotal sendiri?', 'Unggah filenya. Gunakan “Sinkron otomatis” untuk perkiraan dari jeda bacaan, lalu rapikan dengan Tap-sync atau menarik tepi blok di linimasa.'],
	['Apakah bisa dipakai di HP?', 'Bisa untuk memilih ayat, sinkron dengan qari, dan mengunduh SRT. Untuk tap-sync dan ekspor video, komputer dengan Chrome atau Edge memberi hasil terbaik.'],
	['Bagaimana menyimpan pekerjaan?', 'Klik Simpan (Ctrl+S) untuk menyimpan di browser, atau ekspor proyek sebagai file .json untuk dibuka di perangkat lain.'],
];

const FAQ_EN: [string, string][] = [
	['Is Quran SRT Studio free?', 'Yes. All core features — choosing verses, syncing with reciters, tap-sync, SRT/VTT/ASS export and video export — are free with no sign-up.'],
	['Is my audio uploaded to a server?', 'No. Audio or video you choose is processed in your browser and never sent to our server.'],
	['Where do the Quran text and translations come from?', 'Uthmani text and Indonesian/English translations come from QuranEnc.com, transliteration from Tanzil.net. Arabic text is locked in the Studio.'],
	['Does it work with CapCut?', 'Yes. Download the .SRT, then in CapCut use Text → Import captions. For vertical video, choose 9:16 in the Studio.'],
	['Which reciters are available?', 'More than 20, including Mishary Alafasy, Abdul Basit, Al-Husary, Al-Minshawi, As-Sudais, Ash-Shuraim, Maher Al-Muaiqly and Yasser Ad-Dossari.'],
	['What if I have my own recording?', 'Upload it. Use Auto-sync for an estimate from pauses, then refine with Tap-sync or by dragging blocks on the timeline.'],
	['Does it work on phones?', 'Yes for choosing verses, syncing with reciters and downloading SRT. For tap-sync and video export, desktop Chrome or Edge works best.'],
	['How do I save my work?', 'Click Save (Ctrl+S) to keep it in your browser, or export the project as a .json file to open elsewhere.'],
];

export const meta: Route.MetaFunction = () =>
	seo({
		title: 'Quran SRT Studio — buat subtitle Al-Qur’an sinkron dengan murotal',
		description: 'Buat subtitle Al-Qur’an (SRT, VTT, ASS) dan video ayat yang sinkron dengan murotal 20+ qari. 114 surah, terjemahan Indonesia & Inggris. Gratis, langsung di browser.',
		path: '/',
		jsonLd: [
			{
				'@context': 'https://schema.org',
				'@type': 'SoftwareApplication',
				name: 'Quran SRT Studio',
				applicationCategory: 'MultimediaApplication',
				operatingSystem: 'Web',
				inLanguage: ['id', 'en'],
				url: SITE_URL || undefined,
				offers: { '@type': 'Offer', price: '0', priceCurrency: 'IDR' },
				description: 'Alat online untuk membuat subtitle Al-Qur’an yang sinkron dengan audio murotal.',
			},
			{
				'@context': 'https://schema.org',
				'@type': 'FAQPage',
				mainEntity: FAQ_ID.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
			},
		],
	});

const TIMES = [[0.0, 4.32], [4.32, 9.1], [9.1, 12.86], [12.86, 16.5]];

function Reel() {
	const { t, lang } = useT();
	const [i, setI] = useState(0);
	useEffect(() => {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const h = setInterval(() => setI((x) => (x + 1) % FATIHAH_SAMPLE.length), 3200);
		return () => clearInterval(h);
	}, []);
	const v = FATIHAH_SAMPLE[i];
	return (
		<div className="reel" aria-label={t('Contoh subtitle Al-Fatihah', 'Al-Fatihah subtitle example')}>
			<div className="reel-top">
				<span>Al-Fatihah, {t('ayat', 'verse')} {v.n}</span>
				<span className="ar">الفاتحة</span>
			</div>
			<div className="reel-stage">
				<div className="reel-cue" key={i}>
					<div className="ar" lang="ar">{v.ar} {ayahMarker(v.n)}</div>
					<div className="tr">{lang === 'en' ? v.en : v.id}</div>
				</div>
			</div>
			<div className="reel-srt" aria-hidden="true">
				<span className="num">{v.n}</span>
				<span>{stampSrt(TIMES[i][0])} --&gt; {stampSrt(TIMES[i][1])}</span>
			</div>
			<div className="reel-track" aria-hidden="true">
				{TIMES.map(([a, b], k) => (
					<span key={k} className={k === i ? 'on' : ''} style={{ flex: b - a }} />
				))}
			</div>
		</div>
	);
}

export default function Home() {
	const { t, lang } = useT();
	const faq = lang === 'en' ? FAQ_EN : FAQ_ID;
	const features: [React.ReactNode, string, string][] = [
		[<AudioLines key="a" size={20} />, t('20+ qari, waktu otomatis', '20+ reciters, auto timing'), t('Pilih qari dan rentang ayat. Waktu tiap ayat terisi dari durasi audionya.', 'Pick a reciter and range. Each verse is timed from its audio.')],
		[<Hand key="b" size={20} />, t('Tap-sync & seret di linimasa', 'Tap-sync & drag on the timeline'), t('Tekan spasi saat ayat dibaca, lalu rapikan dengan menarik tepi blok di gelombang suara.', 'Tap space as each verse starts, then refine by dragging blocks on the waveform.')],
		[<Sparkles key="c" size={20} />, t('Sinkron otomatis untuk rekaman sendiri', 'Auto-sync for your own recordings'), t('Unggah murotal Anda; jeda bacaan dideteksi dan dicocokkan dengan panjang ayat.', 'Upload your recitation; pauses are detected and matched to verse length.')],
		[<Languages key="d" size={20} />, t('Arab, terjemahan, transliterasi', 'Arabic, translation, transliteration'), t('114 surah dengan terjemahan Indonesia dan Inggris. Tampilkan sesuai kebutuhan.', 'All 114 surahs with Indonesian and English translations.')],
		[<Palette key="e" size={20} />, t('Template & huruf mushaf', 'Templates & mushaf type'), t('Delapan template siap pakai, empat huruf Arab, latar gambar atau video.', 'Eight ready templates, four Arabic typefaces, image or video backgrounds.')],
		[<Clapperboard key="f" size={20} />, t('Ekspor video di browser', 'Video export in the browser'), t('Hasilkan MP4/WebM 16:9, 9:16, atau 1:1 lengkap dengan audio — tanpa aplikasi edit.', 'Render 16:9, 9:16 or 1:1 MP4/WebM with audio — no editor needed.')],
		[<Layers key="g" size={20} />, t('Batch satu juz', 'Batch a whole juz'), t('Buat SRT untuk banyak surah sekaligus, misalnya Juz 30, dalam satu file ZIP.', 'Make SRTs for many surahs at once, e.g. Juz 30, in one ZIP.')],
		[<FileText key="h" size={20} />, t('Deskripsi YouTube siap tempel', 'Ready YouTube description'), t('Bab (chapters) otomatis, teks ayat, terjemahan, dan sumber dalam satu klik.', 'Automatic chapters, verse text, translation and sources in one click.')],
		[<ShieldCheck key="i" size={20} />, t('Privat & tanpa instal', 'Private & no install'), t('Audio diproses di perangkat Anda. Teks Al-Qur’an dikunci agar tidak berubah.', 'Audio stays on your device. Quran text is locked against edits.')],
		[<Scissors key="j" size={20} />, t('Ayat panjang dipotong di tanda waqaf', 'Long verses cut at waqf marks'), t('Ayat yang tak muat satu layar dipecah otomatis di tanda waqaf, atau potong sendiri di kata mana pun.', 'Verses too long for one screen split at waqf marks automatically, or cut at any word yourself.')],
		[<Type key="k" size={20} />, t('Garis tepi, nama qari & branding', 'Outline, reciter name & branding'), t('Teks tetap terbaca di atas video apa pun, lengkap dengan nama qari dan @kanal Anda.', 'Text stays legible on any footage, with the reciter name and your @handle.')],
		[<BookOpen key="l" size={20} />, t('Ta‘awudz & basmalah', 'Ta‘awwudh & basmalah'), t('Tambahkan isti‘adzah dan basmalah di awal dengan satu centang.', 'Add isti‘adhah and basmalah at the start with one tick.')],
	];
	return (
		<>
			<section className="hero">
				<div>
					<h1>{lang === 'en' ? 'Quran subtitles that land on every verse.' : <>Subtitle <span className="nowrap">Al-Qur’an</span> yang pas dengan bacaan qari.</>}</h1>
					<p className="lead">{t('Pilih surah dan qari, waktu tiap ayat terisi sendiri. Rapikan, beri gaya, lalu unduh SRT untuk CapCut atau langsung jadi video.', 'Pick a surah and reciter and each verse is timed for you. Refine, style, then download SRT for CapCut or a finished video.')}</p>
					<div className="actions">
						<Link to="/studio" className="btn btn-primary btn-lg">{t('Buka Studio', 'Open Studio')} <ArrowRight size={18} /></Link>
						<Link to="/studio?surah=67" className="btn btn-lg">{t('Coba dengan Al-Mulk', 'Try with Al-Mulk')}</Link>
					</div>
					<div className="facts">
						<span><Check size={16} /> {t('Gratis, tanpa daftar', 'Free, no sign-up')}</span>
						<span><Check size={16} /> {t('114 surah', '114 surahs')}</span>
						<span><Check size={16} /> {t('Audio tidak diunggah', 'Audio never uploaded')}</span>
					</div>
				</div>
				<Reel />
			</section>

			<section className="section" aria-labelledby="cara">
				<div className="section-head">
					<h2 id="cara">{t('Dari ayat ke subtitle dalam tiga langkah', 'From verse to subtitle in three steps')}</h2>
				</div>
				<ol className="steps">
					<li>
						<h3>{t('Pilih ayat', 'Choose verses')}</h3>
						<p>{t('Tentukan surah dan rentang ayat. Teks Arab, terjemahan, dan transliterasi langsung dimuat.', 'Set the surah and range. Arabic, translation and transliteration load instantly.')}</p>
					</li>
					<li>
						<h3>{t('Sinkronkan dengan murotal', 'Sync with the recitation')}</h3>
						<p>{t('Ambil audio qari untuk waktu otomatis, atau unggah rekaman sendiri lalu pakai sinkron otomatis dan tap-sync.', 'Fetch a reciter for automatic timing, or upload your own and use auto-sync and tap-sync.')}</p>
					</li>
					<li>
						<h3>{t('Unduh atau render video', 'Download or render video')}</h3>
						<p>{t('Ekspor SRT, VTT, ASS, deskripsi YouTube, atau video MP4 sesuai rasio platform Anda.', 'Export SRT, VTT, ASS, a YouTube description, or an MP4 in your platform’s ratio.')}</p>
					</li>
				</ol>
			</section>

			<section className="section" aria-labelledby="fitur">
				<div className="section-head">
					<h2 id="fitur">{t('Semua yang dibutuhkan editor konten dakwah', 'Everything a Quran content editor needs')}</h2>
					<p>{t('Dibuat untuk alur kerja nyata: dari Shorts harian sampai layar masjid saat tarawih.', 'Built for real workflows: from daily Shorts to the mosque screen during tarawih.')}</p>
				</div>
				<div className="feature-cols">
					{features.map(([ico, h, p]) => (
						<div className="feature" key={h}>
							<span className="ico">{ico}</span>
							<div>
								<h3>{h}</h3>
								<p>{p}</p>
							</div>
						</div>
					))}
				</div>
				<div className="formats">
					<div className="format"><b>.SRT</b><span>CapCut, Premiere, DaVinci, YouTube</span></div>
					<div className="format"><b>.VTT</b><span>{t('Situs web & pemutar HTML5', 'Websites & HTML5 players')}</span></div>
					<div className="format"><b>.ASS</b><span>{t('Gaya lengkap untuk Aegisub & ffmpeg', 'Full styling for Aegisub & ffmpeg')}</span></div>
					<div className="format"><b>MP4 / WebM</b><span>16:9, 9:16, 1:1 {t('dengan audio', 'with audio')}</span></div>
					<div className="format"><b>.TXT</b><span>{t('Deskripsi + bab YouTube', 'Description + YouTube chapters')}</span></div>
				</div>
			</section>

			<section className="section" aria-labelledby="claude">
				<div className="section-head">
					<h2 id="claude">{t('Ditenagai Claude, dengan pagar pengaman', 'Powered by Claude, with guardrails')}</h2>
					<p>{t('Kami memakai Claude dari Anthropic untuk pekerjaan yang paling memakan waktu, tanpa pernah membiarkan AI menyentuh teks Al-Qur’an.', 'We use Anthropic’s Claude for the most time-consuming work, without ever letting AI touch the Quran text.')}</p>
				</div>
				<div className="ai-band">
					<div className="ai-card">
						<span className="ico"><Scissors size={20} /></span>
						<h3>{t('Penyelaras terjemahan', 'Translation aligner')}</h3>
						<p>{t('Saat satu ayat dipotong menjadi beberapa subtitle, Claude menentukan di kata mana terjemahan harus dipotong agar tiap bagian pas maknanya dengan potongan Arab — pekerjaan yang biasanya dilakukan editor secara manual.', 'When a verse is split into several subtitles, Claude decides where the translation should be cut so each part matches its Arabic segment — work editors normally do by hand.')}</p>
					</div>
					<div className="ai-card">
						<span className="ico"><Sparkles size={20} /></span>
						<h3>{t('Asisten konten', 'Content assistant')}</h3>
						<p>{t('Judul, deskripsi, hashtag, dan ide teks thumbnail untuk YouTube, Shorts, TikTok, dan Reels — sopan, tidak clickbait, dalam bahasa Indonesia atau Inggris.', 'Titles, descriptions, hashtags and thumbnail ideas for YouTube, Shorts, TikTok and Reels — respectful, never clickbait, in Indonesian or English.')}</p>
					</div>
					<ul className="ai-guard">
						<li><Check size={16} /> {t('Claude hanya memilih nomor kata tempat memotong; teks dipotong oleh server kami dari sumber aslinya.', 'Claude only picks word numbers to cut at; our server cuts the original source text.')}</li>
						<li><Check size={16} /> {t('Setiap hasil diverifikasi: gabungan potongan harus sama persis dengan terjemahan sumber, kalau tidak, hasilnya ditolak.', 'Every result is verified: the parts must join back to the exact source translation, or it is rejected.')}</li>
						<li><Check size={16} /> {t('Teks Arab tidak pernah dikirim untuk diubah dan tetap terkunci di editor.', 'Arabic text is never sent to be changed and stays locked in the editor.')}</li>
						<li><Check size={16} /> {t('Tanpa API key di browser: semua panggilan lewat server dengan batas pemakaian.', 'No API key in the browser: every call goes through our server with rate limits.')}</li>
					</ul>
				</div>
			</section>

			<section className="section audience" aria-labelledby="siapa">
				<div>
					<div className="section-head" style={{ marginBottom: 28 }}>
						<h2 id="siapa">{t('Untuk siapa?', 'Who is it for?')}</h2>
					</div>
					<ul>
						<li><Mic2 size={20} /><div><b>{t('Kreator konten islami', 'Islamic content creators')}</b><span>{t('Shorts, Reels, dan TikTok murotal dengan subtitle rapi setiap hari.', 'Daily recitation Shorts, Reels and TikToks with clean subtitles.')}</span></div></li>
						<li><Users size={20} /><div><b>{t('Masjid & lembaga dakwah', 'Mosques & dawah organisations')}</b><span>{t('Tampilan ayat dan terjemahan di layar saat kajian atau tarawih.', 'Verse and translation display on screens during lessons or tarawih.')}</span></div></li>
						<li><School size={20} /><div><b>{t('Guru tahfidz & sekolah', 'Tahfidz teachers & schools')}</b><span>{t('Materi hafalan dengan teks, transliterasi, dan audio yang sinkron.', 'Memorisation material with synced text, transliteration and audio.')}</span></div></li>
						<li><MonitorSmartphone size={20} /><div><b>{t('Editor video', 'Video editors')}</b><span>{t('File subtitle standar yang masuk ke aplikasi edit apa pun.', 'Standard subtitle files that drop into any editor.')}</span></div></li>
					</ul>
				</div>
				<div className="quote-card">
					<div className="ar" lang="ar">{FATIHAH_SAMPLE[1].ar}</div>
					<p>{t(FATIHAH_SAMPLE[1].id, FATIHAH_SAMPLE[1].en)}</p>
					<small>QS. Al-Fatihah [1]: 2</small>
				</div>
			</section>

			<section className="section" aria-labelledby="faq">
				<div className="section-head">
					<h2 id="faq">{t('Pertanyaan umum', 'Frequently asked questions')}</h2>
				</div>
				<div className="faq">
					{faq.map(([q, a]) => (
						<details key={q}>
							<summary>{q}</summary>
							<p>{a}</p>
						</details>
					))}
				</div>
			</section>

			<section className="cta-band">
				<div>
					<h2>{t('Siap membuat subtitle pertama Anda?', 'Ready to make your first subtitle?')}</h2>
					<p><Timer size={15} style={{ display: 'inline', verticalAlign: '-2px' }} /> {t('Rata-rata kurang dari dua menit untuk satu surah pendek.', 'Usually under two minutes for a short surah.')}</p>
				</div>
				<Link to="/studio" className="btn btn-primary btn-lg">{t('Mulai di Studio', 'Start in the Studio')} <ArrowRight size={18} /></Link>
			</section>
		</>
	);
}
