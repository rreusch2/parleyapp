/**
 * User Feedback Collection System
 * Collects, analyzes, and integrates user feedback into the development cycle
 * Phase 4: Content Generation and Continuous Improvement
 */

import { createLogger } from '../utils/logger';
import { supabase } from '../services/supabase/client';

const logger = createLogger('feedbackCollector');

interface UserFeedback {
  id: string;
  user_id: string;
  feedback_type: 'prediction_accuracy' | 'content_quality' | 'ui_experience' | 'feature_request' | 'bug_report' | 'general';
  rating: number; // 1-5 scale
  comment?: string;
  context: {
    prediction_id?: string;
    content_id?: string;
    feature_area?: string;
    page_url?: string;
    device_info?: string;
  };
  sentiment: 'positive' | 'neutral' | 'negative';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'new' | 'reviewed' | 'in_progress' | 'resolved' | 'archived';
  tags: string[];
  created_at: string;
  updated_at: string;
  resolved_at?: string;
  resolution_notes?: string;
}

interface FeedbackAnalytics {
  total_feedback_count: number;
  average_rating: number;
  sentiment_distribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
  feedback_by_type: Record<string, number>;
  trending_issues: Array<{
    issue: string;
    count: number;
    severity: string;
  }>;
  user_satisfaction_score: number; // 0-100
  improvement_suggestions: string[];
}

interface PredictionFeedback {
  prediction_id: string;
  was_correct: boolean;
  confidence_matched: boolean; // Did the confidence score match the outcome
  user_rating: number; // 1-5 how useful was this prediction
  comments?: string;
  betting_outcome?: 'win' | 'loss' | 'push' | 'no_bet';
  suggested_improvements?: string;
}

export class FeedbackCollector {
  constructor() {
    logger.info('✅ Feedback Collector initialized');
  }

