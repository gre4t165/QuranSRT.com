<?php
// Corong email otomatis. Email pemasaran hanya untuk yang setuju (marketing_optin) dan selalu memuat tautan berhenti.
declare(strict_types=1);
require_once __DIR__ . '/_db.php';

function qss_funnel_send(array $u, string $kind): void {
    $site = qss_site_url();
    $name = htmlspecialchars($u['name'] ?: '', ENT_QUOTES);
    $hi = $name !== '' ? $name : qss_tr($u, 'sahabat', 'there');
    $unsub = '<a href="{{UNSUB}}" style="color:#777">' . qss_tr($u, 'Berhenti berlangganan email promosi', 'Unsubscribe from promotional emails') . '</a>';
    $until = (int) $u['plan_until'] > 0 ? date('d M Y', (int) $u['plan_until']) : '';
    switch ($kind) {
        case 'welcome':
            $subject = qss_tr($u, 'Selamat datang di Quran SRT Studio', 'Welcome to Quran SRT Studio');
            $html = qss_mail_html($subject,
                '<p>' . qss_tr($u, "Assalamu'alaikum $hi, akun Anda sudah aktif. Tiga langkah tercepat:", "Hi $hi, your account is active. The three fastest steps:") . '</p><ol>'
                . '<li>' . qss_tr($u, 'Pilih surah dan qari; waktu tiap ayat terisi otomatis.', 'Pick a surah and reciter; each verse is timed automatically.') . '</li>'
                . '<li>' . qss_tr($u, 'Potong ayat panjang dan rapikan terjemahan dengan Claude.', 'Cut long verses and align the translation with Claude.') . '</li>'
                . '<li>' . qss_tr($u, 'Ekspor SRT atau video 16:9, 9:16, 1:1.', 'Export SRT or 16:9, 9:16, 1:1 video.') . '</li></ol>',
                qss_tr($u, 'Buka Studio', 'Open Studio'), "$site/studio", '');
            qss_mail_to_user($u, 'welcome', $subject, $html);
            return;
        case 'tips_d2':
            $subject = qss_tr($u, '3 tips agar subtitle ayat lebih rapi', '3 tips for cleaner verse subtitles');
            $html = qss_mail_html($subject,
                '<ul><li>' . qss_tr($u, '<b>Potong ayat panjang</b> di tanda waqaf supaya huruf tetap besar dan terbaca.', '<b>Cut long verses</b> at waqf marks so the text stays large and readable.') . '</li>'
                . '<li>' . qss_tr($u, '<b>Rapikan terjemahan</b> dengan Claude: hanya titik potongnya yang dipilih, teks asli tidak diubah.', '<b>Align the translation</b> with Claude: only the cut points are chosen, the original text is never changed.') . '</li>'
                . '<li>' . qss_tr($u, '<b>Pratinjau layar penuh</b> sebelum ekspor video untuk memeriksa ukuran huruf.', '<b>Preview fullscreen</b> before exporting video to check text size.') . '</li></ul>',
                qss_tr($u, 'Coba sekarang', 'Try it now'), "$site/panduan", $unsub);
            qss_mail_to_user($u, 'tips_d2', $subject, $html, true);
            return;
        case 'upgrade_d5':
            $subject = qss_tr($u, 'Hasil video tanpa tanda air + sinkron semua perangkat', 'Watermark-free video + sync across devices');
            $html = qss_mail_html($subject,
                '<p>' . qss_tr($u, "Halo $hi, bila Anda rutin membuat konten Al-Qur'an, paket Pro memberi: video tanpa tanda air, ekspor batch satu juz, dan proyek tersinkron di semua perangkat.", "Hi $hi, if you publish Quran content regularly, Pro gives you watermark-free video, one-juz batch export and projects synced across devices.") . '</p>',
                qss_tr($u, 'Lihat paket Pro', 'See Pro plan'), "$site/harga", $unsub);
            qss_mail_to_user($u, 'upgrade_d5', $subject, $html, true);
            return;
        case 'expiring':
            $subject = qss_tr($u, 'Paket Anda segera berakhir', 'Your plan is about to expire');
            $html = qss_mail_html($subject,
                '<p>' . qss_tr($u, "Paket Anda aktif sampai <b>$until</b>. Perpanjang agar video tetap tanpa tanda air dan proyek cloud tetap bisa disimpan. Sisa masa aktif ikut ditambahkan.", "Your plan is active until <b>$until</b>. Renew to keep watermark-free video and cloud saves. Remaining time is added on.") . '</p>',
                qss_tr($u, 'Perpanjang', 'Renew'), "$site/harga", '');
            qss_mail_to_user($u, 'expiring_' . (int) $u['plan_until'], $subject, $html);
            return;
        case 'expired':
            $subject = qss_tr($u, 'Paket Anda telah berakhir', 'Your plan has ended');
            $html = qss_mail_html($subject,
                '<p>' . qss_tr($u, 'Akun Anda kembali ke paket Gratis. Proyek di cloud tidak dihapus; Anda tetap bisa membukanya dan mengekspor .json. Perpanjang kapan saja.', 'Your account is back on the Free plan. Cloud projects are not deleted; you can still open them and export .json. Renew any time.') . '</p>',
                qss_tr($u, 'Perpanjang paket', 'Renew plan'), "$site/harga", '');
            qss_mail_to_user($u, 'expired_' . (int) $u['plan_until'], $subject, $html);
            return;
    }
}

