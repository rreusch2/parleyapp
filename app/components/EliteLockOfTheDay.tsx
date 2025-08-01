import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Modal,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Crown,
  Target,
  TrendingUp,
  Star,
  Zap,
  DollarSign,
  BarChart3,
  Sparkles,
  Trophy,
  Lock,
} from 'lucide-react-native';
import { supabase } from '../services/api/supabaseClient';
import Colors from '../constants/Colors';

const { width: screenWidth } = Dimensions.get('window');

interface LockOfTheDayPick {
  id: string;
  match_teams: string;
  pick: string;
  confidence: number;
  odds: string;
  bet_type: string;
  reasoning?: string;
  roi_estimate?: string;
  value_percentage?: string;
  sport?: string;
  created_at: string;
}

interface EliteLockOfTheDayProps {
  userId: string;
  userPreferences: {
    sportPreferences: { [key: string]: boolean };
  };
  onPickPress?: (pick: LockOfTheDayPick) => void;
}

const EliteLockOfTheDay: React.FC<EliteLockOfTheDayProps> = ({ userId, userPreferences, onPickPress }) => {
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [lockPick, setLockPick] = useState<LockOfTheDayPick | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLockOfTheDay();
  }, [userId, userPreferences]);

  const fetchLockOfTheDay = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get user's preferred sports
      const preferredSports = Object.entries(userPreferences.sportPreferences || {})
        .filter(([sport, enabled]) => enabled)
        .map(([sport]) => sport.toUpperCase());

      console.log('🎯 Fetching Lock of the Day for preferred sports:', preferredSports);

      // Query for highest confidence pick from user's preferred sports
      const { data: picks, error: queryError } = await supabase
        .from('ai_predictions')
        .select('*')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .order('confidence', { ascending: false })
        .limit(50); // Get top 50 to filter by sport preferences

      if (queryError) {
        console.error('❌ Error fetching Lock of the Day:', queryError);
        setError('Failed to load Lock of the Day');
        return;
      }

      if (!picks || picks.length === 0) {
        setError('No picks available today');
        return;
      }

      // Filter by user's preferred sports if any are set
      let filteredPicks = picks;
      if (preferredSports.length > 0) {
        filteredPicks = picks.filter(pick => {
          // Check if pick matches any preferred sport
          const pickSport = pick.sport?.toUpperCase() || '';
          const matchTeams = pick.match_teams?.toUpperCase() || '';
          
          return preferredSports.some(sport => 
            pickSport.includes(sport) || 
            matchTeams.includes('MLB') && sport === 'MLB' ||
            matchTeams.includes('WNBA') && sport === 'WNBA' ||
            matchTeams.includes('UFC') && sport === 'UFC'
          );
        });
      }

      // If no picks match preferences, fall back to all picks
      const finalPicks = filteredPicks.length > 0 ? filteredPicks : picks;
      
      // Get the highest confidence pick
      const topPick = finalPicks[0];
      
      if (topPick) {
        setLockPick(topPick);
        console.log('🔒 Lock of the Day selected:', topPick.match_teams, topPick.confidence + '%');
      } else {
        setError('No suitable picks found');
      }

    } catch (err) {
      console.error('❌ Error in fetchLockOfTheDay:', err);
      setError('Failed to load Lock of the Day');
    } finally {
      setLoading(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return '#10B981'; // Green
    if (confidence >= 70) return '#F59E0B'; // Yellow
    return '#EF4444'; // Red
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 85) return 'ELITE LOCK';
    if (confidence >= 80) return 'HIGH CONFIDENCE';
    if (confidence >= 70) return 'SOLID PICK';
    return 'VALUE PLAY';
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#8B5CF6', '#EC4899', '#F59E0B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.loadingCard}
        >
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Loading Elite Lock...</Text>
        </LinearGradient>
      </View>
    );
  }

  if (error || !lockPick) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#6B7280', '#9CA3AF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.errorCard}
        >
          <Lock size={24} color="#FFFFFF" />
          <Text style={styles.errorText}>{error || 'No Lock available'}</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <>
      <View style={styles.container}>
        {/* Remove TouchableOpacity to prevent chatbot popup */}
        <LinearGradient
          colors={['#8B5CF6', '#EC4899', '#F59E0B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          {/* Elite Badge with Confidence % moved to the right */}
          <View style={styles.eliteBadge}>
            <View style={styles.eliteBadgeLeft}>
              <Crown size={16} color="#FFFFFF" />
              <Text style={styles.eliteBadgeText}>ELITE EXCLUSIVE</Text>
            </View>
            <View style={styles.confidenceBadge}>
              <Text style={styles.confidenceText}>{lockPick.confidence}%</Text>
            </View>
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Lock size={28} color="#FFFFFF" />
              <Text style={styles.title}>Lock of the Day</Text>
            </View>
          </View>

          {/* Pick Details */}
          <View style={styles.pickDetails}>
            <Text style={styles.matchTeams}>{lockPick.match_teams}</Text>
            <View style={styles.pickRow}>
              <View style={styles.pickInfo}>
                <Text style={styles.pickLabel}>PICK</Text>
                <Text style={styles.pickValue} numberOfLines={2} adjustsFontSizeToFit>{lockPick.pick}</Text>
              </View>
              <View style={styles.oddsInfo}>
                <Text style={styles.pickLabel}>ODDS</Text>
                <Text style={styles.pickValue}>{lockPick.odds}</Text>
              </View>
            </View>
          </View>

          {/* Confidence & Analytics */}
          <View style={styles.analytics}>
            <View style={styles.analyticsRow}>
              <View style={styles.analyticsItem}>
                <Target size={16} color="#FFFFFF" />
                <Text style={styles.analyticsLabel}>Confidence</Text>
                <Text style={[styles.analyticsValue, styles.confidenceLabelText]}>
                  {getConfidenceLabel(lockPick.confidence)}
                </Text>
              </View>
              
              {lockPick.roi_estimate && (
                <View style={styles.analyticsItem}>
                  <TrendingUp size={16} color="#FFFFFF" />
                  <Text style={styles.analyticsLabel}>ROI Est.</Text>
                  <Text style={styles.analyticsValue}>{lockPick.roi_estimate}</Text>
                </View>
              )}
              
              {lockPick.value_percentage && (
                <View style={styles.analyticsItem}>
                  <BarChart3 size={16} color="#FFFFFF" />
                  <Text style={styles.analyticsLabel}>Value</Text>
                  <Text style={styles.analyticsValue}>{lockPick.value_percentage}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Reasoning (if available) */}
          {lockPick.reasoning && (
            <View style={styles.reasoning}>
              <Text style={styles.reasoningLabel}>🧠 Elite Analysis</Text>
              <Text style={styles.reasoningText} numberOfLines={3}>
                {lockPick.reasoning}
              </Text>
            </View>
          )}

          {/* Action Button */}
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => {
              console.log('🔍 Opening Elite Analysis Modal for pick:', lockPick?.id);
              console.log('🔍 Lock pick data:', JSON.stringify(lockPick, null, 2));
              setShowAnalysisModal(true);
            }}
            activeOpacity={0.8}
          >
            <Trophy size={20} color="#8B5CF6" />
            <Text style={styles.actionButtonText}>View Full Analysis</Text>
            <Zap size={20} color="#8B5CF6" />
          </TouchableOpacity>
        </LinearGradient>
      </View>

      {/* Full Analysis Modal */}
      <Modal
        visible={showAnalysisModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAnalysisModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <LinearGradient
              colors={['#0F172A', '#1E293B', '#334155']}
              style={styles.modalGradient}
            >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Lock size={24} color="#FFD700" />
                <Text style={styles.modalTitle}>Elite Lock Analysis</Text>
              </View>
              <TouchableOpacity 
                onPress={() => setShowAnalysisModal(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {console.log('🔍 Rendering modal content for pick:', lockPick?.id)}
              {/* Match Info */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>🏟️ Match Details</Text>
                <Text style={styles.modalMatchText}>{lockPick.match_teams || 'N/A'}</Text>
                <Text style={styles.modalSportText}>{lockPick.sport || 'MLB'}</Text>
              </View>

              {/* Pick Info */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>🎯 Elite Pick</Text>
                <View style={styles.modalPickRow}>
                  <View style={styles.modalPickItem}>
                    <Text style={styles.modalPickLabel}>SELECTION</Text>
                    <Text style={styles.modalPickValue}>{lockPick.pick || 'N/A'}</Text>
                  </View>
                  <View style={styles.modalPickItem}>
                    <Text style={styles.modalPickLabel}>ODDS</Text>
                    <Text style={styles.modalPickValue}>{lockPick.odds || 'N/A'}</Text>
                  </View>
                </View>
              </View>

              {/* Analytics */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>📊 Elite Analytics</Text>
                <View style={styles.modalAnalyticsGrid}>
                  <View style={styles.modalAnalyticsItem}>
                    <Text style={styles.modalAnalyticsLabel}>Confidence</Text>
                    <Text style={[styles.modalAnalyticsValue, { color: getConfidenceColor(lockPick.confidence || 0) }]}>
                      {lockPick.confidence || 0}%
                    </Text>
                    <Text style={styles.modalAnalyticsSubtext}>{getConfidenceLabel(lockPick.confidence || 0)}</Text>
                  </View>
                  
                  {lockPick.roi_estimate && (
                    <View style={styles.modalAnalyticsItem}>
                      <Text style={styles.modalAnalyticsLabel}>ROI Estimate</Text>
                      <Text style={styles.modalAnalyticsValue}>{lockPick.roi_estimate}</Text>
                      <Text style={styles.modalAnalyticsSubtext}>Expected Return</Text>
                    </View>
                  )}
                  
                  {lockPick.value_percentage && (
                    <View style={styles.modalAnalyticsItem}>
                      <Text style={styles.modalAnalyticsLabel}>Value Edge</Text>
                      <Text style={styles.modalAnalyticsValue}>{lockPick.value_percentage}</Text>
                      <Text style={styles.modalAnalyticsSubtext}>Market Advantage</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Reasoning */}
              {lockPick.reasoning && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>🧠 Elite AI Analysis</Text>
                  <View style={styles.modalReasoningContainer}>
                    <Text style={styles.modalReasoningText}>{lockPick.reasoning}</Text>
                  </View>
                </View>
              )}

              {/* Bet Type */}
              {lockPick.bet_type && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>📋 Bet Classification</Text>
                  <View style={styles.modalBetTypeContainer}>
                    <Text style={styles.modalBetTypeText}>{lockPick.bet_type.toUpperCase()}</Text>
                  </View>
                </View>
              )}

              {/* Bottom Spacing */}
              <View style={{ height: 40 }} />
            </ScrollView>
            </LinearGradient>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  card: {
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  loadingCard: {
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCard: {
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eliteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
  },
  eliteBadgeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eliteBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginHorizontal: 6,
    letterSpacing: 0.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginLeft: 12,
    letterSpacing: 0.5,
  },
  confidenceBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  confidenceText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  modalSection: {
    marginBottom: 24,
  },
  modalSectionTitle: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  modalMatchText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  modalText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.2)',
  },
  modalTitle: {
    color: '#FFD700',
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '600',
  },
  modalGradient: {
    flex: 1,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalSportText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  modalPickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalPickItem: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  modalPickLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
    textAlign: 'center',
  },
  modalPickValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalAnalyticsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalAnalyticsItem: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  modalAnalyticsLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
    textAlign: 'center',
  },
  modalAnalyticsValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalAnalyticsSubtext: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 10,
    fontWeight: '400',
    textAlign: 'center',
    marginTop: 2,
  },
  modalReasoningContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  modalReasoningText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    lineHeight: 20,
  },
  modalBetTypeContainer: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  modalBetTypeText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '600',
  },
  pickDetails: {
    marginBottom: 16,
  },
  matchTeams: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  pickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pickInfo: {
    flex: 1,
    marginRight: 16,
  },
  confidenceLabelText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  oddsInfo: {
    alignItems: 'center',
  },
  pickLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  pickValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  analytics: {
    marginBottom: 16,
  },
  analyticsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  analyticsItem: {
    alignItems: 'center',
    flex: 1,
  },
  analyticsLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
    marginBottom: 2,
  },
  analyticsValue: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  reasoning: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  reasoningLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  reasoningText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    lineHeight: 18,
  },
  actionButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#8B5CF6',
    fontSize: 16,
    fontWeight: '700',
    marginHorizontal: 8,
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default EliteLockOfTheDay;
