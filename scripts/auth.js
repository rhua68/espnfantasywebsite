import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// Make global for other scripts
window.auth = auth;
window.db = db;

export async function handleLogin(email, password) {
    try {
        await signInWithEmailAndPassword(auth, email, password);
        $('#loginModal').modal('hide'); 
    } catch (error) {
        alert("Login failed: " + error.message);
    }
}

// Attach to window so modular script.js can see it
window.handleLogin = handleLogin;

export async function handleLogout() {
    try {
        await signOut(window.auth);
        window.location.reload(); 
    } catch (error) {
        console.error("Logout Error:", error.message);
    }
}

// Watch state
onAuthStateChanged(auth, async (user) => {
    const loginBtn = $('#login-nav-btn');
    
    if (user) {
        loginBtn.text('Logout').off('click').on('click', handleLogout);
        console.log("Logged in as:", user.email);

        try {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                window.currentUserTeamId = userData.espnTeamId; 
                console.log(`User linked to Team ID: ${userData.espnTeamId}`);

                if (window.location.pathname.includes('rosters.html')) {
                    const myTeamCard = $(`.team-card[data-team-id="${userData.espnTeamId}"]`);
                    
                    // 1. Remove the Trade button for your own team
                    myTeamCard.find('.open-trade-modal').remove();
                    
                    // 2. Add the Sakura Pink label
                    if (myTeamCard.find('.your-team-label').length === 0) {
                        myTeamCard.find('.card-header .d-flex.gap-2').append(
                            `<span class="badge badge-sakura px-3 py-2 your-team-label text-uppercase">🌸 Your Team</span>`
                        );
                        
                        // 3. Optional: Add a subtle pink glow to your card border
                        myTeamCard.find('.card').css('border', '1px solid #ffb7c5');
                    }
                }

                // --- LIVE TRADE NOTIFICATIONS ---
                // Only runs if the user has an espnTeamId linked
                const tradeQuery = query(
                    collection(db, "pending_trades"), 
                    where("receiverId", "==", userData.espnTeamId),
                    where("status", "==", "pending")
                );

                onSnapshot(tradeQuery, (snapshot) => {
                    const section = $('#incoming-trades-section');
                    const list = $('#incoming-trades-list').empty();

                    if (snapshot.empty) {
                        section.addClass('d-none');
                    } else {
                        section.removeClass('d-none');
                        snapshot.forEach(docSnap => {
                            const trade = docSnap.data();
                            list.append(`
                                <div class="col-md-6">
                                    <div class="p-3 border border-secondary rounded bg-black">
                                        <div class="small fw-bold text-white mb-2">Offer From: Team ${trade.senderId}</div>
                                        <div class="row x-small">
                                            <div class="col-6 text-info">YOU GET: <br> ${trade.senderAssets.join(', ') || 'None'}</div>
                                            <div class="col-6 text-danger">YOU GIVE: <br> ${trade.receiverAssets.join(', ') || 'None'}</div>
                                        </div>
                                        <div class="mt-3 d-flex gap-2">
                                            <button class="btn btn-success btn-sm w-100 fw-bold accept-btn" data-id="${docSnap.id}">Accept</button>
                                            <button class="btn btn-outline-danger btn-sm w-100 fw-bold decline-btn" data-id="${docSnap.id}">Decline</button>
                                        </div>
                                    </div>
                                </div>
                            `);
                        });
                    }
                });
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
        }
    if (window.location.pathname.includes('rosters.html')) {
    // Re-run the roster render or hide the button if it's our team
        $(`.team-card[data-team-id="${userData.espnTeamId}"] .open-trade-modal`).hide();
    }

    } else {
        loginBtn.text('Login').off('click').on('click', () => $('#loginModal').modal('show'));
        window.currentUserTeamId = null;
        $('#incoming-trades-section').addClass('d-none'); // Hide if logged out
    }
});

$(document).ready(function() {
    $('#doLogin').on('click', function() {
        const email = $('#loginEmail').val();
        const password = $('#loginPassword').val();
        handleLogin(email, password);
    });
});