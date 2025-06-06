import { sportradarOddsService } from '../ai/tools/sportradar';
import { sportradarProbabilitiesService } from '../ai/tools/sportradarProbabilities';

describe('Sportradar Integration Tests', () => {
  // You'll need to set these with real values from your Sportradar account
  const TEST_EVENT = {
    sportEventId: process.env.TEST_SPORT_EVENT_ID || 'sr:sport_event:12345',
    sportContext: 'NBA'
  };

  describe('Odds Service', () => {
    it('should fetch prematch game odds and calculate implied probabilities', async () => {
      const result = await sportradarOddsService.getPrematchGameOdds(TEST_EVENT);
      
      // Basic validation
      expect(result).toBeDefined();
      expect(result.error).toBeUndefined();
      expect(result.markets).toBeDefined();
      
      // Check probability calculations
      const market = result.markets[0];
      if (market) {
        expect(market.consensusImpliedProbabilities).toBeDefined();
        
        // Validate vig removal - probabilities should sum to approximately 1
        const probs = Object.values(market.consensusImpliedProbabilities);
        const sum = probs.reduce((a: number, b: number) => a + b, 0);
        expect(sum).toBeCloseTo(1, 2); // Allow 0.01 deviation
      }
    });

    it('should fetch player prop odds and calculate implied probabilities', async () => {
      const result = await sportradarOddsService.getPlayerPropOdds(TEST_EVENT);
      
      expect(result).toBeDefined();
      expect(result.error).toBeUndefined();
      expect(result.playerProps).toBeDefined();
      
      const prop = result.playerProps[0];
      if (prop) {
        expect(prop.consensusImpliedProbabilities).toBeDefined();
        expect(prop.consensusImpliedProbabilities.over).toBeDefined();
        expect(prop.consensusImpliedProbabilities.under).toBeDefined();
        
        // Validate over/under probabilities sum to 1
        const sum = prop.consensusImpliedProbabilities.over + 
                   prop.consensusImpliedProbabilities.under;
        expect(sum).toBeCloseTo(1, 2);
      }
    });
  });

  describe('Probabilities Service', () => {
    it('should attempt to fetch direct probabilities and fall back to implied', async () => {
      const result = await sportradarProbabilitiesService.getEventProbabilities(TEST_EVENT);
      
      expect(result).toBeDefined();
      expect(result.sources).toBeDefined();
      expect(Array.isArray(result.sources)).toBe(true);
      expect(result.availableSources).toBeDefined();
      expect(result.recommendedSource).toBeDefined();
      
      // At least implied probabilities should be available
      expect(result.sources.length).toBeGreaterThan(0);
      
      // Check source structure
      const source = result.sources[0];
      expect(source.type).toBeDefined();
      expect(source.name).toBeDefined();
      expect(source.confidence).toBeDefined();
      expect(source.probabilities).toBeDefined();
    });
  });
}); 