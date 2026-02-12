import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, onSnapshot, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBb9gMG8_QbHApFJ9wWIBANAd05qWrPTZw",
    authDomain: "dynastyhq-e9aa7.firebaseapp.com",
    projectId: "dynastyhq-e9aa7",
    storageBucket: "dynastyhq-e9aa7.firebasestorage.app",
    messagingSenderId: "1022459584904",
    appId: "1:1022459584904:web:e547be4ad61e425b939a3d",
    measurementId: "G-BY3K8M64HC"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

window.auth = auth;
window.db = db;

// --- AUTH FUNCTIONS ---
export async function handleLogin(email, password) {
    try {
        await signInWithEmailAndPassword(auth, email, password);
        $('#loginModal').modal('hide'); 
    } catch (error) {
        alert("Login failed: " + error.message);
    }
}
window.handleLogin = handleLogin;

export async function handleLogout() {
    try {
        await signOut(window.auth);
        window.location.reload(); 
    } catch (error) {
        console.error("Logout Error:", error.message);
    }
}

// --- NOTIFICATION & FINALIZATION LOGIC ---

async function sendDiscordNotification(tradeData, type = "finalized") {
    const webhookURL = "YOUR_DISCORD_WEBHOOK_URL"; // Replace with your URL
    const isVote = type === "voting";
    
    const message = {
        content: isVote ? "🗳️ **NEW LEAGUE POLL OPENED!**" : "🚨 **TRADE FINALIZED BY LEAGUE CONSENSUS!**",
        embeds: [{
            title: isVote ? "Vote Required" : "Consensus Reached",
            description: isVote ? "A new trade proposal is up for review." : "The trade has been officially pushed to ESPN.",
            fields: [
                { name: "Sender Assets", value: tradeData.senderAssets.join(', '), inline: true },
                { name: "Receiver Assets", value: tradeData.receiverAssets.join(', '), inline: true }
            ],
            color: isVote ? 3447003 : 16758981 
        }]
    };
    try {
        await fetch(webhookURL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(message) });
    } catch (e) { console.error("Discord Error:", e); }
}

