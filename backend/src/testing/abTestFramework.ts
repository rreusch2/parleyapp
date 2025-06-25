/**
 * A/B Testing Framework
 * Infrastructure for testing new models, features, and prediction strategies
 * Phase 4: Content Generation and Continuous Improvement
 */

import { createLogger } from '../utils/logger';

const logger = createLogger('abTestFramework');

interface ABTest {
  id: string;
  name: string;
  description: string;
  type: 'model_comparison' | 'feature_test' | 'ui_test' | 'prediction_strategy' | 'algorithm_test';
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  variants: ABTestVariant[];
  traffic_allocation: Record<string, number>; // variant_id -> percentage (0-100)
  target_metrics: string[];
  success_criteria: SuccessCriteria;
  duration_days: number;
  min_sample_size: number;
  created_at: string;
  started_at?: string;
  ended_at?: string;
  created_by: string;
  metadata: {
    hypothesis: string;
    expected_impact: string;
    risks: string[];
    rollback_plan: string;
  };
}

interface ABTestVariant {
  id: string;
  name: string;
  description: string;
  is_control: boolean;
  config: Record<string, any>; // Configuration for this variant
  model_version?: string;
  feature_flags?: Record<string, boolean>;
  parameters?: Record<string, any>;
}

interface SuccessCriteria {
  primary_metric: string;
  improvement_threshold: number; // Minimum % improvement needed
  confidence_level: number; // 0.95 for 95% confidence
  statistical_power: number; // 0.8 for 80% power
  max_acceptable_risk: number; // Maximum acceptable negative impact on secondary metrics
}

interface ABTestResult {
  test_id: string;
  variant_id: string;
  metric_name: string;
  value: number;
  count: number;
  timestamp: string;
  user_id?: string;
  context?: Record<string, any>;
}

interface ABTestAnalysis {
  test_id: string;
  status: 'insufficient_data' | 'no_significant_difference' | 'variant_wins' | 'control_wins';
  confidence: number;
  effect_size: number;
  p_value: number;
  sample_sizes: Record<string, number>;
  metric_results: Record<string, {
    control_mean: number;
    variant_mean: number;
    improvement: number;
    confidence_interval: [number, number];
    is_significant: boolean;
  }>;
  recommendation: 'continue_test' | 'end_test_implement_variant' | 'end_test_keep_control' | 'extend_test_duration';
  insights: string[];
}

interface ModelABTest {
  test_id: string;
  control_model: {
    name: string;
    version: string;
    config: Record<string, any>;
  };
  test_model: {
    name: string;
    version: string;
    config: Record<string, any>;
  };
  metrics_to_track: string[];
  test_predictions: Record<string, any>[];
  performance_comparison: {
    accuracy: { control: number; test: number };
    precision: { control: number; test: number };
    recall: { control: number; test: number };
    roi: { control: number; test: number };
  };
}

export class ABTestFramework {
  private activeTests: Map<string, ABTest> = new Map();
  private testResults: Map<string, ABTestResult[]> = new Map();

  constructor() {
    logger.info('✅ A/B Test Framework initialized');
  }

