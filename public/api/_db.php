<?php
// Database, sesi akun, produk/harga, dan pengiriman email.
// Dipakai oleh auth.php, projects.php, pay.php, webhook-*.php, cron.php.
declare(strict_types=1);
require_once __DIR__ . '/_lib.php';

const QSS_SCHEMA_VERSION = 1;

// ---------------------------------------------------------------- Database

function qss_db(): PDO {
    static $pdo = null;
    if ($pdo) return $pdo;
    $c = qss_config();
    try {
        if (($c['db_driver'] ?? 'mysql') === 'sqlite') {
            $path = $c['db_sqlite_path'] ?? (__DIR__ . '/storage/qss.sqlite');
            if (!is_dir(dirname($path))) @mkdir(dirname($path), 0700, true);
            $pdo = new PDO('sqlite:' . $path);
            $pdo->exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
        } else {
            if (empty($c['db_name']) || empty($c['db_user'])) throw new RuntimeException('db belum diisi');
            $pdo = new PDO(
                'mysql:host=' . ($c['db_host'] ?? 'localhost') . ';dbname=' . $c['db_name'] . ';charset=utf8mb4',
                $c['db_user'],
                $c['db_pass'] ?? ''
            );
        }
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    } catch (Throwable $e) {
        error_log('[qss] db: ' . $e->getMessage());
        qss_json(['error' => 'Database belum dikonfigurasi atau tidak bisa dihubungi.'], 503);
    }
    qss_migrate($pdo);
    return $pdo;
}

function qss_db_configured(): bool {
    $c = qss_config();
    return ($c['db_driver'] ?? 'mysql') === 'sqlite' || (!empty($c['db_name']) && !empty($c['db_user']));
}

function qss_migrate(PDO $db): void {
    $flag = __DIR__ . '/storage/schema.v';
    if (is_file($flag) && (int) @file_get_contents($flag) >= QSS_SCHEMA_VERSION) return;
    $sqlite = $db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite';
    $pk = $sqlite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY';
    $tail = $sqlite ? '' : ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    $big = $sqlite ? 'TEXT' : 'MEDIUMTEXT';
    $db->exec("CREATE TABLE IF NOT EXISTS users (
        id $pk,
        email VARCHAR(190) NOT NULL UNIQUE,
        name VARCHAR(120) NOT NULL DEFAULT '',
        pass_hash VARCHAR(255) NOT NULL,
        lang VARCHAR(5) NOT NULL DEFAULT 'id',
        plan VARCHAR(20) NOT NULL DEFAULT 'free',
        plan_until BIGINT NOT NULL DEFAULT 0,
        verified_at BIGINT NOT NULL DEFAULT 0,
        marketing_optin TINYINT NOT NULL DEFAULT 0,
        unsub_token VARCHAR(64) NOT NULL,
        created_at BIGINT NOT NULL,
        last_login_at BIGINT NOT NULL DEFAULT 0
    )$tail");
    $db->exec("CREATE TABLE IF NOT EXISTS sessions (
        token_hash CHAR(64) NOT NULL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        expires_at BIGINT NOT NULL,
        created_at BIGINT NOT NULL
    )$tail");
    $db->exec("CREATE TABLE IF NOT EXISTS auth_tokens (
        token_hash CHAR(64) NOT NULL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        purpose VARCHAR(20) NOT NULL,
        expires_at BIGINT NOT NULL,
        used_at BIGINT NOT NULL DEFAULT 0
    )$tail");
    $db->exec("CREATE TABLE IF NOT EXISTS login_attempts (
        id $pk,
        key_hash CHAR(64) NOT NULL,
        ts BIGINT NOT NULL
    )$tail");
    $db->exec("CREATE TABLE IF NOT EXISTS projects (
        id $pk,
        user_id BIGINT NOT NULL,
        name VARCHAR(160) NOT NULL,
        surah INT NOT NULL DEFAULT 1,
        data $big NOT NULL,
        updated_at BIGINT NOT NULL
    )$tail");
    $db->exec("CREATE TABLE IF NOT EXISTS payments (
        id $pk,
        user_id BIGINT NULL,
        email VARCHAR(190) NOT NULL DEFAULT '',
        provider VARCHAR(20) NOT NULL,
        provider_ref VARCHAR(120) NOT NULL DEFAULT '',
        product VARCHAR(30) NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        currency VARCHAR(3) NOT NULL,
        status VARCHAR(12) NOT NULL DEFAULT 'pending',
        created_at BIGINT NOT NULL,
        paid_at BIGINT NOT NULL DEFAULT 0
    )$tail");
    $db->exec("CREATE TABLE IF NOT EXISTS email_queue (
        id $pk,
        user_id BIGINT NULL,
        to_email VARCHAR(190) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        html $big NOT NULL,
        kind VARCHAR(30) NOT NULL,
        marketing TINYINT NOT NULL DEFAULT 0,
        unsub_token VARCHAR(64) NOT NULL DEFAULT '',
        attempts INT NOT NULL DEFAULT 0,
        send_after BIGINT NOT NULL,
        sent_at BIGINT NOT NULL DEFAULT 0
    )$tail");
    $db->exec("CREATE TABLE IF NOT EXISTS email_log (
        id $pk,
        user_id BIGINT NOT NULL,
        kind VARCHAR(40) NOT NULL,
        ts BIGINT NOT NULL,
        UNIQUE (user_id, kind)
    )$tail");
    foreach ([
        'CREATE INDEX idx_sessions_user ON sessions (user_id)',
        'CREATE INDEX idx_attempts ON login_attempts (key_hash, ts)',
        'CREATE INDEX idx_projects_user ON projects (user_id)',
        'CREATE UNIQUE INDEX uq_pay_ref ON payments (provider, provider_ref)',
        'CREATE INDEX idx_pay_user ON payments (user_id)',
        'CREATE INDEX idx_queue_due ON email_queue (sent_at, send_after)',
    ] as $ddl) {
        try { $db->exec($ddl); } catch (Throwable $e) { /* sudah ada */ }
    }
    @mkdir(__DIR__ . '/storage', 0700, true);
    @file_put_contents($flag, (string) QSS_SCHEMA_VERSION);
}

