import requests
import json
from datetime import datetime, timedelta

# --- CONFIGURATION ---
LEAGUE_ID = "257157556"
SWID = "{E26E031F-13AE-4610-8C10-CC193701B873}"
S2 = "AEBhHngYBNt6xGySBDouHbebD9BG%2FsiFGcPHMFkRQuy6tdixlwE1gpQ9WDIEBv1VPO81wXF2wiVaZg3uRKGuzMTD64Jx%2BC%2Fa4FodfILiADrby4vbuMSW2rNXkhRTLeMHvDmSu5ZWNegmUMrIY9nhGjvr5jxEsnRKFVF3wOVOlBVDw2qSh3dduvMzU2mjEnG03c%2B0Nhy1Zy2JgCoG5ywf0ccNGkAd4xfXZ4DwJIsu9MMG0ZiXXYBD3UmOKNi3rEGMU3iLt6N8SP0kIVwVgPDX5gSsqR2DyAEojhzoAYOhXz%2BGpQ%3D%3D"

# Trade Details
SENDER_TEAM_ID = 10      # Your team
RECEIVER_TEAM_ID = 1     # Team you're trading with
MCBRIDE_ID = 4431823     # Miles McBride (Team 10 gives)
JENKINS_ID = 5107199     # Daniss Jenkins (Team 1 gives)

def propose_trade():
    """
    Propose a trade using the EXACT format ESPN uses
    Discovered from browser Network tab inspection
    """
    
    cookies = {"espn_s2": S2, "SWID": SWID}
    
    # Critical: Use lm-api-WRITES, not lm-api-reads!
    url = f"https://lm-api-writes.fantasy.espn.com/apis/v3/games/fba/seasons/2026/segments/0/leagues/{LEAGUE_ID}/transactions/?platformVersion=939dee45e5bc09d6156830875454f77275346525"
    
    headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://fantasy.espn.com',
        'Referer': f'https://fantasy.espn.com/basketball/league/trade?leagueId={LEAGUE_ID}'
    }
    
    # Calculate expiration (2 days from now, matching ESPN's format)
    expiration = (datetime.utcnow() + timedelta(days=2)).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
    
    # EXACT payload structure from browser capture
    payload = {
        "isLeagueManager": False,
        "teamId": RECEIVER_TEAM_ID,  # The team you're proposing TO
        "type": "TRADE_PROPOSAL",
        "comment": "",
        "executionType": "EXECUTE",
        "expirationDate": expiration,
        "items": [
            {
                "playerId": MCBRIDE_ID,
                "type": "TRADE",
                "fromTeamId": SENDER_TEAM_ID,
                "toTeamId": RECEIVER_TEAM_ID
            },
            {
                "playerId": JENKINS_ID,
                "type": "TRADE",
                "fromTeamId": RECEIVER_TEAM_ID,
                "toTeamId": SENDER_TEAM_ID
            }
        ],
        "memberId": SWID,
        "scoringPeriodId": 114,  # Current scoring period (adjust if needed)
    }
    
    print("=" * 70)
    print("  PROPOSING TRADE WITH CORRECT FORMAT")
    print("=" * 70)
    print(f"\nTrade Details:")
    print(f"  Team {SENDER_TEAM_ID} gives: Miles McBride (ID: {MCBRIDE_ID})")
    print(f"  Team {RECEIVER_TEAM_ID} gives: Daniss Jenkins (ID: {JENKINS_ID})")
    print(f"\nExpiration: {expiration}")
    print(f"\nPayload:")
    print(json.dumps(payload, indent=2))
    print()
    
    response = requests.post(url, json=payload, cookies=cookies, headers=headers)
    
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        print("\n✅ SUCCESS! Trade proposed!")
        print("Check your ESPN league - the trade should now be pending.")
    else:
        print("\n❌ Failed")
    
    try:
        print("\nResponse:")
        print(json.dumps(response.json(), indent=2))
    except:
        print(response.text)
    
    return response.status_code == 200

def get_current_scoring_period():
    """
    Helper function to get the current scoring period
    """
    cookies = {"espn_s2": S2, "SWID": SWID}
    url = f"https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/2026/segments/0/leagues/{LEAGUE_ID}"
    params = {"view": "mSettings"}
    
    response = requests.get(url, cookies=cookies, params=params)
    
    if response.status_code == 200:
        data = response.json()
        current_period = data.get("scoringPeriodId", 114)
        print(f"Current Scoring Period: {current_period}")
        return current_period
    
    return 114  # Default fallback

if __name__ == "__main__":
    print("\n" + "╔" + "═"*68 + "╗")
    print("║" + " "*20 + "ESPN TRADE - WORKING VERSION" + " "*20 + "║")
    print("╚" + "═"*68 + "╝\n")
    
    # Optional: Get current scoring period
    print("Fetching current scoring period...")
    current_period = get_current_scoring_period()
    print()
    
    # Propose the trade
    success = propose_trade()
    
    if success:
        print("\n" + "=" * 70)
        print("  🎉 TRADE SUCCESSFULLY PROPOSED!")
        print("=" * 70)
        print("\nNext steps:")
        print("  1. Check your ESPN Fantasy Basketball league")
        print("  2. The trade should appear in 'Pending Trades'")
        print("  3. The other team can now accept or reject")
    else:
        print("\n" + "=" * 70)
        print("  Troubleshooting")
        print("=" * 70)
        print("\nIf it still failed, check:")
        print("  1. scoringPeriodId might need adjustment")
        print("  2. platformVersion in URL might have changed")
        print("  3. Player IDs are correct")