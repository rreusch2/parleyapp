import fetch from 'node-fetch'; // Or your preferred HTTP client

const SPORTRADAR_API_KEY = process.env.SPORTRADAR_API_KEY;

// Base URLs for different Sportradar APIs
const OC_PLAYER_PROPS_BASE_URL = 'https://api.sportradar.us/oddscomparison-playerprops/v2';
const OC_PREMATCH_BASE_URL = 'https://api.sportradar.us/oddscomparison-prematch/v2';
const OC_REGULAR_BASE_URL = 'https://api.sportradar.us/oddscomparison-regular/v1';

// Market IDs for player props by sport (from docs)
export const PLAYER_PROP_MARKETS = {
  NBA: {
    POINTS: 'sr:market:921',
    ASSISTS: 'sr:market:922',
    REBOUNDS: 'sr:market:923',
    THREE_POINTERS: 'sr:market:924',
    STEALS: 'sr:market:8000',
    BLOCKS: 'sr:market:8001',
    TURNOVERS: 'sr:market:8002',
    POINTS_REBOUNDS: 'sr:market:8003',
    POINTS_ASSISTS: 'sr:market:8004',
    REBOUNDS_ASSISTS: 'sr:market:8005',
    POINTS_ASSISTS_REBOUNDS: 'sr:market:8006',
    BLOCKS_STEALS: 'sr:market:8007',
    DOUBLE_DOUBLE: 'sr:market:8008',
    TRIPLE_DOUBLE: 'sr:market:8009'
  },
  NFL: {
    PASSING_YARDS: 'sr:market:914',
    PASSING_COMPLETIONS: 'sr:market:915',
    PASSING_TOUCHDOWNS: 'sr:market:916',
    CARRIES: 'sr:market:917',
    RUSHING_YARDS: 'sr:market:918',
    RECEIVING_YARDS: 'sr:market:919',
    RECEPTIONS: 'sr:market:920',
    PASSING_INTERCEPTIONS: 'sr:market:6000',
    PASSING_ATTEMPTS: 'sr:market:6001',
    FIRST_TD: 'sr:market:6014',
    ANYTIME_TD: 'sr:market:6016',
    TWO_PLUS_TD: 'sr:market:6017',
    THREE_PLUS_TD: 'sr:market:6018'
  },
  MLB: {
    STRIKEOUTS: 'sr:market:925',
    TOTAL_BASES: 'sr:market:926',
    EARNED_RUNS: 'sr:market:928',
    HITS: 'sr:market:9000',
    RUNS: 'sr:market:9001',
    RBI: 'sr:market:9002',
    HOME_RUNS: 'sr:market:9003'
  }
};

/**
 * Utility functions for probability calculations
 */
const probabilityUtils = {
  /**
   * Convert American odds to decimal odds
   * @example -110 -> 1.91
   */
  americanToDecimal: (americanOdds: number): number => {
    if (americanOdds > 0) {
      return (americanOdds / 100) + 1;
    }
    return (100 / Math.abs(americanOdds)) + 1;
  },

  /**
   * Convert decimal odds to implied probability
   * @example 1.91 -> 0.524 (52.4%)
   */
  decimalToImpliedProbability: (decimalOdds: number): number => {
    return 1 / decimalOdds;
  },

  /**
   * Remove the vig from a set of implied probabilities
   * @param probabilities Array of raw implied probabilities that should sum to > 1 due to vig
   * @returns Array of true probabilities that sum to 1
   */
  removeVig: (probabilities: number[]): number[] => {
    const sum = probabilities.reduce((a, b) => a + b, 0);
    return probabilities.map(p => p / sum);
  }
};

/**
 * Service to interact with Sportradar Odds Comparison APIs.
 * This service fetches MARKET ODDS from various bookmakers and calculates implied probabilities.
 */
