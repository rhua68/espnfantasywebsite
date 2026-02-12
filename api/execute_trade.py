from http.server import BaseHTTPRequestHandler
import requests
import json
import os
from datetime import datetime, timedelta

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        # Add CORS headers immediately
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        
        try:
            content_length = int(self.headers['Content-Length'])
            data = json.loads(self.rfile.read(content_length))
            
            print(f"DEBUG: Received data: {json.dumps(data, indent=2)}")

            # 1. Credentials
            cookies = {
                'espn_s2': os.environ.get('ESPN_S2'),
                'SWID': os.environ.get('SWID')
            }
            league_id = os.environ.get('LEAGUE_ID')
            swid = os.environ.get('SWID')
            
            # Check if credentials exist
            if not cookies['espn_s2'] or not swid or not league_id:
                print("ERROR: Missing environment variables!")
                self.wfile.write(json.dumps({
                    "status": "failed",
                    "error": "Missing ESPN credentials in Vercel environment"
                }).encode())
                return
            
            # 2. CRITICAL: Use lm-api-WRITES endpoint (not reads!)
            url = f"https://lm-api-writes.fantasy.espn.com/apis/v3/games/fba/seasons/2026/segments/0/leagues/{league_id}/transactions/?platformVersion=939dee45e5bc09d6156830875454f77275346525"

            # 3. Calculate expiration (2 days from now)
            expiration = (datetime.utcnow() + timedelta(days=2)).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
            
            # 4. CORRECT ESPN payload structure (from browser capture)
            espn_payload = {
                "isLeagueManager": False,
                "teamId": int(data['receiverId']),  # Team being proposed TO
                "type": "TRADE_PROPOSAL",
                "comment": "",
                "executionType": "EXECUTE",
                "expirationDate": expiration,
                "items": [],
                "memberId": swid,
                "scoringPeriodId": 114  # Adjust if needed
            }
            
            # 5. Build items array with correct structure
            # Players from sender team
            for player_id in data['senderPlayerIds']:
                espn_payload["items"].append({
                    "playerId": int(player_id),
                    "type": "TRADE",
                    "fromTeamId": int(data['senderId']),
                    "toTeamId": int(data['receiverId'])
                })
            
            # Players from receiver team
            for player_id in data['receiverPlayerIds']:
                espn_payload["items"].append({
                    "playerId": int(player_id),
                    "type": "TRADE",
                    "fromTeamId": int(data['receiverId']),
                    "toTeamId": int(data['senderId'])
                })

            headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Origin': 'https://fantasy.espn.com',
                'Referer': f'https://fantasy.espn.com/basketball/league/trade?leagueId={league_id}'
            }
            
            # Make the request to ESPN
            response = requests.post(url, json=espn_payload, cookies=cookies, headers=headers)

            # Debugging logs (visible in Vercel logs)
            print(f"DEBUG: ESPN Status {response.status_code}")
            print(f"DEBUG: Payload sent: {json.dumps(espn_payload, indent=2)}")
            print(f"DEBUG: ESPN Response: {response.text[:500]}")

            self.wfile.write(json.dumps({
                "status": "success" if 200 <= response.status_code < 300 else "failed",
                "code": response.status_code,
                "espn_msg": response.text[:250] if response.status_code != 200 else "Trade proposed successfully!"
            }).encode())

        except Exception as e:
            print(f"ERROR: {str(e)}")
            import traceback
            traceback.print_exc()
            self.wfile.write(json.dumps({"status": "failed", "error": str(e)}).encode())
    
    def do_OPTIONS(self):
        """Handle CORS preflight requests"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()