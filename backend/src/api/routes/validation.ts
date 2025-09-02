import express from 'express';
import { createLogger } from '../../utils/logger';
import { predictionValidator } from '../../services/predictionValidator';

const router = express.Router();
const logger = createLogger('validationRoutes');

/**
 * GET /api/validation/metrics
 * Get comprehensive validation metrics for AI predictions
 */
router.get('/metrics', async (req, res) => {
  try {
    const { sport, days } = req.query;
    
    logger.info(`📊 Fetching validation metrics for ${sport || 'all sports'} over ${days || 90} days`);
    
    const metrics = await predictionValidator.getValidationMetrics(
      sport as string,
      days ? parseInt(days as string) : 90
    );
    
    res.json({
      success: true,
      data: metrics,
      summary: {
        totalPredictions: metrics.totalPredictions,
        accuracy: `${(metrics.accuracy * 100).toFixed(1)}%`,
        performance: predictionValidator.getPerformanceRating(metrics.accuracy),
        calibration: `${(metrics.calibration * 100).toFixed(1)}%`,
        logLoss: metrics.logLoss.toFixed(3)
      }
    });
    
  } catch (error) {
    logger.error(`Error fetching validation metrics: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch validation metrics'
    });
  }
});

/**
 * GET /api/validation/metrics/:sport
 * Get validation metrics for a specific sport
 */
router.get('/metrics/:sport', async (req, res) => {
  try {
    const { sport } = req.params;
    const { days } = req.query;
    
    logger.info(`📊 Fetching validation metrics for ${sport} over ${days || 90} days`);
    
    const metrics = await predictionValidator.getValidationMetrics(
      sport,
      days ? parseInt(days as string) : 90
    );
    
    // Get sport-specific breakdown
    const sportBreakdown = metrics.accuracyBySport[sport] || { accuracy: 0, count: 0 };
    
    res.json({
      success: true,
      sport,
      data: metrics,
      sportSpecific: {
        accuracy: `${(sportBreakdown.accuracy * 100).toFixed(1)}%`,
        totalPredictions: sportBreakdown.count,
        performance: predictionValidator.getPerformanceRating(sportBreakdown.accuracy)
      }
    });
    
  } catch (error) {
    logger.error(`Error fetching sport-specific validation metrics: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sport-specific validation metrics'
    });
  }
});

/**
 * POST /api/validation/update-outcome
 * Update a prediction with its actual outcome
 */
router.post('/update-outcome', async (req, res) => {
  try {
    const { predictionId, actualOutcome } = req.body;
    
    if (!predictionId || !actualOutcome) {
      return res.status(400).json({
        success: false,
        error: 'predictionId and actualOutcome are required'
      });
    }
    
    logger.info(`🎯 Updating prediction ${predictionId} with outcome: ${actualOutcome}`);
    
    await predictionValidator.updatePredictionOutcome(predictionId, actualOutcome);
    
    res.json({
      success: true,
      message: 'Prediction outcome updated successfully'
    });
    
  } catch (error) {
    logger.error(`Error updating prediction outcome: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to update prediction outcome'
    });
  }
});

/**
 * POST /api/validation/batch-update
 * Trigger batch update of prediction outcomes from external sources
 */
router.post('/batch-update', async (req, res) => {
  try {
    logger.info('🔄 Starting batch prediction validation update...');
    
    await predictionValidator.batchUpdateFromGameResults();
    
    res.json({
      success: true,
      message: 'Batch update completed successfully'
    });
    
  } catch (error) {
    logger.error(`Error in batch update: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to complete batch update'
    });
  }
});

/**
 * GET /api/validation/performance-report
 * Get a comprehensive performance report
 */
router.get('/performance-report', async (req, res) => {
  try {
    const { days } = req.query;
    const daysBack = days ? parseInt(days as string) : 90;
    
    logger.info(`📈 Generating performance report for last ${daysBack} days`);
    
    // Get overall metrics
    const overallMetrics = await predictionValidator.getValidationMetrics(undefined, daysBack);
    
    // Get metrics for each sport
    const sports = ['MLB', 'NBA', 'NFL', 'NHL'];
    const sportMetrics: { [key: string]: { accuracy: number; totalPredictions: number; correctPredictions: number; performance: string; recentPerformance: any; } } = {};
    
    for (const sport of sports) {
      try {
        const metrics = await predictionValidator.getValidationMetrics(sport, daysBack);
        if (metrics.totalPredictions > 0) {
          sportMetrics[sport] = {
            accuracy: metrics.accuracy,
            totalPredictions: metrics.totalPredictions,
            correctPredictions: metrics.correctPredictions,
            performance: predictionValidator.getPerformanceRating(metrics.accuracy),
            recentPerformance: metrics.recentPerformance
          };
        }
      } catch (error) {
        logger.warn(`Could not get metrics for ${sport}: ${error}`);
      }
    }
    
    const report = {
      reportDate: new Date().toISOString(),
      periodDays: daysBack,
      overall: {
        totalPredictions: overallMetrics.totalPredictions,
        accuracy: overallMetrics.accuracy,
        performance: predictionValidator.getPerformanceRating(overallMetrics.accuracy),
        calibration: overallMetrics.calibration,
        logLoss: overallMetrics.logLoss,
        recentPerformance: overallMetrics.recentPerformance
      },
      bySport: sportMetrics,
      byConfidence: overallMetrics.accuracyByConfidence,
      byBetType: overallMetrics.accuracyByBetType,
      insights: generateInsights(overallMetrics)
    };
    
    res.json({
      success: true,
      data: report
    });
    
  } catch (error) {
    logger.error(`Error generating performance report: ${error}`);
    res.status(500).json({
      success: false,
      error: 'Failed to generate performance report'
    });
  }
});

/**
 * Generate insights from validation metrics
 */
function generateInsights(metrics: any): string[] {
  const insights: string[] = [];
  
  if (metrics.accuracy > 0.58) {
    insights.push("🎯 Excellent prediction accuracy! The model is performing very well.");
  } else if (metrics.accuracy > 0.55) {
    insights.push("✅ Good prediction accuracy. The model shows solid performance.");
  } else if (metrics.accuracy > 0.52) {
    insights.push("⚠️ Fair prediction accuracy. Consider model improvements.");
  } else {
    insights.push("🔴 Poor prediction accuracy. Model needs significant improvement.");
  }
  
  if (metrics.calibration > 0.8) {
    insights.push("📊 Well-calibrated predictions - probabilities match actual outcomes.");
  } else if (metrics.calibration < 0.6) {
    insights.push("⚠️ Poor calibration - predicted probabilities don't match actual frequencies.");
  }
  
  // Check confidence accuracy
  const highConfAcc = metrics.accuracyByConfidence.High.accuracy;
  const lowConfAcc = metrics.accuracyByConfidence.Low.accuracy;
  
  if (highConfAcc > lowConfAcc + 0.1) {
    insights.push("🎯 High confidence predictions are significantly more accurate - confidence scoring is working well.");
  } else if (highConfAcc < lowConfAcc) {
    insights.push("🔴 High confidence predictions are less accurate than low confidence - confidence scoring needs review.");
  }
  
  // Check recent performance
  if (metrics.recentPerformance.last7Days > metrics.recentPerformance.last30Days + 0.05) {
    insights.push("📈 Performance improving - recent predictions are more accurate.");
  } else if (metrics.recentPerformance.last7Days < metrics.recentPerformance.last30Days - 0.05) {
    insights.push("📉 Performance declining - recent predictions are less accurate.");
  }
  
  return insights;
}

export { router as validationRoutes }; 