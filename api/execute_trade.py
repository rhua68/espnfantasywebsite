from http.server import BaseHTTPRequestHandler
import requests
import json
import os
import sys
from datetime import datetime, timedelta

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        # 1. Fetch Admin Fallback Credentials
        # These are used only if the user hasn't provided their own cookies
        LEAGUE_ID = os.environ.get('LEAGUE_ID')
        ADMIN_SWID = os.environ.get('SWID')
        ADMIN_S2 = os.environ.get('ESPN_S2')
        ADMIN_TEAM_ID = 1 # Your Team ID

        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0',
            'Origin': 'https://fantasy.espn.com',
            'Referer': f'https://fantasy.espn.com/basketball/league/trade?leagueId={LEAGUE_ID}'
        }

        try:
            # 2. Parse Incoming Data
            content_length = int(self.headers['Content-Length'])
            data = json.loads(self.rfile.read(content_length))
            
            # Use specific user cookies if they exist, otherwise fallback to admin
            user_s2 = data.get('user_espn_s2') or ADMIN_S2
            user_swid = data.get('user_swid') or ADMIN_SWID
            cookies = {'espn_s2': user_s2, 'SWID': user_swid}

            sender_p_ids = data.get('senderPlayerIds', [])
            receiver_p_ids = data.get('receiverPlayerIds', [])

            # --- START: PICK-ONLY PROTECTION ---
            if not sender_p_ids and not receiver_p_ids:
                self._send_full_response(200, {
                    "status": "success",
                    "espn_msg": "Picks-only trade: No players to sync."
                })
                return
            # --- END: PICK-ONLY PROTECTION ---

            # 3. Dynamic Scoring Period Fetch
            current_period = 114
            status_url = f"https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/2026/segments/0/leagues/{LEAGUE_ID}?view=mStatus"
            status_res = requests.get(status_url, cookies=cookies, headers=headers, timeout=5)
            if status_res.status_code == 200:
                status_data = status_res.json().get('status', {})
                current_period = status_data.get('isActiveScoringPeriod') or 114

            # 4. Build ESPN Payload
            # To show the CORRECT proposer, we use the senderId from the request
            # To EXECUTE immediately, change isLeagueManager to True (requires Admin Cookies)
            url = f"https://lm-api-writes.fantasy.espn.com/apis/v3/games/fba/seasons/2026/segments/0/leagues/{LEAGUE_ID}/transactions/"
            
            expiration = (datetime.utcnow() + timedelta(days=2)).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
            
            espn_payload = {
                "isLeagueManager": False, # Set to True ONLY if you want to force-accept the trade as Admin
                "teamId": int(data['senderId']), # Identity of the person "sending" the trade
                "type": "TRADE_PROPOSAL",
                "executionType": "EXECUTE",
                "expirationDate": expiration,
                "items": [],
                "scoringPeriodId": current_period
            }
            
            for p_id in sender_p_ids:
                espn_payload["items"].append({
                    "playerId": int(p_id), "type": "TRADE",
                    "fromTeamId": int(data['senderId']), "toTeamId": int(data['receiverId'])
                })
            
            for p_id in receiver_p_ids:
                espn_payload["items"].append({
                    "playerId": int(p_id), "type": "TRADE",
                    "fromTeamId": int(data['receiverId']), "toTeamId": int(data['senderId'])
                })

            # 5. Send to ESPN
            response = requests.post(url, json=espn_payload, cookies=cookies, headers=headers)

            self._send_full_response(200, {
                "status": "success" if response.status_code == 200 else "failed",
                "code": response.status_code,
                "espn_msg": response.text if response.status_code != 200 else "Trade proposal sent!"
            })

        except Exception as e:
            self._send_full_response(500, {"status": "failed", "error": str(e)})

    def _send_full_response(self, code, content):
        self.send_response(code)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(json.dumps(content).encode())
    
    def do_OPTIONS(self):
        self._send_full_response(200, {})