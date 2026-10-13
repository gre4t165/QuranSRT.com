<?php
// Checkout langganan & donasi.  GET ?a=config | history   POST ?a=checkout | paypal_capture
require __DIR__ . '/_pay.php';
qss_cors();
$cfg = qss_config();
$act = $_GET['a'] ?? '';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$site = qss_site_url();

if ($method === 'GET' && $act === 'config') {
    $prods = [];
    foreach (qss_products() as $id => $p) $prods[] = ['id' => $id, 'plan' => $p['plan'], 'months' => $p['months'], 'idr' => $p['idr'], 'usd' => $p['usd'], 'label' => $p['label']];
    qss_json([
        'xendit' => qss_xendit_on(),
        'paypal' => qss_paypal_on(),
        'products' => $prods,
        'donation' => [
            'minIdr' => (int) ($cfg['donation_min_idr'] ?? 10000),
            'minUsd' => (float) ($cfg['donation_min_usd'] ?? 1),
            'url' => (string) ($cfg['donation_url'] ?? ''),
        ],
    ]);
}
if ($method === 'GET' && $act === 'history') {
    $u = qss_require_user();
    $st = qss_db()->prepare("SELECT id, product, provider, amount, currency, status, created_at, paid_at FROM payments WHERE user_id = ? ORDER BY id DESC LIMIT 50");
    $st->execute([$u['id']]);
    qss_json(['items' => $st->fetchAll()]);
}
if ($method !== 'POST') qss_json(['error' => 'Metode tidak didukung'], 405);
qss_require_xhr();
$in = qss_body(8192);
$db = qss_db();

if ($act === 'checkout') {
    qss_rate_limit('checkout', (int) ($cfg['checkout_rate_per_hour'] ?? 20));
    $provider = (string) ($in['provider'] ?? '');
    $product = (string) ($in['product'] ?? '');
    if (!in_array($provider, ['xendit', 'paypal'], true)) qss_json(['error' => 'Metode pembayaran tidak dikenal.'], 400);
    if ($provider === 'xendit' && !qss_xendit_on()) qss_json(['error' => 'Pembayaran Xendit belum aktif.'], 503);
    if ($provider === 'paypal' && !qss_paypal_on()) qss_json(['error' => 'Pembayaran PayPal belum aktif.'], 503);
    $currency = $provider === 'xendit' ? 'IDR' : 'USD';

    $user = qss_current_user();
    if ($product === 'donasi') {
        // Donasi boleh tanpa akun. Jumlah dari pengguna, dibatasi min/maks.
        $amount = (float) ($in['amount'] ?? 0);
        $min = $currency === 'IDR' ? (float) ($cfg['donation_min_idr'] ?? 10000) : (float) ($cfg['donation_min_usd'] ?? 1);
        $max = $currency === 'IDR' ? 50000000.0 : 3000.0;
        if ($amount < $min || $amount > $max) qss_json(['error' => 'Jumlah donasi harus antara ' . qss_fmt_money($currency, $min) . ' dan ' . qss_fmt_money($currency, $max) . '.'], 400);
        $amount = $currency === 'IDR' ? round($amount) : round($amount, 2);
        $email = $user['email'] ?? (filter_var(qss_str($in['email'] ?? '', 190), FILTER_VALIDATE_EMAIL) ?: '');
        $desc = 'Donasi Quran SRT Studio';
    } else {
        $prods = qss_products();
        if (!isset($prods[$product])) qss_json(['error' => 'Paket tidak dikenal.'], 400);
        if (!$user) qss_json(['error' => 'Masuk atau daftar dulu sebelum berlangganan.', 'code' => 'auth'], 401);
        if ((int) $user['verified_at'] === 0) qss_json(['error' => 'Verifikasi email Anda dulu.', 'code' => 'unverified'], 403);
        $amount = $currency === 'IDR' ? (float) $prods[$product]['idr'] : (float) $prods[$product]['usd'];
        $email = $user['email'];
        $desc = 'Quran SRT Studio — ' . $prods[$product]['label'];
    }

    $db->prepare('INSERT INTO payments (user_id, email, provider, provider_ref, product, amount, currency, status, created_at) VALUES (?,?,?,?,?,?,?,?,?)')
        ->execute([$user['id'] ?? null, $email, $provider, 'new-' . bin2hex(random_bytes(8)), $product, $amount, $currency, 'pending', time()]);
    $pid = (int) $db->lastInsertId();
    $setRef = fn(string $ref) => $db->prepare('UPDATE payments SET provider_ref = ? WHERE id = ?')->execute([$ref, $pid]);
    $fail = function (string $why) use ($db, $pid): void {
        $db->prepare("UPDATE payments SET status = 'failed' WHERE id = ?")->execute([$pid]);
        error_log('[qss] checkout gagal: ' . $why);
        qss_json(['error' => 'Gagal membuat pembayaran. Coba lagi sebentar lagi.'], 502);
    };

    if ($provider === 'xendit') {
        $body = [
            'external_id' => 'qss-' . $pid,
            'amount' => (int) $amount,
            'currency' => 'IDR',
            'description' => $desc,
            'invoice_duration' => 86400,
            'success_redirect_url' => "$site/akun?bayar=sukses&p=$pid",
            'failure_redirect_url' => "$site/akun?bayar=gagal&p=$pid",
        ];
        if ($email) $body['payer_email'] = $email;
        $r = qss_xendit_req('POST', '/v2/invoices', $body);
        if ($r['code'] !== 200 || empty($r['body']['id']) || empty($r['body']['invoice_url'])) $fail('xendit ' . $r['code'] . ' ' . ($r['body']['message'] ?? $r['err']));
        $setRef((string) $r['body']['id']);
        qss_stat('checkout_xendit');
        qss_json(['url' => $r['body']['invoice_url'], 'paymentId' => $pid]);
    }

    $r = qss_paypal_req('POST', '/v2/checkout/orders', [
        'intent' => 'CAPTURE',
        'purchase_units' => [[
            'reference_id' => 'qss-' . $pid,
            'custom_id' => (string) $pid,
            'description' => $desc,
            'amount' => ['currency_code' => 'USD', 'value' => number_format($amount, 2, '.', '')],
        ]],
        'payment_source' => ['paypal' => ['experience_context' => [
            'brand_name' => 'Quran SRT Studio',
            'user_action' => 'PAY_NOW',
            'return_url' => "$site/akun?bayar=paypal&p=$pid",
            'cancel_url' => "$site/akun?bayar=gagal&p=$pid",
        ]]],
    ]);
    $link = '';
    foreach (($r['body']['links'] ?? []) as $l) if (in_array($l['rel'] ?? '', ['payer-action', 'approve'], true)) { $link = $l['href']; break; }
    if (!in_array($r['code'], [200, 201], true) || empty($r['body']['id']) || $link === '') $fail('paypal ' . $r['code']);
    $setRef((string) $r['body']['id']);
    qss_stat('checkout_paypal');
    qss_json(['url' => $link, 'paymentId' => $pid]);
}