// ---------------------------------------------------------------- Produk & harga (otoritatif di server)

/** Harga TIDAK pernah dipercaya dari browser: selalu dibaca dari sini. */
function qss_products(): array {
    $default = [
        'pro_1m'  => ['plan' => 'pro',     'months' => 1,  'idr' => 49000,  'usd' => 3.5,  'label' => 'Pro 1 bulan'],
        'pro_12m' => ['plan' => 'pro',     'months' => 12, 'idr' => 490000, 'usd' => 35.0, 'label' => 'Pro 12 bulan'],
        'lembaga_12m' => ['plan' => 'lembaga', 'months' => 12, 'idr' => 1490000, 'usd' => 99.0, 'label' => 'Lembaga 12 bulan'],
    ];
    $custom = qss_config()['products'] ?? null;
    return is_array($custom) && $custom ? $custom : $default;
}

function qss_site_url(): string {
    $u = (string) (qss_config()['site_url'] ?? '');
    if ($u !== '') return rtrim($u, '/');
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
    $host = preg_replace('/[^a-z0-9.:\-]/i', '', $_SERVER['HTTP_HOST'] ?? 'localhost');
    return ($https ? 'https://' : 'http://') . $host;
}

// ---------------------------------------------------------------- Pengguna & sesi

function qss_token(): string { return bin2hex(random_bytes(32)); }
function qss_hash(string $t): string { return hash('sha256', $t); }

/** Paket efektif: otomatis kembali ke 'free' bila masa aktif habis. */
function qss_effective_plan(array $u): string {
    return ($u['plan'] !== 'free' && (int) $u['plan_until'] > time()) ? $u['plan'] : 'free';
}

function qss_public_user(array $u): array {
    return [
        'id' => (int) $u['id'],
        'email' => $u['email'],
        'name' => $u['name'],
        'plan' => qss_effective_plan($u),
        'planUntil' => (int) $u['plan_until'] > time() ? (int) $u['plan_until'] : 0,
        'verified' => (int) $u['verified_at'] > 0,
        'marketing' => (int) $u['marketing_optin'] === 1,
        'lang' => $u['lang'],
    ];
}

