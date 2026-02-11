import { collection, addDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
                // Check if this specific pick already exists
                const q = query(
                    collection(window.db, "draft_picks"),
                    where("year", "==", year),
                    where("round", "==", round),
                    where("originalOwner", "==", team.name)
                );
                
                const existing = await getDocs(q);
                
                if (existing.empty) {
                    await addDoc(collection(window.db, "draft_picks"), {
                        year: year,
                        round: round,
                        originalOwner: team.name,
                        currentOwnerId: team.id,
                        type: "Rookie"
                    });
                    addedCount++;
                } else {
                    skipCount++;
                }
            }
        }

        status.addClass('text-success').text(`Done! Added ${addedCount} picks. (Skipped ${skipCount} duplicates)`);
    } catch (err) {
        console.error(err);
        status.addClass('text-danger').text('Error: ' + err.message);
    } finally {
        btn.prop('disabled', false);
        spinner.addClass('d-none');
    }
});