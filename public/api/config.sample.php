<?php
// =====================================================================
//  Quran SRT Studio — konfigurasi server
//  1) Salin file ini menjadi  config.php  (di folder api yang sama).
//  2) Isi nilai di bawah. File config.php tidak bisa dibuka dari browser.
// =====================================================================
return [
    // Asisten Konten (Claude). Buat API key di https://console.anthropic.com
    'anthropic_api_key' => '',
    // Model Claude yang dipakai. Haiku cepat & hemat; ganti ke 'claude-sonnet-5-5' untuk hasil lebih kaya.
    'anthropic_model'   => 'claude-haiku-5-5',
    // Batas permintaan AI per alamat IP per jam (mencegah penyalahgunaan).
    'ai_rate_per_hour'  => 20,
    // Batas "Rapikan terjemahan" (penyelarasan potongan ayat) per IP per jam.
    'ai_align_rate_per_hour' => 60,
    // Opsional: model khusus untuk "Rapikan terjemahan" (mis. 'claude-sonnet-5-5' agar lebih teliti). Kosong = sama dengan di atas.
    'anthropic_align_model' => '',

    // Formulir kontak: pesan dikirim ke email ini memakai mail() bawaan hosting.
    'contact_to'        => '',
    // Alamat pengirim — gunakan email di domain Anda sendiri (mis. noreply@domainanda.com) agar tidak masuk spam.
    'contact_from'      => '',
    'contact_rate_per_hour' => 5,

    // Kunci rahasia untuk melihat statistik pemakaian anonim di /api/stats.php?key=...
    // Isi dengan teks acak panjang (mis. 32 karakter). Kosong = statistik tidak bisa dilihat.
    'stats_key'         => '',

    // ---------------------------------------------------------------
    //  Akun, pembayaran & email otomatis
    // ---------------------------------------------------------------
    // Database MySQL: buat di hPanel → Databases → MySQL, lalu isi di bawah. Tabel dibuat otomatis.
    'db_host' => 'localhost',
    'db_name' => '',
    'db_user' => '',
    'db_pass' => '',

    // Alamat situs lengkap (dipakai di tautan email & redirect pembayaran), tanpa garis miring di akhir.
    'site_url' => '',

    // Email: Brevo (gratis 300 email/hari) → app.brevo.com → SMTP & API → API Keys.
    // Alamat pengirim harus sudah diverifikasi di Brevo (dan sebaiknya domain sudah di-autentikasi SPF/DKIM).
    // Kosong = memakai mail() bawaan hosting (kurang andal, sering masuk spam).
    'brevo_api_key' => '',
    'mail_from' => '',
    'mail_from_name' => 'Quran SRT Studio',

    // Xendit (Rupiah: QRIS, VA bank, e-wallet). Dashboard → Settings → Developers.
    // Pakai kunci "Secret key" (xnd_development_… untuk uji, xnd_production_… untuk live).
    'xendit_secret_key' => '',
    // Webhook verification token dari Xendit → Settings → Webhooks. URL webhook: https://DOMAIN/api/webhook-xendit.php
    'xendit_callback_token' => '',

    // PayPal (USD, untuk pengguna luar negeri). developer.paypal.com → Apps & Credentials.
    'paypal_client_id' => '',
    'paypal_secret' => '',
    'paypal_env' => 'sandbox',            // 'sandbox' untuk uji, 'live' untuk sungguhan
    'paypal_webhook_id' => '',            // URL webhook: https://DOMAIN/api/webhook-paypal.php, event PAYMENT.CAPTURE.COMPLETED

    // Donasi: jumlah minimum dan (opsional) tautan donasi lain seperti Trakteer/Saweria.
    'donation_min_idr' => 10000,
    'donation_min_usd' => 1,
    'donation_url' => '',

    // Kunci untuk memanggil cron lewat web: /api/cron.php?key=ISI. (Cron CLI "php cron.php" tidak butuh kunci.)
    'cron_key' => '',
    'signup_rate_per_hour' => 10,
    'checkout_rate_per_hour' => 20,

    // Harga paket (Rupiah & USD). Hapus komentar untuk mengubah; ini satu-satunya sumber harga.
    // 'products' => [
    //     'pro_1m'  => ['plan' => 'pro', 'months' => 1,  'idr' => 49000,  'usd' => 3.5,  'label' => 'Pro 1 bulan'],
    //     'pro_12m' => ['plan' => 'pro', 'months' => 12, 'idr' => 490000, 'usd' => 35.0, 'label' => 'Pro 12 bulan'],
    // ],

    // Domain yang boleh memanggil API ini (kosongkan = domain yang sama saja).
    'allowed_origins'   => [],
];
