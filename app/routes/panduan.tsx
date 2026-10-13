import { Link } from 'react-router';
import type { Route } from './+types/panduan';
import { seo } from '~/lib/seo';
import { useT } from '~/lib/i18n';

const TITLE = 'Panduan membuat subtitle Al-Qur’an (SRT) untuk YouTube, CapCut & Reels';
const DESC = 'Langkah demi langkah membuat subtitle Al-Qur’an yang sinkron dengan murotal: pilih ayat, ambil audio qari, tap-sync, impor SRT ke CapCut, YouTube, Premiere, dan render video.';

export const meta: Route.MetaFunction = () =>
	seo({
		title: TITLE,
		description: DESC,
		path: '/panduan',
		jsonLd: {
			'@context': 'https://schema.org',
			'@type': 'HowTo',
			name: 'Cara membuat subtitle Al-Qur’an SRT yang sinkron dengan murotal',
			step: [
				{ '@type': 'HowToStep', name: 'Pilih surah dan ayat', text: 'Buka Studio, pilih surah dan rentang ayat, lalu klik Muat ayat.' },
				{ '@type': 'HowToStep', name: 'Sinkronkan dengan audio', text: 'Pilih qari lalu klik Ambil & sinkronkan, atau unggah murotal sendiri dan gunakan Sinkron otomatis atau Tap-sync.' },
				{ '@type': 'HowToStep', name: 'Atur tampilan', text: 'Pilih template, rasio 16:9 atau 9:16, huruf Arab, dan warna di tab Tampilan.' },
				{ '@type': 'HowToStep', name: 'Ekspor', text: 'Unduh .SRT untuk CapCut/YouTube/Premiere, atau buat video MP4 di tab Ekspor.' },
			],
		},
	});

