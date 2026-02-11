from http.server import BaseHTTPRequestHandler
import requests
import json
import os

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers['Content-Length'])
            data = json.loads(self.rfile.read(content_length))

            cookies = {
                'espn_s2': os.environ.get('ESPN_S2'),
                'SWID': os.environ.get('SWID')
            }
            
            league_id = os.environ.get('LEAGUE_ID')
            
            # 1. UPDATED ENDPOINT: Using the stable LM-Reads subdomain
            url = f"https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/2026/segments/0/leagues/{league_id}/transactions/"

            # 2. UPDATED PAYLOAD: Scoring Period 16 is mid-February
            espn_payload = {
                "type": "PROPOSE",
                "scoringPeriodId": 16, 
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

            # 3. BROWSER HEADERS: To stop ESPN from thinking you are a bot
            headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://fantasy.espn.com/'
            }
            
            response = requests.post(url, json=espn_payload, cookies=cookies, headers=headers)

            # Send a 200 back to the browser so it can read our custom error message
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()

            if response.status_code == 200:
                self.wfile.write(json.dumps({"status": "success", "espn_response": response.json()}).encode())
            else:
                # This returns the REAL error code from ESPN to your website alert
                self.wfile.write(json.dumps({
                    "status": "failed", 
                    "error": f"ESPN Error {response.status_code}",
                    "details": response.text[:150] # Shows the first bit of the real error
                }).encode())

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "error", "message": str(e)}).encode())