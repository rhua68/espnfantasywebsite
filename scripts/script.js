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
    deleteDoc,
    orderBy 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ============================================================
   1. GLOBAL STATE & INITIALIZATION
   ============================================================ */
window.allData = window.allData || {}; 
let selectedAssets = { mine: [], theirs: [] };

$(document).ready(function() {
    // Cache-busting ensures fresh data on every load
    fetch(`../league_data.json?v=${new Date().getTime()}`)
        .then(response => {
            if (!response.ok) throw new Error("Could not load league_data.json");
            return response.json();
        })
        .then(data => {
            window.allData = data;
            
            // Update Footer Timestamp
            if (data.updated) $('#last-updated').text(data.updated);

            // Render Page Components
            if ($('#trade-block-list').length) renderTradeBlock(data.trade_block);
            if ($('#year-dropdown-menu').length) setupYearDropdown(data.seasons);
        })
        .catch(err => {
            console.error("Error loading JSON:", err);
            $('#last-updated').text("Sync Error");
        });
});

/* ============================================================
   2. TRADE MODAL & LEAGUE VOTING SYSTEM
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

// Fetch Assets for Modal with Sorting
async function populateTradeAssets(teamId, containerId, side) {
    const container = $(containerId).empty().append('<div class="text-center py-3"><div class="spinner-border text-primary spinner-border-sm"></div></div>');
    const teamData = window.allData.rosters.find(r => r.id == teamId);
    let html = `<div class="fw-bold text-primary small mb-2 uppercase">Players</div>`;
    
    if(teamData && teamData.players) {
        teamData.players.forEach(p => {
            html += `<div class="asset-item" data-name="${p.name}" data-side="${side}">${p.name}</div>`;
        });
    }

    try {
        const q = query(
            collection(window.db, "draft_picks"), 
            where("currentOwnerId", "==", parseInt(teamId)),
            orderBy("year", "asc"),
            orderBy("round", "asc")
        );
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

// Toggle Asset Selection
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

// Helper: Map Player Name to ESPN ID
const getPlayerId = (name) => {
    if (!window.allData.rosters) return null;
    const team = window.allData.rosters.find(r => r.players.some(p => p.name === name));
    return team ? team.players.find(p => p.name === name).id : null;
};

// ESPN Trade Execution (called by voting system in auth.js when consensus is reached)
window.sendTradeToESPN = async function(tradeData) {
    try {
        const response = await fetch('/api/execute_trade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                senderId: tradeData.senderId,
                receiverId: tradeData.receiverId,
                senderPlayerIds: tradeData.senderPlayerIds,
                receiverPlayerIds: tradeData.receiverPlayerIds
            })
        });
        
        if (!response.ok) {
            console.error('ESPN API Error:', await response.text());
            return false;
        }
        
        const result = await response.json();
        console.log('ESPN Response:', result);
        return result.status === 'success';
    } catch (error) {
        console.error("ESPN Sync Error:", error);
        return false;
    }
};

// Submit Trade to Firestore for League Voting (NOT directly to ESPN)
$('#submitTrade').on('click', async function() {
    const btn = $(this);
    const receiverId = btn.data('receiver-id');
    const spinner = $('#submitSpinner');
    const btnText = $('#submitText');

    if (selectedAssets.mine.length === 0 && selectedAssets.theirs.length === 0) {
        alert("Please select assets."); 
        return;
    }

    const tradeData = {
        senderId: window.currentUserTeamId,
        receiverId: parseInt(receiverId),
        senderAssets: selectedAssets.mine,
        receiverAssets: selectedAssets.theirs,
        senderPlayerIds: selectedAssets.mine.map(n => getPlayerId(n)).filter(id => id),
        receiverPlayerIds: selectedAssets.theirs.map(n => getPlayerId(n)).filter(id => id),
        status: "voting",  // Trade goes to league poll
        timestamp: serverTimestamp(),
        votes: {}  // Initialize empty votes object
    };

    // UI Feedback
    btn.prop('disabled', true);
    if(spinner.length) spinner.removeClass('d-none');
    if(btnText.length) btnText.text('Submitting to League Poll...'); 
    else btn.text('Submitting...');

    try {
        // Save to Firestore - this triggers the league poll system
        await addDoc(collection(window.db, "pending_trades"), tradeData);
        
        alert("✅ Trade submitted to league poll! Managers will vote on it.");
        $('#tradeModal').modal('hide');
    } catch (e) {
        console.error(e);
        alert("❌ Error submitting trade.");
    } finally { 
        btn.prop('disabled', false); 
        if(spinner.length) spinner.addClass('d-none');
        if(btnText.length) btnText.text('Send Trade Request'); 
        else btn.text('Submit Trade');
    }
});

/* ============================================================
   3. UI COMPONENTS (Trade Block & Year Dropdown)
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
            $('#yearDropdown').text(`📅 ${label} Season`);
            loadYearData(year); 
        }
    });

    menu.on('click', '.dropdown-item', function(e) {
        e.preventDefault();
        const yr = $(this).attr('data-year');
        $('.dropdown-item').removeClass('active');
        $(this).addClass('active');
        $('#yearDropdown').text(`📅 ${$(this).text()}`);
        loadYearData(yr);
    });
}

function loadYearData(year) {
    const trades = window.allData.seasons[year] || [];
    if ($.fn.DataTable.isDataTable('#trades-table')) $('#trades-table').DataTable().destroy();
    
    $('#trades-table').DataTable({
        data: trades,
        columns: [
            { data: 'date', width: '15%' },
            { 
                data: null,
                render: row => `
                    <div class="trade-assets-container p-2">
                        <div class="row text-center position-relative g-0">
                            <div class="col-12 col-md-6 pb-3 pb-md-0 border-bottom-mobile">
                                <div class="text-primary x-small fw-bold mb-1">${row.teams[0]} SENT:</div>
                                <div class="small fw-bold text-white">${row.assets.filter(a => a.from === row.teams[0]).map(a => a.player).join("<br>")}</div>
                            </div>
                            <div class="col-12 col-md-6 pt-3 pt-md-0">
                                <div class="text-info x-small fw-bold mb-1">${row.teams[1]} SENT:</div>
                                <div class="small fw-bold text-white">${row.assets.filter(a => a.from === row.teams[1]).map(a => a.player).join("<br>")}</div>
                            </div>
                        </div>
                    </div>`
            }
        ],
        order: [[0, 'desc']],
        responsive: true,
        dom: 'rtp'
    });
}