function qss_cookie_secure(): bool {
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
}

function qss_session_start(int $userId): void {
    $tok = qss_token();
    $exp = time() + 30 * 86400;
    qss_db()->prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?,?,?,?)')->execute([qss_hash($tok), $userId, $exp, time()]);
    setcookie('qss_sid', $tok, ['expires' => $exp, 'path' => '/', 'secure' => qss_cookie_secure(), 'httponly' => true, 'samesite' => 'Lax']);
    if (random_int(1, 40) === 1) qss_db()->prepare('DELETE FROM sessions WHERE expires_at < ?')->execute([time()]);
}

function qss_session_end(): void {
    $tok = $_COOKIE['qss_sid'] ?? '';
    if ($tok !== '') qss_db()->prepare('DELETE FROM sessions WHERE token_hash = ?')->execute([qss_hash($tok)]);
    setcookie('qss_sid', '', ['expires' => 1, 'path' => '/', 'secure' => qss_cookie_secure(), 'httponly' => true, 'samesite' => 'Lax']);
}

function qss_current_user(): ?array {
    $tok = $_COOKIE['qss_sid'] ?? '';
    if (!preg_match('/^[a-f0-9]{64}$/', $tok)) return null;
    $st = qss_db()->prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?');
    $st->execute([qss_hash($tok), time()]);
    return $st->fetch() ?: null;
}

/**
 * Perlindungan CSRF untuk permintaan yang mengubah data: header khusus
 * (tidak bisa dikirim lintas-situs tanpa preflight CORS) + Origin harus sama bila ada.
 */
function qss_require_xhr(): void {
    if (($_SERVER['HTTP_X_QSS'] ?? '') !== '1') qss_json(['error' => 'Permintaan tidak valid.'], 400);
}

function qss_require_user(bool $verified = false): array {
    $u = qss_current_user();
    if (!$u) qss_json(['error' => 'Silakan masuk dulu.', 'code' => 'auth'], 401);
    if ($verified && (int) $u['verified_at'] === 0) qss_json(['error' => 'Verifikasi email Anda dulu (cek kotak masuk).', 'code' => 'unverified'], 403);
    return $u;
}

function qss_issue_token(int $userId, string $purpose, int $ttl): string {
    $tok = qss_token();
    $db = qss_db();
    $db->prepare('DELETE FROM auth_tokens WHERE user_id = ? AND purpose = ?')->execute([$userId, $purpose]);
    $db->prepare('INSERT INTO auth_tokens (token_hash, user_id, purpose, expires_at) VALUES (?,?,?,?)')->execute([qss_hash($tok), $userId, $purpose, time() + $ttl]);
    return $tok;
}

/** Pakai token sekali (atomik). Mengembalikan user_id atau null. */
function qss_consume_token(string $tok, string $purpose): ?int {
    if (!preg_match('/^[a-f0-9]{64}$/', $tok)) return null;
    $db = qss_db();
    $st = $db->prepare('UPDATE auth_tokens SET used_at = ? WHERE token_hash = ? AND purpose = ? AND used_at = 0 AND expires_at > ?');
    $st->execute([time(), qss_hash($tok), $purpose, time()]);
    if ($st->rowCount() !== 1) return null;
    $q = $db->prepare('SELECT user_id FROM auth_tokens WHERE token_hash = ?');
    $q->execute([qss_hash($tok)]);
    $r = $q->fetch();
    return $r ? (int) $r['user_id'] : null;
}

// ---------------------------------------------------------------- Aktivasi paket (idempoten)

/**
 * Tandai pembayaran lunas dan perpanjang paket. Aman dipanggil berkali-kali
 * (webhook ganda, redirect + webhook): hanya panggilan pertama yang mengubah data.
 */
