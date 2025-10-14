/**
 * Free Data Sources Tool for LLM Orchestrator
 * Fetches data from cost-effective APIs instead of expensive prediction services
 */

import axios from 'axios';
import { createLogger } from '../../utils/logger';

const logger = createLogger('freeDataSources');

interface ESPNTeamStats {
  team: {
    id: string;
    name: string;
    abbreviation: string;
  };
  stats: {
    pointsPerGame: number;
    pointsAllowedPerGame: number;
    wins: number;
    losses: number;
    winPercentage: number;
  };
  last10: {
    wins: number;
    losses: number;
    pointsPerGame: number;
    pointsAllowedPerGame: number;
  };
}

interface WeatherData {
  temperature: number;
  conditions: string;
  windSpeed: number;
  precipitation: number;
  impact: 'minimal' | 'moderate' | 'significant';
}

interface InjuryReport {
  player: string;
  status: 'out' | 'questionable' | 'probable' | 'game_time_decision';
  injury: string;
  impact: 'high' | 'medium' | 'low';
}

export class FreeDataSources {

  /**
   * Fetch team statistics from ESPN API (free)
   */
  static async getTeamStats(teamId: string, sport: 'nba' | 'nfl' | 'mlb' | 'nhl'): Promise<ESPNTeamStats> {
    try {
      // ESPN API endpoints (free)
      const baseUrl = `https://site.api.espn.com/apis/site/v2/sports/${sport}`;
      
      // Get team info and basic stats
      const teamResponse = await axios.get(`${baseUrl}/teams/${teamId}`);
      const statsResponse = await axios.get(`${baseUrl}/teams/${teamId}/statistics`);
      
      // Parse the response data
      const teamData = teamResponse.data.team;
      const statsData = statsResponse.data.statistics;
      
      // Extract relevant statistics
      const pointsPerGame = statsData.splits?.categories?.find((cat: any) => 
        cat.name === 'scoring'
      )?.statistics?.find((stat: any) => 
        stat.name === 'pointsPerGame'
      )?.value || 0;
      
      return {
        team: {
          id: teamData.id,
          name: teamData.displayName,
          abbreviation: teamData.abbreviation
        },
        stats: {
          pointsPerGame: parseFloat(pointsPerGame),
          pointsAllowedPerGame: 0, // Will be calculated from defensive stats
          wins: teamData.record?.items?.[0]?.stats?.find((s: any) => s.name === 'wins')?.value || 0,
          losses: teamData.record?.items?.[0]?.stats?.find((s: any) => s.name === 'losses')?.value || 0,
          winPercentage: teamData.record?.items?.[0]?.stats?.find((s: any) => s.name === 'winPercent')?.value || 0
        },
        last10: {
          wins: 0, // Would need to calculate from recent games
          losses: 0,
          pointsPerGame: 0,
          pointsAllowedPerGame: 0
        }
      };
    } catch (error) {
      logger.error(`Error fetching team stats for ${teamId}:`, error);
      throw new Error(`Failed to fetch team stats: ${error}`);
    }
  }

  /**
   * Fetch player statistics from ESPN API
   */
  static async getPlayerStats(playerId: string, sport: 'nba' | 'nfl' | 'mlb'): Promise<{
    seasonStats: Record<string, number>;
    last10Stats: Record<string, number>;
    vsOpponentStats: Record<string, number>;
  }> {
    try {
      const baseUrl = `https://site.api.espn.com/apis/site/v2/sports/${sport}`;
      const response = await axios.get(`${baseUrl}/athletes/${playerId}/statistics`);
      
      const seasonStats = response.data.statistics?.splits?.find((split: any) => 
        split.name === 'regularSeason'
      )?.categories || [];
      
      // Parse season stats
      const parsedSeasonStats: Record<string, number> = {};
      seasonStats.forEach((category: any) => {
        category.statistics?.forEach((stat: any) => {
          parsedSeasonStats[stat.name] = parseFloat(stat.value) || 0;
        });
      });
      
      return {
        seasonStats: parsedSeasonStats,
        last10Stats: {}, // Would need additional API calls
        vsOpponentStats: {} // Would need matchup-specific data
      };
    } catch (error) {
      logger.error(`Error fetching player stats for ${playerId}:`, error);
      throw new Error(`Failed to fetch player stats: ${error}`);
    }
  }

