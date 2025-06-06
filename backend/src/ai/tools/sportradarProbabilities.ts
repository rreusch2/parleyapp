import fetch from 'node-fetch';
import { sportradarOddsService } from './sportradar';

const SPORTRADAR_API_KEY = process.env.SPORTRADAR_API_KEY;
const PROBABILITIES_BASE_URL = 'https://api.sportradar.us/oddscomparison/v2/probabilities';

/**
 * Service to handle both direct Sportradar probabilities (if available) and implied probabilities.
 * This service combines probabilities from multiple sources to provide comprehensive insights.
 */
export const sportradarProbabilitiesService = {
  /**
   * Attempts to fetch Sportradar's direct probabilities first, then falls back to implied probabilities.
   * @returns Combined probabilities from all available sources with source attribution.
   */
  getEventProbabilities: async (params: {
    sportEventId: string;
    sportContext: string;
  }): Promise<any> => {
    const results: any = {
      sportEventId: params.sportEventId,
      sportContext: params.sportContext,
      timestamp: new Date().toISOString(),
      sources: []
    };

    try {
      // First, try to fetch direct probabilities if available
      const directProbsResponse = await fetch(
        `${PROBABILITIES_BASE_URL}/sport_events/${params.sportEventId}`,
        {
          headers: {
            'x-api-key': SPORTRADAR_API_KEY || '',
            'Accept': 'application/json'
          }
        }
      );

      if (directProbsResponse.ok) {
        const directProbs = await directProbsResponse.json();
        results.sources.push({
          type: 'direct',
          name: 'Sportradar Direct Probabilities',
          probabilities: directProbs,
          confidence: 'high'
        });
      } else {
        console.log('[SportradarProbabilitiesService] Direct probabilities not available, using implied probabilities');
      }
    } catch (error) {
      console.log('[SportradarProbabilitiesService] Error fetching direct probabilities:', error);
      // Don't throw - we'll fall back to implied probabilities
    }

    try {
      // Always fetch implied probabilities from odds
      const impliedProbs = await sportradarOddsService.getPrematchGameOdds(params);
      
      if (!impliedProbs.error) {
        results.sources.push({
          type: 'implied',
          name: 'Market Implied Probabilities',
          probabilities: {
            markets: impliedProbs.markets.map((market: any) => ({
              marketId: market.marketId,
              marketName: market.marketName,
              marketType: market.marketType,
              consensusImpliedProbabilities: market.consensusImpliedProbabilities,
              bookmakerProbabilities: market.books.map((book: any) => ({
                bookmaker: book.bookmaker,
                impliedProbabilities: book.impliedProbabilities
              }))
            }))
          },
          confidence: 'medium',
          methodology: 'Derived from market odds with vig removed'
        });
      }
    } catch (error) {
      console.error('[SportradarProbabilitiesService] Error calculating implied probabilities:', error);
    }

    // Add metadata about probability sources
    results.availableSources = results.sources.map((source: any) => source.type);
    results.recommendedSource = results.sources.length > 0 ? 
      results.sources.reduce((a: any, b: any) => 
        (a.confidence === 'high' || b.confidence === 'medium') ? a : b
      ).type : null;

    return results;
  },

  /**
   * Gets player prop probabilities from available sources.
   */
  getPlayerPropProbabilities: async (params: {
    sportEventId: string;
    sportContext: string;
    marketId?: string;
  }): Promise<any> => {
    const results: any = {
      sportEventId: params.sportEventId,
      sportContext: params.sportContext,
      timestamp: new Date().toISOString(),
      sources: []
    };

    try {
      // First, try to fetch direct probabilities if available
      const directProbsResponse = await fetch(
        `${PROBABILITIES_BASE_URL}/sport_events/${params.sportEventId}/players`,
        {
          headers: {
            'x-api-key': SPORTRADAR_API_KEY || '',
            'Accept': 'application/json'
          }
        }
      );

      if (directProbsResponse.ok) {
        const directProbs = await directProbsResponse.json();
        results.sources.push({
          type: 'direct',
          name: 'Sportradar Direct Player Probabilities',
          probabilities: directProbs,
          confidence: 'high'
        });
      } else {
        console.log('[SportradarProbabilitiesService] Direct player probabilities not available, using implied probabilities');
      }
    } catch (error) {
      console.log('[SportradarProbabilitiesService] Error fetching direct player probabilities:', error);
      // Don't throw - we'll fall back to implied probabilities
    }

    try {
      // Always fetch implied probabilities from odds
      const impliedProbs = await sportradarOddsService.getPlayerPropOdds(params);
      
      if (!impliedProbs.error) {
        results.sources.push({
          type: 'implied',
          name: 'Market Implied Player Probabilities',
          probabilities: {
            playerProps: impliedProbs.playerProps.map((prop: any) => ({
              playerId: prop.playerId,
              playerName: prop.playerName,
              marketId: prop.marketId,
              marketName: prop.marketName,
              line: prop.line,
              consensusImpliedProbabilities: prop.consensusImpliedProbabilities,
              bookmakerProbabilities: prop.books.map((book: any) => ({
                bookmaker: book.bookmaker,
                impliedProbabilities: book.impliedProbabilities
              }))
            }))
          },
          confidence: 'medium',
          methodology: 'Derived from market odds with vig removed'
        });
      }
    } catch (error) {
      console.error('[SportradarProbabilitiesService] Error calculating implied player probabilities:', error);
    }

    // Add metadata about probability sources
    results.availableSources = results.sources.map((source: any) => source.type);
    results.recommendedSource = results.sources.length > 0 ? 
      results.sources.reduce((a: any, b: any) => 
        (a.confidence === 'high' || b.confidence === 'medium') ? a : b
      ).type : null;

    return results;
  }
};

// Gemini tool schemas for the probabilities service
export const sportradarProbabilitiesTool = {
  name: 'sportradarGetProbabilities',
  description: 'Get probabilities for a sport event from Sportradar, combining direct probabilities (if available) and market-implied probabilities.',
  parameters: {
    type: 'object',
    properties: {
      sportEventId: {
        type: 'string',
        description: 'Sportradar ID for the sport event'
      },
      sportContext: {
        type: 'string',
        description: 'Sport context (e.g., "NBA", "NFL") for logging'
      }
    },
    required: ['sportEventId', 'sportContext']
  }
};

export const sportradarPlayerPropProbabilitiesTool = {
  name: 'sportradarGetPlayerPropProbabilities',
  description: 'Get player prop probabilities from Sportradar, combining direct probabilities (if available) and market-implied probabilities.',
  parameters: {
    type: 'object',
    properties: {
      sportEventId: {
        type: 'string',
        description: 'Sportradar ID for the sport event'
      },
      sportContext: {
        type: 'string',
        description: 'Sport context (e.g., "NBA", "NFL") for logging'
      },
      marketId: {
        type: 'string',
        description: 'Optional: filter by specific market ID (e.g., PLAYER_PROP_MARKETS.NBA.POINTS)'
      }
    },
    required: ['sportEventId', 'sportContext']
  }
}; 