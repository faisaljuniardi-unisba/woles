// ==================== KLASEMEN UTAMA ====================
var leaderboardUpdateInProgress = false;

// Fungsi untuk mendapatkan semua hari Minggu dalam bulan
function getSundaysOfMonth(year, month) {
    var sundays = [];
    var d = new Date(year, month - 1, 1);
    // Advance to first Sunday or keep if first day is Sunday
    while (d.getMonth() === month - 1) {
        if (d.getDay() === 0) { // Sunday
            sundays.push(new Date(d.getTime()));
            d.setDate(d.getDate() + 7);
        } else {
            d.setDate(d.getDate() + 1);
        }
    }
    // If none (edge-case) add first day
    if (sundays.length === 0) sundays.push(new Date(year, month - 1, 1));
    return sundays;
}

// Fungsi untuk mendapatkan jumlah hari Minggu dalam bulan
function getSundaysCount(year, month) {
    var count = 0;
    var d = new Date(year, month - 1, 1);
    while (d.getMonth() === month - 1) {
        if (d.getDay() === 0) { // Sunday
            count++;
        }
        d.setDate(d.getDate() + 1);
    }
    return count;
}

// Fungsi untuk menentukan periode otomatis
function getAutoPeriod() {
    var monthInput = document.getElementById('period-month');
    if (!monthInput) {
        var now = new Date();
        var year = now.getFullYear();
        var month = now.getMonth() + 1;
    } else {
        var value = monthInput.value;
        if (!value) {
            var now = new Date();
            var year = now.getFullYear();
            var month = now.getMonth() + 1;
        } else {
            var parts = value.split('-');
            var year = parseInt(parts[0]);
            var month = parseInt(parts[1]);
        }
    }
    
    var sundays = getSundaysCount(year, month);
    // Jika ada 5 hari Minggu, gunakan 5 minggu, else 4 minggu
    return sundays >= 5 ? '5_weeks' : '4_weeks';
}

// Helper: determine week index (1-based) for a date string relative to array of weekStarts
function getWeekIndex(dateStr, weekStarts) {
    var d = new Date(dateStr);
    var idx = 0;
    for (var i = 0; i < weekStarts.length; i++) {
        var ws = weekStarts[i];
        // compare by time
        if (d.getTime() >= ws.getTime()) {
            idx = i + 1;
        } else {
            break;
        }
    }
    if (idx === 0) idx = 1;
    return Math.min(idx, 5);
}

