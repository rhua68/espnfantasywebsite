let allData = {}; 

$(document).ready(function() {
    fetch('league_data.json')
        .then(response => {
            if (!response.ok) throw new Error("Could not load league_data.json");
            return response.json();
        })
        .then(data => {
            allData = data;
            
            // 1. UPDATE THE FOOTER (Matches roster.js logic)
            if (data.updated) {
                $('#last-updated').text(data.updated);
            }

            // 2. Initialize the table with the most recent year
            const availableYears = Object.keys(data.seasons).sort().reverse();
            const defaultYear = availableYears[0] || "2026";
            
            loadYearData(defaultYear);

            // 3. Handle Tab Clicks (Targeted specifically to #yearTabs)
            $('#yearTabs .nav-link').off('click').on('click', function(e) {
                e.preventDefault();
                
                // UI update: toggle active class
                $('#yearTabs .nav-link').removeClass('active');
                $(this).addClass('active');
                
                const selectedYear = $(this).attr('data-year');
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