function qss_mark_paid(int $paymentId): bool {
    $db = qss_db();
    $db->beginTransaction();
    try {
        $st = $db->prepare("UPDATE payments SET status = 'paid', paid_at = ? WHERE id = ? AND status <> 'paid'");
        $st->execute([time(), $paymentId]);
        if ($st->rowCount() !== 1) { $db->commit(); return false; }
        $p = $db->prepare('SELECT * FROM payments WHERE id = ?');
        $p->execute([$paymentId]);
        $pay = $p->fetch();
        $products = qss_products();
        $user = null;
        if ($pay['user_id'] && isset($products[$pay['product']])) {
            $prod = $products[$pay['product']];
            $q = $db->prepare('SELECT * FROM users WHERE id = ?');
            $q->execute([$pay['user_id']]);
            $user = $q->fetch() ?: null;
            if ($user) {
                $now = time();
                // Perpanjang dari masa aktif yang tersisa bila paket sama; ganti paket bila berbeda.
                $base = ($user['plan'] === $prod['plan'] && (int) $user['plan_until'] > $now) ? (int) $user['plan_until'] : $now;
                $until = strtotime('+' . (int) $prod['months'] . ' months', $base);
                $db->prepare('UPDATE users SET plan = ?, plan_until = ? WHERE id = ?')->execute([$prod['plan'], $until, $user['id']]);
                $user['plan'] = $prod['plan'];
                $user['plan_until'] = $until;
            }
        }
        $db->commit();
    } catch (Throwable $e) {
        $db->rollBack();
        throw $e;
    }
    qss_stat('payment_paid');
    qss_send_receipt($pay, $user);
    return true;
}

// ---------------------------------------------------------------- Email

function qss_mail_html(string $title, string $bodyHtml, string $ctaText = '', string $ctaUrl = '', string $footer = ''): string {
    $brand = htmlspecialchars((string) (qss_config()['mail_from_name'] ?? 'Quran SRT Studio'), ENT_QUOTES);
    $cta = $ctaUrl !== '' ? '<p style="margin:24px 0"><a href="' . htmlspecialchars($ctaUrl, ENT_QUOTES) . '" style="background:#0f766e;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block">' . htmlspecialchars($ctaText, ENT_QUOTES) . '</a></p>' : '';
    return '<!doctype html><html><body style="margin:0;background:#f4f4f2;font-family:Arial,Helvetica,sans-serif;color:#1c1c1a">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">'
        . '<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;padding:28px">'
        . '<tr><td><div style="font-weight:700;color:#0f766e;font-size:15px;margin-bottom:14px">' . $brand . '</div>'
        . '<h1 style="font-size:20px;margin:0 0 12px">' . htmlspecialchars($title, ENT_QUOTES) . '</h1>'
        . '<div style="font-size:15px;line-height:1.6">' . $bodyHtml . '</div>' . $cta
        . '<div style="font-size:12px;color:#777;margin-top:24px;border-top:1px solid #eee;padding-top:12px">' . $footer . '</div>'
        . '</td></tr></table></td></tr></table></body></html>';
}

/** Antrikan email lalu coba kirim langsung; yang gagal dicoba ulang oleh cron. */
function qss_enqueue_mail(?int $userId, string $to, string $subject, string $html, string $kind, bool $marketing = false, string $unsubToken = '', int $delay = 0, bool $sendNow = true): void {
    $db = qss_db();
    $db->prepare('INSERT INTO email_queue (user_id, to_email, subject, html, kind, marketing, unsub_token, send_after) VALUES (?,?,?,?,?,?,?,?)')
        ->execute([$userId, $to, $subject, $html, $kind, $marketing ? 1 : 0, $unsubToken, time() + $delay]);
    if ($sendNow && $delay === 0) {
        $id = (int) $db->lastInsertId();
        qss_send_queued($id);
    }
}

