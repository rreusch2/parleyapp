import { createLogger } from '../utils/logger';
import { supabase } from './supabase/client';

const logger = createLogger('predictionValidator');

interface PredictionResult {
  id: string;
  gameId: string;
  sport: string;
  betType: string;
  predictedOutcome: string;
  predictedProbability: number;
  actualOutcome: string | null;
  isCorrect: boolean | null;
  confidence: 'Low' | 'Medium' | 'High';
  createdAt: Date;
  settledAt: Date | null;
}

interface ValidationMetrics {
  totalPredictions: number;
  settledPredictions: number;
  correctPredictions: number;
  accuracy: number;
  accuracyByConfidence: {
    Low: { accuracy: number; count: number };
    Medium: { accuracy: number; count: number };
    High: { accuracy: number; count: number };
  };
  accuracyBySport: Record<string, { accuracy: number; count: number }>;
  accuracyByBetType: Record<string, { accuracy: number; count: number }>;
  calibration: number; // How well predicted probabilities match actual outcomes
  logLoss: number; // Measure of probability prediction quality
  recentPerformance: {
    last7Days: number;
    last30Days: number;
    last90Days: number;
  };
}

export class PredictionValidatorService {

  /**
   * Store a new prediction for later validation
   */
  async storePrediction(
    predictionId: string,
    gameId: string,
    sport: string,
    betType: string,
    predictedOutcome: string,
    predictedProbability: number,
    confidence: 'Low' | 'Medium' | 'High'
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('ai_predictions')
        .update({
          metadata: {
            predictedOutcome,
            predictedProbability,
            confidence,
            needsValidation: true
          }
        })
        .eq('id', predictionId);

      if (error) {
        logger.error(`Failed to store prediction for validation: ${error.message}`);
        throw error;
      }

      logger.info(`✅ Stored prediction ${predictionId} for validation tracking`);
    } catch (error) {
      logger.error(`Error storing prediction: ${error}`);
      throw error;
    }
  }

  /**
   * Update prediction with actual game outcome
   */
  async updatePredictionOutcome(
    predictionId: string,
    actualOutcome: string
  ): Promise<void> {
    try {
      // Get the prediction first
      const { data: prediction, error: fetchError } = await supabase
        .from('ai_predictions')
        .select('metadata')
        .eq('id', predictionId)
        .single();

      if (fetchError || !prediction) {
        throw new Error(`Prediction not found: ${predictionId}`);
      }

      const metadata = prediction.metadata || {};
      const predictedOutcome = metadata.predictedOutcome;
      const isCorrect = predictedOutcome === actualOutcome;

      // Update with actual outcome
      const { error } = await supabase
        .from('ai_predictions')
        .update({
          metadata: {
            ...metadata,
            actualOutcome,
            isCorrect,
            settledAt: new Date().toISOString(),
            needsValidation: false
          }
        })
        .eq('id', predictionId);

      if (error) {
        logger.error(`Failed to update prediction outcome: ${error.message}`);
        throw error;
      }

      logger.info(`✅ Updated prediction ${predictionId}: ${predictedOutcome} → ${actualOutcome} (${isCorrect ? 'CORRECT' : 'INCORRECT'})`);
    } catch (error) {
      logger.error(`Error updating prediction outcome: ${error}`);
      throw error;
    }
  }

  /**
   * Calculate comprehensive validation metrics
   */
  async getValidationMetrics(
    sport?: string,
    daysBack: number = 90
  ): Promise<ValidationMetrics> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);

      // Build query
      let query = supabase
        .from('ai_predictions')
        .select('*')
        .gte('created_at', cutoffDate.toISOString())
        .not('metadata->actualOutcome', 'is', null);

      if (sport) {
        query = query.eq('sport', sport);
      }

      const { data: predictions, error } = await query;

      if (error) {
        throw error;
      }

      if (!predictions || predictions.length === 0) {
        return this.getEmptyMetrics();
      }

      // Calculate metrics
      const totalPredictions = predictions.length;
      const correctPredictions = predictions.filter(p => p.metadata?.isCorrect === true).length;
      const accuracy = correctPredictions / totalPredictions;

      // Accuracy by confidence
      const confidenceGroups = this.groupBy(predictions, p => p.metadata?.confidence || 'Medium');
      const accuracyByConfidence = {
        Low: this.calculateGroupAccuracy(confidenceGroups.Low || []),
        Medium: this.calculateGroupAccuracy(confidenceGroups.Medium || []),
        High: this.calculateGroupAccuracy(confidenceGroups.High || [])
      };

      // Accuracy by sport
      const sportGroups = this.groupBy(predictions, p => p.sport);
      const accuracyBySport: Record<string, { accuracy: number; count: number }> = {};
      Object.keys(sportGroups).forEach(sport => {
        accuracyBySport[sport] = this.calculateGroupAccuracy(sportGroups[sport]);
      });

      // Accuracy by bet type
      const betTypeGroups = this.groupBy(predictions, p => p.bet_type);
      const accuracyByBetType: Record<string, { accuracy: number; count: number }> = {};
      Object.keys(betTypeGroups).forEach(betType => {
        accuracyByBetType[betType] = this.calculateGroupAccuracy(betTypeGroups[betType]);
      });

      // Recent performance
      const recentPerformance = {
        last7Days: await this.getRecentAccuracy(7, sport),
        last30Days: await this.getRecentAccuracy(30, sport),
        last90Days: accuracy
      };

      // Calibration and log loss
      const calibration = this.calculateCalibration(predictions);
      const logLoss = this.calculateLogLoss(predictions);

      const metrics: ValidationMetrics = {
        totalPredictions,
        settledPredictions: totalPredictions,
        correctPredictions,
        accuracy,
        accuracyByConfidence,
        accuracyBySport,
        accuracyByBetType,
        calibration,
        logLoss,
        recentPerformance
      };

      logger.info(`📊 Validation metrics calculated: ${accuracy.toFixed(3)} accuracy (${correctPredictions}/${totalPredictions})`);
      return metrics;

    } catch (error) {
      logger.error(`Error calculating validation metrics: ${error}`);
      throw error;
    }
  }

  /**
   * Get accuracy for recent time periods
   */
  private async getRecentAccuracy(daysBack: number, sport?: string): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);

      let query = supabase
        .from('ai_predictions')
        .select('metadata')
        .gte('created_at', cutoffDate.toISOString())
        .not('metadata->actualOutcome', 'is', null);

      if (sport) {
        query = query.eq('sport', sport);
      }

      const { data: predictions, error } = await query;

      if (error || !predictions || predictions.length === 0) {
        return 0;
      }

      const correctPredictions = predictions.filter(p => p.metadata?.isCorrect === true).length;
      return correctPredictions / predictions.length;
    } catch (error) {
      logger.error(`Error calculating recent accuracy: ${error}`);
      return 0;
    }
  }

  /**
   * Calculate calibration (how well predicted probabilities match actual frequencies)
   */
  private calculateCalibration(predictions: any[]): number {
    try {
      // Group predictions by probability bins
      const bins = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
      let totalCalibrationError = 0;
      let totalPredictions = 0;

      for (let i = 0; i < bins.length - 1; i++) {
        const binPredictions = predictions.filter(p => {
          const prob = p.metadata?.predictedProbability || 0.5;
          return prob >= bins[i] && prob < bins[i + 1];
        });

        if (binPredictions.length > 0) {
          const avgPredictedProb = binPredictions.reduce((sum, p) => 
            sum + (p.metadata?.predictedProbability || 0.5), 0) / binPredictions.length;
          const actualFrequency = binPredictions.filter(p => p.metadata?.isCorrect === true).length / binPredictions.length;
          
          totalCalibrationError += Math.abs(avgPredictedProb - actualFrequency) * binPredictions.length;
          totalPredictions += binPredictions.length;
        }
      }

      return totalPredictions > 0 ? 1 - (totalCalibrationError / totalPredictions) : 0;
    } catch (error) {
      logger.error(`Error calculating calibration: ${error}`);
      return 0;
    }
  }

  /**
   * Calculate log loss (measure of probability prediction quality)
   */
  private calculateLogLoss(predictions: any[]): number {
    try {
      let totalLogLoss = 0;
      let validPredictions = 0;

      predictions.forEach(p => {
        const prob = p.metadata?.predictedProbability;
        const isCorrect = p.metadata?.isCorrect;
        
        if (prob !== undefined && isCorrect !== undefined) {
          // Clip probability to avoid log(0)
          const clippedProb = Math.max(0.001, Math.min(0.999, prob));
          const actualProb = isCorrect ? 1 : 0;
          totalLogLoss += -(actualProb * Math.log(clippedProb) + (1 - actualProb) * Math.log(1 - clippedProb));
          validPredictions++;
        }
      });

      return validPredictions > 0 ? totalLogLoss / validPredictions : 0;
    } catch (error) {
      logger.error(`Error calculating log loss: ${error}`);
      return 0;
    }
  }

  /**
   * Helper function to group array by key
   */
  private groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
    return array.reduce((groups: Record<string, T[]>, item) => {
      const key = keyFn(item);
      groups[key] = groups[key] || [];
      groups[key].push(item);
      return groups;
    }, {});
  }

  /**
   * Calculate accuracy for a group of predictions
   */
  private calculateGroupAccuracy(predictions: any[]): { accuracy: number; count: number } {
    if (predictions.length === 0) {
      return { accuracy: 0, count: 0 };
    }
    
    const correctPredictions = predictions.filter(p => p.metadata?.isCorrect === true).length;
    return {
      accuracy: correctPredictions / predictions.length,
      count: predictions.length
    };
  }

  /**
   * Return empty metrics structure
   */
  private getEmptyMetrics(): ValidationMetrics {
    return {
      totalPredictions: 0,
      settledPredictions: 0,
      correctPredictions: 0,
      accuracy: 0,
      accuracyByConfidence: {
        Low: { accuracy: 0, count: 0 },
        Medium: { accuracy: 0, count: 0 },
        High: { accuracy: 0, count: 0 }
      },
      accuracyBySport: {},
      accuracyByBetType: {},
      calibration: 0,
      logLoss: 0,
      recentPerformance: {
        last7Days: 0,
        last30Days: 0,
        last90Days: 0
      }
    };
  }

  /**
   * Get performance rating based on accuracy
   */
  getPerformanceRating(accuracy: number): string {
    if (accuracy >= 0.58) return 'Excellent';
    if (accuracy >= 0.55) return 'Good';
    if (accuracy >= 0.52) return 'Fair';
    return 'Poor';
  }

  /**
   * Batch update predictions with game results from external API
   */
  async batchUpdateFromGameResults(): Promise<void> {
    try {
      logger.info('🔄 Starting batch update of prediction outcomes...');

      // Get all predictions that need validation
      const { data: predictions, error } = await supabase
        .from('ai_predictions')
        .select('*')
        .eq('metadata->needsValidation', true)
        .lt('created_at', new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()); // At least 3 hours old

      if (error) {
        throw error;
      }

      if (!predictions || predictions.length === 0) {
        logger.info('No predictions need validation at this time');
        return;
      }

      logger.info(`Found ${predictions.length} predictions needing validation`);

      // TODO: Integrate with sports data API to fetch actual game results
      // For now, this is a placeholder for the batch update logic
      for (const prediction of predictions) {
        // Mock: In real implementation, fetch actual game result from sports API
        // const gameResult = await fetchGameResult(prediction.game_id);
        // await this.updatePredictionOutcome(prediction.id, gameResult.outcome);
      }

      logger.info('✅ Batch prediction validation complete');
    } catch (error) {
      logger.error(`Error in batch update: ${error}`);
      throw error;
    }
  }
}

// Create singleton instance
export const predictionValidator = new PredictionValidatorService(); 