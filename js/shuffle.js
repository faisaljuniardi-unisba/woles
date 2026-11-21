// ==================== KOCOK TIM ====================
var shuffleResult = null;
var shuffleDate = '';
var playerPositions = {}; // { playerName: 'gk'|'def'|'mid'|'fwd' }
var playerPositionOrder = []; // order of assignment for rendering
var finalSeeds = []; // [{player: 'Name', team: 'merah'}]
var rankingSeedNames = []; // Top 8/Top 4 yang hadir untuk pengocokan otomatis 4 tim
var rankingSeedPerTeam = 0;

// Posisi yang tersedia
var POSITIONS = {
    GK: 'gk',
    DEF: 'def',
    MID: 'mid',
    FWD: 'fwd'
};

var POSITION_LABELS = {
    'gk': '🧤 Kiper',
    'def': '🛡️ Bek',
    'mid': '⚡ Tengah',
    'fwd': '⚽ Depan'
};

var POSITION_COLORS = {
    'gk': '#9b59b6',
    'def': '#2ecc71',
    'mid': '#f39c12',
    'fwd': '#e74c3c'
};

function getPositionLimits(teamCount) {
    if (teamCount === 5) {
        return { gk: 5, def: 10, mid: 10, fwd: 10 };
    }
    return { gk: 4, def: 8, mid: 12, fwd: 8 };
}

function getTeamComposition(teamCount) {
    if (teamCount === 5) {
        return { gk: 1, def: 2, mid: 2, fwd: 2 };
    }
    return { gk: 1, def: 2, mid: 3, fwd: 2 };
}

function shuffleSeedArray(list) {
    var result = list.slice();
    for (var i = result.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = result[i];
        result[i] = result[j];
        result[j] = tmp;
    }
    return result;
}

// Tempatkan pemain unggulan dengan batas keras: Top 8 = 2/tim, Top 4 = 1/tim.
// Kapasitas posisi juga dijaga agar hasil akhir tetap sesuai formasi tim.
function createBalancedRankingSeeds(playerNames, perTeam) {
    var teamColorsList = getActiveTeamColors(4);
    var composition = getTeamComposition(4);
    var orderedPlayers = shuffleSeedArray(playerNames).sort(function(a, b) {
        var posA = playerPositions[a];
        var posB = playerPositions[b];
        return (composition[posA] || 99) - (composition[posB] || 99);
    });
    var state = {};
    teamColorsList.forEach(function(color) {
        state[color] = { total: 0, gk: 0, def: 0, mid: 0, fwd: 0 };
    });
    var result = [];

    function assign(index) {
        if (index >= orderedPlayers.length) return true;
        var playerName = orderedPlayers[index];
        var position = playerPositions[playerName];
        var candidates = shuffleSeedArray(teamColorsList).filter(function(color) {
            return state[color].total < perTeam && state[color][position] < composition[position];
        });
        for (var i = 0; i < candidates.length; i++) {
            var color = candidates[i];
            state[color].total++;
            state[color][position]++;
            result.push({ player: playerName, team: color });
            if (assign(index + 1)) return true;
            result.pop();
            state[color].total--;
            state[color][position]--;
        }
        return false;
    }

    if (!assign(0)) {
        throw new Error('Pemain unggulan tidak dapat dibagi merata karena komposisi posisinya tidak sesuai kapasitas tim.');
    }
    var valid = teamColorsList.every(function(color) { return state[color].total === perTeam; });
    if (!valid) throw new Error('Pembagian pemain unggulan tidak menghasilkan jumlah yang sama pada setiap tim.');
    return result;
}

async function getAutomaticRankingPlan(date) {
    if (getSelectedTeamCount() !== 4) return { names: [], perTeam: 0, week: 0, lastWeek: 0 };

    var targetDate = new Date(date);
    var year = targetDate.getFullYear();
    var month = targetDate.getMonth() + 1;
    var sundays = getSundaysOfMonth(year, month);
    var weekNumber = getWeekIndex(date, sundays);
    var lastWeek = sundays.length >= 5 ? 5 : 4;
    if (weekNumber <= 1) return { names: [], perTeam: 0, week: weekNumber, lastWeek: lastWeek };

    var required = weekNumber === lastWeek ? 4 : 8;
    var perTeam = required / 4;
    var datesResult = await callAPI('getMatchDates');
    if (!datesResult.success) throw new Error('Klasemen sebelumnya tidak dapat dibaca.');
    var previousDates = (datesResult.dates || []).filter(function(matchDate) {
        var d = new Date(matchDate);
        return d.getFullYear() === year && (d.getMonth() + 1) === month && d.getTime() < targetDate.getTime();
    }).sort(function(a, b) { return new Date(a) - new Date(b); });

    var points = {};
    for (var i = 0; i < previousDates.length; i++) {
        var previousDate = previousDates[i];
        var matchResult = await callAPI('getMatchDateData', { date: previousDate });
        if (!matchResult.success) continue;
        var weekData = matchResult.data && typeof matchResult.data === 'object' ? matchResult.data : matchResult;
        var teams = weekData.teams || [];
        var previousWeek = getWeekIndex(previousDate, sundays);
        var manualChampion = teams.find(function(team) { return team && (team.champion === true || team.champion === 1); });
        teams.forEach(function(team) {
            var names = (team.players || []).slice();
            if (team.gk && !names.includes(team.gk)) names.push(team.gk);
            var earned = 3 + ((team.wins || 0) * 3) + (team.draws || 0) + (manualChampion && manualChampion.color === team.color ? 2 : 0);
            names.forEach(function(name) {
                if (!points[name]) points[name] = { total: 0, weeks: {} };
                points[name].total += earned;
                points[name].weeks[previousWeek] = (points[name].weeks[previousWeek] || 0) + earned;
            });
        });
        (weekData.cancelOnDay || []).forEach(function(name) {
            if (!points[name]) points[name] = { total: 0, weeks: {} };
            points[name].total -= 5;
            points[name].weeks[previousWeek] = (points[name].weeks[previousWeek] || 0) - 5;
        });
    }

    var rankedPresent = Object.keys(points).filter(function(name) {
        return points[name].total > 0 && playerPositions[name] !== undefined;
    }).sort(function(a, b) {
        if (points[b].total !== points[a].total) return points[b].total - points[a].total;
        for (var w = weekNumber - 1; w >= 1; w--) {
            var aSum = 0;
            var bSum = 0;
            for (var x = 1; x <= w; x++) {
                aSum += points[a].weeks[x] || 0;
                bSum += points[b].weeks[x] || 0;
            }
            if (bSum !== aSum) return bSum - aSum;
        }
        return a.localeCompare(b);
    });

    if (rankedPresent.length < required) {
        throw new Error('Hanya ada ' + rankedPresent.length + ' pemain dari klasemen yang hadir. Dibutuhkan ' + required + ' pemain unggulan untuk dibagi merata.');
    }
    return { names: rankedPresent.slice(0, required), perTeam: perTeam, week: weekNumber, lastWeek: lastWeek };
}