onAuthStateChanged(auth, async (user) => {
    const loginBtn = $('#login-nav-btn');
    const adminLink = $('#admin-link');
    const ADMIN_UID = "KTbGiCum1sdWftINswO89nVax0a2"; 

    if (user) {
        loginBtn.text('Logout').off('click').on('click', handleLogout);
        if (user.uid === ADMIN_UID) adminLink.removeClass('d-none'); else adminLink.addClass('d-none');

        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                window.currentUserTeamId = userData.espnTeamId; 
                
                // Roster Highlight for "Your Team"
                if (window.location.pathname.includes('rosters.html')) {
                    const myTeamCard = $(`.team-card[data-team-id="${userData.espnTeamId}"]`);
                    myTeamCard.find('.open-trade-modal').remove();
                    if (myTeamCard.find('.your-team-label').length === 0) {
                        myTeamCard.find('.card-header .d-flex.gap-2').append(`<span class="badge badge-sakura px-3 py-2 your-team-label text-uppercase">🌸 Your Team</span>`);
                        myTeamCard.find('.card').css('border', '1px solid #ffb7c5');
                    }
                }
            }

            // --- LIVE LEAGUE POLLS (Visible to all logged-in users) ---
            const votingQuery = query(collection(db, "pending_trades"), where("status", "==", "voting"));
            onSnapshot(votingQuery, (snapshot) => {
                const pollSection = $('#league-polls-section');
                const pollList = $('#polls-list').empty();

                if (snapshot.empty) { 
                    pollSection.addClass('d-none'); 
                } else {
                    pollSection.removeClass('d-none');
                    snapshot.forEach(async (docSnap) => {
                        const trade = docSnap.data();
                        const tradeId = docSnap.id;
                        const votes = trade.votes || {};

                        // 1. Check for 24-hour expiration
                        if (trade.timestamp) {
                            const now = Math.floor(Date.now() / 1000);
                            if ((now - trade.timestamp.seconds) / 3600 >= 24) {
                                await deleteDoc(doc(db, "pending_trades", tradeId));
                                return;
                            }
                        }

                        // 2. Calculate Vote Counts
                        const approves = Object.values(votes).filter(v => v === 'approve').length;
                        const vetoes = Object.values(votes).filter(v => v === 'veto').length;
                        
                        // 3. User-Specific Vote State
                        const currentVote = votes[window.currentUserTeamId]; // 'approve', 'veto', or undefined
                        const hasVoted = !!currentVote;

                        // 4. UI Styling logic
                        const glowClass = vetoes > 0 ? 'border-veto' : 'border-sakura';
                        const statusLabel = vetoes > 0 ? '⚠️ Trade Contested' : '🗳️ League Vote In Progress';

                        pollList.append(`
                            <div class="col-md-6 mb-3">
                                <div class="card ${glowClass} p-3 shadow-sm" style="background: black !important; overflow: visible !important;">
                                    <div class="x-small text-uppercase text-white opacity-75 fw-bold mb-1">
                                        ${statusLabel}
                                    </div>
                                    
                                    <div class="small text-white fw-bold mb-2">
                                        ${trade.senderAssets.join(', ')} <span class="text-secondary">↔️</span> ${trade.receiverAssets.join(', ')}
                                    </div>
                                    
                                    <div class="progress mb-2" style="height: 8px; background: #1a1a1a;">
                                        <div class="progress-bar bg-success" style="width: ${(approves / 6) * 100}%; transition: 0.5s;"></div>
                                    </div>
                                    
                                    <div class="d-flex justify-content-between x-small text-secondary mb-3">
                                        <span class="text-white">${approves}/6 Approvals</span>
                                        <span class="${hasVoted ? 'text-success' : 'text-warning'}">
                                            ${vetoes > 0 ? `<span class="text-danger fw-bold">${vetoes} VETOS</span> | ` : ''}
                                            ${hasVoted ? '✅ Recorded' : '⌛ Awaiting Vote'}
                                        </span>
                                    </div>
                                    
                                    <div class="d-flex gap-2">
                                        <button class="btn btn-sm w-100 fw-bold vote-btn ${currentVote === 'approve' ? 'btn-success' : 'btn-outline-success'}" 
                                                data-id="${tradeId}" data-type="approve">
                                            ${currentVote === 'approve' ? '✅ Approved' : 'Approve'}
                                        </button>
                                        <button class="btn btn-sm w-100 fw-bold vote-btn ${currentVote === 'veto' ? 'btn-danger' : 'btn-outline-danger'}" 
                                                data-id="${tradeId}" data-type="veto">
                                            ${currentVote === 'veto' ? '🚫 Vetoed' : 'Veto'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `);
                    });
                }
            });

        } catch (error) { console.error("Auth Error:", error); }
    } else {
        loginBtn.text('Login').off('click').on('click', () => $('#loginModal').modal('show'));
        adminLink.addClass('d-none');
        window.currentUserTeamId = null;
        $('#league-polls-section').addClass('d-none'); 
    }
});

// --- VOTING ACTIONS ---

$(document).on('click', '.vote-btn', async function() {
    const tradeId = $(this).data('id');
    const voteType = $(this).data('type');
    const tradeRef = doc(db, "pending_trades", tradeId);

    // Record Vote
    await updateDoc(tradeRef, { [`votes.${window.currentUserTeamId}`]: voteType });

    const snap = await getDoc(tradeRef);
    const data = snap.data();
    const approves = Object.values(data.votes || {}).filter(v => v === 'approve').length;
    const vetoes = Object.values(data.votes || {}).filter(v => v === 'veto').length;

    // Threshold Check
    if (vetoes >= 6) {
        alert("🚨 Trade Vetoed. It will be removed from the league polls.");
        await deleteDoc(tradeRef);
    } else if (approves >= 2) { // ❗❗FOR TESTING CHANGE BACK TO 6 FOR PRODUCTION❗❗
        await updateDoc(tradeRef, { status: "accepted", finalizedAt: serverTimestamp() });
        
        // Push to ESPN
        if (window.sendTradeToESPN) {
            const success = await window.sendTradeToESPN(data);
            if (success) {
                alert("✅ Consensus met! Trade pushed to ESPN.");
                await sendDiscordNotification(data, "finalized");
            } else {
                alert("⚠️ Consensus met, but ESPN sync failed. Check Vercel logs.");
            }
        }
    }
});

$(document).ready(function() {
    $('#doLogin').on('click', function() {
        handleLogin($('#loginEmail').val(), $('#loginPassword').val());
    });
});