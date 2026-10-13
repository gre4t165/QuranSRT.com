<?php
// Webhook Xendit (event "invoice paid/expired"). Atur URL ini di dashboard Xendit → Settings → Webhooks.
require __DIR__ . '/_pay.php';
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { http_response_code(405); exit; }
$cfg = qss_config();
$tokenCfg = (string) ($cfg['xendit_callback_token'] ?? '');
if ($tokenCfg === '' || !hash_equals($tokenCfg, (string) ($_SERVER['HTTP_X_CALLBACK_TOKEN'] ?? ''))) { http_response_code(401); exit('bad token'); }
$ev = json_decode((string) file_get_contents('php://input', false, null, 0, 65536), true);
$id = is_array($ev) ? (string) ($ev['id'] ?? '') : '';
if (!preg_match('/^[A-Za-z0-9_\-]{6,80}$/', $id)) { http_response_code(400); exit('bad body'); }

$db = qss_db();
$st = $db->prepare("SELECT * FROM payments WHERE provider = 'xendit' AND provider_ref = ?");
$st->execute([$id]);
$pay = $st->fetch();
if (!$pay) { http_response_code(200); exit('unknown'); } // bukan milik kita: abaikan agar tidak di-retry terus

// Jangan percaya isi webhook: status & jumlah diambil ulang langsung dari Xendit.
$r = qss_xendit_req('GET', '/v2/invoices/' . rawurlencode($id));
if ($r['code'] !== 200) { http_response_code(502); exit('verify failed'); } // Xendit akan mencoba lagi
$inv = $r['body'];
if (($inv['external_id'] ?? '') !== 'qss-' . $pay['id'] || !qss_amount_matches($pay, (string) ($inv['currency'] ?? 'IDR'), $inv['amount'] ?? 0)) { http_response_code(200); exit('mismatch'); }
$status = strtoupper((string) ($inv['status'] ?? ''));
if (in_array($status, ['PAID', 'SETTLED'], true)) {
    qss_mark_paid((int) $pay['id']);
} elseif ($status === 'EXPIRED') {
    $db->prepare("UPDATE payments SET status = 'expired' WHERE id = ? AND status = 'pending'")->execute([$pay['id']]);
}
http_response_code(200);
echo 'ok';