  /**
   * Fetch weather data for outdoor sports (OpenWeatherMap API - free tier)
   */
  static async getWeatherData(city: string, gameDate: Date): Promise<WeatherData> {
    try {
      const apiKey = process.env.OPENWEATHER_API_KEY; // Free API key
      if (!apiKey) {
        logger.warn('OpenWeather API key not found, returning default weather');
        return {
          temperature: 70,
          conditions: 'clear',
          windSpeed: 5,
          precipitation: 0,
          impact: 'minimal'
        };
      }

      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${apiKey}&units=imperial`
      );

      const forecast = response.data.list[0]; // First forecast entry
      const temp = forecast.main.temp;
      const conditions = forecast.weather[0].description;
      const windSpeed = forecast.wind.speed;
      const precipitation = forecast.rain?.['3h'] || 0;

      // Determine impact based on conditions
      let impact: 'minimal' | 'moderate' | 'significant' = 'minimal';
      if (temp < 32 || temp > 90 || windSpeed > 15 || precipitation > 0.1) {
        impact = 'moderate';
      }
      if (temp < 20 || temp > 100 || windSpeed > 25 || precipitation > 0.5) {
        impact = 'significant';
      }

      return {
        temperature: temp,
        conditions,
        windSpeed,
        precipitation,
        impact
      };
    } catch (error) {
      logger.error('Error fetching weather data:', error);
      return {
        temperature: 70,
        conditions: 'clear',
        windSpeed: 5,
        precipitation: 0,
        impact: 'minimal'
      };
    }
  }

  /**
   * Fetch injury reports from ESPN or other free sources
   */
  static async getInjuryReports(teamId: string, sport: 'nba' | 'nfl' | 'mlb'): Promise<InjuryReport[]> {
    try {
      const baseUrl = `https://site.api.espn.com/apis/site/v2/sports/${sport}`;
      const response = await axios.get(`${baseUrl}/teams/${teamId}/injuries`);
      
      const injuries = response.data.injuries || [];
      
      return injuries.map((injury: any) => ({
        player: injury.athlete?.displayName || 'Unknown Player',
        status: injury.status?.toLowerCase() || 'questionable',
        injury: injury.type || 'Undisclosed',
        impact: this.assessInjuryImpact(injury.athlete?.position, injury.type)
      }));
    } catch (error) {
      logger.error(`Error fetching injury reports for team ${teamId}:`, error);
      return [];
    }
  }

  /**
   * Fetch recent news from free news APIs
   */
  static async getTeamNews(teamName: string, sport: string): Promise<{
    headlines: string[];
    sentiment: 'positive' | 'negative' | 'neutral';
    relevantNews: string[];
  }> {
    try {
      // Using NewsAPI (free tier: 1000 requests/month)
      const apiKey = process.env.NEWS_API_KEY;
      if (!apiKey) {
        return {
          headlines: [],
          sentiment: 'neutral',
          relevantNews: []
        };
      }

      const response = await axios.get('https://newsapi.org/v2/everything', {
        params: {
          q: `"${teamName}" ${sport}`,
          sortBy: 'publishedAt',
          pageSize: 10,
          apiKey
        }
      });

      const articles = response.data.articles || [];
      const headlines = articles.map((article: any) => article.title);
      const relevantNews = articles
        .filter((article: any) => 
          article.title.toLowerCase().includes('injury') ||
          article.title.toLowerCase().includes('trade') ||
          article.title.toLowerCase().includes('suspend')
        )
        .map((article: any) => article.title);

      // Simple sentiment analysis based on keywords
      const negativeKeywords = ['injury', 'suspend', 'fine', 'loss', 'defeat', 'controversy'];
      const positiveKeywords = ['win', 'victory', 'return', 'sign', 'extend', 'career-high'];
      
      const headlineText = headlines.join(' ').toLowerCase();
      const negativeCount = negativeKeywords.filter(word => headlineText.includes(word)).length;
      const positiveCount = positiveKeywords.filter(word => headlineText.includes(word)).length;
      
      let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
      if (positiveCount > negativeCount) sentiment = 'positive';
      else if (negativeCount > positiveCount) sentiment = 'negative';

      return {
        headlines,
        sentiment,
        relevantNews
      };
    } catch (error) {
      logger.error(`Error fetching news for ${teamName}:`, error);
      return {
        headlines: [],
        sentiment: 'neutral',
        relevantNews: []
      };
    }
  }

