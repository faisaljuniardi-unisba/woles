// ==================== MANAJEMEN PERTANDINGAN ====================

var matchAutoSaveTimer = null;

function queueMatchAutoSave() {
    if (matchAutoSaveTimer) window.clearTimeout(matchAutoSaveTimer);
    matchAutoSaveTimer = window.setTimeout(function() {
        matchAutoSaveTimer = null;
        saveMatchData({ silent: true });
    }, 500);
}

// Fungsi untuk mendapatkan daftar semua pemain yang sudah terdaftar di tim mana pun
function getAllAssignedPlayers(matchData) {
    var assigned = [];
    if (!matchData || !matchData.teams) return assigned;
    
    matchData.teams.forEach(function(team) {
        if (team.slots && Array.isArray(team.slots)) {
            team.slots.forEach(function(p) {
                if (p && !assigned.includes(p)) assigned.push(p);
            });
        } else {
            if (team.players) {
                team.players.forEach(function(p) {
                    if (!assigned.includes(p)) assigned.push(p);
                });
            }
            if (team.gk && !assigned.includes(team.gk)) assigned.push(team.gk);
        }
    });
    
    return assigned;
}

function ensureTeamSlots(team) {
    if (!team) return;
    if (!team.slots || !Array.isArray(team.slots) || team.slots.length !== 8) {
        team.slots = new Array(8).fill(null);
        if (team.gk) team.slots[0] = team.gk;
        var tmp = (team.players || []).slice();
        for (var si = 1; si < 8; si++) {
            team.slots[si] = tmp.length > 0 ? tmp.shift() : null;
        }
    }
}

