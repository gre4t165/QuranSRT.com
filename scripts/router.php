<?php
// Server lokal yang meniru aturan .htaccess di Hostinger.
// Jalankan: npm run preview   (atau: php -S localhost:8080 -t build/client scripts/router.php)
$root = $_SERVER['DOCUMENT_ROOT'];
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
if ($path === '/sitemap.xml') { require $root . '/api/sitemap.php'; return true; }
if ($path === '/robots.txt') { require $root . '/api/robots.php'; return true; }
if (preg_match('#^/api/(config|config\.sample|_lib|_db|_pay|_funnel)\.php$#', $path) || str_starts_with($path, '/api/storage')) { http_response_code(403); echo 'Forbidden'; return true; }
$file = $root . $path;
if (is_file($file)) {
    if (str_ends_with($file, '.php')) { chdir(dirname($file)); require $file; return true; }
    $types = ['webmanifest' => 'application/manifest+json', 'vtt' => 'text/vtt', 'json' => 'application/json', 'woff2' => 'font/woff2'];
    $ext = pathinfo($file, PATHINFO_EXTENSION);
    if (isset($types[$ext])) { header('Content-Type: ' . $types[$ext]); readfile($file); return true; }
    return false;
}
$idx = rtrim($file, '/') . '/index.html';
if (is_file($idx)) { header('Content-Type: text/html; charset=utf-8'); readfile($idx); return true; }
if (str_starts_with($path, '/api/')) { http_response_code(404); header('Content-Type: application/json'); echo '{"error":"not found"}'; return true; }
header('Content-Type: text/html; charset=utf-8');
readfile($root . '/__spa-fallback.html');
return true;
