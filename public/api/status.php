<?php
require __DIR__ . '/_lib.php';
qss_cors();
$c = qss_config();
$db = ($c['db_driver'] ?? 'mysql') === 'sqlite' || (!empty($c['db_name']) && !empty($c['db_user']));
qss_json([
    'ai' => !empty($c['anthropic_api_key']) && function_exists('curl_init'),
    'contact' => !empty($c['contact_to']) && function_exists('mail'),
    'accounts' => $db && in_array('pdo_' . (($c['db_driver'] ?? 'mysql') === 'sqlite' ? 'sqlite' : 'mysql'), array_map(fn($m) => strtolower($m), get_loaded_extensions()), true),
]);
