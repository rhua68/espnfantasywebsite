from espn_api.basketball import League
import json
from datetime import datetime
import requests

# --- CONFIGURATION ---
LEAGUE_ID = 257157556 
YEARS = [2025, 2026] 
ESPN_S2 = 'AEBGsMs5uMPPgCUUeJNuagDyGnSx%2F9GdYhZnuHT%2B7OGAknCfYfzHiMmbwjwqWuOleTNJIGNIdiGiU1XtPvPC4yUnunB6mpWEna2oirxOm6MFJGpELu69BJ5ht5UzhtBpt95aPA3d40GJNqPKwEl6Ahw2VOsrykxcAXhCs%2BUdI509Klo40yt38hA3%2FC55Y4SyNNdC7ZUpKmvvMce5VgO2K63iCzTWNskEeyacLIxXHq7H0QvpzZWCIj24jwCy72%2FmTQKNH4BjS21sRw4UpfwhYQII4tAfSzjLwyQBNQOzN5lmZA%3D%3D'
SWID = '{E26E031F-13AE-4610-8C10-CC193701B873}'

def get_season_trades(year):

    print(f"--- Deep Scanning Season: {year} ---")
    try:
        league = League(league_id=LEAGUE_ID, year=year, espn_s2=ESPN_S2, swid=SWID)
        
        # We increase the size to the maximum allowed (often 5000+) 
        # to ensure we reach the very start of the season
        activity = league.recent_activity(size=5000) 
        
        season_trades = []
        
        for move in activity:
            # Check for 'TRADED' in the move string
            if any('TRADED' in str(action) for action in move.actions):
                date_obj = datetime.fromtimestamp(move.date / 1000)
                formatted_date = date_obj.strftime("%b %d, %Y")

                trade_entry = {
                    "date": formatted_date,
                    "teams": [],
                    "assets": [],
                    "sort_date": date_obj.strftime("%Y-%m-%d")
                }

                for action_item in move.actions:
                    team, action, player, *extra = action_item
                    
                    if action == 'TRADED':
                        t_name = team.team_name
                        p_name = getattr(player, 'name', str(player))
                        
                        trade_entry["assets"].append({
                            "from": t_name,
                            "player": p_name
                        })
                        if t_name not in trade_entry["teams"]:
                            trade_entry["teams"].append(t_name)

                if trade_entry["assets"]:
                    season_trades.append(trade_entry)
        
        # REMOVE DUPLICATES: Sometimes ESPN logs a trade twice if it involves 
        # draft picks or LM intervention.
        unique_trades = []
        seen = set()
        for t in season_trades:
            # Create a unique string based on date and assets
            t_id = f"{t['date']}-{str(t['assets'])}"
            if t_id not in seen:
                unique_trades.append(t)
                seen.add(t_id)

        print(f"✅ Found {len(unique_trades)} unique trades for {year}.")
        return unique_trades

    except Exception as e:
        print(f"❌ Error fetching {year}: {e}")
        return []

