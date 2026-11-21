// ==================== EXPORT FUNCTIONS ====================

// ==================== NORMALIZE TEAM SLOTS ====================
function normalizeTeamSlots(team, cancelPlayers) {
    var slotCount = matchData && matchData.teamCount === 5 ? 7 : 8;
    var slots = new Array(slotCount).fill(null);
    if (!team) return slots;

    if (team.slots && Array.isArray(team.slots) && team.slots.length >= slotCount) {
        slots = team.slots.slice(0, slotCount);
    } else {
        if (team.gk && (!cancelPlayers || !cancelPlayers.includes(team.gk))) {
            slots[0] = team.gk;
        }
        var nonGkPlayers = (team.players || []).filter(function(p) {
            return p !== team.gk && (!cancelPlayers || !cancelPlayers.includes(p));
        });
        for (var i = 1; i < slotCount; i++) {
            slots[i] = nonGkPlayers.length ? nonGkPlayers.shift() : null;
        }
    }

    if (cancelPlayers && cancelPlayers.length) {
        for (var j = 0; j < slots.length; j++) {
            if (slots[j] && cancelPlayers.includes(slots[j])) {
                slots[j] = null;
            }
        }
    }

    return slots;
}

function getExportTeamCount() {
    return matchData && matchData.teamCount === 5 ? 5 : 4;
}

function getExportSlotCount() {
    return getExportTeamCount() === 5 ? 7 : 8;
}

