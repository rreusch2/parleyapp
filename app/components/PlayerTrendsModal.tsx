import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Alert,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Svg, G, Rect, Text as SvgText, Line, Defs, LinearGradient as SvgLinearGradient, Stop, Circle } from 'react-native-svg';
import { useTheme } from '@react-navigation/native';
import { supabase } from '../services/api/supabaseClient';

interface Player {
  id: string;
  name: string;
  team: string;
  sport: string;
  position?: string;
  headshot_url?: string;
  has_headshot?: boolean;
}

interface TeamData {
  id: string;
  name: string;
  abbreviation: string;
  city: string;
  sport: string;
  logo_url?: string;
}

interface GameStat {
  game_date: string;
  opponent: string;
  is_home: boolean;
  value: number;
  game_result?: string;
  // NFL specific fields
  season?: number;
  week?: number;
  season_type?: string;
  fantasy_points?: number;
  passing_epa?: number;
  rushing_epa?: number;
  receiving_epa?: number;
}

interface PropType {
  key: string;
  name: string;
  current_line?: number;
}

interface RecentLine {
  id: string;
  line: number;
  overOdds: number;
  underOdds: number;
  lastUpdate: string;
  createdAt: string;
  bookmaker: string;
  propName: string;
  propKey: string;
  sportKey: string;
  category: string;
  unit: string;
}