export const sportradarOddsService = {
  /**
   * Helper function to get sport ID and event ID mappings.
   * Uses the "Sports" and "Daily Schedules" endpoints.
   */
  getSportAndEventIds: async (params: {
    sport: string; // e.g., "NBA", "NFL"
    date: string; // YYYY-MM-DD format
  }): Promise<{ sportId: string; events: Array<{ id: string; name: string }> }> => {
    if (!SPORTRADAR_API_KEY) {
      throw new Error('Sportradar API key not configured.');
    }

    // First get the sport ID from the Sports endpoint
    const sportsUrl = `${OC_PLAYER_PROPS_BASE_URL}/en/sports.json?api_key=${SPORTRADAR_API_KEY}`;
    const sportsResponse = await fetch(sportsUrl);
    if (!sportsResponse.ok) {
      throw new Error(`Failed to fetch sports: ${sportsResponse.statusText}`);
    }
    const sportsData = await sportsResponse.json();
    const sport = sportsData.sports.find((s: any) => 
      s.name.toUpperCase().includes(params.sport.toUpperCase())
    );
    if (!sport) {
      throw new Error(`Sport ${params.sport} not found`);
    }

    // Then get events for that sport and date from Daily Schedules
    const scheduleUrl = `${OC_PLAYER_PROPS_BASE_URL}/en/sports/${sport.id}/schedules/${params.date}/summaries.json?api_key=${SPORTRADAR_API_KEY}`;
    const scheduleResponse = await fetch(scheduleUrl);
    if (!scheduleResponse.ok) {
      throw new Error(`Failed to fetch schedule: ${scheduleResponse.statusText}`);
    }
    const scheduleData = await scheduleResponse.json();

    return {
      sportId: sport.id,
      events: scheduleData.sport_events.map((event: any) => ({
        id: event.id,
        name: event.name
      }))
    };
  },

  /**
   * Fetches player prop odds and calculates implied probabilities.
   * Uses the "Sport Event Player Props" endpoint from the Odds Comparison Player Props API v2.
   */
  getPlayerPropOdds: async (params: {
    sportEventId: string;
    sportContext: string;
    marketId?: string;
  }): Promise<any> => {
    if (!SPORTRADAR_API_KEY) {
      return { error: 'Sportradar API key not configured.' };
    }

    const { sportEventId, sportContext, marketId } = params;
    const url = `${OC_PLAYER_PROPS_BASE_URL}/en/sport_events/${sportEventId}/player_props.json?api_key=${SPORTRADAR_API_KEY}`;
    
    console.log(`[SportradarOddsService] Fetching Player Prop Odds for event: ${sportEventId}, sport: ${sportContext}`);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.text();
        console.error(`[SportradarOddsService] Player Props API Error (${response.status}): ${errorData}`);
        throw new Error(`Sportradar Player Props API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[SportradarOddsService] Player Prop Odds Raw Response:', JSON.stringify(data, null, 2));

      // Transform the response into a more usable format
      const playerProps = data.player_markets
        .filter((market: any) => !marketId || market.id === marketId)
        .map((market: any) => {
          // Process each book's odds and calculate implied probabilities
          const processedBooks = market.books.map((book: any) => {
            const overOutcome = book.outcomes.find((o: any) => o.name === 'Over');
            const underOutcome = book.outcomes.find((o: any) => o.name === 'Under');
            
            if (!overOutcome || !underOutcome) return null;

            // Convert odds to probabilities
            const overDecimal = probabilityUtils.americanToDecimal(overOutcome.odds);
            const underDecimal = probabilityUtils.americanToDecimal(underOutcome.odds);
            
            const rawOverProb = probabilityUtils.decimalToImpliedProbability(overDecimal);
            const rawUnderProb = probabilityUtils.decimalToImpliedProbability(underDecimal);
            
            // Remove vig to get true probabilities
            const [trueOverProb, trueUnderProb] = probabilityUtils.removeVig([rawOverProb, rawUnderProb]);

            return {
              bookmaker: book.name,
              overOdds: overOutcome.odds,
              underOdds: underOutcome.odds,
              impliedProbabilities: {
                over: trueOverProb,
                under: trueUnderProb,
                vigPercentage: ((rawOverProb + rawUnderProb - 1) * 100).toFixed(2) + '%'
              }
            };
          }).filter(Boolean);

          return {
            playerId: market.player.id,
            playerName: market.player.name,
            marketId: market.id,
            marketName: market.name,
            line: market.line,
            books: processedBooks,
            consensusImpliedProbabilities: {
              over: processedBooks.reduce((sum, book) => sum + book.impliedProbabilities.over, 0) / processedBooks.length,
              under: processedBooks.reduce((sum, book) => sum + book.impliedProbabilities.under, 0) / processedBooks.length
            }
          };
        });

      return {
        sportEventId,
        sportContext,
        source: 'Sportradar Odds Comparison Player Props API',
        playerProps,
        timestamp: new Date().toISOString(),
        rawResponse: data // Keep for debugging
      };
    } catch (error: any) {
      console.error('[SportradarOddsService] Error fetching player prop odds:', error);
      return { error: `Failed to fetch player prop odds from Sportradar: ${error.message}` };
    }
  },

  /**
   * Fetches pre-match game odds and calculates implied probabilities.
   * Uses the "Sport Event Markets" endpoint from the Odds Comparison Prematch API v2.
   */
  getPrematchGameOdds: async (params: {
    sportEventId: string;
    sportContext: string;
  }): Promise<any> => {
    if (!SPORTRADAR_API_KEY) {
      return { error: 'Sportradar API key not configured.' };
    }

    const { sportEventId, sportContext } = params;
    const url = `${OC_PREMATCH_BASE_URL}/en/sport_events/${sportEventId}/markets.json?api_key=${SPORTRADAR_API_KEY}`;

    console.log(`[SportradarOddsService] Fetching Prematch Game Odds for event: ${sportEventId}, sport: ${sportContext}`);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.text();
        console.error(`[SportradarOddsService] Prematch Odds API Error (${response.status}): ${errorData}`);
        throw new Error(`Sportradar Prematch Odds API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('[SportradarOddsService] Prematch Game Odds Raw Response:', JSON.stringify(data, null, 2));

      // Transform the response into a more usable format
      const markets = data.markets.map((market: any) => {
        const baseMarket = {
          marketId: market.id,
          marketName: market.name,
          marketType: market.type
        };

        if (market.type === 'spread') {
          const processedBooks = market.books.map((book: any) => {
            const homeOutcome = book.outcomes.find((o: any) => o.type === 'home');
            const awayOutcome = book.outcomes.find((o: any) => o.type === 'away');
            
            const homeDecimal = probabilityUtils.americanToDecimal(homeOutcome.odds);
            const awayDecimal = probabilityUtils.americanToDecimal(awayOutcome.odds);
            
            const rawHomeProb = probabilityUtils.decimalToImpliedProbability(homeDecimal);
            const rawAwayProb = probabilityUtils.decimalToImpliedProbability(awayDecimal);
            
            const [trueHomeProb, trueAwayProb] = probabilityUtils.removeVig([rawHomeProb, rawAwayProb]);

            return {
              bookmaker: book.name,
              line: book.spread,
              homeTeamOdds: homeOutcome.odds,
              awayTeamOdds: awayOutcome.odds,
              impliedProbabilities: {
                home: trueHomeProb,
                away: trueAwayProb,
                vigPercentage: ((rawHomeProb + rawAwayProb - 1) * 100).toFixed(2) + '%'
              }
            };
          });

          return {
            ...baseMarket,
            books: processedBooks,
            consensusImpliedProbabilities: {
              home: processedBooks.reduce((sum, book) => sum + book.impliedProbabilities.home, 0) / processedBooks.length,
              away: processedBooks.reduce((sum, book) => sum + book.impliedProbabilities.away, 0) / processedBooks.length
            }
          };
        } else if (market.type === 'total') {
          const processedBooks = market.books.map((book: any) => {
            const overOutcome = book.outcomes.find((o: any) => o.name === 'Over');
            const underOutcome = book.outcomes.find((o: any) => o.name === 'Under');
            
            const overDecimal = probabilityUtils.americanToDecimal(overOutcome.odds);
            const underDecimal = probabilityUtils.americanToDecimal(underOutcome.odds);
            
            const rawOverProb = probabilityUtils.decimalToImpliedProbability(overDecimal);
            const rawUnderProb = probabilityUtils.decimalToImpliedProbability(underDecimal);
            
            const [trueOverProb, trueUnderProb] = probabilityUtils.removeVig([rawOverProb, rawUnderProb]);

            return {
              bookmaker: book.name,
              line: book.total,
              overOdds: overOutcome.odds,
              underOdds: underOutcome.odds,
              impliedProbabilities: {
                over: trueOverProb,
                under: trueUnderProb,
                vigPercentage: ((rawOverProb + rawUnderProb - 1) * 100).toFixed(2) + '%'
              }
            };
          });

          return {
            ...baseMarket,
            books: processedBooks,
            consensusImpliedProbabilities: {
              over: processedBooks.reduce((sum, book) => sum + book.impliedProbabilities.over, 0) / processedBooks.length,
              under: processedBooks.reduce((sum, book) => sum + book.impliedProbabilities.under, 0) / processedBooks.length
            }
          };
        } else { // moneyline
          const processedBooks = market.books.map((book: any) => {
            const homeOutcome = book.outcomes.find((o: any) => o.type === 'home');
            const awayOutcome = book.outcomes.find((o: any) => o.type === 'away');
            const drawOutcome = book.outcomes.find((o: any) => o.type === 'draw');
            
            const homeDecimal = probabilityUtils.americanToDecimal(homeOutcome.odds);
            const awayDecimal = probabilityUtils.americanToDecimal(awayOutcome.odds);
            const drawDecimal = drawOutcome ? probabilityUtils.americanToDecimal(drawOutcome.odds) : null;
            
            const rawHomeProb = probabilityUtils.decimalToImpliedProbability(homeDecimal);
            const rawAwayProb = probabilityUtils.decimalToImpliedProbability(awayDecimal);
            const rawDrawProb = drawOutcome ? probabilityUtils.decimalToImpliedProbability(drawDecimal) : null;
            
            const probsToRemoveVig = drawOutcome ? 
              [rawHomeProb, rawAwayProb, rawDrawProb] : 
              [rawHomeProb, rawAwayProb];
            
            const trueProbs = probabilityUtils.removeVig(probsToRemoveVig);

            return {
              bookmaker: book.name,
              homeTeamOdds: homeOutcome.odds,
              awayTeamOdds: awayOutcome.odds,
              drawOdds: drawOutcome?.odds,
              impliedProbabilities: {
                home: trueProbs[0],
                away: trueProbs[1],
                draw: drawOutcome ? trueProbs[2] : null,
                vigPercentage: ((probsToRemoveVig.reduce((a, b) => a + b, 0) - 1) * 100).toFixed(2) + '%'
              }
            };
          });

          return {
            ...baseMarket,
            books: processedBooks,
            consensusImpliedProbabilities: {
              home: processedBooks.reduce((sum, book) => sum + book.impliedProbabilities.home, 0) / processedBooks.length,
              away: processedBooks.reduce((sum, book) => sum + book.impliedProbabilities.away, 0) / processedBooks.length,
              draw: processedBooks[0].impliedProbabilities.draw !== null ?
                processedBooks.reduce((sum, book) => sum + book.impliedProbabilities.draw, 0) / processedBooks.length :
                null
            }
          };
        }
      });

      return {
        sportEventId,
        sportContext,
        source: 'Sportradar Odds Comparison Prematch API',
        markets,
        timestamp: new Date().toISOString(),
        rawResponse: data // Keep for debugging
      };
    } catch (error: any) {
      console.error('[SportradarOddsService] Error fetching prematch game odds:', error);
      return { error: `Failed to fetch prematch game odds from Sportradar: ${error.message}` };
    }
  }
};

