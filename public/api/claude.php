<?php
// Asisten Konten: membuat judul, deskripsi, hashtag, dan teks thumbnail dengan Claude (Anthropic API).
// API key hanya ada di server (config.php), tidak pernah dikirim ke browser.
require __DIR__ . '/_lib.php';
qss_cors();
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') qss_json(['error' => 'Gunakan POST'], 405);

$cfg = qss_config();
if (($cfg['anthropic_api_key'] ?? '') === '') qss_json(['error' => 'Asisten belum dikonfigurasi'], 503);
qss_rate_limit('ai', (int) ($cfg['ai_rate_per_hour'] ?? 20));

$in = qss_body();
$lang = ($in['lang'] ?? 'id') === 'en' ? 'en' : 'id';
$surah = qss_str($in['surah'] ?? '', 60);
$meaning = qss_str($in['meaning'] ?? '', 80);
$range = qss_str($in['range'] ?? '', 20);
$reciter = qss_str($in['reciter'] ?? '', 80);
$platform = qss_str($in['platform'] ?? 'YouTube', 30);
$trans = array_slice(array_map(fn($x) => qss_str($x, 600), (array) ($in['translations'] ?? [])), 0, 40);
if ($surah === '') qss_json(['error' => 'Data surah kosong'], 400);

$langName = $lang === 'en' ? 'English' : 'Bahasa Indonesia';
$system = "You write respectful metadata for Quran recitation videos made by Muslim content creators. "
    . "Rules: never quote, paraphrase as scripture, or invent Quranic verses or hadith; do not claim rulings (fatwa); "
    . "refer to the surah and verse range by name and number only; keep a reverent, warm, non-clickbait tone; "
    . "write natural, native-sounding $langName. Respond with JSON only, no prose, no code fences.";

$user = "Platform: $platform\nSurah: $surah ($meaning)\nVerses: $range\n"
    . ($reciter !== '' ? "Reciter: $reciter\n" : '')
    . "Translation of the selected verses (for understanding the theme only, do not copy it verbatim):\n"
    . implode("\n", $trans)
    . "\n\nReturn JSON with keys: "
    . "\"titles\" (array of 5 titles, max 90 characters each, suited to the platform), "
    . "\"description\" (2 short paragraphs introducing the theme of these verses and inviting reflection, then a line inviting viewers to subscribe/follow; do NOT include the verse text or translation — the app appends those verbatim), "
    . "\"hashtags\" (array of 10-15 hashtags without spaces, each starting with #), "
    . "\"thumbnail\" (array of 3 short thumbnail text ideas, max 5 words each).";

$out = qss_claude($system, [['role' => 'user', 'content' => $user]], 1200);
$json = qss_extract_json($out['text']);
if (!is_array($json)) qss_json(['error' => 'Jawaban AI tidak terbaca. Coba lagi.'], 502);
qss_stat('ai_content');

$clean = fn($arr, $n, $m) => array_values(array_slice(array_filter(array_map(fn($x) => qss_str($x, $m), (array) $arr)), 0, $n));
qss_json([
    'titles' => $clean($json['titles'] ?? [], 6, 120),
    'description' => qss_str($json['description'] ?? '', 3000),
    'hashtags' => $clean($json['hashtags'] ?? [], 20, 60),
    'thumbnail' => $clean($json['thumbnail'] ?? [], 5, 60),
]);