if ($act === 'paypal_capture') {
    // Dipanggil halaman /akun setelah pembeli kembali dari PayPal (parameter "token" = order id).
    $order = qss_str($in['orderId'] ?? '', 60);
    if (!preg_match('/^[A-Z0-9]{6,40}$/', $order)) qss_json(['error' => 'Order tidak valid.'], 400);
    $st = $db->prepare("SELECT * FROM payments WHERE provider = 'paypal' AND provider_ref = ?");
    $st->execute([$order]);
    $pay = $st->fetch();
    if (!$pay) qss_json(['error' => 'Order tidak ditemukan.'], 404);
    if ($pay['status'] === 'paid') qss_json(['status' => 'paid']);
    $r = qss_paypal_req('POST', "/v2/checkout/orders/$order/capture", new stdClass());
    $cap = $r['body']['purchase_units'][0]['payments']['captures'][0] ?? null;
    $okStatus = ($r['body']['status'] ?? '') === 'COMPLETED' && ($cap['status'] ?? '') === 'COMPLETED';
    if ($okStatus && (string) ($r['body']['purchase_units'][0]['custom_id'] ?? $cap['custom_id'] ?? '') === (string) $pay['id']
        && qss_amount_matches($pay, (string) ($cap['amount']['currency_code'] ?? ''), $cap['amount']['value'] ?? 0)) {
        qss_mark_paid((int) $pay['id']);
        qss_json(['status' => 'paid']);
    }
    // Mungkin sudah di-capture sebelumnya (webhook lebih cepat): cek ulang ke DB.
    $pay = qss_payment((int) $pay['id']);
    if ($pay && $pay['status'] === 'paid') qss_json(['status' => 'paid']);
    qss_json(['status' => 'pending', 'error' => 'Pembayaran belum selesai di PayPal.'], 409);
}

qss_json(['error' => 'Aksi tidak dikenal'], 404);
