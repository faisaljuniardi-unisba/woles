// js/auth.js
// ==================== AUTH FUNCTIONS ====================

let currentUser = null;
const SESSION_IDLE_TIMEOUT_MS = 60 * 60 * 1000;
const SESSION_HEARTBEAT_MS = 60 * 1000;
let lastUserActivity = Date.now();
let lastActivitySynced = 0;
let sessionMonitorStarted = false;
let sessionCheckInProgress = false;
let lastSessionCheckExpired = false;

function clearStoredAuth() {
    localStorage.removeItem('user_id');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
}

function redirectToLogin(expired) {
    clearStoredAuth();
    currentUser = null;
    const suffix = expired ? '?expired=1' : '';
    if (!window.location.pathname.endsWith('/login.html')) {
        window.location.replace('login.html' + suffix);
    }
}

// Check login status on page load
async function checkLoginStatus() {
    try {
        const response = await fetch('auth.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'checkLogin'
            })
        });
        
        const data = await response.json();
        lastSessionCheckExpired = data.expired === true;
        
        if (data.success) {
            currentUser = {
                user_id: data.user_id,
                username: data.username,
                role: data.role,
                name: data.name
            };
            return true;
        } else {
            currentUser = null;
            clearStoredAuth();
            return false;
        }
    } catch (error) {
        console.error('Error checking login:', error);
        return false;
    }
}

async function validateActiveSession() {
    if (!currentUser || sessionCheckInProgress) return;
    sessionCheckInProgress = true;
    try {
        const active = await checkLoginStatus();
        if (!active) redirectToLogin(lastSessionCheckExpired);
    } finally {
        sessionCheckInProgress = false;
    }
}

async function expireInactiveSession() {
    try {
        await fetch('auth.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'logout' })
        });
    } catch (error) {
        console.warn('Gagal memberi tahu server saat session berakhir:', error);
    } finally {
        redirectToLogin(true);
    }
}

function startSessionActivityMonitor() {
    if (sessionMonitorStarted) return;
    sessionMonitorStarted = true;

    ['click', 'keydown', 'scroll', 'touchstart', 'mousemove'].forEach(function(eventName) {
        window.addEventListener(eventName, function() {
            lastUserActivity = Date.now();
        }, { passive: true });
    });

    window.setInterval(function() {
        if (!currentUser) return;
        if ((Date.now() - lastUserActivity) >= SESSION_IDLE_TIMEOUT_MS) {
            expireInactiveSession();
            return;
        }
        // Hubungi server hanya jika memang ada aktivitas pengguna sejak sinkronisasi
        // terakhir, sehingga heartbeat tidak dianggap sebagai aktivitas palsu.
        if (lastUserActivity > lastActivitySynced) {
            lastActivitySynced = lastUserActivity;
            validateActiveSession();
        }
    }, SESSION_HEARTBEAT_MS);

    // Saat ponsel/browser aktif kembali, anggap itu aktivitas baru dan validasi
    // sesi segera tanpa bergantung pada timer yang dapat dibekukan di background.
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible' && currentUser) {
            lastUserActivity = Date.now();
            validateActiveSession();
        }
    });
    window.addEventListener('pageshow', function() {
        if (currentUser) {
            lastUserActivity = Date.now();
            validateActiveSession();
        }
    });
}

// Logout function
async function logout() {
    if (!confirm('Yakin ingin logout?')) {
        return;
    }
    
    try {
        const response = await fetch('auth.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'logout'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Clear storage
            clearStoredAuth();
            
            currentUser = null;
            
            // Redirect to leaderboard (dashboard)
            window.location.href = 'index.html#dashboard';
        } else {
            alert('Gagal logout: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error logout:', error);
        alert('Terjadi kesalahan: ' + error.message);
    }
}

// Register user (admin only)
async function registerUser(username, password, name, role = 'user') {
    if (!currentUser || currentUser.role !== 'admin') {
        alert('Hanya admin yang bisa registrasi user');
        return false;
    }
    
    try {
        const response = await fetch('auth.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'registerUser',
                username: username,
                password: password,
                name: name,
                role: role
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert('User berhasil terdaftar: ' + username);
            return true;
        } else {
            alert('Gagal registrasi: ' + (data.error || 'Unknown error'));
            return false;
        }
    } catch (error) {
        console.error('Error register:', error);
        alert('Terjadi kesalahan: ' + error.message);
        return false;
    }
}

// Get all users (admin only)
async function getAllUsers() {
    if (!currentUser || currentUser.role !== 'admin') {
        alert('Hanya admin yang bisa melihat user');
        return [];
    }
    
    try {
        const response = await fetch('auth.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'getUsers'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            return data.users;
        } else {
            console.error('Error getting users:', data.error);
            return [];
        }
    } catch (error) {
        console.error('Error:', error);
        return [];
    }
}

// Delete user (admin only)
async function deleteUser(userId) {
    if (!currentUser || currentUser.role !== 'admin') {
        alert('Hanya admin yang bisa hapus user');
        return false;
    }
    
    if (!confirm('Yakin ingin menghapus user ini?')) {
        return false;
    }
    
    try {
        const response = await fetch('auth.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'deleteUser',
                user_id: userId
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            alert(data.message);
            return true;
        } else {
            alert('Gagal hapus user: ' + (data.error || 'Unknown error'));
            return false;
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Terjadi kesalahan: ' + error.message);
        return false;
    }
}

// Check if user is authenticated
function isAuthenticated() {
    return currentUser !== null;
}

// Is admin
function isAdmin() {
    return currentUser && currentUser.role === 'admin';
}

// Redirect to login if not admin
function requireAdmin() {
    if (!isAdmin()) {
        alert('Akses ditolak. Admin only.');
        return false;
    }
    return true;
}