/** Dijalankan cron: antrikan email corong yang jatuh tempo, lalu kirim antrean. */
function qss_funnel_run(): array {
    $db = qss_db();
    $now = time();
    $count = ['queued' => 0, 'sent' => 0, 'failed' => 0];
    $once = function (array $u, string $logKind, string $sendKind) use ($db, &$count): void {
        try {
            $db->prepare('INSERT INTO email_log (user_id, kind, ts) VALUES (?,?,?)')->execute([$u['id'], $logKind, time()]);
        } catch (Throwable $e) { return; } // sudah pernah
        qss_funnel_send($u, $sendKind);
        $count['queued']++;
    };

    // Hari ke-2 (tips) dan hari ke-5 (ajakan upgrade, hanya paket gratis): hanya yang opt-in & terverifikasi.
    foreach ([['tips_d2', 2], ['upgrade_d5', 5]] as [$kind, $days]) {
        $st = $db->prepare('SELECT * FROM users WHERE verified_at > 0 AND marketing_optin = 1 AND created_at <= ? AND created_at > ?');
        $st->execute([$now - $days * 86400, $now - ($days + 10) * 86400]);
        foreach ($st->fetchAll() as $u) {
            if ($kind === 'upgrade_d5' && qss_effective_plan($u) !== 'free') continue;
            $once($u, $kind, $kind);
        }
    }
    // Pengingat 3 hari sebelum habis & pemberitahuan setelah habis (email layanan, bukan promosi).
    $st = $db->prepare("SELECT * FROM users WHERE plan <> 'free' AND plan_until > ? AND plan_until <= ?");
    $st->execute([$now, $now + 3 * 86400]);
    foreach ($st->fetchAll() as $u) $once($u, 'expiring_' . $u['plan_until'], 'expiring');
    $st = $db->prepare("SELECT * FROM users WHERE plan <> 'free' AND plan_until > 0 AND plan_until <= ? AND plan_until > ?");
    $st->execute([$now, $now - 7 * 86400]);
    foreach ($st->fetchAll() as $u) $once($u, 'expired_' . $u['plan_until'], 'expired');

    // Kirim antrean yang jatuh tempo (termasuk percobaan ulang).
    $st = $db->prepare('SELECT id FROM email_queue WHERE sent_at = 0 AND send_after <= ? ORDER BY id LIMIT 100');
    $st->execute([$now]);
    foreach ($st->fetchAll() as $r) qss_send_queued((int) $r['id']) ? $count['sent']++ : $count['failed']++;

    // Rapikan data lama.
    $db->prepare('DELETE FROM email_queue WHERE sent_at <> 0 AND send_after < ?')->execute([$now - 30 * 86400]);
    $db->prepare('DELETE FROM auth_tokens WHERE expires_at < ?')->execute([$now - 86400]);
    $db->prepare("UPDATE payments SET status = 'expired' WHERE status = 'pending' AND created_at < ?")->execute([$now - 3 * 86400]);
    return $count;
}
