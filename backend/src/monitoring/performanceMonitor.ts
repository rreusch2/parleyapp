/**
 * Performance Monitoring Dashboard System
 * Tracks data ingestion, model performance, API health, and system metrics
 * Phase 4: Content Generation and Continuous Improvement
 */

import { createLogger } from '../utils/logger';
import { supabase } from '../services/supabase/client';
import axios from 'axios';

const logger = createLogger('performanceMonitor');

interface SystemMetrics {
  timestamp: string;
  api_health: {
    backend_api: 'healthy' | 'degraded' | 'down';
    python_api: 'healthy' | 'degraded' | 'down';
    external_apis: 'healthy' | 'degraded' | 'down';
    response_times: {
      backend_avg_ms: number;
      python_avg_ms: number;
      external_avg_ms: number;
    };
  };
  data_ingestion: {
    last_successful_update: string;
    records_processed_24h: number;
    errors_24h: number;
    data_freshness_score: number; // 0-100
    missing_data_alerts: string[];
  };
  model_performance: {
    active_models: number;
    models_health: Record<string, 'healthy' | 'needs_retrain' | 'failed'>;
    prediction_accuracy: Record<string, number>;
    confidence_calibration: Record<string, number>;
    daily_predictions: number;
    successful_predictions: number;
  };
  user_engagement: {
    active_users_24h: number;
    total_predictions_viewed: number;
    user_feedback_score: number; // 1-5 scale
    content_engagement: {
      news_views: number;
      article_views: number;
      injury_report_views: number;
    };
  };
  system_resources: {
    cpu_usage: number;
    memory_usage: number;
    disk_usage: number;
    database_connections: number;
    cache_hit_rate: number;
  };
}

interface ModelPerformanceData {
  model_name: string;
  model_type: 'player_props' | 'spread' | 'total' | 'moneyline';
  sport: string;
  accuracy_7d: number;
  accuracy_30d: number;
  roi_7d: number;
  roi_30d: number;
  total_predictions: number;
  win_rate: number;
  avg_confidence: number;
  calibration_score: number;
  last_trained: string;
  status: 'active' | 'retraining' | 'deprecated';
  feature_importance: Record<string, number>;
}

interface AlertConfig {
  id: string;
  name: string;
  type: 'threshold' | 'trend' | 'anomaly';
  metric: string;
  condition: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  notification_channels: ('email' | 'slack' | 'dashboard')[];
}

export class PerformanceMonitor {
  private alertConfigs: AlertConfig[] = [];
  private metricsHistory: SystemMetrics[] = [];
  private lastHealthCheck: Date = new Date();

  constructor() {
    this.initializeAlerts();
    logger.info('✅ Performance Monitor initialized');
  }