// ==================== LOAD PLAYERS ====================
function loadPlayersForShuffle() {
    var dateInput = document.getElementById('shuffle-date');
    var date = dateInput.value;
    
    if (!date) {
        alert('Pilih tanggal terlebih dahulu!');
        return;
    }
    
    shuffleDate = date;
    selectedTeamCount = (document.querySelector('input[name="shuffle-team-count"]:checked') && document.querySelector('input[name="shuffle-team-count"]:checked').value === '5') ? 5 : 4;
    teamColors = getActiveTeamColors(selectedTeamCount);
    defaultMatches = getDefaultMatches(selectedTeamCount);
    updateTeamCountUI();
    
    // Reset posisi pemain
    playerPositions = {};
    playerPositionOrder = [];
    
    // Sembunyikan hasil sebelumnya
    document.getElementById('shuffle-result').style.display = 'none';
    document.getElementById('shuffle-process').style.display = 'none';
    
    // Tampilkan daftar pemain
    var container = document.getElementById('shuffle-player-list');
    container.style.display = 'block';
    
    renderShuffleTables();
}

// ==================== RENDER TABLES ====================
function renderShuffleTables() {
    var positions = ['gk', 'def', 'mid', 'fwd'];
    
    positions.forEach(function(pos) {
        renderPositionTable(pos);
    });
    
    updatePositionCounts();
}

function renderPositionTable(position) {
    var container = document.getElementById('shuffle-table-' + position);
    if (!container) return;
    
    // Clear container
    container.innerHTML = '';
    
    // Get players in this position by assignment order
    var playersInPosition = playerPositionOrder
        .filter(function(name) {
            return playerPositions[name] === position;
        })
        .map(function(name) {
            return players.find(function(p) { return p.name === name; });
        })
        .filter(Boolean);
    
    // Add any assigned players not present in order list
    var missingPlayers = players.filter(function(p) {
        return playerPositions[p.name] === position && playerPositionOrder.indexOf(p.name) === -1;
    });
    playersInPosition = playersInPosition.concat(missingPlayers);
    
    // Render player tags in table
    if (playersInPosition.length === 0) {
        var emptyMsg = document.createElement('div');
        emptyMsg.className = 'empty-message';
        emptyMsg.textContent = '🔍 Cari pemain di kolom pencarian di bawah untuk menambah ke ' + POSITION_LABELS[position];
        container.appendChild(emptyMsg);
    } else {
        playersInPosition.forEach(function(player) {
            var tag = document.createElement('span');
            tag.className = 'player-tag ' + position + '-tag';
            tag.draggable = true;
            tag.dataset.player = player.name;
            tag.dataset.position = position;
            
            var nameSpan = document.createElement('span');
            nameSpan.textContent = player.name;
            tag.appendChild(nameSpan);
            
            // Remove button
            var removeBtn = document.createElement('span');
            removeBtn.className = 'remove-pos';
            removeBtn.textContent = '✕';
            removeBtn.onclick = function(e) {
                e.stopPropagation();
                removePlayerFromPosition(player.name);
            };
            tag.appendChild(removeBtn);
            
            // Click to move to next position
            tag.onclick = function() {
                movePlayerToNextPosition(player.name);
            };
            
            // Drag events
            tag.ondragstart = function(e) {
                e.dataTransfer.setData('text/plain', player.name + '|' + position);
                this.classList.add('dragging');
            };
            tag.ondragend = function(e) {
                this.classList.remove('dragging');
            };
            
            container.appendChild(tag);
        });
    }
    
    // Render kolom pencarian di setiap tabel
    renderPositionSearch(position);
}

function renderPositionSearch(position) {
    var container = document.getElementById('shuffle-table-' + position);
    if (!container) return;
    
    // Create search wrapper
    var searchWrapper = document.createElement('div');
    searchWrapper.className = 'position-search-wrapper';
    searchWrapper.style.cssText = 'width: 100%; margin-top: 10px; position: relative; flex-shrink: 0;';
    
    // Search input dengan border warna sesuai posisi
    var searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.id = 'search-pos-' + position;
    searchInput.placeholder = '🔍 Cari pemain untuk ' + POSITION_LABELS[position] + '...';
    searchInput.style.cssText = 
        'width: 100%; padding: 10px 14px; border: 2px solid ' + POSITION_COLORS[position] + 
        '; border-radius: 8px; font-size: 0.95rem; outline: none; transition: all 0.3s; background: white; box-sizing: border-box;';
    searchInput.onfocus = function() { 
        this.style.boxShadow = '0 0 0 3px ' + POSITION_COLORS[position] + '40'; 
        if (this.value.trim() !== '') {
            filterPositionSearch(position, this.value);
        }
    };
    searchInput.onblur = function() { 
        this.style.boxShadow = 'none';
        // Delay hide results so click on result works
        setTimeout(function() {
            var resultsContainer = document.getElementById('search-results-pos-' + position);
            if (resultsContainer) {
                resultsContainer.style.display = 'none';
            }
        }, 200);
    };
    searchInput.onkeyup = function(e) {
        filterPositionSearch(position, this.value);
    };
    searchInput.onclick = function() {
        if (this.value.trim() !== '') {
            filterPositionSearch(position, this.value);
        }
    };
    
    // Results container (dropdown)
    var resultsContainer = document.createElement('div');
    resultsContainer.id = 'search-results-pos-' + position;
    resultsContainer.className = 'position-search-results';
    resultsContainer.style.cssText = 
        'display: none; position: absolute; background: white; border: 2px solid ' + POSITION_COLORS[position] + 
        '; border-radius: 8px; max-height: 200px; overflow-y: auto; width: 100%; z-index: 1000; margin-top: 5px; box-shadow: 0 5px 20px rgba(0,0,0,0.2); box-sizing: border-box;';
    
    searchWrapper.appendChild(searchInput);
    searchWrapper.appendChild(resultsContainer);
    container.appendChild(searchWrapper);
}

