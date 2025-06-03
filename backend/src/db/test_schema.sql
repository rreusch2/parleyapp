-- Insert a test sports event
INSERT INTO sports_events (
    sport,
    league,
    home_team,
    away_team,
    start_time,
    odds
) VALUES (
    'NBA',
    'NBA',
    'Los Angeles Lakers',
    'Golden State Warriors',
    NOW() + interval '1 day',
    '{"home_win": 1.92, "away_win": 1.88}'
) RETURNING id;

-- You can run this to verify the data:
SELECT * FROM sports_events;

-- Verify the triggers work:
UPDATE sports_events 
SET odds = '{"home_win": 1.95, "away_win": 1.85}'
WHERE sport = 'NBA';

-- Check that updated_at was automatically updated:
SELECT 
    created_at,
    updated_at,
    odds
FROM sports_events 
WHERE sport = 'NBA'; 