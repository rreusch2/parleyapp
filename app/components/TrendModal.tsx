import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  TrendingUp,
  TrendingDown,
  Target,
  Trophy,
  BarChart3,
} from 'lucide-react-native';
import { normalize, isTablet } from '../services/device';

interface TrendModalProps {
  visible: boolean;
  trend: any;
  onClose: () => void;
}

const { width: screenWidth } = Dimensions.get('window');

export default function TrendModal({ visible, trend, onClose }: TrendModalProps) {
  // Early return for safety
  if (!trend) return null;

  const getSportIcon = (sport?: string) => {
    if (!sport) return '🏟️';
    switch (sport.toLowerCase()) {
      case 'nba': return '🏀';
      case 'nfl': return '🏈';
      case 'mlb': return '⚾';
      case 'nhl': return '🏒';
      default: return '🏟️';
    }
  };

  const getTrendIcon = () => {
    if (trend.type === 'player_prop') {
      return <Target size={normalize(20)} color="#00E5FF" />;
    } else {
      return <Trophy size={normalize(20)} color="#F59E0B" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'streak': return '#22C55E';
      case 'form': return '#3B82F6';
      case 'matchup': return '#F59E0B';
      case 'performance': return '#8B5CF6';
      case 'injury_impact': return '#EF4444';
      default: return '#00E5FF';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <LinearGradient
        colors={['#0F172A', '#1E293B', '#334155']}
        style={styles.gradientContainer}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {getTrendIcon()}
              <View style={styles.headerText}>
                <Text style={styles.title} numberOfLines={2}>
                  {trend.title || trend.description || 'Trend Analysis'}
                </Text>
                <Text style={styles.subtitle}>
                  {getSportIcon(trend.sport)} {trend.sport?.toUpperCase() || 'SPORTS'} • {trend.category || 'ANALYSIS'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={normalize(24)} color="#E2E8F0" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Trend Summary */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <Text style={styles.summaryTitle}>Trend Summary</Text>
                <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(trend.category) }]}>
                  <Text style={styles.categoryText}>{trend.category?.toUpperCase() || 'ANALYSIS'}</Text>
                </View>
              </View>
              
              <Text style={styles.description}>
                {trend.description || trend.insight || 'Detailed trend analysis for this player/team performance.'}
              </Text>

              {trend.confidence && (
                <View style={styles.confidenceContainer}>
                  <Text style={styles.confidenceLabel}>Confidence Level</Text>
                  <View style={styles.confidenceBar}>
                    <View 
                      style={[
                        styles.confidenceFill, 
                        { width: `${trend.confidence}%`, backgroundColor: getCategoryColor(trend.category) }
                      ]} 
                    />
                  </View>
                  <Text style={styles.confidenceText}>{trend.confidence}%</Text>
                </View>
              )}
            </View>

            {/* Player/Team Info */}
            {(trend.player_name || trend.team_name || trend.full_player_name) && (
              <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>
                  {trend.type === 'player_prop' ? 'Player Information' : 'Team Information'}
                </Text>
                <Text style={styles.infoText}>
                  {trend.full_player_name || trend.player_name || trend.team_name}
                </Text>
                {trend.team && (
                  <Text style={styles.infoSubtext}>Team: {trend.team}</Text>
                )}
              </View>
            )}

            {/* Chart Placeholder */}
            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <BarChart3 size={normalize(20)} color="#00E5FF" />
                <Text style={styles.chartTitle}>Performance Data</Text>
              </View>
              <View style={styles.chartPlaceholder}>
                <BarChart3 size={normalize(48)} color="#64748B" />
                <Text style={styles.chartPlaceholderText}>Chart data will be displayed here</Text>
                <Text style={styles.chartPlaceholderSubtext}>
                  Detailed performance metrics and trends
                </Text>
              </View>
            </View>

            {/* Additional Insights */}
            {trend.metadata && (
              <View style={styles.metadataCard}>
                <Text style={styles.metadataTitle}>Additional Details</Text>
                <View style={styles.metadataContent}>
                  {Object.entries(trend.metadata).map(([key, value]) => (
                    <View key={key} style={styles.metadataRow}>
                      <Text style={styles.metadataKey}>{key.replace(/_/g, ' ').toUpperCase()}:</Text>
                      <Text style={styles.metadataValue}>{String(value)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: normalize(20),
    paddingBottom: normalize(20),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.1)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerText: {
    marginLeft: normalize(12),
    flex: 1,
  },
  title: {
    fontSize: normalize(20),
    fontWeight: '700',
    color: '#E2E8F0',
    marginBottom: normalize(4),
  },
  subtitle: {
    fontSize: normalize(14),
    color: '#94A3B8',
    fontWeight: '500',
  },
  closeButton: {
    padding: normalize(8),
    borderRadius: normalize(20),
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
  },
  content: {
    flex: 1,
    paddingHorizontal: normalize(20),
    paddingTop: normalize(20),
  },
  summaryCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: normalize(16),
    padding: normalize(20),
    marginBottom: normalize(16),
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: normalize(12),
  },
  summaryTitle: {
    fontSize: normalize(18),
    fontWeight: '600',
    color: '#E2E8F0',
  },
  categoryBadge: {
    paddingHorizontal: normalize(12),
    paddingVertical: normalize(6),
    borderRadius: normalize(12),
  },
  categoryText: {
    fontSize: normalize(12),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  description: {
    fontSize: normalize(16),
    color: '#CBD5E1',
    lineHeight: normalize(24),
    marginBottom: normalize(16),
  },
  confidenceContainer: {
    marginTop: normalize(8),
  },
  confidenceLabel: {
    fontSize: normalize(14),
    color: '#94A3B8',
    marginBottom: normalize(8),
  },
  confidenceBar: {
    height: normalize(8),
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
    borderRadius: normalize(4),
    marginBottom: normalize(8),
  },
  confidenceFill: {
    height: '100%',
    borderRadius: normalize(4),
  },
  confidenceText: {
    fontSize: normalize(14),
    color: '#E2E8F0',
    fontWeight: '600',
    textAlign: 'right',
  },
  infoCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: normalize(16),
    padding: normalize(20),
    marginBottom: normalize(16),
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
  },
  infoTitle: {
    fontSize: normalize(16),
    fontWeight: '600',
    color: '#E2E8F0',
    marginBottom: normalize(8),
  },
  infoText: {
    fontSize: normalize(18),
    color: '#00E5FF',
    fontWeight: '700',
    marginBottom: normalize(4),
  },
  infoSubtext: {
    fontSize: normalize(14),
    color: '#94A3B8',
  },
  chartCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: normalize(16),
    padding: normalize(20),
    marginBottom: normalize(16),
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: normalize(16),
  },
  chartTitle: {
    fontSize: normalize(16),
    fontWeight: '600',
    color: '#E2E8F0',
    marginLeft: normalize(8),
  },
  chartPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: normalize(40),
  },
  chartPlaceholderText: {
    fontSize: normalize(16),
    color: '#64748B',
    marginTop: normalize(12),
    fontWeight: '500',
  },
  chartPlaceholderSubtext: {
    fontSize: normalize(14),
    color: '#475569',
    marginTop: normalize(4),
  },
  metadataCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: normalize(16),
    padding: normalize(20),
    marginBottom: normalize(20),
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
  },
  metadataTitle: {
    fontSize: normalize(16),
    fontWeight: '600',
    color: '#E2E8F0',
    marginBottom: normalize(12),
  },
  metadataContent: {
    gap: normalize(8),
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metadataKey: {
    fontSize: normalize(14),
    color: '#94A3B8',
    fontWeight: '500',
    flex: 1,
  },
  metadataValue: {
    fontSize: normalize(14),
    color: '#E2E8F0',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
});
