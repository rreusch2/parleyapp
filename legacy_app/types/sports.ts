export interface OddsMovement {
  direction: 'up' | 'down';
  value: string;
}

export interface MarketOdds {
  home: string;
  away: string;
  homeMovement?: OddsMovement;
  awayMovement?: OddsMovement;
}

export interface TotalOdds {
  over: string;
  under: string;
  overMovement?: OddsMovement;
  underMovement?: OddsMovement;
}

export interface Team {
  name: string;
  shortName: string;
  score: number;
}

export interface AIPrediction {
  text: string;
  confidence: number;
}

export interface LiveGame {
  id: string;
  sport: string;
  sportName: string;
  status: string;
  homeTeam: Team;
  awayTeam: Team;
  odds: {
    spread: MarketOdds;
    total: TotalOdds;
    moneyline: MarketOdds;
  };
  aiPrediction?: AIPrediction;
}

export interface SportsEvent {
  id: string;
  external_event_id: string;
  sport: string;
  league: string;
  home_team: string;
  away_team: string;
  start_time: string;
  status: 'scheduled' | 'live' | 'completed' | 'postponed' | 'cancelled';
  odds: {
    [key: string]: any;
  };
  stats: {
    venue: string;
    city?: string;
    home_score?: number | null;
    away_score?: number | null;
    spectators?: number | null;
    event_thumb?: string;
    home_logo?: string;
    away_logo?: string;
    league_logo?: string;
    status_detail?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface GetGamesParams {
  sport?: string;
  league?: string;
  status?: string;
  date?: string;
  page?: number;
  limit?: number;
}

// Export a namespace as default to satisfy the default export requirement
export default {
  type: 'sports'
} as const; 