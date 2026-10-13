<?php
// Berhenti berlangganan email pemasaran dengan satu klik (tautan di tiap email pemasaran).
require __DIR__ . '/_db.php';
$t = (string) ($_GET['t'] ?? $_POST['t'] ?? '');

if (preg_match('/^[a-f0-9]{32}$/', $t)) {
    $st = qss_db()->prepare('UPDATE users SET marketing_optin = 0 WHERE unsub_token = ?');
    $st->execute([$t]);
    $st->rowCount();
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') { http_response_code(200); echo 'ok'; exit; } // one-click RFC 8058
header('Content-Type: text/html; charset=utf-8');
$home = htmlspecialchars(qss_site_url(), ENT_QUOTES);
echo '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Berhenti berlangganan</title>'
   . '<body style="font-family:Arial;max-width:480px;margin:15vh auto;padding:0 16px;text-align:center">'
   . '<h1 style="font-size:22px">Anda sudah berhenti berlangganan</h1>'
   . '<p>Kami tidak akan mengirim email promosi lagi. Email penting seperti verifikasi, reset sandi, dan kuitansi tetap dikirim.</p>'
   . '<p><a href="' . $home . '">Kembali ke Quran SRT Studio</a></p></body>';
