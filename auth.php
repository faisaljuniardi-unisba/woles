<?php
// Session berlaku selama maksimal 1 jam sejak aktivitas terakhir.
// Cookie dibuat persisten agar status login tetap konsisten ketika browser ditutup
// lalu dibuka kembali sebelum batas idle tercapai.
const SESSION_IDLE_TIMEOUT = 3600;

ini_set('session.gc_maxlifetime', (string) SESSION_IDLE_TIMEOUT);
$sessionStoragePath = __DIR__ . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'sessions';
if (!is_dir($sessionStoragePath)) {
    mkdir($sessionStoragePath, 0755, true);
}
session_save_path($sessionStoragePath);
session_set_cookie_params([
    'lifetime' => SESSION_IDLE_TIMEOUT,
    'path' => '/',
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'httponly' => true,
    'samesite' => 'Lax'
]);
session_start();

// TURN OFF ERROR DISPLAY
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

// SET HEADER
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// HANDLE PREFLIGHT
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// RESPONSE FUNCTION
function jsonResponse($data) {
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_NUMERIC_CHECK);
    exit();
}

// GET INPUT
$input = [];
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $jsonInput = file_get_contents('php://input');
    if ($jsonInput) {
        $input = json_decode($jsonInput, true) ?: $_POST;
    } else {
        $input = $_POST;
    }
} else {
    $input = $_GET;
}

$action = $input['action'] ?? '';

function clearAuthSession() {
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    session_destroy();
}

// Terapkan idle timeout pada semua request autentikasi selain login.
if ($action !== 'login' && isset($_SESSION['user_id'])) {
    $lastActivity = $_SESSION['last_activity'] ?? $_SESSION['login_time'] ?? 0;
    if ($lastActivity <= 0 || (time() - $lastActivity) >= SESSION_IDLE_TIMEOUT) {
        clearAuthSession();
        jsonResponse([
            'success' => false,
            'expired' => true,
            'error' => 'Session berakhir karena tidak ada aktivitas selama 1 jam'
        ]);
    }

    $_SESSION['last_activity'] = time();
    // Perpanjang cookie mengikuti aktivitas terbaru (sliding expiration).
    setcookie(session_name(), session_id(), [
        'expires' => time() + SESSION_IDLE_TIMEOUT,
        'path' => '/',
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,
        'samesite' => 'Lax'
    ]);
}

// ==================== USER CREDENTIALS ====================
// CATATAN: Untuk production, simpan di database dengan password hashing
// Menggunakan database atau file untuk menyimpan user
$usersFile = 'data/users.json';

// Buat directory data jika belum ada
if (!is_dir('data')) {
    mkdir('data', 0755, true);
}

