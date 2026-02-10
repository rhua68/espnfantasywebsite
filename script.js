let allData = {}; 

$(document).ready(function() {
    // Cache-busting prevents old data from appearing after GitHub Actions updates
    fetch(`league_data.json?v=${new Date().getTime()}`)
        .then(response => {
            if (!response.ok) throw new Error("Could not load league_data.json");
            return response.json();
        })
        .then(data => {
            allData = data;
            
            // 1. Update the Footer
            if (data.updated) {
                $('#last-updated').text(data.updated);
            }

            // 2. Build the Trade Block (Left Side)
            renderTradeBlock(data.trade_block);

            // 3. Setup the Dropdown Switcher
            setupYearDropdown(data.seasons);
        })
        .catch(err => {
            console.error("Error loading JSON:", err);
            $('#last-updated').text("Sync Error");
        });
});

function renderTradeBlock(players) {
    const list = $('#trade-block-list').empty();
    if (!players || players.length === 0) {
        list.append('<li class="list-group-item bg-transparent text-secondary italic small">No players on block.</li>');
        return;
    }

    players.forEach(p => {
        const isLikely = p.status === "Likely";
        const badgeClass = isLikely ? "bg-primary" : "bg-dark border border-secondary text-secondary";
        
        list.append(`
            <li class="list-group-item bg-transparent border-bottom border-secondary-subtle px-0 py-2">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <div class="fw-bold text-white small">${p.name}</div>
                        <div class="text-primary x-small text-uppercase fw-bold">${p.team}</div>
                    </div>
                    <span class="badge rounded-pill ${badgeClass}" style="font-size: 0.55rem;">
                        ${p.status.toUpperCase()}
                    </span>
                </div>
            </li>
        `);
    });
}

function setupYearDropdown(seasons) {
    const years = Object.keys(seasons).sort().reverse();
    const menu = $('#year-dropdown-menu').empty();

    years.forEach((year, i) => {
        const label = `${parseInt(year) - 1}-${year.slice(-2)}`;
        menu.append(`<li><a class="dropdown-item ${i === 0 ? 'active' : ''}" href="#" data-year="${year}">${label} Season</a></li>`);
        
        if (i === 0) {
            $('#yearDropdown').text(`📅 ${label}`);
            loadYearData(year);
        }
    });

    $('#year-dropdown-menu').on('click', '.dropdown-item', function(e) {
        e.preventDefault();
        const selectedYear = $(this).attr('data-year');
        $('.dropdown-item').removeClass('active');
        $(this).addClass('active');
        $('#yearDropdown').text(`📅 ${$(this).text().replace(' Season','')}`);
        loadYearData(selectedYear);
    });
}

function loadYearData(year) {
    const trades = allData.seasons[year] || [];

    if ($.fn.DataTable.isDataTable('#trades-table')) {
        $('#trades-table').DataTable().destroy();
    }

    $('#trades-table').DataTable({
        data: trades,
        columnDefs: [{ "defaultContent": "-", "targets": "_all" }],
        columns: [
            { 
                data: 'date', 
                width: '15%', 
                render: (data, type, row) => type === 'sort' ? (row.sort_date || data) : data 
            },
            { 
                data: null,
                render: function(row) {
                    if (!row.teams || row.teams.length < 2) {
                        return `<div class="p-2 text-center text-secondary italic small">System Transaction</div>`;
                    }

                    const tA = row.teams[0];
                    const tB = row.teams[1];

                    const getAbbr = (fullName) => {
                        const team = allData.rosters.find(r => r.name === fullName);
                        return team ? team.abbrev : fullName.substring(0, 3).toUpperCase();
                    };

                    const abbrA = getAbbr(tA);
                    const abbrB = getAbbr(tB);
                    const assetsA = (row.assets || []).filter(a => a.from === tA).map(a => a.player).join("<br>");
                    const assetsB = (row.assets || []).filter(a => a.from === tB).map(a => a.player).join("<br>");

                    return `
                        <div class="trade-assets-container p-2">
                            <div class="row g-0 position-relative mb-3 align-items-center d-none d-md-flex pt-2">
                                <div class="col-6 text-center pe-2">
                                    <span class="badge bg-primary text-uppercase team-badge">${tA}</span>
                                </div>
                                
                                <div class="col-6 text-center ps-2">
                                    <span class="badge bg-info text-dark text-uppercase team-badge">${tB}</span>
                                </div>
                            </div>

                            <div class="row text-center position-relative g-0">
                                <div class="vertical-divider d-none d-md-block"></div>
                                
                                <div class="col-12 col-md-6 border-bottom-mobile pb-3 pb-md-0">
                                    <div class="d-md-none mb-2">
                                        <span class="badge bg-primary text-uppercase team-badge w-100">${tA}</span>
                                    </div>
                                    <div class="text-primary x-small fw-bold mb-1">SENT TO ${abbrB}:</div>
                                    <div class="small fw-bold text-white">${assetsA || 'None'}</div>
                                </div>

                                <div class="col-12 col-md-6 pt-3 pt-md-0">
                                    <div class="d-md-none mb-2">
                                        <span class="badge bg-info text-dark text-uppercase team-badge w-100">${tB}</span>
                                    </div>
                                    <div class="text-info x-small fw-bold mb-1">SENT TO ${abbrA}:</div>
                                    <div class="small fw-bold text-white">${assetsB || 'None'}</div>
                                </div>
                            </div>
                        </div>
                    `;
                }
            }
        ],
        order: [[0, 'desc']],
        responsive: true,
        dom: '<"top"f>rtp',
        language: {
            search: "",
            searchPlaceholder: "Search players or teams..."
        }
    });
}