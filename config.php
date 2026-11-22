<?php
// config.php - VERSION WITH UPLOAD CONFIG

return [
    'host' => 'localhost',
    'dbname' => 'woles',
    'username' => 'root',
    'password' => '',
    'charset' => 'utf8mb4',
    
    // UPLOAD CONFIGURATION - DITAMBAHKAN
    'upload' => [
        'max_file_size' => 2 * 1024 * 1024, // 2MB
        'allowed_types' => ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
        'upload_dir' => 'uploads/player_photos/'
    ]
];

// JANGAN ADA SPASI/KARAKTER SETELAH INI
?>