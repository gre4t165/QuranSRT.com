<?php
// Jalankan tiap 15–60 menit. Di hPanel → Cron Jobs:  php /home/USER/public_html/api/cron.php
// Atau lewat web:  /api/cron.php?key=ISI_cron_key  (cron_key di config.php).
require __DIR__ . '/_funnel.php';
if (PHP_SAPI !== 'cli') {
    $key = (string) (qss_config()['cron_key'] ?? '');
    if ($key === '' || !hash_equals($key, (string) ($_GET['key'] ?? ''))) { http_response_code(403); exit('Forbidden'); }
    header('Content-Type: application/json');
}
echo json_encode(qss_funnel_run()), "\n";