function getDefaultMatchesForTeamCount(teamCount) {
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

// ==================== FITUR KALENDER DENGAN PENANDA ====================
var allMatchDatesList = [];
var matchDatePicker = null;
var restoringLastMatch = false;

function formatCalendarDate(date) {
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
}

function markMatchCalendarDay(dayElement) {
    if (!dayElement || !dayElement.dateObj) return;
    var dateValue = formatCalendarDate(dayElement.dateObj);
    if (allMatchDatesList.includes(dateValue)) {
        dayElement.classList.add('has-match-date');
        dayElement.title = 'Ada pertandingan pada tanggal ini';
    }
}

// Fungsi untuk mendapatkan semua tanggal yang ada pertandingan
async function loadMatchDatesList() {
    try {
        const result = await callAPI('getMatchDates');
        if (result.success) {
            allMatchDatesList = result.dates || [];
            updateMatchDateIndicator();
            if (matchDatePicker) matchDatePicker.redraw();
            return allMatchDatesList;
        }
        return [];
    } catch (error) {
        console.error('Error loading match dates:', error);
        return [];
    }
}

// Fungsi untuk update indikator pada date input
function updateMatchDateIndicator() {
    const dateInput = document.getElementById('match-date');
    const legend = document.getElementById('match-date-legend');
    
    if (!dateInput) return;
    
    const selectedDate = dateInput.value;
    
    if (selectedDate && allMatchDatesList.includes(selectedDate)) {
        // Ada pertandingan pada tanggal ini
        dateInput.classList.add('has-match');
        dateInput.style.borderColor = '#e74c3c';
        dateInput.style.backgroundColor = '#fff5f5';
        if (legend) legend.style.display = 'block';
    } else {
        dateInput.classList.remove('has-match');
        dateInput.style.borderColor = '';
        dateInput.style.backgroundColor = '';
        if (legend) legend.style.display = 'block';
    }
}

// Fungsi yang dipanggil saat tanggal berubah
async function onMatchDateChange() {
    if (allMatchDatesList.length === 0) {
        await loadMatchDatesList();
    }
    updateMatchDateIndicator();
    var selectedDate = document.getElementById('match-date').value;
    if (selectedDate !== currentMatchDate) {
        document.getElementById('match-content').style.display = 'none';
    }
}

// Inisialisasi date picker
function initMatchDatePicker() {
    const dateInput = document.getElementById('match-date');
    if (!dateInput) return;

    if (!dateInput.dataset.matchCalendarInitialized) {
        dateInput.dataset.matchCalendarInitialized = '1';
        dateInput.addEventListener('focus', loadMatchDatesList);

        if (typeof flatpickr === 'function') {
            matchDatePicker = flatpickr(dateInput, {
                dateFormat: 'Y-m-d',
                allowInput: true,
                disableMobile: true,
                onChange: function() { onMatchDateChange(); },
                onOpen: function() { loadMatchDatesList(); },
                onDayCreate: function(dObj, dStr, fp, dayElem) {
                    markMatchCalendarDay(dayElem);
                }
            });
        }
    }

    loadMatchDatesList();
    
    setTimeout(function() {
        updateMatchDateIndicator();
    }, 100);
}

async function restoreLastMatchView() {
    if (restoringLastMatch || matchData) return;
    var savedDate = localStorage.getItem('woles_last_match_date');
    if (!savedDate) return;

    restoringLastMatch = true;
    await loadMatchDatesList();
    if (allMatchDatesList.includes(savedDate)) {
        var dateInput = document.getElementById('match-date');
        dateInput.value = savedDate;
        if (matchDatePicker) matchDatePicker.setDate(savedDate, false);
        await loadMatchData(true);
    } else {
        localStorage.removeItem('woles_last_match_date');
    }
    restoringLastMatch = false;
}

async function loadMatchData(isRestore) {
    const dateInput = document.getElementById('match-date');
    const date = dateInput.value;
    
    if (!date) {
        alert('Pilih tanggal terlebih dahulu!');
        return;
    }
    
    await loadMatchDatesList();
    if (!allMatchDatesList.includes(date)) {
        matchData = null;
        document.getElementById('match-content').style.display = 'none';
        if (!isRestore) alert('Tidak ada data pertandingan pada tanggal tersebut. Pertandingan baru hanya dapat dibuat melalui menu Kocok Tim.');
        return;
    }

    currentMatchDate = date;
    showLoading();
    const result = await callAPI('getMatchDateData', { date });
    hideLoading();
    
    if (result.success) {
        matchData = result;
        selectedTeamCount = (result.teamCount && result.teamCount === 5) ? 5 : 4;
        teamColors = getActiveTeamColors(selectedTeamCount);
        defaultMatches = getDefaultMatchesForTeamCount(selectedTeamCount);
        
        // CEK APAKAH ADA DATA PEMAIN ATAU MATCHES
        var hasData = false;
        if (matchData.teams && matchData.teams.length > 0) {
            matchData.teams.forEach(function(team) {
                if (team.players && team.players.length > 0) hasData = true;
                if (team.gk) hasData = true;
                if (team.slots && team.slots.some(function(s) { return s && s.toString().trim(); })) hasData = true;
            });
        }
        if (matchData.matches && matchData.matches.length > 0) {
            hasData = true;
        }
        
        // JIKA TIDAK ADA DATA, TAMPILKAN KOSONG TANPA MEMBUAT BARU
        if (!hasData) {
            matchData = null;
            document.getElementById('match-content').style.display = 'none';
            document.getElementById('match-schedule').innerHTML = '';
            document.getElementById('standings-body').innerHTML = '';
            document.getElementById('teams-container').innerHTML = '';
            document.getElementById('available-cancel-players').innerHTML = '';
            document.getElementById('canceled-players').innerHTML = '';
            
            // Update indikator
            await loadMatchDatesList();
            updateMatchDateIndicator();
            return;
        }

        localStorage.setItem('woles_last_match_date', date);
        
        // PASTIKAN TEAMS SESUAI (hanya jika ada data)
        var activeColors = getActiveTeamColors(selectedTeamCount);
        matchData.teams = activeColors.map(function(color) {
            var existing = (matchData.teams || []).find(function(team) { return team.color === color; });
            if (existing) {
                existing.color = color;
                return existing;
            }
            return { color: color, players: [], gk: null, slots: new Array(8).fill(null), wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, champion: false };
        });
        
        // Pastikan matches sesuai dengan jumlah tim
        var defaultMatchesList = getDefaultMatchesForTeamCount(selectedTeamCount);
        if (!matchData.matches || matchData.matches.length === 0) {
            matchData.matches = defaultMatchesList.map(function(m) {
                return {
                    team1: m.team1,
                    team2: m.team2,
                    score1: null,
                    score2: null,
                    note: ''
                };
            });
        } else {
            var existingMatches = matchData.matches.slice();
            matchData.matches = defaultMatchesList.map(function(m) {
                var existing = existingMatches.find(function(ex) {
                    return ex.team1 === m.team1 && ex.team2 === m.team2;
                });
                if (existing) {
                    return {
                        team1: existing.team1 || m.team1,
                        team2: existing.team2 || m.team2,
                        score1: existing.score1 !== undefined ? existing.score1 : null,
                        score2: existing.score2 !== undefined ? existing.score2 : null,
                        note: existing.note || ''
                    };
                }
                return {
                    team1: m.team1,
                    team2: m.team2,
                    score1: null,
                    score2: null,
                    note: ''
                };
            });
        }
        
        matchData.teams.forEach(function(team) {
            ensureTeamSlots(team);
            team.wins = 0;
            team.draws = 0;
            team.losses = 0;
            team.goalsFor = 0;
            team.goalsAgainst = 0;
        });
        
        updateTeamResults();
        updateTeamCountUI();
        renderMatchData();
        document.getElementById('match-content').style.display = 'block';
        
        // Update indikator
        await loadMatchDatesList();
        updateMatchDateIndicator();
    }
}

function renderMatchData() {
    if (!matchData) return;
    
    // CEK APAKAH ADA DATA SEBELUM RENDER
    var hasData = false;
    if (matchData.teams) {
        matchData.teams.forEach(function(team) {
            if (team.players && team.players.length > 0) hasData = true;
            if (team.gk) hasData = true;
            if (team.slots && team.slots.some(function(s) { return s && s.toString().trim(); })) hasData = true;
        });
    }
    if (matchData.matches && matchData.matches.length > 0) {
        hasData = true;
    }
    
    if (!hasData) {
        document.getElementById('match-date-display').textContent = 'Tidak ada pertandingan pada tanggal ini';
        document.getElementById('match-schedule').innerHTML = '';
        document.getElementById('standings-body').innerHTML = '';
        document.getElementById('teams-container').innerHTML = '';
        document.getElementById('available-cancel-players').innerHTML = '';
        document.getElementById('canceled-players').innerHTML = '';
        return;
    }
    
    var dateDisplay = document.getElementById('match-date-display');
    var date = new Date(matchData.date);
    dateDisplay.textContent = 'Pertandingan: ' + date.toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    matchData.teams.forEach(function(team) {
        ensureTeamSlots(team);
    });
    renderMatches(matchData.matches);
    renderStandings(matchData.teams);
    renderTeams(matchData.teams, matchData.cancelOnDay);
    renderCancelPlayers(matchData.cancelOnDay);
}

function renderMatches(matches) {
    const container = document.getElementById('match-schedule');
    if (!container) return;
    
    container.innerHTML = '';
    
    matches.forEach((match, index) => {
        const matchCard = document.createElement('div');
        matchCard.className = 'match-card match-' + match.team1;
        
        matchCard.innerHTML = `
            <div class="match-teams">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 12px; height: 12px; border-radius: 50%; background-color: var(--${match.team1});"></div>
                    <span style="font-weight: bold;">${teamNames[match.team1]}</span>
                </div>
                <div class="score-input">
                    <input type="text" 
                           value="${match.score1 !== null ? match.score1 : ''}" 
                           placeholder="-"
                           onchange="updateMatchScore(${index}, 'score1', this.value)"
                           onblur="validateScore(this)">
                </div>
            </div>
            <div class="match-teams">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 12px; height: 12px; border-radius: 50%; background-color: var(--${match.team2});"></div>
                    <span style="font-weight: bold;">${teamNames[match.team2]}</span>
                </div>
                <div class="score-input">
                    <input type="text" 
                           value="${match.score2 !== null ? match.score2 : ''}" 
                           placeholder="-"
                           onchange="updateMatchScore(${index}, 'score2', this.value)"
                           onblur="validateScore(this)">
                </div>
            </div>
        `;
        
        container.appendChild(matchCard);
    });
}

function renderStandings(teams) {
    const tbody = document.getElementById('standings-body');
    if (!tbody) return;
    
    const standings = calculateStandings(teams);
    
    tbody.innerHTML = standings.map(team => `
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 12px; text-align: left; border-left: 4px solid var(--${team.color});">
                <strong>${teamNames[team.color]}</strong>
            </td>
            <td style="padding: 12px; text-align: center;">${team.played}</td>
            <td style="padding: 12px; text-align: center;">${team.wins}</td>
            <td style="padding: 12px; text-align: center;">${team.draws}</td>
            <td style="padding: 12px; text-align: center;">${team.losses}</td>
            <td style="padding: 12px; text-align: center;">${team.goalsFor}</td>
            <td style="padding: 12px; text-align: center;">${team.goalsAgainst}</td>
            <td style="padding: 12px; text-align: center;">${team.goalDifference}</td>
            <td style="padding: 12px; text-align: center; font-weight: bold;">${team.points}</td>
        </tr>
    `).join('');
}

function calculateStandings(teams) {
    const standings = teams.map(team => ({
        color: team.color,
        played: team.wins + team.draws + team.losses,
        wins: team.wins,
        draws: team.draws,
        losses: team.losses,
        goalsFor: team.goalsFor,
        goalsAgainst: team.goalsAgainst,
        goalDifference: team.goalsFor - team.goalsAgainst,
        points: (team.wins * 3) + team.draws
    }));
    
    standings.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
        return b.goalsFor - a.goalsFor;
    });
    
    return standings;
}

