<?php
// Webhook PayPal (PAYMENT.CAPTURE.COMPLETED). Daftarkan URL ini di developer.paypal.com → Webhooks, lalu isi paypal_webhook_id.
require __DIR__ . '/_pay.php';
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { http_response_code(405); exit; }
$cfg = qss_config();
$raw = (string) file_get_contents('php://input', false, null, 0, 131072);
$ev = json_decode($raw, true);
$hook = (string) ($cfg['paypal_webhook_id'] ?? '');
if (!is_array($ev) || $hook === '' || !qss_paypal_on()) { http_response_code(400); exit('config'); }

// Verifikasi tanda tangan lewat PayPal; event palsu ditolak.
$h = fn(string $k) => (string) ($_SERVER['HTTP_' . strtoupper(str_replace('-', '_', $k))] ?? '');
$v = qss_paypal_req('POST', '/v1/notifications/verify-webhook-signature', [
    'auth_algo' => $h('paypal-auth-algo'),
    'cert_url' => $h('paypal-cert-url'),
    'transmission_id' => $h('paypal-transmission-id'),
    'transmission_sig' => $h('paypal-transmission-sig'),
    'transmission_time' => $h('paypal-transmission-time'),
    'webhook_id' => $hook,
    'webhook_event' => $ev,
]);
if (($v['body']['verification_status'] ?? '') !== 'SUCCESS') { http_response_code(401); exit('bad signature'); }

if (($ev['event_type'] ?? '') === 'PAYMENT.CAPTURE.COMPLETED') {
    $res = $ev['resource'] ?? [];
    $pay = qss_payment((int) ($res['custom_id'] ?? 0));
    if ($pay && $pay['provider'] === 'paypal' && ($res['status'] ?? '') === 'COMPLETED'
        && qss_amount_matches($pay, (string) ($res['amount']['currency_code'] ?? ''), $res['amount']['value'] ?? 0)) {
        qss_mark_paid((int) $pay['id']);
    }
}
http_response_code(200);
echo 'ok';
