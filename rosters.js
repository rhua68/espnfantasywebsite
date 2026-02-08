$(document).ready(function() {
    fetch('league_data.json')
        .then(res => {
            if (!res.ok) throw new Error("Could not load league_data.json");
            return res.json();
        })
        .then(data => {
            // 1. UPDATE THE FOOTER (Fixes the "Stuck on Loading" issue)
            if (data.updated) {
                $('#last-updated').text(data.updated);
            }

            const container = $('#rosters-container');
            
            if (!data.rosters || data.rosters.length === 0) {
                container.html('<div class="col-12 text-center text-secondary">No roster data found. Run tracker.py first!</div>');
                return;
            }

            container.empty();

            // 2. RENDER TEAM CARDS
            data.rosters.forEach(team => {
                let playerList = team.players.map(p => `
                    <div class="player-strip d-flex align-items-center justify-content-between mb-2 p-1">
                        <div class="d-flex align-items-center">
                            <img src="${p.img}" 
                                class="player-img me-2" 
                                style="width: 35px; height: 35px; border-radius: 50%; object-fit: cover; background: #222;"
                                onerror="this.src='https://a.espncdn.com/i/headshots/nba/players/full/0.png'">
                            <div class="text-white small fw-bold">${p.name}</div>
                        </div>
                        
                        <div class="stats-pill d-flex gap-2">
                            <div class="stat-item text-center">
                                <div class="stat-label text-secondary" style="font-size: 0.6rem;">PTS</div>
                                <div class="stat-value text-white small" style="font-size: 0.75rem;">${p.avg_pts || '-'}</div>
                            </div>
                            <div class="stat-item text-center">
                                <div class="stat-label text-secondary" style="font-size: 0.6rem;">REB</div>
                                <div class="stat-value text-white small" style="font-size: 0.75rem;">${p.avg_reb || '-'}</div>
                            </div>
                            <div class="stat-item text-center">
                                <div class="stat-label text-secondary" style="font-size: 0.6rem;">AST</div>
                                <div class="stat-value text-white small" style="font-size: 0.75rem;">${p.avg_ast || '-'}</div>
                            </div>
                            <div class="stat-item text-center">
                                <div class="stat-label text-secondary" style="font-size: 0.6rem;">FG%</div>
                                <div class="stat-value text-white small" style="font-size: 0.75rem;">${p.avg_fg_pct || '-'}</div>
                            </div>
                            <div class="stat-item text-center">
                                <div class="stat-label text-secondary" style="font-size: 0.6rem;">3PM</div>
                                <div class="stat-value text-white small" style="font-size: 0.75rem;">${p.three_point_made || '-'}</div>
                            </div>
                            <div class="stat-item text-center">
                                <div class="stat-label text-secondary" style="font-size: 0.6rem;">3PT%</div>
                                <div class="stat-value text-white small" style="font-size: 0.75rem;">${p.three_point_pct || '-'}</div>
                            </div>
                            <div class="stat-item text-center">
                                <div class="stat-label text-secondary" style="font-size: 0.6rem;">STL</div>
                                <div class="stat-value text-white small" style="font-size: 0.75rem;">${p.avg_stls || '-'}</div>
                            </div>
                            <div class="stat-item text-center">
                                <div class="stat-label text-secondary" style="font-size: 0.6rem;">BLK</div>
                                <div class="stat-value text-white small" style="font-size: 0.75rem;">${p.avg_blk || '-'}</div>
                            </div>
                        </div>
                    </div>
                `).join('');

                container.append(`
                    <div class="col-md-6 col-lg-4 mb-4 team-card" data-team-name="${team.name.toLowerCase()}">
                        <div class="card bg-dark border-secondary h-100 shadow-sm">
                            <div class="card-header border-secondary d-flex align-items-center bg-black py-3">
                                <img src="${team.logo}" style="width:30px; height:30px; object-fit: contain;" class="me-2">
                                <h6 class="mb-0 text-primary text-truncate fw-bold">${team.name}</h6>
                            </div>
                            <div class="card-body p-2 roster-scroll-area" style="max-height: 500px; overflow-y: auto;">
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