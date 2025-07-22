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
      'player_assists',
      'player_threes',
      'player_steals_blocks'
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
  total: number;
}

export const getPickDistribution = (userPreferences?: Record<string, boolean>): PickDistribution => {
  const activeSports = getActiveSportConfigs();
  const prefs = userPreferences || { mlb: true, wnba: true, ufc: true };
  
  // Default distribution for all sports enabled
  if (prefs.mlb && prefs.wnba && prefs.ufc) {
    return {
      mlb: { team: 4, props: 4 },
      wnba: { team: 4, props: 4 },
      ufc: { fights: 4 },
      total: 20
    };
  }
  
  // If user disables WNBA
  if (prefs.mlb && !prefs.wnba && prefs.ufc) {
    return {
      mlb: { team: 6, props: 6 },
      wnba: { team: 0, props: 0 },
      ufc: { fights: 8 },
      total: 20
    };
  }
  
  // If user disables UFC
  if (prefs.mlb && prefs.wnba && !prefs.ufc) {
    return {
      mlb: { team: 5, props: 5 },
      wnba: { team: 5, props: 5 },
      ufc: { fights: 0 },
      total: 20
    };
  }
  
  // MLB only (current behavior)
  return {
    mlb: { team: 10, props: 10 },
    wnba: { team: 0, props: 0 },
    ufc: { fights: 0 },
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
