// NOTE: We route through backend proxy by default to avoid iOS ATS issues.

export interface InstantIntelQuery {
  query: string;
}

export interface InstantIntelResult {
  success: boolean;
  answer?: string;
  error?: string;
  query: string;
  timestamp?: string;
  cached?: boolean;
  url?: string;
}

export interface HeadToHeadQuery {
  team1: string;
  team2: string;
  games?: number;
}

export interface TeamRecordQuery {
  team: string;
  record_type?: 'overall' | 'home' | 'away';
  season?: string;
}

export interface PlayerStatsQuery {
  player: string;
  stat_type?: string;
  timeframe?: string;
}

class InstantIntelService {
  private baseUrl: string;

  constructor() {
    // Prefer backend proxy to bypass iOS ATS and consolidate networking
    const backend = process.env.EXPO_PUBLIC_BACKEND_URL;
    const proxy = backend ? `${backend}/api/statmuse` : undefined;
    const direct = process.env.EXPO_PUBLIC_STATMUSE_API_URL || 'https://web-production-f090e.up.railway.app';
    this.baseUrl = proxy || direct;
    
    // Debug logging for iOS
    console.log('🔧 InstantIntelService initialized');
    console.log('🌐 EXPO_PUBLIC_BACKEND_URL:', process.env.EXPO_PUBLIC_BACKEND_URL);
    console.log('🌐 EXPO_PUBLIC_STATMUSE_API_URL:', process.env.EXPO_PUBLIC_STATMUSE_API_URL);
    console.log('🎯 Using baseUrl:', this.baseUrl);
    console.log('📱 Platform check - is iOS?', typeof navigator !== 'undefined' ? navigator.userAgent : 'React Native');
  }

  async query(queryData: InstantIntelQuery): Promise<InstantIntelResult> {
    try {
      console.log('🚀 Starting StatMuse query:', queryData.query);
      console.log('🌐 Requesting URL:', `${this.baseUrl}/query`);
      
      const response = await fetch(`${this.baseUrl}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(queryData),
      });

      console.log('📡 Response status:', response.status);
      console.log('📡 Response ok:', response.ok);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: InstantIntelResult = await response.json();
      console.log('✅ StatMuse query successful');
      return result;
    } catch (error) {
      console.error('❌ InstantIntel query error details:', error);
      console.error('❌ Error type:', error.constructor.name);
      console.error('❌ Error message:', error.message);
      return {
        success: false,
        error: `Connection failed: ${error.message}. Check Railway server and iOS ATS settings.`,
        query: queryData.query,
      };
    }
  }

  async headToHead(queryData: HeadToHeadQuery): Promise<InstantIntelResult> {
    try {
      const response = await fetch(`${this.baseUrl}/head-to-head`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(queryData),
      });

      const result: InstantIntelResult = await response.json();
      return result;
    } catch (error) {
      console.error('Head-to-head query error:', error);
      return {
        success: false,
        error: 'Connection failed. Please check your internet connection.',
        query: `${queryData.team1} vs ${queryData.team2}`,
      };
    }
  }

  async teamRecord(queryData: TeamRecordQuery): Promise<InstantIntelResult> {
    try {
      const response = await fetch(`${this.baseUrl}/team-record`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(queryData),
      });

      const result: InstantIntelResult = await response.json();
      return result;
    } catch (error) {
      console.error('Team record query error:', error);
      return {
        success: false,
        error: 'Connection failed. Please check your internet connection.',
        query: `${queryData.team} record`,
      };
    }
  }

  async playerStats(queryData: PlayerStatsQuery): Promise<InstantIntelResult> {
    try {
      const response = await fetch(`${this.baseUrl}/player-stats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(queryData),
      });

      const result: InstantIntelResult = await response.json();
      return result;
    } catch (error) {
      console.error('Player stats query error:', error);
      return {
        success: false,
        error: 'Connection failed. Please check your internet connection.',
        query: `${queryData.player} stats`,
      };
    }
  }

  async healthCheck(): Promise<{ status: string; service: string; timestamp: string } | null> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
      });

      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('Health check failed:', error);
      return null;
    }
  }

  async getCacheStats(): Promise<{ cached_queries: number; cache_ttl_hours: number; timestamp: string } | null> {
    try {
      const response = await fetch(`${this.baseUrl}/cache-stats`, {
        method: 'GET',
      });

      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('Cache stats failed:', error);
      return null;
    }
  }

  // Utility method to check if server is available
  async isServerAvailable(): Promise<boolean> {
    const health = await this.healthCheck();
    return health !== null;
  }

  // Smart query suggestions based on trending topics
  getSmartSuggestions(userSport?: 'mlb' | 'wnba' | 'nfl'): string[] {
    const allSuggestions = {
      mlb: [
        'Aaron Judge home runs this season',
        'Bryce Harper batting average',
        'Ronald Acuna Jr stolen bases',
        'Who has the most home runs in MLB',
        'Yankees vs Red Sox season series',
        'Dodgers record this season',
        'MLB batting average leaders',
        'Most RBIs in baseball 2024',
      ],
      wnba: [
        'Caitlin Clark assists per game',
        'A\'ja Wilson points this season',
        'WNBA scoring leaders this season',
        'Las Vegas Aces record',
        'Aces vs Liberty playoff history',
        'WNBA assists leaders',
        'Breanna Stewart stats this season',
        'Phoenix Mercury vs Chicago Sky',
      ],
      nfl: [
        'Patrick Mahomes passing yards',
        'Derrick Henry rushing yards',
        'Chiefs vs Bills all time record',
        'NFL rushing leaders this season',
        'Cowboys home record 2024',
        'Who has the most touchdowns',
        'Bills vs Patriots season series',
        '49ers vs Rams last 5 games',
      ]
    };

    if (userSport && allSuggestions[userSport]) {
      return allSuggestions[userSport];
    }

    // Return mix of popular queries from all sports
    return [
      ...allSuggestions.mlb.slice(0, 3),
      ...allSuggestions.wnba.slice(0, 2),
      ...allSuggestions.nfl.slice(0, 2),
    ];
  }
}

export const instantIntelService = new InstantIntelService();
