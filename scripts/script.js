import { 
    collection, 
    addDoc, 
    query, 
    where, 
    getDocs, 
    onSnapshot, 
    serverTimestamp, 
    doc, 
    updateDoc, 
    deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ============================================================
   1. GLOBAL STATE & INITIALIZATION
   ============================================================ */
window.allData = window.allData || {}; 
let selectedAssets = { mine: [], theirs: [] };

$(document).ready(function() {
    // Cache-busting prevents old data from appearing after updates
    fetch(`../league_data.json?v=${new Date().getTime()}`)
        .then(response => {
            if (!response.ok) throw new Error("Could not load league_data.json");
            return response.json();
        })
        .then(data => {
            // Save to window so the Trade Modal can access it from any page
            window.allData = data;
            
            // Update Footer
            if (data.updated) {
                $('#last-updated').text(data.updated);
            }

            // Render components (Checks if elements exist on current page)
            if ($('#trade-block-list').length) renderTradeBlock(data.trade_block);
            if ($('#year-dropdown-menu').length) setupYearDropdown(data.seasons);
        })
        .catch(err => {
            console.error("Error loading JSON:", err);
            $('#last-updated').text("Sync Error");
        });

    // Link Login Modal Button
    $('#doLogin').on('click', function() {
        const email = $('#loginEmail').val();
        const password = $('#loginPassword').val();
        if (window.handleLogin) window.handleLogin(email, password);
    });
});

/* ============================================================
   2. TRADE MODAL LOGIC (New Additions)
   ============================================================ */

// Open Modal
$(document).on('click', '.open-trade-modal', async function() {
    if (!window.currentUserTeamId) {
        alert("Please log in to propose a trade!");
        return;
    }
    const receiverId = $(this).data('team-id');
    const receiverName = $(this).data('team-name');
    
    $('#receiver-name').text(receiverName);
    $('#submitTrade').data('receiver-id', receiverId);
    
    selectedAssets = { mine: [], theirs: [] };
    $('#tradeModal').modal('show');

    populateTradeAssets(window.currentUserTeamId, '#my-assets-list', 'mine');
    populateTradeAssets(receiverId, '#their-assets-list', 'theirs');
});

// Fetch Assets for Modal
async function populateTradeAssets(teamId, containerId, side) {
    const container = $(containerId).empty().append('<div class="text-center py-3"><div class="spinner-border text-primary spinner-border-sm"></div></div>');
    
    if (!window.allData || !window.allData.rosters) {
        container.html('<div class="text-danger small">Data not loaded.</div>');
        return;
    }

    const teamData = window.allData.rosters.find(r => r.id == teamId);
    let html = `<div class="fw-bold text-primary small mb-2 uppercase">Players</div>`;
    
    if(teamData && teamData.players) {
        teamData.players.forEach(p => {
            html += `<div class="asset-item" data-name="${p.name}" data-side="${side}">${p.name}</div>`;
        });
    }

    try {
        const q = query(collection(window.db, "draft_picks"), where("currentOwnerId", "==", parseInt(teamId)));
        const snapshot = await getDocs(q);
        html += `<div class="fw-bold text-primary small mt-3 mb-2 uppercase">Draft Picks</div>`;
        
        snapshot.forEach(docSnap => {
            const p = docSnap.data();
            html += `<div class="asset-item" data-name="${p.year} Rd ${p.round}" data-side="${side}">${p.year} Rd ${p.round}</div>`;
        });
    } catch (e) {
        console.error("Error fetching picks:", e);
    }
    container.html(html);
}

// Asset Selection Toggle
$(document).on('click', '.asset-item', function() {
    const name = $(this).data('name');
    const side = $(this).data('side');
    $(this).toggleClass('active');
    
    if (selectedAssets[side].includes(name)) {
        selectedAssets[side] = selectedAssets[side].filter(a => a !== name);
    } else {
        selectedAssets[side].push(name);
    }
});

// Submit Trade
$('#submitTrade').on('click', async function() {
    const receiverId = $(this).data('receiver-id');
    if (selectedAssets.mine.length === 0 && selectedAssets.theirs.length === 0) {
        alert("Please select at least one asset."); return;
    }

    const tradeData = {
        senderId: window.currentUserTeamId,
        receiverId: parseInt(receiverId),
        senderAssets: selectedAssets.mine,
        receiverAssets: selectedAssets.theirs,
        status: "pending",
        timestamp: serverTimestamp()
    };

    try {
        await addDoc(collection(window.db, "pending_trades"), tradeData);
        alert("Trade Request Sent!");
        $('#tradeModal').modal('hide');
    } catch (e) { console.error("Error:", e); }
});

// Accept/Decline UI
$(document).on('click', '.decline-btn', async function() {
    const tradeId = $(this).data('id');
    if(confirm("Decline this trade?")) await deleteDoc(doc(window.db, "pending_trades", tradeId));
});

$(document).on('click', '.accept-btn', async function() {
    const tradeId = $(this).data('id');
    await updateDoc(doc(window.db, "pending_trades", tradeId), { status: "accepted" });
    alert("Trade accepted!");
});

/* ============================================================
   3. RECENT TRADES & TRADE BLOCK FUNCTIONS (Preserved)
   ============================================================ */

function renderTradeBlock(players) {
    const list = $('#trade-block-list').empty();
    if (!players || players.length === 0) {
        list.append('<li class="list-group-item bg-transparent text-secondary italic small">No players on block.</li>');
        return;
    }
    players.forEach(p => {
        const badgeClass = p.status === "Likely" ? "bg-primary" : "bg-dark border border-secondary text-secondary";
        list.append(`
            <li class="list-group-item bg-transparent border-bottom border-secondary-subtle px-0 py-2">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <div class="fw-bold text-white small">${p.name}</div>
                        <div class="text-primary x-small text-uppercase fw-bold">${p.team}</div>
                    </div>
                    <span class="badge rounded-pill ${badgeClass}" style="font-size: 0.55rem;">${p.status.toUpperCase()}</span>
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
    menu.on('click', '.dropdown-item', function(e) {
        e.preventDefault();
        const selectedYear = $(this).attr('data-year');
        $('.dropdown-item').removeClass('active');
        $(this).addClass('active');
        $('#yearDropdown').text(`📅 ${$(this).text().replace(' Season','')}`);
        loadYearData(selectedYear);
    });
}

function loadYearData(year) {
    const trades = window.allData.seasons[year] || [];
    if ($.fn.DataTable.isDataTable('#trades-table')) $('#trades-table').DataTable().destroy();
    
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
                        const team = window.allData.rosters.find(r => r.name === fullName);
                        return team ? team.abbrev : fullName.substring(0, 3).toUpperCase();
                    };

                    const abbrA = getAbbr(tA);
                    const abbrB = getAbbr(tB);
                    const assetsA = (row.assets || []).filter(a => a.from === tA).map(a => a.player).join("<br>");
                    const assetsB = (row.assets || []).filter(a => a.from === tB).map(a => a.player).join("<br>");

                    return `
                        <div class="trade-assets-container p-2">
                            <div class="row g-0 position-relative mb-3 align-items-center d-none d-md-flex">
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