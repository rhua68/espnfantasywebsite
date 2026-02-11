from http.server import BaseHTTPRequestHandler
import requests
import json
import os

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            content_length = int(self.headers['Content-Length'])
            data = json.loads(self.rfile.read(content_length))

            # 1. Credentials
            cookies = {
                'espn_s2': os.environ.get('ESPN_S2'),
                'SWID': os.environ.get('SWID')
            }
            league_id = os.environ.get('LEAGUE_ID')
            
            # 2. THE FIX: Dedicated LM API endpoint for transactions 
            url = f"https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/2026/segments/0/leagues/{league_id}/transactions/"

            # 3. THE FIX: Scoring Period 16 (Current NBA Week as of Feb 11, 2026)
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

            headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Referer': 'https://fantasy.espn.com/basketball/league/trades'
            }
            
            response = requests.post(url, json=espn_payload, cookies=cookies, headers=headers)

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()

            # Pass the REAL response from ESPN back to your browser console for debugging
            self.wfile.write(json.dumps({
                "status": "success" if response.status_code == 200 else "failed",
                "code": response.status_code,
                "espn_msg": response.text[:250]
            }).encode())

        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())