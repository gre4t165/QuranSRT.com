import { Link } from 'react-router';
import type { Route } from './+types/tentang';
import { seo } from '~/lib/seo';
import { useT } from '~/lib/i18n';
import { SOURCES } from '~/lib/quran';

export const meta: Route.MetaFunction = () =>
	seo({ title: 'Tentang', description: 'Quran SRT Studio membantu kreator, masjid, dan pendidik membuat subtitle Al-Qur’an yang akurat dan sinkron dengan murotal.', path: '/tentang' });

export default function Tentang() {
	const { t, lang } = useT();
	return (
		<article className="prose-page prose">
			<h1>{t('Tentang Quran SRT Studio', 'About Quran SRT Studio')}</h1>
			<p className="lead">{t('Kami ingin setiap video murotal mudah dipahami — dengan teks ayat dan terjemahan yang tampil tepat saat dibaca.', 'We want every recitation video to be easy to understand — with verse text and translation shown exactly as it is recited.')}</p>
			{lang === 'en' ? (
				<>
					<h2>The problem</h2>
					<p>Adding Quran subtitles by hand means copying Arabic text verse by verse, fixing broken right-to-left rendering, and nudging timestamps for hours. Many creators give up or publish videos without translation, so the message reaches fewer people.</p>
					<h2>What we built</h2>
					<p>A browser studio that loads all 114 surahs with translations, fetches per-verse audio from well-known reciters to time each verse automatically, and exports standard subtitle files or finished videos. Your own recordings can be synced with pause detection and tap-sync.</p>
					<h2>How we use Claude</h2>
					<p>Anthropic’s Claude powers two features. The <b>translation aligner</b> chooses where a translation should be cut when a long verse is split into several subtitles; Claude only returns word positions, our server cuts the original text, and the result must join back to the exact source. The <b>content assistant</b> drafts titles, descriptions and hashtags. Claude never writes, translates or edits Quran text.</p>
					<h2>Principles</h2>
					<ul>
						<li><b>Accurate text.</b> Arabic text comes from verified sources and is locked in the editor.</li>
						<li><b>Private by default.</b> Audio is processed on your device.</li>
						<li><b>Open formats.</b> SRT, VTT and ASS work in every editor.</li>
					</ul>
				</>
			) : (
				<>
					<h2>Masalah yang kami selesaikan</h2>
					<p>Membuat subtitle Al-Qur’an secara manual berarti menyalin teks Arab ayat per ayat, memperbaiki teks yang terbalik arah, lalu menggeser waktu berjam-jam. Banyak kreator akhirnya menyerah atau mengunggah video tanpa terjemahan, sehingga pesannya menjangkau lebih sedikit orang.</p>
					<h2>Yang kami bangun</h2>
					<p>Studio di browser yang memuat 114 surah lengkap dengan terjemahan, mengambil audio per ayat dari qari ternama untuk mengatur waktu otomatis, dan mengekspor file subtitle standar atau video jadi. Rekaman sendiri bisa disinkronkan dengan deteksi jeda dan tap-sync. Asisten Konten berbasis Claude membantu menulis judul dan deskripsi.</p>
					<h2>Bagaimana kami memakai Claude</h2>
					<p>Claude dari Anthropic menjalankan dua fitur. <b>Penyelaras terjemahan</b> menentukan di kata mana terjemahan dipotong saat ayat panjang dipecah menjadi beberapa subtitle. Claude hanya mengembalikan posisi kata, server kami yang memotong teks aslinya, dan hasilnya wajib bisa digabung kembali persis seperti sumber. <b>Asisten konten</b> membantu menulis judul, deskripsi, dan hashtag. Claude tidak pernah menulis, menerjemahkan, atau mengubah teks Al-Qur’an.</p>
					<h2>Prinsip kami</h2>
					<ul>
						<li><b>Teks akurat.</b> Teks Arab diambil dari sumber terverifikasi dan dikunci di editor. AI tidak pernah menulis atau mengubah ayat.</li>
						<li><b>Privat sejak awal.</b> Audio diproses di perangkat Anda, tidak diunggah.</li>
						<li><b>Format terbuka.</b> SRT, VTT, dan ASS bisa dipakai di aplikasi edit apa pun.</li>
						<li><b>Mudah untuk semua.</b> Tanpa instalasi, bisa dipakai dalam Bahasa Indonesia dan Inggris.</li>
					</ul>
				</>
			)}
			<h2>{t('Sumber data', 'Data sources')}</h2>
			<ul>
				<li>{SOURCES.quran}</li>
				<li>{SOURCES.id}</li>
				<li>{SOURCES.en}</li>
				<li>{SOURCES.tr}</li>
				<li>{SOURCES.audio}</li>
			</ul>
			<p>{t('Kami berterima kasih kepada para pengelola sumber-sumber tersebut. Bila menemukan kesalahan teks, mohon kabari kami lewat halaman', 'We are grateful to the maintainers of these sources. If you spot a text error, please tell us via the')} <Link to="/kontak">{t('kontak', 'contact page')}</Link>.</p>
		</article>
	);
}
