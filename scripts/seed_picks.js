import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. Firebase Configuration (Matches your auth.js)
const firebaseConfig = {
    apiKey: "AIzaSyBb9gMG8_QbHApFJ9wWIBANAd05qWrPTZw",
    authDomain: "dynastyhq-e9aa7.firebaseapp.com",
    projectId: "dynastyhq-e9aa7",
    storageBucket: "dynastyhq-e9aa7.firebasestorage.app",
    messagingSenderId: "1022459584904",
    appId: "1:1022459584904:web:e547be4ad61e425b939a3d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * AUTOMATED ANNUAL PICK SEEDER
 * Run this once per year (e.g., every October) to add a new draft year.
 */
async function generateAnnualPicks(newYear) {
    console.log(`🚀 Starting pick generation for the ${newYear} Draft...`);

    try {
        // Fetch your current rosters from your hosted JSON
        const response = await fetch('../league_data.json');
        const data = await response.json();
        const teams = data.rosters;

        const rounds = [1, 2, 3]; // Your 3-round rookie draft setup

        for (const team of teams) {
            console.log(`Processing: ${team.name} (ID: ${team.id})`);

            for (const round of rounds) {
                // Safety Check: Avoid duplicates if script is run twice by mistake
                const q = query(
                    collection(db, "draft_picks"),
                    where("year", "==", newYear),
                    where("round", "==", round),
                    where("originalOwner", "==", team.name),
                    where("originalOwnerId", "==", team.id)

                );
                
                const existing = await getDocs(q);
                if (!existing.empty) {
                    console.warn(`⚠️ Skipping: ${newYear} Rd ${round} for ${team.name} (Already exists)`);
                    continue;
                }

                // Add the pick
                await addDoc(collection(db, "draft_picks"), {
                    year: newYear,
                    round: round,
                    originalOwnerId: team.id,
                    originalOwnerName: team.name,
                    currentOwnerId: team.id, // Defaults to the original owner
                    type: "Rookie"
                });
                
                console.log(`✅ Added: ${newYear} Rd ${round}`);
            }
        }
        console.log(`✨ Successfully populated all ${newYear} picks!`);
    } catch (error) {
        console.error("❌ Seeding failed:", error);
    }
}

// To run for 2029 (since you already have 2026-2028):
// generateAnnualPicks(2029);

export { generateAnnualPicks };


