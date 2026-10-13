<?php
// Proyek cloud milik pengguna yang sedang masuk. Paket Gratis dibatasi 3 proyek.
require __DIR__ . '/_db.php';
qss_cors();
const QSS_FREE_PROJECTS = 3;
$u = qss_require_user();
$db = qss_db();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    if (isset($_GET['id'])) {
        $st = $db->prepare('SELECT id, name, surah, data, updated_at FROM projects WHERE id = ? AND user_id = ?');
        $st->execute([(int) $_GET['id'], $u['id']]);
        $r = $st->fetch();
        if (!$r) qss_json(['error' => 'Proyek tidak ditemukan.'], 404);
        qss_json(['id' => (int) $r['id'], 'data' => json_decode($r['data'], true)]);
    }
    $st = $db->prepare('SELECT id, name, surah, updated_at FROM projects WHERE user_id = ? ORDER BY updated_at DESC');
    $st->execute([$u['id']]);
    qss_json(['items' => array_map(fn($r) => ['id' => (int) $r['id'], 'title' => $r['name'], 'surah' => (int) $r['surah'], 'updatedAt' => (int) $r['updated_at'] * 1000], $st->fetchAll()), 'limit' => qss_effective_plan($u) === 'free' ? QSS_FREE_PROJECTS : null]);
}

qss_require_xhr();
if ($method === 'DELETE') {
    $st = $db->prepare('DELETE FROM projects WHERE id = ? AND user_id = ?');
    $st->execute([(int) ($_GET['id'] ?? 0), $u['id']]);
    qss_json(['ok' => true]);
}
if ($method === 'POST') {
    if ((int) $u['verified_at'] === 0) qss_json(['error' => 'Verifikasi email Anda dulu.', 'code' => 'unverified'], 403);
    $in = qss_body(3 * 1024 * 1024);
    $name = qss_str($in['name'] ?? '', 160) ?: 'Proyek';
    $surah = max(1, min(114, (int) ($in['surah'] ?? 1)));
    $data = $in['data'] ?? null;
    if (!is_array($data)) qss_json(['error' => 'Data proyek tidak valid.'], 400);
    $json = json_encode($data, JSON_UNESCAPED_UNICODE);
    $id = (int) ($in['id'] ?? 0);
    if ($id > 0) {
        $st = $db->prepare('UPDATE projects SET name = ?, surah = ?, data = ?, updated_at = ? WHERE id = ? AND user_id = ?');
        $st->execute([$name, $surah, $json, time(), $id, $u['id']]);
        $chk = $db->prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?');
        $chk->execute([$id, $u['id']]);
        if (!$chk->fetch()) qss_json(['error' => 'Proyek tidak ditemukan.'], 404);
        qss_json(['id' => $id]);
    }
    if (qss_effective_plan($u) === 'free') {
        $c = $db->prepare('SELECT COUNT(*) c FROM projects WHERE user_id = ?');
        $c->execute([$u['id']]);
        if ((int) $c->fetch()['c'] >= QSS_FREE_PROJECTS) qss_json(['error' => 'Paket Gratis maksimal ' . QSS_FREE_PROJECTS . ' proyek di cloud. Hapus satu atau upgrade ke Pro.', 'code' => 'limit'], 402);
    }
    $db->prepare('INSERT INTO projects (user_id, name, surah, data, updated_at) VALUES (?,?,?,?,?)')->execute([$u['id'], $name, $surah, $json, time()]);
    qss_json(['id' => (int) $db->lastInsertId()]);
}
qss_json(['error' => 'Metode tidak didukung'], 405);
