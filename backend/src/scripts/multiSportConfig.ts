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
  
  NBA: {
    sportKey: 'NBA',
    sportName: 'National Basketball Association',
    theoddsKey: 'basketball_nba',
    propMarkets: [
      'player_points',
      'player_rebounds',
      'player_assists',
      'player_threes',
      'player_blocks',
      'player_steals',
      'player_turnovers',
      'player_double_double',
      'player_triple_double',
      'player_points_rebounds_assists'
    ],
    teamOddsMarkets: ['h2h', 'spreads', 'totals'],
    isActive: getActiveSports().includes('NBA') && process.env.ENABLE_NBA_DATA === 'true',
    seasonInfo: {
      start: '2025-10-22',
      end: '2026-06-30',
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
  
  CFB: {
    sportKey: 'CFB',
    sportName: 'College Football',
    theoddsKey: 'americanfootball_ncaaf',
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
    isActive: getActiveSports().includes('CFB') && process.env.ENABLE_CFB_DATA !== 'false',
    seasonInfo: {
      start: '2025-08-24',
      end: '2026-01-20',
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
  },

  NHL: {
    sportKey: 'NHL',
    sportName: 'National Hockey League',
    theoddsKey: 'icehockey_nhl',
    propMarkets: [
      'player_points',
      'player_goals',
      'player_assists',
      'player_shots_on_goal',
      'player_saves'
    ],
    teamOddsMarkets: ['h2h', 'spreads', 'totals'],
    isActive: getActiveSports().includes('NHL') && process.env.ENABLE_NHL_DATA === 'true',
    seasonInfo: {
      start: '2025-10-01',
      end: '2026-06-30',
      current: '2025'
    }
  },

  // SOCCER LEAGUES - Tier 1 (Top 7 Most Popular)
  SOCCER_EPL: {
    sportKey: 'SOCCER_EPL',
    sportName: 'English Premier League',
    theoddsKey: 'soccer_epl',
    propMarkets: [
      'player_shots_on_goal',
      'player_shots',
      'player_tackles',
      'player_passes',
      'player_anytime_goalscorer'
    ],
    teamOddsMarkets: ['h2h', 'spreads', 'totals'],
    isActive: getActiveSports().includes('SOCCER') && process.env.ENABLE_SOCCER_DATA === 'true',
    seasonInfo: {
      start: '2025-08-01',
      end: '2026-05-31',
      current: '2025'
    }
  },

  SOCCER_UCL: {
    sportKey: 'SOCCER_UCL',
    sportName: 'UEFA Champions League',
    theoddsKey: 'soccer_uefa_champs_league',
    propMarkets: [
      'player_shots_on_goal',
      'player_shots',
      'player_tackles',
      'player_passes',
      'player_anytime_goalscorer'
    ],
    teamOddsMarkets: ['h2h', 'spreads', 'totals'],
    isActive: getActiveSports().includes('SOCCER') && process.env.ENABLE_SOCCER_DATA === 'true',
    seasonInfo: {
      start: '2025-09-01',
      end: '2026-05-31',
      current: '2025'
    }
  },

  SOCCER_LA_LIGA: {
    sportKey: 'SOCCER_LA_LIGA',
    sportName: 'La Liga',
    theoddsKey: 'soccer_spain_la_liga',
    propMarkets: [
      'player_shots_on_goal',
      'player_shots',
      'player_tackles',
      'player_passes',
      'player_anytime_goalscorer'
    ],
    teamOddsMarkets: ['h2h', 'spreads', 'totals'],
    isActive: getActiveSports().includes('SOCCER') && process.env.ENABLE_SOCCER_DATA === 'true',
    seasonInfo: {
      start: '2025-08-01',
      end: '2026-05-31',
      current: '2025'
    }
  },

  SOCCER_BUNDESLIGA: {
    sportKey: 'SOCCER_BUNDESLIGA',
    sportName: 'Bundesliga',
    theoddsKey: 'soccer_germany_bundesliga',
    propMarkets: [
      'player_shots_on_goal',
      'player_shots',
      'player_tackles',
      'player_passes',
      'player_anytime_goalscorer'
    ],
    teamOddsMarkets: ['h2h', 'spreads', 'totals'],
    isActive: getActiveSports().includes('SOCCER') && process.env.ENABLE_SOCCER_DATA === 'true',
    seasonInfo: {
      start: '2025-08-01',
      end: '2026-05-31',
      current: '2025'
    }
  },

  SOCCER_SERIE_A: {
    sportKey: 'SOCCER_SERIE_A',
    sportName: 'Serie A',
    theoddsKey: 'soccer_italy_serie_a',
    propMarkets: [
      'player_shots_on_goal',
      'player_shots',
      'player_tackles',
      'player_passes',
      'player_anytime_goalscorer'
    ],
    teamOddsMarkets: ['h2h', 'spreads', 'totals'],
    isActive: getActiveSports().includes('SOCCER') && process.env.ENABLE_SOCCER_DATA === 'true',
    seasonInfo: {
      start: '2025-08-01',
      end: '2026-05-31',
      current: '2025'
    }
  },

  SOCCER_LIGUE_1: {
    sportKey: 'SOCCER_LIGUE_1',
    sportName: 'Ligue 1',
    theoddsKey: 'soccer_france_ligue_one',
    propMarkets: [
      'player_shots_on_goal',
      'player_shots',
      'player_tackles',
      'player_passes',
      'player_anytime_goalscorer'
    ],
    teamOddsMarkets: ['h2h', 'spreads', 'totals'],
    isActive: getActiveSports().includes('SOCCER') && process.env.ENABLE_SOCCER_DATA === 'true',
    seasonInfo: {
      start: '2025-08-01',
      end: '2026-05-31',
      current: '2025'
    }
  },

  SOCCER_MLS: {
    sportKey: 'SOCCER_MLS',
    sportName: 'Major League Soccer',
    theoddsKey: 'soccer_usa_mls',
    propMarkets: [
      'player_shots_on_goal',
      'player_shots',
      'player_tackles',
      'player_passes',
      'player_anytime_goalscorer'
    ],
    teamOddsMarkets: ['h2h', 'spreads', 'totals'],
    isActive: getActiveSports().includes('SOCCER') && process.env.ENABLE_SOCCER_DATA === 'true',
    seasonInfo: {
      start: '2025-02-01',
      end: '2025-12-31',
      current: '2025'
    }
  },

  // TENNIS - Dynamic tournament support (Grand Slams when active)
  TENNIS: {
    sportKey: 'TENNIS',
    sportName: 'Tennis',
    theoddsKey: 'tennis_atp_us_open', // Will be dynamically determined based on active tournaments
    propMarkets: [], // Tennis doesn't have player props - only match winner
    teamOddsMarkets: ['h2h'], // Match winner only
    isActive: getActiveSports().includes('TENNIS') && process.env.ENABLE_TENNIS_DATA === 'true',
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
    if (sport.sportKey === 'CFB') {
      return activeSports.includes('CFB') && process.env.ENABLE_CFB_DATA !== 'false';
    }
    if (sport.sportKey === 'NFL') {
      return activeSports.includes('NFL') && process.env.ENABLE_NFL_DATA === 'true';
    }
    // Soccer leagues (all 7 use same enable flag)
    if (sport.sportKey.startsWith('SOCCER_')) {
      return activeSports.includes('SOCCER') && process.env.ENABLE_SOCCER_DATA === 'true';
    }
    if (sport.sportKey === 'TENNIS') {
      return activeSports.includes('TENNIS') && process.env.ENABLE_TENNIS_DATA === 'true';
    }
    return false;
  });
};

// Bookmaker configurations
export const BOOKMAKER_CONFIG = {
  teamOdds: ['fanduel', 'draftkings', 'betmgm', 'caesars'],
  
  // Top US sportsbooks for player props (line shopping for best odds)
  playerProps: [
    'fanduel',      // Most popular, great coverage
    'draftkings',   // Competitive lines
    'betmgm',       // Wide prop selection
    'caesars',      // Good odds
    'fanatics'      // Fanatics Sportsbook (growing fast)
  ], // 5 bookmakers < 10 = 1 region cost
  
  ufcFights: ['fanduel', 'draftkings', 'betmgm']
};

// Pick distribution based on active sports and user preferences
export interface PickDistribution {
  mlb: { team: number; props: number };
  wnba: { team: number; props: number };
  ufc: { fights: number };
  cfb: { team: number; props: number };
  nfl: { team: number; props: number };
  total: number;
}

export const getPickDistribution = (userPreferences?: Record<string, boolean>): PickDistribution => {
  const activeSports = getActiveSportConfigs();
  const prefs = userPreferences || { mlb: true, wnba: true, ufc: true, cfb: true, nfl: true };
  
  // CFB + NFL season (peak football season - August through January)
  if (prefs.cfb && prefs.nfl && !prefs.mlb && !prefs.wnba && !prefs.ufc) {
    return {
      mlb: { team: 0, props: 0 },
      wnba: { team: 0, props: 0 },
      ufc: { fights: 0 },
      cfb: { team: 6, props: 6 },
      nfl: { team: 4, props: 4 },
      total: 20
    };
  }
  
  // CFB only (during college football season)
  if (prefs.cfb && !prefs.nfl && !prefs.mlb && !prefs.wnba && !prefs.ufc) {
    return {
      mlb: { team: 0, props: 0 },
      wnba: { team: 0, props: 0 },
      ufc: { fights: 0 },
      cfb: { team: 10, props: 10 },
      nfl: { team: 0, props: 0 },
      total: 20
    };
  }
  
  // All sports enabled (football season priority)
  if (prefs.mlb && prefs.wnba && prefs.ufc && prefs.cfb && prefs.nfl) {
    return {
      mlb: { team: 2, props: 2 },
      wnba: { team: 1, props: 1 },
      ufc: { fights: 2 },
      cfb: { team: 4, props: 4 },
      nfl: { team: 2, props: 2 },
      total: 20
    };
  }
  
  // NFL + MLB (most common during NFL season)
  if (prefs.mlb && !prefs.wnba && !prefs.ufc && !prefs.cfb && prefs.nfl) {
    return {
      mlb: { team: 4, props: 4 },
      wnba: { team: 0, props: 0 },
      ufc: { fights: 0 },
      cfb: { team: 0, props: 0 },
      nfl: { team: 6, props: 6 },
      total: 20
    };
  }
  
  // NFL only (during peak NFL season)
  if (!prefs.mlb && !prefs.wnba && !prefs.ufc && !prefs.cfb && prefs.nfl) {
    return {
      mlb: { team: 0, props: 0 },
      wnba: { team: 0, props: 0 },
      ufc: { fights: 0 },
      cfb: { team: 0, props: 0 },
      nfl: { team: 10, props: 10 },
      total: 20
    };
  }
  
  // Legacy: MLB + WNBA + UFC (no football)
  if (prefs.mlb && prefs.wnba && prefs.ufc && !prefs.cfb && !prefs.nfl) {
    return {
      mlb: { team: 4, props: 4 },
      wnba: { team: 4, props: 4 },
      ufc: { fights: 4 },
      cfb: { team: 0, props: 0 },
      nfl: { team: 0, props: 0 },
      total: 20
    };
  }
  
  // MLB only (legacy behavior)
  return {
    mlb: { team: 10, props: 10 },
    wnba: { team: 0, props: 0 },
    ufc: { fights: 0 },
    cfb: { team: 0, props: 0 },
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
