import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
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
  Calendar
} from 'lucide-react-native';
import { useReview } from '../hooks/useReview';

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

  useEffect(() => {
    if (__DEV__) {
      loadStats();
    }
  }, []);

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
      await trackPositiveInteraction({ eventType: eventType as any, metadata });
      await loadStats(); // Refresh stats
      Alert.alert('✅ Event Tracked', `Successfully tracked: ${eventType}`);
    } catch (error) {
      Alert.alert('❌ Error', `Failed to track event: ${error}`);
    }
  };

  const handleForceReview = async () => {
    try {
      await forceShowReview();
    } catch (error) {
      Alert.alert('❌ Error', `Failed to show review: ${error}`);
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
          {/* Stats Section */}
          {stats && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Current Stats</Text>
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
                  <Text style={styles.statLabel}>Review Requested</Text>
                  <Text style={styles.statValue}>{stats.hasRequestedReview ? 'Yes' : 'No'}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Install Date</Text>
                  <Text style={styles.statValue}>
                    {new Date(stats.appInstallDate).toLocaleDateString()}
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

          {/* Actions Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Actions</Text>
            
            <TouchableOpacity 
              style={[styles.testButton, styles.forceButton]}
              onPress={handleForceReview}
            >
              <Star size={20} color="#FFFFFF" />
              <Text style={[styles.testButtonText, { color: '#FFFFFF' }]}>
                Force Show Review Dialog
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.testButton, styles.resetButton]}
              onPress={handleReset}
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
});
