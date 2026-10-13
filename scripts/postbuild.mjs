// Setelah build: periksa hasil, lalu buat ZIP siap unggah ke Hostinger (dist/quran-srt-studio-hostinger.zip).
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

const out = path.resolve('build/client');
const must = ['index.html', '__spa-fallback.html', '.htaccess', 'app-config.json', 'api/status.php', 'data/quran/114.json', 'studio/index.html'];
for (const f of must) {
	if (!fs.existsSync(path.join(out, f))) {
		console.error(`✗ File wajib tidak ada di build: ${f}`);
		process.exit(1);
	}
}

const zip = new JSZip();
let count = 0;
let bytes = 0;
const walk = (dir) => {
	for (const name of fs.readdirSync(dir)) {
		const full = path.join(dir, name);
		const rel = path.relative(out, full).split(path.sep).join('/');
		if (rel === 'api/config.php' || rel.startsWith('api/storage/')) continue; // jangan bocorkan rahasia
		const st = fs.statSync(full);
		if (st.isDirectory()) walk(full);
		else {
			zip.file(rel, fs.readFileSync(full), { date: new Date(st.mtime) });
			count++;
			bytes += st.size;
		}
	}
};
walk(out);
fs.mkdirSync('dist', { recursive: true });
const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 9 } });
const zipPath = path.resolve('dist/quran-srt-studio-hostinger.zip');
fs.writeFileSync(zipPath, buf);
console.log(`✓ ${count} file (${(bytes / 1e6).toFixed(1)} MB) → ${path.relative(process.cwd(), zipPath)} (${(buf.length / 1e6).toFixed(1)} MB)`);
console.log('  Unggah & ekstrak isi ZIP ini ke folder public_html domain/subdomain Anda.');
