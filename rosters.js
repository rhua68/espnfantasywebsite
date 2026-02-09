$(document).ready(function() {
    fetch('league_data.json?v=${new Date().getTime()}')
        .then(res => {
            if (!res.ok) throw new Error("Could not load league_data.json");
            return res.json();
        })
        .then(data => {
            // 1. Update Footer Timestamp
            if (data.updated) {
                $('#last-updated').text(data.updated);
            }

            const container = $('#rosters-container');
            
            // Check if rosters exist to avoid console errors
            if (!data.rosters || data.rosters.length === 0) {
                container.html('<div class="col-12 text-center text-secondary">No roster data found. Run tracker.py first!</div>');
                return;
            }

            // Clear container before rendering
            container.empty();

            // 2. Render Team Cards
            data.rosters.forEach(team => {
                let playerList = team.players.map(p => `
                    <div class="player-strip d-flex align-items-center justify-content-between">
                        <div class="d-flex align-items-center" style="flex: 1; min-width: 0;"> 
                            <img src="${p.img}" 
                                 class="player-img me-2 flex-shrink-0" 
                                 style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover; background: #222;"
                                 onerror="this.src='https://a.espncdn.com/i/headshots/nba/players/full/0.png'">
                            
                            <div class="text-white small fw-bold text-truncate pe-2" title="${p.name}">
                                ${p.name}
                            </div>
                        </div>
                        
                        <div class="stats-grid d-flex gap-1 flex-shrink-0">
                            <div class="stat-box">
                                <span class="stat-label">FG%</span>
                                <span class="stat-val">${p.avg_fg_pct || '-'}</span>
                            </div>
                            <div class="stat-box">
                                <span class="stat-label">FT%</span>
                                <span class="stat-val">${p.avg_ft_pct || '-'}</span>
                            </div>
                            <div class="stat-box">
                                <span class="stat-label">3PM</span>
                                <span class="stat-val">${p.avg_3pm || '-'}</span>
                            </div>
                            <div class="stat-box">
                                <span class="stat-label">PTS</span>
                                <span class="stat-val">${p.avg_pts || '-'}</span>
                            </div>
                            <div class="stat-box">
                                <span class="stat-label">REB</span>
                                <span class="stat-val">${p.avg_reb || '-'}</span>
                            </div>
                            <div class="stat-box">
                                <span class="stat-label">AST</span>
                                <span class="stat-val">${p.avg_ast || '-'}</span>
                            </div>
                            <div class="stat-box">
                                <span class="stat-label">STL</span>
                                <span class="stat-val">${p.avg_stl || '-'}</span>
                            </div>
                            <div class="stat-box">
                                <span class="stat-label">BLK</span>
                                <span class="stat-val">${p.avg_blk || '-'}</span>
                            </div>
                        </div>
                    </div>
                `).join('');

                container.append(`
                    <div class="col-12 col-xl-6 mb-4 team-card" data-team-name="${team.name.toLowerCase()}">
                        <div class="card h-100 shadow-sm">
                            <div class="card-header d-flex align-items-center py-3">
                                <img src="${team.logo}" style="width:48px; height:48px; border-radius: 50%; object-fit: cover;" class="me-3">
                                <h6 class="mb-0 text-primary fw-bold text-truncate">${team.name}</h6>
                            </div>
                            <div class="card-body p-2 roster-scroll-area" style="max-height: 550px; overflow-y: auto;">
                                ${playerList}
                            </div>
                        </div>
                    </div>
                `);
            });
        })
        .catch(err => {
            console.error("Error:", err);
            $('#last-updated').text("Sync Error");
            $('#rosters-container').html('<div class="text-danger text-center">Error loading rosters. Check console for details.</div>');
        });
});