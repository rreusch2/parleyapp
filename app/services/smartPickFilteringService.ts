/**
 * Smart Pick Filtering Service
 * Handles intelligent pick distribution based on user tier and sport preferences
 * Supports fallback logic for insufficient preferred sports
 */

export interface Pick {
  id: string;
  match_teams: string;
  pick: string;
  odds: string;
  confidence: number;
  value_percentage: number;
  reasoning: string;
  bet_type: string;
  sport: string;
  created_at?: string;
  user_id?: string;
}

export interface UserProfile {
  subscription_tier: 'free' | 'pro' | 'elite';
  max_daily_picks: number;
  sport_preferences: {
    mlb?: boolean;
    wnba?: boolean;
    ufc?: boolean;
    mma?: boolean;
  };
  pick_distribution?: {
    auto?: boolean;
    mlb_team?: number;
    mlb_prop?: number;
    wnba_team?: number;
    wnba_prop?: number;
    ufc_team?: number;
    ufc_prop?: number;
  };
}

export interface FilterResult {
  filteredPicks: Pick[];
  distribution: SportDistribution;
  fallbackUsed: boolean;
  notificationMessage?: string;
  totalAllocated: number;
}

export interface SportDistribution {
  [sport: string]: {
    team: number;
    props: number;
    total: number;
  };
}

export class SmartPickFilteringService {
  // Tier limits
  private static readonly TIER_LIMITS = {
    elite: 30,
    pro: 20,
    free: 10
  };

  // Sport mapping
  private static readonly SPORT_MAP = {
    'Major League Baseball': 'MLB',
    'MLB': 'MLB',
    'mlb': 'MLB',
    'Women\'s National Basketball Association': 'WNBA',
    'WNBA': 'WNBA',
    'wnba': 'WNBA',
    'Ultimate Fighting Championship': 'UFC',
    'UFC': 'UFC',
    'ufc': 'UFC',
    'MMA': 'UFC',
    'mma': 'UFC'
  };

  /**
   * Main filtering function that applies intelligent pick distribution
   */
  static filterPicksForUser(
    allTeamPicks: Pick[],
    allPropPicks: Pick[],
    userProfile: UserProfile
  ): FilterResult {
    console.log('🎯 Starting smart pick filtering...');
    console.log('📊 Input:', {
      teamPicks: allTeamPicks.length,
      propPicks: allPropPicks.length,
      tier: userProfile.subscription_tier,
      maxPicks: userProfile.max_daily_picks,
      preferences: userProfile.sport_preferences
    });

    // Get user's tier limit
    const maxPicks = this.TIER_LIMITS[userProfile.subscription_tier] || 10;
    
    // Normalize sports in picks
    const normalizedTeamPicks = this.normalizeSports(allTeamPicks);
    const normalizedPropPicks = this.normalizeSports(allPropPicks);
    
    // Get user's preferred sports
    const preferredSports = this.getPreferredSports(userProfile.sport_preferences);
    
    // Check if user has custom distribution (Elite users)
    if (userProfile.subscription_tier === 'elite' && 
        userProfile.pick_distribution && 
        !userProfile.pick_distribution.auto) {
      return this.applyCustomDistribution(
        normalizedTeamPicks,
        normalizedPropPicks,
        userProfile.pick_distribution,
        maxPicks
      );
    }

    // Apply smart auto-distribution
    return this.applySmartDistribution(
      normalizedTeamPicks,
      normalizedPropPicks,
      preferredSports,
      maxPicks,
      userProfile.subscription_tier
    );
  }

  /**
   * Normalize sport names to consistent format
   */
  private static normalizeSports(picks: Pick[]): Pick[] {
    return picks.map(pick => ({
      ...pick,
      sport: this.SPORT_MAP[pick.sport] || pick.sport.toUpperCase()
    }));
  }

  /**
   * Extract preferred sports from user preferences
   */
  private static getPreferredSports(sportPreferences: UserProfile['sport_preferences']): string[] {
    const preferred: string[] = [];
    
    if (sportPreferences?.mlb) preferred.push('MLB');
    if (sportPreferences?.wnba) preferred.push('WNBA');
    if (sportPreferences?.ufc || sportPreferences?.mma) preferred.push('UFC');
    
    // If no preferences set, include all available sports
    return preferred.length > 0 ? preferred : ['MLB', 'WNBA', 'UFC'];
  }

