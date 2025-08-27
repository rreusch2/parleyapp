import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Star, 
  RefreshCw, 
  Trash2, 
  TestTube,
  BarChart3,
  Trophy,
  Gift,
  MessageCircle,
  Crown,
  Calendar,
  Smartphone,
  CheckCircle,
  XCircle,
  Zap
} from 'lucide-react-native';
import { useReview } from '../hooks/useReview';
import * as StoreReview from 'expo-store-review';

/**
 * Debug panel for testing the review system (dev mode only)
 * Shows review stats and allows manual triggering of review events
 */
export default function ReviewDebugPanel() {
  const { 
    trackPositiveInteraction, 
    getReviewStats, 
    forceShowReview, 
    resetReviewState 
  } = useReview();
  
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [hasAction, setHasAction] = useState<boolean | null>(null);
  const [testInProgress, setTestInProgress] = useState(false);

  useEffect(() => {
    if (__DEV__) {
      loadStats();
      checkStoreReviewAvailability();
    }
  }, []);

  const checkStoreReviewAvailability = async () => {
    try {
      const available = await StoreReview.hasAction();
      setHasAction(available);
      console.log('📱 StoreReview availability check:', available);
    } catch (error) {
      console.error('❌ Failed to check StoreReview availability:', error);
      setHasAction(false);
    }
  };

  const loadStats = async () => {
    try {
      setLoading(true);
      const reviewStats = await getReviewStats();
      setStats(reviewStats);
    } catch (error) {
      console.error('Failed to load review stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestEvent = async (eventType: string, metadata?: any) => {
    try {
      setTestInProgress(true);
      console.log('🧪 Testing event:', eventType, 'with metadata:', metadata);
      
      await trackPositiveInteraction({ eventType: eventType as any, metadata });
      await loadStats(); // Refresh stats
      
      Alert.alert(
        '✅ Event Tracked', 
        `Successfully tracked: ${eventType}\n\nCheck console logs for detailed flow.`,
        [{ text: 'OK', onPress: () => setTestInProgress(false) }]
      );
    } catch (error) {
      console.error('❌ Test event error:', error);
      Alert.alert(
        '❌ Error', 
        `Failed to track event: ${error}`,
        [{ text: 'OK', onPress: () => setTestInProgress(false) }]
      );
    }
  };

  const handleForceReview = async () => {
    try {
      setTestInProgress(true);
      console.log('🧪 Force testing native review dialog...');
      
      await forceShowReview();
      
      Alert.alert(
        '🧪 Force Review Test', 
        `Review dialog test completed.\n\nIf you're on a real iOS device, the native review dialog should have appeared.\n\nCheck console logs for detailed results.`,
        [{ text: 'OK', onPress: () => setTestInProgress(false) }]
      );
    } catch (error) {
      console.error('❌ Force review error:', error);
      Alert.alert(
        '❌ Error', 
        `Failed to show review: ${error}`,
        [{ text: 'OK', onPress: () => setTestInProgress(false) }]
      );
    }
  };

  const handleReset = async () => {
    Alert.alert(
      'Reset Review State',
      'This will reset all review tracking data. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await resetReviewState();
              await loadStats();
              Alert.alert('✅ Reset Complete', 'Review state has been reset');
            } catch (error) {
              Alert.alert('❌ Error', `Failed to reset: ${error}`);
            }
          }
        }
      ]
    );
  };

  if (!__DEV__) {
    return null; // Don't show in production
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1E293B', '#334155']}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <TestTube size={24} color="#00E5FF" />
          <Text style={styles.title}>Review System Debug</Text>
          <TouchableOpacity onPress={loadStats} disabled={loading}>
            <RefreshCw size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Platform & Availability Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Platform Status</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Platform</Text>
                <Text style={styles.statValue}>{Platform.OS}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>StoreReview Available</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {hasAction === true ? (
                    <CheckCircle size={16} color="#10B981" />
                  ) : hasAction === false ? (
                    <XCircle size={16} color="#EF4444" />
                  ) : null}
                  <Text style={[styles.statValue, { marginLeft: 6 }]}>
                    {hasAction === null ? 'Checking...' : hasAction ? 'Yes' : 'No'}
                  </Text>
                </View>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Device Type</Text>
                <Text style={styles.statValue}>
                  {Platform.OS === 'ios' && Platform.isPad ? 'iPad' : 
                   Platform.OS === 'ios' ? 'iPhone' : 
                   Platform.OS === 'android' ? 'Android' : 'Unknown'}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Environment</Text>
                <Text style={styles.statValue}>{__DEV__ ? 'Development' : 'Production'}</Text>
              </View>
            </View>
          </View>

          {/* Stats Section */}
          {stats && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Review State</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>App Opens</Text>
                  <Text style={styles.statValue}>{stats.totalAppOpens}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Positive Interactions</Text>
                  <Text style={styles.statValue}>{stats.positiveInteractions}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Review Attempts</Text>
                  <Text style={styles.statValue}>{stats.reviewTriggerCount || 0}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Review Requested</Text>
                  <Text style={styles.statValue}>{stats.hasRequestedReview ? 'Yes' : 'No'}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Install Date</Text>
                  <Text style={styles.statValue}>
                    {new Date(stats.appInstallDate).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Last Request</Text>
                  <Text style={styles.statValue}>
                    {stats.lastReviewRequestDate ? 
                      new Date(stats.lastReviewRequestDate).toLocaleDateString() : 'Never'
                    }
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Test Events Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Test Review Triggers</Text>
            
            <TouchableOpacity 
              style={styles.testButton}
              onPress={() => handleTestEvent('successful_subscription')}
            >
              <Crown size={20} color="#F59E0B" />
              <Text style={styles.testButtonText}>Successful Subscription</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.testButton}
              onPress={() => handleTestEvent('welcome_wheel_win', { wheelPrize: 5 })}
            >
              <Gift size={20} color="#10B981" />
              <Text style={styles.testButtonText}>Welcome Wheel Win (5 picks)</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.testButton}
              onPress={() => handleTestEvent('ai_chat_positive', { chatSatisfaction: 'very_positive' })}
            >
              <MessageCircle size={20} color="#8B5CF6" />
              <Text style={styles.testButtonText}>Very Positive AI Chat</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.testButton}
              onPress={() => handleTestEvent('daily_picks_viewed', { picksViewed: 15 })}
            >
              <BarChart3 size={20} color="#06B6D4" />
              <Text style={styles.testButtonText}>Daily Picks Viewed (15)</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.testButton}
              onPress={() => handleTestEvent('winning_streak', { streakCount: 4 })}
            >
              <Trophy size={20} color="#F59E0B" />
              <Text style={styles.testButtonText}>Winning Streak (4)</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.testButton}
              onPress={() => handleTestEvent('app_usage_milestone', { daysUsed: 10 })}
            >
              <Calendar size={20} color="#EC4899" />
              <Text style={styles.testButtonText}>Usage Milestone (10 days)</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Test Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Tests</Text>
            
            <TouchableOpacity 
              style={[styles.testButton, styles.forceButton]}
              onPress={handleForceReview}
              disabled={testInProgress}
            >
              <Star size={20} color="#FFFFFF" />
              <Text style={[styles.testButtonText, { color: '#FFFFFF' }]}>
                {testInProgress ? 'Testing...' : 'Force Show Native Review Dialog'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.testButton, styles.quickButton]}
              onPress={() => handleTestEvent('successful_subscription')}
              disabled={testInProgress}
            >
              <Zap size={20} color="#FFFFFF" />
              <Text style={[styles.testButtonText, { color: '#FFFFFF' }]}>
                Quick Test: Subscription Event
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.testButton, styles.checkButton]}
              onPress={checkStoreReviewAvailability}
            >
              <Smartphone size={20} color="#FFFFFF" />
              <Text style={[styles.testButtonText, { color: '#FFFFFF' }]}>
                Re-check StoreReview Availability
              </Text>
            </TouchableOpacity>
          </View>

          {/* Actions Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Actions</Text>
            
            <TouchableOpacity 
              style={[styles.testButton, styles.resetButton]}
              onPress={handleReset}
              disabled={testInProgress}
            >
              <Trash2 size={20} color="#FFFFFF" />
              <Text style={[styles.testButtonText, { color: '#FFFFFF' }]}>
                Reset Review State
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    margin: 16,
    overflow: 'hidden',
  },
  gradient: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    marginLeft: 12,
  },
  content: {
    maxHeight: 400,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E2E8F0',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statItem: {
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderRadius: 8,
    padding: 12,
    flex: 1,
    minWidth: '45%',
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00E5FF',
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  testButtonText: {
    fontSize: 14,
    color: '#E2E8F0',
    marginLeft: 12,
    fontWeight: '500',
  },
  forceButton: {
    backgroundColor: '#00E5FF',
  },
  resetButton: {
    backgroundColor: '#EF4444',
  },
  quickButton: {
    backgroundColor: '#8B5CF6',
  },
  checkButton: {
    backgroundColor: '#06B6D4',
  },
});
