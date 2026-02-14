import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    doc, 
    addDoc, 
    getDocs, 
    collection, 
    query, 
    where, 
    deleteDoc, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- INITIALIZATION ---
// This assumes window.db is already initialized in auth.js. 
// If not, uncomment the config below:
/*
const firebaseConfig = { ... };
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
*/

const db = window.db;

/* ============================================================
   1. DRAFT PICK SEEDER LOGIC
   ============================================================ */

$(document).on('click', '#runSeederBtn', async function() {
    const year = parseInt($('#seedYearSelect').val());
    const btn = $(this);
    const spinner = $('#seederSpinner');
    const status = $('#seederStatus');

    if (!confirm(`Are you sure you want to generate 3 rounds of picks for the ${year} season?`)) return;

    // UI Feedback
    btn.prop('disabled', true);
    spinner.removeClass('d-none');
    status.removeClass('text-danger text-success').addClass('text-info').text('Processing...');

    try {
        const teams = window.allData.rosters;
        const rounds = [1, 2, 3];
        let addedCount = 0;
        let skipCount = 0;

        for (const team of teams) {
            for (const round of rounds) {
                // Safety Check: Use ID for duplicate prevention
                const q = query(
                    collection(db, "draft_picks"),
                    where("year", "==", year),
                    where("round", "==", round),
                    where("originalOwnerId", "==", team.id)
                );
                
                const existing = await getDocs(q);
                
                if (existing.empty) {
                    await addDoc(collection(db, "draft_picks"), {
                        year: year,
                        round: round,
                        originalOwnerId: team.id,     // Robust ID reference
                        originalOwnerName: team.name, // Display reference
                        currentOwnerId: team.id,
                        type: "Rookie",
                        createdAt: serverTimestamp()
                    });
                    addedCount++;
                } else {
                    skipCount++;
                }
            }
        }
        status.removeClass('text-info').addClass('text-success').text(`Done! Added ${addedCount} picks. (Skipped ${skipCount} duplicates)`);
    } catch (err) {
        console.error(err);
        status.removeClass('text-info').addClass('text-danger').text('Error: ' + err.message);
    } finally {
        btn.prop('disabled', false);
        spinner.addClass('d-none');
    }
});

/* ============================================================
   2. DANGER ZONE: WIPE ALL PICKS
   ============================================================ */

$(document).on('click', '#clearPicksBtn', async function() {
    const btn = $(this);
    const spinner = $('#clearSpinner');
    const status = $('#clearStatus');

    // Triple-check confirmation
    if (!confirm("🚨 WARNING: This will delete EVERY pick in the database. Are you sure?")) return;
    if (!confirm("This action is permanent. Do you really want to proceed?")) return;

    btn.prop('disabled', true);
    spinner.removeClass('d-none');
    status.removeClass('text-success text-danger').addClass('text-info').text('Wiping database...');

    try {
        const picksRef = collection(db, "draft_picks");
        const snapshot = await getDocs(picksRef);

        if (snapshot.empty) {
            status.text('Database is already empty.');
            return;
        }

        // Delete documents one by one
        const deletePromises = [];
        snapshot.forEach((docSnap) => {
            deletePromises.push(deleteDoc(doc(db, "draft_picks", docSnap.id)));
        });

        await Promise.all(deletePromises);
        status.removeClass('text-info').addClass('text-success').text(`Success! Removed ${snapshot.size} picks.`);
    } catch (err) {
        console.error("Wipe Error:", err);
        status.removeClass('text-info').addClass('text-danger').text('Error: ' + err.message);
    } finally {
        btn.prop('disabled', false);
        spinner.addClass('d-none');
    }
});