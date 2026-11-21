// ==================== RIWAYAT ====================
var historyDataCache = [];
var historyCurrentPage = 1;
var historyPageSize = 5;

async function loadHistory() {
    showLoading();
    try {
        const datesResult = await callAPI('getMatchDates');
        if (!datesResult.success) throw new Error('Gagal mengambil data tanggal');
        const results = await Promise.all((datesResult.dates || []).map(date => callAPI('getMatchDateData', { date })));
        historyDataCache = results.filter(result => result && result.success);
        historyCurrentPage = 1;
        renderHistory();
    } catch (error) {
        console.error('Error loading history:', error);
        showError('Gagal memuat riwayat: ' + error.message);
    } finally { hideLoading(); }
}

function changeHistoryPageSize(value) {
    historyPageSize = parseInt(value, 10) || 5;
    historyCurrentPage = 1;
    renderHistory();
}

function changeHistoryPage(page) {
    const totalPages = Math.max(1, Math.ceil(historyDataCache.length / historyPageSize));
    historyCurrentPage = Math.min(totalPages, Math.max(1, page));
    renderHistory();
    document.getElementById('history').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderHistory() {
    const container = document.getElementById('history-results');
    if (!container) return;
    if (historyDataCache.length === 0) {
        container.innerHTML = '<div class="history-empty">Belum ada riwayat pertandingan.</div>';
        return;
    }

    const totalPages = Math.max(1, Math.ceil(historyDataCache.length / historyPageSize));
    if (historyCurrentPage > totalPages) historyCurrentPage = totalPages;
    const startIndex = (historyCurrentPage - 1) * historyPageSize;
    const pageData = historyDataCache.slice(startIndex, startIndex + historyPageSize);
    let html = `<div class="history-toolbar">
        <h3 style="color:#2c3e50;margin:0;">${historyDataCache.length} Pertandingan</h3>
        <label class="history-page-size">Tampilkan <select onchange="changeHistoryPageSize(this.value)">
            ${[5,10,25,50].map(size => `<option value="${size}" ${size === historyPageSize ? 'selected' : ''}>${size}</option>`).join('')}
        </select> per halaman</label></div>`;

    pageData.forEach(data => {
        const date = new Date(data.date);
        const teamCount = Number(data.teamCount) === 5 ? 5 : 4;
        const activeColors = typeof getActiveTeamColors === 'function'
            ? getActiveTeamColors(teamCount)
            : (teamCount === 5 ? ['merah', 'kuning', 'hijau', 'biru', 'putih'] : ['merah', 'kuning', 'hijau', 'biru']);
        const teams = (Array.isArray(data.teams) ? data.teams : []).filter(team => team && activeColors.includes(team.color));
        const standings = calculateStandings(teams);
        const manualChampion = teams.find(t => t && (t.champion === true || t.champion === 1));
        const champion = manualChampion ? teamNames[manualChampion.color] : (standings.length ? teamNames[standings[0].color] : '-');
        const championColor = manualChampion ? manualChampion.color : (standings.length ? standings[0].color : null);
        const sortedTeams = standings.map(s => ({ ...teams.find(t => t.color === s.color), rankPoints: s.points }));
        const totalPlayers = teams.reduce((sum, team) => sum + ((team.players || []).length + (team.gk ? 1 : 0)), 0);

        html += `<div class="history-card">
            <div class="history-card-header"><h4>${date.toLocaleDateString('id-ID',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</h4>
                <div class="history-card-actions"><span class="history-player-count">${totalPlayers} Pemain</span>
                <button class="btn btn-small" onclick="deleteMatch('${data.date}')" style="background:linear-gradient(135deg,#e74c3c,#c0392b)!important;">Hapus Pertandingan</button></div>
            </div>
            <div class="history-summary"><div><strong>Juara:</strong> <span style="color:#b8860b;font-weight:700;">${champion}</span></div>
                <div><strong>Cancel Players:</strong> <span style="color:#e74c3c;">${(data.cancelOnDay || []).length} pemain</span></div></div>
            <div class="history-teams history-teams-${teamCount}">${sortedTeams.map(team => {
                const isChampion = team.color === championColor;
                const teamNameColor = team.color === 'putih' ? '#1f2937' : `var(--${team.color})`;
                return `<div class="history-team ${isChampion ? 'champion' : ''}"><div style="font-weight:700;color:${teamNameColor};">${teamNames[team.color]}</div>
                    <div>${(team.players || []).length + (team.gk ? 1 : 0)} pemain</div><div>${team.wins || 0}W ${team.draws || 0}D ${team.losses || 0}L</div>
                    <strong>Poin: ${(team.wins || 0) * 3 + (team.draws || 0)}</strong></div>`;
            }).join('')}</div></div>`;
    });

    if (totalPages > 1) {
        let buttons = '';
        for (let page = 1; page <= totalPages; page++) buttons += `<button class="history-page-btn ${page === historyCurrentPage ? 'active' : ''}" onclick="changeHistoryPage(${page})">${page}</button>`;
        html += `<div class="history-pagination"><button class="history-page-btn" onclick="changeHistoryPage(${historyCurrentPage - 1})" ${historyCurrentPage === 1 ? 'disabled' : ''}>‹</button>${buttons}<button class="history-page-btn" onclick="changeHistoryPage(${historyCurrentPage + 1})" ${historyCurrentPage === totalPages ? 'disabled' : ''}>›</button></div>`;
    }
    container.innerHTML = html;
}

async function deleteMatch(date) {
    if (!confirm('Yakin ingin menghapus pertandingan tanggal ' + date + '? Tindakan ini tidak bisa dibatalkan.')) return;
    showLoading();
    try {
        const result = await callAPI('deleteMatchDate', { date });
        if (!result.success) throw new Error(result.error || 'Gagal menghapus pertandingan');
        if (localStorage.getItem('woles_last_match_date') === date) localStorage.removeItem('woles_last_match_date');
        if (typeof loadMatchDatesList === 'function') await loadMatchDatesList();
        await loadHistory();
        alert('Pertandingan berhasil dihapus');
    } catch (error) {
        console.error('Error deleting match:', error);
        showError('Gagal menghapus pertandingan: ' + error.message);
    } finally { hideLoading(); }
}
