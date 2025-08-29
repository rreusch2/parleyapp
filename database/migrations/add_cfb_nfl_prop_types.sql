-- Add College Football and NFL Player Prop Types
-- Migration: add_cfb_nfl_prop_types.sql

INSERT INTO player_prop_types (prop_key, prop_name, sport_key, stat_category) VALUES
-- College Football (CFB) Player Props
('player_pass_yds', 'Passing Yards O/U', 'americanfootball_ncaaf', 'passing'),
('player_pass_tds', 'Passing Touchdowns O/U', 'americanfootball_ncaaf', 'passing'),
('player_pass_completions', 'Pass Completions O/U', 'americanfootball_ncaaf', 'passing'),
('player_pass_attempts', 'Pass Attempts O/U', 'americanfootball_ncaaf', 'passing'),
('player_pass_interceptions', 'Interceptions O/U', 'americanfootball_ncaaf', 'passing'),
('player_rush_yds', 'Rushing Yards O/U', 'americanfootball_ncaaf', 'rushing'),
('player_rush_attempts', 'Rush Attempts O/U', 'americanfootball_ncaaf', 'rushing'),
('player_rush_tds', 'Rushing Touchdowns O/U', 'americanfootball_ncaaf', 'rushing'),
('player_receptions', 'Receptions O/U', 'americanfootball_ncaaf', 'receiving'),
('player_reception_yds', 'Receiving Yards O/U', 'americanfootball_ncaaf', 'receiving'),
('player_reception_tds', 'Receiving Touchdowns O/U', 'americanfootball_ncaaf', 'receiving'),
('player_kicking_points', 'Kicking Points O/U', 'americanfootball_ncaaf', 'kicking'),
('player_field_goals', 'Field Goals Made O/U', 'americanfootball_ncaaf', 'kicking'),
('player_tackles_assists', 'Tackles + Assists O/U', 'americanfootball_ncaaf', 'defense'),
('player_1st_td', 'First Touchdown Scorer', 'americanfootball_ncaaf', 'scoring'),
('player_last_td', 'Last Touchdown Scorer', 'americanfootball_ncaaf', 'scoring'),
('player_anytime_td', 'Anytime Touchdown Scorer', 'americanfootball_ncaaf', 'scoring'),

-- NFL Player Props (same prop types as CFB but for NFL)
('player_pass_yds_nfl', 'Passing Yards O/U', 'americanfootball_nfl', 'passing'),
('player_pass_tds_nfl', 'Passing Touchdowns O/U', 'americanfootball_nfl', 'passing'),
('player_pass_completions_nfl', 'Pass Completions O/U', 'americanfootball_nfl', 'passing'),
('player_pass_attempts_nfl', 'Pass Attempts O/U', 'americanfootball_nfl', 'passing'),
('player_pass_interceptions_nfl', 'Interceptions O/U', 'americanfootball_nfl', 'passing'),
('player_rush_yds_nfl', 'Rushing Yards O/U', 'americanfootball_nfl', 'rushing'),
('player_rush_attempts_nfl', 'Rush Attempts O/U', 'americanfootball_nfl', 'rushing'),
('player_rush_tds_nfl', 'Rushing Touchdowns O/U', 'americanfootball_nfl', 'rushing'),
('player_receptions_nfl', 'Receptions O/U', 'americanfootball_nfl', 'receiving'),
('player_reception_yds_nfl', 'Receiving Yards O/U', 'americanfootball_nfl', 'receiving'),
('player_reception_tds_nfl', 'Receiving Touchdowns O/U', 'americanfootball_nfl', 'receiving'),
('player_kicking_points_nfl', 'Kicking Points O/U', 'americanfootball_nfl', 'kicking'),
('player_field_goals_nfl', 'Field Goals Made O/U', 'americanfootball_nfl', 'kicking'),
('player_tackles_assists_nfl', 'Tackles + Assists O/U', 'americanfootball_nfl', 'defense'),
('player_1st_td_nfl', 'First Touchdown Scorer', 'americanfootball_nfl', 'scoring'),
('player_last_td_nfl', 'Last Touchdown Scorer', 'americanfootball_nfl', 'scoring'),
('player_anytime_td_nfl', 'Anytime Touchdown Scorer', 'americanfootball_nfl', 'scoring')
ON CONFLICT (prop_key) DO NOTHING;

-- Verify insertion
SELECT COUNT(*) as cfb_props FROM player_prop_types WHERE sport_key = 'americanfootball_ncaaf';
SELECT COUNT(*) as nfl_props FROM player_prop_types WHERE sport_key = 'americanfootball_nfl';
