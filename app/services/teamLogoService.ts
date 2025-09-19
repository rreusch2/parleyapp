import { supabase } from './api/supabaseClient';

export interface TeamLogo {
  team_name: string;
  team_abbreviation: string;
  logo_url: string | null;
  sport_key: string;
  city: string;
}

class TeamLogoService {
  private logoCache = new Map<string, TeamLogo | null>();
  private pendingRequests = new Map<string, Promise<TeamLogo | null>>();

  /**
   * Generate a cache key for team lookup
   */
  private getCacheKey(teamName: string, league: string): string {
    return `${league.toLowerCase()}-${teamName.toLowerCase()}`;
  }

  /**
   * Fetch team logo data from the database
   */
  async getTeamLogo(teamName: string, league: string): Promise<TeamLogo | null> {
    const cacheKey = this.getCacheKey(teamName, league);

    // Return cached result if available
    if (this.logoCache.has(cacheKey)) {
      return this.logoCache.get(cacheKey) || null;
    }

    // Return pending request if one exists
    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey) || null;
    }

    // Create new request
    const request = this.fetchTeamFromDatabase(teamName, league);
    this.pendingRequests.set(cacheKey, request);

    try {
      const result = await request;
      this.logoCache.set(cacheKey, result);
      this.pendingRequests.delete(cacheKey);
      return result;
    } catch (error) {
      this.pendingRequests.delete(cacheKey);
      console.error(`Error fetching team logo for ${teamName} (${league}):`, error);
      return null;
    }
  }

  /**
   * Fetch team data from Supabase
   */
  private async fetchTeamFromDatabase(teamName: string, league: string): Promise<TeamLogo | null> {
    try {
      // Map frontend league names to database sport_key values
      let sportKey = league.toLowerCase();
      if (league === 'CFB') {
        sportKey = 'ncaaf';
      } else if (league === 'UFC') {
        sportKey = 'mma';
      }

      // Try multiple search strategies to find the team
      const searchStrategies = [
        // Exact team name match
        supabase
          .from('teams')
          .select('team_name, team_abbreviation, logo_url, sport_key, city')
          .eq('sport_key', sportKey)
          .eq('team_name', teamName)
          .limit(1),
        
        // Case-insensitive team name match
        supabase
          .from('teams')
          .select('team_name, team_abbreviation, logo_url, sport_key, city')
          .eq('sport_key', sportKey)
          .ilike('team_name', teamName)
          .limit(1),
        
        // Fuzzy match on team name, city, or abbreviation
        supabase
          .from('teams')
          .select('team_name, team_abbreviation, logo_url, sport_key, city')
          .eq('sport_key', sportKey)
          .or(`team_name.ilike.%${teamName}%,city.ilike.%${teamName}%,team_abbreviation.ilike.%${teamName}%`)
          .limit(1)
      ];

      for (const strategy of searchStrategies) {
        const { data, error } = await strategy;
        
        if (error) {
          console.warn(`Database error for ${teamName} (${league}):`, error);
          continue;
        }

        if (data && data.length > 0) {
          const team = data[0];
          return {
            team_name: team.team_name,
            team_abbreviation: team.team_abbreviation,
            logo_url: team.logo_url,
            sport_key: team.sport_key,
            city: team.city
          };
        }
      }

      console.log(`No team found for: ${teamName} (${league})`);
      return null;
    } catch (error) {
      console.error(`Error fetching team from database:`, error);
      return null;
    }
  }

  /**
   * Batch fetch multiple team logos
   */
  async getMultipleTeamLogos(teams: { teamName: string; league: string }[]): Promise<Map<string, TeamLogo | null>> {
    const results = new Map<string, TeamLogo | null>();
    const promises = teams.map(async ({ teamName, league }) => {
      const cacheKey = this.getCacheKey(teamName, league);
      const logo = await this.getTeamLogo(teamName, league);
      results.set(cacheKey, logo);
      return { cacheKey, logo };
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Get team abbreviation from full name for fallback display
   */
  getTeamAbbreviation(teamName: string): string {
    // Split team name and take first letter of each significant word
    const words = teamName.split(' ').filter(word => 
      word.length > 2 && 
      !['the', 'of', 'and', 'at'].includes(word.toLowerCase())
    );
    
    if (words.length >= 2) {
      return words.slice(0, 2).map(word => word.charAt(0).toUpperCase()).join('');
    } else if (words.length === 1) {
      return words[0].substring(0, 3).toUpperCase();
    }
    
    return teamName.substring(0, 3).toUpperCase();
  }

  /**
   * Clear cache (useful for testing or memory management)
   */
  clearCache(): void {
    this.logoCache.clear();
    this.pendingRequests.clear();
  }
}

// Export singleton instance
export const teamLogoService = new TeamLogoService();