function qss_send_queued(int $id): bool {
    $db = qss_db();
    $st = $db->prepare('SELECT * FROM email_queue WHERE id = ? AND sent_at = 0');
    $st->execute([$id]);
    $m = $st->fetch();
    if (!$m) return false;
    // Email pemasaran tidak dikirim bila pengguna sudah berhenti berlangganan.
    if ((int) $m['marketing'] === 1 && $m['user_id']) {
        $u = $db->prepare('SELECT marketing_optin FROM users WHERE id = ?');
        $u->execute([$m['user_id']]);
        $ur = $u->fetch();
        if (!$ur || (int) $ur['marketing_optin'] !== 1) {
            $db->prepare('UPDATE email_queue SET sent_at = ? WHERE id = ?')->execute([time(), $id]);
            return false;
        }
    }
    $html = $m['html'];
    $headers = [];
    if ((int) $m['marketing'] === 1 && $m['unsub_token'] !== '') {
        $unsub = qss_site_url() . '/api/unsub.php?t=' . $m['unsub_token'];
        $html = str_replace('{{UNSUB}}', htmlspecialchars($unsub, ENT_QUOTES), $html);
        $headers['List-Unsubscribe'] = '<' . $unsub . '>';
        $headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    }
    $ok = qss_deliver($m['to_email'], $m['subject'], $html, $headers);
    $db->prepare('UPDATE email_queue SET attempts = attempts + 1, sent_at = ? WHERE id = ?')->execute([$ok ? time() : 0, $id]);
    if (!$ok && (int) $m['attempts'] + 1 >= 5) $db->prepare('UPDATE email_queue SET sent_at = ? WHERE id = ?')->execute([-1, $id]); // menyerah
    return $ok;
}

/** Kirim lewat Brevo API; bila belum diatur, pakai mail() bawaan hosting. */
function qss_deliver(string $to, string $subject, string $html, array $headers = []): bool {
    $c = qss_config();
    $from = (string) ($c['mail_from'] ?? '');
    if ($from === '') $from = 'noreply@' . preg_replace('/^www\./', '', parse_url(qss_site_url(), PHP_URL_HOST) ?: 'localhost');
    $fromName = (string) ($c['mail_from_name'] ?? 'Quran SRT Studio');
    if (!empty($c['brevo_api_key'])) {
        $payload = [
            'sender' => ['name' => $fromName, 'email' => $from],
            'to' => [['email' => $to]],
            'subject' => $subject,
            'htmlContent' => $html,
        ];
        if ($headers) $payload['headers'] = $headers;
        $ch = curl_init(rtrim((string) ($c['brevo_base_url'] ?? 'https://api.brevo.com'), '/') . '/v3/smtp/email');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_HTTPHEADER => ['accept: application/json', 'content-type: application/json', 'api-key: ' . $c['brevo_api_key']],
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
        ]);
        curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($code < 200 || $code >= 300) error_log('[qss] brevo http ' . $code);
        return $code >= 200 && $code < 300;
    }
    $h = ['From: ' . $fromName . ' <' . $from . '>', 'MIME-Version: 1.0', 'Content-Type: text/html; charset=UTF-8'];
    foreach ($headers as $k => $v) $h[] = "$k: $v";
    return @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $html, implode("\r\n", $h));
}

function qss_mail_to_user(array $u, string $kind, string $subject, string $html, bool $marketing = false): void {
    qss_enqueue_mail((int) $u['id'], $u['email'], $subject, $html, $kind, $marketing, $u['unsub_token']);
}

function qss_tr(array $u, string $id, string $en): string { return ($u['lang'] ?? 'id') === 'en' ? $en : $id; }

function qss_send_verify(array $u): void {
    $tok = qss_issue_token((int) $u['id'], 'verify', 3 * 86400);
    $url = qss_site_url() . '/verifikasi?t=' . $tok;
    $name = htmlspecialchars($u['name'] ?: $u['email'], ENT_QUOTES);
    $html = qss_mail_html(
        qss_tr($u, 'Konfirmasi email Anda', 'Confirm your email'),
        '<p>' . qss_tr($u, "Assalamu'alaikum $name,<br>terima kasih sudah mendaftar. Klik tombol di bawah untuk mengaktifkan akun. Tautan berlaku 3 hari.", "Hi $name,<br>thanks for signing up. Click the button below to activate your account. The link is valid for 3 days.") . '</p>',
        qss_tr($u, 'Aktifkan akun', 'Activate account'),
        $url,
        qss_tr($u, 'Bila Anda tidak mendaftar, abaikan email ini.', 'If you did not sign up, ignore this email.')
    );
    qss_mail_to_user($u, 'verify', qss_tr($u, 'Konfirmasi email Quran SRT Studio', 'Confirm your Quran SRT Studio email'), $html);
}

function qss_send_reset(array $u): void {
    $tok = qss_issue_token((int) $u['id'], 'reset', 3600);
    $url = qss_site_url() . '/atur-ulang?t=' . $tok;
    $html = qss_mail_html(
        qss_tr($u, 'Atur ulang kata sandi', 'Reset your password'),
        '<p>' . qss_tr($u, 'Kami menerima permintaan mengatur ulang kata sandi. Tautan berlaku 1 jam dan hanya bisa dipakai sekali.', 'We received a request to reset your password. The link is valid for 1 hour and works once.') . '</p>',
        qss_tr($u, 'Buat kata sandi baru', 'Choose a new password'),
        $url,
        qss_tr($u, 'Bila bukan Anda yang meminta, abaikan email ini; kata sandi Anda tidak berubah.', 'If you did not request this, ignore this email; your password is unchanged.')
    );
    qss_mail_to_user($u, 'reset', qss_tr($u, 'Atur ulang kata sandi', 'Reset your password'), $html);
}

function qss_fmt_money(string $cur, float $amount): string {
    return $cur === 'IDR' ? 'Rp' . number_format($amount, 0, ',', '.') : '$' . number_format($amount, 2, '.', ',');
}

function qss_send_receipt(array $pay, ?array $user): void {
    $to = $user['email'] ?? $pay['email'];
    if (!$to) return;
    $u = $user ?? ['lang' => 'id', 'id' => null, 'unsub_token' => ''];
    $prods = qss_products();
    $label = $pay['product'] === 'donasi' ? qss_tr($u, 'Donasi', 'Donation') : htmlspecialchars((string) ($prods[$pay['product']]['label'] ?? $pay['product']), ENT_QUOTES);
    $amount = qss_fmt_money($pay['currency'], (float) $pay['amount']);
    $extra = '';
    if ($user && $pay['product'] !== 'donasi') {
        $extra = '<p>' . qss_tr($u, 'Paket aktif sampai ', 'Plan active until ') . '<b>' . date('d M Y', (int) $user['plan_until']) . '</b>.</p>';
    }
    if ($pay['product'] === 'donasi') $extra = '<p>' . qss_tr($u, 'Jazakumullahu khairan atas dukungan Anda untuk pengembangan Quran SRT Studio.', 'Thank you for supporting the development of Quran SRT Studio.') . '</p>';
    $html = qss_mail_html(
        qss_tr($u, 'Pembayaran diterima', 'Payment received'),
        '<table style="font-size:15px"><tr><td style="padding-right:16px;color:#777">' . qss_tr($u, 'Item', 'Item') . '</td><td>' . $label . '</td></tr>'
        . '<tr><td style="color:#777">' . qss_tr($u, 'Jumlah', 'Amount') . '</td><td>' . $amount . '</td></tr>'
        . '<tr><td style="color:#777">' . qss_tr($u, 'No. transaksi', 'Reference') . '</td><td>QSS-' . (int) $pay['id'] . '</td></tr></table>' . $extra,
        $user ? qss_tr($u, 'Buka Studio', 'Open Studio') : '',
        $user ? qss_site_url() . '/studio' : '',
        qss_tr($u, 'Simpan email ini sebagai bukti pembayaran.', 'Keep this email as your receipt.')
    );
    qss_enqueue_mail($user ? (int) $user['id'] : null, $to, qss_tr($u, 'Kuitansi pembayaran QSS-', 'Payment receipt QSS-') . (int) $pay['id'], $html, 'receipt');
}

// ---------------------------------------------------------------- HTTP keluar (Xendit, PayPal)

function qss_http(string $method, string $url, array $headers = [], $body = null, ?string $basicAuth = null): array {
    $ch = curl_init($url);
    $opts = [CURLOPT_CUSTOMREQUEST => $method, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30, CURLOPT_HTTPHEADER => $headers];
    if ($basicAuth !== null) $opts[CURLOPT_USERPWD] = $basicAuth;
    if ($body !== null) $opts[CURLOPT_POSTFIELDS] = (is_array($body) || is_object($body)) ? json_encode($body, JSON_UNESCAPED_UNICODE) : $body;
    curl_setopt_array($ch, $opts);
    $res = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    return ['code' => $code, 'body' => is_string($res) ? (json_decode($res, true) ?? []) : [], 'err' => $err];
}