// Inisialisasi users file
if (!file_exists($usersFile)) {
    $defaultUsers = [
        [
            'id' => 1,
            'username' => 'admin',
            'password' => password_hash('admin123', PASSWORD_BCRYPT),
            'role' => 'admin',
            'name' => 'Administrator',
            'created_at' => date('Y-m-d H:i:s')
        ]
    ];
    file_put_contents($usersFile, json_encode($defaultUsers, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

// ==================== LOGIN ====================
if ($action === 'login') {
    $username = $input['username'] ?? '';
    $password = $input['password'] ?? '';
    
    if (empty($username) || empty($password)) {
        jsonResponse([
            'success' => false,
            'error' => 'Username dan password tidak boleh kosong'
        ]);
    }
    
    // Baca users dari file
    $users = json_decode(file_get_contents($usersFile), true);
    
    // Cari user
    $user = null;
    foreach ($users as $u) {
        if ($u['username'] === $username) {
            $user = $u;
            break;
        }
    }
    
    if (!$user) {
        jsonResponse([
            'success' => false,
            'error' => 'Username atau password salah'
        ]);
    }
    
    // Verifikasi password
    if (!password_verify($password, $user['password'])) {
        jsonResponse([
            'success' => false,
            'error' => 'Username atau password salah'
        ]);
    }
    
    // Set session
    session_regenerate_id(true);
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['username'] = $user['username'];
    $_SESSION['role'] = $user['role'];
    $_SESSION['name'] = $user['name'];
    $_SESSION['login_time'] = time();
    $_SESSION['last_activity'] = time();
    
    jsonResponse([
        'success' => true,
        'user_id' => $user['id'],
        'username' => $user['username'],
        'role' => $user['role'],
        'name' => $user['name'],
        'message' => 'Login berhasil'
    ]);
}

// ==================== CHECK LOGIN ====================
if ($action === 'checkLogin') {
    if (isset($_SESSION['user_id'])) {
        jsonResponse([
            'success' => true,
            'user_id' => $_SESSION['user_id'],
            'username' => $_SESSION['username'],
            'role' => $_SESSION['role'],
            'name' => $_SESSION['name']
        ]);
    } else {
        jsonResponse([
            'success' => false,
            'error' => 'Belum login'
        ]);
    }
}

// ==================== LOGOUT ====================
if ($action === 'logout') {
    clearAuthSession();
    jsonResponse([
        'success' => true,
        'message' => 'Logout berhasil'
    ]);
}

// ==================== REGISTER USER (ADMIN ONLY) ====================
if ($action === 'registerUser') {
    // Cek session
    if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'admin') {
        jsonResponse([
            'success' => false,
            'error' => 'Akses ditolak. Admin only.'
        ]);
    }
    
    $username = $input['username'] ?? '';
    $password = $input['password'] ?? '';
    $name = $input['name'] ?? '';
    $role = $input['role'] ?? 'user';
    
    if (empty($username) || empty($password) || empty($name)) {
        jsonResponse([
            'success' => false,
            'error' => 'Username, password, dan nama tidak boleh kosong'
        ]);
    }
    
    // Baca users
    $users = json_decode(file_get_contents($usersFile), true);
    
    // Cek duplikat
    foreach ($users as $u) {
        if ($u['username'] === $username) {
            jsonResponse([
                'success' => false,
                'error' => 'Username sudah terdaftar'
            ]);
        }
    }
    
    // Buat user baru
    $newUser = [
        'id' => max(array_column($users, 'id')) + 1,
        'username' => $username,
        'password' => password_hash($password, PASSWORD_BCRYPT),
        'name' => $name,
        'role' => $role,
        'created_at' => date('Y-m-d H:i:s')
    ];
    
    $users[] = $newUser;
    file_put_contents($usersFile, json_encode($users, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    
    jsonResponse([
        'success' => true,
        'message' => 'User berhasil terdaftar',
        'user_id' => $newUser['id']
    ]);
}

// ==================== GET ALL USERS (ADMIN ONLY) ====================
if ($action === 'getUsers') {
    if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'admin') {
        jsonResponse([
            'success' => false,
            'error' => 'Akses ditolak. Admin only.'
        ]);
    }
    
    $users = json_decode(file_get_contents($usersFile), true);
    
    // Remove sensitive data
    $safeUsers = array_map(function($user) {
        return [
            'id' => $user['id'],
            'username' => $user['username'],
            'name' => $user['name'],
            'role' => $user['role'],
            'created_at' => $user['created_at']
        ];
    }, $users);
    
    jsonResponse([
        'success' => true,
        'users' => $safeUsers
    ]);
}

// ==================== DELETE USER (ADMIN ONLY) ====================
if ($action === 'deleteUser') {
    if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'admin') {
        jsonResponse([
            'success' => false,
            'error' => 'Akses ditolak. Admin only.'
        ]);
    }
    
    $userId = $input['user_id'] ?? 0;
    
    if (empty($userId)) {
        jsonResponse([
            'success' => false,
            'error' => 'User ID tidak diberikan'
        ]);
    }
    
    // Jangan izinkan hapus user sendiri
    if ($userId == $_SESSION['user_id']) {
        jsonResponse([
            'success' => false,
            'error' => 'Tidak bisa menghapus akun sendiri'
        ]);
    }
    
    $users = json_decode(file_get_contents($usersFile), true);
    $users = array_filter($users, function($u) use ($userId) {
        return $u['id'] != $userId;
    });
    
    file_put_contents($usersFile, json_encode(array_values($users), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    
    jsonResponse([
        'success' => true,
        'message' => 'User berhasil dihapus'
    ]);
}

// DEFAULT: Jika action tidak dikenali
jsonResponse([
    'success' => false,
    'error' => 'Action tidak ditemukan'
]);
