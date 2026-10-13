import type { Route } from './+types/privasi';
import { seo } from '~/lib/seo';

export const meta: Route.MetaFunction = () => seo({ title: 'Kebijakan privasi', description: 'Data apa yang disimpan Quran SRT Studio: audio diproses di perangkat Anda, proyek disimpan di browser, akun cloud opsional.', path: '/privasi' });

export default function Privasi() {
	return (
		<article className="prose-page prose">
			<h1>Kebijakan privasi</h1>
			<p className="lead">Ringkasnya: audio Anda tidak pernah meninggalkan perangkat, dan kami hanya menyimpan data yang Anda pilih untuk disimpan.</p>
			<h2>Audio dan video</h2>
			<p>File audio atau video yang Anda pilih di Studio dibaca dan diproses di browser Anda (untuk gelombang suara, sinkron otomatis, dan ekspor video). File tersebut tidak diunggah ke server kami.</p>
			<h2>Audio qari</h2>
			<p>Saat Anda memakai fitur qari, browser Anda mengunduh audio per ayat langsung dari EveryAyah.com. Server tersebut dapat mencatat alamat IP sesuai kebijakannya sendiri.</p>
			<h2>Proyek</h2>
			<ul>
				<li><b>Tanpa akun:</b> proyek dan draf disimpan di penyimpanan lokal browser (localStorage) di perangkat Anda. Menghapus data browser akan menghapusnya.</li>
				<li><b>Dengan akun (bila tersedia):</b> proyek yang Anda simpan ke cloud — berisi teks, waktu, dan pengaturan, tanpa audio — disimpan di server kami agar bisa dibuka dari perangkat lain. Anda bisa menghapusnya kapan saja dari halaman Proyek.</li>
			</ul>
			<h2>Akun, pembayaran, dan email</h2>
			<ul>
				<li><b>Data akun:</b> email, nama (opsional), kata sandi yang di-hash (kami tidak bisa membaca kata sandi Anda), paket dan masa aktif, serta riwayat pembayaran. Sesi memakai satu cookie HttpOnly yang diperlukan agar Anda tetap masuk.</li>
				<li><b>Pembayaran:</b> diproses oleh Xendit (Rupiah) dan PayPal (USD). Data kartu, rekening, atau e-wallet Anda dimasukkan di halaman mereka dan tidak pernah kami terima atau simpan; kami hanya menyimpan status, jumlah, dan nomor transaksi.</li>
				<li><b>Email:</b> email layanan (verifikasi, reset sandi, kuitansi, pengingat masa aktif paket) selalu dikirim. Email promosi hanya bila Anda menyetujuinya saat mendaftar atau di halaman Akun, dan setiap email memuat tautan berhenti berlangganan satu klik. Pengiriman memakai penyedia email Brevo.</li>
				<li><b>Penghapusan:</b> hubungi kami lewat halaman Kontak untuk menghapus akun dan datanya. Catatan pembayaran dapat kami simpan sejauh diwajibkan untuk pembukuan.</li>
			</ul>
			<h2>Asisten Konten (AI)</h2>
			<p>Bila Anda memakai Asisten Konten, nama surah, rentang ayat, nama qari, dan terjemahan ayat yang dipilih dikirim ke server kami lalu ke layanan Claude dari Anthropic untuk membuat saran judul dan deskripsi.</p>
			<p>Bila Anda memakai <b>Rapikan terjemahan</b>, potongan teks Arab dan terjemahan ayat tersebut dikirim dengan cara yang sama agar Claude bisa memilih titik potong terjemahan.</p>
			<p>Kami tidak pernah mengirim audio, nama, email, atau data pribadi Anda ke layanan AI.</p>
			<h2>Formulir kontak</h2>
			<p>Nama, email, dan pesan yang Anda kirim hanya dipakai untuk membalas pertanyaan Anda.</p>
			<h2>Statistik</h2>
			<p>Kami menghitung pemakaian fitur secara anonim, misalnya berapa kali SRT diunduh atau video dibuat per hari, dan jumlah token AI yang terpakai. Yang disimpan hanya angka total. Tidak ada alamat IP, cookie pelacak, isi proyek, maupun data pribadi.</p>
			<h2>Kontak</h2>
			<p>Pertanyaan tentang privasi dapat dikirim melalui halaman <a href="/kontak">kontak</a>.</p>
			<p><i>Terakhir diperbarui: Oktober 2026.</i></p>
		</article>
	);
}
