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