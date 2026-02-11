from http.server import BaseHTTPRequestHandler
import requests
import json
import os

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # 1. Parse incoming data from your website
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data)

            # 2. Setup ESPN Auth from Vercel Env Variables
            cookies = {
                'espn_s2': os.environ.get('ESPN_S2'),
                'SWID': os.environ.get('SWID')
            }
            
            league_id = os.environ.get('LEAGUE_ID')
            # Updated to the current standard v3 transactions endpoint
            url = f"https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/2026/segments/0/leagues/{league_id}/transactions/"

            # 3. Build the ESPN Payload
            espn_payload = {
                "type": "PROPOSE",
                "scoringPeriodId": 1, 
                "teams": [
                    {
                        "teamId": data['senderId'],
                        "players": [{"id": pid, "action": "SEND"} for pid in data['senderPlayerIds']]
                    },
                    {
                        "teamId": data['receiverId'],
                        "players": [{"id": pid, "action": "RECEIVE"} for pid in data['receiverPlayerIds']]
                    }
                ]
            }

            # 4. Critical: Add Browser Headers to bypass 403 blocks
            headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://fantasy.espn.com/basketball/league/trades',
                'Origin': 'https://fantasy.espn.com'
            }
            
            # Send request to ESPN
            response = requests.post(url, json=espn_payload, cookies=cookies, headers=headers)

            # 5. Handle Response without crashing
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()

            # Only attempt to parse JSON if ESPN actually returned it
            if response.status_code == 200 and 'application/json' in response.headers.get('Content-Type', ''):
                self.wfile.write(json.dumps({
                    "status": "success", 
                    "espn_response": response.json()
                }).encode())
            else:
                # This catches the 403 and returns a readable error instead of crashing
                error_msg = f"ESPN Error {response.status_code}"
                if response.status_code == 403:
                    error_msg += ": Forbidden. Check cookies (S2/SWID) or if players are locked."
                
                self.wfile.write(json.dumps({
                    "status": "failed", 
                    "error": error_msg,
                    "debug_info": response.text[:100] # Send first bit of error for debugging
                }).encode())

        except Exception as e:
            # Fallback for code-level errors
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode())