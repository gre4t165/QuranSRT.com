<?php
// Akun: daftar, masuk, keluar, verifikasi email, lupa/atur ulang sandi, profil.
require __DIR__ . '/_db.php';
qss_cors();
header('Cache-Control: no-store');
$cfg = qss_config();
$act = $_GET['a'] ?? '';

if ($act === 'me' && ($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
    $u = qss_current_user();
    qss_json(['user' => $u ? qss_public_user($u) : null]);
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') qss_json(['error' => 'Gunakan POST'], 405);
qss_require_xhr();
$in = qss_body(8192);
$db = qss_db();

function qss_valid_email(string $e): ?string {
    $e = strtolower(trim($e));
    return (strlen($e) <= 190 && filter_var($e, FILTER_VALIDATE_EMAIL)) ? $e : null;
}
/** Maks. 8 percobaan gagal per 15 menit untuk kombinasi email+IP dan 30 untuk IP. */
function qss_attempts(PDO $db, string $key): int {
    $st = $db->prepare('SELECT COUNT(*) c FROM login_attempts WHERE key_hash = ? AND ts > ?');
    $st->execute([qss_hash($key), time() - 900]);
    return (int) $st->fetch()['c'];
}
function qss_fail(PDO $db, string $key): void {
    $db->prepare('INSERT INTO login_attempts (key_hash, ts) VALUES (?,?)')->execute([qss_hash($key), time()]);
    if (random_int(1, 30) === 1) $db->prepare('DELETE FROM login_attempts WHERE ts < ?')->execute([time() - 3600]);
}

switch ($act) {
    case 'signup': {
        qss_rate_limit('signup', (int) ($cfg['signup_rate_per_hour'] ?? 10));
        $email = qss_valid_email((string) ($in['email'] ?? ''));
        $pass = (string) ($in['password'] ?? '');
        $name = qss_str($in['name'] ?? '', 120);
        $lang = ($in['lang'] ?? 'id') === 'en' ? 'en' : 'id';
        if (!$email) qss_json(['error' => 'Email tidak valid.'], 400);
        if (strlen($pass) < 8 || strlen($pass) > 200) qss_json(['error' => 'Kata sandi minimal 8 karakter.'], 400);
        $st = $db->prepare('SELECT * FROM users WHERE email = ?');
        $st->execute([$email]);
        $exists = $st->fetch();
        if ($exists) {
            // Jawaban sama persis agar email terdaftar tidak bisa ditebak; pemilik akun diberi tahu lewat email.
            $html = qss_mail_html(qss_tr($exists, 'Ada yang mencoba mendaftar dengan email Anda', 'Someone tried to sign up with your email'),
                '<p>' . qss_tr($exists, 'Email ini sudah punya akun. Bila itu Anda dan lupa kata sandi, atur ulang lewat halaman Masuk → Lupa kata sandi.', 'This email already has an account. If that was you and you forgot the password, use Sign in → Forgot password.') . '</p>',
                qss_tr($exists, 'Ke halaman masuk', 'Go to sign in'), qss_site_url() . '/masuk');
            qss_mail_to_user($exists, 'dup_signup', qss_tr($exists, 'Email Anda sudah terdaftar', 'Your email is already registered'), $html);
        } else {
            $db->prepare('INSERT INTO users (email, name, pass_hash, lang, marketing_optin, unsub_token, created_at) VALUES (?,?,?,?,?,?,?)')
                ->execute([$email, $name, password_hash($pass, PASSWORD_DEFAULT), $lang, !empty($in['marketing']) ? 1 : 0, bin2hex(random_bytes(16)), time()]);
            $st->execute([$email]);
            qss_send_verify($st->fetch());
            qss_stat('signup');
        }
        qss_json(['ok' => true]);
    }

    case 'login': {
        $email = qss_valid_email((string) ($in['email'] ?? '')) ?? '';
        $pass = (string) ($in['password'] ?? '');
        if (qss_attempts($db, "e:$email|" . qss_ip()) >= 8 || qss_attempts($db, 'ip:' . qss_ip()) >= 30) qss_json(['error' => 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.'], 429);
        $st = $db->prepare('SELECT * FROM users WHERE email = ?');
        $st->execute([$email]);
        $u = $st->fetch();
        // Selalu jalankan verifikasi hash agar waktu respons tidak membocorkan keberadaan akun.
        $hash = $u['pass_hash'] ?? '$2y$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012';
        $ok = password_verify($pass, $hash) && $u;
        if (!$ok) {
            qss_fail($db, "e:$email|" . qss_ip());
            qss_fail($db, 'ip:' . qss_ip());
            qss_json(['error' => 'Email atau kata sandi salah.'], 401);
        }
        if (password_needs_rehash($u['pass_hash'], PASSWORD_DEFAULT)) $db->prepare('UPDATE users SET pass_hash = ? WHERE id = ?')->execute([password_hash($pass, PASSWORD_DEFAULT), $u['id']]);
        $db->prepare('UPDATE users SET last_login_at = ? WHERE id = ?')->execute([time(), $u['id']]);
        qss_session_start((int) $u['id']);
        qss_json(['user' => qss_public_user($u)]);
    }

    case 'logout':
        qss_session_end();
        qss_json(['ok' => true]);

    case 'verify': {
        $uid = qss_consume_token((string) ($in['token'] ?? ''), 'verify');
        if (!$uid) qss_json(['error' => 'Tautan verifikasi tidak valid atau sudah kedaluwarsa.'], 400);
        $db->prepare('UPDATE users SET verified_at = ? WHERE id = ? AND verified_at = 0')->execute([time(), $uid]);
        $st = $db->prepare('SELECT * FROM users WHERE id = ?');
        $st->execute([$uid]);
        $u = $st->fetch();
        qss_session_start($uid);
        // Email sambutan dikirim sekali, tepat setelah akun terverifikasi.
        $ins = $db->prepare('INSERT INTO email_log (user_id, kind, ts) VALUES (?,?,?)');
        try {
            $ins->execute([$uid, 'welcome', time()]);
            require_once __DIR__ . '/_funnel.php';
            qss_funnel_send($u, 'welcome');
        } catch (Throwable $e) { /* sudah pernah terkirim */ }
        qss_json(['user' => qss_public_user($u)]);
    }

    case 'resend': {
        $u = qss_require_user();
        if ((int) $u['verified_at'] > 0) qss_json(['ok' => true]);
        qss_rate_limit('resend', 5);
        qss_send_verify($u);
        qss_json(['ok' => true]);
    }

    case 'forgot': {
        qss_rate_limit('forgot', (int) ($cfg['signup_rate_per_hour'] ?? 10));
        $email = qss_valid_email((string) ($in['email'] ?? ''));
        if ($email) {
            $st = $db->prepare('SELECT * FROM users WHERE email = ?');
            $st->execute([$email]);
            if ($u = $st->fetch()) qss_send_reset($u);
        }
        qss_json(['ok' => true]); // selalu sama, tidak membocorkan apakah email terdaftar
    }

    case 'reset': {
        $pass = (string) ($in['password'] ?? '');
        if (strlen($pass) < 8 || strlen($pass) > 200) qss_json(['error' => 'Kata sandi minimal 8 karakter.'], 400);
        $uid = qss_consume_token((string) ($in['token'] ?? ''), 'reset');
        if (!$uid) qss_json(['error' => 'Tautan tidak valid atau sudah kedaluwarsa. Minta tautan baru.'], 400);
        $db->prepare('UPDATE users SET pass_hash = ?, verified_at = CASE WHEN verified_at = 0 THEN ? ELSE verified_at END WHERE id = ?')->execute([password_hash($pass, PASSWORD_DEFAULT), time(), $uid]);
        $db->prepare('DELETE FROM sessions WHERE user_id = ?')->execute([$uid]); // keluarkan semua perangkat
        qss_json(['ok' => true]);
    }

    case 'profile': {
        $u = qss_require_user();
        $name = array_key_exists('name', $in) ? qss_str($in['name'], 120) : $u['name'];
        $mk = array_key_exists('marketing', $in) ? (!empty($in['marketing']) ? 1 : 0) : (int) $u['marketing_optin'];
        $db->prepare('UPDATE users SET name = ?, marketing_optin = ? WHERE id = ?')->execute([$name, $mk, $u['id']]);
        $st = $db->prepare('SELECT * FROM users WHERE id = ?');
        $st->execute([$u['id']]);
        qss_json(['user' => qss_public_user($st->fetch())]);
    }

    default:
        qss_json(['error' => 'Aksi tidak dikenal'], 404);
}