  /**
   * Create a new A/B test
   */
  async createTest(testConfig: Omit<ABTest, 'id' | 'created_at' | 'status'>): Promise<string> {
    try {
      const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Validate test configuration
      this.validateTestConfig(testConfig);
      
      const test: ABTest = {
        ...testConfig,
        id: testId,
        status: 'draft',
        created_at: new Date().toISOString()
      };

      this.activeTests.set(testId, test);
      this.testResults.set(testId, []);

      // Store in database
      await this.storeTest(test);

      logger.info(`✅ A/B test created: ${testId} (${test.name})`);
      return testId;

    } catch (error) {
      logger.error(`❌ Failed to create A/B test: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate test configuration
   */
  private validateTestConfig(config: Omit<ABTest, 'id' | 'created_at' | 'status'>): void {
    // Check that variants exist
    if (!config.variants || config.variants.length < 2) {
      throw new Error('A/B test must have at least 2 variants');
    }

    // Check that exactly one variant is marked as control
    const controlVariants = config.variants.filter(v => v.is_control);
    if (controlVariants.length !== 1) {
      throw new Error('A/B test must have exactly one control variant');
    }

    // Check traffic allocation sums to 100%
    const totalAllocation = Object.values(config.traffic_allocation).reduce((sum, pct) => sum + pct, 0);
    if (Math.abs(totalAllocation - 100) > 0.01) {
      throw new Error(`Traffic allocation must sum to 100%, got ${totalAllocation}%`);
    }

    // Check that all variants have traffic allocation
    for (const variant of config.variants) {
      if (!(variant.id in config.traffic_allocation)) {
        throw new Error(`Missing traffic allocation for variant: ${variant.id}`);
      }
    }
  }

  /**
   * Start an A/B test
   */
  async startTest(testId: string): Promise<void> {
    try {
      const test = this.activeTests.get(testId);
      if (!test) {
        throw new Error(`Test not found: ${testId}`);
      }

      if (test.status !== 'draft') {
        throw new Error(`Cannot start test in status: ${test.status}`);
      }

      test.status = 'active';
      test.started_at = new Date().toISOString();

      await this.storeTest(test);

      logger.info(`🚀 A/B test started: ${testId} (${test.name})`);

    } catch (error) {
      logger.error(`❌ Failed to start A/B test: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get variant assignment for a user
   */
  getVariantAssignment(testId: string, userId: string): string | null {
    try {
      const test = this.activeTests.get(testId);
      if (!test || test.status !== 'active') {
        return null;
      }

      // Use consistent hashing for user assignment
      const hash = this.hashUserId(userId, testId);
      const hashValue = hash % 100; // Convert to 0-99

      let cumulativePercentage = 0;
      for (const [variantId, percentage] of Object.entries(test.traffic_allocation)) {
        cumulativePercentage += percentage;
        if (hashValue < cumulativePercentage) {
          return variantId;
        }
      }

      // Fallback to control if something goes wrong
      const controlVariant = test.variants.find(v => v.is_control);
      return controlVariant?.id || null;

    } catch (error) {
      logger.error(`❌ Failed to get variant assignment: ${error.message}`);
      return null;
    }
  }

  /**
   * Hash user ID for consistent assignment
   */
  private hashUserId(userId: string, testId: string): number {
    // Simple hash function for consistent user assignment
    let hash = 0;
    const str = `${userId}_${testId}`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Record test result
   */
  async recordResult(result: Omit<ABTestResult, 'timestamp'>): Promise<void> {
    try {
      const completeResult: ABTestResult = {
        ...result,
        timestamp: new Date().toISOString()
      };

      const testResults = this.testResults.get(result.test_id) || [];
      testResults.push(completeResult);
      this.testResults.set(result.test_id, testResults);

      // Store in database
      await this.storeResult(completeResult);

      logger.debug(`📊 Test result recorded: ${result.test_id} - ${result.metric_name}: ${result.value}`);

    } catch (error) {
      logger.error(`❌ Failed to record test result: ${error.message}`);
      throw error;
    }
  }

  /**
   * Analyze test results
   */
  async analyzeTest(testId: string): Promise<ABTestAnalysis> {
    try {
      const test = this.activeTests.get(testId);
      if (!test) {
        throw new Error(`Test not found: ${testId}`);
      }

      const results = this.testResults.get(testId) || [];
      
      if (results.length === 0) {
        return this.createInsufficientDataAnalysis(testId);
      }

      // Group results by variant and metric
      const resultsByVariantAndMetric = this.groupResultsByVariantAndMetric(results);
      
      // Calculate sample sizes
      const sampleSizes = this.calculateSampleSizes(resultsByVariantAndMetric);
      
      // Check if we have sufficient sample size
      if (Math.min(...Object.values(sampleSizes)) < test.min_sample_size) {
        return this.createInsufficientDataAnalysis(testId, sampleSizes);
      }

      // Perform statistical analysis
      const metricResults = await this.performStatisticalAnalysis(
        resultsByVariantAndMetric,
        test.variants,
        test.success_criteria
      );

      // Determine overall test result
      const primaryMetricResult = metricResults[test.success_criteria.primary_metric];
      const analysis = this.determineTestOutcome(test, primaryMetricResult, metricResults);

      logger.info(`📈 Test analysis completed: ${testId} - ${analysis.status}`);
      return {
        test_id: testId,
        ...analysis,
        sample_sizes: sampleSizes,
        metric_results: metricResults
      };

    } catch (error) {
      logger.error(`❌ Failed to analyze test: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create analysis for insufficient data
   */
  private createInsufficientDataAnalysis(testId: string, sampleSizes?: Record<string, number>): ABTestAnalysis {
    return {
      test_id: testId,
      status: 'insufficient_data',
      confidence: 0,
      effect_size: 0,
      p_value: 1,
      sample_sizes: sampleSizes || {},
      metric_results: {},
      recommendation: 'continue_test',
      insights: ['Insufficient data collected', 'Continue test to reach minimum sample size']
    };
  }

  /**
   * Group results by variant and metric
   */
  private groupResultsByVariantAndMetric(results: ABTestResult[]): Record<string, Record<string, number[]>> {
    const grouped: Record<string, Record<string, number[]>> = {};
    
    for (const result of results) {
      if (!grouped[result.variant_id]) {
        grouped[result.variant_id] = {};
      }
      if (!grouped[result.variant_id][result.metric_name]) {
        grouped[result.variant_id][result.metric_name] = [];
      }
      grouped[result.variant_id][result.metric_name].push(result.value);
    }
    
    return grouped;
  }

  /**
   * Calculate sample sizes for each variant
   */
  private calculateSampleSizes(resultsByVariantAndMetric: Record<string, Record<string, number[]>>): Record<string, number> {
    const sampleSizes: Record<string, number> = {};
    
    for (const [variantId, metrics] of Object.entries(resultsByVariantAndMetric)) {
      // Use the metric with the most data points as sample size
      const maxSampleSize = Math.max(...Object.values(metrics).map(values => values.length));
      sampleSizes[variantId] = maxSampleSize;
    }
    
    return sampleSizes;
  }

  /**
   * Perform statistical analysis on results
   */
  private async performStatisticalAnalysis(
    resultsByVariantAndMetric: Record<string, Record<string, number[]>>,
    variants: ABTestVariant[],
    successCriteria: SuccessCriteria
  ): Promise<Record<string, any>> {
    const metricResults: Record<string, any> = {};
    
    const controlVariant = variants.find(v => v.is_control);
    if (!controlVariant) {
      throw new Error('No control variant found');
    }

    // Analyze each metric
    for (const metricName of Object.keys(resultsByVariantAndMetric[controlVariant.id] || {})) {
      const controlValues = resultsByVariantAndMetric[controlVariant.id][metricName] || [];
      
      for (const variant of variants) {
        if (variant.is_control) continue;
        
        const variantValues = resultsByVariantAndMetric[variant.id]?.[metricName] || [];
        
        if (controlValues.length === 0 || variantValues.length === 0) {
          continue;
        }

        // Calculate basic statistics
        const controlMean = this.calculateMean(controlValues);
        const variantMean = this.calculateMean(variantValues);
        const improvement = ((variantMean - controlMean) / controlMean) * 100;
        
        // Perform t-test (simplified)
        const tTestResult = this.performTTest(controlValues, variantValues, successCriteria.confidence_level);
        
        metricResults[metricName] = {
          control_mean: controlMean,
          variant_mean: variantMean,
          improvement: improvement,
          confidence_interval: tTestResult.confidenceInterval,
          is_significant: tTestResult.isSignificant,
          p_value: tTestResult.pValue
        };
      }
    }
    
    return metricResults;
  }

  /**
   * Calculate mean of an array
   */
  private calculateMean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Perform simplified t-test
   */
  private performTTest(controlValues: number[], variantValues: number[], confidenceLevel: number): {
    isSignificant: boolean;
    pValue: number;
    confidenceInterval: [number, number];
  } {
    // Simplified t-test implementation
    const controlMean = this.calculateMean(controlValues);
    const variantMean = this.calculateMean(variantValues);
    
    // Calculate standard deviations
    const controlStd = this.calculateStandardDeviation(controlValues, controlMean);
    const variantStd = this.calculateStandardDeviation(variantValues, variantMean);
    
    // Calculate standard error
    const standardError = Math.sqrt(
      (controlStd * controlStd) / controlValues.length +
      (variantStd * variantStd) / variantValues.length
    );
    
    // Calculate t-statistic
    const tStat = (variantMean - controlMean) / standardError;
    
    // Simplified p-value calculation (for demonstration)
    const pValue = Math.abs(tStat) > 1.96 ? 0.04 : 0.06; // Simplified
    
    const isSignificant = pValue < (1 - confidenceLevel);
    
    // Calculate confidence interval
    const margin = 1.96 * standardError; // For 95% confidence
    const confidenceInterval: [number, number] = [
      variantMean - controlMean - margin,
      variantMean - controlMean + margin
    ];
    
    return {
      isSignificant,
      pValue,
      confidenceInterval
    };
  }

  /**
   * Calculate standard deviation
   */
  private calculateStandardDeviation(values: number[], mean: number): number {
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (values.length - 1);
    return Math.sqrt(variance);
  }

  /**
   * Determine test outcome
   */
  private determineTestOutcome(test: ABTest, primaryMetricResult: any, allMetricResults: Record<string, any>): Partial<ABTestAnalysis> {
    if (!primaryMetricResult) {
      return {
        status: 'insufficient_data',
        confidence: 0,
        effect_size: 0,
        p_value: 1,
        recommendation: 'continue_test',
        insights: ['No data for primary metric']
      };
    }

    const improvement = primaryMetricResult.improvement;
    const isSignificant = primaryMetricResult.is_significant;
    const meetsThreshold = improvement >= test.success_criteria.improvement_threshold;

    if (isSignificant && meetsThreshold) {
      return {
        status: 'variant_wins',
        confidence: 0.95, // Simplified
        effect_size: improvement,
        p_value: primaryMetricResult.p_value,
        recommendation: 'end_test_implement_variant',
        insights: [
          `Variant shows significant improvement of ${improvement.toFixed(2)}%`,
          `Exceeds minimum threshold of ${test.success_criteria.improvement_threshold}%`
        ]
      };
    } else if (isSignificant && improvement < 0) {
      return {
        status: 'control_wins',
        confidence: 0.95,
        effect_size: Math.abs(improvement),
        p_value: primaryMetricResult.p_value,
        recommendation: 'end_test_keep_control',
        insights: [
          `Variant shows significant negative impact of ${improvement.toFixed(2)}%`,
          'Control performs better'
        ]
      };
    } else {
      return {
        status: 'no_significant_difference',
        confidence: 0.5,
        effect_size: Math.abs(improvement),
        p_value: primaryMetricResult.p_value,
        recommendation: 'extend_test_duration',
        insights: [
          'No statistically significant difference found',
          'Consider extending test duration or increasing sample size'
        ]
      };
    }
  }

  /**
   * Create model comparison test
   */
  async createModelComparisonTest(testConfig: {
    name: string;
    description: string;
    control_model: { name: string; version: string; config: any };
    test_model: { name: string; version: string; config: any };
    traffic_split: number; // Percentage for test model (0-100)
    duration_days: number;
    metrics: string[];
  }): Promise<string> {
    try {
      const variants: ABTestVariant[] = [
        {
          id: 'control',
          name: 'Control Model',
          description: `${testConfig.control_model.name} v${testConfig.control_model.version}`,
          is_control: true,
          config: testConfig.control_model.config,
          model_version: testConfig.control_model.version
        },
        {
          id: 'test',
          name: 'Test Model',
          description: `${testConfig.test_model.name} v${testConfig.test_model.version}`,
          is_control: false,
          config: testConfig.test_model.config,
          model_version: testConfig.test_model.version
        }
      ];

      const trafficAllocation = {
        'control': 100 - testConfig.traffic_split,
        'test': testConfig.traffic_split
      };

      const abTest: Omit<ABTest, 'id' | 'created_at' | 'status'> = {
        name: testConfig.name,
        description: testConfig.description,
        type: 'model_comparison',
        variants,
        traffic_allocation: trafficAllocation,
        target_metrics: testConfig.metrics,
        success_criteria: {
          primary_metric: 'accuracy',
          improvement_threshold: 5.0, // 5% improvement needed
          confidence_level: 0.95,
          statistical_power: 0.8,
          max_acceptable_risk: 2.0 // Max 2% degradation in secondary metrics
        },
        duration_days: testConfig.duration_days,
        min_sample_size: 100,
        created_by: 'system',
        metadata: {
          hypothesis: `${testConfig.test_model.name} will outperform ${testConfig.control_model.name}`,
          expected_impact: 'Improved prediction accuracy and user satisfaction',
          risks: ['Potential accuracy degradation', 'User experience impact'],
          rollback_plan: 'Immediately switch back to control model if significant degradation detected'
        }
      };

      const testId = await this.createTest(abTest);
      logger.info(`🤖 Model comparison test created: ${testId}`);
      return testId;

    } catch (error) {
      logger.error(`❌ Failed to create model comparison test: ${error.message}`);
      throw error;
    }
  }

  /**
   * Store test in database
   */
  private async storeTest(test: ABTest): Promise<void> {
    try {
      // Mock storage - in production this would store in actual database
      logger.debug(`💾 Storing A/B test: ${test.id}`);

    } catch (error) {
      logger.error(`❌ Failed to store test: ${error.message}`);
      throw error;
    }
  }

  /**
   * Store result in database
   */
  private async storeResult(result: ABTestResult): Promise<void> {
    try {
      // Mock storage - in production this would store in actual database
      logger.debug(`💾 Storing test result: ${result.test_id}`);

    } catch (error) {
      logger.error(`❌ Failed to store result: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all active tests
   */
  getActiveTests(): ABTest[] {
    return Array.from(this.activeTests.values()).filter(test => test.status === 'active');
  }

  /**
   * End a test
   */
  async endTest(testId: string, reason: string): Promise<void> {
    try {
      const test = this.activeTests.get(testId);
      if (!test) {
        throw new Error(`Test not found: ${testId}`);
      }

      test.status = 'completed';
      test.ended_at = new Date().toISOString();

      await this.storeTest(test);

      logger.info(`🏁 A/B test ended: ${testId} - ${reason}`);

    } catch (error) {
      logger.error(`❌ Failed to end test: ${error.message}`);
      throw error;
    }
  }
}

// Export singleton instance
export const abTestFramework = new ABTestFramework(); 