  /**
   * Apply custom distribution for Elite users with manual settings
   */
  private static applyCustomDistribution(
    teamPicks: Pick[],
    propPicks: Pick[],
    distribution: NonNullable<UserProfile['pick_distribution']>,
    maxPicks: number
  ): FilterResult {
    console.log('👑 Applying custom Elite distribution...');

    const result: FilterResult = {
      filteredPicks: [],
      distribution: {},
      fallbackUsed: false,
      totalAllocated: 0
    };

    const sports = ['MLB', 'WNBA', 'UFC'];
    
    for (const sport of sports) {
      const teamCount = distribution[`${sport.toLowerCase()}_team` as keyof typeof distribution] as number || 0;
      const propCount = distribution[`${sport.toLowerCase()}_prop` as keyof typeof distribution] as number || 0;
      
      if (teamCount > 0 || propCount > 0) {
        // Get picks for this sport
        const sportTeamPicks = teamPicks.filter(p => p.sport === sport);
        const sportPropPicks = propPicks.filter(p => p.sport === sport);
        
        // Add team picks
        const selectedTeamPicks = sportTeamPicks
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, teamCount);
        
        // Add prop picks
        const selectedPropPicks = sportPropPicks
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, propCount);
        
        result.filteredPicks.push(...selectedTeamPicks, ...selectedPropPicks);
        
        result.distribution[sport] = {
          team: selectedTeamPicks.length,
          props: selectedPropPicks.length,
          total: selectedTeamPicks.length + selectedPropPicks.length
        };
        
        result.totalAllocated += selectedTeamPicks.length + selectedPropPicks.length;
      }
    }

    console.log('✅ Custom distribution applied:', result.distribution);
    return result;
  }

  /**
   * Apply smart auto-distribution based on preferences and availability
   */
  private static applySmartDistribution(
    teamPicks: Pick[],
    propPicks: Pick[],
    preferredSports: string[],
    maxPicks: number,
    tier: string
  ): FilterResult {
    console.log('🧠 Applying smart auto-distribution...');
    console.log('📊 Preferred sports:', preferredSports);

    // Get available sports with their pick counts
    const availableSports = this.getAvailableSports(teamPicks, propPicks);
    console.log('📊 Available sports:', availableSports);

    // Filter by preferred sports first
    const preferredAvailable = Object.keys(availableSports)
      .filter(sport => preferredSports.includes(sport))
      .reduce((acc, sport) => {
        acc[sport] = availableSports[sport];
        return acc;
      }, {} as typeof availableSports);

    let sportsToUse = preferredAvailable;
    let fallbackUsed = false;
    let notificationMessage: string | undefined;

    // Check if we have enough picks from preferred sports
    const totalPreferredPicks = Object.values(preferredAvailable)
      .reduce((sum, counts) => sum + counts.team + counts.props, 0);

    if (totalPreferredPicks < maxPicks && Object.keys(availableSports).length > Object.keys(preferredAvailable).length) {
      // Need to use fallback sports
      sportsToUse = availableSports;
      fallbackUsed = true;
      
      const otherSports = Object.keys(availableSports)
        .filter(sport => !preferredSports.includes(sport));
      
      if (otherSports.length > 0) {
        notificationMessage = `Added picks from ${otherSports.join(', ')} to reach your daily limit`;
      }
    }

    // Calculate distribution
    const distribution = this.calculateDistribution(sportsToUse, maxPicks, preferredSports, fallbackUsed);

    // Apply distribution to get final picks
    const result = this.applyDistribution(teamPicks, propPicks, distribution, tier);

    return {
      ...result,
      fallbackUsed,
      notificationMessage
    };
  }

  /**
   * Get available sports with their pick counts
   */
  private static getAvailableSports(teamPicks: Pick[], propPicks: Pick[]): { [sport: string]: { team: number; props: number } } {
    const sports: { [sport: string]: { team: number; props: number } } = {};

    // Count team picks by sport
    teamPicks.forEach(pick => {
      const sport = pick.sport;
      if (!sports[sport]) sports[sport] = { team: 0, props: 0 };
      sports[sport].team++;
    });

    // Count prop picks by sport
    propPicks.forEach(pick => {
      const sport = pick.sport;
      if (!sports[sport]) sports[sport] = { team: 0, props: 0 };
      sports[sport].props++;
    });

    return sports;
  }

  /**
   * Calculate how to distribute picks across sports
   */
  private static calculateDistribution(
    availableSports: { [sport: string]: { team: number; props: number } },
    maxPicks: number,
    preferredSports: string[],
    fallbackUsed: boolean
  ): { [sport: string]: { team: number; props: number } } {
    const distribution: { [sport: string]: { team: number; props: number } } = {};
    const sportsList = Object.keys(availableSports);

    if (sportsList.length === 0) return distribution;

    // Prioritize preferred sports
    const prioritizedSports = [
      ...preferredSports.filter(sport => availableSports[sport]),
      ...sportsList.filter(sport => !preferredSports.includes(sport))
    ];

    let remainingPicks = maxPicks;

    // First pass: give minimum allocation to each available sport
    for (const sport of prioritizedSports) {
      if (remainingPicks <= 0) break;

      const available = availableSports[sport];
      const minAllocation = Math.min(5, Math.floor(remainingPicks / (sportsList.length - Object.keys(distribution).length)) || 1);
      
      const teamPicks = Math.min(Math.ceil(minAllocation / 2), available.team);
      const propPicks = Math.min(minAllocation - teamPicks, available.props);
      
      distribution[sport] = { team: teamPicks, props: propPicks };
      remainingPicks -= (teamPicks + propPicks);
    }

    // Second pass: distribute remaining picks proportionally
    while (remainingPicks > 0) {
      let allocated = false;

      for (const sport of prioritizedSports) {
        if (remainingPicks <= 0) break;

        const current = distribution[sport] || { team: 0, props: 0 };
        const available = availableSports[sport];
        const currentTotal = current.team + current.props;
        const availableTotal = available.team + available.props;

        // Don't exceed 30 picks per sport or available picks
        if (currentTotal < Math.min(30, availableTotal)) {
          // Prefer team picks slightly, but balance with props
          if (current.team <= current.props && current.team < available.team) {
            distribution[sport].team++;
          } else if (current.props < available.props) {
            distribution[sport].props++;
          } else if (current.team < available.team) {
            distribution[sport].team++;
          }
          
          remainingPicks--;
          allocated = true;
        }
      }

      if (!allocated) break; // Can't allocate any more picks
    }

    console.log('📊 Calculated distribution:', distribution);
    return distribution;
  }

  /**
   * Apply the calculated distribution to get final picks
   */
  private static applyDistribution(
    teamPicks: Pick[],
    propPicks: Pick[],
    distribution: { [sport: string]: { team: number; props: number } },
    tier: string
  ): Omit<FilterResult, 'fallbackUsed' | 'notificationMessage'> {
    const result: Pick[] = [];
    const finalDistribution: SportDistribution = {};

    for (const [sport, allocation] of Object.entries(distribution)) {
      // Get team picks for this sport
      const sportTeamPicks = teamPicks
        .filter(p => p.sport === sport)
        .sort((a, b) => b.confidence - a.confidence) // Sort by confidence
        .slice(0, allocation.team);

      // Get prop picks for this sport
      const sportPropPicks = propPicks
        .filter(p => p.sport === sport)
        .sort((a, b) => b.confidence - a.confidence) // Sort by confidence
        .slice(0, allocation.props);

      result.push(...sportTeamPicks, ...sportPropPicks);

      finalDistribution[sport] = {
        team: sportTeamPicks.length,
        props: sportPropPicks.length,
        total: sportTeamPicks.length + sportPropPicks.length
      };
    }

    // Sort final picks by confidence for best user experience
    result.sort((a, b) => b.confidence - a.confidence);

    console.log('✅ Final distribution applied:', finalDistribution);
    console.log('🎯 Total picks selected:', result.length);

    return {
      filteredPicks: result,
      distribution: finalDistribution,
      totalAllocated: result.length
    };
  }

  /**
   * Get picks for a specific type (team or props)
   */
  static getPicksByType(allPicks: Pick[], type: 'team' | 'props'): Pick[] {
    if (type === 'team') {
      return allPicks.filter(pick => {
        // Team picks include: spread, moneyline, and team totals
        const betType = pick.bet_type?.toLowerCase() || '';
        return (
          betType === 'spread' ||
          betType === 'moneyline' ||
          betType === 'total' ||
          betType === 'team_total' ||
          // Fallback for picks without proper bet_type - exclude player props
          (!betType && !pick.bet_type?.toLowerCase().includes('prop') && 
           !pick.pick.toLowerCase().includes('batter') &&
           !pick.pick.toLowerCase().includes('pitcher') &&
           !pick.pick.toLowerCase().includes('hits') &&
           !pick.pick.toLowerCase().includes('rbis') &&
           !pick.pick.toLowerCase().includes('strikeouts'))
        );
      });
    } else {
      return allPicks.filter(pick => {
        // Prop picks are individual player performance bets
        const betType = pick.bet_type?.toLowerCase() || '';
        return (
          betType === 'player_prop' ||
          betType.includes('prop') ||
          // Fallback for picks without proper bet_type - look for player-specific terms
          (!betType && (
            pick.pick.toLowerCase().includes('batter') ||
            pick.pick.toLowerCase().includes('pitcher') ||
            pick.pick.toLowerCase().includes('hits') ||
            pick.pick.toLowerCase().includes('rbis') ||
            pick.pick.toLowerCase().includes('strikeouts') ||
            pick.pick.toLowerCase().includes('home runs')
          ))
        );
      });
    }
  }

  /**
   * Utility function to show notification to user
   */
  static formatNotificationMessage(
    totalSelected: number,
    maxPicks: number,
    fallbackUsed: boolean,
    fallbackSports?: string[]
  ): string | undefined {
    if (!fallbackUsed) return undefined;

    if (fallbackSports && fallbackSports.length > 0) {
      return `Added picks from ${fallbackSports.join(', ')} to reach your ${maxPicks} daily picks limit`;
    }

    return `Showing ${totalSelected} picks from all available sports to reach your daily limit`;
  }
}

export default SmartPickFilteringService;