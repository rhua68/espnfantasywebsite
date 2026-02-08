let allData = {}; 

$(document).ready(function() {
    fetch('league_data.json')
        .then(response => {
            if (!response.ok) throw new Error("Could not load league_data.json");
            return response.json();
        })
        .then(data => {
            allData = data;
            
            // 1. UPDATE THE FOOTER
            if (data.updated) {
                $('#last-updated').text(data.updated);
            }

            // 2. BUILD THE TRADE BLOCK (Left Side) - Updated for Likely/Maybe logic
            const tradeBlockList = $('#trade-block-list');
            tradeBlockList.empty();

            if (!data.trade_block || data.trade_block.length === 0) {
                tradeBlockList.append('<li class="list-group-item bg-transparent text-secondary italic">No players currently on the block.</li>');
            } else {
                data.trade_block.forEach(player => {
                    // Logic for dynamic badge styling based on status
                    const isLikely = player.status === "Likely";
                    const badgeClass = isLikely ? "bg-primary" : "bg-dark border border-secondary text-secondary";
                    const statusText = isLikely ? "LIKELY" : "MAYBE";

                    tradeBlockList.append(`
                        <li class="list-group-item bg-transparent border-bottom border-secondary-subtle px-0 py-3">
                            <div class="d-flex justify-content-between align-items-center">
                                <div>
                                    <div class="fw-bold text-white">${player.name}</div>
                                    <div class="text-primary x-small text-uppercase fw-bold" style="font-size: 0.7rem;">
                                        ${player.team}
                                    </div>
                                </div>
                                <span class="badge rounded-pill ${badgeClass}" style="font-size: 0.6rem; letter-spacing: 0.5px; min-width: 55px;">
                                    ${statusText}
                                </span>
                            </div>
                        </li>
                    `);
                });
            }

            // 3. AUTOMATICALLY BUILD THE DROPDOWN
            const availableYears = Object.keys(data.seasons).sort().reverse();
            const dropdownMenu = $('#year-dropdown-menu'); 
            dropdownMenu.empty();

            availableYears.forEach((year, index) => {
                const label = `${parseInt(year)-1}-${year.slice(-2)}`; 
                const activeClass = index === 0 ? 'active' : '';
                
                dropdownMenu.append(`
                    <li><a class="dropdown-item ${activeClass}" href="#" data-year="${year}">${label} Season</a></li>
                `);

                if (index === 0) {
                    $('#yearDropdown').text(`📅 ${label}`);
                    loadYearData(year);
                }
            });

            // 4. Handle Dynamic Dropdown Clicks
            $('#year-dropdown-menu').on('click', '.dropdown-item', function(e) {
                e.preventDefault();
                
                const selectedYear = $(this).attr('data-year');
                const seasonLabel = $(this).text().replace(' Season', '');

                // UI Updates
                $('.dropdown-item').removeClass('active');
                $(this).addClass('active');
                
                // Update the main dropdown button text
                $('#yearDropdown').text(`📅 ${seasonLabel}`);

                loadYearData(selectedYear);
            });
        })
        .catch(err => {
            console.error("Error loading JSON:", err);
            $('#last-updated').text("Sync Error");
        });
});

function loadYearData(year) {
    const trades = allData.seasons[year] || [];

    if ($.fn.DataTable.isDataTable('#trades-table')) {
        $('#trades-table').DataTable().destroy();
    }

    $('#trades-table').DataTable({
        data: trades,
        columnDefs: [
            { "defaultContent": "-", "targets": "_all" }
        ],
        columns: [
            { 
                data: 'date', 
                width: '15%', 
                render: function(data, type, row) {
                    if (type === 'sort') {
                        return row.sort_date ? row.sort_date : data;
                    }
                    return data;
                } 
            },
            { 
                data: null,
                render: function(row) {
                    if (!row.teams || row.teams.length < 2) {
                        return `<div class="p-2 text-center text-secondary italic">LM Transaction or Multi-Team Trade</div>`;
                    }

                    const teamA = row.teams[0];
                    const teamB = row.teams[1];
                    
                    const assets = row.assets || [];
                    const assetsFromA = assets.filter(a => a.from === teamA).map(a => a.player).join("<br>");
                    const assetsFromB = assets.filter(a => a.from === teamB).map(a => a.player).join("<br>");

                    return `
                        <div class="trade-assets-container">
                            <div class="row align-items-center mb-3 g-0">
                                <div class="col text-end">
                                    <span class="badge bg-primary text-uppercase">${teamA}</span>
                                </div>
                                <div class="col-auto px-3 text-center">
                                    <span class="text-secondary fw-bold handshake-icon">🤝</span>
                                </div>
                                <div class="col text-start">
                                    <span class="badge bg-info text-dark text-uppercase">${teamB}</span>
                                </div>
                            </div>

                            <div class="row text-center position-relative">
                                <div class="vertical-divider"></div>
                                
                                <div class="col-6 pe-4">
                                    <div class="text-primary x-small fw-bold mb-1">SENT TO ${teamB}:</div>
                                    <div class="small fw-bold text-white">${assetsFromA || 'None'}</div>
                                </div>
                                <div class="col-6 ps-4">
                                    <div class="text-info x-small fw-bold mb-1">SENT TO ${teamA}:</div>
                                    <div class="small fw-bold text-white">${assetsFromB || 'None'}</div>
                                </div>
                            </div>
                        </div>
                    `;
                }
            }
        ],
        order: [[0, 'desc']], 
        pageLength: 10,
        responsive: true,
        dom: '<"top"f>rt<"bottom"lp><"clear">',
        language: { 
            search: "", 
            searchPlaceholder: "Search players / team",
            emptyTable: "No trades found for this season."
        }
    });
}