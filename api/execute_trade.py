from http.server import BaseHTTPRequestHandler
import requests
import json
import os

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        data = json.loads(post_data)

        # 1. Setup ESPN Auth from Vercel Env Variables
        cookies = {
            'espn_s2': os.environ.get('ESPN_S2'),
            'SWID': os.environ.get('SWID')
        }
        
        league_id = os.environ.get('LEAGUE_ID')
        url = f"https://fantasy.espn.com/apis/v3/games/fba/seasons/2026/segments/0/leagues/{league_id}/transactions/"

        # 2. Build the ESPN Payload 
        # Note: This structure must match exactly what ESPN expects
        espn_payload = {
            "type": "PROPOSE",
            "scoringPeriodId": 1, # This updates weekly
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

        # 3. Send the request to ESPN
        headers = {'Content-Type': 'application/json'}
        response = requests.post(url, json=espn_payload, cookies=cookies, headers=headers)

        # 4. Return the result to your website
        self.send_response(response.status_code)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({"status": "success", "espn_response": response.json()}).encode())