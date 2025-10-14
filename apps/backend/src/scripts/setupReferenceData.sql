-- Setup Reference Data for TheOdds API Integration
-- This script populates all necessary reference tables

-- 1. Populate sports_config table
INSERT INTO sports_config (sport_key, sport_name, is_active, current_season)
VALUES 
    ('MLB', 'Major League Baseball', true, '2025'),
    ('NBA', 'National Basketball Association', true, '2024-25'),
    ('NFL', 'National Football League', false, '2024'),
    ('NHL', 'National Hockey League', false, '2024-25')
ON CONFLICT (sport_key) DO UPDATE SET
    sport_name = EXCLUDED.sport_name,
    is_active = EXCLUDED.is_active,
    current_season = EXCLUDED.current_season;

-- 2. Populate market_types table
INSERT INTO market_types (market_key, market_name, market_category, description)
VALUES 
    ('h2h', 'Moneyline', 'main', 'Win/Loss market - who will win the game'),
    ('spreads', 'Point Spread', 'main', 'Point spread betting - team must win by more than the spread'),
    ('totals', 'Over/Under', 'main', 'Total points/runs scored in the game over or under a number')
ON CONFLICT (market_key) DO UPDATE SET
    market_name = EXCLUDED.market_name,
    market_category = EXCLUDED.market_category,
    description = EXCLUDED.description;

-- 3. Populate bookmakers table with common US sportsbooks
INSERT INTO bookmakers (bookmaker_key, bookmaker_name, region, is_active)
VALUES 
    ('fanduel', 'FanDuel', 'us', true),
    ('draftkings', 'DraftKings', 'us', true),
    ('betmgm', 'BetMGM', 'us', true),
    ('caesars', 'Caesars', 'us', true),
    ('pointsbet', 'PointsBet', 'us', true),
    ('barstool', 'Barstool Sportsbook', 'us', true),
    ('wynnbet', 'WynnBET', 'us', true),
    ('betrivers', 'BetRivers', 'us', true),
    ('unibet', 'Unibet', 'us', true),
    ('twinspires', 'TwinSpires', 'us', true),
    ('betway', 'Betway', 'us', true),
    ('bovada', 'Bovada', 'us', true),
    ('mybookieag', 'MyBookie.ag', 'us', true),
    ('betonlineag', 'BetOnline.ag', 'us', true),
    ('lowvig', 'LowVig.ag', 'us', true)
ON CONFLICT (bookmaker_key) DO UPDATE SET
    bookmaker_name = EXCLUDED.bookmaker_name,
    region = EXCLUDED.region,
    is_active = EXCLUDED.is_active;

-- 4. Verify the setup
SELECT 'sports_config' as table_name, COUNT(*) as records FROM sports_config
UNION ALL
SELECT 'market_types' as table_name, COUNT(*) as records FROM market_types
UNION ALL
SELECT 'bookmakers' as table_name, COUNT(*) as records FROM bookmakers
ORDER BY table_name;

-- Show the data
SELECT 'Sports Config:' as info;
SELECT sport_key, sport_name, is_active FROM sports_config ORDER BY sport_key;

SELECT 'Market Types:' as info;
SELECT market_key, market_name, market_category FROM market_types ORDER BY market_key;

SELECT 'Bookmakers:' as info;
SELECT bookmaker_key, bookmaker_name, region FROM bookmakers WHERE is_active = true ORDER BY bookmaker_key; 