// Gemini Tool Schemas
export const sportradarGetPlayerPropOddsTool = {
  type: 'function',
  function: {
    name: 'sportradar_getPlayerPropOdds',
    description: 'Fetches player proposition (prop) market odds from Sportradar for a specific sport event. Returns odds from various bookmakers for player-specific markets like points, assists, touchdowns, etc.',
    parameters: {
      type: 'object',
      properties: {
        sportEventId: { 
          type: 'string', 
          description: 'The unique Sportradar sport_event_id for the game. Use getSportAndEventIds helper first if you only have date and sport.'
        },
        sportContext: { 
          type: 'string', 
          description: 'The sport context (e.g., NBA, NFL, MLB) for selecting appropriate market IDs.'
        },
        marketId: { 
          type: 'string', 
          description: 'Optional. Filter by specific market ID (e.g., sr:market:921 for NBA total points). See PLAYER_PROP_MARKETS constant.'
        }
      },
      required: ['sportEventId', 'sportContext']
    }
  }
};

export const sportradarGetPrematchGameOddsTool = {
  type: 'function',
  function: {
    name: 'sportradar_getPrematchGameOdds',
    description: 'Fetches pre-match game market odds (moneyline, spread, totals) from Sportradar for a specific sport event. Returns odds from various bookmakers.',
    parameters: {
      type: 'object',
      properties: {
        sportEventId: { 
          type: 'string', 
          description: 'The unique Sportradar sport_event_id for the game. Use getSportAndEventIds helper first if you only have date and sport.'
        },
        sportContext: { 
          type: 'string', 
          description: 'The sport context (e.g., NBA, NFL, MLB) for logging and market type determination.'
        }
      },
      required: ['sportEventId', 'sportContext']
    }
  }
};

// The old sportradarGetMatchProbabilitiesTool should be deprecated or re-purposed
// if we find a dedicated Sportradar PROBABILITIES API.
// For now, commenting it out to avoid confusion, as the current focus is on ODDS.
/*
export const sportradarGetMatchProbabilitiesTool = {
  type: 'function',
  function: {
    name: 'sportradar_getMatchProbabilities',
    // ... old description
  },
};
*/ 
}; 