// Multi-Sport Configuration for ParleyApp
// Centralized configuration for MLB, WNBA, and UFC/MMA integration

export interface SportConfig {
  sportKey: string;
  sportName: string;
  theoddsKey: string;
  propMarkets: string[];
  teamOddsMarkets: string[];
  isActive: boolean;
  seasonInfo: {
    start: string;
    end: string;
    current: string;
  };
}

// Get active sports from environment variables
const getActiveSports = (): string[] => {
  const activeSports = process.env.ACTIVE_SPORTS || 'MLB';
  return activeSports.split(',').map(sport => sport.trim());
};

// Sport configurations
export const SUPPORTED_SPORTS: Record<string, SportConfig> = {
  MLB: {
    sportKey: 'MLB',
    sportName: 'Major League Baseball',
    theoddsKey: 'baseball_mlb',
    propMarkets: [
      'batter_hits',
      'batter_total_bases', 
      'batter_home_runs',
      'batter_rbis',
      'batter_runs_scored',
      'pitcher_strikeouts'
    ],
    teamOddsMarkets: ['h2h', 'spreads', 'totals'],
    isActive: getActiveSports().includes('MLB'),
    seasonInfo: {
      start: '2025-03-28',
      end: '2025-10-31',
      current: '2025'
    }
  },
  
  WNBA: {
    sportKey: 'WNBA',
    sportName: 'Women\'s National Basketball Association',
    theoddsKey: 'basketball_wnba',
    propMarkets: [
      'player_points',
      'player_rebounds',
      'player_assists'
      // Note: player_threes and player_steals_blocks not available for WNBA
    ],
    teamOddsMarkets: ['h2h', 'spreads', 'totals'],
    isActive: getActiveSports().includes('WNBA') && process.env.ENABLE_WNBA_DATA === 'true',
    seasonInfo: {
      start: '2025-05-01',
      end: '2025-10-31', 
      current: '2025'
    }
  },
  
  UFC: {
    sportKey: 'UFC',
    sportName: 'Ultimate Fighting Championship',
    theoddsKey: 'mma_mixed_martial_arts',
    propMarkets: [], // UFC doesn't have traditional player props
    teamOddsMarkets: ['h2h'], // Fight winner, method of victory, total rounds
    isActive: getActiveSports().includes('UFC') && process.env.ENABLE_UFC_DATA === 'true',
    seasonInfo: {
      start: '2025-01-01',
      end: '2025-12-31',
      current: '2025'
    }
  },
  
  NFL: {
    sportKey: 'NFL',
    sportName: 'National Football League',
    theoddsKey: 'americanfootball_nfl',
    propMarkets: [
      'player_pass_yds',
      'player_pass_tds',
      'player_pass_completions',
      'player_pass_attempts',
      'player_pass_interceptions',
      'player_rush_yds',
      'player_rush_attempts',
      'player_rush_tds',
      'player_receptions',
      'player_reception_yds',
      'player_reception_tds',
      'player_kicking_points',
      'player_field_goals',
      'player_tackles_assists',
      'player_1st_td',
      'player_last_td',
      'player_anytime_td'
    ],
    teamOddsMarkets: ['h2h', 'spreads', 'totals'],
    isActive: getActiveSports().includes('NFL') && process.env.ENABLE_NFL_DATA === 'true',
    seasonInfo: {
      start: '2025-09-01',
      end: '2026-02-28',
      current: '2025'
    }
  }
};

// Get only active sports (dynamic check)
export const getActiveSportConfigs = (): SportConfig[] => {
  const activeSports = getActiveSports();
  return Object.values(SUPPORTED_SPORTS).filter(sport => {
    if (sport.sportKey === 'MLB') {
      return activeSports.includes('MLB') && process.env.ENABLE_MLB_DATA !== 'false';
    }
    if (sport.sportKey === 'WNBA') {
      return activeSports.includes('WNBA') && process.env.ENABLE_WNBA_DATA === 'true';
    }
    if (sport.sportKey === 'UFC') {
      return activeSports.includes('UFC') && process.env.ENABLE_UFC_DATA === 'true';
    }
    if (sport.sportKey === 'NFL') {
      return activeSports.includes('NFL') && process.env.ENABLE_NFL_DATA === 'true';
    }
    return false;
  });
};

// Bookmaker configurations
export const BOOKMAKER_CONFIG = {
  teamOdds: ['fanduel', 'draftkings', 'betmgm', 'caesars'],
  playerProps: 'fanduel', // Single bookmaker for consistency
  ufcFights: ['fanduel', 'draftkings', 'betmgm']
};

// Pick distribution based on active sports and user preferences
export interface PickDistribution {
  mlb: { team: number; props: number };
  wnba: { team: number; props: number };
  ufc: { fights: number };
  nfl: { team: number; props: number };
  total: number;
}

export const getPickDistribution = (userPreferences?: Record<string, boolean>): PickDistribution => {
  const activeSports = getActiveSportConfigs();
  const prefs = userPreferences || { mlb: true, wnba: true, ufc: true, nfl: true };
  
  // Default distribution for all sports enabled (NFL season priority)
  if (prefs.mlb && prefs.wnba && prefs.ufc && prefs.nfl) {
    return {
      mlb: { team: 3, props: 3 },
      wnba: { team: 2, props: 2 },
      ufc: { fights: 2 },
      nfl: { team: 4, props: 4 },
      total: 20
    };
  }
  
  // NFL + MLB (most common during NFL season)
  if (prefs.mlb && !prefs.wnba && !prefs.ufc && prefs.nfl) {
    return {
      mlb: { team: 4, props: 4 },
      wnba: { team: 0, props: 0 },
      ufc: { fights: 0 },
      nfl: { team: 6, props: 6 },
      total: 20
    };
  }
  
  // NFL only (during peak NFL season)
  if (!prefs.mlb && !prefs.wnba && !prefs.ufc && prefs.nfl) {
    return {
      mlb: { team: 0, props: 0 },
      wnba: { team: 0, props: 0 },
      ufc: { fights: 0 },
      nfl: { team: 10, props: 10 },
      total: 20
    };
  }
  
  // Legacy: MLB + WNBA + UFC (no NFL)
  if (prefs.mlb && prefs.wnba && prefs.ufc && !prefs.nfl) {
    return {
      mlb: { team: 4, props: 4 },
      wnba: { team: 4, props: 4 },
      ufc: { fights: 4 },
      nfl: { team: 0, props: 0 },
      total: 20
    };
  }
  
  // MLB only (legacy behavior)
  return {
    mlb: { team: 10, props: 10 },
    wnba: { team: 0, props: 0 },
    ufc: { fights: 0 },
    nfl: { team: 0, props: 0 },
    total: 20
  };
};

// Logging helper
export const logSportStatus = () => {
  const activeSports = getActiveSportConfigs();
  console.log('🏆 Active Sports Configuration:');
  activeSports.forEach(sport => {
    console.log(`  ✅ ${sport.sportName} (${sport.theoddsKey})`);
  });
  
  if (activeSports.length === 0) {
    console.log('  ⚠️  No active sports configured - falling back to MLB only');
  }
};