function renderTeams(teams, cancelPlayers) {
    var container = document.getElementById('teams-container');
    if (!container) return;
    
    var activeTeams = Array.isArray(teams) ? teams : [];
    var scoreOnlyGuest = typeof isAuthenticated === 'function' && !isAuthenticated();
    if (activeTeams.length < getSelectedTeamCount()) {
        activeTeams = getActiveTeamColors(getSelectedTeamCount()).map(function(color) {
            return activeTeams.find(function(team) { return team.color === color; }) || { color: color, slots: new Array(8).fill(null), players: [], gk: null, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
        });
    }
    
    container.innerHTML = '';
    
    // Dapatkan semua pemain yang sudah terdaftar di tim mana pun
    var assignedPlayers = getAllAssignedPlayers(matchData);
    
    activeTeams.forEach(function(team) {
        var teamSection = document.createElement('div');
        teamSection.className = 'team-section team-' + team.color;
        
        ensureTeamSlots(team);

        var teamCount = getSelectedTeamCount();
        var slotCount = teamCount === 5 ? 7 : 8;
        var slots = (team.slots || []).slice(0, slotCount);
        var totalPlayers = slots.filter(function(s){ return s && s.toString().trim(); }).length;
        
        var positionLabels = teamCount === 5
            ? ['Kiper', 'Bek', 'Bek', 'Tengah', 'Tengah', 'Depan', 'Depan']
            : ['Kiper', 'Bek', 'Bek', 'Tengah', 'Tengah', 'Tengah', 'Depan', 'Depan'];
        
        teamSection.innerHTML = `
            <div class="team-header">
                <div class="team-title">${teamNames[team.color]}</div>
                <div style="color: #666; font-size: 0.9rem; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                    <div>${totalPlayers} pemain ${team.gk ? '| 🧤 GK: ' + team.gk : ''}</div>
                    <div>
                        <button class="btn btn-small" onclick="exportSingleTeam('${team.color}')" style="background: linear-gradient(135deg, #3498db, #2980b9); font-size: 0.7rem; padding: 4px 10px; color:white; border:none; border-radius:4px; cursor:pointer;">
                            📥 Export Tim
                        </button>
                    </div>
                    <div>
                        ${team.champion ? '<span class="champion-badge">🏆 Juara</span>' : ''}
                    </div>
                    <div>
                        <button class="btn btn-small team-admin-action" onclick="toggleChampion('${team.color}')" style="background: linear-gradient(135deg, #f1c40f, #f39c12); font-size: 0.7rem; padding: 4px 10px; color:white; border:none; border-radius:4px; cursor:pointer;">
                            ${team.champion ? 'Batal Juara' : 'Set Juara'}
                        </button>
                    </div>
                </div>
            </div>
            
            <h4 style="margin: 20px 0 10px 0; color: #2c3e50;">Pemain dalam Tim (${slotCount} slot):</h4>
            <div class="team-slots" id="players-${team.color}" style="display: flex; flex-direction: column; gap:8px;">
                ${slots.map(function(slotPlayer, slotIdx){
                    var label = positionLabels[slotIdx] || 'Slot ' + (slotIdx + 1);
                    var val = slotPlayer ? slotPlayer : '';
                    var isGK = slotIdx === 0;
                    return `
                        <div class="team-slot ${val ? '' : 'empty-slot'}" style="background: white; padding:8px; border-radius:8px; display:flex; flex-direction:column; gap:6px;">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <strong>${label}</strong>
                                ${isGK ? '<span class="gk-badge">GK</span>' : ''}
                            </div>
                            <input id="slot-input-${team.color}-${slotIdx}" type="text" value="${val.replace(/'/g, "\\'")}" placeholder="Kosong" ${scoreOnlyGuest ? 'readonly aria-readonly="true"' : ''} style="padding:8px; border:1px solid #ddd; border-radius:6px;" 
                                   oninput="filterSlotSearch('${team.color}', ${slotIdx}, this.value)" 
                                   onchange="updateTeamSlot('${team.color}', ${slotIdx}, this.value)"
                                   onblur="hideSlotSearch('${team.color}', ${slotIdx})"
                                   autocomplete="off">
                            <div id="slot-search-${team.color}-${slotIdx}" class="slot-search-results" style="display:none; position: relative; z-index:50; background: white; border: 1px solid #eee; border-radius:6px; max-height: 180px; overflow:auto;"></div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        
        container.appendChild(teamSection);
    });
}

// Set/update a specific slot for a team
function updateTeamSlot(teamColor, slotIdx, value) {
    if (typeof isAuthenticated === 'function' && !isAuthenticated()) return;
    if (!matchData) return;
    var team = matchData.teams.find(function(t){ return t.color === teamColor; });
    if (!team) return;
    if (!team.slots || !Array.isArray(team.slots) || team.slots.length !== 8) return;

    var original = team.slots[slotIdx];
    value = value ? value.trim() : '';

    var allAssigned = getAllAssignedPlayers(matchData) || [];
    var assignedOutside = allAssigned.filter(function(p) {
        if (team.slots && team.slots.indexOf(p) !== -1) return false;
        return true;
    });

    if (value === '') {
        team.slots[slotIdx] = null;
    } else {
        if (assignedOutside.includes(value)) {
            alert('Pemain tersebut sudah terdaftar di tim lain!');
            team.slots[slotIdx] = original;
            renderTeams(matchData.teams, matchData.cancelOnDay);
            return;
        }
        team.slots[slotIdx] = value;
        team.slots.forEach(function(s, i) {
            if (i !== slotIdx && team.slots[i] === value) {
                team.slots[i] = null;
            }
        });
    }

    team.gk = team.slots[0] ? team.slots[0] : null;
    team.players = team.slots.slice(1).filter(function(s){ return s && s.toString().trim(); });

    renderTeams(matchData.teams, matchData.cancelOnDay);
    queueMatchAutoSave();
}

function renderCancelPlayers(cancelPlayers) {
    var assignedPlayers = getAllAssignedPlayers(matchData);
    
    var availablePlayers = players.filter(function(player) {
        return !assignedPlayers.includes(player.name) && !cancelPlayers.includes(player.name);
    });
    
    var availableContainer = document.getElementById('available-cancel-players');
    if (availableContainer) {
        availableContainer.innerHTML = availablePlayers.map(function(player) {
            return `
                <div class="player-item">
                    <span>${player.name}</span>
                    <button class="btn btn-small btn-danger" onclick="addCancelPlayer('${player.name}')">+ Cancel</button>
                </div>
            `;
        }).join('');
    }
    
    var cancelContainer = document.getElementById('canceled-players');
    if (cancelContainer) {
        cancelContainer.innerHTML = cancelPlayers.length > 0 ? cancelPlayers.map(function(playerName) {
            var inTeam = matchData && matchData.teams.some(function(team) {
                return team.players.includes(playerName) || team.gk === playerName;
            });
            return `
                <div class="team-player-item">
                    <span>${playerName} <small style="color: #e74c3c;">(-5 poin)</small></span>
                    <div>
                        ${inTeam ? '<span style="color: #e74c3c; font-size: 0.9rem; margin-right: 10px;">(Sudah di tim)</span>' : ''}
                        <span class="remove-player" onclick="removeCancelPlayer('${playerName}')">✕</span>
                    </div>
                </div>
            `;
        }).join('') : '<p style="text-align: center; color: #999; padding: 20px;">Belum ada pemain yang cancel</p>';
    }
}

function filterCancelPlayers(searchTerm) {
    if (!matchData) return;
    
    var assignedPlayers = getAllAssignedPlayers(matchData);
    var availablePlayers = players.filter(function(player) {
        return !assignedPlayers.includes(player.name) && !matchData.cancelOnDay.includes(player.name);
    });
    
    var filtered = availablePlayers.filter(function(player) {
        return player.name.toLowerCase().includes(searchTerm.toLowerCase());
    });
    
    var container = document.getElementById('available-cancel-players');
    if (container) {
        container.innerHTML = filtered.map(function(player) {
            return `
                <div class="player-item">
                    <span>${player.name}</span>
                    <button class="btn btn-small btn-danger" onclick="addCancelPlayer('${player.name}')">+ Cancel</button>
                </div>
            `;
        }).join('');
    }
}

async function toggleChampion(teamColor) {
    if (!matchData) return;

    matchData.teams.forEach(function(t) {
        if (t.color === teamColor) {
            t.champion = !t.champion;
        } else {
            t.champion = false;
        }
    });

    renderTeams(matchData.teams, matchData.cancelOnDay);
    await saveMatchData({ silent: true });
}

function addCancelPlayer(playerName) {
    if (typeof isAuthenticated === 'function' && !isAuthenticated()) return;
    if (!matchData) return;
    
    var assignedPlayers = getAllAssignedPlayers(matchData);
    if (assignedPlayers.includes(playerName)) {
        alert('Pemain sudah terdaftar di tim! Tidak bisa di-cancel.');
        return;
    }
    
    if (!matchData.cancelOnDay.includes(playerName)) {
        matchData.cancelOnDay.push(playerName);
        renderCancelPlayers(matchData.cancelOnDay);
        renderTeams(matchData.teams, matchData.cancelOnDay);
        queueMatchAutoSave();
    }
}

function removeCancelPlayer(playerName) {
    if (typeof isAuthenticated === 'function' && !isAuthenticated()) return;
    if (!matchData) return;
    
    matchData.cancelOnDay = matchData.cancelOnDay.filter(function(p) { return p !== playerName; });
    renderCancelPlayers(matchData.cancelOnDay);
    renderTeams(matchData.teams, matchData.cancelOnDay);
    queueMatchAutoSave();
}

function updateMatchScore(matchIndex, scoreType, value) {
    if (!matchData) return;
    
    var score = null;
    if (value !== '' && value !== null && value !== undefined) {
        var numValue = parseInt(value);
        if (!isNaN(numValue)) {
            score = numValue;
        }
    }
    
    matchData.matches[matchIndex][scoreType] = score;
    updateTeamResults();
    renderStandings(matchData.teams);
    queueMatchAutoSave();
}

function validateScore(input) {
    if (input.value === '' || input.value === '-') {
        input.value = '';
    } else if (!/^\d+$/.test(input.value)) {
        input.value = '';
        alert('Masukkan angka yang valid!');
    }
}

function updateTeamResults() {
    if (!matchData) return;
    
    matchData.teams.forEach(function(team) {
        team.wins = 0;
        team.draws = 0;
        team.losses = 0;
        team.goalsFor = 0;
        team.goalsAgainst = 0;
    });
    
    matchData.matches.forEach(function(match) {
        var score1 = parseInt(match.score1);
        var score2 = parseInt(match.score2);
        
        if (!isNaN(score1) && !isNaN(score2)) {
            var team1 = matchData.teams.find(function(t) { return t.color === match.team1; });
            var team2 = matchData.teams.find(function(t) { return t.color === match.team2; });
            
            if (team1 && team2) {
                team1.goalsFor += score1;
                team1.goalsAgainst += score2;
                team2.goalsFor += score2;
                team2.goalsAgainst += score1;
                
                if (score1 > score2) {
                    team1.wins++;
                    team2.losses++;
                } else if (score1 < score2) {
                    team1.losses++;
                    team2.wins++;
                } else {
                    team1.draws++;
                    team2.draws++;
                }
            }
        }
    });
}

async function saveMatchData(options) {
    options = options || {};
    if (!matchData) {
        alert('Tidak ada data pertandingan untuk disimpan!');
        return;
    }
    
    var allPlayersInTeams = [];
    var duplicates = [];
    
    matchData.teams.forEach(function(team) {
        var players = [];
        if (team.slots && Array.isArray(team.slots)) {
            team.slots.forEach(function(s) { if (s && s.toString().trim()) players.push(s); });
        } else {
            players = team.players.slice();
            if (team.gk && !players.includes(team.gk)) players.push(team.gk);
        }
        players.forEach(function(playerName) {
            if (allPlayersInTeams.includes(playerName)) {
                if (!duplicates.includes(playerName)) {
                    duplicates.push(playerName);
                }
            } else {
                allPlayersInTeams.push(playerName);
            }
        });
        if (typeof team.champion === 'undefined') team.champion = false;
    });
    
    if (duplicates.length > 0) {
        alert('Error: Pemain berikut terdaftar di lebih dari satu tim:\n' + duplicates.join('\n') + 
              '\n\nHapus pemain dari tim lain terlebih dahulu.');
        return;
    }
    
    var teamsWithoutGK = matchData.teams.filter(function(team) {
        var hasPlayers = false;
        if (team.slots && Array.isArray(team.slots)) {
            hasPlayers = team.slots.slice(1).some(function(s){ return s && s.toString().trim(); });
        } else {
            hasPlayers = (team.players && team.players.length > 0);
        }
        return hasPlayers && !team.gk;
    });
    
    if (teamsWithoutGK.length > 0) {
        var teamNamesList = teamsWithoutGK.map(function(t) { return teamNames[t.color]; }).join(', ');
        if (!confirm('Peringatan: Tim ' + teamNamesList + ' tidak memiliki GK. Lanjutkan penyimpanan?')) {
            return;
        }
    }
    
    var conflictPlayers = [];
    matchData.cancelOnDay.forEach(function(cancelPlayer) {
        matchData.teams.forEach(function(team) {
            var found = false;
            if (team.slots && Array.isArray(team.slots)) {
                found = team.slots.some(function(s){ return s === cancelPlayer; });
            } else {
                found = (team.players.includes(cancelPlayer) || team.gk === cancelPlayer);
            }
            if (found) conflictPlayers.push(cancelPlayer + ' (' + teamNames[team.color] + ')');
        });
    });
    
    if (conflictPlayers.length > 0) {
        alert('Peringatan:\nPemain berikut ada di cancel list TAPI juga di tim:\n' + conflictPlayers.join('\n') + 
              '\n\nMereka akan dihapus dari tim secara otomatis.');
        
        matchData.cancelOnDay.forEach(function(cancelPlayer) {
            matchData.teams.forEach(function(team) {
                if (team.slots && Array.isArray(team.slots) && team.slots.length === 8) {
                    team.slots = team.slots.map(function(s){ return s === cancelPlayer ? null : s; });
                    team.gk = team.slots[0] || null;
                    team.players = team.slots.slice(1).filter(function(s){ return s && s.toString().trim(); });
                } else {
                    team.players = team.players.filter(function(p) { return p !== cancelPlayer; });
                    if (team.gk === cancelPlayer) {
                        team.gk = null;
                    }
                }
            });
        });
    }
    
    var sanitized = {
        date: currentMatchDate,
        teamCount: getSelectedTeamCount(),
        teams: [],
        matches: [],
        cancelOnDay: matchData.cancelOnDay || []
    };
    
    matchData.teams.forEach(function(team) {
        var teamCopy = {
            color: team.color,
            wins: team.wins || 0,
            draws: team.draws || 0,
            losses: team.losses || 0,
            goalsFor: team.goalsFor || 0,
            goalsAgainst: team.goalsAgainst || 0,
            champion: team.champion || false,
            gk: team.gk || null
        };
        
        if (team.slots && Array.isArray(team.slots)) {
            teamCopy.slots = team.slots.slice(0, 8);
        } else {
            teamCopy.slots = new Array(8).fill(null);
            if (team.gk) teamCopy.slots[0] = team.gk;
            if (team.players) {
                var idx = 1;
                team.players.forEach(function(p) {
                    if (idx < 8) teamCopy.slots[idx++] = p;
                });
            }
        }
        
        teamCopy.players = teamCopy.slots.slice(1).filter(function(s) { 
            return s && s.toString().trim() && s !== teamCopy.gk; 
        });
        
        sanitized.teams.push(teamCopy);
    });
    
    if (matchData.matches && Array.isArray(matchData.matches)) {
        matchData.matches.forEach(function(match) {
            sanitized.matches.push({
                team1: match.team1,
                team2: match.team2,
                score1: match.score1 !== undefined && match.score1 !== null && match.score1 !== '' ? parseInt(match.score1) : null,
                score2: match.score2 !== undefined && match.score2 !== null && match.score2 !== '' ? parseInt(match.score2) : null,
                note: match.note || ''
            });
        });
    } else {
        var defaultMatchesList = getDefaultMatchesForTeamCount(getSelectedTeamCount());
        defaultMatchesList.forEach(function(m) {
            sanitized.matches.push({
                team1: m.team1,
                team2: m.team2,
                score1: null,
                score2: null,
                note: ''
            });
        });
    }
    
    showLoading();
    
    try {
        var result = await callAPI('saveMatchDateData', {
            date: currentMatchDate,
            weekData: JSON.stringify(sanitized)
        });
        hideLoading();
        
        if (result.success) {
            if (!options.silent) alert('Data pertandingan berhasil disimpan!');
            await updateLeaderboard();
            // Update daftar tanggal setelah simpan
            await loadMatchDatesList();
        } else {
            alert('Gagal menyimpan data: ' + (result.error || 'Terjadi kesalahan'));
        }
    } catch (error) {
        hideLoading();
        console.error('Error saving match data:', error);
        alert('Terjadi kesalahan saat menyimpan: ' + error.message);
    }
}

function filterSlotSearch(teamColor, slotIdx, searchTerm) {
    var resultsContainer = document.getElementById('slot-search-' + teamColor + '-' + slotIdx);
    if (!resultsContainer) return;
    if (!searchTerm || searchTerm.trim() === '') {
        resultsContainer.style.display = 'none';
        resultsContainer.innerHTML = '';
        return;
    }

    var team = matchData.teams.find(function(t) { return t.color === teamColor; });
    if (!team) return;

    var teamAssigned = (team.slots || []).filter(function(s, i) {
        return s && s.toString().trim() && i !== slotIdx;
    });

    var otherTeamsAssigned = getAllAssignedPlayers(matchData).filter(function(p) {
        return team.slots ? team.slots.indexOf(p) === -1 : true;
    });

    var availablePlayers = players.filter(function(player) {
        if (otherTeamsAssigned.includes(player.name)) return false;
        if (teamAssigned.includes(player.name)) return false;
        return true;
    });

    var filtered = availablePlayers.filter(function(player) {
        return player.name.toLowerCase().includes(searchTerm.toLowerCase());
    });

    if (filtered.length === 0) {
        resultsContainer.innerHTML = '<div style="padding: 8px; color: #999; text-align: center;">Tidak ada pemain yang cocok</div>';
        resultsContainer.style.display = 'block';
        return;
    }

    resultsContainer.innerHTML = filtered.map(function(player) {
        var safeName = player.name.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        return `
            <div class="slot-search-item" data-player="${safeName}" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f6f6f6; display:flex; justify-content:space-between; align-items:center;"
                 onmouseover="this.style.background='#f8f9fa'"
                 onmouseout="this.style.background='white'"
                 onclick="selectSlotSuggestion('${teamColor}', ${slotIdx}, '${safeName}')">
                <span>${player.name}</span>
                <button type="button" class="btn btn-small" style="padding: 4px 10px; font-size: 0.8rem;">Pilih</button>
            </div>
        `;
    }).join('');

    resultsContainer.dataset.team = teamColor;
    resultsContainer.dataset.slot = slotIdx;
    resultsContainer.onmousedown = function(e) {
        var item = e.target.closest('.slot-search-item');
        if (!item) return;
        var name = item.getAttribute('data-player');
        if (!name) return;
        name = name.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
        selectSlotSuggestion(resultsContainer.dataset.team, parseInt(resultsContainer.dataset.slot, 10), name);
        e.stopPropagation();
        e.preventDefault();
    };

    resultsContainer.style.display = 'block';
}

function hideSlotSearch(teamColor, slotIdx) {
    setTimeout(function() {
        var resultsContainer = document.getElementById('slot-search-' + teamColor + '-' + slotIdx);
        if (!resultsContainer) return;
        resultsContainer.style.display = 'none';
        resultsContainer.innerHTML = '';
    }, 180);
}

function selectSlotSuggestion(teamColor, slotIdx, playerName) {
    updateTeamSlot(teamColor, slotIdx, playerName);
    var inputEl = document.getElementById('slot-input-' + teamColor + '-' + slotIdx);
    if (inputEl) inputEl.value = playerName;
    var resultsContainer = document.getElementById('slot-search-' + teamColor + '-' + slotIdx);
    if (resultsContainer) {
        resultsContainer.style.display = 'none';
        resultsContainer.innerHTML = '';
    }
}
