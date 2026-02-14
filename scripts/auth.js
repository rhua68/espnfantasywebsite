import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, addDoc, getDoc, getDocs, collection, query, where, onSnapshot, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const getTeamName=(id) => {
        if(!window.allData || !window.allData.rosters) return `Team ${id}`;
        const team = window.allData.rosters.find(r=>r.id == id);
        return team ? team.name : `Team ${id}`;
    }


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
    const webhookURL = "https://discord.com/api/webhooks/1472118060746801235/Wdx5NnfYO-M4aKaCCVwBeT76psv8hvgjLGf7kBy3ssYbEkY_yBLjdsXgEDjxcADompKH"; // Replace with your URL
    const isVote = type === "voting";

    

    const senderName = getTeamName(tradeData.senderId);
    const receiverName = getTeamName(tradeData.receiverId);
    
    const message = {
        content: isVote ? "🗳️ **NEW LEAGUE POLL OPENED!**" : "🚨 **TRADE FINALIZED BY LEAGUE CONSENSUS!**",
        embeds: [{
            title: isVote ? "Vote Required" : "Consensus Reached",
            description: isVote 
                ? `${senderName} and ${receiverName} have proposed a deal.\n\n🔗 **[Cast your vote on the website](https://espnfantasywebsite-igh9kbiuk-rhua68s-projects.vercel.app/)**` 
                : "The trade has been officially pushed to ESPN.",
            fields: [
                { 
                    name: `📤 ${senderName} Sends`, 
                    value: tradeData.senderAssets.length > 0 ? tradeData.senderAssets.join(', ') : 'None', 
                    inline: true 
                },
                { 
                    name: `📥 ${receiverName} Sends`, 
                    value: tradeData.receiverAssets.length > 0 ? tradeData.receiverAssets.join(', ') : 'None', 
                    inline: true 
                }
            ],
            color: isVote ? 3447003 : 16758981,
            // Added a footer with the link to your site
            footer: { text: "DynastyHQ Trade Portal" }
        }]
    };

    try {
        await fetch(webhookURL, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(message) 
        });
    } catch (e) { 
        console.error("Discord Error:", e); 
    }
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

            // --- LIVE LEAGUE POLLS ---
            const votingQuery = query(collection(db, "pending_trades"), where("status", "==", "voting"));
            
            onSnapshot(votingQuery, (snapshot) => {
                const pollSection = $('#league-polls-section');
                const pollList = $('#polls-list');

                if (snapshot.empty) { 
                    pollSection.addClass('d-none'); 
                    pollList.empty();
                } else {
                    pollSection.removeClass('d-none');

                    snapshot.docChanges().forEach(async (change) => {
                        const tradeId = change.doc.id;

                        // HANDLE REMOVAL: When status changes from 'voting' to 'accepted' or doc is deleted
                        if (change.type === "removed") {
                            $(`[data-poll-id="${tradeId}"]`).fadeOut(300, function() {
                                $(this).remove();
                                if (pollList.children().length === 0) pollSection.addClass('d-none');
                            });
                            return;
                        }

                        // HANDLE ADD/UPDATE
                        if (change.type === "added" || change.type === "modified") {
                            const trade = change.doc.data();
                            const votes = trade.votes || {};

                            // 1. Expiration check (Keep logic inside listener)
                            if (trade.timestamp) {
                                const now = Math.floor(Date.now() / 1000);
                                if ((now - trade.timestamp.seconds) / 3600 >= 24) {
                                    await deleteDoc(doc(db, "pending_trades", tradeId));
                                    return;
                                }
                            }

                            // 2. Vote Counts
                            const approves = Object.values(votes).filter(v => v === 'approve').length;
                            const vetoes = Object.values(votes).filter(v => v === 'veto').length;
                            const currentVote = votes[window.currentUserTeamId];
                            const hasVoted = !!currentVote;

                            // 3. UI Styling
                            const glowClass = vetoes > 0 ? 'border-veto' : 'border-sakura';
                            const statusLabel = vetoes > 0 ? '⚠️ Trade Contested' : '🗳️ League Vote In Progress';

                            const pollHtml = `
                                <div class="col-md-6 mb-3" data-poll-id="${tradeId}">
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
                            `;

                            const existing = $(`[data-poll-id="${tradeId}"]`);
                            if (existing.length) {
                                existing.replaceWith(pollHtml);
                            } else {
                                pollList.append(pollHtml);
                            }
                        }
                    });
                }
            });

        } catch (error) { console.error("Auth Error:", error); }
    } else {
        loginBtn.text('Login').off('click').on('click', () => $('#loginModal').modal('show'));
        adminLink.addClass('d-none');
        window.currentUserTeamId = null;
        $('#league-polls-section').addClass('d-none'); 
        $('#polls-list').empty();
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
        
        //hide trading modal after trade concluded
        $('.modal').modal('hide');

        // Update trade status to accepted
        await updateDoc(tradeRef, { status: "accepted", finalizedAt: serverTimestamp() });


        // --- NEW: UPDATE DRAFT PICK OWNERSHIP IN FIRESTORE ---
        try {
            await processDraftPickTransfer(data);
            console.log("✅ Firestore Pick Ownership Updated");
        } catch (pickErr) {
            console.error("❌ Error transferring picks:", pickErr);
        }


        // Push Players to ESPN
        if (window.sendTradeToESPN) {
            const success = await window.sendTradeToESPN(data);
            if (success) {
                alert("✅ Consensus met! Trade pushed to ESPN & Picks updated.");
                await sendDiscordNotification(data, "finalized");
            } else {
                alert("⚠️ Consensus met, but ESPN player sync failed. Check Vercel logs.");
            }
        }

        

        // write to firebase trade_history collection
        await addDoc(collection(db, "trade_history"), {
            tradeId: tradeId,
            senderId: data.senderId,
            senderName: getTeamName(data.senderId),
            receiverId: data.receiverId,
            receiverName: getTeamName(data.receiverId),
            assetsSent: data.senderAssets,
            assetsReceived: data.receiverAssets,
            type: data.senderPlayerIds.length > 0 && data.receiverPlayerIds.length > 0 ? "Players-Only" : "Pick-Involved",
            finalizedAt: serverTimestamp()

            
        });

        
        
        
    }
});