function getDefaultMatchesForExport(teamCount) {
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

// ==================== DOWNLOAD COMBINED (Jadwal & Klasemen) ====================
function downloadCombined() {
    console.log('downloadCombined called');
    try {
        if (!matchData) {
            alert('Tidak ada data pertandingan untuk di-export!');
            return;
        }
    } catch (e) {
        console.error('downloadCombined runtime error', e);
        alert('Terjadi kesalahan saat memulai export: ' + (e && e.message ? e.message : e));
        return;
    }
    
    var teamCount = getExportTeamCount();
    var defaultMatches = getDefaultMatchesForExport(teamCount);
    
    // Pastikan matchData.matches memiliki semua pertandingan sesuai jumlah tim
    if (!matchData.matches || matchData.matches.length !== defaultMatches.length) {
        matchData.matches = defaultMatches.map(function(m) {
            var existing = (matchData.matches || []).find(function(ex) {
                return ex.team1 === m.team1 && ex.team2 === m.team2;
            });
            return existing ? {
                team1: existing.team1,
                team2: existing.team2,
                score1: existing.score1 !== undefined ? existing.score1 : null,
                score2: existing.score2 !== undefined ? existing.score2 : null,
                note: existing.note || ''
            } : {
                team1: m.team1,
                team2: m.team2,
                score1: null,
                score2: null,
                note: ''
            };
        });
    }
    
    var date = new Date(matchData.date);
    var dateStr = date.toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    // Buat container dengan dimensi dinamis dan desain lebih baik
    var exportContainer = document.createElement('div');
    exportContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 1320px;
        background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
        padding: 45px 50px 35px 50px;
        border-radius: 30px;
        box-shadow: 0 30px 80px rgba(0,0,0,0.35);
        z-index: 10000;
        font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
        transform: translate(-100%, -100%);
        border: 1px solid rgba(0,0,0,0.06);
        box-sizing: border-box;
    `;

    var exportContent = document.createElement('div');
    exportContent.style.cssText = `
        width: 100%;
        padding: 0;
        box-sizing: border-box;
    `;

    exportContainer.appendChild(exportContent);

    // ============ FUNGSI UNTUK MENDAPATKAN WARNA TIM DENGAN OUTLINE UNTUK PUTIH ============
    function getTeamColorStyle(teamColor, isBackground) {
        if (teamColor === 'putih') {
            if (isBackground) {
                return '#f5f5f5';
            }
            return '#333333';
        }
        return 'var(--' + teamColor + ')';
    }
    
    function getTeamBorderStyle(teamColor) {
        if (teamColor === 'putih') {
            return '2px solid #333333';
        }
        return '2px solid rgba(255,255,255,0.8)';
    }
    
    function getTeamTextColor(teamColor) {
        if (teamColor === 'putih') {
            return '#1a1a1a';
        }
        return '#1a2332';
    }

    // ============ MATCHES HTML ============
    var matchesHtml = '';
    matchData.matches.forEach(function(match, index) {
        var team1Name = teamNames[match.team1] || match.team1;
        var team2Name = teamNames[match.team2] || match.team2;
        var score1 = match.score1 !== null && match.score1 !== undefined ? match.score1 : '-';
        var score2 = match.score2 !== null && match.score2 !== undefined ? match.score2 : '-';
        var isFinished = (score1 !== '-' && score2 !== '-');
        var matchStatus = isFinished ? 'SELESAI' : 'BELUM DIMULAI';
        
        var team1Color = match.team1;
        var team2Color = match.team2;
        var team1Bg = getTeamColorStyle(team1Color, true);
        var team2Bg = getTeamColorStyle(team2Color, true);
        var team1Border = getTeamBorderStyle(team1Color);
        var team2Border = getTeamBorderStyle(team2Color);
        var team1Text = getTeamTextColor(team1Color);
        var team2Text = getTeamTextColor(team2Color);
        
        matchesHtml += `
            <div style="
                background: ${isFinished ? 'linear-gradient(135deg, #ffffff, #f0f7ff)' : 'linear-gradient(135deg, #ffffff, #fffbf0)'};
                border-radius: 14px;
                padding: 18px 24px;
                margin-bottom: 12px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.04);
                border: 1px solid ${isFinished ? '#e8f0fe' : '#f5ede0'};
                display: grid;
                grid-template-columns: minmax(120px, 1fr) auto minmax(120px, 1fr);
                column-gap: 16px;
                align-items: center;
                justify-content: space-between;
                transition: all 0.2s;
            ">
                <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
                    <div style="
                        width: 18px; 
                        height: 18px; 
                        border-radius: 50%; 
                        background-color: ${team1Bg};
                        border: ${team1Border};
                        box-shadow: 0 2px 6px rgba(0,0,0,0.12);
                        flex-shrink: 0;
                    "></div>
                    <span style="font-weight: 600; font-size: 15px; line-height: 1.2; white-space: nowrap; color: ${team1Text};">${team1Name}</span>
                </div>
                
                <div style="
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    justify-content: center;
                ">
                    <div style="
                        font-weight: 700; 
                        font-size: 20px; 
                        color: ${isFinished ? '#1a2332' : '#c07a2b'};
                        background: ${isFinished ? 'linear-gradient(135deg, #f1f5f9, #e8edf5)' : 'linear-gradient(135deg, #fef7ed, #fdf0de)'};
                        padding: 6px 10px;
                        border-radius: 10px;
                        border: 1px solid ${isFinished ? '#dce3ed' : '#f0dcc0'};
                        letter-spacing: 2px;
                        min-width: 92px;
                        text-align: center;
                        white-space: nowrap;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        gap: 6px;
                    ">
                        ${score1} <span style="color: #8a9bb5; font-weight: 300; margin: 0 4px;">:</span> ${score2}
                    </div>
                </div>
                
                <div style="display: flex; align-items: center; gap: 8px; min-width: 0; justify-content: flex-end;">
                    <span style="font-weight: 600; font-size: 15px; line-height: 1.2; white-space: nowrap; color: ${team2Text};">${team2Name}</span>
                    <div style="
                        width: 18px; 
                        height: 18px; 
                        border-radius: 50%; 
                        background-color: ${team2Bg};
                        border: ${team2Border};
                        box-shadow: 0 2px 6px rgba(0,0,0,0.12);
                        flex-shrink: 0;
                    "></div>
                </div>
                
                <div style="
                    grid-column: 1 / -1;
                    justify-self: center;
                    margin-top: 10px;
                    padding: 4px 14px;
                    background: ${isFinished ? 'linear-gradient(135deg, #27ae60, #219a52)' : 'linear-gradient(135deg, #e67e22, #d35400)'};
                    color: white;
                    border-radius: 20px;
                    font-weight: 600;
                    font-size: 10px;
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                    flex-shrink: 0;
                    box-shadow: 0 2px 8px ${isFinished ? 'rgba(39,174,96,0.25)' : 'rgba(230,126,34,0.25)'};
                ">
                    ${matchStatus}
                </div>
            </div>
        `;
    });
    
    // ============ STANDINGS HTML ============
    var standings = calculateStandings(matchData.teams);
    var standingsHtml = '';
    standings.forEach(function(team, index) {
        var rankColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
        var rankColor = index < 3 ? rankColors[index] : '#6b7a8f';
        var isTop3 = index < 3;
        var isChampion = index === 0;
        var isWhite = team.color === 'putih';
        
        // Badge peringkat
        var rankBadge = '';
        if (index === 0) {
            rankBadge = '<span style="font-size:20px;">👑</span>';
        } else if (index === 1) {
            rankBadge = '<span style="font-size:18px;">🥈</span>';
        } else if (index === 2) {
            rankBadge = '<span style="font-size:18px;">🥉</span>';
        } else {
            rankBadge = '<span style="font-weight:700;color:#6b7a8f;font-size:14px;">#' + (index + 1) + '</span>';
        }
        
        var rowBg = isTop3 ? 
            (index === 0 ? 'linear-gradient(135deg, #fffef0, #fdf8e0)' : 
             index === 1 ? 'linear-gradient(135deg, #f8f9fc, #f0f2f6)' : 
             'linear-gradient(135deg, #fbf6f0, #f5ede6)') : 
            (index % 2 === 0 ? '#fafcff' : '#ffffff');
        
        var borderLeftColor = team.color;
        var teamBg = getTeamColorStyle(team.color, true);
        var teamBorder = getTeamBorderStyle(team.color);
        var teamText = getTeamTextColor(team.color);
        
        standingsHtml += `
            <tr style="
                background: ${rowBg};
                border-bottom: 1px solid ${index === standings.length - 1 ? 'transparent' : '#edf2f7'};
                transition: all 0.2s;
            ">
                <td style="
                    padding: 14px 10px 14px 16px;
                    text-align: center;
                    font-weight: bold;
                    font-size: 16px;
                    color: ${rankColor};
                    width: 50px;
                ">
                    ${rankBadge}
                </td>
                <td style="
                    padding: 14px 12px;
                    text-align: left;
                    font-size: 15px;
                    border-left: 4px solid ${isWhite ? '#333333' : 'var(--' + borderLeftColor + ')'};
                    font-weight: ${isTop3 ? '700' : '600'};
                ">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="
                            width: 22px; 
                            height: 22px; 
                            border-radius: 50%; 
                            background-color: ${teamBg};
                            border: ${teamBorder};
                            box-shadow: 0 2px 6px rgba(0,0,0,0.10);
                            flex-shrink: 0;
                        "></div>
                        <span style="color: ${teamText};">${teamNames[team.color]}</span>
                    </div>
                </td>
                <td style="padding: 14px 8px; text-align: center; font-weight: 600; font-size: 14px; color: #2c3e50;">${team.played}</td>
                <td style="padding: 14px 8px; text-align: center; font-weight: 600; font-size: 14px; color: #27ae60;">${team.wins}</td>
                <td style="padding: 14px 8px; text-align: center; font-weight: 600; font-size: 14px; color: #f39c12;">${team.draws}</td>
                <td style="padding: 14px 8px; text-align: center; font-weight: 600; font-size: 14px; color: #e74c3c;">${team.losses}</td>
                <td style="padding: 14px 8px; text-align: center; font-weight: 600; font-size: 14px; color: #2c3e50;">${team.goalsFor}</td>
                <td style="padding: 14px 8px; text-align: center; font-weight: 600; font-size: 14px; color: #2c3e50;">${team.goalsAgainst}</td>
                <td style="
                    padding: 14px 8px; 
                    text-align: center; 
                    font-weight: 700; 
                    font-size: 14px; 
                    color: ${team.goalDifference >= 0 ? '#27ae60' : '#e74c3c'};
                ">
                    ${team.goalDifference > 0 ? '+' : ''}${team.goalDifference}
                </td>
                <td style="
                    padding: 14px 16px; 
                    text-align: center; 
                    font-weight: 800; 
                    font-size: 22px; 
                    color: ${isTop3 ? '#1abc9c' : '#2c3e50'};
                    background: ${isTop3 ? 'linear-gradient(135deg, rgba(26,188,156,0.08), rgba(26,188,156,0.02))' : 'transparent'};
                    border-radius: 10px;
                    border: ${isTop3 ? '2px solid rgba(26,188,156,0.15)' : 'none'};
                    min-width: 55px;
                ">
                    ${team.points}
                </td>
            </tr>
        `;
    });
    
    // ============ CREATE PAGE HTML ============
    var createPageHtml = function(pageType) {
        var headerHtml = `
            <div style="
                display: flex;
                flex-direction: column;
                align-items: center;
                margin-bottom: 28px;
                padding-bottom: 20px;
                border-bottom: 3px solid #eef2f7;
            ">
                <div style="display: flex; align-items: center; gap: 18px; margin-bottom: 8px;">
                    <div style="
                        width: 75px;
                        height: 75px;
                        background: linear-gradient(135deg, #f8fafc, #ffffff);
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border: 3px solid #e8edf5;
                        box-shadow: 0 4px 16px rgba(0,0,0,0.06);
                    ">
                        <img src="img/logo.png" alt="WOLES FC" style="width: 55px; height: 55px; object-fit: contain;">
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 30px; font-weight: 900; color: #0a1628; letter-spacing: 2px; text-transform: uppercase;">WOLES FC</div>
                        <div style="font-size: 14px; color: #7a8a9e; font-weight: 500; letter-spacing: 3px; text-transform: uppercase;">PERTANDINGAN MINGGU INI</div>
                    </div>
                </div>
                <div style="
                    margin-top: 4px;
                    padding: 6px 24px;
                    background: linear-gradient(135deg, #eef2f7, #e4eaf1);
                    border-radius: 30px;
                    font-size: 13px;
                    color: #4a5a6e;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                ">
                    ${dateStr}
                </div>
            </div>
        `;

        var scheduleSection = `
                ${headerHtml}
                <div style="margin-bottom: 6px;">
                    <div style="
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        padding: 10px 20px;
                        background: linear-gradient(135deg, #f1f5f9, #e8eef5);
                        border-radius: 12px;
                        border-left: 4px solid #e74c3c;
                    ">
                        <span style="font-size: 18px;">📋</span>
                        <span style="font-weight: 700; font-size: 16px; color: #1a2332;">HASIL PERTANDINGAN</span>
                        <span style="margin-left: auto; font-size: 12px; color: #7a8a9e; font-weight: 500;">${matchData.matches.length} Pertandingan</span>
                    </div>
                </div>
                <div style="padding: 14px 0 26px 0; display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:18px;">
                    ${matchesHtml}
                </div>
            `;

        return `
            ${scheduleSection}
            <div style="margin-bottom: 6px;">
                <div style="
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 10px 20px;
                    background: linear-gradient(135deg, #f1f5f9, #e8eef5);
                    border-radius: 12px;
                    border-left: 4px solid #3498db;
                ">
                    <span style="font-size: 18px;">📊</span>
                    <span style="font-weight: 700; font-size: 16px; color: #1a2332;">KLASEMEN TIM</span>
                </div>
            </div>
            <div style="
                background: #ffffff;
                border-radius: 16px;
                padding: 6px 4px 4px 4px;
                box-shadow: 0 2px 12px rgba(0,0,0,0.04);
                border: 1px solid #eef2f7;
                margin-top: 4px;
            ">
                <div style="overflow-x: auto; padding: 4px;">
                    <table style="
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 13px;
                        border-radius: 12px;
                        overflow: hidden;
                    ">
                        <thead>
                            <tr style="
                                background: linear-gradient(135deg, #0f1a2e, #1a2a45);
                                color: #ffffff;
                            ">
                                <th style="padding: 14px 10px 14px 16px; text-align: center; font-weight: 700; font-size: 13px; letter-spacing: 0.5px;">#</th>
                                <th style="padding: 14px 12px; text-align: left; font-weight: 700; font-size: 13px; letter-spacing: 0.5px;">TIM</th>
                                <th style="padding: 14px 8px; text-align: center; font-weight: 700; font-size: 13px; letter-spacing: 0.5px;">P</th>
                                <th style="padding: 14px 8px; text-align: center; font-weight: 700; font-size: 13px; letter-spacing: 0.5px;">M</th>
                                <th style="padding: 14px 8px; text-align: center; font-weight: 700; font-size: 13px; letter-spacing: 0.5px;">S</th>
                                <th style="padding: 14px 8px; text-align: center; font-weight: 700; font-size: 13px; letter-spacing: 0.5px;">K</th>
                                <th style="padding: 14px 8px; text-align: center; font-weight: 700; font-size: 13px; letter-spacing: 0.5px;">GF</th>
                                <th style="padding: 14px 8px; text-align: center; font-weight: 700; font-size: 13px; letter-spacing: 0.5px;">GA</th>
                                <th style="padding: 14px 8px; text-align: center; font-weight: 700; font-size: 13px; letter-spacing: 0.5px;">GD</th>
                                <th style="padding: 14px 16px; text-align: center; font-weight: 700; font-size: 13px; letter-spacing: 0.5px;">PTS</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${standingsHtml}
                        </tbody>
                    </table>
                </div>
            </div>
            <div style="
                margin-top: 16px;
                padding: 10px 20px;
                background: linear-gradient(135deg, #f8fafc, #f1f4f8);
                border-radius: 10px;
                display: flex;
                justify-content: space-between;
                font-size: 11px;
                color: #8a9aae;
                border: 1px solid #eef2f7;
            ">
                <span>🏆 Woles FC - Player Of The Month</span>
                <span>Dicetak: ${new Date().toLocaleString('id-ID')}</span>
            </div>
        `;
    };

    var renderPage = function(pageType, fileName) {
        exportContent.innerHTML = createPageHtml(pageType);
        
        return new Promise(function(resolve) {
            setTimeout(function() {
                var contentHeight = exportContent.scrollHeight + 50;
                var width = 1320;
                
                exportContainer.style.height = contentHeight + 'px';
                
                html2canvas(exportContainer, {
                    scale: 2.8,
                    width: width,
                    height: contentHeight,
                    useCORS: true,
                    backgroundColor: '#f8fafc',
                    logging: false,
                    onclone: function(clonedDoc) {
                        var clonedElement = clonedDoc.querySelector('[style*="z-index: 10000"]');
                        if (clonedElement) {
                            clonedElement.style.transform = 'translate(0, 0)';
                        }
                    }
                }).then(function(canvas) {
                    var link = document.createElement('a');
                    link.download = fileName;
                    link.href = canvas.toDataURL('image/jpeg', 0.95);
                    link.click();
                    resolve();
                }).catch(function(error) {
                    console.error('Export error:', error);
                    resolve();
                });
            }, 150);
        });
    };

    document.body.appendChild(exportContainer);

    renderPage('combined', 'Jadwal-dan-Klasemen-' + matchData.date + '.jpg')
        .then(function() {
            if (document.body.contains(exportContainer)) {
                document.body.removeChild(exportContainer);
            }
        })
        .catch(function(error) {
            console.error('Export error:', error);
            alert('Gagal mengexport gambar: ' + error.message);
            if (document.body.contains(exportContainer)) {
                document.body.removeChild(exportContainer);
            }
        });
}

// ==================== EXPORT SEMUA TIM (Dengan Logo & Latar Warna Tim) ====================
function exportAllTeamsPreMatch() {
    if (!matchData || !matchData.teams) {
        alert('Data tim belum tersedia!');
        return;
    }

    var teams = matchData.teams.filter(function(t) {
        return (t.players.length + (t.gk ? 1 : 0)) > 0;
    });
    var exportedCount = 0;
    
    teams.forEach(function(team, index) {
        setTimeout(function() {
            exportTeamPreMatch(team.color);
            exportedCount++;
        }, index * 2000);
    });
}

function exportTeamPreMatchClassic(teamColor) {
    if (!matchData) {
        alert('Tidak ada data pertandingan!');
        return;
    }
    
    var team = matchData.teams.find(function(t) { return t.color === teamColor; });
    if (!team) {
        alert('Tim ' + teamNames[teamColor] + ' tidak ditemukan!');
        return;
    }

    var cancelPlayers = matchData.cancelOnDay || [];
    var teamCount = getExportTeamCount();
    var slotCount = getExportSlotCount();
    var slots = normalizeTeamSlots(team, cancelPlayers);
    
    // LATAR BELAKANG SESUAI WARNA TIM
    var teamBackgrounds = {
        'merah': '#e53935',
        'kuning': '#ffd42a',
        'hijau': '#2e9b45',
        'biru': '#2864a8',
        'putih': '#eeeeee'
    };
    
    var teamBorderColors = {
        'merah': '#cc0000',
        'kuning': '#d4a800',
        'hijau': '#1a5a1a',
        'biru': '#0f2a5a',
        'putih': '#333333'
    };
    
    var teamTextColors = {
        'merah': '#ffffff',
        'kuning': '#1a1a1a',
        'hijau': '#ffffff',
        'biru': '#ffffff',
        'putih': '#1a1a1a'
    };
    
    // Warna solid lebih stabil daripada gradient besar ketika diraster oleh
    // html2canvas dan mencegah garis sambungan antar-tile.
    var outerBackground = teamBackgrounds[teamColor] || '#36a852';
    var borderColor = teamBorderColors[teamColor] || '#2c3e50';
    var textColor = teamTextColors[teamColor] || '#ffffff';
    var isWhite = teamColor === 'putih';
    var usesDarkText = isWhite || teamColor === 'kuning';
    
    var exportContainer = document.createElement('div');
    exportContainer.style.cssText = `
        position: absolute;
        top: 0;
        left: -12000px;
        width: 1080px;
        height: 1920px;
        background: ${outerBackground};
        padding: 40px;
        border-radius: 60px;
        box-shadow: 0 0 80px rgba(0,0,0,0.45);
        z-index: 10000;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        transform: none;
        overflow: hidden;
        border: 8px solid ${borderColor};
        box-sizing: border-box;
    `;
    
    var date = new Date(matchData.date);
    var dayName = date.toLocaleDateString('id-ID', { weekday: 'long' });
    var dateFull = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    var dateLabel = dayName.toUpperCase() + ', ' + dateFull.toUpperCase();
    var teamDisplayName = (teamNames[teamColor] || teamColor).toUpperCase();
    
    var createPlayerCard = function(player, isGK, positionNumber) {
        var playerData = players.find(function(p) { return p.name === player; });
        var hasPhoto = playerData && playerData.photo;
        var photoUrl = hasPhoto ? 'uploads/player_photos/' + playerData.photo : null;
        
        var bgGradient = isGK ? 
            'linear-gradient(135deg, #9b59b6, #8e44ad)' : 
            (isWhite ? 'linear-gradient(135deg, #666666, #444444)' : 'linear-gradient(135deg, var(--' + teamColor + '), #2c3e50)');
        
        return `
            <div style="
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 14px;
                margin: 0 16px;
            ">
                <div style="
                    width: 150px;
                    height: 150px;
                    ${hasPhoto ? '' : 'background: ' + bgGradient + ';'}
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    color: white;
                    font-size: ${hasPhoto ? '0' : '26px'};
                    box-shadow: 0 20px 55px rgba(0,0,0,0.35);
                    border: 6px solid rgba(255,255,255,0.90);
                    position: relative;
                    overflow: hidden;
                ">
                    ${hasPhoto ? 
                        '<img src="' + photoUrl + '" style="width:100%; height:100%; object-fit:cover;" alt="' + player + '" onerror="this.onerror=null; this.parentNode.style.background=\'' + bgGradient + '\'; this.parentNode.innerHTML=\'<span style=\\"font-size: 26px; color: white;\\">' + positionNumber + '</span>\';">' : 
                        '<span style="color: white; text-shadow: 2px 2px 6px rgba(0,0,0,0.4);">' + positionNumber + '</span>'
                    }
                </div>
                <div style="
                    text-align: center;
                    max-width: 180px;
                ">
                    <div style="
                        font-weight: 900;
                        font-size: 18px;
                        color: ${isWhite ? '#1a1a1a' : '#111111'};
                        text-transform: uppercase;
                        word-wrap: break-word;
                        line-height: 1.2;
                        background: ${isWhite ? 'rgba(255,255,255,0.95)' : '#ffffff'};
                        padding: 10px 14px;
                        border-radius: 14px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.18);
                    ">
                        ${player}
                    </div>
                </div>
            </div>
        `;
    };
    
    var createEmptyPlaceholder = function(positionNumber) {
        var bgColor = usesDarkText ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.20)';
        var borderColorPlaceholder = usesDarkText ? 'rgba(0,0,0,0.30)' : 'rgba(255,255,255,0.55)';
        var textColorPlaceholder = usesDarkText ? '#333333' : '#e9f7ef';
        var labelColor = usesDarkText ? 'rgba(0,0,0,0.72)' : 'rgba(255,255,255,0.85)';
        var labelBg = usesDarkText ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.22)';
        
        return `
            <div style="
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 14px;
                margin: 0 16px;
            ">
                <div style="
                    width: 150px;
                    height: 150px;
                    background: ${bgColor};
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    color: ${textColorPlaceholder};
                    font-size: 26px;
                    box-shadow: 0 18px 35px rgba(0,0,0,0.10);
                    border: 4px dashed ${borderColorPlaceholder};
                ">
                    <span style="color: ${textColorPlaceholder};">${positionNumber}</span>
                </div>
                <div style="
                    text-align: center;
                    max-width: 140px;
                ">
                    <div style="
                        font-weight: 900;
                        font-size: 14px;
                        color: ${labelColor};
                        word-wrap: break-word;
                        line-height: 1.2;
                        background: ${labelBg};
                        padding: 8px 12px;
                        border-radius: 12px;
                        border: 1px dashed ${borderColorPlaceholder};
                    ">
                        KOSONG
                    </div>
                </div>
            </div>
        `;
    };
    
    var exportContent = document.createElement('div');
    exportContent.style.cssText = `
        width: 100%;
        min-height: 100%;
        box-sizing: border-box;
        overflow: hidden;
        transform-origin: top center;
    `;
    
    var watermarkColor = isWhite ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.18)';
    var subTextColor = usesDarkText ? '#222222' : '#d4edda';
    
    exportContent.innerHTML = `
        <div style="position: relative; width: 100%; height: 100%;">
            <div style="position: absolute; left: 42px; top: 48px; width: 930px; opacity: ${isWhite ? '0.10' : '0.14'}; font-size: 158px; font-weight: 900; color: ${isWhite ? '#555555' : '#ffffff'}; line-height: 0.78; text-transform: uppercase; text-align: left; text-shadow: 4px 4px 30px rgba(0,0,0,0.16); letter-spacing: 2px; white-space: nowrap;">
                FUN<br>MATCHDAY
            </div>
        </div>
        <div style="position: relative; z-index: 2;">
            <div style="display: flex; flex-direction: column; align-items: center; gap: 18px; margin-bottom: 40px; position: relative;">
                <img src="img/logo.png" alt="Woles FC" style="width: 130px; height: 130px; object-fit: contain; background: ${isWhite ? 'rgba(255,255,255,0.8)' : 'transparent'}; border-radius: 50%; padding: ${isWhite ? '10px' : '0'};">
                <div style="color: ${textColor}; font-size: 52px; font-weight: 900; letter-spacing: 8px; text-transform: uppercase; text-shadow: 5px 5px 20px rgba(0,0,0,0.3);">WOLES FC</div>
                <div style="color: ${textColor}; font-size: 20px; font-weight: 800; letter-spacing: 6px; text-transform: uppercase; text-shadow: 3px 3px 12px rgba(0,0,0,0.25);">- ${teamDisplayName} -</div>
                <div style="color: ${usesDarkText ? '#172517' : '#f4ffe6'}; font-size: 90px; font-weight: 900; letter-spacing: 6px; text-transform: uppercase; text-shadow: 5px 5px 30px rgba(0,0,0,0.28);">${teamCount === 5 ? 'STARTING 7' : 'STARTING 8'}</div>
                <div style="color: ${usesDarkText ? '#222222' : '#def7d6'}; font-size: 40px; font-weight: 800; letter-spacing: 5px; text-transform: uppercase; text-shadow: 3px 3px 18px rgba(0,0,0,0.22);">${teamCount === 5 ? '2-2-2' : '2-3-2'}</div>
                <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; margin-top: 20px;">
                    <div style="font-size: 34px; font-weight: 900; text-transform: uppercase; color: ${textColor}; text-shadow: 3px 3px 14px rgba(0,0,0,0.3);">MUSTANG MINI SOCCER</div>
                    <div style="font-size: 24px; font-weight: 700; text-transform: uppercase; color: ${subTextColor}; text-shadow: 2px 2px 10px rgba(0,0,0,0.2);">${dateLabel}</div>
                </div>
            </div>
            <div style="padding: 0 20px;">
                <div style="position: relative; background-color: ${isWhite ? '#dedede' : 'rgba(255,255,255,0.16)'}; border: 2px solid ${isWhite ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.28)'}; border-radius: 50px; padding: 30px; box-shadow: inset 0 0 35px rgba(0,0,0,0.12); min-height: 1120px;">
                    <div style="position: relative; z-index: 2; max-width: 860px; margin: 0 auto;">
                        <div style="position: relative; width: 100%; min-height: 1120px; border-radius: 60px; background-color: #278a3f; overflow: hidden; box-shadow: inset 0 0 34px rgba(0,0,0,0.25);">
                            <div style="position: absolute; inset: 20px; border: 10px solid rgba(255,255,255,0.92); border-radius: 50px;"></div>
                            <div style="position: absolute; left: 20px; right: 20px; top: 50%; height: 6px; background: rgba(255,255,255,0.92); transform: translateY(-50%);"></div>
                            <div style="position: absolute; left: 50%; top: 50%; width: 170px; height: 170px; transform: translate(-50%, -50%); border: 6px solid rgba(255,255,255,0.92); border-radius: 50%;"></div>
                            <div style="position: absolute; left: 50%; top: 50%; width: 16px; height: 16px; transform: translate(-50%, -50%); background: rgba(255,255,255,0.95); border-radius: 50%;"></div>
                            <div style="position: absolute; top: 20px; left: calc(50% - 140px); width: 280px; height: 150px; border: 6px solid rgba(255,255,255,0.92); border-radius: 0 0 40px 40px;"></div>
                            <div style="position: absolute; top: 20px; left: calc(50% - 72px); width: 144px; height: 72px; border: 4px solid rgba(255,255,255,0.88); border-radius: 0 0 22px 22px;"></div>
                            <div style="position: absolute; bottom: 20px; left: calc(50% - 140px); width: 280px; height: 150px; border: 6px solid rgba(255,255,255,0.92); border-radius: 40px 40px 0 0;"></div>
                            <div style="position: absolute; bottom: 20px; left: calc(50% - 72px); width: 144px; height: 72px; border: 4px solid rgba(255,255,255,0.88); border-radius: 22px 22px 0 0;"></div>
                            <div style="position: relative; z-index: 3; width: 100%; min-height: 1120px;">
                                <div style="position: absolute; top: 14%; left: 0; width: 100%; display: flex; justify-content: center; gap: 110px;">
                                    ${teamCount === 5 ? `${slots[5] ? createPlayerCard(slots[5], false, 6) : createEmptyPlaceholder(6)}${slots[6] ? createPlayerCard(slots[6], false, 7) : createEmptyPlaceholder(7)}` : `${slots[6] ? createPlayerCard(slots[6], false, 7) : createEmptyPlaceholder(7)}${slots[7] ? createPlayerCard(slots[7], false, 8) : createEmptyPlaceholder(8)}`}
                                </div>
                                <div style="position: absolute; top: 34.5%; left: 0; width: 100%; display: flex; justify-content: center; gap: 70px;">
                                    ${teamCount === 5 ? `${slots[3] ? createPlayerCard(slots[3], false, 4) : createEmptyPlaceholder(4)}${slots[4] ? createPlayerCard(slots[4], false, 5) : createEmptyPlaceholder(5)}` : `${slots[3] ? createPlayerCard(slots[3], false, 4) : createEmptyPlaceholder(4)}${slots[4] ? createPlayerCard(slots[4], false, 5) : createEmptyPlaceholder(5)}${slots[5] ? createPlayerCard(slots[5], false, 6) : createEmptyPlaceholder(6)}`}
                                </div>
                                <div style="position: absolute; top: 58%; left: 0; width: 100%; display: flex; justify-content: center; gap: 110px;">
                                    ${slots[1] ? createPlayerCard(slots[1], false, 2) : createEmptyPlaceholder(2)}${slots[2] ? createPlayerCard(slots[2], false, 3) : createEmptyPlaceholder(3)}
                                </div>
                                <div style="position: absolute; top: 78%; left: 0; width: 100%; display: flex; justify-content: center;">
                                    ${slots[0] ? createPlayerCard(slots[0], true, 1) : createEmptyPlaceholder(1)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    exportContainer.appendChild(exportContent);
    document.body.appendChild(exportContainer);

    html2canvas(exportContainer, {
        scale: 2,
        width: 1080,
        height: 1920,
        useCORS: true,
        backgroundColor: isWhite ? '#f0f0f0' : '#ffffff',
        logging: false,
        onclone: function(clonedDoc) {
            var clonedElement = clonedDoc.querySelector('[style*="z-index: 10000"]');
            if (clonedElement) {
                clonedElement.style.position = 'absolute';
                clonedElement.style.left = '0';
                clonedElement.style.top = '0';
                clonedElement.style.transform = 'none';
            }
        }
    }).then(function(canvas) {
        var link = document.createElement('a');
        link.download = teamNames[teamColor] + '-' + matchData.date + '.jpg';
        link.href = canvas.toDataURL('image/jpeg', 1.0);
        link.click();
        document.body.removeChild(exportContainer);
    }).catch(function(error) {
        console.error('Export error:', error);
        alert('Gagal export tim: ' + error.message);
        document.body.removeChild(exportContainer);
    });
}

// ==================== POSTER LINE-UP V2 ====================
// Poster dibuat seluruhnya dari elemen HTML agar ekspor tetap tajam, ringan,
// dan otomatis menggunakan aksen untuk setiap warna tim.
function exportTeamPreMatch(teamColor) {
    if (!matchData || !matchData.teams) {
        alert('Tidak ada data pertandingan!');
        return;
    }

    var team = matchData.teams.find(function(t) { return t.color === teamColor; });
    if (!team) {
        alert('Tim ' + (teamNames[teamColor] || teamColor) + ' tidak ditemukan!');
        return;
    }

    var teamCount = getExportTeamCount();
    var slots = normalizeTeamSlots(team, matchData.cancelOnDay || []);
    var themes = {
        merah: { accent: '#ff3d4a', bright: '#ff9ba2', deep: '#5a0810', fieldTop: '#6f1a26', fieldBottom: '#28070d', logo: 'img/logo-merah.png', text: '#ffffff' },
        kuning: { accent: '#ffd62a', bright: '#fff1a0', deep: '#705600', fieldTop: '#776014', fieldBottom: '#302606', logo: 'img/logo-kuning.png', text: '#191500' },
        hijau: { accent: '#3cdd78', bright: '#a7ffc4', deep: '#064b28', fieldTop: '#177447', fieldBottom: '#063b25', logo: 'img/logo-hijau.png', text: '#ffffff' },
        biru: { accent: '#3d9cff', bright: '#a9d7ff', deep: '#063d78', fieldTop: '#164f8c', fieldBottom: '#08264f', logo: 'img/logo-biru.png', text: '#ffffff' },
        putih: { accent: '#e9eef8', bright: '#ffffff', deep: '#45536b', fieldTop: '#64748b', fieldBottom: '#263344', logo: 'img/logo.png', text: '#172033' }
    };
    var theme = themes[teamColor] || themes.hijau;
    var date = new Date(matchData.date);
    var dateLabel = date.toLocaleDateString('id-ID', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    }).toUpperCase();
    var teamLabel = (teamNames[teamColor] || teamColor).replace(/^Tim\s+/i, '').toUpperCase();
    var poster = document.createElement('div');
    poster.id = 'lineup-poster-export';
    poster.style.cssText = [
        'position:absolute', 'left:-12000px', 'top:0', 'width:1080px', 'height:1920px',
        'overflow:hidden', 'box-sizing:border-box', 'font-family:Arial, Helvetica, sans-serif',
        'background:#07121b', 'color:#fff', 'z-index:10000'
    ].join(';');

    function playerCard(name, slotNumber) {
        var player = name && players.find(function(p) { return p.name === name; });
        var photo = player && player.photo ? 'uploads/player_photos/' + player.photo : '';
        var safeName = name || 'KOSONG';
        var initial = name ? String(slotNumber) : '—';
        return '<div style="display:flex;flex-direction:column;align-items:center;width:188px;filter:drop-shadow(0 12px 16px rgba(0,0,0,.5));">' +
            '<div style="width:142px;height:142px;border-radius:50%;padding:6px;box-sizing:border-box;background:linear-gradient(135deg,' + theme.bright + ',' + theme.accent + ' 48%,' + theme.deep + ');box-shadow:0 0 0 5px rgba(255,255,255,.18),0 0 30px ' + theme.accent + ';">' +
                (photo
                    ? '<img src="' + photo + '" alt="' + safeName + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover;background:#192633;" onerror="this.remove();this.parentNode.innerHTML=\'<span style=&quot;display:flex;height:100%;align-items:center;justify-content:center;border-radius:50%;background:#142333;color:#fff;font-size:44px;font-weight:900;&quot;>' + initial + '</span>\';">'
                    : '<span style="display:flex;height:100%;align-items:center;justify-content:center;border-radius:50%;background:linear-gradient(145deg,#233b4a,#101b26);color:#fff;font-size:44px;font-weight:900;">' + initial + '</span>') +
            '</div>' +
            '<div style="width:184px;min-height:34px;margin-top:10px;box-sizing:border-box;padding:8px 12px 7px;text-align:center;background:linear-gradient(100deg,#04080c 0%,#101a22 74%, ' + theme.accent + ' 74%, ' + theme.accent + ' 79%,#04080c 79%);border-left:4px solid ' + theme.accent + ';color:#fff;font-size:18px;font-weight:900;line-height:1.05;letter-spacing:.5px;text-transform:uppercase;overflow-wrap:anywhere;">' + safeName + '</div>' +
        '</div>';
    }

    function row(cards, top, gap) {
        return '<div style="position:absolute;z-index:4;top:' + top + '%;left:0;width:100%;display:flex;justify-content:center;align-items:flex-start;gap:' + gap + 'px;">' + cards.join('') + '</div>';
    }

    var attack = teamCount === 5 ? [playerCard(slots[5], 6), playerCard(slots[6], 7)] : [playerCard(slots[6], 7), playerCard(slots[7], 8)];
    var midfield = teamCount === 5
        ? [playerCard(slots[3], 4), playerCard(slots[4], 5)]
        : [playerCard(slots[3], 4), playerCard(slots[4], 5), playerCard(slots[5], 6)];
    var defence = [playerCard(slots[1], 2), playerCard(slots[2], 3)];
    var pitchRows = row(attack, 12, 122) + row(midfield, 35, teamCount === 5 ? 150 : 48) + row(defence, 59, 122) + row([playerCard(slots[0], 1)], 80, 0);

    poster.innerHTML =
        '<div style="position:absolute;inset:0;background:' +
            'radial-gradient(circle at 50% -8%, ' + theme.deep + ' 0%,transparent 38%),' +
            'radial-gradient(circle at 0% 54%,rgba(255,255,255,.08),transparent 34%),' +
            'linear-gradient(145deg,#050b12 10%,#0a1721 48%,#04080d 100%);"></div>' +
        '<div style="position:absolute;left:-230px;top:270px;width:780px;height:70px;background:' + theme.accent + ';opacity:.78;transform:rotate(-27deg);box-shadow:0 0 35px ' + theme.accent + ';"></div>' +
        '<div style="position:absolute;right:-290px;top:420px;width:840px;height:34px;background:' + theme.bright + ';opacity:.7;transform:rotate(-27deg);"></div>' +
        '<div style="position:absolute;left:-170px;bottom:110px;width:640px;height:92px;background:' + theme.accent + ';opacity:.65;transform:rotate(-31deg);"></div>' +
        '<div style="position:absolute;right:-210px;bottom:180px;width:650px;height:38px;background:' + theme.bright + ';opacity:.75;transform:rotate(-31deg);"></div>' +
        '<div style="position:relative;z-index:2;padding:42px 65px 0;text-align:center;box-sizing:border-box;height:650px;">' +
            '<div style="display:flex;justify-content:center;align-items:center;gap:22px;">' +
                '<span style="height:3px;width:150px;background:linear-gradient(90deg,transparent,' + theme.accent + ');"></span>' +
                '<img src="' + theme.logo + '" style="width:102px;height:102px;object-fit:contain;filter:drop-shadow(0 0 14px ' + theme.accent + ');" alt="Woles FC">' +
                '<span style="height:3px;width:150px;background:linear-gradient(90deg,' + theme.accent + ',transparent);"></span>' +
            '</div>' +
            '<div style="margin-top:18px;font-size:33px;letter-spacing:13px;font-weight:800;color:#f7fbff;text-transform:uppercase;">WOLES FC</div>' +
            '<div style="margin-top:16px;font-size:74px;line-height:.94;font-weight:950;letter-spacing:2px;font-style:italic;color:#fff;text-transform:uppercase;text-shadow:4px 5px 0 #061017,0 0 26px ' + theme.accent + ';">FUN<br>MATCHDAY</div>' +
            '<div style="display:inline-block;margin-top:24px;padding:11px 28px 10px;border-top:3px solid ' + theme.accent + ';border-bottom:3px solid ' + theme.accent + ';color:' + theme.bright + ';font-size:27px;font-weight:900;letter-spacing:7px;text-transform:uppercase;">TIM ' + teamLabel + '</div>' +
            '<div style="margin-top:22px;font-size:44px;font-weight:950;letter-spacing:7px;color:#fff;text-transform:uppercase;">STARTING ' + (teamCount === 5 ? '7' : '8') + '</div>' +
            '<div style="display:flex;justify-content:center;gap:12px;margin-top:14px;">' +
                '<span style="padding:10px 16px;background:rgba(0,0,0,.42);border:1px solid ' + theme.accent + ';border-radius:5px;color:#f7fbff;font-size:16px;letter-spacing:2px;font-weight:800;">MUSTANG MINI SOCCER</span>' +
                '<span style="padding:10px 16px;background:rgba(0,0,0,.42);border:1px solid ' + theme.accent + ';border-radius:5px;color:' + theme.bright + ';font-size:16px;letter-spacing:1px;font-weight:800;">' + dateLabel + '</span>' +
            '</div>' +
        '</div>' +
        '<div style="position:absolute;z-index:1;left:70px;right:70px;top:660px;height:1180px;padding:24px;box-sizing:border-box;border:3px solid ' + theme.accent + ';border-radius:46px;background:linear-gradient(165deg,' + theme.fieldTop + ',' + theme.fieldBottom + ');box-shadow:inset 0 0 60px rgba(0,0,0,.58),0 0 28px ' + theme.accent + ';">' +
            '<div style="position:relative;width:100%;height:100%;overflow:hidden;border:5px solid rgba(255,255,255,.82);border-radius:28px;background:' +
                'repeating-linear-gradient(90deg,rgba(255,255,255,.04) 0,rgba(255,255,255,.04) 82px,rgba(0,0,0,.09) 82px,rgba(0,0,0,.09) 164px),' +
                'radial-gradient(ellipse at 50% 50%,rgba(255,255,255,.12),transparent 46%),' +
                'linear-gradient(180deg,' + theme.fieldTop + ',' + theme.fieldBottom + ');">' +
                '<div style="position:absolute;left:0;right:0;top:50%;height:4px;background:rgba(255,255,255,.85);"></div>' +
                '<div style="position:absolute;left:50%;top:50%;width:170px;height:170px;transform:translate(-50%,-50%);border:4px solid rgba(255,255,255,.85);border-radius:50%;"></div>' +
                '<div style="position:absolute;left:50%;top:50%;width:10px;height:10px;transform:translate(-50%,-50%);border-radius:50%;background:#fff;"></div>' +
                '<div style="position:absolute;top:0;left:50%;width:270px;height:132px;transform:translateX(-50%);border:4px solid rgba(255,255,255,.85);border-top:0;border-radius:0 0 34px 34px;"></div>' +
                '<div style="position:absolute;bottom:0;left:50%;width:270px;height:132px;transform:translateX(-50%);border:4px solid rgba(255,255,255,.85);border-bottom:0;border-radius:34px 34px 0 0;"></div>' +
                pitchRows +
            '</div>' +
        '</div>' +
        '<div style="position:absolute;bottom:28px;left:0;width:100%;z-index:3;text-align:center;color:#c3d1d9;font-size:14px;letter-spacing:2px;">WOLES FC • PLAYER OF THE MONTH</div>';

    document.body.appendChild(poster);
    html2canvas(poster, {
        scale: 2,
        width: 1080,
        height: 1920,
        useCORS: true,
        backgroundColor: '#07121b',
        logging: false,
        onclone: function(doc) {
            var clone = doc.getElementById('lineup-poster-export');
            if (clone) { clone.style.left = '0'; clone.style.top = '0'; }
        }
    }).then(function(canvas) {
        var link = document.createElement('a');
        link.download = 'Lineup-' + (teamNames[teamColor] || teamColor) + '-' + matchData.date + '.jpg';
        link.href = canvas.toDataURL('image/jpeg', 0.96);
        link.click();
        poster.remove();
    }).catch(function(error) {
        console.error('Gagal membuat poster lineup:', error);
        alert('Gagal export lineup: ' + error.message);
        poster.remove();
    });
}

// ==================== EXPORT SATU TIM (UNTUK TOMBOL PER TIM) ====================
function exportSingleTeam(teamColor) {
    if (!matchData) {
        alert('Tidak ada data pertandingan!');
        return;
    }
    
    var team = matchData.teams.find(function(t) { return t.color === teamColor; });
    if (!team) {
        alert('Tim ' + teamNames[teamColor] + ' tidak ditemukan!');
        return;
    }
    
    // Panggil fungsi export yang sudah ada (sync, langsung jalan)
    exportTeamPreMatch(teamColor);
}

// Pastikan fungsi tersedia di global scope
window.exportSingleTeam = exportSingleTeam;

// ==================== EXPORT MATCH REPORT ====================
function exportAllTeams() {
    if (!matchData) {
        alert('Tidak ada data pertandingan!');
        return;
    }
    
    var standings = calculateStandings(matchData.teams);
    var orderedTeams = standings.map(function(s) {
        return matchData.teams.find(function(t) { return t.color === s.color; });
    }).filter(function(t) { return t && (t.players.length + (t.gk ? 1 : 0)) > 0; });
    
    if (orderedTeams.length === 0) {
        alert('Tidak ada tim yang memiliki pemain!');
        return;
    }
    
    var teamCount = getExportTeamCount();
    var slotCount = getExportSlotCount();
    
    var exportContainer = document.createElement('div');
    exportContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 1080px;
        background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
        padding: 30px;
        border-radius: 25px;
        box-shadow: 0 0 60px rgba(0,0,0,0.4);
        z-index: 10000;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        transform: translate(-100%, -100%);
        border: 8px solid #2c3e50;
        box-sizing: border-box;
    `;
    
    var date = new Date(matchData.date);
    var dateStr = date.toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    var exportContent = document.createElement('div');
    exportContent.style.cssText = `
        width: 100%;
        padding: 0;
        box-sizing: border-box;
    `;
    
    var headerHtml = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 3px solid #1abc9c;">
            <div style="display: flex; align-items: center; gap: 12px;">
                <img src="img/logo.png" alt="Woles FC" style="width: 50px; height: 50px; object-fit:contain;">
                <div>
                    <h1 style="margin: 0; color: #2c3e50; font-size: 22px; font-weight: bold;">WOLES FC</h1>
                    <p style="margin: 0; color: #666; font-size: 12px;">Match Report</p>
                </div>
            </div>
            <div style="text-align: right;">
                <div style="color: #2c3e50; font-weight: bold; font-size: 16px;">${dateStr}</div>
            </div>
        </div>
    `;
    
    // Dua kolom menjaga identitas tim dan total poin tetap terbaca, termasuk
    // saat format pertandingan menggunakan lima tim.
    var gridTemplate = '1fr 1fr';
    var teamsHtml = '<div style="display: grid; grid-template-columns: ' + gridTemplate + '; gap: 16px;">';
    
    orderedTeams.forEach(function(team, teamIndex) {
        var cancelPlayers = matchData.cancelOnDay || [];
        var slots = normalizeTeamSlots(team, cancelPlayers);
        
        var rankEmoji = teamIndex === 0 ? '🥇' : teamIndex === 1 ? '🥈' : teamIndex === 2 ? '🥉' : '#' + (teamIndex + 1);
        var isWhite = team.color === 'putih';
        var championBadge = team.champion ? '<span style="display:inline-flex; align-items:center; margin-left:6px; padding:3px 7px; border-radius:5px; background:#d4af37; color:#17202a; font-size:8px; font-weight:900; letter-spacing:0.5px; vertical-align:middle; box-shadow:0 2px 5px rgba(0,0,0,0.15);">🏆 CHAMPION</span>' : '';
        
        var stats = {
            wins: team.wins || 0,
            draws: team.draws || 0,
            losses: team.losses || 0,
            goalsFor: team.goalsFor || 0,
            goalsAgainst: team.goalsAgainst || 0,
            goalDifference: (team.goalsFor || 0) - (team.goalsAgainst || 0),
            points: (team.wins || 0) * 3 + (team.draws || 0)
        };
        
        var createPlayerCard = function(player, isGK, positionNumber) {
            var playerData = players.find(function(p) { return p.name === player; });
            var hasPhoto = playerData && playerData.photo;
            var photoUrl = hasPhoto ? 'uploads/player_photos/' + playerData.photo : null;
            
            var bgGradient = isGK ? 
                'linear-gradient(135deg, #9b59b6, #8e44ad)' : 
                (isWhite ? 'linear-gradient(135deg, #666666, #444444)' : 'linear-gradient(135deg, var(--' + team.color + '), #2c3e50)');
            
            return `
                <div style="display: flex; flex-direction: column; align-items: center; gap: 6px; margin: 0 4px;">
                    <div style="
                        width: 70px;
                        height: 70px;
                        ${hasPhoto ? '' : 'background: ' + bgGradient + ';'}
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: bold;
                        color: white;
                        font-size: ${hasPhoto ? '0' : '12px'};
                        box-shadow: 0 4px 15px rgba(0,0,0,0.20);
                        border: 3px solid white;
                        position: relative;
                        overflow: hidden;
                    ">
                        ${hasPhoto ? 
                            '<img src="' + photoUrl + '" style="width:100%; height:100%; object-fit:cover;" alt="' + player + '" onerror="this.onerror=null; this.parentNode.style.background=\'' + bgGradient + '\'; this.parentNode.innerHTML=\'<span style=\\"font-size: 12px; color: white;\\">' + positionNumber + '</span>\';">' : 
                            '<span style="color: white; text-shadow: 1px 1px 3px rgba(0,0,0,0.3);">' + positionNumber + '</span>'
                        }
                    </div>
                    <div style="
                        text-align: center;
                        max-width: 70px;
                    ">
                        <div style="
                            font-weight: 900;
                            font-size: 9px;
                            color: ${isWhite ? '#1a1a1a' : '#111111'};
                            text-transform: uppercase;
                            word-wrap: break-word;
                            line-height: 1.2;
                            background: #ffffff;
                            padding: 3px 6px;
                            border-radius: 4px;
                            box-shadow: 0 1px 6px rgba(0,0,0,0.08);
                        ">
                            ${player.length > 10 ? player.substring(0, 8) + '..' : player}
                        </div>
                    </div>
                </div>
            `;
        };
        
        var createEmptyPlaceholder = function(positionNumber) {
            return `
                <div style="display: flex; flex-direction: column; align-items: center; gap: 6px; margin: 0 4px;">
                    <div style="
                        width: 70px;
                        height: 70px;
                        background: linear-gradient(135deg, #f1f3f5, #e9ecef);
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-weight: bold;
                        color: #6c757d;
                        font-size: 12px;
                        box-shadow: 0 4px 15px rgba(0,0,0,0.08);
                        border: 2px dashed #adb5bd;
                    ">
                        <span style="color: #6c757d;">${positionNumber}</span>
                    </div>
                    <div style="
                        text-align: center;
                        max-width: 70px;
                    ">
                        <div style="
                            font-weight: 900;
                            font-size: 9px;
                            color: #6c757d;
                            word-wrap: break-word;
                            line-height: 1.2;
                            background: #ffffff;
                            padding: 3px 6px;
                            border-radius: 4px;
                            border: 1px dashed #adb5bd;
                        ">
                            KOSONG
                        </div>
                    </div>
                </div>
            `;
        };
        
        // Untuk tim PUTIH gunakan warna HITAM
        var borderColor = isWhite ? '#333333' : 'var(--' + team.color + ')';
        var textColor = isWhite ? '#333333' : 'var(--' + team.color + ')';
        var borderBottomColor = isWhite ? '#333333' : 'var(--' + team.color + ')';
        
        teamsHtml += `
            <div style="
                background: white;
                border-radius: 10px;
                padding: 12px;
                box-shadow: 0 2px 12px rgba(0,0,0,0.06);
                border: 2px solid ${borderColor};
            ">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid ${borderBottomColor};">
                    <div style="
                        width: 32px;
                        height: 32px;
                        background: linear-gradient(135deg, #ffffff, #f5f5f5);
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border: 2px solid ${borderColor};
                        overflow: hidden;
                        flex-shrink: 0;
                    ">
                        <img src="img/logo.png" alt="${teamNames[team.color]}" style="width: 26px; height: 26px; object-fit: contain;">
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: bold; color: ${textColor}; font-size: 13px;">
                            ${rankEmoji} ${teamNames[team.color]} ${championBadge}
                        </div>
                        <div style="display: flex; align-items: stretch; gap: 5px; margin-top: 5px;">
                            <div style="display: flex; align-items: center; gap: 4px; padding: 4px 7px; background: #eef2f5; color: #455a64; border: 1px solid #d8e0e5; border-radius: 6px; font-size: 9px; font-weight: 800;">
                                <span style="font-size: 12px;">👥</span>
                                <span>${team.players.length + (team.gk ? 1 : 0)} PEMAIN</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 5px; padding: 3px 9px; background: #1f2d3d; color: #ffffff; border: 2px solid ${borderColor}; border-radius: 7px; box-shadow: 0 3px 8px rgba(0,0,0,0.18);">
                                <span style="font-size: 8px; font-weight: 800; letter-spacing: 0.4px;">TOTAL POIN</span>
                                <span style="font-size: 18px; line-height: 1; font-weight: 900; color: #ffd54f;">${stats.points}</span>
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 6px; font-size: 10px; font-weight: bold; background: #f8f9fa; padding: 3px 10px; border-radius: 6px; border: 1px solid #e9ecef;">
                        <span style="color: #27ae60;">W:${stats.wins}</span>
                        <span style="color: #f39c12;">D:${stats.draws}</span>
                        <span style="color: #e74c3c;">L:${stats.losses}</span>
                        <span style="color: #2c3e50; border-left: 1px solid #dee2e6; padding-left: 6px;">GD:${stats.goalDifference > 0 ? '+' : ''}${stats.goalDifference}</span>
                    </div>
                </div>
                
                <div style="
                    background-color: #43852d;
                    border-radius: 10px;
                    padding: 12px 6px;
                    position: relative;
                    box-shadow: inset 0 3px 12px rgba(0,0,0,0.3);
                    border: 2px solid #1a3a0a;
                ">
                    <div style="display: flex; justify-content: center; margin-bottom: 14px;">
                        ${slots[0] ? createPlayerCard(slots[0], true, 1) : createEmptyPlaceholder(1)}
                    </div>

                    <div style="display: flex; justify-content: center; gap: 16px; margin-bottom: 14px;">
                        ${slots[1] ? createPlayerCard(slots[1], false, 2) : createEmptyPlaceholder(2)}${slots[2] ? createPlayerCard(slots[2], false, 3) : createEmptyPlaceholder(3)}
                    </div>

                    <div style="display: flex; justify-content: center; gap: 10px; margin-bottom: 14px;">
                        ${teamCount === 5 ? `${slots[3] ? createPlayerCard(slots[3], false, 4) : createEmptyPlaceholder(4)}${slots[4] ? createPlayerCard(slots[4], false, 5) : createEmptyPlaceholder(5)}` : `${slots[3] ? createPlayerCard(slots[3], false, 4) : createEmptyPlaceholder(4)}${slots[4] ? createPlayerCard(slots[4], false, 5) : createEmptyPlaceholder(5)}${slots[5] ? createPlayerCard(slots[5], false, 6) : createEmptyPlaceholder(6)}`}
                    </div>

                    <div style="display: flex; justify-content: center; gap: 16px;">
                        ${teamCount === 5 ? `${slots[5] ? createPlayerCard(slots[5], false, 6) : createEmptyPlaceholder(6)}${slots[6] ? createPlayerCard(slots[6], false, 7) : createEmptyPlaceholder(7)}` : `${slots[6] ? createPlayerCard(slots[6], false, 7) : createEmptyPlaceholder(7)}${slots[7] ? createPlayerCard(slots[7], false, 8) : createEmptyPlaceholder(8)}`}
                    </div>
                </div>
            </div>
        `;
    });
    
    teamsHtml += '</div>';
    
    var footerHtml = `
        <div style="
            text-align: center; 
            margin-top: 16px; 
            padding-top: 10px;
            border-top: 2px solid #eee;
            color: #6c757d; 
            font-size: 10px;
            background: linear-gradient(135deg, #f8f9fa, #e9ecef);
            padding: 10px;
            border-radius: 8px;
        ">
            <p style="margin: 0; font-weight: bold; color: #2c3e50;">Woles FC © Fjun21</p>
        </div>
    `;
    
    exportContent.innerHTML = headerHtml + teamsHtml + footerHtml;
    exportContainer.appendChild(exportContent);
    document.body.appendChild(exportContainer);
    
    setTimeout(function() {
        var contentHeight = exportContent.scrollHeight + 40;
        exportContainer.style.height = contentHeight + 'px';
        
        html2canvas(exportContainer, {
            scale: 2.5,
            width: 1080,
            height: contentHeight,
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
            link.download = 'Match-Report-' + matchData.date + '.jpg';
            link.href = canvas.toDataURL('image/jpeg', 0.95);
            link.click();
            document.body.removeChild(exportContainer);
        }).catch(function(error) {
            console.error('Export error:', error);
            alert('Gagal mengexport match report: ' + error.message);
            document.body.removeChild(exportContainer);
        });
    }, 200);
}

// ==================== BIND BUTTONS ====================
// Pastikan implementasi eksport terdaftar di global scope
window.downloadCombined = downloadCombined;
window.exportAllTeams = exportAllTeams;
window.exportAllTeamsPreMatch = exportAllTeamsPreMatch;

document.addEventListener('DOMContentLoaded', function() {
    try {
        var btn = document.querySelector('button[onclick="downloadCombined()"]');
        if (btn) {
            btn.removeAttribute('onclick');
            btn.addEventListener('click', function(e) {
                console.log('Export button clicked (bound by export.js)');
                try {
                    if (typeof window.downloadCombined === 'function') {
                        window.downloadCombined();
                    } else {
                        console.error('window.downloadCombined is not a function');
                        alert('Fungsi export tidak tersedia. Silakan refresh halaman.');
                    }
                } catch (err) {
                    console.error('Error when calling downloadCombined:', err);
                    alert('Gagal menjalankan export: ' + (err && err.message ? err.message : err));
                }
            });
        }

        var rankBtn = document.querySelector('button[onclick="downloadRankingTable()"]');
        if (rankBtn) {
            rankBtn.removeAttribute('onclick');
            rankBtn.addEventListener('click', function(e) {
                console.log('Ranking export clicked (bound by export.js)');
                try {
                    if (typeof window.downloadRankingTable === 'function') {
                        window.downloadRankingTable();
                    } else {
                        console.error('window.downloadRankingTable is not a function');
                        alert('Fungsi export klasemen tidak tersedia. Silakan refresh halaman.');
                    }
                } catch (err) {
                    console.error('Error when calling downloadRankingTable:', err);
                    alert('Gagal menjalankan export klasemen: ' + (err && err.message ? err.message : err));
                }
            });
        }
    } catch (e) {
        console.error('Failed to bind export button:', e);
    }
});
