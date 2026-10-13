<?php
// Statistik pemakaian anonim.
//  POST {"event":"export_srt"}            → menambah hitungan (tanpa IP / data pribadi)
//  GET  /api/stats.php?key=STATS_KEY      → ringkasan bulan ini & bulan lalu (khusus pemilik)
require __DIR__ . '/_lib.php';
qss_cors();

const QSS_EVENTS = [
    'visit_studio', 'load_verses', 'fetch_qari', 'upload_audio', 'auto_sync', 'tap_sync',
    'split_verse', 'export_srt', 'export_vtt', 'export_ass', 'export_desc', 'export_json',
    'export_wav', 'export_video', 'export_batch', 'save_project',
];

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'POST') {
    $in = qss_body(1024);
    $ev = (string) ($in['event'] ?? '');
    if (in_array($ev, QSS_EVENTS, true)) {
        qss_rate_limit('stats', 600);
        qss_stat($ev);
    }
    http_response_code(204);
    exit;
}

$key = (string) (qss_config()['stats_key'] ?? '');
if ($key === '' || !hash_equals($key, (string) ($_GET['key'] ?? ''))) qss_json(['error' => 'Tidak diizinkan'], 403);

$read = function (string $ym): array {
    $f = __DIR__ . '/storage/stats-' . $ym . '.json';
    return is_file($f) ? (json_decode((string) file_get_contents($f), true) ?: []) : [];
};
$now = date('Y-m');
$prev = date('Y-m', strtotime('first day of last month'));
qss_json(['generated' => date('c'), $now => $read($now), $prev => $read($prev)]);
