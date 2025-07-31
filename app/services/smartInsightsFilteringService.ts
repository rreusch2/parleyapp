/**
 * Smart Insights Filtering Service
 * Handles intelligent insights distribution based on user tier and sport preferences
 * Elite: 12 insights, Pro: 8 insights, Free: 5 insights
 */

export interface Insight {
  id?: string;
  title: string;
  content: string;
  category: string;
  confidence: number;
  sport: string;
  created_at: string;
  insight_order?: number;
}

export interface UserProfile {
  subscription_tier: 'free' | 'pro' | 'elite';
  max_daily_insights?: number;
  sport_preferences: {
    mlb?: boolean;
    wnba?: boolean;
    ufc?: boolean;
    mma?: boolean;
  };
}

export interface InsightsFilterResult {
  filteredInsights: Insight[];
  distribution: SportInsightsDistribution;
  fallbackUsed: boolean;
  notificationMessage?: string;
  totalAllocated: number;
}

export interface SportInsightsDistribution {
  [sport: string]: {
    count: number;
    insights: Insight[];
  };
}

export class SmartInsightsFilteringService {
  // Tier limits for insights
  private static readonly TIER_LIMITS = {
    elite: 12,
    pro: 8,
    free: 5
  };

  // Sport mapping for consistency
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
    'mma': 'UFC',
    'Multi-Sport': 'Multi-Sport'
  };

  /**
   * Main filtering function for insights
   */
  static filterInsightsForUser(
    allInsights: Insight[],
    userProfile: UserProfile
  ): InsightsFilterResult {
    console.log('🎯 Starting smart insights filtering...');
    console.log('📊 Input:', {
      totalInsights: allInsights.length,
      tier: userProfile.subscription_tier,
      preferences: userProfile.sport_preferences
    });

    // Get user's tier limit
    const maxInsights = userProfile.max_daily_insights || 
                       this.TIER_LIMITS[userProfile.subscription_tier] || 5;
    
    // Normalize sports in insights
    const normalizedInsights = this.normalizeSports(allInsights);
    
    // Get user's preferred sports
    const preferredSports = this.getPreferredSports(userProfile.sport_preferences);
    
    // Apply smart distribution
    return this.applySmartInsightsDistribution(
      normalizedInsights,
      preferredSports,
      maxInsights,
      userProfile.subscription_tier
    );
  }

  /**
   * Normalize sport names to consistent format
   */
  private static normalizeSports(insights: Insight[]): Insight[] {
    return insights.map(insight => ({
      ...insight,
      sport: this.SPORT_MAP[insight.sport] || insight.sport.toUpperCase()
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
    return preferred.length > 0 ? preferred : ['MLB', 'WNBA', 'UFC', 'Multi-Sport'];
  }

  /**
   * Apply smart insights distribution
   */
  private static applySmartInsightsDistribution(
    insights: Insight[],
    preferredSports: string[],
    maxInsights: number,
    tier: string
  ): InsightsFilterResult {
    console.log('🧠 Applying smart insights distribution...');
    console.log('📊 Preferred sports:', preferredSports);

    // Group insights by sport
    const insightsBySport = this.groupInsightsBySport(insights);
    console.log('📊 Available sports:', Object.keys(insightsBySport));

    // Filter by preferred sports first
    const preferredAvailable = Object.keys(insightsBySport)
      .filter(sport => preferredSports.includes(sport))
      .reduce((acc, sport) => {
        acc[sport] = insightsBySport[sport];
        return acc;
      }, {} as typeof insightsBySport);

    let sportsToUse = preferredAvailable;
    let fallbackUsed = false;
    let notificationMessage: string | undefined;

    // Check if we have enough insights from preferred sports
    const totalPreferredInsights = Object.values(preferredAvailable)
      .reduce((sum, insights) => sum + insights.length, 0);

    if (totalPreferredInsights < maxInsights && Object.keys(insightsBySport).length > Object.keys(preferredAvailable).length) {
      // Need to use fallback sports
      sportsToUse = insightsBySport;
      fallbackUsed = true;
      
      const otherSports = Object.keys(insightsBySport)
        .filter(sport => !preferredSports.includes(sport));
      
      if (otherSports.length > 0) {
        notificationMessage = `Added insights from ${otherSports.join(', ')} to reach your daily limit`;
      }
    }

    // Calculate distribution across sports
    const distribution = this.calculateInsightsDistribution(sportsToUse, maxInsights, preferredSports);

    // Apply distribution to get final insights
    const result = this.applyInsightsDistribution(insights, distribution, maxInsights);

    return {
      ...result,
      fallbackUsed,
      notificationMessage
    };
  }

  /**
   * Group insights by sport
   */
  private static groupInsightsBySport(insights: Insight[]): { [sport: string]: Insight[] } {
    const grouped: { [sport: string]: Insight[] } = {};

    insights.forEach(insight => {
      const sport = insight.sport;
      if (!grouped[sport]) grouped[sport] = [];
      grouped[sport].push(insight);
    });

    // Sort insights within each sport by confidence
    Object.keys(grouped).forEach(sport => {
      grouped[sport].sort((a, b) => b.confidence - a.confidence);
    });

    return grouped;
  }

  /**
   * Calculate how to distribute insights across sports
   */
  private static calculateInsightsDistribution(
    insightsBySport: { [sport: string]: Insight[] },
    maxInsights: number,
    preferredSports: string[]
  ): { [sport: string]: number } {
    const distribution: { [sport: string]: number } = {};
    const sportsList = Object.keys(insightsBySport);

    if (sportsList.length === 0) return distribution;

    // Prioritize preferred sports
    const prioritizedSports = [
      ...preferredSports.filter(sport => insightsBySport[sport]),
      ...sportsList.filter(sport => !preferredSports.includes(sport))
    ];

    let remainingInsights = maxInsights;

    // First pass: give minimum allocation to each available sport
    for (const sport of prioritizedSports) {
      if (remainingInsights <= 0) break;

      const available = insightsBySport[sport].length;
      const minAllocation = Math.min(2, Math.floor(remainingInsights / (sportsList.length - Object.keys(distribution).length)) || 1);
      
      const allocation = Math.min(minAllocation, available);
      distribution[sport] = allocation;
      remainingInsights -= allocation;
    }

    // Second pass: distribute remaining insights proportionally
    while (remainingInsights > 0) {
      let allocated = false;

      for (const sport of prioritizedSports) {
        if (remainingInsights <= 0) break;

        const current = distribution[sport] || 0;
        const available = insightsBySport[sport].length;

        // Don't exceed available insights for this sport
        if (current < available && current < 8) { // Max 8 insights per sport
          distribution[sport] = current + 1;
          remainingInsights--;
          allocated = true;
        }
      }

      if (!allocated) break; // Can't allocate any more insights
    }

    console.log('📊 Calculated insights distribution:', distribution);
    return distribution;
  }

  /**
   * Apply the calculated distribution to get final insights
   */
  private static applyInsightsDistribution(
    allInsights: Insight[],
    distribution: { [sport: string]: number },
    maxInsights: number
  ): Omit<InsightsFilterResult, 'fallbackUsed' | 'notificationMessage'> {
    const result: Insight[] = [];
    const finalDistribution: SportInsightsDistribution = {};

    for (const [sport, count] of Object.entries(distribution)) {
      // Get insights for this sport
      const sportInsights = allInsights
        .filter(insight => insight.sport === sport)
        .sort((a, b) => b.confidence - a.confidence) // Sort by confidence
        .slice(0, count);

      result.push(...sportInsights);

      finalDistribution[sport] = {
        count: sportInsights.length,
        insights: sportInsights
      };
    }

    // Sort final insights by confidence for best user experience
    result.sort((a, b) => b.confidence - a.confidence);

    // Ensure we don't exceed maxInsights
    const finalResult = result.slice(0, maxInsights);

    console.log('✅ Final insights distribution applied:', finalDistribution);
    console.log('🎯 Total insights selected:', finalResult.length);

    return {
      filteredInsights: finalResult,
      distribution: finalDistribution,
      totalAllocated: finalResult.length
    };
  }

  /**
   * Get insights by category
   */
  static getInsightsByCategory(insights: Insight[]): { [category: string]: Insight[] } {
    const categorized: { [category: string]: Insight[] } = {};

    insights.forEach(insight => {
      const category = insight.category || 'general';
      if (!categorized[category]) categorized[category] = [];
      categorized[category].push(insight);
    });

    return categorized;
  }

  /**
   * Get insights by sport
   */
  static getInsightsBySport(insights: Insight[]): { [sport: string]: Insight[] } {
    return this.groupInsightsBySport(this.normalizeSports(insights));
  }

  /**
   * Utility function to format notification message
   */
  static formatNotificationMessage(
    totalSelected: number,
    maxInsights: number,
    fallbackUsed: boolean,
    fallbackSports?: string[]
  ): string | undefined {
    if (!fallbackUsed) return undefined;

    if (fallbackSports && fallbackSports.length > 0) {
      return `Added insights from ${fallbackSports.join(', ')} to reach your ${maxInsights} daily insights limit`;
    }

    return `Showing ${totalSelected} insights from all available sports to reach your daily limit`;
  }

  /**
   * Get tier-specific insight limits
   */
  static getTierLimits() {
    return this.TIER_LIMITS;
  }
}

export default SmartInsightsFilteringService;