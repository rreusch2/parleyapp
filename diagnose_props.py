#!/usr/bin/env python3
"""
Diagnostic script to check what's in player_props_v2 for NFL 2025-12-04
"""

import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(".env")

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
client = create_client(url, key)

print("🔍 Checking player_props_v2 table for NFL 2025-12-04...")
print("=" * 80)

# Check 1: Raw count without joins
print("\n1️⃣ Raw count (no joins):")
resp1 = client.table('player_props_v2').select('id', count='exact').eq('local_game_date', '2025-12-04').eq('sport', 'NFL').execute()
print(f"   Found {resp1.count} props matching local_game_date='2025-12-04' AND sport='NFL'")

# Check 2: Sample 5 rows without joins
print("\n2️⃣ Sample data (no joins):")
resp2 = client.table('player_props_v2').select('id, player_id, event_id, sport, local_game_date, stat_type').eq('local_game_date', '2025-12-04').eq('sport', 'NFL').limit(5).execute()
if resp2.data:
    for row in resp2.data:
        print(f"   - ID: {row['id']}, player_id: {row['player_id']}, event_id: {row['event_id']}, sport: {row['sport']}, date: {row['local_game_date']}, stat: {row['stat_type']}")
else:
    print("   No data found")

# Check 3: With joins (like the actual query)
print("\n3️⃣ With joins (actual query):")
resp3 = client.table('player_props_v2').select(
    '*, players!player_id(name, headshot_url, team, position), sports_events!event_id(id, home_team, away_team, start_time, sport)'
).eq('local_game_date', '2025-12-04').eq('sport', 'NFL').limit(5).execute()
print(f"   Found {len(resp3.data)} props with joins")
if resp3.data:
    for row in resp3.data:
        player_data = row.get('players')
        event_data = row.get('sports_events')
        print(f"   - player_id: {row['player_id']}, player_data: {player_data}, event_id: {row['event_id']}, event_data: {event_data}")

# Check 4: Check for NULL foreign keys
print("\n4️⃣ Checking for NULL foreign keys:")
resp4 = client.table('player_props_v2').select('id, player_id, event_id').eq('local_game_date', '2025-12-04').eq('sport', 'NFL').limit(10).execute()
null_players = [r for r in resp4.data if not r.get('player_id')]
null_events = [r for r in resp4.data if not r.get('event_id')]
print(f"   Props with NULL player_id: {len(null_players)}")
print(f"   Props with NULL event_id: {len(null_events)}")

# Check 5: Check if players exist
print("\n5️⃣ Checking if referenced players exist:")
if resp4.data:
    player_ids = [r['player_id'] for r in resp4.data if r.get('player_id')]
    if player_ids:
        resp5 = client.table('players').select('id, name').in_('id', player_ids[:5]).execute()
        print(f"   Found {len(resp5.data)} players in 'players' table")
        for p in resp5.data:
            print(f"   - {p['id']}: {p['name']}")
    else:
        print("   No player_ids to check")

# Check 6: Check if events exist
print("\n6️⃣ Checking if referenced events exist:")
if resp4.data:
    event_ids = [r['event_id'] for r in resp4.data if r.get('event_id')]
    if event_ids:
        resp6 = client.table('sports_events').select('id, home_team, away_team').in_('id', event_ids[:5]).execute()
        print(f"   Found {len(resp6.data)} events in 'sports_events' table")
        for e in resp6.data:
            print(f"   - {e['id']}: {e['away_team']} @ {e['home_team']}")
    else:
        print("   No event_ids to check")

# Check 7: All possible date formats in the table
print("\n7️⃣ Checking all distinct local_game_date values for NFL:")
resp7 = client.table('player_props_v2').select('local_game_date').eq('sport', 'NFL').limit(100).execute()
if resp7.data:
    unique_dates = set(r['local_game_date'] for r in resp7.data if r.get('local_game_date'))
    print(f"   Found {len(unique_dates)} unique dates:")
    for date in sorted(unique_dates):
        print(f"   - {date}")

print("\n" + "=" * 80)
print("✅ Diagnostic complete!")