export default function Panduan() {
	const { t, lang } = useT();
	if (lang === 'en') return <GuideEn />;
	return (
		<article className="prose-page prose">
			<h1>Panduan membuat subtitle Al-Qur’an</h1>
			<p className="lead">Dari memilih ayat sampai subtitle tampil rapi di CapCut, YouTube, atau layar masjid. Semua langkah bisa dikerjakan gratis di <Link to="/studio">Studio</Link>.</p>
			<nav className="toc" aria-label="Daftar isi">
				<b>Isi panduan</b>
				<ol>
					<li><a href="#cepat">Cara tercepat: pakai audio qari</a></li>
					<li><a href="#audio-sendiri">Memakai rekaman murotal sendiri</a></li>
					<li><a href="#tap-sync">Tap-sync: menandai waktu dengan spasi</a></li>
					<li><a href="#rapikan">Merapikan waktu di linimasa</a></li>
					<li><a href="#tampilan">Mengatur tampilan & rasio</a></li>
					<li><a href="#capcut">Impor SRT ke CapCut</a></li>
					<li><a href="#youtube">Unggah subtitle ke YouTube</a></li>
					<li><a href="#premiere">Premiere Pro, DaVinci Resolve & VLC</a></li>
					<li><a href="#video">Membuat video langsung dari Studio</a></li>
					<li><a href="#batch">Batch satu juz</a></li>
					<li><a href="#masalah">Masalah umum</a></li>
				</ol>
			</nav>

			<h2 id="cepat">1. Cara tercepat: pakai audio qari</h2>
			<ol>
				<li>Buka <Link to="/studio">Studio</Link>. Pilih <b>surah</b>, isi <b>Dari</b> dan <b>Sampai</b> ayat, lalu klik <b>Muat ayat</b>. Centang <b>Basmalah di awal</b> bila ingin basmalah tampil sebelum ayat pertama.</li>
				<li>Di kartu <b>Audio murotal</b>, pilih qari lalu klik <b>Ambil &amp; sinkronkan</b>. Audio diambil per ayat dari EveryAyah.com dan waktu tiap ayat terisi sesuai durasinya.</li>
				<li>Tekan <kbd>Spasi</kbd> untuk memutar dan cek hasilnya di pratinjau.</li>
				<li>Buka tab <b>Ekspor</b>, lalu klik <b>.SRT</b>.</li>
			</ol>
			<p>Karena waktu berasal dari durasi audio per ayat, subtitle akan pas selama audio di video Anda adalah gabungan audio qari yang sama tanpa dipotong. Paling aman, unduh <b>Audio .WAV</b> dari tab Ekspor lalu pakai file itu di aplikasi edit Anda.</p>

			<h2 id="audio-sendiri">2. Memakai rekaman murotal sendiri</h2>
			<p>Seret file MP3, WAV, M4A, atau MP4 ke kotak unggah. File diproses di browser dan tidak dikirim ke server. Setelah gelombang suara muncul, Anda punya tiga pilihan:</p>
			<ul>
				<li><b>Sinkron otomatis</b> — mendeteksi jeda di antara ayat dan mencocokkannya dengan panjang teks. Atur <i>kepekaan jeda</i> bila hasilnya kurang pas: naikkan untuk rekaman dengan jeda tipis, turunkan bila ada suara latar.</li>
				<li><b>Tap-sync</b> — menandai sendiri saat ayat mulai dibaca (lihat bagian berikut). Paling akurat untuk bacaan dengan banyak waqaf.</li>
				<li><b>Bagi rata</b> — membagi durasi audio sesuai panjang ayat. Berguna sebagai titik awal sebelum dirapikan.</li>
			</ul>

			<h2 id="tap-sync">3. Tap-sync: menandai waktu dengan spasi</h2>
			<ol>
				<li>Pilih baris tempat Anda mulai (biasanya baris pertama), lalu klik <b>Tap-sync</b>. Audio langsung diputar.</li>
				<li>Tekan <kbd>Spasi</kbd> tepat saat qari mulai membaca setiap ayat. Akhir ayat sebelumnya ikut terisi.</li>
				<li>Bila ada jeda panjang sebelum ayat berikutnya, tekan <kbd>E</kbd> untuk mengakhiri ayat yang sedang tampil.</li>
				<li>Setelah ayat terakhir selesai dibaca, tekan <kbd>E</kbd>. Mode tap selesai otomatis.</li>
			</ol>
			<p>Tips: turunkan kecepatan ke 0,75× bila bacaan cepat. Salah tekan? <kbd>Ctrl</kbd>+<kbd>Z</kbd> membatalkan satu langkah.</p>

			<h2 id="rapikan">4. Merapikan waktu di linimasa</h2>
			<ul>
				<li><b>Tarik tepi blok</b> di linimasa untuk menggeser mulai/akhir. Bila dua blok bersentuhan, keduanya ikut bergeser.</li>
				<li>Di daftar ayat, ketik waktu langsung (mis. <code>1:05.4</code>), gunakan tombol <b>−/+</b> untuk 0,1 detik, atau tombol ↵ untuk mengisi dengan posisi playhead.</li>
				<li><b>Geser</b> di kepala daftar memindahkan semua waktu sekaligus — berguna bila video Anda punya intro.</li>
				<li>Tombol <b>Ulangi baris</b> memutar satu ayat berulang-ulang sambil Anda menyesuaikan.</li>
				<li>Baris yang bermasalah (tumpang tindih atau akhir sebelum mulai) ditandai merah. Di tab Ekspor ada tombol <b>Perbaiki otomatis</b>.</li>
			</ul>

			<h3 id="ayat-panjang">Ayat panjang &amp; memotong ayat</h3>
			<p>Ayat yang terlalu panjang untuk satu layar (misalnya Al-Baqarah 282) <b>otomatis dipecah</b> menjadi beberapa subtitle berurutan. Titik potongnya mengutamakan tanda waqaf (ۘ ۗ ۚ ۖ), dan ukuran huruf tetap terbaca. Opsi ini ada di tab <b>Ekspor</b> → “Pecah otomatis ayat yang tidak muat di layar”.</p>
			<p>Untuk kendali penuh, klik ikon <b>gunting</b> di sebuah ayat lalu pilih titik potong di antara kata, atau klik <b>Potong ayat panjang</b> di atas daftar ayat. Setiap potongan menjadi baris sendiri dengan waktu yang bisa diatur, dan nomor ayat hanya tampil di potongan terakhir. Tombol <b>Gabung</b> dan <b>Satukan ayat</b> mengembalikan teks persis seperti semula.</p>
			<p>Bila Asisten AI aktif, tombol <b>Rapikan terjemahan</b> meminta Claude menentukan di kata mana terjemahan dipotong agar tiap bagian pas maknanya dengan potongan Arab. Claude tidak menulis ulang terjemahan; hasilnya diverifikasi sama persis dengan sumber sebelum dipakai.</p>

			<h2 id="tampilan">5. Mengatur tampilan &amp; rasio</h2>
			<p>Tab <b>Tampilan</b> berisi delapan template, pilihan huruf Arab (Amiri Quran, Scheherazade New, Noto Naskh Arabic, Reem Kufi), ukuran, warna, posisi, dan latar gambar atau video. Pilih <b>9:16</b> untuk Shorts, Reels, dan TikTok; <b>16:9</b> untuk YouTube dan layar masjid; <b>1:1</b> untuk feed Instagram.</p>
			<p>Gaya ini berlaku untuk pratinjau, ekspor video, dan file <b>.ASS</b>. File .SRT dan .VTT hanya berisi teks — gaya diatur di aplikasi edit Anda.</p>

			<h2 id="capcut">6. Impor SRT ke CapCut</h2>
			<ol>
				<li>Di CapCut (desktop), masukkan video/audio Anda ke timeline.</li>
				<li>Buka menu <b>Teks</b> → <b>Takarir</b> (Captions) → <b>Impor takarir</b>, lalu pilih file .SRT.</li>
				<li>Atur huruf. Untuk teks Arab, pilih font yang mendukung harakat, lalu sesuaikan ukuran.</li>
			</ol>
			<p>Bila teks Arab tampil terbalik atau terpotong, aktifkan <b>penanda arah kanan-ke-kiri</b> di tab Ekspor lalu unduh ulang. Pilihan menu bisa sedikit berbeda di setiap versi CapCut.</p>

			<h2 id="youtube">7. Unggah subtitle ke YouTube</h2>
			<ol>
				<li>Di YouTube Studio, buka video → <b>Subtitel</b> → pilih bahasa → <b>Tambahkan</b> → <b>Unggah file</b> → <b>Dengan pengaturan waktu</b>.</li>
				<li>Pilih file .SRT atau .VTT.</li>
				<li>Salin <b>Deskripsi .TXT</b> dari tab Ekspor ke kolom deskripsi. Daftar waktu di dalamnya otomatis menjadi <i>chapters</i> (YouTube mensyaratkan bab pertama di 0:00, minimal tiga bab, dan tiap bab minimal 10 detik).</li>
			</ol>

			<h2 id="premiere">8. Premiere Pro, DaVinci Resolve &amp; VLC</h2>
			<ul>
				<li><b>Premiere Pro</b>: File → Import → pilih .SRT, lalu seret ke timeline sebagai caption track.</li>
				<li><b>DaVinci Resolve</b>: klik kanan di Media Pool → Import Subtitle.</li>
				<li><b>VLC</b>: Subtitle → Add Subtitle File. Untuk gaya lengkap (warna, posisi, huruf), gunakan file .ASS.</li>
				<li><b>ffmpeg</b> (membakar subtitle ke video): <code>ffmpeg -i video.mp4 -vf ass=subtitle.ass hasil.mp4</code></li>
			</ul>

			<h2 id="video">9. Membuat video langsung dari Studio</h2>
			<p>Bila audio sudah dimuat (dari qari atau unggahan), buka tab <b>Ekspor</b> → <b>Ekspor video</b>. Pilih resolusi lalu klik <b>Buat video</b>. Video direkam secara real-time, jadi proses berlangsung selama durasi audio. Biarkan tab tetap terbuka dan terlihat. Chrome dan Edge terbaru menghasilkan MP4; browser lain menghasilkan WebM.</p>

			<h2 id="batch">10. Batch satu juz</h2>
			<p>Di tab Ekspor, klik <b>Batch ZIP</b>. Pilih rentang surah (ada pintasan Juz 30 dan Juz 29), qari, dan format. Studio mengukur durasi audio tiap ayat lalu membuat SRT/VTT dan deskripsi untuk setiap surah dalam satu file ZIP.</p>

			<h2 id="masalah">11. Masalah umum</h2>
			<h3>Audio qari gagal dimuat</h3>
			<p>Periksa koneksi internet. Bila server audio menolak unduhan langsung, Studio beralih ke mode putar berurutan: waktu tetap terisi, tetapi gelombang suara dan ekspor video tidak tersedia. Untuk video, unggah file audio sendiri.</p>
			<h3>Subtitle tidak pas setelah diimpor</h3>
			<p>Pastikan audio di aplikasi edit dimulai di detik yang sama dengan audio di Studio. Bila video punya intro, gunakan <b>Geser</b> untuk memindahkan semua waktu.</p>
			<h3>Huruf Arab di file SRT tampak berbeda</h3>
			<p>File SRT tidak membawa huruf. Tampilan bergantung pada font di aplikasi pemutar/edit. Gunakan ekspor video atau file .ASS bila ingin tampilan persis seperti pratinjau.</p>
			<h3>Pekerjaan hilang</h3>
			<p>Studio menyimpan draf otomatis di browser. Untuk cadangan permanen, klik <b>Simpan</b> dan ekspor <b>Proyek .JSON</b>.</p>

			<p style={{ marginTop: 40 }}><Link className="btn btn-primary btn-lg" to="/studio">{t('Buka Studio', 'Open Studio')}</Link></p>
		</article>
	);
}

