<?php
// Pembayaran: Xendit (QRIS, VA, e-wallet, kartu) dan PayPal. Harga selalu dari server.
declare(strict_types=1);
require_once __DIR__ . '/_db.php';

function qss_xendit_on(): bool { return !empty(qss_config()['xendit_secret_key']); }
function qss_paypal_on(): bool { $c = qss_config(); return !empty($c['paypal_client_id']) && !empty($c['paypal_secret']); }

function qss_xendit_base(): string { return rtrim((string) (qss_config()['xendit_base_url'] ?? 'https://api.xendit.co'), '/'); }
function qss_paypal_base(): string {
    $c = qss_config();
    if (!empty($c['paypal_base_url'])) return rtrim((string) $c['paypal_base_url'], '/');
    return ($c['paypal_env'] ?? 'sandbox') === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

function qss_xendit_req(string $method, string $path, $body = null): array {
    return qss_http($method, qss_xendit_base() . $path, ['content-type: application/json'], $body, qss_config()['xendit_secret_key'] . ':');
}

function qss_paypal_token(): ?string {
    static $tok = null;
    if ($tok) return $tok;
    $c = qss_config();
    $r = qss_http('POST', qss_paypal_base() . '/v1/oauth2/token', ['content-type: application/x-www-form-urlencoded', 'accept: application/json'], 'grant_type=client_credentials', $c['paypal_client_id'] . ':' . $c['paypal_secret']);
    return $tok = ($r['body']['access_token'] ?? null);
}

function qss_paypal_req(string $method, string $path, $body = null): array {
    $t = qss_paypal_token();
    if (!$t) return ['code' => 0, 'body' => [], 'err' => 'paypal auth'];
    return qss_http($method, qss_paypal_base() . $path, ['content-type: application/json', 'authorization: Bearer ' . $t], $body === null ? null : $body);
}

function qss_payment(int $id): ?array {
    $st = qss_db()->prepare('SELECT * FROM payments WHERE id = ?');
    $st->execute([$id]);
    return $st->fetch() ?: null;
}

/** Pembayaran dicocokkan dengan nilai di DB: jumlah & mata uang harus persis sama. */
function qss_amount_matches(array $pay, string $currency, $value): bool {
    return strtoupper($currency) === $pay['currency'] && abs((float) $value - (float) $pay['amount']) < 0.005;
}
