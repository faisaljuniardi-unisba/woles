// ==================== KONFIGURASI ====================
var API_URL = 'api.php';

// ==================== VARIABEL GLOBAL ====================
var players = [];
var currentMatchDate = '';
var matchData = null;
var leaderboard = [];
var periodType = '4_weeks';
var allMatchDates = [];
var selectedPlayerForPhoto = '';
var selectedPhotoFile = null;
var currentMatchDates = [];

// Warna tim
var selectedTeamCount = 4;
var teamColors = ['merah', 'kuning', 'hijau', 'biru', 'putih'];
var teamNames = {
    'merah': 'Tim Merah',
    'kuning': 'Tim Kuning',
    'hijau': 'Tim Hijau',
    'biru': 'Tim Biru',
    'putih': 'Tim Putih'
};

function getDefaultMatches(teamCount) {
    if (teamCount === 5) {
        return [
            { team1: 'merah', team2: 'biru' },
            { team1: 'kuning', team2: 'hijau' },
            { team1: 'merah', team2: 'putih' },
            { team1: 'kuning', team2: 'biru' },
            { team1: 'hijau', team2: 'putih' },
            { team1: 'merah', team2: 'kuning' },
            { team1: 'biru', team2: 'putih' },
            { team1: 'hijau', team2: 'biru' },
            { team1: 'merah', team2: 'hijau' },
            { team1: 'kuning', team2: 'putih' }
        ];
    }
    return [
        { team1: 'merah', team2: 'biru' },
        { team1: 'kuning', team2: 'hijau' },
        { team1: 'hijau', team2: 'merah' },
        { team1: 'biru', team2: 'kuning' },
        { team1: 'merah', team2: 'kuning' },
        { team1: 'hijau', team2: 'biru' }
    ];
}

function getActiveTeamColors(teamCount) {
    return teamCount === 5 ? ['merah', 'kuning', 'hijau', 'biru', 'putih'] : ['merah', 'kuning', 'hijau', 'biru'];
}

function getSelectedTeamCount() {
    return selectedTeamCount === 5 ? 5 : 4;
}