  /**
   * Submit user feedback
   */
  async submitFeedback(feedback: Omit<UserFeedback, 'id' | 'created_at' | 'updated_at' | 'sentiment' | 'priority' | 'status'>): Promise<string> {
    try {
      const feedbackId = `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Analyze sentiment and priority
      const sentiment = this.analyzeSentiment(feedback.comment || '', feedback.rating);
      const priority = this.determinePriority(feedback.feedback_type, feedback.rating, sentiment);
      
      const completeFeedback: UserFeedback = {
        ...feedback,
        id: feedbackId,
        sentiment,
        priority,
        status: 'new',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Store in database
      await this.storeFeedback(completeFeedback);
      
      // Process immediate actions if high priority
      if (priority === 'urgent' || priority === 'high') {
        await this.triggerImmediateAction(completeFeedback);
      }

      logger.info(`✅ Feedback submitted: ${feedbackId} (${feedback.feedback_type}, ${priority} priority)`);
      return feedbackId;

    } catch (error) {
      logger.error(`❌ Failed to submit feedback: ${error.message}`);
      throw error;
    }
  }

  /**
   * Submit prediction-specific feedback
   */
  async submitPredictionFeedback(feedback: PredictionFeedback & { user_id: string }): Promise<void> {
    try {
      const predictionFeedback: Omit<UserFeedback, 'id' | 'created_at' | 'updated_at' | 'sentiment' | 'priority' | 'status'> = {
        user_id: feedback.user_id,
        feedback_type: 'prediction_accuracy',
        rating: feedback.user_rating,
        comment: `Prediction ${feedback.was_correct ? 'correct' : 'incorrect'}. Confidence matched: ${feedback.confidence_matched}. ${feedback.comments || ''}`,
        context: {
          prediction_id: feedback.prediction_id
        },
        tags: ['prediction', feedback.was_correct ? 'correct' : 'incorrect', feedback.betting_outcome || 'unknown']
      };

      await this.submitFeedback(predictionFeedback);

      // Store detailed prediction feedback
      await this.storePredictionFeedback(feedback);

      logger.info(`✅ Prediction feedback submitted for prediction: ${feedback.prediction_id}`);

    } catch (error) {
      logger.error(`❌ Failed to submit prediction feedback: ${error.message}`);
      throw error;
    }
  }

  /**
   * Analyze sentiment from comment and rating
   */
  private analyzeSentiment(comment: string, rating: number): 'positive' | 'neutral' | 'negative' {
    // Simple sentiment analysis based on rating and keywords
    if (rating >= 4) return 'positive';
    if (rating <= 2) return 'negative';

    // Analyze comment for sentiment keywords
    const positiveKeywords = ['good', 'great', 'excellent', 'amazing', 'love', 'perfect', 'helpful'];
    const negativeKeywords = ['bad', 'terrible', 'awful', 'hate', 'broken', 'useless', 'worst'];
    
    const commentLower = comment.toLowerCase();
    const positiveMatches = positiveKeywords.filter(word => commentLower.includes(word)).length;
    const negativeMatches = negativeKeywords.filter(word => commentLower.includes(word)).length;

    if (positiveMatches > negativeMatches) return 'positive';
    if (negativeMatches > positiveMatches) return 'negative';
    
    return 'neutral';
  }

  /**
   * Determine feedback priority
   */
  private determinePriority(type: string, rating: number, sentiment: string): 'low' | 'medium' | 'high' | 'urgent' {
    // Bug reports and very low ratings are high priority
    if (type === 'bug_report') return 'urgent';
    if (rating <= 1) return 'high';
    
    // Feature requests are generally medium priority
    if (type === 'feature_request') return 'medium';
    
    // Based on sentiment and rating
    if (sentiment === 'negative' && rating <= 2) return 'high';
    if (sentiment === 'positive' && rating >= 4) return 'low';
    
    return 'medium';
  }

  /**
   * Store feedback in database
   */
  private async storeFeedback(feedback: UserFeedback): Promise<void> {
    try {
      // In production, this would store in actual database
      // For now, log the feedback
      logger.debug(`💾 Storing feedback: ${JSON.stringify(feedback, null, 2)}`);

    } catch (error) {
      logger.error(`❌ Failed to store feedback: ${error.message}`);
      throw error;
    }
  }

  /**
   * Store detailed prediction feedback
   */
  private async storePredictionFeedback(feedback: PredictionFeedback): Promise<void> {
    try {
      // In production, this would store in actual database
      logger.debug(`💾 Storing prediction feedback: ${JSON.stringify(feedback, null, 2)}`);

    } catch (error) {
      logger.error(`❌ Failed to store prediction feedback: ${error.message}`);
      throw error;
    }
  }

  /**
   * Trigger immediate action for high-priority feedback
   */
  private async triggerImmediateAction(feedback: UserFeedback): Promise<void> {
    try {
      logger.warn(`🚨 High priority feedback received: ${feedback.id}`);
      
      // Send notifications to team
      await this.notifyTeam(feedback);
      
      // Auto-assign if it's a bug report
      if (feedback.feedback_type === 'bug_report') {
        await this.autoAssignBugReport(feedback);
      }

    } catch (error) {
      logger.error(`❌ Failed to trigger immediate action: ${error.message}`);
    }
  }

  /**
   * Notify team of high-priority feedback
   */
  private async notifyTeam(feedback: UserFeedback): Promise<void> {
    // Mock implementation - in production this would send Slack/email notifications
    logger.info(`📢 Team notification sent for feedback: ${feedback.id}`);
  }

  /**
   * Auto-assign bug reports
   */
  private async autoAssignBugReport(feedback: UserFeedback): Promise<void> {
    // Mock implementation - in production this would assign to appropriate team members
    logger.info(`🔧 Bug report auto-assigned: ${feedback.id}`);
  }

  /**
   * Get feedback analytics
   */
  async getFeedbackAnalytics(days: number = 30): Promise<FeedbackAnalytics> {
    try {
      // Mock data for now - in production this would query actual feedback data
      const analytics: FeedbackAnalytics = {
        total_feedback_count: 156,
        average_rating: 3.8,
        sentiment_distribution: {
          positive: 45,
          neutral: 35,
          negative: 20
        },
        feedback_by_type: {
          'prediction_accuracy': 45,
          'content_quality': 32,
          'ui_experience': 28,
          'feature_request': 24,
          'bug_report': 12,
          'general': 15
        },
        trending_issues: [
          { issue: 'Prediction confidence too high', count: 8, severity: 'medium' },
          { issue: 'App crashes on iOS', count: 5, severity: 'high' },
          { issue: 'Need more NBA props', count: 12, severity: 'low' }
        ],
        user_satisfaction_score: 76,
        improvement_suggestions: [
          'Add more detailed prediction explanations',
          'Improve loading speed for odds data',
          'Add push notifications for daily picks',
          'Enhance search functionality'
        ]
      };

      logger.info(`📊 Generated feedback analytics for last ${days} days`);
      return analytics;

    } catch (error) {
      logger.error(`❌ Failed to get feedback analytics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get prediction accuracy feedback summary
   */
  async getPredictionAccuracyFeedback(): Promise<{
    total_feedback: number;
    correct_predictions: number;
    accuracy_rate: number;
    confidence_calibration: number;
    user_satisfaction: number;
    common_issues: string[];
  }> {
    try {
      // Mock data for now - in production this would analyze actual prediction feedback
      const summary = {
        total_feedback: 89,
        correct_predictions: 54,
        accuracy_rate: 0.607, // 60.7%
        confidence_calibration: 0.73, // How well confidence scores match outcomes
        user_satisfaction: 3.6, // Average rating for predictions
        common_issues: [
          'Confidence scores too optimistic',
          'Player prop predictions less accurate than spreads',
          'Need more context for recommendations',
          'Live odds updates needed'
        ]
      };

      logger.info('📈 Generated prediction accuracy feedback summary');
      return summary;

    } catch (error) {
      logger.error(`❌ Failed to get prediction accuracy feedback: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process feedback for model improvement
   */
  async processFeedbackForModelImprovement(): Promise<{
    retrain_recommendations: string[];
    feature_adjustments: string[];
    calibration_needs: string[];
  }> {
    try {
      const predictionFeedback = await this.getPredictionAccuracyFeedback();
      
      const recommendations = {
        retrain_recommendations: [],
        feature_adjustments: [],
        calibration_needs: []
      };

      // Analyze accuracy and suggest retraining
      if (predictionFeedback.accuracy_rate < 0.55) {
        recommendations.retrain_recommendations.push('Overall prediction accuracy below 55% - full model retraining recommended');
      }

      // Analyze calibration
      if (predictionFeedback.confidence_calibration < 0.7) {
        recommendations.calibration_needs.push('Confidence scores poorly calibrated - implement probability calibration');
      }

      // Analyze common issues for feature adjustments
      if (predictionFeedback.common_issues.includes('Player prop predictions less accurate than spreads')) {
        recommendations.feature_adjustments.push('Enhance player prop feature engineering');
      }

      logger.info('🔧 Generated model improvement recommendations from feedback');
      return recommendations;

    } catch (error) {
      logger.error(`❌ Failed to process feedback for model improvement: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user feedback by type
   */
  async getFeedbackByType(type: string, limit: number = 50): Promise<UserFeedback[]> {
    try {
      // Mock data for now - in production this would query actual database
      const mockFeedback: UserFeedback[] = [];
      
      for (let i = 0; i < Math.min(limit, 10); i++) {
        mockFeedback.push({
          id: `feedback_${i}`,
          user_id: `user_${i}`,
          feedback_type: type as any,
          rating: Math.floor(Math.random() * 5) + 1,
          comment: `Sample feedback comment ${i}`,
          context: {},
          sentiment: 'neutral',
          priority: 'medium',
          status: 'new',
          tags: [type],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }

      logger.info(`📋 Retrieved ${mockFeedback.length} feedback items of type: ${type}`);
      return mockFeedback;

    } catch (error) {
      logger.error(`❌ Failed to get feedback by type: ${error.message}`);
      return [];
    }
  }

  /**
   * Update feedback status
   */
  async updateFeedbackStatus(feedbackId: string, status: UserFeedback['status'], resolutionNotes?: string): Promise<void> {
    try {
      // Mock implementation - in production this would update the database
      logger.info(`✅ Feedback ${feedbackId} status updated to: ${status}`);
      
      if (resolutionNotes) {
        logger.info(`📝 Resolution notes: ${resolutionNotes}`);
      }

    } catch (error) {
      logger.error(`❌ Failed to update feedback status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate feedback report
   */
  async generateFeedbackReport(): Promise<string> {
    try {
      const analytics = await this.getFeedbackAnalytics();
      const predictionFeedback = await this.getPredictionAccuracyFeedback();
      const improvements = await this.processFeedbackForModelImprovement();

      const report = `
# User Feedback Report
Generated: ${new Date().toLocaleString()}

## Summary Statistics
- Total Feedback: ${analytics.total_feedback_count}
- Average Rating: ${analytics.average_rating.toFixed(1)}/5
- User Satisfaction Score: ${analytics.user_satisfaction_score}%

## Sentiment Distribution
- Positive: ${analytics.sentiment_distribution.positive}%
- Neutral: ${analytics.sentiment_distribution.neutral}%
- Negative: ${analytics.sentiment_distribution.negative}%

## Prediction Accuracy Feedback
- Total Prediction Feedback: ${predictionFeedback.total_feedback}
- Accuracy Rate: ${(predictionFeedback.accuracy_rate * 100).toFixed(1)}%
- Confidence Calibration: ${(predictionFeedback.confidence_calibration * 100).toFixed(1)}%
- User Satisfaction: ${predictionFeedback.user_satisfaction.toFixed(1)}/5

## Top Issues
${analytics.trending_issues.map(issue => `- ${issue.issue} (${issue.count} reports, ${issue.severity} severity)`).join('\n')}

## Improvement Recommendations
${analytics.improvement_suggestions.map(suggestion => `- ${suggestion}`).join('\n')}

## Model Improvement Actions
${improvements.retrain_recommendations.length > 0 ? improvements.retrain_recommendations.map(rec => `- ${rec}`).join('\n') : '- No retraining needed'}
      `.trim();

      logger.info('📊 Generated comprehensive feedback report');
      return report;

    } catch (error) {
      logger.error(`❌ Failed to generate feedback report: ${error.message}`);
      throw error;
    }
  }
}

// Export singleton instance
export const feedbackCollector = new FeedbackCollector(); 