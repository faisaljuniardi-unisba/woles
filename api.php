<?php

// TURN OFF ERROR DISPLAY, LOG KE FILE
ini_set('display_errors', 0);
ini_set('log_errors', 1);
error_reporting(E_ALL);

// SET HEADER PERTAMA KALI
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// HANDLE PREFLIGHT
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// BUAT RESPONSE STANDAR
function jsonResponse($data) {
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_NUMERIC_CHECK);
    exit();
}

// CEK JIKA config.php ADA
if (!file_exists('config.php')) {
    jsonResponse([
        'success' => false,
        'error' => 'File config.php tidak ditemukan',
        'solution' => 'Buat file config.php dengan konfigurasi database'
    ]);
}

// LOAD CONFIG
$config = include('config.php');

// VALIDASI CONFIG
if (empty($config['host']) || empty($config['dbname'])) {
    jsonResponse([
        'success' => false,
        'error' => 'Konfigurasi database tidak lengkap',
        'config_received' => $config
    ]);
}

// KONEKSI DATABASE
try {
    $pdo = new PDO(
        "mysql:host={$config['host']};dbname={$config['dbname']};charset=utf8mb4",
        $config['username'],
        $config['password'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false
        ]
    );
} catch (PDOException $e) {
    jsonResponse([
        'success' => false,
        'error' => 'Koneksi database gagal: ' . $e->getMessage(),
        'config_used' => [
            'host' => $config['host'],
            'dbname' => $config['dbname'],
            'username' => $config['username']
        ]
    ]);
}

function ensureTeamPlayersSlotIndexColumn($pdo) {
    try {
        $colStmt = $pdo->query("SHOW COLUMNS FROM team_players LIKE 'slot_index'");
        if (!$colStmt->fetch()) {
            $pdo->exec("ALTER TABLE team_players ADD COLUMN slot_index TINYINT(1) NULL");
        }
        return true;
    } catch (Exception $e) {
        return false;
    }
}

function ensureMatchDateTeamCountColumn($pdo) {
    try {
        $colStmt = $pdo->query("SHOW COLUMNS FROM match_dates LIKE 'team_count'");
        if (!$colStmt->fetch()) {
            $pdo->exec("ALTER TABLE match_dates ADD COLUMN team_count TINYINT(1) NOT NULL DEFAULT 4");
        }
        return true;
    } catch (Exception $e) {
        return false;
    }
}

function ensureTeamColorEnum($pdo) {
    try {
        $teamColStmt = $pdo->query("SHOW COLUMNS FROM teams LIKE 'color'");
        $teamColumn = $teamColStmt->fetch(PDO::FETCH_ASSOC);
        if ($teamColumn && strpos($teamColumn['Type'], "'putih'") === false) {
            $pdo->exec("ALTER TABLE teams MODIFY COLUMN color ENUM('merah','kuning','hijau','biru','putih') NOT NULL");
        }

        $teamPlayerColStmt = $pdo->query("SHOW COLUMNS FROM team_players LIKE 'team_color'");
        $teamPlayerColumn = $teamPlayerColStmt->fetch(PDO::FETCH_ASSOC);
        if ($teamPlayerColumn && strpos($teamPlayerColumn['Type'], "'putih'") === false) {
            $pdo->exec("ALTER TABLE team_players MODIFY COLUMN team_color ENUM('merah','kuning','hijau','biru','putih') NOT NULL");
        }
        return true;
    } catch (Exception $e) {
        return false;
    }
}

function getDefaultTeamColors() {
    return ['merah', 'kuning', 'hijau', 'biru', 'putih'];
}

function getDefaultMatchPairs() {
    return [
        ['merah', 'biru'],
        ['kuning', 'hijau'],
        ['merah', 'putih'],
        ['kuning', 'biru'],
        ['hijau', 'putih'],
        ['merah', 'kuning'],
        ['biru', 'putih'],
        ['hijau', 'biru'],
        ['merah', 'hijau'],
        ['kuning', 'putih']
    ];
}

// GET INPUT DATA
$input = []; 
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $input = $_GET;
} else {
    $jsonInput = file_get_contents('php://input');
    if ($jsonInput) {
        $input = json_decode($jsonInput, true) ?: $_POST;
    } else {
        $input = $_POST;
    }
}

$action = $input['action'] ?? '';

// ==============================================
// ACTIONS
// ==============================================