function GuideEn() {
	return (
		<article className="prose-page prose">
			<h1>Guide: making Quran subtitles</h1>
			<p className="lead">From picking verses to subtitles in CapCut, YouTube or on a mosque screen. Everything here is free in the <Link to="/studio">Studio</Link>.</p>
			<h2 id="cepat">1. Fastest: use a reciter</h2>
			<ol>
				<li>Open the Studio, choose a <b>surah</b> and verse range, then click <b>Load verses</b>.</li>
				<li>Pick a reciter and click <b>Fetch &amp; sync</b>. Each verse is timed from its audio length.</li>
				<li>Press <kbd>Space</kbd> to play and check the preview, then download <b>.SRT</b> in the Export tab.</li>
			</ol>
			<p>Use the <b>Audio .WAV</b> download from the Export tab in your editor so the timing matches exactly.</p>
			<h2 id="audio-sendiri">2. Your own recording</h2>
			<p>Drop an MP3/WAV/M4A/MP4 file. It stays in your browser. Then use <b>Auto-sync</b> (detects pauses), <b>Tap-sync</b>, or <b>Spread evenly</b>.</p>
			<h2 id="tap-sync">3. Tap-sync</h2>
			<p>Select the first row and click <b>Tap-sync</b>. Press <kbd>Space</kbd> when each verse starts and <kbd>E</kbd> to end a verse before a long pause or at the very end.</p>
			<h2 id="rapikan">4. Refining</h2>
			<p>Drag block edges on the timeline, type times directly, nudge by 0.1 s, shift everything at once, and loop a single row while adjusting. Problem rows turn red; the Export tab has <b>Auto-fix</b>.</p>
			<h3 id="ayat-panjang">Long verses &amp; cutting a verse</h3>
			<p>Verses too long for one screen are split automatically into consecutive subtitles, preferring waqf marks, so text stays readable. You can also cut any verse with the <b>scissors</b> icon or <b>Cut long verses</b>, then use <b>Align translation</b> to let Claude choose where the translation splits. Claude never rewrites text; results are verified against the source.</p>
			<h2 id="capcut">5. CapCut</h2>
			<p>Text → Captions → Import captions, then choose the .SRT. If Arabic looks reversed, enable right-to-left marks in Export and download again.</p>
			<h2 id="youtube">6. YouTube</h2>
			<p>YouTube Studio → Subtitles → Add → Upload file → With timing. Paste the description file into the description box to get chapters.</p>
			<h2 id="video">7. Video export</h2>
			<p>With audio loaded, open Export → Video export. Rendering happens in real time; keep the tab visible. Chrome/Edge produce MP4, others WebM.</p>
			<h2 id="batch">8. Batch</h2>
			<p>Export → Batch ZIP builds SRT/VTT and descriptions for a range of surahs, e.g. Juz 30.</p>
			<p style={{ marginTop: 40 }}><Link className="btn btn-primary btn-lg" to="/studio">Open Studio</Link></p>
		</article>
	);
}
