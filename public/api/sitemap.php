<?php
// Sitemap otomatis mengikuti domain tempat situs dipasang.
$host = preg_replace('/[^a-z0-9.\-:]/i', '', $_SERVER['HTTP_HOST'] ?? 'localhost');
$base = 'https://' . $host;
$pages = ['' => '1.0', 'studio' => '0.9', 'panduan' => '0.8', 'harga' => '0.6', 'donasi' => '0.4', 'tentang' => '0.5', 'kontak' => '0.4', 'privasi' => '0.3', 'syarat' => '0.3'];
header('Content-Type: application/xml; charset=utf-8');
echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
$lastmod = date('Y-m-d', @filemtime(__DIR__ . '/../index.html') ?: time());
foreach ($pages as $p => $prio) {
    echo "  <url><loc>$base/$p</loc><lastmod>$lastmod</lastmod><priority>$prio</priority></url>\n";
}
echo "</urlset>\n";