function updatePeriodButtons() {
    var autoPeriod = getAutoPeriod();
    var buttons = document.querySelectorAll('.period-btn');
    buttons.forEach(function(btn) {
        var period = btn.dataset.period;
        if (period === autoPeriod) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Update periodType
    periodType = autoPeriod;
    
    // Show/hide week 5 column
    var week5Column = document.getElementById('week5-column');
    if (week5Column) {
        week5Column.style.display = periodType === '5_weeks' ? 'table-cell' : 'none';
    }
}

function changePeriod(period) {
    periodType = period;
    
    document.querySelectorAll('.period-btn').forEach(function(btn) {
        if (btn.dataset.period === period) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    var week5Column = document.getElementById('week5-column');
    if (week5Column) {
        week5Column.style.display = period === '5_weeks' ? 'table-cell' : 'none';
    }
    
    updateLeaderboard();
}

// Update fungsi updateLeaderboard
async function updateLeaderboard() {
    if (leaderboardUpdateInProgress) return;
    leaderboardUpdateInProgress = true;
    showLoading();
    try {
        // Set periode otomatis
        updatePeriodButtons();
        
        var datesResult = await callAPI('getMatchDates');
        if (!datesResult.success) {
            throw new Error('Gagal mengambil data tanggal pertandingan');
        }

        allMatchDates = datesResult.dates || [];

        var monthInput = document.getElementById('period-month');
        var targetYear, targetMonth;
        if (monthInput && monthInput.value) {
            var parts = monthInput.value.split('-');
            targetYear = parseInt(parts[0]);
            targetMonth = parseInt(parts[1]);
        } else {
            var now = new Date();
            targetYear = now.getFullYear();
            targetMonth = now.getMonth() + 1;
        }

        var weekStarts = getSundaysOfMonth(targetYear, targetMonth);
        var datesInMonth = (allMatchDates || []).filter(function(dt) {
            var d = new Date(dt);
            return d.getFullYear() === targetYear && (d.getMonth() + 1) === targetMonth;
        }).sort(function(a, b) { return new Date(a) - new Date(b); });

        var playerPoints = {};
        players.forEach(function(player) {
            playerPoints[player.name] = { total: 0, weeks: {} };
        });

        for (var i = 0; i < datesInMonth.length; i++) {
            var date = datesInMonth[i];
            var weekNumRaw = getWeekIndex(date, weekStarts);
            var maxWeeks = periodType === '5_weeks' ? 5 : 4;
            if (weekNumRaw > maxWeeks) continue;
            var weekNum = weekNumRaw;

            var matchResult = await callAPI('getMatchDateData', { date: date });
            if (!matchResult.success) continue;

            var weekData = matchResult.data && typeof matchResult.data === 'object' ? matchResult.data : matchResult;
            var teams = weekData.teams || [];
            var cancelList = weekData.cancelOnDay || [];

            var standings = calculateStandings(teams);
            var manualChampion = (teams || []).find(function(t) { return t && (t.champion === true || t.champion === 1); });
            var championColor = manualChampion ? manualChampion.color : null;

            teams.forEach(function(team) {
                var isChampion = team.color === championColor;
                var teamWins = team.wins || 0;
                var teamDraws = team.draws || 0;

                var teamPlayers = (team.players || []).slice();
                if (team.gk && !teamPlayers.includes(team.gk)) {
                    teamPlayers.push(team.gk);
                }

                teamPlayers.forEach(function(player) {
                    if (!playerPoints[player]) {
                        playerPoints[player] = { total: 0, weeks: {} };
                    }

                    var weeklyPoints = 0;
                    weeklyPoints += 3;
                    weeklyPoints += teamWins * 3;
                    weeklyPoints += teamDraws * 1;
                    if (isChampion) weeklyPoints += 2;

                    playerPoints[player].weeks[weekNum] = (playerPoints[player].weeks[weekNum] || 0) + weeklyPoints;
                    playerPoints[player].total += weeklyPoints;
                });
            });

            (cancelList || []).forEach(function(player) {
                if (!playerPoints[player]) playerPoints[player] = { total: 0, weeks: {} };
                playerPoints[player].weeks[weekNum] = (playerPoints[player].weeks[weekNum] || 0) - 5;
                playerPoints[player].total -= 5;
            });
        }

        var rankingArray = [];
        for (var playerName in playerPoints) {
            var data = playerPoints[playerName];
            if ((data.total || 0) <= 0) continue;
            rankingArray.push({
                playerName: playerName,
                totalPoints: data.total || 0,
                week1: data.weeks[1] || 0,
                week2: data.weeks[2] || 0,
                week3: data.weeks[3] || 0,
                week4: data.weeks[4] || 0,
                week5: data.weeks[5] || 0
            });
        }

        rankingArray.sort(function(a, b) {
            if (b.totalPoints !== a.totalPoints) {
                return b.totalPoints - a.totalPoints;
            }

            var maxWeek = periodType === '5_weeks' ? 5 : 4;
            for (var w = maxWeek - 1; w >= 1; w--) {
                var sumA = (a.week1 || 0) + (w >= 2 ? a.week2 || 0 : 0) + 
                           (w >= 3 ? a.week3 || 0 : 0) + (w >= 4 ? a.week4 || 0 : 0) + 
                           (w >= 5 ? a.week5 || 0 : 0);
                var sumB = (b.week1 || 0) + (w >= 2 ? b.week2 || 0 : 0) + 
                           (w >= 3 ? b.week3 || 0 : 0) + (w >= 4 ? b.week4 || 0 : 0) + 
                           (w >= 5 ? b.week5 || 0 : 0);
                if (sumB !== sumA) {
                    return sumB - sumA;
                }
            }
            return a.playerName.localeCompare(b.playerName);
        });

        leaderboard = rankingArray.map(function(p, i) { 
            return { rank: i + 1, 
                     playerName: p.playerName, 
                     totalPoints: p.totalPoints, 
                     week1: p.week1, 
                     week2: p.week2, 
                     week3: p.week3, 
                     week4: p.week4, 
                     week5: p.week5 }; 
        });
        renderLeaderboard();
        updatePeriodDisplay();
        await saveLeaderboardToDB();
    } catch (error) {
        console.error('Error updating leaderboard:', error);
        showError('Gagal update klasemen: ' + error.message);
    } finally {
        leaderboardUpdateInProgress = false;
        hideLoading();
    }
}

function renderLeaderboard() {
    var tbody = document.getElementById('ranking-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    leaderboard.forEach(function(player, index) {
        var row = document.createElement('tr');

        var rankClass = '';
        if (index === 0) rankClass = 'rank-1';
        else if (index === 1) rankClass = 'rank-2';
        else if (index === 2) rankClass = 'rank-3';

        var playerNameDisplay = index < 3 ? '<strong>' + player.playerName + '</strong>' : player.playerName;
        var week5Cell = periodType === '5_weeks' ? '<td>' + (player.week5 || 0) + '</td>' : '';

        row.innerHTML = 
            '<td><div class="ranking-badge ' + rankClass + '">' + player.rank + '</div></td>' +
            '<td style="' + (index < 3 ? 'font-weight: bold;' : '') + ' ' + 
                (index === 0 ? 'color: #d4af37;' : index === 1 ? 'color: #c0c0c0;' : index === 2 ? 'color: #cd7f32;' : 'color: #2c3e50;') + '">' + 
                playerNameDisplay + '</td>' +
            '<td style="font-weight: bold; font-size: 1.2rem; ' + (index < 3 ? 'color: #1abc9c;' : '') + '">' + 
                player.totalPoints + '</td>' +
            '<td>' + (player.week1 || 0) + '</td>' +
            '<td>' + (player.week2 || 0) + '</td>' +
            '<td>' + (player.week3 || 0) + '</td>' +
            '<td>' + (player.week4 || 0) + '</td>' +
            week5Cell;

        tbody.appendChild(row);
    });
}

function updatePeriodDisplay() {
    var periodDisplay = document.getElementById('period-display');
    var monthInput = document.getElementById('period-month');
    
    var displayText = '';
    
    if (monthInput && monthInput.value) {
        var parts = monthInput.value.split('-');
        var year = parts[0];
        var month = parseInt(parts[1]);
        var monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
                          'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        displayText = monthNames[month - 1] + ' ' + year;
    }
    
    periodDisplay.textContent = displayText;
}

async function saveLeaderboardToDB() {
    try {
        var topPlayers = leaderboard.slice(0, 32);
        
        var leaderboardData = topPlayers.map(function(player) {
            return {
                playerName: player.playerName,
                totalPoints: player.totalPoints,
                week1: player.week1 || 0,
                week2: player.week2 || 0,
                week3: player.week3 || 0,
                week4: player.week4 || 0,
                week5: player.week5 || 0
            };
        });
        
        await callAPI('updateLeaderboard', {
            periodType: periodType,
            leaderboardData: JSON.stringify(leaderboardData)
        });
        
    } catch (error) {
        console.warn('Gagal menyimpan leaderboard ke database:', error);
    }
}

// ==================== EXPORT FUNCTIONS ====================

// Fungsi untuk download ranking table dengan logo
function downloadRankingTable() {
    var element = document.getElementById('ranking-container');
    if (!element) {
        alert('Tabel klasemen tidak ditemukan.');
        return;
    }
    var periodText = periodType === '4_weeks' ? '4-Minggu' : '5-Minggu';
    var weekCount = periodType === '5_weeks' ? 5 : 4;
    // Tambahan satu minggu membutuhkan ruang ekstra agar kolom terakhir tidak
    // terpotong oleh html2canvas.
    // Gunakan kanvas yang sama untuk periode 4 dan 5 minggu agar proporsi,
    // ukuran teks, serta jarak antarkolom tetap konsisten.
    var exportWidth = 1120;
    var monthInput = document.getElementById('period-month');
    var monthLabel = '';
    if (monthInput && monthInput.value) {
        var parts = monthInput.value.split('-');
        var monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
                          'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
        monthLabel = monthNames[parseInt(parts[1]) - 1] + ' ' + parts[0];
    }
    
    // Buat container untuk export dengan logo
    var exportContainer = document.createElement('div');
    exportContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: ${exportWidth}px;
        background: white;
        padding: 40px;
        border-radius: 20px;
        box-shadow: 0 0 60px rgba(0,0,0,0.4);
        z-index: 10000;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        transform: translate(-100%, -100%);
    `;
    
    // Clone ranking table
    var clone = element.cloneNode(true);
    
    // Tambahkan header dengan logo
    var header = document.createElement('div');
    header.style.cssText = 'text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #1abc9c;';
    header.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 20px; margin-bottom: 10px;">
            <img src="img/logo.png" alt="Woles FC" style="width: 80px; height: 80px;">
            <div>
                <h1 style="margin: 0; color: #2c3e50; font-size: 32px;">WOLES FC</h1>
                <p style="margin: 0; color: #666; font-size: 18px;">Player Of The Month</p>
            </div>
        </div>
        <p style="margin: 10px 0 0 0; color: #1abc9c; font-weight: bold; font-size: 16px;">
            Klasemen ${monthLabel}
        </p>
    `;
    
    // Hapus period selector dari clone
    var periodSelector = clone.querySelector('.period-selector');
    if (periodSelector) periodSelector.remove();
    
    clone.style.width = '100%';
    clone.style.maxWidth = 'none';
    clone.style.boxSizing = 'border-box';

    var clonedTable = clone.querySelector('table');
    if (clonedTable) {
        clonedTable.style.width = '100%';
        clonedTable.style.tableLayout = 'fixed';
        var clonedRows = clonedTable.querySelectorAll('tbody tr');
        Array.from(clonedRows).slice(24).forEach(function(row) { row.remove(); });
    }

    var clonedTitle = clone.querySelector('h2');
    if (clonedTitle) clonedTitle.childNodes[0].nodeValue = 'Top 24 Klasemen Player Of The Month ';

    // Reward ikut disertakan dan dirapikan agar stabil pada hasil gambar.
    var rewardSection = clone.querySelector('.reward-section');
    if (rewardSection) {
        rewardSection.style.display = 'block';
        rewardSection.style.marginTop = '28px';
        var rewardGrid = rewardSection.querySelector('.reward-grid');
        if (rewardGrid) {
            rewardGrid.style.display = 'grid';
            rewardGrid.style.gridTemplateColumns = 'repeat(4, 1fr)';
            rewardGrid.style.gap = '12px';
        }
    }
    
    // Sembunyikan tombol export di clone
    var exportButtons = clone.querySelector('.export-buttons');
    if (exportButtons) exportButtons.style.display = 'none';
    
    // Tambahkan header ke container
    exportContainer.appendChild(header);
    exportContainer.appendChild(clone);
    
    // Tambahkan footer
    var footer = document.createElement('div');
    footer.style.cssText = 'text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #eee; color: #999; font-size: 12px;';
    footer.textContent = 'Woles FC © Fjun21 | Dicetak: ' + new Date().toLocaleDateString('id-ID');
    exportContainer.appendChild(footer);
    
    document.body.appendChild(exportContainer);
    
    html2canvas(exportContainer, {
        scale: 2.5,
        width: exportWidth,
        windowWidth: exportWidth,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: function(clonedDoc) {
            var clonedElement = clonedDoc.querySelector('[style*="z-index: 10000"]');
            if (clonedElement) {
                clonedElement.style.transform = 'translate(0, 0)';
            }
        }
    }).then(function(canvas) {
        var link = document.createElement('a');
        link.download = 'Top-24-Klasemen-POTM-' + monthLabel + '-' + periodText + '.jpg';
        link.href = canvas.toDataURL('image/jpeg', 0.95);
        link.click();
        document.body.removeChild(exportContainer);
    }).catch(function(error) {
        console.error('Export error:', error);
        alert('Gagal mengexport klasemen: ' + error.message);
        document.body.removeChild(exportContainer);
    });
}