function setSelectedTeamCount(teamCount) {
    selectedTeamCount = teamCount === 5 ? 5 : 4;
    teamColors = getActiveTeamColors(selectedTeamCount);
    defaultMatches = getDefaultMatches(selectedTeamCount);
    updateTeamCountUI();
    if (matchData) {
        matchData.teamCount = selectedTeamCount;
        if (matchData.teams) {
            matchData.teams = getActiveTeamColors(selectedTeamCount).map(function(color) {
                var existing = (matchData.teams || []).find(function(team) { return team.color === color; });
                if (existing) {
                    existing.color = color;
                    if (!existing.slots || !Array.isArray(existing.slots) || existing.slots.length !== 8) {
                        existing.slots = new Array(8).fill(null);
                    }
                    return existing;
                }
                return { color: color, players: [], gk: null, slots: new Array(8).fill(null), wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
            });
        }
        matchData.matches = getDefaultMatches(selectedTeamCount).map(function(m) {
            var existingMatch = (matchData.matches || []).find(function(existing) {
                return existing.team1 === m.team1 && existing.team2 === m.team2;
            });
            return existingMatch ? {
                team1: existingMatch.team1,
                team2: existingMatch.team2,
                score1: existingMatch.score1,
                score2: existingMatch.score2,
                note: existingMatch.note || ''
            } : { team1: m.team1, team2: m.team2, score1: null, score2: null, note: '' };
        });
        renderMatchData();
    }
    return selectedTeamCount;
}

// Jadwal pertandingan default
var defaultMatches = getDefaultMatches(4);

// ==================== FUNGSI UTILITAS ====================
function showLoading() {
    document.getElementById('loading').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

function showError(message) {
    alert('Error: ' + message);
}

function updateTeamCountUI() {
    var radios = document.querySelectorAll('input[name="match-team-count"], input[name="shuffle-team-count"]');
    radios.forEach(function(radio) {
        if (radio.value === String(getSelectedTeamCount())) {
            radio.checked = true;
        }
    });

    var teamTitle = document.getElementById('match-team-title');
    if (teamTitle) {
        teamTitle.textContent = '👥 Susunan ' + getSelectedTeamCount() + ' Tim';
    }

    var shuffleSummary = document.getElementById('shuffle-team-summary');
    if (shuffleSummary) {
        var composition = getSelectedTeamCount() === 5 ? { gk: 1, def: 2, mid: 2, fwd: 2 } : { gk: 1, def: 2, mid: 3, fwd: 2 };
        shuffleSummary.textContent = '🏆 Pembagian ' + getSelectedTeamCount() + ' Tim (' + composition.gk + ' GK, ' + composition.def + ' Bek, ' + composition.mid + ' Tengah, ' + composition.fwd + ' Depan)';
    }

    var finalDesc = document.getElementById('final-shuffle-description');
    if (finalDesc) {
        finalDesc.textContent = 'Pilih ' + getSelectedTeamCount() + ' pemain puncak dan tetapkan satu pemain untuk setiap tim. Sisanya akan dikocok seperti biasa.';
    }
}

// ==================== FUNGSI TAB ====================
function switchTab(tabName) {
    var targetContent = document.getElementById(tabName);
    if (!targetContent) return;

    document.querySelectorAll('.tab-content').forEach(function(tab) {
        tab.classList.remove('active');
    });
    
    targetContent.classList.add('active');
    
    document.querySelectorAll('.tab').forEach(function(tab) {
        tab.classList.remove('active');
    });
    
    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) {
        if (tabs[i].dataset.tab === tabName) {
            tabs[i].classList.add('active');
            break;
        }
    }

    // Setiap menu memiliki alamatnya sendiri dan tetap aktif setelah refresh.
    localStorage.setItem('woles_active_tab', tabName);
    if (window.location.hash !== '#' + tabName) {
        history.replaceState(null, '', '#' + tabName);
    }
    
    if (tabName === 'dashboard') {
        updateLeaderboard();
    } else if (tabName === 'players') {
        loadPlayers();
    } else if (tabName === 'match') {
        updateTeamCountUI();
        var today = new Date().toISOString().split('T')[0];
        var dateInput = document.getElementById('match-date');
        if (!dateInput.value) dateInput.value = today;
        currentMatchDate = dateInput.value;
        
        // Inisialisasi kalender dengan penanda
        if (typeof initMatchDatePicker === 'function') {
            initMatchDatePicker();
        }
        if (typeof restoreLastMatchView === 'function') {
            restoreLastMatchView();
        }
        
    } else if (tabName === 'history') {
        if (typeof loadHistory === 'function') loadHistory();
    } else if (tabName === 'shuffle') {
        updateTeamCountUI();
        var today = new Date().toISOString().split('T')[0];
        document.getElementById('shuffle-date').value = today;
    }
}

// ==================== FUNGSI API ====================
function callAPI(action, data) {
    data = data || {};
    var LOCAL_KEY = 'woles_local_store_v1';

    function loadLocal() {
        var s = localStorage.getItem(LOCAL_KEY);
        if (!s) {
            var initial = {
                players: [],
                matches: []
            };
            localStorage.setItem(LOCAL_KEY, JSON.stringify(initial));
            return initial;
        }
        try { 
            return JSON.parse(s); 
        } catch(e) { 
            return { players: [], matches: [] }; 
        }
    }

    function saveLocal(store) {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(store));
    }

    function localFallback(action, data) {
        var store = loadLocal();

        switch (action) {
            case 'getPlayers':
                return { success: true, players: store.players.slice() };

            case 'addPlayer': {
                var name = data.playerName || data.name || ('Player ' + Date.now());
                if (!store.players.includes(name)) store.players.push(name);
                saveLocal(store);
                return { success: true };
            }

            case 'removePlayer': {
                var name = data.playerName || data.name;
                store.players = store.players.filter(function(p) { return p !== name; });
                store.matches.forEach(function(m) {
                    m.teams.forEach(function(t) {
                        t.players = t.players.filter(function(p) { return p !== name; });
                        if (t.gk === name) t.gk = null;
                    });
                    m.cancelOnDay = (m.cancelOnDay || []).filter(function(p) { return p !== name; });
                });
                saveLocal(store);
                return { success: true };
            }

            case 'renamePlayer': {
                var oldName = data.oldName;
                var newName = data.newName;
                if (!oldName || !newName) return { success: false, error: 'Nama pemain tidak boleh kosong' };
                if (store.players.some(function(p) { return (typeof p === 'string' ? p : p.name) === newName; })) return { success: false, error: 'Nama pemain sudah digunakan' };
                store.players = store.players.map(function(p) {
                    if (typeof p === 'string') return p === oldName ? newName : p;
                    if (p && p.name === oldName) p.name = newName;
                    return p;
                });
                store.matches.forEach(function(m) {
                    (m.teams || []).forEach(function(t) {
                        t.players = (t.players || []).map(function(p) { return p === oldName ? newName : p; });
                        t.slots = (t.slots || []).map(function(p) { return p === oldName ? newName : p; });
                        if (t.gk === oldName) t.gk = newName;
                    });
                    m.cancelOnDay = (m.cancelOnDay || []).map(function(p) { return p === oldName ? newName : p; });
                });
                saveLocal(store);
                return { success: true };
            }

            case 'getMatchDates': {
                var dates = Array.from(new Set(store.matches.map(function(m) { return m.date; }))).sort().reverse();
                return { success: true, dates: dates };
            }

            case 'getMatchDateData': {
                var date = data.date || data.matchDate;
                var match = store.matches.find(function(m) { return m.date === date; });
                if (!match) {
                    match = {
                        date: date || new Date().toISOString().split('T')[0],
                        teamCount: getSelectedTeamCount(),
                        teams: getActiveTeamColors(getSelectedTeamCount()).map(function(color) { 
                            return { 
                                color: color, 
                                players: [], 
                                gk: null, 
                                slots: new Array(8).fill(null),
                                wins: 0, 
                                draws: 0, 
                                losses: 0, 
                                goalsFor: 0, 
                                goalsAgainst: 0 
                            };
                        }),
                        matches: getDefaultMatches(getSelectedTeamCount()).map(function(m) { 
                            return { 
                                team1: m.team1, 
                                team2: m.team2, 
                                score1: null, 
                                score2: null, 
                                note: '' 
                            };
                        }),
                        cancelOnDay: []
                    };
                }
                (match.teams || []).forEach(function(t) {
                    if (!t.slots || !Array.isArray(t.slots) || t.slots.length !== 8) {
                        t.slots = new Array(8).fill(null);
                        if (t.gk) t.slots[0] = t.gk;
                        var tmp = (t.players || []).slice();
                        for (var si = 1; si < 8; si++) {
                            t.slots[si] = tmp.length > 0 ? tmp.shift() : null;
                        }
                    }
                });

                return { success: true, date: match.date, teamCount: match.teamCount || getSelectedTeamCount(), teams: match.teams, matches: match.matches, cancelOnDay: match.cancelOnDay };
            }

            case 'deleteMatchDate': {
                var date = data.date;
                if (!date) {
                    return { success: false, error: 'Tanggal pertandingan tidak diberikan' };
                }
                store.matches = store.matches.filter(function(m) { return m.date !== date; });
                saveLocal(store);
                return { success: true };
            }

            case 'saveMatchDateData': {
                var date = data.date;
                var weekData = typeof data.weekData === 'string' ? JSON.parse(data.weekData) : data.weekData;
                var idx = store.matches.findIndex(function(m) { return m.date === date; });
                var teamsToSave = (weekData && weekData.teams) ? weekData.teams.map(function(t) {
                    var base = {
                        color: t.color,
                        wins: t.wins || 0,
                        draws: t.draws || 0,
                        losses: t.losses || 0,
                        goalsFor: t.goalsFor || 0,
                        goalsAgainst: t.goalsAgainst || 0
                    };
                    if (t.slots && Array.isArray(t.slots) && t.slots.length === 8) {
                        base.slots = t.slots.slice(0,8);
                        base.gk = base.slots[0] || null;
                        base.players = base.slots.slice(1).filter(function(x){ return x; });
                    } else {
                        base.gk = t.gk || null;
                        base.players = t.players || [];
                        base.slots = new Array(8).fill(null);
                        if (base.gk) base.slots[0] = base.gk;
                        var tmp2 = base.players.slice();
                        for (var sii = 1; sii < 8; sii++) {
                            base.slots[sii] = tmp2.length > 0 ? tmp2.shift() : null;
                        }
                    }
                    return base;
                }) : teamColors.map(function(color) { 
                    return { 
                        color: color, 
                        players: [], 
                        gk: null, 
                        slots: new Array(8).fill(null),
                        wins: 0, 
                        draws: 0, 
                        losses: 0, 
                        goalsFor: 0, 
                        goalsAgainst: 0 
                    };
                });

                var toSave = {
                    date: date,
                    teamCount: getSelectedTeamCount(),
                    teams: teamsToSave,
                    matches: weekData.matches || getDefaultMatches(getSelectedTeamCount()).map(function(m) { 
                        return { 
                            team1: m.team1, 
                            team2: m.team2, 
                            score1: null, 
                            score2: null, 
                            note: '' 
                        };
                    }),
                    cancelOnDay: weekData.cancelOnDay || []
                };
                if (idx === -1) store.matches.push(toSave);
                else store.matches[idx] = toSave;
                saveLocal(store);
                return { success: true };
            }

            case 'updateLeaderboard':
                return { success: true };

            default:
                return { success: false, error: 'Action not supported in local fallback: ' + action };
        }
    }

    try {
        var params = new URLSearchParams(data);
        var fullUrl = API_URL + '?action=' + encodeURIComponent(action) + (params.toString() ? '&' + params.toString() : '');
        
        var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        var timeoutId = window.setTimeout(function() {
            if (controller) controller.abort();
        }, 10000);

        return fetch(fullUrl, { method: 'GET', signal: controller ? controller.signal : undefined })
            .then(function(resp) { return resp.text(); })
            .then(function(text) {
                var trimmed = text.trim();
                if (!trimmed || trimmed[0] === '<' || trimmed.startsWith('<?')) {
                    console.warn('API returned non-JSON, using local fallback for', action);
                    return localFallback(action, data);
                }

                try {
                    var result = JSON.parse(trimmed);
                    if (result && typeof result === 'object' && ('success' in result)) {
                        return result;
                    }
                    return { success: true, data: result };
                } catch (parseErr) {
                    console.warn('Failed to parse API JSON, using local fallback for', action);
                    return localFallback(action, data);
                }
            })
            .catch(function(fetchErr) {
                console.warn('Fetch failed or timed out, using local fallback for', action, fetchErr);
                return localFallback(action, data);
            })
            .finally(function() {
                window.clearTimeout(timeoutId);
            });
    } catch (e) {
        return Promise.resolve(localFallback(action, data));
    }
}
