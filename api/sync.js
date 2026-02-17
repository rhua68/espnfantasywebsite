// /api/sync.js
export default async function handler(req, res) {
    // This runs on Vercel's server, so the token is never seen by the browser
    const GITHUB_TOKEN = process.env.MY_GITHUB_TOKEN; 
    const REPO_OWNER = "rhua68";
    const REPO_NAME = "espnfantasywebsite";

    try {
        const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/dispatches`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ event_type: 'manual_sync' })
        });

        if (response.ok) {
            return res.status(200).json({ message: "Sync triggered successfully!" });
        } else {
            const error = await response.json();
            return res.status(response.status).json(error);
        }
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}