// 1. GET PLAYERS
if ($action === 'getPlayers') {
    try {
        $stmt = $pdo->query("SELECT name, photo FROM players ORDER BY name");
        $players = $stmt->fetchAll();
        jsonResponse(['success' => true, 'players' => $players]);
    } catch (PDOException $e) {
        jsonResponse(['success' => false, 'error' => $e->getMessage()]);
    }
}

// 2. ADD PLAYER
if ($action === 'addPlayer') {
    $playerName = trim($input['playerName'] ?? '');
    
    if (empty($playerName)) {
        jsonResponse(['success' => false, 'error' => 'Nama pemain tidak boleh kosong']);
    }
    
    try {
        $stmt = $pdo->prepare("INSERT INTO players (name) VALUES (?)");
        $stmt->execute([$playerName]);
        jsonResponse(['success' => true]);
    } catch (PDOException $e) {
        $errorMsg = $e->getMessage();
        if (strpos($errorMsg, 'Duplicate') !== false || $e->getCode() == 23000) {
            jsonResponse(['success' => false, 'error' => 'Pemain sudah ada']);
        } else {
            jsonResponse(['success' => false, 'error' => $errorMsg]);
        }
    }
}

// 3. REMOVE PLAYER
if ($action === 'removePlayer') {
    $playerName = $input['playerName'] ?? '';
    
    if (empty($playerName)) {
        jsonResponse(['success' => false, 'error' => 'Nama pemain tidak diberikan']);
    }
    
    try {
        // Cek apakah pemain punya foto
        $stmt = $pdo->prepare("SELECT photo FROM players WHERE name = ?");
        $stmt->execute([$playerName]);
        $photo = $stmt->fetchColumn();
        
        // Hapus file foto jika ada
        if ($photo) {
            $filePath = 'uploads/player_photos/' . $photo;
            if (file_exists($filePath)) {
                unlink($filePath);
            }
        }
        
        // Hapus pemain dari database
        $stmt = $pdo->prepare("DELETE FROM players WHERE name = ?");
        $stmt->execute([$playerName]);
        jsonResponse(['success' => true]);
    } catch (PDOException $e) {
        jsonResponse(['success' => false, 'error' => $e->getMessage()]);
    }
}