  /**
   * Fetch historical head-to-head data
   */
  static async getHeadToHeadData(team1Id: string, team2Id: string, sport: 'nba' | 'nfl' | 'mlb'): Promise<{
    recentMeetings: Array<{
      date: string;
      winner: string;
      score: string;
      location: 'home' | 'away';
    }>;
    overallRecord: {
      team1Wins: number;
      team2Wins: number;
      ties?: number;
    };
    trends: string[];
  }> {
    try {
      // This would typically require scraping or using sports reference APIs
      // For now, return a placeholder structure
      return {
        recentMeetings: [],
        overallRecord: {
          team1Wins: 0,
          team2Wins: 0
        },
        trends: []
      };
    } catch (error) {
      logger.error('Error fetching head-to-head data:', error);
      return {
        recentMeetings: [],
        overallRecord: { team1Wins: 0, team2Wins: 0 },
        trends: []
      };
    }
  }

  private static assessInjuryImpact(position: string, injuryType: string): 'high' | 'medium' | 'low' {
    // Assess impact based on position and injury type
    const keyPositions = ['QB', 'RB', 'WR', 'PG', 'SG', 'SF', 'C', 'P', 'SS'];
    const seriousInjuries = ['knee', 'ankle', 'shoulder', 'concussion', 'hamstring'];
    
    if (keyPositions.includes(position) && seriousInjuries.some(inj => 
      injuryType.toLowerCase().includes(inj))) {
      return 'high';
    }
    if (keyPositions.includes(position) || seriousInjuries.some(inj => 
      injuryType.toLowerCase().includes(inj))) {
      return 'medium';
    }
    return 'low';
  }
}

// Tool functions for Gemini integration
export const freeDataTeamStatsTool = {
  name: "free_data_team_stats",
  description: "Fetches team statistics from free ESPN API",
  func: async (teamId: string, sport: 'nba' | 'nfl' | 'mlb' | 'nhl') => {
    return await FreeDataSources.getTeamStats(teamId, sport);
  }
};

export const freeDataPlayerStatsTool = {
  name: "free_data_player_stats", 
  description: "Fetches player statistics from free ESPN API",
  func: async (playerId: string, sport: 'nba' | 'nfl' | 'mlb') => {
    return await FreeDataSources.getPlayerStats(playerId, sport);
  }
};

export const freeDataWeatherTool = {
  name: "free_data_weather",
  description: "Fetches weather data for outdoor sports games",
  func: async (city: string, gameDate: Date) => {
    return await FreeDataSources.getWeatherData(city, gameDate);
  }
};

export const freeDataInjuryReportsTool = {
  name: "free_data_injury_reports",
  description: "Fetches injury reports from free sources",
  func: async (teamId: string, sport: 'nba' | 'nfl' | 'mlb') => {
    return await FreeDataSources.getInjuryReports(teamId, sport);
  }
};

export const freeDataTeamNewsTool = {
  name: "free_data_team_news",
  description: "Fetches recent team news and sentiment analysis",
  func: async (teamName: string, sport: string) => {
    return await FreeDataSources.getTeamNews(teamName, sport);
  }
}; 