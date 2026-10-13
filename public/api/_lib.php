<?php
// Utilitas bersama untuk endpoint API.
declare(strict_types=1);

function qss_config(): array {
    static $cfg = null;
    if ($cfg !== null) return $cfg;
    $file = __DIR__ . '/config.php';
    $cfg = is_file($file) ? (array) require $file : [];
    return $cfg;
}

function qss_json($data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function qss_cors(): void {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') return;
    $host = $_SERVER['HTTP_HOST'] ?? '';
    $allowed = qss_config()['allowed_origins'] ?? [];
    $same = parse_url($origin, PHP_URL_HOST) === preg_replace('/:\d+$/', '', $host);
    if ($same || in_array($origin, $allowed, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');
    } else {
        qss_json(['error' => 'Origin tidak diizinkan'], 403);
    }
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }
}

function qss_body(int $max = 65536): array {
    $raw = file_get_contents('php://input', false, null, 0, $max + 1);
    if ($raw === false || strlen($raw) > $max) qss_json(['error' => 'Permintaan terlalu besar'], 413);
    $data = json_decode($raw, true);
    if (!is_array($data)) qss_json(['error' => 'Format permintaan tidak valid'], 400);
    return $data;
}

function qss_ip(): string {
    return $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

/** Pembatas sederhana berbasis file: $limit permintaan per jam per IP. */
function qss_rate_limit(string $bucket, int $limit): void {
    $dir = __DIR__ . '/storage';
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    $file = $dir . '/rl_' . $bucket . '_' . hash('sha256', qss_ip() . date('YmdH')) . '.cnt';
    $n = is_file($file) ? (int) file_get_contents($file) : 0;
    if ($n >= $limit) qss_json(['error' => 'Terlalu banyak permintaan. Coba lagi dalam satu jam.'], 429);
    file_put_contents($file, (string) ($n + 1), LOCK_EX);
    // Bersihkan file lama sesekali
    if (random_int(1, 50) === 1) {
        foreach (glob($dir . '/rl_*.cnt') ?: [] as $f) if (filemtime($f) < time() - 7200) @unlink($f);
    }
}

function qss_str($v, int $max): string {
    $s = is_string($v) ? trim($v) : '';
    $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $s) ?? '';
    return mb_substr($s, 0, $max);
}

/** Ambil objek JSON pertama dari teks jawaban model. */
function qss_extract_json(string $text): ?array {
    $text = trim(preg_replace('/^```(?:json)?|```$/m', '', $text) ?? '');
    $start = strpos($text, '{');
    $end = strrpos($text, '}');
    if ($start === false || $end === false) return null;
    $json = json_decode(substr($text, $start, $end - $start + 1), true);
    return is_array($json) ? $json : null;
}

/**
 * Panggil Claude Messages API. Mengembalikan ['text' => string, 'usage' => array].
 * Bila gagal, langsung mengirim respons error JSON ke browser.
 */
function qss_claude(string $system, array $messages, int $maxTokens = 1200, ?string $model = null): array {
    $cfg = qss_config();
    $key = $cfg['anthropic_api_key'] ?? '';
    if ($key === '') qss_json(['error' => 'Fitur AI belum dikonfigurasi'], 503);
    $model = $model ?: ($cfg['anthropic_model'] ?? 'claude-haiku-5-5');
    $base = rtrim((string) ($cfg['anthropic_base_url'] ?? 'https://api.anthropic.com'), '/');
    $ch = curl_init($base . '/v1/messages');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 60,
        CURLOPT_HTTPHEADER => [
            'content-type: application/json',
            'x-api-key: ' . $key,
            'anthropic-version: 2023-06-01',
        ],
        CURLOPT_POSTFIELDS => json_encode([
            'model' => $model,
            'max_tokens' => $maxTokens,
            'system' => $system,
            'messages' => $messages,
        ], JSON_UNESCAPED_UNICODE),
    ]);
    $res = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if ($res === false) qss_json(['error' => 'Tidak bisa menghubungi layanan AI: ' . $err], 502);
    $data = json_decode($res, true);
    if ($code !== 200) {
        qss_stat('ai_error');
        $msg = $data['error']['message'] ?? 'Layanan AI menolak permintaan';
        qss_json(['error' => $msg], $code === 429 ? 429 : 502);
    }
    $text = '';
    foreach (($data['content'] ?? []) as $block) if (($block['type'] ?? '') === 'text') $text .= $block['text'];
    $usage = (array) ($data['usage'] ?? []);
    qss_stat('claude_calls', 1, [
        'input_tokens' => (int) ($usage['input_tokens'] ?? 0),
        'output_tokens' => (int) ($usage['output_tokens'] ?? 0),
    ]);
    return ['text' => $text, 'usage' => $usage, 'model' => $data['model'] ?? $model];
}

/**
 * Statistik pemakaian anonim (hanya angka, tanpa IP/data pribadi) per bulan,
 * untuk memantau traksi. Disimpan di api/storage/stats-YYYY-MM.json.
 */
function qss_stat(string $event, int $n = 1, array $sums = []): void {
    if (!preg_match('/^[a-z0-9_]{1,40}$/', $event)) return;
    $dir = __DIR__ . '/storage';
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    $file = $dir . '/stats-' . date('Y-m') . '.json';
    $fp = @fopen($file, 'c+');
    if (!$fp) return;
    if (flock($fp, LOCK_EX)) {
        $raw = stream_get_contents($fp);
        $s = $raw ? (json_decode($raw, true) ?: []) : [];
        $day = date('Y-m-d');
        $s['events'][$event] = ($s['events'][$event] ?? 0) + $n;
        $s['days'][$day][$event] = ($s['days'][$day][$event] ?? 0) + $n;
        foreach ($sums as $k => $v) $s['sums'][$k] = ($s['sums'][$k] ?? 0) + (int) $v;
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($s));
        fflush($fp);
        flock($fp, LOCK_UN);
    }
    fclose($fp);
}
