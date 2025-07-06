/**
 * Enhanced Prediction Models Tool for LLM Orchestrator
 * Integrates with Phase 2 enhanced prediction models
 */

import { logger } from '../../utils/logger';

interface PredictionResult {
    prediction: number;
    confidence: number;
    value_percentage: number;
    features_used: string[];
    model_version: string;
    timestamp: string;
    enhanced: boolean;
}

interface PlayerPropRequest {
    sport: string;
    prop_type: string;
    player_id: string;
    line: number;
    game_context: {
        is_home?: boolean;
        rest_days?: number;
        opponent?: string;
        minutes_expected?: number;
    };
}

interface SpreadRequest {
    sport: string;
    game_id: string;
    spread_line: number;
}

interface TotalRequest {
    sport: string;
    game_id: string;
    total_line: number;
}

interface ParlayLeg {
    type: 'player_prop' | 'spread' | 'total';
    sport: string;
    prop_type?: string;
    player_id?: string;
    game_id?: string;
    line: number;
    game_context?: any;
}

interface EnhancedParlayRequest {
    legs: ParlayLeg[];
}

export class EnhancedPredictionsTool {
    private apiUrl: string;

    constructor() {
        this.apiUrl = process.env.PYTHON_ML_SERVER_URL || 'http://localhost:8001';
    }

    /**
     * Predict player props using enhanced Phase 2 models
     */
    async predictPlayerProp(request: PlayerPropRequest): Promise<PredictionResult> {
        try {
            const supportedPropTypes: Record<string, string[]> = {
                'NBA': ['points', 'rebounds', 'assists'],
                'MLB': ['hits', 'home_runs', 'strikeouts']
            };
            
            const sport = request.sport.toUpperCase();
            const propType = request.prop_type.toLowerCase();
            
            logger.info(`🎯 Enhanced player prop prediction: ${sport} ${propType} for ${request.player_id}`);
            
            // Check if prop type is supported
            const isSupported = supportedPropTypes[sport]?.includes(propType);
            if (!isSupported) {
                logger.warn(`⚠️ Unsupported prop type: ${sport} ${propType}. Supported types are: ${supportedPropTypes[sport]?.join(', ') || 'none'}`); 
                throw new Error(`No ML model available for ${sport} ${propType}`);
            }
            
            // Map prop types to their canonical form if needed
            const propTypeMap: Record<string, string> = {
                'pitcher_strikeouts': 'strikeouts',
                'batter_total_bases': 'total_bases',
                'batter_hits': 'hits',
                'batter_home_runs': 'home_runs',
                'batter_rbis': 'rbis'
            };
            
            const canonicalPropType = propTypeMap[propType] || propType;
            
            // The correct endpoint is singular form
            const endpoint = '/api/v2/predict/player-prop';
            
            logger.info(`Calling endpoint: ${this.apiUrl}${endpoint} for ${sport} ${canonicalPropType}`);
            const response = await fetch(`${this.apiUrl}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...request,
                    prop_type: canonicalPropType  // Ensure we use canonical prop type
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                logger.error(`❌ Failed with status ${response.status}: ${errorText}`);
                throw new Error(`API responded with status ${response.status}: ${errorText}`);
            }
            
            const result = await response.json() as any;
            
            logger.info(`✅ Enhanced player prop result: ${result.prediction} (confidence: ${result.confidence})`);
            
            return {
                ...result,
                enhanced: true
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`❌ Enhanced player prop prediction failed: ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Predict spread using enhanced Phase 2 models
     */
    async predictSpread(request: SpreadRequest): Promise<PredictionResult> {
        try {
            logger.info(`📊 Enhanced spread prediction: ${request.sport} game ${request.game_id} at ${request.spread_line}`);

            const response = await fetch(`${this.apiUrl}/api/v2/predict/spread`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request)
            });

            if (!response.ok) {
                throw new Error(`API responded with status ${response.status}`);
            }

            const result = await response.json() as any;
            
            logger.info(`✅ Enhanced spread result: ${result.prediction} (confidence: ${result.confidence})`);
            
            return {
                ...result,
                enhanced: true
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`❌ Enhanced spread prediction failed: ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Predict totals using enhanced Phase 2 models
     */
    async predictTotal(request: TotalRequest): Promise<PredictionResult> {
        try {
            logger.info(`🎯 Enhanced total prediction: ${request.sport} game ${request.game_id} at ${request.total_line}`);

            const response = await fetch(`${this.apiUrl}/api/v2/predict/total`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request)
            });

            if (!response.ok) {
                throw new Error(`API responded with status ${response.status}`);
            }

            const result = await response.json() as any;
            
            logger.info(`✅ Enhanced total result: ${result.prediction} (confidence: ${result.confidence})`);
            
            return {
                ...result,
                enhanced: true
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`❌ Enhanced total prediction failed: ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Enhanced parlay analysis using Phase 2 models
     */
    async analyzeEnhancedParlay(request: EnhancedParlayRequest): Promise<any> {
        try {
            logger.info(`🔗 Enhanced parlay analysis with ${request.legs.length} legs`);

            const response = await fetch(`${this.apiUrl}/api/v2/analyze/parlay-enhanced`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request)
            });

            if (!response.ok) {
                throw new Error(`API responded with status ${response.status}`);
            }

            const result = await response.json() as any;
            
            logger.info(`✅ Enhanced parlay analysis completed: ${result.parlay_analysis?.combined_confidence} confidence`);
            
            return {
                ...result,
                enhanced: true
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`❌ Enhanced parlay analysis failed: ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Get enhanced model status and capabilities
     */
    async getModelStatus(): Promise<any> {
        try {
            const response = await fetch(`${this.apiUrl}/api/v2/models/status`);
            
            if (!response.ok) {
                throw new Error(`API responded with status ${response.status}`);
            }

            const result = await response.json() as any;
            return result;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`❌ Model status check failed: ${errorMessage}`);
            throw error;
        }
    }

    /**
     * Trigger model retraining
     */
    async retrainModels(sports: string[] = ['NBA', 'NFL', 'MLB', 'NHL']): Promise<any> {
        try {
            logger.info(`🔄 Triggering model retraining for sports: ${sports.join(', ')}`);

            const response = await fetch(`${this.apiUrl}/api/v2/models/retrain`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sports })
            });

            if (!response.ok) {
                throw new Error(`API responded with status ${response.status}`);
            }

            const result = await response.json() as any;
            
            logger.info(`✅ Model retraining initiated`);
            
            return result;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`❌ Model retraining failed: ${errorMessage}`);
            throw error;
        }
    }
}

// Tool functions for LLM orchestrator
export const enhancedPredictionTools = {
    predictPlayerProp: async (request: PlayerPropRequest) => {
        const tool = new EnhancedPredictionsTool();
        return await tool.predictPlayerProp(request);
    },

    predictSpread: async (request: SpreadRequest) => {
        const tool = new EnhancedPredictionsTool();
        return await tool.predictSpread(request);
    },

    predictTotal: async (request: TotalRequest) => {
        const tool = new EnhancedPredictionsTool();
        return await tool.predictTotal(request);
    },

    analyzeEnhancedParlay: async (request: EnhancedParlayRequest) => {
        const tool = new EnhancedPredictionsTool();
        return await tool.analyzeEnhancedParlay(request);
    },

    getModelStatus: async () => {
        const tool = new EnhancedPredictionsTool();
        return await tool.getModelStatus();
    },

    retrainModels: async (sports?: string[]) => {
        const tool = new EnhancedPredictionsTool();
        return await tool.retrainModels(sports);
    }
};

export default EnhancedPredictionsTool; 