  /**
   * Initialize default alert configurations
   */
  private initializeAlerts(): void {
    this.alertConfigs = [
      {
        id: 'api_down',
        name: 'API Service Down',
        type: 'threshold',
        metric: 'api_health.backend_api',
        condition: 'equals',
        threshold: 0, // 'down' status
        severity: 'critical',
        enabled: true,
        notification_channels: ['email', 'slack', 'dashboard']
      },
      {
        id: 'model_accuracy_drop',
        name: 'Model Accuracy Drop',
        type: 'threshold',
        metric: 'model_performance.prediction_accuracy',
        condition: 'less_than',
        threshold: 0.55, // Below 55% accuracy
        severity: 'high',
        enabled: true,
        notification_channels: ['email', 'dashboard']
      },
      {
        id: 'data_freshness',
        name: 'Stale Data Warning',
        type: 'threshold',
        metric: 'data_ingestion.data_freshness_score',
        condition: 'less_than',
        threshold: 70, // Below 70% freshness
        severity: 'medium',
        enabled: true,
        notification_channels: ['dashboard']
      },
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        type: 'threshold',
        metric: 'data_ingestion.errors_24h',
        condition: 'greater_than',
        threshold: 50, // More than 50 errors in 24h
        severity: 'high',
        enabled: true,
        notification_channels: ['email', 'slack']
      },
      {
        id: 'resource_usage',
        name: 'High Resource Usage',
        type: 'threshold',
        metric: 'system_resources.cpu_usage',
        condition: 'greater_than',
        threshold: 85, // Above 85% CPU
        severity: 'medium',
        enabled: true,
        notification_channels: ['dashboard']
      }
    ];
  }

  /**
   * Collect comprehensive system metrics
   */
  async collectSystemMetrics(): Promise<SystemMetrics> {
    logger.info('📊 Collecting system metrics...');

    try {
      const timestamp = new Date().toISOString();

      // Collect API health metrics
      const apiHealth = await this.checkApiHealth();
      
      // Collect data ingestion metrics
      const dataIngestion = await this.checkDataIngestionHealth();
      
      // Collect model performance metrics
      const modelPerformance = await this.checkModelPerformance();
      
      // Collect user engagement metrics
      const userEngagement = await this.checkUserEngagement();
      
      // Collect system resource metrics
      const systemResources = await this.checkSystemResources();

      const metrics: SystemMetrics = {
        timestamp,
        api_health: apiHealth,
        data_ingestion: dataIngestion,
        model_performance: modelPerformance,
        user_engagement: userEngagement,
        system_resources: systemResources
      };

      // Store metrics in database
      await this.storeMetrics(metrics);
      
      // Check for alerts
      await this.evaluateAlerts(metrics);
      
      // Update metrics history (keep last 1000 entries)
      this.metricsHistory.push(metrics);
      if (this.metricsHistory.length > 1000) {
        this.metricsHistory = this.metricsHistory.slice(-1000);
      }

      logger.info('✅ System metrics collected successfully');
      return metrics;

    } catch (error) {
      logger.error(`❌ Failed to collect system metrics: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check API health across all services
   */
  private async checkApiHealth(): Promise<SystemMetrics['api_health']> {
    const startTime = Date.now();
    
    try {
      // Check backend API health
      const backendHealth = await this.pingService('http://localhost:3001/health', 'backend');
      
      // Check Python API health
      const pythonHealth = await this.pingService('http://localhost:5001/health', 'python');
      
      // Check external APIs (mock for now)
      const externalHealth = await this.checkExternalApis();

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      return {
        backend_api: backendHealth.status,
        python_api: pythonHealth.status,
        external_apis: externalHealth.status,
        response_times: {
          backend_avg_ms: backendHealth.responseTime,
          python_avg_ms: pythonHealth.responseTime,
          external_avg_ms: externalHealth.responseTime
        }
      };

    } catch (error) {
      logger.error(`❌ API health check failed: ${error.message}`);
      return {
        backend_api: 'down',
        python_api: 'down',
        external_apis: 'down',
        response_times: {
          backend_avg_ms: 0,
          python_avg_ms: 0,
          external_avg_ms: 0
        }
      };
    }
  }

  /**
   * Ping a service and measure response time
   */
  private async pingService(url: string, serviceName: string): Promise<{ status: 'healthy' | 'degraded' | 'down', responseTime: number }> {
    const startTime = Date.now();
    
    try {
      const response = await axios.get(url, { timeout: 5000 });
      const responseTime = Date.now() - startTime;
      
      const status = responseTime > 2000 ? 'degraded' : 'healthy';
      
      logger.debug(`✅ ${serviceName} API: ${status} (${responseTime}ms)`);
      return { status, responseTime };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error(`❌ ${serviceName} API: down (${responseTime}ms) - ${error.message}`);
      return { status: 'down', responseTime };
    }
  }

  /**
   * Check external API health (sports data, odds, etc.)
   */
  private async checkExternalApis(): Promise<{ status: 'healthy' | 'degraded' | 'down', responseTime: number }> {
    // Mock implementation - in production this would check actual external APIs
    return {
      status: 'healthy',
      responseTime: 150
    };
  }

  /**
   * Check data ingestion pipeline health
   */
  private async checkDataIngestionHealth(): Promise<SystemMetrics['data_ingestion']> {
    try {
      // Query database for recent data ingestion metrics
      const { data: ingestionLogs, error } = await supabase
        .from('data_ingestion_logs')
        .select('*')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        logger.error(`❌ Failed to fetch ingestion logs: ${error.message}`);
        return this.getDefaultDataIngestionMetrics();
      }

      const logs = ingestionLogs || [];
      const successfulLogs = logs.filter(log => log.status === 'success');
      const errorLogs = logs.filter(log => log.status === 'error');
      
      const lastSuccessful = successfulLogs[0]?.created_at || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const recordsProcessed = successfulLogs.reduce((sum, log) => sum + (log.records_processed || 0), 0);
      const errors24h = errorLogs.length;

      // Calculate data freshness score (0-100)
      const timeSinceLastUpdate = Date.now() - new Date(lastSuccessful).getTime();
      const hoursStale = timeSinceLastUpdate / (1000 * 60 * 60);
      const freshnessScore = Math.max(0, Math.min(100, 100 - (hoursStale * 5))); // Decreases by 5 points per hour

      return {
        last_successful_update: lastSuccessful,
        records_processed_24h: recordsProcessed,
        errors_24h: errors24h,
        data_freshness_score: Math.round(freshnessScore),
        missing_data_alerts: this.checkMissingDataAlerts(logs)
      };

    } catch (error) {
      logger.error(`❌ Data ingestion health check failed: ${error.message}`);
      return this.getDefaultDataIngestionMetrics();
    }
  }

  /**
   * Default data ingestion metrics when database query fails
   */
  private getDefaultDataIngestionMetrics(): SystemMetrics['data_ingestion'] {
    return {
      last_successful_update: new Date().toISOString(),
      records_processed_24h: 0,
      errors_24h: 0,
      data_freshness_score: 50,
      missing_data_alerts: ['Unable to fetch ingestion logs']
    };
  }

  /**
   * Check for missing data alerts
   */
  private checkMissingDataAlerts(logs: any[]): string[] {
    const alerts: string[] = [];
    
    // Check if we have recent data for each sport
    const sports = ['NBA', 'NFL', 'MLB', 'NHL'];
    const recentLogs = logs.filter(log => 
      new Date(log.created_at).getTime() > Date.now() - 2 * 60 * 60 * 1000 // Last 2 hours
    );

    for (const sport of sports) {
      const sportLogs = recentLogs.filter(log => log.sport === sport);
      if (sportLogs.length === 0) {
        alerts.push(`No recent data for ${sport}`);
      }
    }

    return alerts;
  }

  /**
   * Check model performance across all active models
   */
  private async checkModelPerformance(): Promise<SystemMetrics['model_performance']> {
    try {
      // Query database for model performance data
      const { data: modelMetrics, error } = await supabase
        .from('model_performance_metrics')
        .select('*')
        .gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('date', { ascending: false });

      if (error) {
        logger.error(`❌ Failed to fetch model metrics: ${error.message}`);
        return this.getDefaultModelMetrics();
      }

      const metrics = modelMetrics || [];
      const activeModels = new Set(metrics.map(m => m.model_name)).size;
      
      // Calculate model health status
      const modelsHealth: Record<string, 'healthy' | 'needs_retrain' | 'failed'> = {};
      const predictionAccuracy: Record<string, number> = {};
      const confidenceCalibration: Record<string, number> = {};
      
      const uniqueModels = [...new Set(metrics.map(m => m.model_name))];
      
      for (const modelName of uniqueModels) {
        const modelData = metrics.filter(m => m.model_name === modelName);
        const latestMetric = modelData[0];
        
        if (latestMetric) {
          predictionAccuracy[modelName] = latestMetric.accuracy || 0;
          confidenceCalibration[modelName] = latestMetric.calibration_score || 0;
          
          // Determine health status
          if (latestMetric.accuracy > 0.6 && latestMetric.calibration_score > 0.7) {
            modelsHealth[modelName] = 'healthy';
          } else if (latestMetric.accuracy > 0.5) {
            modelsHealth[modelName] = 'needs_retrain';
          } else {
            modelsHealth[modelName] = 'failed';
          }
        }
      }

      const totalPredictions = metrics.reduce((sum, m) => sum + (m.total_predictions || 0), 0);
      const successfulPredictions = metrics.reduce((sum, m) => sum + (m.successful_predictions || 0), 0);

      return {
        active_models: activeModels,
        models_health: modelsHealth,
        prediction_accuracy: predictionAccuracy,
        confidence_calibration: confidenceCalibration,
        daily_predictions: Math.round(totalPredictions / 7), // Average per day
        successful_predictions: successfulPredictions
      };

    } catch (error) {
      logger.error(`❌ Model performance check failed: ${error.message}`);
      return this.getDefaultModelMetrics();
    }
  }

  /**
   * Default model metrics when database query fails
   */
  private getDefaultModelMetrics(): SystemMetrics['model_performance'] {
    return {
      active_models: 0,
      models_health: {},
      prediction_accuracy: {},
      confidence_calibration: {},
      daily_predictions: 0,
      successful_predictions: 0
    };
  }

  /**
   * Check user engagement metrics
   */
  private async checkUserEngagement(): Promise<SystemMetrics['user_engagement']> {
    try {
      // Mock implementation - in production this would query user analytics
      return {
        active_users_24h: 125,
        total_predictions_viewed: 450,
        user_feedback_score: 4.2,
        content_engagement: {
          news_views: 89,
          article_views: 156,
          injury_report_views: 67
        }
      };

    } catch (error) {
      logger.error(`❌ User engagement check failed: ${error.message}`);
      return {
        active_users_24h: 0,
        total_predictions_viewed: 0,
        user_feedback_score: 0,
        content_engagement: {
          news_views: 0,
          article_views: 0,
          injury_report_views: 0
        }
      };
    }
  }

  /**
   * Check system resource utilization
   */
  private async checkSystemResources(): Promise<SystemMetrics['system_resources']> {
    try {
      // Mock implementation - in production this would use system monitoring tools
      return {
        cpu_usage: Math.random() * 30 + 20, // 20-50%
        memory_usage: Math.random() * 20 + 40, // 40-60%
        disk_usage: Math.random() * 10 + 60, // 60-70%
        database_connections: Math.floor(Math.random() * 10) + 5, // 5-15
        cache_hit_rate: Math.random() * 20 + 80 // 80-100%
      };

    } catch (error) {
      logger.error(`❌ System resources check failed: ${error.message}`);
      return {
        cpu_usage: 0,
        memory_usage: 0,
        disk_usage: 0,
        database_connections: 0,
        cache_hit_rate: 0
      };
    }
  }

  /**
   * Store metrics in database
   */
  private async storeMetrics(metrics: SystemMetrics): Promise<void> {
    try {
      const { error } = await supabase
        .from('system_metrics')
        .insert({
          timestamp: metrics.timestamp,
          api_health: metrics.api_health,
          data_ingestion: metrics.data_ingestion,
          model_performance: metrics.model_performance,
          user_engagement: metrics.user_engagement,
          system_resources: metrics.system_resources
        });

      if (error) {
        logger.error(`❌ Failed to store metrics: ${error.message}`);
      } else {
        logger.debug('✅ Metrics stored successfully');
      }

    } catch (error) {
      logger.error(`❌ Metrics storage failed: ${error.message}`);
    }
  }

  /**
   * Evaluate alert conditions and trigger notifications
   */
  private async evaluateAlerts(metrics: SystemMetrics): Promise<void> {
    for (const alert of this.alertConfigs) {
      if (!alert.enabled) continue;

      try {
        const triggered = this.checkAlertCondition(alert, metrics);
        
        if (triggered) {
          await this.triggerAlert(alert, metrics);
        }

      } catch (error) {
        logger.error(`❌ Alert evaluation failed for ${alert.name}: ${error.message}`);
      }
    }
  }

  /**
   * Check if alert condition is met
   */
  private checkAlertCondition(alert: AlertConfig, metrics: SystemMetrics): boolean {
    try {
      const value = this.getMetricValue(alert.metric, metrics);
      
      switch (alert.condition) {
        case 'greater_than':
          return value > alert.threshold;
        case 'less_than':
          return value < alert.threshold;
        case 'equals':
          return value === alert.threshold;
        case 'not_equals':
          return value !== alert.threshold;
        default:
          return false;
      }

    } catch (error) {
      logger.error(`❌ Failed to check alert condition: ${error.message}`);
      return false;
    }
  }

  /**
   * Get metric value by path
   */
  private getMetricValue(metricPath: string, metrics: SystemMetrics): number {
    const path = metricPath.split('.');
    let value: any = metrics;
    
    for (const key of path) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        throw new Error(`Metric path not found: ${metricPath}`);
      }
    }
    
    return typeof value === 'number' ? value : 0;
  }

  /**
   * Trigger alert notification
   */
  private async triggerAlert(alert: AlertConfig, metrics: SystemMetrics): Promise<void> {
    logger.warn(`🚨 ALERT TRIGGERED: ${alert.name} (${alert.severity})`);
    
    const alertData = {
      alert_id: alert.id,
      name: alert.name,
      severity: alert.severity,
      triggered_at: new Date().toISOString(),
      metric: alert.metric,
      threshold: alert.threshold,
      current_value: this.getMetricValue(alert.metric, metrics),
      notification_channels: alert.notification_channels
    };

    // Store alert in database
    try {
      const { error } = await supabase
        .from('system_alerts')
        .insert(alertData);

      if (error) {
        logger.error(`❌ Failed to store alert: ${error.message}`);
      }

    } catch (error) {
      logger.error(`❌ Alert storage failed: ${error.message}`);
    }

    // Send notifications (mock implementation)
    for (const channel of alert.notification_channels) {
      await this.sendNotification(channel, alertData);
    }
  }

  /**
   * Send notification via specified channel
   */
  private async sendNotification(channel: string, alertData: any): Promise<void> {
    // Mock implementation - in production this would integrate with actual notification services
    logger.info(`📢 Sending ${channel} notification for alert: ${alertData.name}`);
  }

  /**
   * Get current system status summary
   */
  async getSystemStatus(): Promise<{ status: 'healthy' | 'degraded' | 'critical', summary: string, metrics: SystemMetrics | null }> {
    try {
      const metrics = await this.collectSystemMetrics();
      
      // Determine overall system health
      const apiDown = metrics.api_health.backend_api === 'down' || metrics.api_health.python_api === 'down';
      const lowAccuracy = Object.values(metrics.model_performance.prediction_accuracy).some(acc => acc < 0.5);
      const highErrors = metrics.data_ingestion.errors_24h > 50;
      const staleData = metrics.data_ingestion.data_freshness_score < 50;
      
      let status: 'healthy' | 'degraded' | 'critical';
      let summary: string;
      
      if (apiDown || lowAccuracy) {
        status = 'critical';
        summary = 'Critical issues detected: API services down or model accuracy below 50%';
      } else if (highErrors || staleData) {
        status = 'degraded';
        summary = 'System running with degraded performance: data ingestion issues detected';
      } else {
        status = 'healthy';
        summary = 'All systems operational';
      }

      return { status, summary, metrics };

    } catch (error) {
      logger.error(`❌ Failed to get system status: ${error.message}`);
      return {
        status: 'critical',
        summary: 'Failed to collect system metrics',
        metrics: null
      };
    }
  }

  /**
   * Get model performance dashboard data
   */
  async getModelPerformanceDashboard(): Promise<ModelPerformanceData[]> {
    try {
      const { data: modelData, error } = await supabase
        .from('model_performance_detailed')
        .select('*')
        .order('last_trained', { ascending: false });

      if (error) {
        logger.error(`❌ Failed to fetch model dashboard data: ${error.message}`);
        return [];
      }

      return modelData || [];

    } catch (error) {
      logger.error(`❌ Model performance dashboard failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Start continuous monitoring
   */
  startMonitoring(intervalMinutes: number = 5): void {
    logger.info(`🔄 Starting continuous monitoring (every ${intervalMinutes} minutes)`);
    
    setInterval(async () => {
      try {
        await this.collectSystemMetrics();
      } catch (error) {
        logger.error(`❌ Monitoring cycle failed: ${error.message}`);
      }
    }, intervalMinutes * 60 * 1000);
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor(); 