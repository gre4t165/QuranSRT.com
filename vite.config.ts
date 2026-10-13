import { reactRouter } from '@react-router/dev/vite';
import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
	plugins: [reactRouter()],
	resolve: { alias: { '~': path.resolve(__dirname, 'app') } },
	build: { chunkSizeWarningLimit: 900 },
	server: { port: 5173 },
});
