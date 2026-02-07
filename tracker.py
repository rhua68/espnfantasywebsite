from espn_api.basketball import League
import json

# Since your league is public, you only need the ID and Year
LEAGUE_ID = 257157556  # Replace with your actual ID
YEAR = 2026

def get_league_updates():
    league = League(league_id=LEAGUE_ID, year=YEAR)
    
    # 1. Fetch Recent Activity (Trades, Adds, Drops)
    # ESPN stores this in 'recent_activity'
    activity = league.recent_activity(size=50) # Get last 50 moves
    
    trades = []
    for move in activity:
        # Filter for the 'TRADE' type
        # Note: Move objects have 'actions' which list who was added/dropped
        if 'TRADE' in str(move.actions): 
            trades.append({
                "date": move.date,
                "details": str(move) # Simplified for now
            })

    # 2. Detecting the "Trade Block"
    # ESPN doesn't have a direct 'trade_block' method in the library,
    # but when a player is marked 'Tradable', it appears in league activity.
    trade_block = []
    for move in activity:
        # In the API, these are often flagged as 'ACTIVITY' with a specific message
        if "available for trading" in str(move).lower():
            trade_block.append({
                "date": move.date,
                "player": str(move).split("was")[0].strip() # Quick string parse
            })

    # 3. Save to a JSON file for your HTML/JS frontend
    output = {
        "trades": trades,
        "trade_block": trade_block
    }
    
    with open('league_data.json', 'w') as f:
        json.dump(output, f, indent=4)
    print("Data updated successfully!")

if __name__ == "__main__":
    get_league_updates()