function filterPositionSearch(position, searchTerm) {
    var resultsContainer = document.getElementById('search-results-pos-' + position);
    if (!resultsContainer) return;
    
    if (!searchTerm || searchTerm.trim() === '') {
        resultsContainer.style.display = 'none';
        resultsContainer.innerHTML = '';
        return;
    }
    
    // Get players not assigned to any position (available)
    var assignedPlayers = Object.keys(playerPositions);
    var availablePlayers = players.filter(function(p) {
        return !assignedPlayers.includes(p.name);
    });
    
    // Also allow players already in this position to be shown
    var playersInThisPosition = players.filter(function(p) {
        return playerPositions[p.name] === position;
    });
    
    // Combine available + players in this position, avoid duplicates
    var allRelevantPlayers = availablePlayers.concat(playersInThisPosition);
    var uniquePlayers = [];
    var seen = {};
    allRelevantPlayers.forEach(function(p) {
        if (!seen[p.name]) {
            seen[p.name] = true;
            uniquePlayers.push(p);
        }
    });
    
    var filtered = uniquePlayers.filter(function(player) {
        return player.name.toLowerCase().includes(searchTerm.toLowerCase());
    });
    
    if (filtered.length === 0) {
        resultsContainer.innerHTML = '<div style="padding: 12px; color: #999; text-align: center; font-size: 0.9rem;">Tidak ada pemain yang cocok</div>';
        resultsContainer.style.display = 'block';
        return;
    }
    
    resultsContainer.innerHTML = filtered.map(function(player) {
        var isInPosition = playerPositions[player.name] === position;
        var isAssigned = playerPositions[player.name] !== undefined;
        var currentPos = playerPositions[player.name] || '';
        var posLabel = currentPos ? ' (' + POSITION_LABELS[currentPos] + ')' : '';
        
        var buttonText = isInPosition ? '✓ Sudah' : (isAssigned ? 'Pindah ke sini' : '+ Tambah');
        var buttonStyle = isInPosition ? 
            'background: #27ae60; cursor: default; opacity: 0.7;' : 
            (isAssigned ? 'background: #f39c12;' : 'background: ' + POSITION_COLORS[position] + ';');
        
        return `
            <div class="search-result-item" style="padding: 10px 15px; cursor: pointer; border-bottom: 1px solid #f1f1f1; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s;"
                 onmouseover="this.style.background='#f8f9fa'"
                 onmouseout="this.style.background='white'"
                 onclick="addPlayerToPositionFromSearch('${position}', '${player.name}')">
                <span style="font-weight: 500;">${player.name}<span style="color: #999; font-size: 0.85rem;">${posLabel}</span></span>
                <button class="btn btn-small" style="${buttonStyle} padding: 4px 14px; font-size: 0.8rem; color: white; border: none; border-radius: 20px; cursor: ${isInPosition ? 'default' : 'pointer'};" ${isInPosition ? 'disabled' : ''}>
                    ${buttonText}
                </button>
            </div>
        `;
    }).join('');
    
    resultsContainer.style.display = 'block';
}

function getPositionCounts() {
    var counts = { gk: 0, def: 0, mid: 0, fwd: 0 };
    Object.values(playerPositions).forEach(function(pos) {
        if (counts.hasOwnProperty(pos)) {
            counts[pos]++;
        }
    });
    return counts;
}

function getPositionValidationErrors(counts) {
    var errors = [];
    var limits = getPositionLimits(getSelectedTeamCount());

    if (counts.gk < limits.gk) errors.push('Kiper minimal ' + limits.gk + ' orang (saat ini ' + counts.gk + ')');
    if (counts.gk > limits.gk) errors.push('Kiper maksimal ' + limits.gk + ' orang (saat ini ' + counts.gk + ')');
    if (counts.def < limits.def) errors.push('Bek minimal ' + limits.def + ' orang (saat ini ' + counts.def + ')');
    if (counts.def > limits.def) errors.push('Bek maksimal ' + limits.def + ' orang (saat ini ' + counts.def + ')');
    if (counts.mid < limits.mid) errors.push('Tengah minimal ' + limits.mid + ' orang (saat ini ' + counts.mid + ')');
    if (counts.mid > limits.mid) errors.push('Tengah maksimal ' + limits.mid + ' orang (saat ini ' + counts.mid + ')');
    if (counts.fwd < limits.fwd) errors.push('Depan minimal ' + limits.fwd + ' orang (saat ini ' + counts.fwd + ')');
    if (counts.fwd > limits.fwd) errors.push('Depan maksimal ' + limits.fwd + ' orang (saat ini ' + counts.fwd + ')');
    return errors;
}

function addPlayerToPositionFromSearch(position, playerName) {
    var resultsContainer = document.getElementById('search-results-pos-' + position);
    if (resultsContainer) {
        resultsContainer.style.display = 'none';
        resultsContainer.innerHTML = '';
    }
    
    var searchInput = document.getElementById('search-pos-' + position);
    if (searchInput) {
        searchInput.value = '';
    }
    
    if (playerPositions[playerName] === position) {
        return;
    }

    var counts = getPositionCounts();
    var limits = getPositionLimits(getSelectedTeamCount());
    if (counts[position] >= limits[position]) {
        alert(POSITION_LABELS[position] + ' sudah penuh (' + limits[position] + ' orang).');
        return;
    }

    setPlayerPosition(playerName, position);
    renderShuffleTables();
}

function allowDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
}

function dropToPosition(e, position) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    
    var data = e.dataTransfer.getData('text/plain');
    if (!data) return;
    
    var parts = data.split('|');
    var playerName = parts[0];

    if (playerPositions[playerName] === position) {
        return;
    }

    var counts = getPositionCounts();
    var limits = getPositionLimits(getSelectedTeamCount());
    if (counts[position] >= limits[position]) {
        alert(POSITION_LABELS[position] + ' sudah penuh (' + limits[position] + ' orang).');
        return;
    }

    setPlayerPosition(playerName, position);
    renderShuffleTables();
}

