/** @type {import('next').NextConfig} */

// Saat build untuk app desktop (Tauri), frontend diekspor menjadi file statis
// (folder `out/`) yang dimuat oleh webview Tauri — bukan di-serve oleh server
// Next. Web build (Vercel) tetap memakai konfigurasi default.
const isDesktop = process.env.BUILD_TARGET === "desktop";

const nextConfig = {
  ...(isDesktop
    ? {
        output: "export",
        // Optimizer gambar butuh server Next; matikan untuk static export.
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
