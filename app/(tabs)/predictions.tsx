import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Platform,
  RefreshControl,
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  TrendingUp, 
  Target, 
  Calendar, 
  Filter, 
  BarChart3,
  Clock,
  Zap,
  Eye,
  Star,
  Trophy,
  Activity
} from 'lucide-react-native';
import { aiService, AIPrediction } from '@/app/services/api/aiService';

export default function PredictionsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [predictions, setPredictions] = useState<AIPrediction[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'high' | 'value'>('all');
  const [selectedSport, setSelectedSport] = useState<string>('all');

  useEffect(() => {
    loadPredictions();
  }, []);

  const loadPredictions = async () => {
    setLoading(true);
    try {
      const data = await aiService.getTodaysPicks();
      setPredictions(data);
    } catch (error) {
      console.error('Error loading predictions:', error);
      Alert.alert('Error', 'Failed to load predictions');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPredictions();
    setRefreshing(false);
  };

  const generateNewPredictions = async () => {
    try {
      Alert.alert(
        'Generate New Predictions',
        'This will use our AI to analyze current market conditions and generate fresh predictions. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Generate', 
            onPress: async () => {
              setLoading(true);
              try {
                const newPredictions = await aiService.generateNewPicks();
                setPredictions(newPredictions);
                Alert.alert('Success!', 'New AI predictions generated successfully');
              } catch (error) {
                Alert.alert('Error', 'Failed to generate new predictions');
              } finally {
                setLoading(false);
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error generating predictions:', error);
    }
  };

  const getFilteredPredictions = () => {
    let filtered = predictions;

    if (filterType === 'high') {
      filtered = filtered.filter(p => p.confidence >= 85);
    } else if (filterType === 'value') {
      filtered = filtered.filter(p => (p.value || 0) >= 10);
    }

    if (selectedSport !== 'all') {
      filtered = filtered.filter(p => p.sport.toLowerCase() === selectedSport.toLowerCase());
    }

    return filtered;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 85) return '#10B981';
    if (confidence >= 70) return '#F59E0B';
    return '#EF4444';
  };

  const getSportIcon = (sport: string) => {
    switch (sport.toLowerCase()) {
      case 'nba': return '🏀';
      case 'nfl': return '🏈';
      case 'mlb': return '⚾';
      case 'nhl': return '🏒';
      case 'tennis': return '🎾';
      case 'golf': return '⛳';
      default: return '🏟️';
    }
  };

  const filteredPredictions = getFilteredPredictions();
  const sports = ['all', ...Array.from(new Set(predictions.map(p => p.sport)))];

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#00E5FF"
          colors={['#00E5FF']}
        />
      }
    >
      {/* Header Stats */}
      <LinearGradient
        colors={['#7C3AED', '#1E40AF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerStats}
      >
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Activity size={20} color="#00E5FF" />
            <Text style={styles.statValue}>{predictions.length}</Text>
            <Text style={styles.statLabel}>Total Picks</Text>
          </View>
          
          <View style={styles.statCard}>
            <Target size={20} color="#10B981" />
            <Text style={styles.statValue}>
              {predictions.filter(p => p.confidence >= 85).length}
            </Text>
            <Text style={styles.statLabel}>High Confidence</Text>
          </View>
          
          <View style={styles.statCard}>
            <TrendingUp size={20} color="#F59E0B" />
            <Text style={styles.statValue}>
              {predictions.filter(p => (p.value || 0) >= 10).length}
            </Text>
            <Text style={styles.statLabel}>Value Bets</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Filter Controls */}
      <View style={styles.filterSection}>
        <Text style={styles.filterTitle}>Filter Predictions</Text>
        
        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScrollView}>
            {['all', 'high', 'value'].map(type => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.filterChip,
                  filterType === type && styles.filterChipActive
                ]}
                onPress={() => setFilterType(type as any)}
              >
                <Text style={[
                  styles.filterChipText,
                  filterType === type && styles.filterChipTextActive
                ]}>
                  {type === 'all' ? 'All Picks' : type === 'high' ? 'High Confidence' : 'Value Bets'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScrollView}>
            {sports.map(sport => (
              <TouchableOpacity
                key={sport}
                style={[
                  styles.sportChip,
                  selectedSport === sport && styles.sportChipActive
                ]}
                onPress={() => setSelectedSport(sport)}
              >
                <Text style={[
                  styles.sportChipText,
                  selectedSport === sport && styles.sportChipTextActive
                ]}>
                  {sport === 'all' ? 'All Sports' : `${getSportIcon(sport)} ${sport.toUpperCase()}`}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Generate New Predictions Button */}
      <TouchableOpacity style={styles.generateButton} onPress={generateNewPredictions}>
        <LinearGradient
          colors={['#00E5FF', '#0891B2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.generateGradient}
        >
          <Zap size={20} color="#FFFFFF" />
          <Text style={styles.generateButtonText}>Generate New AI Predictions</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Predictions List */}
      <View style={styles.predictionsSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {filterType === 'all' ? 'All Predictions' : 
             filterType === 'high' ? 'High Confidence Picks' : 
             'Value Bet Opportunities'}
          </Text>
          <Text style={styles.resultCount}>{filteredPredictions.length} results</Text>
        </View>

        {filteredPredictions.length === 0 ? (
          <View style={styles.emptyState}>
            <Trophy size={48} color="#64748B" />
            <Text style={styles.emptyStateTitle}>No predictions found</Text>
            <Text style={styles.emptyStateText}>
              Try adjusting your filters or generate new predictions
            </Text>
          </View>
        ) : (
          <View style={styles.predictionsContainer}>
            {filteredPredictions.map((prediction, index) => (
              <TouchableOpacity key={prediction.id} style={styles.predictionCard}>
                <LinearGradient
                  colors={['#1E293B', '#334155']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.predictionGradient}
                >
                  {/* Header */}
                  <View style={styles.predictionHeader}>
                    <View style={styles.matchInfo}>
                      <Text style={styles.sportBadge}>
                        {getSportIcon(prediction.sport)} {prediction.sport}
                      </Text>
                      <Text style={styles.matchTitle}>{prediction.match}</Text>
                      <Text style={styles.eventTime}>
                        <Clock size={12} color="#94A3B8" /> {prediction.eventTime}
                      </Text>
                    </View>
                    
                    <View style={[
                      styles.confidenceBadge, 
                      { backgroundColor: `${getConfidenceColor(prediction.confidence)}20` }
                    ]}>
                      <Text style={[
                        styles.confidenceText, 
                        { color: getConfidenceColor(prediction.confidence) }
                      ]}>
                        {prediction.confidence}%
                      </Text>
                    </View>
                  </View>

                  {/* Prediction Details */}
                  <View style={styles.predictionContent}>
                    <View style={styles.pickSection}>
                      <Text style={styles.pickLabel}>AI Prediction</Text>
                      <Text style={styles.pickValue}>{prediction.pick}</Text>
                      <Text style={styles.oddsText}>Odds: {prediction.odds}</Text>
                    </View>

                    {prediction.value && prediction.value > 0 && (
                      <View style={styles.valueSection}>
                        <View style={styles.valueIndicator}>
                          <Target size={16} color="#10B981" />
                          <Text style={styles.valueText}>+{prediction.value}% Value</Text>
                        </View>
                        {prediction.roi_estimate && (
                          <Text style={styles.roiText}>
                            Est. ROI: +{prediction.roi_estimate}%
                          </Text>
                        )}
                      </View>
                    )}
                  </View>

                  {/* Reasoning */}
                  <Text style={styles.reasoningText} numberOfLines={3}>
                    <Text style={styles.reasoningLabel}>AI Analysis: </Text>
                    {prediction.reasoning}
                  </Text>

                  {/* Action Buttons */}
                  <View style={styles.actionButtons}>
                    <TouchableOpacity style={styles.viewButton}>
                      <Eye size={16} color="#00E5FF" />
                      <Text style={styles.viewButtonText}>View Analysis</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity style={styles.trackButton}>
                      <Star size={16} color="#F59E0B" />
                      <Text style={styles.trackButtonText}>Track Bet</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Rank Badge */}
                  {index < 3 && (
                    <View style={[
                      styles.rankBadge,
                      index === 0 ? styles.goldRank : 
                      index === 1 ? styles.silverRank : 
                      styles.bronzeRank
                    ]}>
                      <Text style={styles.rankText}>#{index + 1}</Text>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Predictions are generated by our advanced AI models and are for entertainment purposes only.
        </Text>
      </View>
    </ScrollView>
  );
}

const { width } = Dimensions.get('window');
const cardWidth = width > 500 ? width / 2 - 24 : width - 32;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  contentContainer: {
    paddingBottom: 30,
  },
  headerStats: {
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    flex: 1,
    marginHorizontal: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#E2E8F0',
    textAlign: 'center',
  },
  filterSection: {
    padding: 16,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  filterRow: {
    marginBottom: 12,
  },
  filterScrollView: {
    flexDirection: 'row',
  },
  filterChip: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterChipActive: {
    backgroundColor: '#00E5FF',
    borderColor: '#00E5FF',
  },
  filterChipText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#0F172A',
    fontWeight: '600',
  },
  sportChip: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sportChipActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  sportChipText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
  },
  sportChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  generateButton: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  generateGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  predictionsSection: {
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  resultCount: {
    fontSize: 14,
    color: '#94A3B8',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
  predictionsContainer: {
    
  },
  predictionCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  predictionGradient: {
    padding: 20,
  },
  predictionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  matchInfo: {
    flex: 1,
  },
  sportBadge: {
    fontSize: 12,
    color: '#00E5FF',
    fontWeight: '600',
    marginBottom: 4,
  },
  matchTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  eventTime: {
    fontSize: 12,
    color: '#94A3B8',
    flexDirection: 'row',
    alignItems: 'center',
  },
  confidenceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '700',
  },
  predictionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  pickSection: {
    flex: 1,
  },
  pickLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 4,
  },
  pickValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  oddsText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  valueSection: {
    alignItems: 'flex-end',
  },
  valueIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 4,
  },
  valueText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  roiText: {
    fontSize: 11,
    color: '#00E5FF',
    fontWeight: '500',
  },
  reasoningText: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
    marginBottom: 16,
  },
  reasoningLabel: {
    fontWeight: '600',
    color: '#E2E8F0',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
    justifyContent: 'center',
  },
  viewButtonText: {
    color: '#00E5FF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    marginLeft: 8,
    justifyContent: 'center',
  },
  trackButtonText: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  rankBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goldRank: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  silverRank: {
    backgroundColor: 'rgba(192, 192, 192, 0.2)',
    borderWidth: 2,
    borderColor: '#C0C0C0',
  },
  bronzeRank: {
    backgroundColor: 'rgba(205, 127, 50, 0.2)',
    borderWidth: 2,
    borderColor: '#CD7F32',
  },
  rankText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  footer: {
    padding: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
  },
});