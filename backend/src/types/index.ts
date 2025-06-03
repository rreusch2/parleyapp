export interface User {
  id: string;
  email: string;
  created_at: Date;
  preferences?: UserPreferences;
}

export interface UserPreferences {
  risk_tolerance: 'low' | 'medium' | 'high';
  sports: string[];
  bet_types: string[];
  max_bet_size: number;
  notification_preferences: {
    frequency: 'daily' | 'weekly' | 'realtime';
    types: string[];
  };
}

export interface Prediction {
  id: string;
  user_id: string;
  sport: string;
  event_id: string;
  matchup: string;
  pick: string;
  odds: string;
  confidence: number;
  analysis: string;
  created_at: Date;
  expires_at: Date;
  status?: 'pending' | 'won' | 'lost';
}

export interface SportEvent {
  id: string;
  sport: string;
  league: string;
  home_team: string;
  away_team: string;
  start_time: Date;
  odds: {
    home_win: number;
    away_win: number;
    draw?: number;
  };
  stats: Record<string, any>;
} 