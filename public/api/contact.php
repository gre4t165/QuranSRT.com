<?php
// Formulir kontak → email pemilik situs (mail() bawaan hosting).
require __DIR__ . '/_lib.php';
qss_cors();
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') qss_json(['error' => 'Gunakan POST'], 405);
$cfg = qss_config();
$to = $cfg['contact_to'] ?? '';
if ($to === '') qss_json(['error' => 'Formulir kontak belum dikonfigurasi'], 503);

$in = qss_body(16384);
if (!empty($in['website'])) qss_json(['ok' => true]); // jebakan bot (honeypot)
qss_rate_limit('contact', (int) ($cfg['contact_rate_per_hour'] ?? 5));

$name = qss_str($in['name'] ?? '', 80);
$email = filter_var(qss_str($in['email'] ?? '', 120), FILTER_VALIDATE_EMAIL);
$topic = qss_str($in['topic'] ?? 'Pertanyaan', 60);
$msg = qss_str($in['message'] ?? '', 4000);
if ($name === '' || !$email || mb_strlen($msg) < 10) qss_json(['error' => 'Lengkapi nama, email yang valid, dan pesan (min. 10 karakter).'], 400);

$host = preg_replace('/[^a-z0-9.\-]/i', '', $_SERVER['HTTP_HOST'] ?? 'localhost');
$from = $cfg['contact_from'] ?: ('noreply@' . preg_replace('/^www\./', '', $host));
$subject = '=?UTF-8?B?' . base64_encode('[Quran SRT Studio] ' . $topic . ' — ' . $name) . '?=';
$body = "Nama: $name\nEmail: $email\nTopik: $topic\nIP: " . qss_ip() . "\n\n$msg\n";
$headers = implode("\r\n", [
    'From: Quran SRT Studio <' . $from . '>',
    'Reply-To: ' . $email,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
]);
if (!@mail($to, $subject, $body, $headers)) qss_json(['error' => 'Server gagal mengirim email. Coba lagi nanti.'], 500);
qss_json(['ok' => true]);