function movePlayerToNextPosition(playerName) {
    var positions = ['gk', 'def', 'mid', 'fwd'];
    var currentPos = playerPositions[playerName];
    
    if (currentPos) {
        var idx = positions.indexOf(currentPos);
        var nextPos = positions[(idx + 1) % positions.length];
        var counts = getPositionCounts();
        var limits = getPositionLimits(getSelectedTeamCount());
        if (counts[nextPos] >= limits[nextPos]) {
            alert(POSITION_LABELS[nextPos] + ' sudah penuh (' + limits[nextPos] + ' orang).');
            return;
        }
        setPlayerPosition(playerName, nextPos);
    }
    
    renderShuffleTables();
}

function setPlayerPosition(playerName, position) {
    if (playerPositions[playerName] && playerPositions[playerName] !== position) {
        // remove existing position assignment but preserve ordering
        playerPositions[playerName] = position;
    } else {
        playerPositions[playerName] = position;
    }
    if (playerPositionOrder.indexOf(playerName) === -1) {
        playerPositionOrder.push(playerName);
    }
}

function removePlayerFromPosition(playerName) {
    delete playerPositions[playerName];
    var index = playerPositionOrder.indexOf(playerName);
    if (index !== -1) {
        playerPositionOrder.splice(index, 1);
    }
    renderShuffleTables();
}

function updatePositionCounts() {
    var counts = getPositionCounts();
    
    var total = counts.gk + counts.def + counts.mid + counts.fwd;
    
    document.getElementById('pos-count-gk').textContent = counts.gk;
    document.getElementById('pos-count-def').textContent = counts.def;
    document.getElementById('pos-count-mid').textContent = counts.mid;
    document.getElementById('pos-count-fwd').textContent = counts.fwd;
    document.getElementById('pos-count-gk-badge').textContent = counts.gk;
    document.getElementById('pos-count-def-badge').textContent = counts.def;
    document.getElementById('pos-count-mid-badge').textContent = counts.mid;
    document.getElementById('pos-count-fwd-badge').textContent = counts.fwd;
    var totalCountEl = document.getElementById('total-player-count');
    if (totalCountEl) {
        totalCountEl.textContent = total;
    }
}

function resetAllPositions() {
    if (!confirm('Reset semua posisi pemain?')) return;
    playerPositions = {};
    renderShuffleTables();
}

function autoAssignPositions() {
    var shuffledPlayers = players.slice().sort(function() { return Math.random() - 0.5; });
    var total = shuffledPlayers.length;

    var counts = { gk: 0, def: 0, mid: 0, fwd: 0 };
    var limits = getPositionLimits(getSelectedTeamCount());
    var order = ['gk', 'def', 'mid', 'fwd'];
    var remaining = Math.min(total, limits.gk + limits.def + limits.mid + limits.fwd);

    order.forEach(function(pos) {
        var limit = limits[pos];
        var take = Math.min(limit, remaining);
        counts[pos] = take;
        remaining -= take;
    });

    playerPositions = {};
    playerPositionOrder = [];
    var index = 0;
    order.forEach(function(pos) {
        for (var i = 0; i < counts[pos]; i++) {
            if (index >= shuffledPlayers.length) break;
            setPlayerPosition(shuffledPlayers[index].name, pos);
            index++;
        }
    });
    
    renderShuffleTables();
}

