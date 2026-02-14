import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    doc, 
    addDoc, 
    getDoc,
    updateDoc,
    getDocs, 
    collection, 
    query, 
    where, 
    deleteDoc, 
    serverTimestamp,
    onSnapshot,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Heartbeat to confirm script loaded
console.log("🚀 admin.js: Module loaded successfully.");

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
                        originalOwnerId: team.id,
                        originalOwnerName: team.name,
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

    if (!confirm("🚨 WARNING: This will delete EVERY pick in the database. Are you sure?")) return;
    if (!confirm("This action is permanent. Do you really want to proceed?")) return;

    btn.prop('disabled', true);
    spinner.removeClass('d-none');
    status.removeClass('text-success text-danger').addClass('text-info').text('Wiping database...');

    try {
        const snapshot = await getDocs(collection(db, "draft_picks"));
        const deletePromises = snapshot.docs.map(docSnap => deleteDoc(doc(db, "draft_picks", docSnap.id)));
        await Promise.all(deletePromises);
        status.removeClass('text-info').addClass('text-success').text(`Success! Removed ${snapshot.size} picks.`);
    } catch (err) {
        status.removeClass('text-info').addClass('text-danger').text('Error: ' + err.message);
    } finally {
        btn.prop('disabled', false);
        spinner.addClass('d-none');
    }
});

/* ============================================================
   3. MANUAL PICK MOVE: RE-BOUND LISTENER
   ============================================================ */
// Use document.on to ensure late-loading HTML elements are caught
$(document).on('click', '#updateManualPickBtn', async function(e) {
    e.preventDefault();
    
    const btn = $(this);
    const status = $('#manualPickStatus');
    
    // 1. Grab values
    const raw = {
        year: $('#manualYearSelect').val(),
        round: $('#manualRoundSelect').val(),
        orig: $('#manualOrigOwner').val(),
        new: $('#manualNewOwner').val()
    };

    // 2. Validate - If any value is missing, stop here
    if (Object.values(raw).some(val => !val)) {
        $('#manualPickStatus').addClass('text-danger').text('Please fill all fields.');
        console.error("❌ Form Incomplete:", raw);
        return;
    }

    // 3. Convert to Numbers for Firestore
    const year = parseInt(raw.year);
    const round = parseInt(raw.round);
    const origOwnerId = parseInt(raw.orig);
    const newOwnerId = parseInt(raw.new);

    status.removeClass('text-danger text-success').text('Processing...');
    btn.prop('disabled', true).text('Updating...');

    try {
        const picksRef = collection(db, "draft_picks");
        const q = query(
            picksRef,
            where("year", "==", year),
            where("round", "==", round),
            where("originalOwnerId", "==", origOwnerId)
        );
        
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.error("❌ FAILED: No match in Firestore for query.");
            status.addClass('text-danger').text('Pick not found in database.');
            return;
        }

        // Perform the Update on the first matching document
        const docId = querySnapshot.docs[0].id;
        await updateDoc(doc(db, "draft_picks", docId), {
            currentOwnerId: newOwnerId,
            updatedAt: serverTimestamp()
        });

        // --- VERIFICATION LOG ---
        const verifyDoc = await getDoc(doc(db, "draft_picks", docId));
        const updatedData = verifyDoc.data();

        if (updatedData.currentOwnerId === newOwnerId) {
            console.log(`%c ✅ VERIFIED: ${year} Rd ${round} moved to Team ${newOwnerId}`, "color: #00ff00; font-weight: bold;");
            status.removeClass('text-danger').addClass('text-success').text('Pick successfully moved!');
        } else {
            console.error("❌ VERIFICATION FAILED: DB value didn't change.");
            status.addClass('text-danger').text('Update failed to verify.');
        }

        // Reset dropdowns
        $('#manualOrigOwner, #manualNewOwner').val("").trigger('change');

    } catch (err) {
        console.error("Manual Move Error:", err);
        status.addClass('text-danger').text('Error: ' + err.message);
    } finally {
        btn.prop('disabled', false).text('Update Pick');
    }
});

/* ============================================================
   4. LIVE VIEW TABLE
   ============================================================ */
const qPicks = query(collection(db, "draft_picks"), orderBy("year", "desc"), orderBy("round", "asc"));

onSnapshot(qPicks, (snapshot) => {
    const tbody = $('#picksTableBody');
    if (!tbody.length) return; 
    
    tbody.empty();

    snapshot.forEach((docSnap) => {
        const pick = docSnap.data();
        const isMoved = pick.originalOwnerId !== pick.currentOwnerId;
        
        const getOwnerName = (id) => {
            const team = window.allData?.rosters?.find(t => t.id == id);
            return team ? team.name : `Team ${id}`;
        };

        tbody.append(`
            <tr>
                <td>${pick.year} - Rd ${pick.round}</td>
                <td>${pick.originalOwnerName}</td>
                <td class="${isMoved ? 'text-warning' : 'text-white'}">${getOwnerName(pick.currentOwnerId)}</td>
                <td><span class="badge ${isMoved ? 'bg-warning text-dark' : 'bg-success'}">${isMoved ? 'Traded' : 'Original'}</span></td>
            </tr>
        `);
    });
});