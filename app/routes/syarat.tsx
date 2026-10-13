import type { Route } from './+types/syarat';
import { seo } from '~/lib/seo';

export const meta: Route.MetaFunction = () => seo({ title: 'Syarat layanan', description: 'Syarat penggunaan Quran SRT Studio, sumber teks Al-Qur’an dan terjemahan, serta batas tanggung jawab.', path: '/syarat' });

export default function Syarat() {
	return (
		<article className="prose-page prose">
			<h1>Syarat layanan</h1>
			<p className="lead">Dengan memakai Quran SRT Studio, Anda menyetujui ketentuan berikut.</p>
			<h2>1. Layanan</h2>
			<p>Quran SRT Studio adalah alat untuk membuat file subtitle dan video ayat Al-Qur’an. Fitur inti tersedia gratis. Fitur berbayar, bila ada, dijelaskan di halaman Harga.</p>
			<h2>2. Teks Al-Qur’an dan terjemahan</h2>
			<p>Teks Arab berasal dari QuranEnc.com, terjemahan Indonesia dari QuranEnc.com, terjemahan Inggris Saheeh International (QuranEnc.com), dan transliterasi dari Tanzil.net. Teks Arab dikunci di editor. Anda wajib memeriksa kembali teks, terjemahan, dan waktu sebelum mempublikasikan karya, serta mencantumkan sumber terjemahan bila diminta oleh pemiliknya.</p>
			<h2>3. Audio</h2>
			<p>Audio qari diambil dari EveryAyah.com. Hak atas rekaman tetap milik pemiliknya masing-masing. Pastikan penggunaan audio dalam karya Anda sesuai ketentuan pemilik rekaman dan platform tempat Anda mengunggah.</p>
			<h2>4. Penggunaan yang dilarang</h2>
			<ul>
				<li>Mengubah makna atau memalsukan teks Al-Qur’an.</li>
				<li>Memakai karya untuk konten yang merendahkan Al-Qur’an atau melanggar hukum.</li>
				<li>Mencoba mengganggu, membebani, atau menyalahgunakan layanan.</li>
			</ul>
			<h2>5. Karya Anda</h2>
			<p>File subtitle dan video yang Anda buat adalah milik Anda, dengan tetap menghormati hak sumber teks dan audio di atas.</p>
			<h2>Paket berbayar dan donasi</h2>
			<p>Paket Pro/Lembaga dibayar di muka untuk jangka waktu yang dipilih (tanpa tagihan berulang otomatis) dan aktif setelah pembayaran terkonfirmasi. Perpanjangan menambah dari sisa masa aktif. Setelah masa aktif habis, akun kembali ke paket Gratis dan proyek cloud Anda tidak dihapus. Karena layanan bersifat digital dan langsung aktif, pembayaran umumnya tidak dapat dikembalikan, kecuali terjadi kesalahan penagihan atau layanan tidak dapat dipakai; hubungi kami dalam 7 hari. Donasi bersifat sukarela dan tidak dapat dikembalikan.</p>
			<h2>6. Batas tanggung jawab</h2>
			<p>Layanan disediakan “sebagaimana adanya”. Hasil sinkron otomatis dan Asisten Konten adalah perkiraan yang perlu Anda periksa. Kami tidak bertanggung jawab atas kerugian akibat penggunaan hasil tanpa pemeriksaan.</p>
			<h2>7. Perubahan</h2>
			<p>Ketentuan ini dapat diperbarui. Versi terbaru selalu tersedia di halaman ini.</p>
			<p><i>Terakhir diperbarui: Oktober 2026.</i></p>
		</article>
	);
}