async function startShuffle() {
    var dateInput = document.getElementById('shuffle-date');
    var date = dateInput.value;
    
    if (!date) {
        alert('Pilih tanggal terlebih dahulu!');
        return;
    }
    
    shuffleDate = date;
    
    var counts = getPositionCounts();
    var errors = getPositionValidationErrors(counts);
    
    if (errors.length > 0) {
        alert('Jumlah pemain tidak mencukupi:\n' + errors.join('\n'));
        return;
    }
    
    document.getElementById('shuffle-player-list').style.display = 'none';
    document.getElementById('shuffle-result').style.display = 'none';
    document.getElementById('shuffle-process').style.display = 'block';
    
    document.getElementById('shuffle-date-display').textContent = 'Tanggal: ' + new Date(date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    var animation = document.getElementById('shuffleAnimation');
    animation.style.display = 'block';
    
    try {
        var rankingPlan = await getAutomaticRankingPlan(date);
        rankingSeedNames = rankingPlan.names;
        rankingSeedPerTeam = rankingPlan.perTeam;
        finalSeeds = [];
    } catch (error) {
        console.error('Gagal menyiapkan pembagian pemain unggulan:', error);
        document.getElementById('shuffle-process').style.display = 'none';
        document.getElementById('shuffle-player-list').style.display = 'block';
        alert(error.message || 'Gagal membaca klasemen untuk pengocokan.');
        return;
    }

    setTimeout(function() {
        try {
            if (rankingSeedNames.length > 0) {
                performFinalShuffle(createBalancedRankingSeeds(rankingSeedNames, rankingSeedPerTeam), false);
            } else {
                performShuffle();
            }
        } catch (error) {
            console.error('Gagal mengocok tim:', error);
            document.getElementById('shuffle-process').style.display = 'none';
            document.getElementById('shuffle-player-list').style.display = 'block';
            alert('Gagal mengocok tim. Silakan coba kembali.');
        }
    }, 2000);
}

function performShuffle() {
    var gkPlayers = players.filter(function(p) { return playerPositions[p.name] === 'gk'; }).map(function(p) { return p.name; });
    var defPlayers = players.filter(function(p) { return playerPositions[p.name] === 'def'; }).map(function(p) { return p.name; });
    var midPlayers = players.filter(function(p) { return playerPositions[p.name] === 'mid'; }).map(function(p) { return p.name; });
    var fwdPlayers = players.filter(function(p) { return playerPositions[p.name] === 'fwd'; }).map(function(p) { return p.name; });
    
    function shuffleArray(arr) {
        for (var i = arr.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = arr[i];
            arr[i] = arr[j];
            arr[j] = temp;
        }
        return arr;
    }
    
    var shuffledGk = shuffleArray(gkPlayers.slice());
    var shuffledDef = shuffleArray(defPlayers.slice());
    var shuffledMid = shuffleArray(midPlayers.slice());
    var shuffledFwd = shuffleArray(fwdPlayers.slice());
    
    var teamCount = getSelectedTeamCount();
    var teams = getActiveTeamColors(teamCount).map(function(color) {
        return { color: color, players: [] };
    });
    
    var gkIndex = 0;
    for (var i = 0; i < teams.length; i++) {
        if (gkIndex < shuffledGk.length) {
            teams[i].gk = shuffledGk[gkIndex];
            gkIndex++;
        }
    }
    while (gkIndex < shuffledGk.length) {
        var teamIndex = gkIndex % teams.length;
        teams[teamIndex].players.push(shuffledGk[gkIndex]);
        gkIndex++;
    }
    
    var composition = getTeamComposition(getSelectedTeamCount());
    distributePlayersToTeams(shuffledDef, teams, composition.def);
    distributePlayersToTeams(shuffledMid, teams, composition.mid);
    distributePlayersToTeams(shuffledFwd, teams, composition.fwd);

    teams.forEach(function(team) {
        team.slots = buildSlotsFromTeam(team);
    });
    
    shuffleResult = {
        gk: shuffledGk,
        def: shuffledDef,
        mid: shuffledMid,
        fwd: shuffledFwd,
        teams: teams,
        captains: [],
        allPlayers: players.map(function(p) { return p.name; })
    };
    
    renderShuffleResult(shuffleResult);
    var animation = document.getElementById('shuffleAnimation');
    if (animation) animation.style.display = 'none';
    document.getElementById('shuffle-result').style.display = 'block';
    document.getElementById('shuffle-process').style.display = 'none';
}

function renderShuffleResult(result) {
    var positionMappings = [
        { id: 'shuffle-gk', list: result.gk, className: 'gk-tag' },
        { id: 'shuffle-def', list: result.def, className: '' },
        { id: 'shuffle-mid', list: result.mid, className: '' },
        { id: 'shuffle-fwd', list: result.fwd, className: '' }
    ];
    
    positionMappings.forEach(function(mapping) {
        var container = document.getElementById(mapping.id);
        if (container) {
            container.innerHTML = mapping.list.map(function(player, index) {
                var isCaptain = shuffleResult.captains && shuffleResult.captains.includes(player);
                var displayName = isCaptain ? '<strong>' + player + ' (C)</strong>' : player;
                return '<span class="player-tag ' + mapping.className + '">' + (index + 1) + '. ' + displayName + '</span>';
            }).join('');
        }
    });
    
    var grid = document.getElementById('shuffle-teams-grid');
    if (grid) {
        grid.innerHTML = result.teams.map(function(team) {
            var teamName = teamNames[team.color] || team.color;
            var playerList = team.players.map(function(p) {
                var isCaptain = shuffleResult.captains && shuffleResult.captains.includes(p);
                var displayName = isCaptain ? '<strong>' + p + ' (C)</strong>' : p;
                return '<span class="player-tag">' + displayName + '</span>';
            }).join('');
            var gkDisplay = team.gk ? 
                (function() {
                    var isCaptain = shuffleResult.captains && shuffleResult.captains.includes(team.gk);
                    var gkName = isCaptain ? '<strong>' + team.gk + ' (C)</strong>' : team.gk;
                    return '<div class="gk-label" style="background: #9b59b6; color: white; padding: 4px 12px; border-radius: 20px; display: inline-block; margin-bottom: 10px;">🧤 GK: ' + gkName + '</div>';
                })() :
                '';
            
            var totalPlayers = team.players.length + (team.gk ? 1 : 0);
            
            return '<div class="shuffle-team-card" style="border-top-color: var(--' + team.color + ');">' +
                '<h5 style="color: var(--' + team.color + ');">' + teamName + ' (' + totalPlayers + ' pemain)</h5>' +
                gkDisplay +
                '<div class="team-players">' + playerList + '</div>' +
            '</div>';
        }).join('');
    }
}

function reshuffle() {
    var animation = document.getElementById('shuffleAnimation');
    if (animation) animation.style.display = 'block';
    document.getElementById('shuffle-process').style.display = 'block';
    document.getElementById('shuffle-result').style.display = 'none';

    setTimeout(function() {
        try {
            if (finalSeeds && finalSeeds.length === getSelectedTeamCount()) {
                performFinalShuffle(finalSeeds, true);
            } else if (rankingSeedNames.length > 0) {
                performFinalShuffle(createBalancedRankingSeeds(rankingSeedNames, rankingSeedPerTeam), false);
            } else {
                performShuffle();
            }
        } catch (error) {
            console.error('Gagal mengocok ulang:', error);
            document.getElementById('shuffle-process').style.display = 'none';
            document.getElementById('shuffle-result').style.display = shuffleResult ? 'block' : 'none';
            alert('Gagal mengocok ulang. Silakan coba kembali.');
        }
    }, 1500);
}

function backToPlayerSelection() {
    document.getElementById('shuffle-result').style.display = 'none';
    document.getElementById('shuffle-process').style.display = 'none';
    document.getElementById('shuffle-player-list').style.display = 'block';
    renderShuffleTables();
}

// ==================== KOCOKAN FINAL - DIUBAH UNTUK 5 TIM ====================
function openFinalShuffleModal() {
    var teamCount = getSelectedTeamCount();
    
    // Hapus semua input sebelumnya
    var container = document.querySelector('.photo-modal-content');
    if (!container) return;
    
    // Buat ulang modal untuk jumlah tim yang sesuai
    var modalContent = document.getElementById('finalShuffleModal');
    if (!modalContent) return;
    
    // Buat form untuk final shuffle dengan jumlah tim yang sesuai
    var teamColorsList = getActiveTeamColors(teamCount);
    var teamOptionsHtml = '<option value="">Pilih Tim</option>';
    teamColorsList.forEach(function(color) {
        var label = teamNames[color] || color;
        teamOptionsHtml += '<option value="' + color + '">' + label + '</option>';
    });
    
    var playersHtml = '';
    for (var i = 0; i < teamCount; i++) {
        playersHtml += `
            <div style="display:flex; gap:10px; align-items:center; margin-bottom:10px;">
                <div style="flex:1; position:relative;">
                    <input type="text" id="final-player-${i}" placeholder="Cari pemain final..." class="date-input" onkeyup="filterFinalPlayer(${i}, this.value)" autocomplete="off">
                    <div id="final-search-results-${i}" class="position-search-results" style="display:none; max-height:120px; overflow:auto;"></div>
                </div>
                <div style="width:160px;">
                    <select id="final-team-${i}" class="date-input" style="width:100%;">
                        ${teamOptionsHtml}
                    </select>
                </div>
            </div>
        `;
    }
    
    // Update isi modal
    var modalBody = modalContent.querySelector('.photo-modal-content');
    if (modalBody) {
        modalBody.innerHTML = `
            <h3 style="color: #2c3e50; margin-bottom: 10px; text-align: center;">Kocokan FINAL</h3>
            <p id="final-shuffle-description" style="text-align: center; color: #666; margin-bottom: 20px;">
                Pilih ${teamCount} pemain puncak dan tetapkan satu pemain untuk setiap tim. Sisanya akan dikocok seperti biasa.
            </p>

            <div style="display: grid; gap: 12px;">
                ${playersHtml}
            </div>

            <div style="text-align:center; margin-top:18px; display:flex; gap:12px; justify-content:center;">
                <button class="btn" onclick="confirmFinalShuffle()" style="background: linear-gradient(135deg, #27ae60, #219955);">Konfirmasi & Kocok</button>
                <button class="btn" onclick="closeFinalShuffleModal()" style="background: linear-gradient(135deg, #95a5a6, #7f8c8d);">Batal</button>
            </div>
        `;
    }
    
    // Reset semua input
    for (var j = 0; j < teamCount; j++) {
        var inp = document.getElementById('final-player-' + j);
        var sel = document.getElementById('final-team-' + j);
        var res = document.getElementById('final-search-results-' + j);
        if (inp) inp.value = '';
        if (sel) sel.value = '';
        if (res) { res.style.display = 'none'; res.innerHTML = ''; }
    }
    
    finalSeeds = [];
    document.getElementById('finalShuffleModal').style.display = 'flex';
}

function closeFinalShuffleModal() {
    document.getElementById('finalShuffleModal').style.display = 'none';
}

function filterFinalPlayer(index, searchTerm) {
    var resultsContainer = document.getElementById('final-search-results-' + index);
    if (!resultsContainer) return;
    if (!searchTerm || searchTerm.trim() === '') {
        resultsContainer.style.display = 'none';
        resultsContainer.innerHTML = '';
        return;
    }

    var teamCount = getSelectedTeamCount();
    var selected = [];
    for (var i = 0; i < teamCount; i++) {
        if (i === index) continue;
        var v = document.getElementById('final-player-' + i);
        if (v && v.value) selected.push(v.value);
    }

    var assignedPlayers = players.filter(function(p) {
        return playerPositions[p.name] !== undefined;
    });

    var filtered = assignedPlayers.filter(function(p) {
        if (selected.includes(p.name)) return false;
        return p.name.toLowerCase().includes(searchTerm.toLowerCase());
    });

    if (filtered.length === 0) {
        resultsContainer.innerHTML = '<div style="padding: 10px; color: #999; text-align: center;">Tidak ada pemain yang cocok</div>';
        resultsContainer.style.display = 'block';
        return;
    }

    resultsContainer.innerHTML = filtered.map(function(player) {
        return `
            <div class="search-result-item" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f1f1f1;"
                 onclick="selectFinalPlayer(${index}, '${player.name.replace(/'/g, "\\'")}')">
                ${player.name}
            </div>
        `;
    }).join('');

    resultsContainer.style.display = 'block';
}

function selectFinalPlayer(index, playerName) {
    var inp = document.getElementById('final-player-' + index);
    var res = document.getElementById('final-search-results-' + index);
    if (inp) inp.value = playerName;
    if (res) { res.style.display = 'none'; res.innerHTML = ''; }
}

function confirmFinalShuffle() {
    var teamCount = getSelectedTeamCount();
    var seeds = [];
    var teamColorsList = getActiveTeamColors(teamCount);
    
    for (var i = 0; i < teamCount; i++) {
        var pname = (document.getElementById('final-player-' + i) || {}).value || '';
        var tcol = (document.getElementById('final-team-' + i) || {}).value || '';
        pname = pname.trim();
        if (!pname || !tcol) {
            alert('Isi semua ' + teamCount + ' pemain final beserta timnya.');
            return;
        }
        seeds.push({ player: pname, team: tcol });
    }

    var names = seeds.map(s => s.player);
    var teams = seeds.map(s => s.team);
    var dupNames = names.filter((v,i,a) => a.indexOf(v) !== i);
    var dupTeams = teams.filter((v,i,a) => a.indexOf(v) !== i);
    
    if (dupNames.length > 0) { 
        alert('Terdapat pemain final yang duplikat. Pastikan ' + teamCount + ' pemain berbeda.'); 
        return; 
    }
    if (dupTeams.length > 0) { 
        alert('Terdapat tim yang dipilih lebih dari sekali. Pilih ' + teamCount + ' tim berbeda.'); 
        return; 
    }

    // Validasi semua tim yang dipilih harus ada di teamColorsList
    var invalidTeams = teams.filter(function(t) {
        return !teamColorsList.includes(t);
    });
    if (invalidTeams.length > 0) {
        alert('Tim yang dipilih tidak valid: ' + invalidTeams.join(', '));
        return;
    }

    var missing = names.filter(function(n) { 
        return !players.some(p => p.name === n); 
    });
    if (missing.length > 0) { 
        alert('Pemain berikut tidak ditemukan: ' + missing.join(', ')); 
        return; 
    }

    var counts = getPositionCounts();
    var errors = getPositionValidationErrors(counts);
    if (errors.length > 0) { 
        alert('Jumlah pemain tidak mencukupi:\n' + errors.join('\n')); 
        return; 
    }

    finalSeeds = seeds;
    rankingSeedNames = [];
    rankingSeedPerTeam = 0;
    closeFinalShuffleModal();
    document.getElementById('shuffle-player-list').style.display = 'none';
    document.getElementById('shuffle-result').style.display = 'none';
    var animation = document.getElementById('shuffleAnimation');
    if (animation) animation.style.display = 'block';
    document.getElementById('shuffle-process').style.display = 'block';
    setTimeout(function() {
        try {
            performFinalShuffle(finalSeeds, true);
        } catch (error) {
            console.error('Gagal menjalankan kocokan final:', error);
            document.getElementById('shuffle-process').style.display = 'none';
            document.getElementById('shuffle-player-list').style.display = 'block';
            alert('Gagal menjalankan kocokan final. Silakan coba kembali.');
        }
    }, 800);
}

// ==================== PERFORM FINAL SHUFFLE - DIUBAH UNTUK 5 TIM ====================
function performFinalShuffle(seeds, markCaptains) {
    var teamCount = getSelectedTeamCount();
    var seededNames = seeds.map(s => s.player);
    
    // Ambil pemain berdasarkan posisi, kecuali yang sudah di-seed
    var gkPlayers = players.filter(function(p) { 
        return playerPositions[p.name] === 'gk' && !seededNames.includes(p.name); 
    }).map(p => p.name);
    var defPlayers = players.filter(function(p) { 
        return playerPositions[p.name] === 'def' && !seededNames.includes(p.name); 
    }).map(p => p.name);
    var midPlayers = players.filter(function(p) { 
        return playerPositions[p.name] === 'mid' && !seededNames.includes(p.name); 
    }).map(p => p.name);
    var fwdPlayers = players.filter(function(p) { 
        return playerPositions[p.name] === 'fwd' && !seededNames.includes(p.name); 
    }).map(p => p.name);

    function shuffleArray(arr) { 
        for (var i = arr.length - 1; i > 0; i--) { 
            var j = Math.floor(Math.random() * (i + 1)); 
            var temp = arr[i]; 
            arr[i] = arr[j]; 
            arr[j] = temp; 
        } 
        return arr; 
    }

    var shuffledGk = shuffleArray(gkPlayers.slice());
    var shuffledDef = shuffleArray(defPlayers.slice());
    var shuffledMid = shuffleArray(midPlayers.slice());
    var shuffledFwd = shuffleArray(fwdPlayers.slice());

    // Buat tim sesuai jumlah
    var teams = getActiveTeamColors(teamCount).map(function(color) {
        return { color: color, players: [], gk: null };
    });

    // Inisialisasi slot buckets
    teams.forEach(function(team) {
        team.slotBuckets = { gk: null, def: [], mid: [], fwd: [] };
    });

    // Masukkan seed ke tim masing-masing
    seeds.forEach(function(s) {
        var team = teams.find(function(t) { return t.color === s.team; });
        if (!team) return;
        var pos = playerPositions[s.player];
        if (pos === 'gk') {
            team.slotBuckets.gk = s.player;
        } else if (pos === 'def' || pos === 'mid' || pos === 'fwd') {
            team.slotBuckets[pos].push(s.player);
        } else {
            team.slotBuckets.mid.push(s.player);
        }
    });

    // Distribusi GK
    var gkIndex = 0;
    for (var i = 0; i < teams.length; i++) {
        if (!teams[i].slotBuckets.gk) {
            if (gkIndex < shuffledGk.length) {
                teams[i].slotBuckets.gk = shuffledGk[gkIndex];
                gkIndex++;
            }
        }
    }
    var extraGKs = [];
    while (gkIndex < shuffledGk.length) {
        extraGKs.push(shuffledGk[gkIndex]);
        gkIndex++;
    }

    // Fungsi distribusi posisi
    function distributePosition(list, positionKey) {
        var available = list.slice();
        var shuffled = available.sort(function() { return Math.random() - 0.5; });

        var composition = getTeamComposition(teamCount);
        var needs = teams.map(function(team) {
            var required = composition[positionKey] || 0;
            var alreadySeededHere = team.slotBuckets[positionKey] ? team.slotBuckets[positionKey].length : 0;
            var need = required - alreadySeededHere;
            return Math.max(0, need);
        });

        var idx = 0;
        for (var i = 0; i < teams.length; i++) {
            while (needs[i] > 0 && idx < shuffled.length) {
                var candidate = shuffled[idx++];
                if (!candidate) continue;
                teams[i].slotBuckets[positionKey].push(candidate);
                needs[i]--;
            }
        }

        var teamPtr = 0;
        while (idx < shuffled.length) {
            var candidate = shuffled[idx++];
            if (!candidate) continue;
            teams[teamPtr].slotBuckets[positionKey].push(candidate);
            teamPtr = (teamPtr + 1) % teams.length;
        }
    }

    // Distribusi untuk setiap posisi
    distributePosition(shuffledDef, 'def');
    distributePosition(shuffledMid, 'mid');
    distributePosition(shuffledFwd, 'fwd');

    // Bangun tim final dengan slots
    var finalTeams = teams.map(function(team) {
        var defs = (team.slotBuckets.def || []).slice();
        var mids = (team.slotBuckets.mid || []).slice();
        var fwds = (team.slotBuckets.fwd || []).slice();
        var combined = [].concat(defs, mids, fwds);
        if (extraGKs.length > 0) {
            combined = combined.concat(extraGKs);
        }
        var teamData = {
            color: team.color,
            players: combined,
            gk: team.slotBuckets.gk || null
        };
        
        // Buat 8 slot array
        var slotsArr = new Array(8).fill(null);
        if (teamData.gk) slotsArr[0] = teamData.gk;
        
        // Fill defs ke slot 1..2
        slotsArr[1] = defs.length > 0 ? defs.shift() : null;
        slotsArr[2] = defs.length > 0 ? defs.shift() : null;
        
        // Fill mids ke slot 3..5 (atau 3..4 untuk 5 tim)
        var midSlots = teamCount === 5 ? 2 : 3;
        var midIndex = 3;
        for (var m = 0; m < midSlots && m < mids.length; m++) {
            slotsArr[midIndex + m] = mids[m];
        }
        // Sisa mid yang tidak muat di slot
        var remainingMids = mids.slice(midSlots);
        
        // Fill fwds ke slot 6..7
        var fwdSlots = 2;
        var fwdIndex = teamCount === 5 ? 5 : 6;
        for (var f = 0; f < fwdSlots && f < fwds.length; f++) {
            slotsArr[fwdIndex + f] = fwds[f];
        }
        var remainingFwds = fwds.slice(fwdSlots);
        
        // Sisa pemain dimasukkan ke players array
        var remainingPlayers = [].concat(remainingMids, remainingFwds);
        teamData.players = slotsArr.slice(1).filter(function(s) { return s && s.toString().trim(); });
        // Tambahkan remaining players ke players jika ada slot kosong
        var emptySlots = [];
        for (var s = 1; s < 8; s++) {
            if (!slotsArr[s]) emptySlots.push(s);
        }
        for (var r = 0; r < remainingPlayers.length && r < emptySlots.length; r++) {
            slotsArr[emptySlots[r]] = remainingPlayers[r];
            teamData.players.push(remainingPlayers[r]);
        }
        
        teamData.slots = slotsArr;
        return teamData;
    });

    // Pengocokan otomatis tidak boleh lolos jika Top 8/Top 4 menumpuk di satu tim.
    if (markCaptains === false && rankingSeedNames.length > 0) {
        var expectedPerTeam = rankingSeedPerTeam;
        var distributionValid = finalTeams.every(function(team) {
            var teamNamesList = (team.slots || []).filter(function(name) { return !!name; });
            var seedCount = teamNamesList.filter(function(name) { return rankingSeedNames.includes(name); }).length;
            return seedCount === expectedPerTeam;
        });
        if (!distributionValid) {
            throw new Error('Validasi pembagian pemain unggulan gagal. Hasil kocokan dibatalkan.');
        }
    }

    // Gabungkan semua pemain untuk ditampilkan
    var seededGk = seeds.filter(function(s) { return playerPositions[s.player] === 'gk'; }).map(function(s) { return s.player; });
    var seededDef = seeds.filter(function(s) { return playerPositions[s.player] === 'def'; }).map(function(s) { return s.player; });
    var seededMid = seeds.filter(function(s) { return playerPositions[s.player] === 'mid'; }).map(function(s) { return s.player; });
    var seededFwd = seeds.filter(function(s) { return playerPositions[s.player] === 'fwd'; }).map(function(s) { return s.player; });

    var fullGk = seededGk.concat(shuffledGk);
    var fullDef = seededDef.concat(shuffledDef);
    var fullMid = seededMid.concat(shuffledMid);
    var fullFwd = seededFwd.concat(shuffledFwd);

    var captains = markCaptains === false ? [] : seeds.map(function(s) { return s.player; });

    shuffleResult = {
        gk: fullGk,
        def: fullDef,
        mid: fullMid,
        fwd: fullFwd,
        teams: finalTeams,
        captains: captains,
        allPlayers: players.map(function(p) { return p.name; })
    };

    renderShuffleResult(shuffleResult);
    var animation = document.getElementById('shuffleAnimation');
    if (animation) animation.style.display = 'none';
    document.getElementById('shuffle-result').style.display = 'block';
    document.getElementById('shuffle-process').style.display = 'none';
}

function buildSlotsFromTeam(team) {
    var slots = new Array(8).fill(null);
    if (!team) return slots;

    if (team.gk) {
        slots[0] = team.gk;
    }

    var composition = getTeamComposition(getSelectedTeamCount());
    var defPlayers = [];
    var midPlayers = [];
    var fwdPlayers = [];
    var otherPlayers = [];

    (team.players || []).forEach(function(player) {
        var pos = playerPositions[player];
        if (pos === 'def') {
            defPlayers.push(player);
        } else if (pos === 'mid') {
            midPlayers.push(player);
        } else if (pos === 'fwd') {
            fwdPlayers.push(player);
        } else {
            otherPlayers.push(player);
        }
    });

    function nextFrom(list) {
        return list.length ? list.shift() : (otherPlayers.length ? otherPlayers.shift() : null);
    }

    slots[1] = nextFrom(defPlayers);
    slots[2] = nextFrom(defPlayers);

    var slotIndex = 3;
    for (var i = 0; i < composition.mid; i++) {
        slots[slotIndex++] = nextFrom(midPlayers);
    }

    for (var i = 0; i < composition.fwd; i++) {
        slots[slotIndex++] = nextFrom(fwdPlayers);
    }

    return slots;
}

// Update bagian confirmShuffle di shuffle.js

function confirmShuffle() {
    if (!shuffleResult) {
        alert('Tidak ada hasil kocokan!');
        return;
    }
    
    if (!confirm('Konfirmasi hasil kocokan tim? Data akan disimpan ke pertandingan tanggal ' + shuffleDate + '.')) {
        return;
    }
    
    showLoading();
    
    var date = shuffleDate;
    var teamCount = getSelectedTeamCount();
    
    var teams = shuffleResult.teams.map(function(team) {
        return {
            color: team.color,
            players: team.players.slice(),
            gk: team.gk,
            slots: team.slots && Array.isArray(team.slots) && team.slots.length === 8 ? team.slots.slice() : buildSlotsFromTeam(team),
            wins: 0,
            draws: 0,
            losses: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            champion: false
        };
    });
    
    var matchDataResult = {
        date: date,
        teamCount: teamCount,
        teams: teams,
        cancelOnDay: [],
        captains: shuffleResult.captains || [],
        matches: getDefaultMatches(teamCount).map(function(m) { 
            return { 
                team1: m.team1, 
                team2: m.team2, 
                score1: null, 
                score2: null, 
                note: '' 
            }; 
        })
    };
    
    callAPI('saveMatchDateData', {
        date: date,
        weekData: JSON.stringify(matchDataResult)
    })
    .then(function(saveResult) {
        hideLoading();
        
        if (saveResult.success) {
            alert('✅ Kocokan tim berhasil disimpan!');
            
            matchData = matchDataResult;
            currentMatchDate = date;
            
            document.getElementById('match-date').value = date;
            
            renderMatchData();
            document.getElementById('match-content').style.display = 'block';
            
            document.getElementById('shuffle-result').style.display = 'none';
            document.getElementById('shuffle-process').style.display = 'none';
            document.getElementById('shuffle-player-list').style.display = 'none';
            
            // Update daftar tanggal dan indikator kalender
            if (typeof loadMatchDatesList === 'function') {
                loadMatchDatesList().then(function() {
                    if (typeof updateMatchDateIndicator === 'function') {
                        updateMatchDateIndicator();
                    }
                });
            }
            
            switchTab('match');
        } else {
            alert('Gagal menyimpan kocokan tim: ' + (saveResult.error || 'Terjadi kesalahan'));
        }
    })
    .catch(function(error) {
        hideLoading();
        console.error('Error confirming shuffle:', error);
        alert('Terjadi kesalahan saat menyimpan kocokan tim: ' + error.message);
    });
}

function refreshShufflePlayerList() {
    if (document.getElementById('shuffle-player-list').style.display === 'block') {
        renderShuffleTables();
    }
}

function distributePlayersToTeams(playerList, teams, countsPerTeam) {
    var index = 0;
    for (var i = 0; i < teams.length; i++) {
        if (!teams[i].players) teams[i].players = [];
        for (var j = 0; j < countsPerTeam && index < playerList.length; j++) {
            teams[i].players.push(playerList[index++]);
        }
    }
    
    while (index < playerList.length) {
        for (var i = 0; i < teams.length && index < playerList.length; i++) {
            teams[i].players.push(playerList[index++]);
        }
    }
}