if ($action === 'renamePlayer') {
    $oldName = trim($input['oldName'] ?? '');
    $newName = trim($input['newName'] ?? '');
    if ($oldName === '' || $newName === '') jsonResponse(['success' => false, 'error' => 'Nama pemain tidak boleh kosong']);

    try {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM players WHERE name = ?");
        $stmt->execute([$newName]);
        if ($stmt->fetchColumn() > 0) jsonResponse(['success' => false, 'error' => 'Nama pemain sudah digunakan']);

        $pdo->beginTransaction();
        $stmt = $pdo->prepare("INSERT INTO players (name, photo) SELECT ?, photo FROM players WHERE name = ?");
        $stmt->execute([$newName, $oldName]);
        if ($stmt->rowCount() === 0) throw new Exception('Pemain tidak ditemukan');
        $pdo->prepare("UPDATE team_players SET player_name = ? WHERE player_name = ?")->execute([$newName, $oldName]);
        $pdo->prepare("UPDATE cancel_players SET player_name = ? WHERE player_name = ?")->execute([$newName, $oldName]);
        $pdo->prepare("UPDATE leaderboard SET player_name = ? WHERE player_name = ?")->execute([$newName, $oldName]);
        $pdo->prepare("DELETE FROM players WHERE name = ?")->execute([$oldName]);
        $pdo->commit();
        jsonResponse(['success' => true]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        jsonResponse(['success' => false, 'error' => $e->getMessage()]);
    }
}

// 4. GET MATCH DATE DATA
if ($action === 'getMatchDateData') {
    $date = $input['date'] ?? '';
    
    if (empty($date)) {
        jsonResponse(['success' => false, 'error' => 'Tanggal tidak diberikan']);
    }
    
    try {
        ensureMatchDateTeamCountColumn($pdo);
        ensureTeamColorEnum($pdo);

        // CEK APAKAH TANGGAL SUDAH ADA
        $stmt = $pdo->prepare("SELECT match_date, team_count FROM match_dates WHERE match_date = ?");
        $stmt->execute([$date]);
        $dateExists = $stmt->fetch();
        
        if (!$dateExists) {
            // BUAT DATA DEFAULT
            $pdo->beginTransaction();
            
            // INSERT DATE
            $pdo->prepare("INSERT INTO match_dates (match_date, team_count) VALUES (?, ?)")->execute([$date, 4]);
            
            // INSERT DEFAULT TEAMS
            $colors = getDefaultTeamColors();
            foreach ($colors as $color) {
                $pdo->prepare("INSERT INTO teams (match_date, color) VALUES (?, ?)")->execute([$date, $color]);
            }
            
            // INSERT DEFAULT MATCHES
            $matches = [];
            foreach (getDefaultMatchPairs() as $index => $pair) {
                $matches[] = [$index, $pair[0], $pair[1]];
            }
            
            foreach ($matches as $match) {
                $pdo->prepare("INSERT INTO matches (match_date, match_index, team1, team2) VALUES (?, ?, ?, ?)")
                    ->execute([$date, $match[0], $match[1], $match[2]]);
            }
            
            $pdo->commit();
        }

        $stmt = $pdo->prepare("SELECT team_count FROM match_dates WHERE match_date = ?");
        $stmt->execute([$date]);
        $savedDateRow = $stmt->fetch();
        $teamCount = isset($savedDateRow['team_count']) ? (int)$savedDateRow['team_count'] : 4;
        
        // GET TEAMS DATA
        $teams = [];
        $colors = getDefaultTeamColors();
        
        foreach ($colors as $color) {
            // GET TEAM STATS
            // Di getMatchDateData, tambahkan gk dari teams
            $stmt = $pdo->prepare("SELECT *, gk FROM teams WHERE match_date = ? AND color = ?");
            $stmt->execute([$date, $color]);
            $teamStats = $stmt->fetch() ?: [];
            
            $slotIndexSupported = ensureTeamPlayersSlotIndexColumn($pdo);
            $selectColumns = $slotIndexSupported ? 'tp.is_gk, tp.slot_index' : 'tp.is_gk';
            $stmt = $pdo->prepare("
                SELECT p.name, p.photo, $selectColumns 
                FROM team_players tp
                JOIN players p ON tp.player_name = p.name
                WHERE tp.match_date = ? AND tp.team_color = ? AND tp.is_cancel = 0
            ");
            $stmt->execute([$date, $color]);
            $players = $stmt->fetchAll();

            $slots = array_fill(0, 8, null);
            $fieldPlayers = [];
            $gk = null;
            foreach ($players as $player) {
                $name = $player['name'];
                $isGKRow = !empty($player['is_gk']);
                $slotIndex = isset($player['slot_index']) ? $player['slot_index'] : null;
                if ($isGKRow) {
                    $gk = $name;
                }
                if ($slotIndex !== null && $slotIndex !== '') {
                    $slotIndex = (int)$slotIndex;
                    if ($slotIndex >= 0 && $slotIndex < 8) {
                        $slots[$slotIndex] = $name;
                        continue;
                    }
                }
                if ($isGKRow) {
                    if ($slots[0] === null) {
                        $slots[0] = $name;
                    }
                } else {
                    $fieldPlayers[] = $name;
                }
            }
            foreach ($fieldPlayers as $name) {
                for ($si = 1; $si < 8; $si++) {
                    if ($slots[$si] === null) {
                        $slots[$si] = $name;
                        break;
                    }
                }
            }

            if (empty($slots[0]) && !empty($teamStats['gk'])) {
                $slots[0] = $teamStats['gk'];
            }

            $playerNames = [];
            for ($si = 1; $si < 8; $si++) {
                if (!empty($slots[$si])) {
                    $playerNames[] = $slots[$si];
                }
            }

            $teams[] = [
                'color' => $color,
                'slots' => $slots,
                'players' => $playerNames,
                'gk' => $slots[0] ?? $teamStats['gk'] ?? null,
                'wins' => (int)($teamStats['wins'] ?? 0),
                'draws' => (int)($teamStats['draws'] ?? 0),
                'losses' => (int)($teamStats['losses'] ?? 0),
                'goalsFor' => (int)($teamStats['goals_for'] ?? 0),
                'goalsAgainst' => (int)($teamStats['goals_against'] ?? 0),
                'champion' => isset($teamStats['champion']) ? (bool)$teamStats['champion'] : false
            ];
        }
        
        // GET MATCHES
        $stmt = $pdo->prepare("SELECT * FROM matches WHERE match_date = ? ORDER BY match_index");
        $stmt->execute([$date]);
        $matches = $stmt->fetchAll();
        
        $formattedMatches = [];
        foreach ($matches as $match) {
            $formattedMatches[] = [
                'team1' => $match['team1'],
                'team2' => $match['team2'],
                'score1' => $match['score1'] !== null ? (int)$match['score1'] : null,
                'score2' => $match['score2'] !== null ? (int)$match['score2'] : null,
                'note' => $match['note'] ?? ''
            ];
        }
        
        // GET ALL CANCEL PLAYERS (DARI TABEL cancel_players)
        $stmt = $pdo->prepare("
            SELECT player_name
            FROM cancel_players
            WHERE match_date = ?
        ");
        $stmt->execute([$date]);
        $allCancelPlayers = $stmt->fetchAll(PDO::FETCH_COLUMN, 0);
        
        jsonResponse([
            'success' => true,
            'date' => $date,
            'teamCount' => $teamCount,
            'teams' => $teams,
            'matches' => $formattedMatches,
            'cancelOnDay' => $allCancelPlayers
        ]);
        
    } catch (Exception $e) {
        jsonResponse(['success' => false, 'error' => $e->getMessage()]);
    }
}

// 5. SAVE MATCH DATE DATA
if ($action === 'saveMatchDateData') {
    $date = $input['date'] ?? '';
    $weekDataJson = $input['weekData'] ?? '{}';
    $weekData = json_decode($weekDataJson, true);
    
    if (empty($date) || empty($weekData)) {
        jsonResponse(['success' => false, 'error' => 'Data tidak lengkap']);
    }
    
    try {
        // Ensure teams table has champion column (add if missing)
        try {
            $colStmt = $pdo->query("SHOW COLUMNS FROM teams LIKE 'champion'");
            $colExists = $colStmt->fetch();
            if (!$colExists) {
                $pdo->exec("ALTER TABLE teams ADD COLUMN champion TINYINT(1) DEFAULT 0");
            }
        } catch (Exception $e) {
            // ignore if cannot alter
        }

        ensureMatchDateTeamCountColumn($pdo);
        ensureTeamColorEnum($pdo);
        $slotIndexSupported = ensureTeamPlayersSlotIndexColumn($pdo);
        $pdo->beginTransaction();

        $teamCountToSave = isset($weekData['teamCount']) ? (int)$weekData['teamCount'] : (isset($weekData['team_count']) ? (int)$weekData['team_count'] : 4);
        if ($teamCountToSave !== 5) {
            $teamCountToSave = 4;
        }

        // 1. HAPUS DATA LAMA UNTUK TANGGAL INI
        $pdo->prepare("DELETE FROM team_players WHERE match_date = ?")->execute([$date]);
        $pdo->prepare("DELETE FROM cancel_players WHERE match_date = ?")->execute([$date]);
        $pdo->prepare("DELETE FROM teams WHERE match_date = ?")->execute([$date]);
        
        // 2. SIMPAN DATA TIM
        foreach ($weekData['teams'] as $team) {
            $slots = [];
            if (!empty($team['slots']) && is_array($team['slots']) && count($team['slots']) === 8) {
                $slots = $team['slots'];
            } else {
                $slots = array_fill(0, 8, null);
                if (!empty($team['gk'])) {
                    $slots[0] = $team['gk'];
                }
                $fieldPlayers = !empty($team['players']) && is_array($team['players']) ? $team['players'] : [];
                $slotPos = 1;
                foreach ($fieldPlayers as $playerName) {
                    if ($slotPos >= 8) break;
                    $slots[$slotPos++] = $playerName;
                }
            }

            $teamGk = !empty($slots[0]) ? $slots[0] : null;
            $pdo->prepare(
                "INSERT INTO teams (match_date, color, wins, draws, losses, goals_for, goals_against, gk, champion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
            )->execute([
                $date,
                $team['color'],
                $team['wins'] ?? 0,
                $team['draws'] ?? 0,
                $team['losses'] ?? 0,
                $team['goalsFor'] ?? 0,
                $team['goalsAgainst'] ?? 0,
                $teamGk,
                isset($team['champion']) && $team['champion'] ? 1 : 0
            ]);

            $seenPlayers = [];
            foreach ($slots as $slotIndex => $player) {
                if (empty($player)) {
                    continue;
                }
                if (in_array($player, $weekData['cancelOnDay'] ?? [], true)) {
                    continue;
                }
                if (in_array($player, $seenPlayers, true)) {
                    continue;
                }
                $seenPlayers[] = $player;

                $isGK = ($slotIndex === 0) ? 1 : 0;
                if ($slotIndexSupported) {
                    $pdo->prepare(
                        "INSERT INTO team_players (match_date, team_color, player_name, is_gk, is_cancel, slot_index) VALUES (?, ?, ?, ?, 0, ?)"
                    )->execute([$date, $team['color'], $player, $isGK, $slotIndex]);
                } else {
                    $pdo->prepare(
                        "INSERT INTO team_players (match_date, team_color, player_name, is_gk, is_cancel) VALUES (?, ?, ?, ?, 0)"
                    )->execute([$date, $team['color'], $player, $isGK]);
                }
            }
        }
        
        $stmt = $pdo->prepare("SELECT id FROM match_dates WHERE match_date = ?");
        $stmt->execute([$date]);
        $matchDateRow = $stmt->fetch();
        if ($matchDateRow) {
            $pdo->prepare("UPDATE match_dates SET team_count = ? WHERE match_date = ?")->execute([$teamCountToSave, $date]);
        } else {
            $pdo->prepare("INSERT INTO match_dates (match_date, team_count) VALUES (?, ?)")->execute([$date, $teamCountToSave]);
        }

        // 3. SIMPAN CANCEL PLAYERS
        foreach ($weekData['cancelOnDay'] ?? [] as $cancelPlayer) {
            $pdo->prepare("
                INSERT INTO cancel_players (match_date, player_name)
                VALUES (?, ?)
            ")->execute([$date, $cancelPlayer]);
        }
        
        // ============ PERBAIKAN: UPDATE MATCH SCORES ============
        // 4. UPDATE MATCH SCORES - PASTIKAN SEMUA MATCH TERSIMPAN
        $matches = $weekData['matches'] ?? [];
        
        // Jika tidak ada matches, buat default
        if (empty($matches)) {
            $defaultMatches = ($teamCountToSave === 5) ? 
                [
                    ['merah', 'biru'], ['kuning', 'hijau'], ['merah', 'putih'],
                    ['kuning', 'biru'], ['hijau', 'putih'], ['merah', 'kuning'],
                    ['biru', 'putih'], ['hijau', 'biru'], ['merah', 'hijau'],
                    ['kuning', 'putih']
                ] :
                [
                    ['merah', 'biru'], ['kuning', 'hijau'], ['hijau', 'merah'],
                    ['biru', 'kuning'], ['merah', 'kuning'], ['hijau', 'biru']
                ];
            
            foreach ($defaultMatches as $index => $pair) {
                $pdo->prepare("
                    INSERT INTO matches (match_date, match_index, team1, team2, score1, score2, note)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ")->execute([
                    $date,
                    $index,
                    $pair[0],
                    $pair[1],
                    null,
                    null,
                    ''
                ]);
            }
        } else {
            // Hapus matches lama
            $pdo->prepare("DELETE FROM matches WHERE match_date = ?")->execute([$date]);
            
            // Insert matches baru dengan skor
            foreach ($matches as $index => $match) {
                $score1 = isset($match['score1']) && $match['score1'] !== null && $match['score1'] !== '' ? (int)$match['score1'] : null;
                $score2 = isset($match['score2']) && $match['score2'] !== null && $match['score2'] !== '' ? (int)$match['score2'] : null;
                
                $pdo->prepare("
                    INSERT INTO matches (match_date, match_index, team1, team2, score1, score2, note)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ")->execute([
                    $date,
                    $index,
                    $match['team1'],
                    $match['team2'],
                    $score1,
                    $score2,
                    $match['note'] ?? ''
                ]);
            }
        }
        
        $pdo->commit();
        jsonResponse(['success' => true]);
        
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonResponse(['success' => false, 'error' => $e->getMessage()]);
    }
}

// 6. GET ALL DATA
if ($action === 'getAllData') {
    try {
        ensureMatchDateTeamCountColumn($pdo);
        ensureTeamColorEnum($pdo);

        // GET PLAYERS
        $stmt = $pdo->query("SELECT name, photo FROM players ORDER BY name");
        $players = $stmt->fetchAll();
        
        // GET LAST 4 MATCH DATES
        $stmt = $pdo->query("SELECT match_date FROM match_dates ORDER BY match_date DESC LIMIT 4");
        $dates = $stmt->fetchAll(PDO::FETCH_COLUMN, 0);
        
        // REVERSE TO OLDEST FIRST
        $dates = array_reverse($dates);
        
        $weeksData = [];
        foreach ($dates as $weekNum => $date) {
            // GET TEAMS FOR THIS DATE
            $teams = [];
            $colors = getDefaultTeamColors();
            
            foreach ($colors as $color) {
                $stmt = $pdo->prepare("SELECT * FROM teams WHERE match_date = ? AND color = ?");
                $stmt->execute([$date, $color]);
                $teamStats = $stmt->fetch() ?: [];
                
                $slotIndexSupported = ensureTeamPlayersSlotIndexColumn($pdo);
                $selectColumns = $slotIndexSupported ? 'tp.is_gk, tp.slot_index' : 'tp.is_gk';
                $stmt = $pdo->prepare("
                    SELECT p.name, p.photo, $selectColumns 
                    FROM team_players tp
                    JOIN players p ON tp.player_name = p.name
                    WHERE tp.match_date = ? AND tp.team_color = ? AND tp.is_cancel = 0
                ");
                $stmt->execute([$date, $color]);
                $teamPlayers = $stmt->fetchAll();

                $slots = array_fill(0, 8, null);
                $fieldPlayers = [];
                $gk = null;
                foreach ($teamPlayers as $p) {
                    $name = $p['name'];
                    $isGKRow = !empty($p['is_gk']);
                    $slotIndex = isset($p['slot_index']) ? $p['slot_index'] : null;
                    if ($isGKRow) {
                        $gk = $name;
                    }
                    if ($slotIndex !== null && $slotIndex !== '') {
                        $slotIndex = (int)$slotIndex;
                        if ($slotIndex >= 0 && $slotIndex < 8) {
                            $slots[$slotIndex] = $name;
                            continue;
                        }
                    }
                    if ($isGKRow) {
                        if ($slots[0] === null) {
                            $slots[0] = $name;
                        }
                    } else {
                        $fieldPlayers[] = $name;
                    }
                }
                foreach ($fieldPlayers as $name) {
                    for ($si = 1; $si < 8; $si++) {
                        if ($slots[$si] === null) {
                            $slots[$si] = $name;
                            break;
                        }
                    }
                }

                if (empty($slots[0]) && !empty($teamStats['gk'])) {
                    $slots[0] = $teamStats['gk'];
                }

                $playerNames = [];
                for ($si = 1; $si < 8; $si++) {
                    if (!empty($slots[$si])) {
                        $playerNames[] = $slots[$si];
                    }
                }

                $teams[] = [
                    'color' => $color,
                    'slots' => $slots,
                    'players' => $playerNames,
                    'gk' => $slots[0] ?? $teamStats['gk'] ?? null,
                    'wins' => (int)($teamStats['wins'] ?? 0),
                    'draws' => (int)($teamStats['draws'] ?? 0),
                    'losses' => (int)($teamStats['losses'] ?? 0),
                    'goalsFor' => (int)($teamStats['goals_for'] ?? 0),
                    'goalsAgainst' => (int)($teamStats['goals_against'] ?? 0),
                    'champion' => isset($teamStats['champion']) ? (bool)$teamStats['champion'] : false
                ];
            }
            
            // GET MATCHES
            $stmt = $pdo->prepare("SELECT * FROM matches WHERE match_date = ? ORDER BY match_index");
            $stmt->execute([$date]);
            $matches = $stmt->fetchAll();
            
            $formattedMatches = [];
            foreach ($matches as $match) {
                $formattedMatches[] = [
                    'team1' => $match['team1'],
                    'team2' => $match['team2'],
                    'score1' => $match['score1'] !== null ? (int)$match['score1'] : null,
                    'score2' => $match['score2'] !== null ? (int)$match['score2'] : null,
                    'note' => $match['note'] ?? ''
                ];
            }
            
            // GET CANCEL PLAYERS (DARI TABEL cancel_players)
            $stmt = $pdo->prepare("
                SELECT player_name 
                FROM cancel_players
                WHERE match_date = ?
            ");
            $stmt->execute([$date]);
            $cancelPlayers = $stmt->fetchAll(PDO::FETCH_COLUMN, 0);
            
            $stmt = $pdo->prepare("SELECT team_count FROM match_dates WHERE match_date = ?");
            $stmt->execute([$date]);
            $teamCountRow = $stmt->fetch();
            $savedTeamCount = isset($teamCountRow['team_count']) ? (int)$teamCountRow['team_count'] : 4;

            $weeksData[] = [
                'date' => $date,
                'teamCount' => $savedTeamCount,
                'teams' => $teams,
                'matches' => $formattedMatches,
                'cancelOnDay' => $cancelPlayers
            ];
        }
        
        jsonResponse([
            'success' => true,
            'players' => $players,
            'weeksData' => $weeksData
        ]);
        
    } catch (Exception $e) {
        jsonResponse(['success' => false, 'error' => $e->getMessage()]);
    }
}

// 7. GET LEADERBOARD
if ($action === 'getLeaderboard') {
    $periodType = $input['periodType'] ?? '4_weeks';
    
    try {
        $stmt = $pdo->prepare("
            SELECT * FROM leaderboard 
            WHERE period_type = ? AND total_points > 0
            ORDER BY total_points DESC
        ");
        $stmt->execute([$periodType]);
        $leaderboard = $stmt->fetchAll();
        
        jsonResponse(['success' => true, 'leaderboard' => $leaderboard]);
        
    } catch (Exception $e) {
        jsonResponse(['success' => false, 'error' => $e->getMessage()]);
    }
}

// 8. UPDATE LEADERBOARD
if ($action === 'updateLeaderboard') {
    $periodType = $input['periodType'] ?? '4_weeks';
    $leaderboardDataJson = $input['leaderboardData'] ?? '[]';
    $leaderboardData = json_decode($leaderboardDataJson, true);
    
    try {
        $pdo->beginTransaction();
        
        // HAPUS DATA LAMA
        $pdo->prepare("DELETE FROM leaderboard WHERE period_type = ?")->execute([$periodType]);
        
        // INSERT DATA BARU
        foreach ($leaderboardData as $player) {
            $pdo->prepare("
                INSERT INTO leaderboard 
                (player_name, total_points, week1_points, week2_points, week3_points, week4_points, week5_points, period_type)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ")->execute([
                $player['playerName'],
                $player['totalPoints'] ?? 0,
                $player['week1'] ?? 0,
                $player['week2'] ?? 0,
                $player['week3'] ?? 0,
                $player['week4'] ?? 0,
                $player['week5'] ?? 0,
                $periodType
            ]);
        }
        
        $pdo->commit();
        jsonResponse(['success' => true]);
        
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonResponse(['success' => false, 'error' => $e->getMessage()]);
    }
}

// 9. GET MATCH DATES
if ($action === 'getMatchDates') {
    try {
        $stmt = $pdo->query("SELECT match_date FROM match_dates ORDER BY match_date DESC");
        $dates = $stmt->fetchAll(PDO::FETCH_COLUMN, 0);
        jsonResponse(['success' => true, 'dates' => $dates]);
    } catch (Exception $e) {
        jsonResponse(['success' => false, 'error' => $e->getMessage()]);
    }
}

// 10. DELETE MATCH DATE
if ($action === 'deleteMatchDate') {
    $date = $input['date'] ?? '';
    if (empty($date)) {
        jsonResponse(['success' => false, 'error' => 'Tanggal pertandingan tidak diberikan']);
    }

    try {
        $pdo->beginTransaction();
        $pdo->prepare("DELETE FROM team_players WHERE match_date = ?")->execute([$date]);
        $pdo->prepare("DELETE FROM cancel_players WHERE match_date = ?")->execute([$date]);
        $pdo->prepare("DELETE FROM matches WHERE match_date = ?")->execute([$date]);
        $pdo->prepare("DELETE FROM teams WHERE match_date = ?")->execute([$date]);
        $pdo->prepare("DELETE FROM match_dates WHERE match_date = ?")->execute([$date]);
        $pdo->commit();
        jsonResponse(['success' => true]);
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonResponse(['success' => false, 'error' => $e->getMessage()]);
    }
}

// 11. UPLOAD PLAYER PHOTO - ACTION BARU
if ($action === 'uploadPlayerPhoto') {
    $playerName = $input['playerName'] ?? '';
    
    if (empty($playerName)) {
        jsonResponse(['success' => false, 'error' => 'Nama pemain tidak diberikan']);
    }
    
    try {
        // Cek apakah pemain ada
        $stmt = $pdo->prepare("SELECT id FROM players WHERE name = ?");
        $stmt->execute([$playerName]);
        $player = $stmt->fetch();
        
        if (!$player) {
            jsonResponse(['success' => false, 'error' => 'Pemain tidak ditemukan']);
        }
        
        // Cek apakah ada file yang diupload
        if (!isset($_FILES['photo']) || $_FILES['photo']['error'] !== UPLOAD_ERR_OK) {
            jsonResponse(['success' => false, 'error' => 'Tidak ada file yang diupload']);
        }
        
        $uploadDir = 'uploads/player_photos/';
        
        // Buat direktori jika belum ada
        if (!file_exists($uploadDir)) {
            mkdir($uploadDir, 0777, true);
        }
        
        // Generate nama file unik
        $fileExtension = pathinfo($_FILES['photo']['name'], PATHINFO_EXTENSION);
        $fileName = uniqid('player_', true) . '_' . preg_replace('/[^a-zA-Z0-9]/', '_', $playerName) . '.' . $fileExtension;
        $filePath = $uploadDir . $fileName;
        
        // Validasi tipe file
        $allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        $fileType = mime_content_type($_FILES['photo']['tmp_name']);
        
        if (!in_array($fileType, $allowedTypes)) {
            jsonResponse(['success' => false, 'error' => 'Hanya file gambar yang diizinkan (JPEG, PNG, GIF, WebP)']);
        }
        
        // Validasi ukuran file (max 2MB)
        if ($_FILES['photo']['size'] > 2 * 1024 * 1024) {
            jsonResponse(['success' => false, 'error' => 'Ukuran file maksimal 2MB']);
        }
        
        // Hapus foto lama jika ada
        $stmt = $pdo->prepare("SELECT photo FROM players WHERE name = ?");
        $stmt->execute([$playerName]);
        $oldPhoto = $stmt->fetchColumn();
        
        if ($oldPhoto && file_exists($uploadDir . $oldPhoto)) {
            unlink($uploadDir . $oldPhoto);
        }
        
        // Pindahkan file ke direktori upload
        if (move_uploaded_file($_FILES['photo']['tmp_name'], $filePath)) {
            // Update database dengan nama file foto
            $stmt = $pdo->prepare("UPDATE players SET photo = ? WHERE name = ?");
            $stmt->execute([$fileName, $playerName]);
            
            jsonResponse([
                'success' => true, 
                'message' => 'Foto berhasil diupload',
                'photo' => $fileName
            ]);
        } else {
            jsonResponse(['success' => false, 'error' => 'Gagal mengupload file']);
        }
        
    } catch (Exception $e) {
        jsonResponse(['success' => false, 'error' => $e->getMessage()]);
    }
}

// 11. DELETE PLAYER PHOTO - ACTION BARU
if ($action === 'deletePlayerPhoto') {
    $playerName = $input['playerName'] ?? '';
    
    if (empty($playerName)) {
        jsonResponse(['success' => false, 'error' => 'Nama pemain tidak diberikan']);
    }
    
    try {
        // Cek apakah pemain punya foto
        $stmt = $pdo->prepare("SELECT photo FROM players WHERE name = ?");
        $stmt->execute([$playerName]);
        $photo = $stmt->fetchColumn();
        
        if ($photo) {
            // Hapus file foto dari server
            $filePath = 'uploads/player_photos/' . $photo;
            if (file_exists($filePath)) {
                unlink($filePath);
            }
            
            // Update database
            $stmt = $pdo->prepare("UPDATE players SET photo = NULL WHERE name = ?");
            $stmt->execute([$playerName]);
            
            jsonResponse(['success' => true, 'message' => 'Foto berhasil dihapus']);
        } else {
            jsonResponse(['success' => false, 'error' => 'Pemain tidak memiliki foto']);
        }
        
    } catch (Exception $e) {
        jsonResponse(['success' => false, 'error' => $e->getMessage()]);
    }
}

// 12. RESET ALL DATA
if ($action === 'resetAllData') {
    try {
        $pdo->beginTransaction();
        
        // HAPUS SEMUA DATA KECUALI PLAYERS
        $pdo->exec("DELETE FROM team_players");
        $pdo->exec("DELETE FROM matches");
        $pdo->exec("DELETE FROM teams");
        $pdo->exec("DELETE FROM match_dates");
        $pdo->exec("DELETE FROM leaderboard");
        $pdo->exec("DELETE FROM cancel_players");
        
        $pdo->commit();
        jsonResponse(['success' => true]);
        
    } catch (Exception $e) {
        $pdo->rollBack();
        jsonResponse(['success' => false, 'error' => $e->getMessage()]);
    }
}

// DEFAULT ACTION
jsonResponse([
    'success' => false,
    'error' => 'Action tidak dikenali: ' . $action,
    'available_actions' => [
        'getPlayers', 'addPlayer', 'removePlayer', 'renamePlayer', 'getMatchDateData', 
        'saveMatchDateData', 'getAllData', 'getLeaderboard', 'updateLeaderboard',
        'getMatchDates', 'deleteMatchDate', 'uploadPlayerPhoto', 'deletePlayerPhoto', 'resetAllData'
    ]
]);

?>