// --- HELPER FUNCTION: TRANSFER PICK OWNERSHIP ---
async function processDraftPickTransfer(tradeData) {
    const transfers = [
        { assets: tradeData.senderAssets, newOwnerId: tradeData.receiverId },
        { assets: tradeData.receiverAssets, newOwnerId: tradeData.senderId }
    ];

    for (const group of transfers) {
        for (const assetName of group.assets) {
            // Regex to find strings like "2026 Rd 1"
            const pickMatch = assetName.match(/(\d{4}) Rd (\d+)/);
            if (pickMatch) {
                const year = parseInt(pickMatch[1]);
                const round = parseInt(pickMatch[2]);

                // Query for the specific pick
                const q = query(
                    collection(db, "draft_picks"),
                    where("year", "==", year),
                    where("round", "==", round)
                );

                const snap = await getDocs(q);
                // Update the currentOwnerId for any matching pick found
                const updatePromises = [];
                snap.forEach((docSnap) => {
                    updatePromises.push(updateDoc(doc(db, "draft_picks", docSnap.id), {
                        currentOwnerId: group.newOwnerId
                    }));
                });
                await Promise.all(updatePromises);
            }
        }
    }
}

window.getTeamName = getTeamName;
window.sendDiscordNotification = sendDiscordNotification;

$(document).ready(function() {
    $('#doLogin').on('click', function() {
        handleLogin($('#loginEmail').val(), $('#loginPassword').val());
    });
});