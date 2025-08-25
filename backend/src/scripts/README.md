# Player Stats Ingestion System

This directory contains scripts for ingesting player statistics from various sports APIs and storing them in the `player_recent_stats` table in Supabase.

## Overview

The player stats ingestion system fetches recent game statistics for active players across multiple sports:

- MLB (Major League Baseball)
- WNBA (Women's National Basketball Association)
- NFL (National Football League)
- CFB (College Football)

The system is designed to run daily via cron job to keep player statistics up-to-date for the trends feature.

## Scripts

### Main Script

- `playerStatsIngestion.ts` - The main entry point that orchestrates the ingestion process for all sports

### Sport-Specific Scripts

- `nflPlayerStatsIngestion.ts` - Fetches NFL player statistics using ESPN API
- `cfbPlayerStatsIngestion.ts` - Fetches College Football player statistics using CFBD API

## Requirements

- Node.js 16+
- TypeScript
- Supabase project with the following environment variables:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `CFBD_API_KEY` (optional, for college football)

## Database Schema

The scripts store data in the `player_recent_stats` table with the following schema:

```sql
CREATE TABLE player_recent_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES players(id),
  player_name TEXT,
  sport TEXT,
  team TEXT,
  game_date DATE,
  opponent TEXT,
  is_home BOOLEAN,
  game_result TEXT,
  
  -- MLB stats
  hits INTEGER DEFAULT 0,
  at_bats INTEGER DEFAULT 0,
  home_runs INTEGER DEFAULT 0,
  rbis INTEGER DEFAULT 0,
  runs_scored INTEGER DEFAULT 0,
  stolen_bases INTEGER DEFAULT 0,
  strikeouts INTEGER DEFAULT 0,
  walks INTEGER DEFAULT 0,
  total_bases INTEGER DEFAULT 0,
  
  -- Basketball stats
  points INTEGER DEFAULT 0,
  rebounds INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  three_pointers INTEGER DEFAULT 0,
  
  -- Football stats
  passing_yards INTEGER DEFAULT 0,
  rushing_yards INTEGER DEFAULT 0,
  receiving_yards INTEGER DEFAULT 0,
  receptions INTEGER DEFAULT 0,
  passing_tds INTEGER DEFAULT 0,
  rushing_tds INTEGER DEFAULT 0,
  receiving_tds INTEGER DEFAULT 0,
  
  -- UFC stats
  significant_strikes INTEGER DEFAULT 0,
  takedowns INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Composite unique constraint to avoid duplicates
  UNIQUE(player_id, game_date, opponent)
);

-- Index for efficient queries
CREATE INDEX idx_prs_player_date ON player_recent_stats(player_id, game_date DESC);
```

## Usage

### Manual Run

To run the ingestion process manually:

```bash
# Run the full ingestion pipeline
npx ts-node backend/src/scripts/playerStatsIngestion.ts

# Run with comprehensive flag (includes all steps)
npx ts-node backend/src/scripts/playerStatsIngestion.ts --comprehensive

# Run specific sport ingestion
npx ts-node backend/src/scripts/nflPlayerStatsIngestion.ts
npx ts-node backend/src/scripts/cfbPlayerStatsIngestion.ts
```

### Scheduled Run

The ingestion process is scheduled to run automatically via cron:

```bash
# Install the cron job
./scripts/install-crontab.sh

# View current cron jobs
crontab -l
```

## Troubleshooting

If you encounter issues with the ingestion process:

1. Check the logs in `logs/player-stats/` directory
2. Verify that all required environment variables are set
3. Check API rate limits if you're getting 429 errors
4. Ensure that players have the correct `external_player_id` values in the database

## Data Flow

1. Fetch active players from the database
2. For each player, fetch recent game statistics from the appropriate API
3. Transform the data to match the `player_recent_stats` schema
4. Upsert the data into the database (update if exists, insert if new)
5. Generate trends data based on the recent stats

## Adding Support for New Sports

To add support for a new sport:

1. Create a new script following the pattern of existing sport-specific scripts
2. Implement the data fetching and transformation logic
3. Update the main `playerStatsIngestion.ts` script to include the new sport
4. Update the cron job to run the new script