interface PlayerTrendsModalProps {
  visible: boolean;
  player: Player | null;
  onClose: () => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const chartWidth = screenWidth - 80;
const chartHeight = 250; // Increased height to prevent cutoff of high values

export default function PlayerTrendsModal({ visible, player, onClose }: PlayerTrendsModalProps) {
  const [loading, setLoading] = useState(false);
  const [gameStats, setGameStats] = useState<GameStat[]>([]);
  const [selectedPropType, setSelectedPropType] = useState<string>('');
  const [propTypes, setPropTypes] = useState<PropType[]>([]);
  const [currentPropLine, setCurrentPropLine] = useState<number | null>(null);
  const [playerWithHeadshot, setPlayerWithHeadshot] = useState<Player | null>(null);
  const [computedPosition, setComputedPosition] = useState<string | undefined>(undefined);
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [recentLines, setRecentLines] = useState<RecentLine[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);

  const { colors } = useTheme();
  
  // Helper function to format game identifier (Football uses season/week, others use dates)
  const formatGameIdentifier = (stat: any): string => {
    if ((player?.sport === 'NFL' || player?.sport === 'College Football') && stat.season && stat.week) {
      const seasonType = stat.season_type === 'POST' ? 'Playoffs' : 'Week';
      return `${stat.season} ${seasonType} ${stat.week}`;
    }
    
    try {
      const date = new Date(stat.created_at || stat.game_date);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return 'Recent';
    }
  };

  // Normalize common/variant position codes
  const normalizePosition = (pos?: string): string | undefined => {
    if (!pos) return undefined;
    const p = pos.toUpperCase().trim();
    const map: Record<string, string> = {
      HB: 'RB',
      FB: 'FB', // handled with RB bucket
      TB: 'RB',
      PK: 'K',
      P: 'P',
      LS: 'DEF',
      EDGE: 'EDGE',
      NT: 'NT',
      DL: 'DL'
    };
    return map[p] || p;
  };

  // Infer a player's position from recent stats when missing/blank
  const inferPositionIfMissing = async (playerId: string, sport: string): Promise<string | undefined> => {
    try {
      if (!(sport === 'NFL' || sport === 'College Football')) return undefined;
      const { data, error } = await supabase
        .from('player_game_stats')
        .select('stats')
        .eq('player_id', playerId)
        .order('created_at', { ascending: false })
        .limit(8);
      if (error || !data || data.length === 0) return undefined;

      let scoreQB = 0, scoreRB = 0, scoreWR = 0, scoreK = 0, scoreDEF = 0;
      data.forEach(r => {
        const s: any = r.stats || {};
        const pa = Number(s.passing_attempts || 0);
        const py = Number(s.passing_yards || 0);
        const pc = Number(s.passing_completions || 0);
        const ptd = Number(s.passing_touchdowns || 0);
        const ra = Number(s.rushing_attempts || 0);
        const ry = Number(s.rushing_yards || 0);
        const rtd = Number(s.rushing_touchdowns || 0);
        const rec = Number(s.receptions || 0);
        const ryy = Number(s.receiving_yards || 0);
        const rctd = Number(s.receiving_touchdowns || 0);
        const fga = Number(s.field_goals_attempted || 0);
        const xpm = Number(s.extra_points_made || 0);
        const tkl = Number(s.tackles_total || s.tackles || 0);
        const sk = Number(s.sacks || 0);
        const ints = Number(s.interceptions || s.passing_interceptions || 0);

        // QB signals
        if (pa > 5) scoreQB += 2;
        if (py > 100) scoreQB += 2;
        if (pc > 5) scoreQB += 1;
        if (ptd > 0) scoreQB += 2;
        // RB signals
        if (ra > 5) scoreRB += 2;
        if (ry > 40) scoreRB += 2;
        if (rtd > 0) scoreRB += 2;
        // WR/TE signals (we’ll map to WR)
        if (rec > 2) scoreWR += 2;
        if (ryy > 30) scoreWR += 2;
        if (rctd > 0) scoreWR += 2;
        // K signals
        if (fga > 0) scoreK += 2;
        if (xpm > 0) scoreK += 1;
        // DEF signals
        if (tkl >= 5) scoreDEF += 2;
        if (sk > 0) scoreDEF += 2;
        if (ints > 0) scoreDEF += 2;
      });

      const scores: Array<[string, number]> = [
        ['QB', scoreQB],
        ['RB', scoreRB],
        ['WR', scoreWR], // TE handled with WR bucket in filtering
        ['K', scoreK],
        ['DEF', scoreDEF],
      ];
      scores.sort((a, b) => b[1] - a[1]);
      const best = scores[0];
      if (!best || best[1] === 0) return undefined;
      return best[0];
    } catch {
      return undefined;
    }
  };

  // Position-based prop types for better UX
  const getAvailableProps = (sport: string, position?: string): PropType[] => {
    const propMappings = {
      'MLB': [
        { key: 'hits', name: 'Hits' },
        { key: 'home_runs', name: 'Home Runs' },
        { key: 'rbis', name: 'RBIs' },
        { key: 'runs_scored', name: 'Runs Scored' },
        { key: 'stolen_bases', name: 'Stolen Bases' },
        { key: 'strikeouts', name: 'Strikeouts' },
        { key: 'walks', name: 'Walks' },
        { key: 'total_bases', name: 'Total Bases' }
      ],
      'WNBA': [
        { key: 'points', name: 'Points' },
        { key: 'rebounds', name: 'Rebounds' },
        { key: 'assists', name: 'Assists' },
        { key: 'steals', name: 'Steals' },
        { key: 'blocks', name: 'Blocks' },
        { key: 'three_pointers', name: '3-Pointers' }
      ],
      'NBA': [
        { key: 'points', name: 'Points' },
        { key: 'rebounds', name: 'Rebounds' },
        { key: 'assists', name: 'Assists' },
        { key: 'steals', name: 'Steals' },
        { key: 'blocks', name: 'Blocks' },
        { key: 'three_pointers', name: '3-Pointers' }
      ],
      'NFL': [
        { key: 'passing_yards', name: 'Passing Yards' },
        { key: 'passing_tds', name: 'Passing TDs' },
        { key: 'completions', name: 'Completions' },
        { key: 'attempts', name: 'Passing Attempts' },
        { key: 'interceptions', name: 'Interceptions' },
        { key: 'rushing_yards', name: 'Rushing Yards' },
        { key: 'rushing_tds', name: 'Rushing TDs' },
        { key: 'rushing_attempts', name: 'Rushing Attempts' },
        { key: 'receiving_yards', name: 'Receiving Yards' },
        { key: 'receiving_tds', name: 'Receiving TDs' },
        { key: 'receptions', name: 'Receptions' },
        { key: 'targets', name: 'Targets' },
        { key: 'field_goals_made', name: 'Field Goals Made' },
        { key: 'field_goals_attempted', name: 'Field Goals Attempted' },
        { key: 'extra_points_made', name: 'Extra Points Made' },
        { key: 'sacks', name: 'Sacks' },
        { key: 'tackles', name: 'Tackles' },
        { key: 'tackles_for_loss', name: 'Tackles for Loss' },
        { key: 'fumbles_recovered', name: 'Fumbles Recovered' },
        { key: 'fantasy_points', name: 'Fantasy Points' }
      ],
      'College Football': [
        { key: 'passing_yards', name: 'Passing Yards' },
        { key: 'passing_tds', name: 'Passing TDs' },
        { key: 'completions', name: 'Completions' },
        { key: 'attempts', name: 'Passing Attempts' },
        { key: 'interceptions', name: 'Interceptions' },
        { key: 'rushing_yards', name: 'Rushing Yards' },
        { key: 'rushing_tds', name: 'Rushing TDs' },
        { key: 'rushing_attempts', name: 'Rushing Attempts' },
        { key: 'receiving_yards', name: 'Receiving Yards' },
        { key: 'receiving_tds', name: 'Receiving TDs' },
        { key: 'receptions', name: 'Receptions' },
        { key: 'targets', name: 'Targets' },
        { key: 'field_goals_made', name: 'Field Goals Made' },
        { key: 'field_goals_attempted', name: 'Field Goals Attempted' },
        { key: 'extra_points_made', name: 'Extra Points Made' },
        { key: 'sacks', name: 'Sacks' },
        { key: 'tackles', name: 'Tackles' },
        { key: 'tackles_for_loss', name: 'Tackles for Loss' },
        { key: 'fumbles_recovered', name: 'Fumbles Recovered' },
        { key: 'fantasy_points', name: 'Fantasy Points' }
      ]
    };

    let availableProps = propMappings[sport as keyof typeof propMappings] || [];
    
    // Filter Football props by position for better UX
    if ((sport === 'NFL' || sport === 'College Football') && position) {
      const pos = position.toUpperCase();
      
      if (pos === 'QB') {
        availableProps = availableProps.filter(prop => 
          ['passing_yards', 'passing_tds', 'completions', 'attempts', 'interceptions', 'rushing_yards', 'rushing_tds', 'rushing_attempts', 'fantasy_points'].includes(prop.key)
        );
      } else if (['WR', 'TE'].includes(pos)) {
        availableProps = availableProps.filter(prop => 
          ['receiving_yards', 'receiving_tds', 'receptions', 'targets', 'rushing_yards', 'rushing_tds', 'fantasy_points'].includes(prop.key)
        );
      } else if (['RB', 'FB'].includes(pos)) {
        availableProps = availableProps.filter(prop => 
          ['rushing_yards', 'rushing_tds', 'rushing_attempts', 'receiving_yards', 'receiving_tds', 'receptions', 'targets', 'fantasy_points'].includes(prop.key)
        );
      } else if (['K', 'PK', 'P'].includes(pos)) {
        availableProps = availableProps.filter(prop => 
          ['field_goals_made', 'field_goals_attempted', 'extra_points_made', 'fantasy_points'].includes(prop.key)
        );
      } else if (['DE', 'DT', 'DL', 'EDGE', 'NT', 'LB', 'ILB', 'OLB', 'CB', 'S', 'FS', 'SS', 'DB', 'DEF'].includes(pos)) {
        availableProps = availableProps.filter(prop => 
          ['sacks', 'tackles', 'tackles_for_loss', 'interceptions', 'fumbles_recovered', 'fantasy_points'].includes(prop.key)
        );
      }
    }
    
    return availableProps;
  };

  useEffect(() => {
    if (visible && player) {
      (async () => {
        const normalized = normalizePosition(player.position);
        let posToUse = normalized;
        if (!posToUse) {
          posToUse = await inferPositionIfMissing(player.id, player.sport);
        }
        setComputedPosition(posToUse);
        const props = getAvailableProps(player.sport, posToUse);
        setPropTypes(props);
        if (props.length > 0 && (!selectedPropType || !props.find(p => p.key === selectedPropType))) {
          setSelectedPropType(props[0].key);
        }
        fetchPlayerWithHeadshot();
        fetchTeamData();
      })();
    }
  }, [visible, player]);

  useEffect(() => {
    if (visible && player && selectedPropType) {
      fetchPlayerStats();
      fetchCurrentPropLine();
      fetchRecentLines();
    }
  }, [visible, player, selectedPropType]);

  const fetchPlayerWithHeadshot = async () => {
    if (!player) return;

    try {
      // Fetch player with headshot data from players_with_headshots view
      const { data: playerData, error } = await supabase
        .from('players_with_headshots')
        .select('id, name, team, sport, position, headshot_url, has_headshot, active')
        .eq('id', player.id)
        .single();

      if (error) {
        console.warn('Error fetching player headshot:', error);
        setPlayerWithHeadshot(player); // Use original player data as fallback
        return;
      }

      if (playerData) {
        setPlayerWithHeadshot({
          ...player,
          headshot_url: playerData.headshot_url,
          has_headshot: playerData.has_headshot
        });
      } else {
        setPlayerWithHeadshot(player);
      }
    } catch (error) {
      console.error('Error fetching player headshot:', error);
      setPlayerWithHeadshot(player); // Use original player data as fallback
    }
  };

  const fetchTeamData = async () => {
    if (!player) return;

    try {
      // Fetch team data with logo based on player's team name and sport
      const { data: teamInfo, error } = await supabase
        .from('teams')
        .select('id, team_name, team_abbreviation, city, sport_key, logo_url')
        .eq('sport_key', player.sport)
        .or(`team_name.ilike.%${player.team}%,city.ilike.%${player.team}%,team_abbreviation.ilike.%${player.team}%`)
        .limit(1)
        .single();

      if (error) {
        console.warn('Error fetching team data:', error);
        setTeamData(null);
        return;
      }

      if (teamInfo) {
        setTeamData({
          id: teamInfo.id,
          name: teamInfo.team_name,
          abbreviation: teamInfo.team_abbreviation,
          city: teamInfo.city,
          sport: teamInfo.sport_key,
          logo_url: teamInfo.logo_url
        });
      } else {
        setTeamData(null);
      }
    } catch (error) {
      console.error('Error fetching team data:', error);
      setTeamData(null);
    }
  };

  const fetchPlayerStats = async () => {
    if (!player) return;

    setLoading(true);
    try {
      // First try player_game_stats for more comprehensive data
      const { data: gameStatsData, error: gameStatsError } = await supabase
        .from('player_game_stats')
        .select('stats, created_at')
        .eq('player_id', player.id)
        .order('created_at', { ascending: false })
        .limit(10);

      let formattedStats: GameStat[] = [];

      if (!gameStatsError && gameStatsData && gameStatsData.length > 0) {
        // Parse data from player_game_stats JSONB format
        formattedStats = gameStatsData.map(stat => {
          const statsData = stat.stats as any;
          let value = 0;
          
          // Map selectedPropType to the actual stat in the JSONB
          switch (selectedPropType) {
            case 'points':
              value = statsData.points || 0;
              break;
            case 'rebounds':
              value = statsData.rebounds || 0;
              break;
            case 'assists':
              value = statsData.assists || 0;
              break;
            case 'steals':
              value = statsData.steals || 0;
              break;
            case 'blocks':
              value = statsData.blocks || 0;
              break;
            case 'three_pointers':
              value = statsData.three_pointers_made || 0;
              break;
            // MLB stats
            case 'hits':
              value = statsData.hits || 0;
              break;
            case 'home_runs':
              value = statsData.home_runs || 0;
              break;
            case 'rbis':
              value = statsData.rbis || 0;
              break;
            case 'runs_scored':
            case 'runs':
              value = statsData.runs || 0;
              break;
            case 'stolen_bases':
              value = statsData.stolen_bases || 0;
              break;
            case 'strikeouts':
              value = statsData.strikeouts || 0;
              break;
            case 'walks':
              value = statsData.walks || 0;
              break;
            case 'total_bases':
              value = statsData.total_bases || 0;
              break;
            // NFL mappings (use integrator keys)
            case 'passing_yards':
              value = statsData.passing_yards || 0;
              break;
            case 'passing_tds':
              value = statsData.passing_touchdowns || statsData.passing_tds || 0;
              break;
            case 'completions':
              value = statsData.passing_completions || statsData.completions || 0;
              break;
            case 'attempts':
              value = statsData.passing_attempts || statsData.attempts || 0;
              break;
            case 'interceptions':
              value = statsData.passing_interceptions || statsData.interceptions || 0;
              break;
            case 'rushing_yards':
              value = statsData.rushing_yards || 0;
              break;
            case 'rushing_tds':
              value = statsData.rushing_touchdowns || statsData.rushing_tds || 0;
              break;
            case 'rushing_attempts':
              value = statsData.rushing_attempts || 0;
              break;
            case 'receiving_yards':
              value = statsData.receiving_yards || 0;
              break;
            case 'receiving_tds':
              value = statsData.receiving_touchdowns || statsData.receiving_tds || 0;
              break;
            case 'receptions':
              value = statsData.receptions || 0;
              break;
            case 'targets':
              value = statsData.targets || statsData.receiving_targets || 0;
              break;
            case 'field_goals_made':
              value = statsData.field_goals_made || 0;
              break;
            case 'field_goals_attempted':
              value = statsData.field_goals_attempted || 0;
              break;
            case 'extra_points_made':
              value = statsData.extra_points_made || 0;
              break;
            case 'sacks':
              value = statsData.sacks || 0;
              break;
            case 'tackles':
              value = (statsData.tackles || statsData.tackles_total || 0) +
                      (statsData.solo_tackles || 0) + (statsData.assisted_tackles || 0) -
                      (statsData.tackles_total ? (statsData.solo_tackles || 0) + (statsData.assisted_tackles || 0) : 0);
              break;
            case 'tackles_for_loss':
              value = statsData.tackles_for_loss || 0;
              break;
            case 'fumbles_recovered':
              value = statsData.fumbles_recovered || 0;
              break;
            case 'fantasy_points':
              value = statsData.fantasy_points || 0;
              break;
            default:
              value = statsData[selectedPropType] || 0;
          }

          // Extract game data with Football-specific handling
          const gameDate = (player?.sport === 'NFL' || player?.sport === 'College Football') 
            ? `${statsData.season || 2024} Week ${statsData.week || 1}`
            : statsData.game_date || formatGameIdentifier(stat);
          const opponent = statsData.opponent_team || statsData.opponent || 'OPP';
          const isHome = (typeof statsData.is_home === 'boolean' ? statsData.is_home : undefined) || statsData.home_or_away === 'home';
          
          return {
            game_date: gameDate,
            opponent: opponent,
            is_home: isHome,
            value,
            game_result: statsData.plus_minus && statsData.plus_minus > 0 ? 'W' : 'L',
            // NFL specific data
            season: statsData.season,
            week: statsData.week,
            season_type: statsData.season_type,
            fantasy_points: statsData.fantasy_points,
            passing_epa: statsData.passing_epa,
            rushing_epa: statsData.rushing_epa,
            receiving_epa: statsData.receiving_epa
          };
        }).filter(stat => stat.value !== undefined);
      }

      // Fallback to player_recent_stats if no game stats found
      if (formattedStats.length === 0) {
        const { data: recentStatsData, error: recentStatsError } = await supabase
          .from('player_recent_stats')
          .select('*')
          .eq('player_id', player.id)
          .order('game_date', { ascending: false })
          .limit(10);

        if (!recentStatsError && recentStatsData && recentStatsData.length > 0) {
          formattedStats = recentStatsData.map(stat => ({
            game_date: stat.game_date,
            opponent: stat.opponent,
            is_home: stat.is_home,
            value: stat[selectedPropType] || 0,
            game_result: stat.game_result
          }));
        }
      }

      // If we still have no data, inform user instead of using mock data
      if (formattedStats.length === 0) {
        setGameStats([]);
        return;
      }

      setGameStats(formattedStats.reverse()); // Show oldest to newest for chart
    } catch (error) {
      console.error('Error fetching player stats:', error);
      setGameStats([]); // No mock data - show empty state
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentPropLine = async () => {
    if (!player) return;

    try {
      // Map UI prop to possible prop_key aliases by sport
      const sport = player.sport;
      const aliasMap: Record<string, Record<string, string[]>> = {
        MLB: {
          hits: ['player_hits', 'batter_hits', 'hits', 'player_hits_o_u'],
          home_runs: ['player_home_runs', 'batter_home_runs', 'home_runs'],
          rbis: ['player_rbis', 'batter_rbis', 'rbi', 'rbis'],
          runs_scored: ['batter_runs_scored', 'runs', 'player_runs_scored'],
          total_bases: ['player_total_bases', 'batter_total_bases', 'total_bases'],
          strikeouts: ['player_strikeouts', 'strikeouts'],
          strikeouts_pitched: ['pitcher_strikeouts', 'strikeouts_pitched'],
          hits_allowed: ['pitcher_hits_allowed', 'hits_allowed']
        },
        NBA: {
          points: ['player_points', 'points'],
          rebounds: ['player_rebounds', 'rebounds'],
          assists: ['player_assists', 'assists'],
          three_pointers: ['threes', 'three_pointers']
        },
        WNBA: {
          points: ['player_points', 'points'],
          rebounds: ['player_rebounds', 'rebounds'],
          assists: ['player_assists', 'assists'],
          three_pointers: ['threes', 'three_pointers']
        },
        NFL: {
          passing_yards: ['player_pass_yds', 'passing_yards'],
          passing_tds: ['player_pass_tds', 'passing_touchdowns', 'passing_tds'],
          completions: ['player_completions', 'passing_completions', 'completions'],
          attempts: ['player_pass_att', 'passing_attempts', 'attempts'],
          interceptions: ['player_interceptions', 'passing_interceptions', 'interceptions'],
          rushing_yards: ['player_rush_yds', 'rushing_yards'],
          rushing_tds: ['player_rush_tds', 'rushing_touchdowns', 'rushing_tds'],
          rushing_attempts: ['player_rush_att', 'rushing_attempts'],
          receiving_yards: ['player_reception_yds', 'receiving_yards'],
          receiving_tds: ['player_reception_tds', 'receiving_touchdowns', 'receiving_tds'],
          receptions: ['player_receptions', 'receptions'],
          targets: ['player_targets', 'targets'],
          field_goals_made: ['player_fg_made', 'field_goals_made'],
          field_goals_attempted: ['player_fg_att', 'field_goals_attempted'],
          extra_points_made: ['player_xp_made', 'extra_points_made'],
          sacks: ['player_sacks', 'sacks'],
          tackles: ['player_tackles', 'tackles'],
          tackles_for_loss: ['player_tfl', 'tackles_for_loss'],
          fumbles_recovered: ['player_fumbles_rec', 'fumbles_recovered'],
          fantasy_points: ['player_fantasy_points', 'fantasy_points']
        },
        'College Football': {
          passing_yards: ['player_pass_yds', 'passing_yards'],
          passing_tds: ['player_pass_tds', 'passing_touchdowns', 'passing_tds'],
          completions: ['player_pass_completions', 'passing_completions', 'completions'],
          attempts: ['player_pass_attempts', 'passing_attempts', 'attempts'],
          interceptions: ['player_pass_interceptions', 'passing_interceptions', 'interceptions'],
          rushing_yards: ['player_rush_yds', 'rushing_yards'],
          rushing_tds: ['player_rush_tds', 'rushing_touchdowns', 'rushing_tds'],
          rushing_attempts: ['player_rush_attempts', 'rushing_attempts'],
          receiving_yards: ['player_reception_yds', 'receiving_yards'],
          receiving_tds: ['player_reception_tds', 'receiving_touchdowns', 'receiving_tds'],
          receptions: ['player_receptions', 'receptions'],
          targets: ['player_targets', 'targets'],
          field_goals_made: ['player_fg_made', 'field_goals_made'],
          field_goals_attempted: ['player_fg_att', 'field_goals_attempted'],
          extra_points_made: ['player_xp_made', 'extra_points_made'],
          sacks: ['player_sacks', 'sacks'],
          tackles: ['player_tackles', 'tackles'],
          tackles_for_loss: ['player_tfl', 'tackles_for_loss'],
          fumbles_recovered: ['player_fumbles_rec', 'fumbles_recovered'],
          fantasy_points: ['player_fantasy_points', 'fantasy_points']
        }
      };
      const aliases = aliasMap[sport]?.[selectedPropType] || [selectedPropType];

      // Find prop_type_id for any alias
      const { data: propTypeRows, error: propTypeErr } = await supabase
        .from('player_prop_types')
        .select('id, prop_key')
        .in('prop_key', aliases)
        .limit(1);
      if (propTypeErr) throw propTypeErr;

      let line: number | null = null;
      if (propTypeRows && propTypeRows.length > 0) {
        const propTypeId = propTypeRows[0].id;
        const { data: oddsRows } = await supabase
          .from('player_props_odds')
          .select('line, last_update')
          .eq('player_id', player.id)
          .eq('prop_type_id', propTypeId)
          .order('last_update', { ascending: false })
          .limit(1);
        if (oddsRows && oddsRows.length > 0) {
          line = Number(oddsRows[0].line);
        }
      }
      // Fallback default if not found
      if (line === null) {
        const mockLines: Record<string, number> = {
          hits: 1.5,
          home_runs: 0.5,
          rbis: 1.5,
          runs_scored: 1.5,
          points: 18.5,
          rebounds: 8.5,
          assists: 6.5
        };
        line = mockLines[selectedPropType] ?? 1.5;
      }
      setCurrentPropLine(line);
    } catch (error) {
      console.error('Error fetching prop line:', error);
      setCurrentPropLine(1.5); // Default mock line
    }
  };

  const fetchRecentLines = async () => {
    if (!player || !selectedPropType) return;

    setLoadingLines(true);
    try {
      // Map UI prop to database prop_key using comprehensive alias mapping
      // Handle database inconsistencies where NFL players may be mapped to college football prop types
      const sport = player.sport;
      const aliasMap: Record<string, Record<string, string[]>> = {
        MLB: {
          hits: ['player_hits', 'batter_hits', 'hits', 'player_hits_o_u'],
          home_runs: ['player_home_runs', 'batter_home_runs', 'home_runs'],
          rbis: ['player_rbis', 'batter_rbis', 'rbi', 'rbis'],
          runs_scored: ['batter_runs_scored', 'runs', 'player_runs_scored'],
          total_bases: ['player_total_bases', 'batter_total_bases', 'total_bases'],
          strikeouts: ['player_strikeouts', 'strikeouts'],
          strikeouts_pitched: ['pitcher_strikeouts', 'strikeouts_pitched'],
          hits_allowed: ['pitcher_hits_allowed', 'hits_allowed']
        },
        NBA: {
          points: ['player_points', 'points'],
          rebounds: ['player_rebounds', 'rebounds'],
          assists: ['player_assists', 'assists'],
          three_pointers: ['player_threes', 'threes', 'three_pointers'],
          steals: ['player_steals', 'steals'],
          blocks: ['player_blocks', 'blocks']
        },
        WNBA: {
          points: ['player_points', 'points'],
          rebounds: ['player_rebounds', 'rebounds'],
          assists: ['player_assists', 'assists'],
          three_pointers: ['player_threes', 'threes', 'three_pointers'],
          steals: ['player_steals', 'steals'],
          blocks: ['player_blocks', 'blocks']
        },
        // Both NFL and College Football use similar prop keys due to database mapping issues
        NFL: {
          passing_yards: ['player_pass_yds', 'passing_yards'],
          passing_tds: ['player_pass_tds', 'passing_touchdowns', 'passing_tds'],
          completions: ['player_pass_completions', 'passing_completions', 'completions'],
          attempts: ['player_pass_attempts', 'passing_attempts', 'attempts'],
          interceptions: ['player_pass_interceptions', 'passing_interceptions', 'interceptions'],
          rushing_yards: ['player_rush_yds', 'rushing_yards'],
          rushing_tds: ['player_rush_tds', 'rushing_touchdowns', 'rushing_tds'],
          rushing_attempts: ['player_rush_attempts', 'rushing_attempts'],
          receiving_yards: ['player_reception_yds', 'receiving_yards'],
          receiving_tds: ['player_reception_tds', 'receiving_touchdowns', 'receiving_tds'],
          receptions: ['player_receptions', 'receptions'],
          targets: ['player_targets', 'targets'],
          field_goals_made: ['player_fg_made', 'field_goals_made'],
          field_goals_attempted: ['player_fg_att', 'field_goals_attempted'],
          extra_points_made: ['player_xp_made', 'extra_points_made'],
          sacks: ['player_sacks', 'sacks'],
          tackles: ['player_tackles', 'tackles'],
          tackles_for_loss: ['player_tfl', 'tackles_for_loss'],
          fumbles_recovered: ['player_fumbles_rec', 'fumbles_recovered'],
          fantasy_points: ['player_fantasy_points', 'fantasy_points']
        },
        'College Football': {
          passing_yards: ['player_pass_yds', 'passing_yards'],
          passing_tds: ['player_pass_tds', 'passing_touchdowns', 'passing_tds'],
          completions: ['player_pass_completions', 'passing_completions', 'completions'],
          attempts: ['player_pass_attempts', 'passing_attempts', 'attempts'],
          interceptions: ['player_pass_interceptions', 'passing_interceptions', 'interceptions'],
          rushing_yards: ['player_rush_yds', 'rushing_yards'],
          rushing_tds: ['player_rush_tds', 'rushing_touchdowns', 'rushing_tds'],
          rushing_attempts: ['player_rush_attempts', 'rushing_attempts'],
          receiving_yards: ['player_reception_yds', 'receiving_yards'],
          receiving_tds: ['player_reception_tds', 'receiving_touchdowns', 'receiving_tds'],
          receptions: ['player_receptions', 'receptions'],
          targets: ['player_targets', 'targets'],
          field_goals_made: ['player_fg_made', 'field_goals_made'],
          field_goals_attempted: ['player_fg_att', 'field_goals_attempted'],
          extra_points_made: ['player_xp_made', 'extra_points_made'],
          sacks: ['player_sacks', 'sacks'],
          tackles: ['player_tackles', 'tackles'],
          tackles_for_loss: ['player_tfl', 'tackles_for_loss'],
          fumbles_recovered: ['player_fumbles_rec', 'fumbles_recovered'],
          fantasy_points: ['player_fantasy_points', 'fantasy_points']
        }
      };
      
      const aliases = aliasMap[sport]?.[selectedPropType] || [selectedPropType];
      const propKey = selectedPropType; // Use the frontend prop name directly since backend now maps it
      
      console.log('🔥 DEBUG: Fetching recent lines for', player.name, 'prop:', propKey);
      
      // Fetch recent lines from our new API endpoint
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/player-props/recent-lines/${player.id}?prop_type=${propKey}&limit=5`);
      const data = await response.json();
      
      console.log('🔥 DEBUG: API Response:', data);
      
      if (data.success && data.recentLines && data.recentLines.length > 0) {
        // Map the API response to our expected format
        const formattedLines = data.recentLines.map((line: any) => ({
          id: line.id || `${player.id}-${propKey}-${Date.now()}`,
          line: parseFloat(line.line),
          overOdds: parseFloat(line.over_odds || line.overOdds || 0),
          underOdds: parseFloat(line.under_odds || line.underOdds || 0),
          lastUpdate: line.last_update || line.lastUpdate || new Date().toISOString(),
          createdAt: line.created_at || line.createdAt || new Date().toISOString(),
          bookmaker: line.bookmaker?.bookmaker_name || line.bookmaker || 'Unknown',
          propName: line.prop_name || line.propName || propKey,
          propKey: line.prop_key || line.propKey || propKey,
          sportKey: line.sport_key || line.sportKey || sport,
          category: line.category || 'props',
          unit: line.unit || ''
        }));
        
        console.log('🔥 DEBUG: Formatted lines:', formattedLines);
        setRecentLines(formattedLines);
      } else {
        console.warn('No recent lines found for', player.name, selectedPropType, 'Response:', data);
        setRecentLines([]);
      }
    } catch (error) {
      console.error('Error fetching recent lines:', error);
      setRecentLines([]);
    } finally {
      setLoadingLines(false);
    }
  };

  const renderChart = () => {
    if (gameStats.length === 0) return null;

    const maxValue = Math.max(...gameStats.map(stat => stat.value), currentPropLine || 0) + 1;
    const barWidth = (chartWidth - 60) / gameStats.length;
    const barSpacing = barWidth * 0.8;
    
    return (
      <View style={{ alignItems: 'center', marginVertical: 20 }}>
        <Text style={{
          fontSize: 18,
          fontWeight: '600',
          color: '#FFFFFF',
          marginBottom: 16,
          textAlign: 'center'
        }}>
          Last 10 Games - {propTypes.find(p => p.key === selectedPropType)?.name}
        </Text>
        
        <Svg width={chartWidth} height={chartHeight + 60}>
          <Defs>
            <SvgLinearGradient id="overGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#10B981" stopOpacity={1} />
              <Stop offset="100%" stopColor="#059669" stopOpacity={1} />
            </SvgLinearGradient>
            <SvgLinearGradient id="underGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#6B7280" stopOpacity={1} />
              <Stop offset="100%" stopColor="#4B5563" stopOpacity={1} />
            </SvgLinearGradient>
          </Defs>

          {/* Draw bars */}
          {gameStats.map((stat, index) => {
            const barHeight = (stat.value / maxValue) * chartHeight;
            const x = 30 + index * barWidth;
            const y = chartHeight - barHeight;
            const isOver = currentPropLine ? stat.value > currentPropLine : false;
            
            return (
              <G key={index}>
                {/* Bar */}
                <Rect
                  x={x}
                  y={y}
                  width={barSpacing}
                  height={barHeight}
                  fill={isOver ? "url(#overGradient)" : "url(#underGradient)"}
                  rx={4}
                />
                
                {/* Value label on top of bar */}
                <SvgText
                  x={x + barSpacing / 2}
                  y={y - 5}
                  fontSize="12"
                  fill="#FFFFFF"
                  textAnchor="middle"
                  fontWeight="600"
                >
                  {stat.value}
                </SvgText>
                
                {/* Game identifier and opponent at bottom */}
                <SvgText
                  x={x + barSpacing / 2}
                  y={chartHeight + 15}
                  fontSize="9"
                  fill="#6B7280"
                  textAnchor="middle"
                >
                  {(player?.sport === 'NFL' || player?.sport === 'College Football') && stat.week ? 
                    `W${stat.week}` : 
                    new Date(stat.game_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).replace(/\s/, '')
                  }
                </SvgText>
                <SvgText
                  x={x + barSpacing / 2}
                  y={chartHeight + 28}
                  fontSize="8"
                  fill="#9CA3AF"
                  textAnchor="middle"
                >
                  {stat.is_home ? 'vs' : '@'} {stat.opponent.length > 3 ? stat.opponent.substring(0, 3) : stat.opponent}
                </SvgText>
              </G>
            );
          })}

          {/* Prop line */}
          {currentPropLine && (
            <G>
              <Line
                x1={20}
                y1={chartHeight - (currentPropLine / maxValue) * chartHeight}
                x2={chartWidth - 20}
                y2={chartHeight - (currentPropLine / maxValue) * chartHeight}
                stroke="#F59E0B"
                strokeWidth={2}
                strokeDasharray="5,5"
              />
              <Circle
                cx={chartWidth - 15}
                cy={chartHeight - (currentPropLine / maxValue) * chartHeight}
                r={4}
                fill="#F59E0B"
              />
              <SvgText
                x={chartWidth - 40}
                y={chartHeight - (currentPropLine / maxValue) * chartHeight - 8}
                fontSize="12"
                fill="#F59E0B"
                textAnchor="end"
                fontWeight="600"
              >
                {currentPropLine}
              </SvgText>
            </G>
          )}
        </Svg>

        {/* Legend */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'center',
          marginTop: 16,
          gap: 24
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{
              width: 16,
              height: 16,
              backgroundColor: '#10B981',
              borderRadius: 4,
              marginRight: 8
            }} />
            <Text style={{ color: '#FFFFFF', fontSize: 14 }}>Over Line</Text>
          </View>
          
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{
              width: 16,
              height: 16,
              backgroundColor: '#6B7280',
              borderRadius: 4,
              marginRight: 8
            }} />
            <Text style={{ color: '#FFFFFF', fontSize: 14 }}>Under Line</Text>
          </View>
          
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{
              width: 16,
              height: 2,
              backgroundColor: '#F59E0B',
              marginRight: 8
            }} />
            <Text style={{ color: '#FFFFFF', fontSize: 14 }}>Prop Line ({currentPropLine})</Text>
          </View>
        </View>
      </View>
    );
  };

  const getSportColor = (sport: string) => {
    const sportColors = {
      'MLB': '#1E40AF',
      'WNBA': '#DC2626', 
      'NBA': '#DC2626',
      'NFL': '#16A34A',
      'College Football': '#2563EB',
      'UFC': '#EA580C'
    };
    return sportColors[sport as keyof typeof sportColors] || '#6B7280';
  };

  const getOverUnderStats = () => {
    if (!currentPropLine || gameStats.length === 0) return { over: 0, under: 0, percentage: 0 };
    
    const overCount = gameStats.filter(stat => stat.value > currentPropLine).length;
    const underCount = gameStats.length - overCount;
    const percentage = Math.round((overCount / gameStats.length) * 100);
    
    return { over: overCount, under: underCount, percentage };
  };

  const formatOdds = (odds: number): string => {
    if (odds > 0) return `+${odds}`;
    return odds.toString();
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderRecentLines = () => {
    const selectedProp = propTypes.find(p => p.key === selectedPropType);
    if (!selectedProp) return null;

    return (
      <View style={{
        marginHorizontal: 20,
        marginTop: 20,
        padding: 16,
        backgroundColor: '#1F2937',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#374151'
      }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12
        }}>
          <Text style={{
            fontSize: 16,
            fontWeight: '600',
            color: '#FFFFFF'
          }}>
            Recent Lines - {selectedProp.name}
          </Text>
          {loadingLines && (
            <ActivityIndicator size="small" color="#3B82F6" />
          )}
        </View>

        {loadingLines ? (
          <View style={{
            height: 100,
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <Text style={{ color: '#9CA3AF', fontSize: 14 }}>Loading recent lines...</Text>
          </View>
        ) : recentLines.length === 0 ? (
          <View style={{
            height: 80,
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            <Ionicons name="trending-up-outline" size={32} color="#6B7280" />
            <Text style={{
              color: '#9CA3AF',
              fontSize: 14,
              marginTop: 8,
              textAlign: 'center'
            }}>
              No recent lines available for {selectedProp.name.toLowerCase()}
            </Text>
          </View>
        ) : (
          <View>
            {recentLines.slice(0, 3).map((line, index) => (
              <View key={line.id} style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 12,
                borderBottomWidth: index < Math.min(recentLines.length - 1, 2) ? 1 : 0,
                borderBottomColor: '#374151'
              }}>
                <View style={{ flex: 1 }}>
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 4
                  }}>
                    <View style={{
                      backgroundColor: '#3B82F6',
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 4,
                      marginRight: 8
                    }}>
                      <Text style={{
                        color: '#FFFFFF',
                        fontSize: 10,
                        fontWeight: '600'
                      }}>
                        {line.bookmaker}
                      </Text>
                    </View>
                    <Text style={{
                      color: '#9CA3AF',
                      fontSize: 12
                    }}>
                      {formatTimeAgo(line.lastUpdate)}
                    </Text>
                  </View>
                  
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center'
                  }}>
                    <View style={{
                      backgroundColor: currentPropLine && line.line === currentPropLine ? '#F59E0B' : '#4B5563',
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 6,
                      marginRight: 12
                    }}>
                      <Text style={{
                        color: '#FFFFFF',
                        fontSize: 16,
                        fontWeight: '700'
                      }}>
                        {line.line}
                      </Text>
                    </View>
                    
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <View style={{
                        backgroundColor: '#10B981',
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 4
                      }}>
                        <Text style={{
                          color: '#FFFFFF',
                          fontSize: 11,
                          fontWeight: '600'
                        }}>
                          O {formatOdds(line.overOdds)}
                        </Text>
                      </View>
                      
                      <View style={{
                        backgroundColor: '#6B7280',
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 4
                      }}>
                        <Text style={{
                          color: '#FFFFFF',
                          fontSize: 11,
                          fontWeight: '600'
                        }}>
                          U {formatOdds(line.underOdds)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {currentPropLine && line.line === currentPropLine && (
                  <View style={{
                    backgroundColor: '#F59E0B',
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                    marginLeft: 8
                  }}>
                    <Text style={{
                      color: '#FFFFFF',
                      fontSize: 10,
                      fontWeight: '600'
                    }}>
                      CURRENT
                    </Text>
                  </View>
                )}
              </View>
            ))}
            
            {recentLines.length > 3 && (
              <TouchableOpacity style={{
                paddingVertical: 8,
                alignItems: 'center'
              }}>
                <Text style={{
                  color: '#3B82F6',
                  fontSize: 12,
                  fontWeight: '600'
                }}>
                  +{recentLines.length - 3} more lines available
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  const stats = getOverUnderStats();

  if (!player) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: '#0A0A0B' }}>
        {/* Enhanced Header with Headshot */}
        <View style={{
          padding: 20,
          paddingTop: 50,
          borderBottomWidth: 1,
          borderBottomColor: '#374151'
        }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 16
          }}>
            {/* Player Headshot */}
            <View style={{
              position: 'relative',
              marginRight: 16
            }}>
              {playerWithHeadshot?.has_headshot && playerWithHeadshot?.headshot_url ? (
                <View style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  borderWidth: 3,
                  borderColor: getSportColor(player.sport),
                  shadowColor: getSportColor(player.sport),
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 8
                }}>
                  <Image
                    source={{ uri: playerWithHeadshot.headshot_url }}
                    style={{
                      width: 74,
                      height: 74,
                      borderRadius: 37,
                      backgroundColor: '#374151'
                    }}
                    onError={() => {
                      console.log('Failed to load headshot for', player.name);
                    }}
                  />
                  {/* Sport icon badge */}
                  <View style={{
                    position: 'absolute',
                    bottom: -2,
                    right: -2,
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: getSportColor(player.sport),
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: '#0A0A0B'
                  }}>
                    <Text style={{
                      color: '#FFFFFF',
                      fontSize: 10,
                      fontWeight: 'bold'
                    }}>
                      {player.sport === 'MLB' ? '⚾' : player.sport === 'WNBA' ? '🏀' : '🏈'}
                    </Text>
                  </View>
                </View>
              ) : (
                /* Fallback for players without headshots */
                <View style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  borderWidth: 3,
                  borderColor: getSportColor(player.sport),
                  backgroundColor: '#374151',
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: getSportColor(player.sport),
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 8
                }}>
                  <Ionicons 
                    name="person" 
                    size={36} 
                    color="#9CA3AF" 
                  />
                  {/* Sport icon badge */}
                  <View style={{
                    position: 'absolute',
                    bottom: -2,
                    right: -2,
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: getSportColor(player.sport),
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: '#0A0A0B'
                  }}>
                    <Text style={{
                      color: '#FFFFFF',
                      fontSize: 10,
                      fontWeight: 'bold'
                    }}>
                      {player.sport === 'MLB' ? '⚾' : player.sport === 'WNBA' ? '🏀' : '🏈'}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Player Info */}
            <View style={{ flex: 1 }}>
              <Text style={{
                fontSize: 24,
                fontWeight: 'bold',
                color: '#FFFFFF',
                marginBottom: 6
              }}>
                {player.name}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <View style={{
                  backgroundColor: getSportColor(player.sport),
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 8,
                  marginRight: 10
                }}>
                  <Text style={{
                    color: '#FFFFFF',
                    fontSize: 12,
                    fontWeight: '700'
                  }}>
                    {player.sport}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {/* Team Logo */}
                  {teamData?.logo_url ? (
                    <View style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      marginRight: 8,
                      backgroundColor: '#FFFFFF',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: '#374151'
                    }}>
                      <Image
                        source={{ uri: teamData.logo_url }}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11
                        }}
                        onError={() => {
                          console.log('Failed to load team logo for', teamData.name);
                        }}
                      />
                    </View>
                  ) : null}
                  <Text style={{
                    color: '#D1D5DB',
                    fontSize: 16,
                    fontWeight: '600'
                  }}>
                    {player.team}
                  </Text>
                </View>
              </View>
              {player.position && (
                <Text style={{
                  color: '#9CA3AF',
                  fontSize: 14,
                  fontWeight: '500'
                }}>
                  {player.position}
                </Text>
              )}
            </View>

            {/* Close Button */}
            <TouchableOpacity
              onPress={onClose}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: '#1F2937',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: '#374151'
              }}
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {/* Prop Type Selector */}
          <View style={{ padding: 20, paddingBottom: 0 }}>
            <Text style={{
              fontSize: 18,
              fontWeight: '600',
              color: '#FFFFFF',
              marginBottom: 12
            }}>
              Select Prop Type
            </Text>
            
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 4 }}
            >
              {propTypes.map((prop) => (
                <TouchableOpacity
                  key={prop.key}
                  onPress={() => {
                    console.log('Prop button pressed:', prop.key);
                    setSelectedPropType(prop.key);
                  }}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    marginRight: 12,
                    borderRadius: 20,
                    backgroundColor: selectedPropType === prop.key ? '#3B82F6' : '#1F2937',
                    borderWidth: 1.5,
                    borderColor: selectedPropType === prop.key ? '#60A5FA' : '#374151',
                    shadowColor: selectedPropType === prop.key ? '#3B82F6' : 'transparent',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: selectedPropType === prop.key ? 0.3 : 0,
                    shadowRadius: 4,
                    elevation: selectedPropType === prop.key ? 4 : 0
                  }}
                >
                  <Text style={{
                    color: selectedPropType === prop.key ? '#FFFFFF' : '#9CA3AF',
                    fontWeight: selectedPropType === prop.key ? '700' : '500',
                    fontSize: 14
                  }}>
                    {prop.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Stats Summary */}
          <View style={{
            marginHorizontal: 20,
            marginTop: 20,
            padding: 16,
            backgroundColor: '#1F2937',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#374151'
          }}>
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: '#FFFFFF',
              marginBottom: 12,
              textAlign: 'center'
            }}>
              Performance Summary
            </Text>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{
                  fontSize: 24,
                  fontWeight: 'bold',
                  color: '#10B981'
                }}>
                  {stats.over}
                </Text>
                <Text style={{
                  fontSize: 12,
                  color: '#9CA3AF'
                }}>
                  Over Line
                </Text>
              </View>
              
              <View style={{ alignItems: 'center' }}>
                <Text style={{
                  fontSize: 24,
                  fontWeight: 'bold',
                  color: '#6B7280'
                }}>
                  {stats.under}
                </Text>
                <Text style={{
                  fontSize: 12,
                  color: '#9CA3AF'
                }}>
                  Under Line
                </Text>
              </View>
              
              <View style={{ alignItems: 'center' }}>
                <Text style={{
                  fontSize: 24,
                  fontWeight: 'bold',
                  color: '#F59E0B'
                }}>
                  {stats.percentage}%
                </Text>
                <Text style={{
                  fontSize: 12,
                  color: '#9CA3AF'
                }}>
                  Over Rate
                </Text>
              </View>
            </View>

            {/* NFL Advanced Analytics */}
            {player?.sport === 'NFL' && gameStats.length > 0 && (
              <View style={{
                marginTop: 16,
                paddingTop: 16,
                borderTopWidth: 1,
                borderTopColor: '#374151'
              }}>
                <Text style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: '#FFFFFF',
                  marginBottom: 8,
                  textAlign: 'center'
                }}>
                  🏈 NFL Advanced Metrics
                </Text>
                
                <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                  {(() => {
                    const avgFantasy = gameStats.reduce((sum, stat) => sum + (stat.fantasy_points || 0), 0) / gameStats.length;
                    const recentGames = gameStats.slice(-5);
                    const recentFantasy = recentGames.reduce((sum, stat) => sum + (stat.fantasy_points || 0), 0) / recentGames.length;
                    const trend = recentFantasy > avgFantasy ? '📈' : recentFantasy < avgFantasy ? '📉' : '➡️';
                    
                    return (
                      <>
                        <View style={{ alignItems: 'center' }}>
                          <Text style={{
                            fontSize: 16,
                            fontWeight: 'bold',
                            color: '#8B5CF6'
                          }}>
                            {avgFantasy.toFixed(1)}
                          </Text>
                          <Text style={{
                            fontSize: 10,
                            color: '#9CA3AF'
                          }}>
                            Avg Fantasy
                          </Text>
                        </View>
                        
                        <View style={{ alignItems: 'center' }}>
                          <Text style={{
                            fontSize: 16,
                            fontWeight: 'bold',
                            color: '#06B6D4'
                          }}>
                            {trend}
                          </Text>
                          <Text style={{
                            fontSize: 10,
                            color: '#9CA3AF'
                          }}>
                            L5 Trend
                          </Text>
                        </View>
                        
                        <View style={{ alignItems: 'center' }}>
                          <Text style={{
                            fontSize: 16,
                            fontWeight: 'bold',
                            color: '#F97316'
                          }}>
                            {gameStats.filter(s => s.season_type === 'POST').length}
                          </Text>
                          <Text style={{
                            fontSize: 10,
                            color: '#9CA3AF'
                          }}>
                            Playoff Games
                          </Text>
                        </View>
                      </>
                    );
                  })()}
                </View>
              </View>
            )}
          </View>

          {/* Recent Lines Section */}
          {renderRecentLines()}

          {/* Chart */}
          {loading ? (
            <View style={{
              height: 300,
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={{
                color: '#9CA3AF',
                marginTop: 16,
                fontSize: 16
              }}>
                Loading player trends...
              </Text>
            </View>
          ) : gameStats.length === 0 ? (
            <View style={{
              height: 300,
              justifyContent: 'center',
              alignItems: 'center',
              marginHorizontal: 20
            }}>
              <Ionicons name="stats-chart-outline" size={64} color="#6B7280" />
              <Text style={{
                color: '#FFFFFF',
                marginTop: 16,
                fontSize: 18,
                fontWeight: '600',
                textAlign: 'center'
              }}>
                No Recent Game Data
              </Text>
              <Text style={{
                color: '#9CA3AF',
                marginTop: 8,
                fontSize: 14,
                textAlign: 'center',
                lineHeight: 20
              }}>
                We don't have recent {propTypes.find(p => p.key === selectedPropType)?.name.toLowerCase()} stats for {player?.name} yet.{'\n'}Check back after their next game!
              </Text>
            </View>
          ) : (
            renderChart()
          )}

          {/* Game by Game Breakdown */}
          <View style={{
            marginHorizontal: 20,
            marginTop: 20,
            padding: 16,
            backgroundColor: '#1F2937',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#374151'
          }}>
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: '#FFFFFF',
              marginBottom: 12
            }}>
              Game by Game Breakdown
            </Text>
            
            {gameStats.slice().reverse().map((stat, index) => (
              <View key={index} style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 8,
                borderBottomWidth: index < gameStats.length - 1 ? 1 : 0,
                borderBottomColor: '#374151'
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{
                    color: '#FFFFFF',
                    fontSize: 14,
                    fontWeight: '500'
                  }}>
                    {stat.game_date} {stat.is_home ? 'vs' : '@'} {stat.opponent}
                  </Text>
                  {/* NFL-specific enhancements */}
                  {player?.sport === 'NFL' && stat.fantasy_points !== undefined && (
                    <Text style={{
                      color: '#9CA3AF',
                      fontSize: 12,
                      marginTop: 2
                    }}>
                      {stat.fantasy_points.toFixed(1)} fantasy pts
                    </Text>
                  )}
                </View>
                
                <View style={{
                  backgroundColor: currentPropLine && stat.value > currentPropLine ? '#10B981' : '#6B7280',
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 6,
                  minWidth: 40,
                  alignItems: 'center'
                }}>
                  <Text style={{
                    color: '#FFFFFF',
                    fontSize: 14,
                    fontWeight: '600'
                  }}>
                    {stat.value}
                  </Text>
                </View>
                
                {stat.game_result && (
                  <View style={{
                    backgroundColor: stat.game_result === 'W' ? '#10B981' : '#DC2626',
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                    marginLeft: 8
                  }}>
                    <Text style={{
                      color: '#FFFFFF',
                      fontSize: 12,
                      fontWeight: '600'
                    }}>
                      {stat.game_result}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}
