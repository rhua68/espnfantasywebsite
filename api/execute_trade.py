from http.server import BaseHTTPRequestHandler
import requests
import json
import os
import sys  # Added for direct log flushing
from datetime import datetime, timedelta

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        # 1. Credentials & Config Setup
        league_id = os.environ.get('LEAGUE_ID')
        swid = os.environ.get('SWID')
        espn_s2 = os.environ.get('ESPN_S2')
        cookies = {'espn_s2': espn_s2, 'SWID': swid}
        
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0',
            'Origin': 'https://fantasy.espn.com',
            'Referer': f'https://fantasy.espn.com/basketball/league/trade?leagueId={league_id}'
        }

        try:
            content_length = int(self.headers['Content-Length'])
            data = json.loads(self.rfile.read(content_length))
            
            # --- LOGGING: INPUT DATA ---
            print(f"DEBUG: Trade Data Received: {json.dumps(data)}", file=sys.stderr)

            # --- START: PICK-ONLY PROTECTION ---
            sender_p_ids = data.get('senderPlayerIds', [])
            receiver_p_ids = data.get('receiverPlayerIds', [])

            if not sender_p_ids and not receiver_p_ids:
                print("DEBUG: Picks-only trade detected. Bypassing ESPN.", file=sys.stderr)
                self._send_full_response(200, {
                    "status": "success",
                    "espn_msg": "Picks-only trade: No players to sync."
                })
                return
            # --- END: PICK-ONLY PROTECTION ---

            # 3. Fetch current league status
            current_period = 114
            status_url = f"https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/2026/segments/0/leagues/{league_id}?view=mStatus"
            status_res = requests.get(status_url, cookies=cookies, headers=headers, timeout=5)
            if status_res.status_code == 200:
                current_period = status_res.json().get('status', {}).get('currentScoringPeriod', 114)

            # 4. Build ESPN Payload
            url = f"https://lm-api-writes.fantasy.espn.com/apis/v3/games/fba/seasons/2026/segments/0/leagues/{league_id}/transactions/?platformVersion=939dee45e5bc09d6156830875454f77275346525"
            expiration = (datetime.utcnow() + timedelta(days=2)).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
            
            espn_payload = {
                "isLeagueManager": False,
                "teamId": int(data['senderId']),
                "type": "TRADE_PROPOSAL",
                "executionType": "EXECUTE",
                "expirationDate": expiration,
                "items": [],
                "memberId": swid,
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

            # --- LOGGING: PAYLOAD GOING TO ESPN ---
            print(f"DEBUG: Sending to ESPN: {json.dumps(espn_payload)}", file=sys.stderr)

            # 5. Execute to ESPN
            response = requests.post(url, json=espn_payload, cookies=cookies, headers=headers)

            # --- LOGGING: ESPN RESPONSE ---
            print(f"DEBUG: ESPN Response Status: {response.status_code}", file=sys.stderr)
            print(f"DEBUG: ESPN Response Body: {response.text}", file=sys.stderr)

            self._send_full_response(200, {
                "status": "success" if 200 <= response.status_code < 300 else "failed",
                "code": response.status_code,
                "espn_msg": response.text if response.status_code != 200 else "Trade sync complete!"
            })

        except Exception as e:
            print(f"ERROR: {str(e)}", file=sys.stderr)
            self._send_full_response(500, {"status": "failed", "error": str(e)})

    def _send_full_response(self, code, content):
        """Helper to handle response headers and body"""
        self.send_response(code)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(json.dumps(content).encode())
    
    def do_OPTIONS(self):
        self._send_full_response(200, {})