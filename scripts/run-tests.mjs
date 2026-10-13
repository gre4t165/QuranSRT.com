// Menjalankan tests/*.test.ts (dibundel esbuild, alias ~ → app).
import { build } from 'esbuild';
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

const out = path.join(os.tmpdir(), 'qss-tests');
for (const f of readdirSync('tests').filter((x) => x.endsWith('.test.ts'))) {
	const file = path.join(out, f.replace(/\.ts$/, '.mjs'));
	await build({ entryPoints: [path.join('tests', f)], bundle: true, platform: 'node', format: 'esm', outfile: file, alias: { '~': './app' }, logLevel: 'error' });
	console.log(`— ${f}`);
	execFileSync(process.execPath, [file], { stdio: 'inherit' });
}