def get_current_rosters():
    print("--- Fetching Current Rosters & Season Averages ---")
    url = f"https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/2026/segments/0/leagues/{LEAGUE_ID}"
    cookies = {"espn_s2": ESPN_S2, "SWID": SWID}
    
    # We must include kona_player_info to get the 'stats' key in the response
    params = {"view": ["mRoster", "mTeam", "kona_player_info"]}
    
    # This header is REQUIRED to get stats. 
    # It tells ESPN: "Give me actual stats (0) for the current season."
    filters = {
        "players": {
            "filterStatsForSourceIds": {"value": [0]},
            "filterStatsForSplitTypeIds": {"value": [0]} 
        }
    }
    headers = {'X-Fantasy-Filter': json.dumps(filters)}

    response = requests.get(url, params=params, cookies=cookies, headers=headers)
    data = response.json()
    
    members = {m['id']: f"{m['firstName']} {m['lastName']}" for m in data.get('members', [])}
    
    rosters = []
    for team in data.get('teams', []):
        
        owner_ids = team.get('owners',[])
        primary_owner = members.get(owner_ids[0], "Unknown Owner") if owner_ids else "No Owner"
        team_info = {
            "id": team.get('id'),
            "name": team.get('name'),
            "logo": team.get('logo'),
            "players": [],
            "abbrev": team.get('abbrev'),
            "owner": primary_owner
        }
        
        for entry in team.get('roster', {}).get('entries', []):
            player_obj = entry.get('playerPoolEntry', {}).get('player', {})
            p_id = player_obj.get('id')
            
            # Extract Season Averages from the stats list
            stats = {}
            for stat_entry in player_obj.get('stats', []):
                # 002026 usually represents the 2026 Season Actuals
                if stat_entry.get('statSourceId') == 0 and stat_entry.get('statSplitTypeId') == 0:
                    avg = stat_entry.get('averageStats', {})
                    stats = {
                        "avg_pts": f"{avg.get('0', 0):.1f}",
                        "avg_reb": f"{avg.get('6', 0):.1f}",
                        "avg_ast": f"{avg.get('3', 0):.1f}",
                        "avg_stl": f"{avg.get('2', 0):.1f}",
                        "avg_blk": f"{avg.get('1', 0):.1f}",
                        "avg_fg_pct": f"{avg.get('19', 0):.2f}",
                        "avg_ft_pct": f"{avg.get('20', 0):.2f}",
                        "avg_3pm": f"{avg.get('17', 0):.1f}",
                        "avg_mpg": f"{avg.get('40', 0):.1f}"
                        
                    }

            player_data = {
                "name": player_obj.get('fullName'),
                "id": p_id,
                "img": f"https://a.espncdn.com/i/headshots/nba/players/full/{p_id}.png"
            }
            # Merge the stats into the player object
            player_data.update(stats)
            team_info["players"].append(player_data)
            
        rosters.append(team_info)
    return rosters

def get_trade_block():
    print("--- Scanning Trade Block (Likely & Maybe) ---")
    url = f"https://lm-api-reads.fantasy.espn.com/apis/v3/games/fba/seasons/2026/segments/0/leagues/{LEAGUE_ID}"
    cookies = {"espn_s2": ESPN_S2, "SWID": SWID}
    params = {"view": ["mTeam", "mRoster"]}
    
    response = requests.get(url, params=params, cookies=cookies)
    data = response.json()
    
    trade_block = []
    for team in data.get('teams', []):
        team_name = team.get('name')
        for entry in team.get('roster', {}).get('entries', []):
            if entry.get('onTradeBlock') is True:
                player = entry.get('playerPoolEntry', {}).get('player', {})
                # Level TRADING = Likely, OPEN = Maybe
                level = entry.get('tradeSharingLevel', 'OPEN') 
                
                trade_block.append({
                    "name": player.get('fullName'),
                    "team": team_name,
                    "status": "Likely" if level == 'TRADING' else "Maybe"
                })
    return trade_block

def main():
    master_data = {
        "updated": datetime.now().strftime("%m/%d/%Y %I:%M %p"),
        "seasons": {},
        "rosters": get_current_rosters(),
        "trade_block": get_trade_block()
    }

    for year in YEARS:
        trades = get_season_trades(year)
        master_data["seasons"][str(year)] = trades

    with open('league_data.json', 'w') as f:
        json.dump(master_data, f, indent=4)
    
    print("\n--- Done! Rosters and Trades updated ---")
    
    league = League(league_id=LEAGUE_ID, year=2026, espn_s2=ESPN_S2, swid=SWID)
    
    print("\n--- LEAGUE TEAM MAPPING ---")
    for team in league.teams:
        print(f"Name: {team.team_name} | ID: {team.team_id}")
    print("---------------------------\n")

    master_data = {
        "updated": datetime.now().strftime("%m/%d/%Y %I:%M %p"),
        "seasons": {},
        "rosters": get_current_rosters(),
        "trade_block": get_trade_block()
    }
    


if __name__ == "__main__":
    main()