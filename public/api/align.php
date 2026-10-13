<?php
// AI Translation Aligner: saat satu ayat dipotong menjadi beberapa bagian, Claude
// menentukan di mana terjemahan harus dipotong agar tiap bagian pas maknanya dengan
// potongan Arab. Claude TIDAK menulis ulang terjemahan: ia hanya memilih nomor kata
// tempat memotong. Server memotong teks aslinya sendiri, sehingga gabungan hasilnya
// dijamin sama persis dengan terjemahan sumber.
require __DIR__ . '/_lib.php';
qss_cors();
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') qss_json(['error' => 'Gunakan POST'], 405);

$cfg = qss_config();
if (($cfg['anthropic_api_key'] ?? '') === '') qss_json(['error' => 'Fitur AI belum dikonfigurasi'], 503);
qss_rate_limit('align', (int) ($cfg['ai_align_rate_per_hour'] ?? 60));

$in = qss_body(131072);
$surah = qss_str($in['surah'] ?? '', 60);
$ayah = (int) ($in['ayah'] ?? 0);
$parts = array_values(array_map(fn($x) => qss_str($x, 2500), (array) ($in['ar'] ?? [])));
$n = count($parts);
if ($n < 2 || $n > 12 || in_array('', $parts, true)) qss_json(['error' => 'Potongan Arab tidak valid (2–12 bagian).'], 400);

$langs = ['id' => 'Indonesian', 'en' => 'English'];
$words = [];
foreach ($langs as $code => $_) {
    $t = qss_str($in['translations'][$code] ?? '', 6000);
    if ($t === '') continue;
    $w = preg_split('/\s+/u', $t, -1, PREG_SPLIT_NO_EMPTY) ?: [];
    if (count($w) >= $n) $words[$code] = $w;
}
if (!$words) qss_json(['error' => 'Terjemahan terlalu pendek untuk dibagi.'], 400);

$system = "You help a Quran subtitle tool. A single Arabic verse has been cut into consecutive parts for on-screen subtitles, "
    . "and you align an existing human translation to those parts. You never translate, paraphrase, add, remove or reorder words: "
    . "you only choose where to cut the numbered words you are given. Do not comment on meaning or rulings. Respond with JSON only.";

$user = "Surah $surah, verse $ayah. The Arabic verse is cut into $n parts:\n";
foreach ($parts as $i => $p) $user .= 'Part ' . ($i + 1) . ": $p\n";
$keys = [];
foreach ($words as $code => $w) {
    $numbered = [];
    foreach ($w as $i => $x) $numbered[] = '[' . ($i + 1) . ']' . $x;
    $user .= "\n" . $langs[$code] . " translation (" . count($w) . " numbered words):\n" . implode(' ', $numbered) . "\n";
    $keys[] = "\"$code\": [" . ($n - 1) . " integers]";
}
$user .= "\nFor each translation, choose " . ($n - 1) . " cut points so that translation part k carries the meaning of Arabic part k as closely as possible "
    . "while the translation stays in its original order. A cut point is the number of the LAST word of a part (for parts 1 to " . ($n - 1) . "). "
    . "Cut points must be strictly increasing and every part must keep at least one word. When the meaning allows, cut right after punctuation. "
    . "Return JSON only: {" . implode(', ', $keys) . "}";

/** Validasi titik potong; kembalikan potongan teks atau null. */
function qss_apply_cuts(array $w, $cuts, int $n): ?array {
    if (!is_array($cuts) || count($cuts) !== $n - 1) return null;
    $prev = 0;
    $total = count($w);
    $out = [];
    foreach (array_values($cuts) as $c) {
        if (!is_numeric($c)) return null;
        $c = (int) $c;
        if ($c <= $prev || $c >= $total) return null;
        $out[] = implode(' ', array_slice($w, $prev, $c - $prev));
        $prev = $c;
    }
    $out[] = implode(' ', array_slice($w, $prev));
    return $out;
}

$messages = [['role' => 'user', 'content' => $user]];
$result = [];
for ($attempt = 0; $attempt < 2 && count($result) < count($words); $attempt++) {
    $res = qss_claude($system, $messages, 400, ($cfg['anthropic_align_model'] ?? '') ?: null);
    $json = qss_extract_json($res['text']) ?? [];
    $bad = [];
    foreach ($words as $code => $w) {
        if (isset($result[$code])) continue;
        $seg = qss_apply_cuts($w, $json[$code] ?? null, $n);
        if ($seg) $result[$code] = $seg;
        else $bad[] = $code;
    }
    if ($bad) {
        $messages[] = ['role' => 'assistant', 'content' => $res['text']];
        $messages[] = ['role' => 'user', 'content' => 'The cut points for ' . implode(', ', $bad) . ' were invalid (need exactly ' . ($n - 1) . ' strictly increasing integers, each smaller than the word count). Reply again with the full JSON only.'];
    }
}
if (!$result) {
    qss_stat('ai_align_failed');
    qss_json(['error' => 'Claude belum bisa menyelaraskan ayat ini. Pembagian otomatis tetap dipakai.'], 422);
}
qss_stat('ai_align');
qss_json($result + ['model' => $res['model'] ?? '']);
