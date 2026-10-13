<?php
$host = preg_replace('/[^a-z0-9.\-:]/i', '', $_SERVER['HTTP_HOST'] ?? 'localhost');
header('Content-Type: text/plain; charset=utf-8');
echo "User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /proyek\nDisallow: /masuk\nDisallow: /daftar\n\nSitemap: https://$host/sitemap.xml\n";
