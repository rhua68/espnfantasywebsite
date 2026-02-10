import { collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

$(document).ready(function() {
    fetch(`../league_data.json?v=${new Date().getTime()}`)
        .then(res => {
            if (!res.ok) throw new Error("Could not load league_data.json");
            return res.json();
        })
        .then(data => {
            window.allData = data;
            if (data.updated) $('#last-updated').text(data.updated);

            const container = $('#rosters-container');
            if (!data.rosters || data.rosters.length === 0) {
                container.html('<div class="col-12 text-center text-secondary">No roster data found.</div>');
                return;
            }

            container.empty();

            data.rosters.forEach(team => {
                // 1. Determine if this card belongs to the logged-in user
                const isMyTeam = window.currentUserTeamId && (team.id == window.currentUserTeamId);

                // 2. Build the Trade button or "Sakura Pink" Your Team label
                const tradeActionHtml = isMyTeam 
                    ? `<span class="badge badge-sakura px-3 py-2 your-team-label">🌸 YOUR TEAM</span>` 
                    : `<button class="btn btn-primary btn-sm fw-bold open-trade-modal" 
                                data-team-id="${team.id}" 
                                data-team-name="${team.name}">
                            Trade
                       </button>`;

                // 3. Generate the Player List HTML with your specific new stats
                let playerListHtml = team.players.map(p => `
                    <div class="player-strip d-flex align-items-center justify-content-between border-bottom border-secondary-subtle">
                        <div class="d-flex align-items-center" style="flex: 1; min-width: 0;"> 
                            <img src="${p.img}" class="player-img me-2 flex-shrink-0" style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover; background: #222;" onerror="this.src='../icons/noPic.png'">
                            <div class="text-white small fw-bold text-truncate pe-2" title="${p.name}">${p.name}</div>
                        </div>
                        <div class="stats-grid d-flex flex-wrap gap-1 justify-content-end" style="width: 65%;">
                            <div class="stat-box"><span class="stat-label">MPG</span><span class="stat-val">${p.avg_mpg || '-'}</span></div>
                            <div class="stat-box"><span class="stat-label">PTS</span><span class="stat-val">${p.avg_pts || '-'}</span></div>
                            <div class="stat-box"><span class="stat-label">REB</span><span class="stat-val">${p.avg_reb || '-'}</span></div>
                            <div class="stat-box"><span class="stat-label">AST</span><span class="stat-val">${p.avg_ast || '-'}</span></div>
                            <div class="stat-box"><span class="stat-label">STL</span><span class="stat-val">${p.avg_stl || '-'}</span></div>
                            <div class="stat-box"><span class="stat-label">BLK</span><span class="stat-val">${p.avg_blk || '-'}</span></div>
                            <div class="stat-box"><span class="stat-label">3PM</span><span class="stat-val">${p.avg_3pm || '-'}</span></div>
                            <div class="stat-box"><span class="stat-label">FG%</span><span class="stat-val">${p.avg_fg_pct || '-'}</span></div>
                            <div class="stat-box"><span class="stat-label">FT%</span><span class="stat-val">${p.avg_ft_pct || '-'}</span></div>
                        </div>
                    </div>
                `).join('');

                container.append(`
                    <div class="col-12 col-xl-6 mb-4 team-card" data-team-id="${team.id}" data-team-name="${team.name.toLowerCase()}">
                        <div class="card h-100 shadow-sm border-0 bg-secondary-subtle ${isMyTeam ? 'border-sakura' : ''}">
                            <div class="card-header d-flex align-items-center justify-content-between py-3 bg-black">
                                <div class="d-flex align-items-center">
                                    <img src="${team.logo}" style="width:40px; height:40px; border-radius: 50%;" class="me-3">
                                    <h6 class="mb-0 text-primary fw-bold">${team.name}</h6>
                                </div>
                                <div class="d-flex gap-2 align-items-center">
                                    <button class="btn btn-outline-info btn-sm fw-bold view-toggle" data-mode="players">View Picks</button>
                                    ${tradeActionHtml}
                                </div>
                            </div>
                            <div class="card-body p-2 roster-scroll-area" style="height: 550px; overflow-y: auto;">
                                <div class="view-players">${playerListHtml}</div>
                                <div class="view-picks d-none p-3">
                                    <div class="picks-list">
                                        <div class="text-center py-4"><div class="spinner-border text-primary spinner-border-sm"></div></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `);
            });
        });

    // --- SEARCH LOGIC (Preserved) ---
    $('#rosterSearch').on('keyup', function() {
        const searchTerm = $(this).val().toLowerCase();

        $('.team-card').each(function() {
            const card = $(this);
            const teamName = card.data('team-name');
            let hasVisibleContent = false;

            card.find('.player-strip').each(function() {
                const playerName = $(this).find('.text-white').text().toLowerCase();
                if (playerName.includes(searchTerm) || teamName.includes(searchTerm)) {
                    $(this).show();
                    hasVisibleContent = true;
                } else {
                    $(this).hide();
                }
            });

            card.find('.pick-item').each(function() {
                const pickText = $(this).text().toLowerCase();
                if (pickText.includes(searchTerm) || teamName.includes(searchTerm)) {
                    $(this).show();
                    hasVisibleContent = true;
                } else {
                    $(this).hide();
                }
            });

            if (teamName.includes(searchTerm)) hasVisibleContent = true;
            if (hasVisibleContent) card.show(); else card.hide();
        });
    });
});

// --- TOGGLE LOGIC (Preserved) ---
$(document).on('click', '.view-toggle', function() {
    const btn = $(this);
    const card = btn.closest('.team-card');
    const teamId = card.data('team-id');
    const teamName = card.data('team-name');
    const playerView = card.find('.view-players');
    const picksView = card.find('.view-picks');

    if (btn.data('mode') === 'players') {
        btn.data('mode', 'picks').text('View Roster').removeClass('btn-outline-info').addClass('btn-outline-warning');
        playerView.addClass('d-none');
        picksView.removeClass('d-none');
        fetchPicksForTeam(teamId, teamName, card.find('.picks-list'));
    } else {
        btn.data('mode', 'players').text('View Picks').removeClass('btn-outline-warning').addClass('btn-outline-info');
        playerView.removeClass('d-none');
        picksView.addClass('d-none');
    }
});

async function fetchPicksForTeam(teamId, teamName, targetContainer) {
    try {
        const q = query(collection(window.db, "draft_picks"), where("currentOwnerId", "==", parseInt(teamId)), orderBy("year", "asc"));
        const snapshot = await getDocs(q);
        targetContainer.empty();

        if (snapshot.empty) {
            targetContainer.html('<div class="text-center text-secondary py-5">No future picks owned.</div>');
            return;
        }

        snapshot.forEach(doc => {
            const pick = doc.data();
            targetContainer.append(`
                <div class="pick-item d-flex justify-content-between align-items-center border-bottom border-secondary py-3">
                    <div>
                        <div class="text-white fw-bold">${pick.year} Round ${pick.round}</div>
                        <div class="x-small text-secondary">Original: ${pick.originalOwner}</div>
                    </div>
                    <span class="badge bg-dark border border-secondary text-info">ASSET</span>
                </div>
            `);
        });
        
        const currentSearch = $('#rosterSearch').val().toLowerCase();
        if(currentSearch) $('#rosterSearch').trigger('keyup');

    } catch (err) {
        targetContainer.html('<div class="text-danger small text-center">Error loading database.</div>');
    }
}