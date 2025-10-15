import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  TrendingUp, 
  Target, 
  Trophy, 
  Clock,
  CheckCircle
} from 'lucide-react-native';
import { normalize, isTablet } from '../services/device';

interface TrendData {
  id: string;
  type: 'player_prop' | 'team';
  team?: string;
  title?: string;
  description?: string;
  trend_text?: string;
  headline?: string;
  chart_data?: any;
  trend_category?: string;
  key_stats?: any;
  visual_data?: any;
  insight?: string;
  supporting_data?: string;
}

interface RecentGame {
  date: string;
  opponent: string;
  line: number;
  actual_value: number;
  result: 'over' | 'under' | 'hit' | 'cover';
  margin: number;
}

interface TrendCardProps {
  trend: TrendData;
  onPress?: () => void;
  onViewFullTrend?: () => void;
}

export default function TrendCard({ trend, onPress, onViewFullTrend }: TrendCardProps) {
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

  const getTrendTypeIcon = () => {
    if (trend.type === 'player_prop') {
      return <Target size={normalize(16)} color="#00E5FF" />;
    } else {
      return <Trophy size={normalize(16)} color="#F59E0B" />;
    }
  };

  return (
    <TouchableOpacity 
      style={styles.container} 
      activeOpacity={0.8}
      onPress={onPress}
    >
      <LinearGradient
        colors={['#00E5FF', '#1E40AF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Header with sport and type indicator */}
        <View style={styles.header}>
          <View style={styles.leftSection}>
            <Text style={styles.sportIcon}>{getSportIcon(trend.team)}</Text>
            <View style={styles.typeIndicator}>
              {getTrendTypeIcon()}
              <Text style={styles.typeText}>
                {trend.type === 'player_prop' ? 'Player Prop' : 'Team Trend'}
              </Text>
            </View>
          </View>
        </View>

        {/* Headline Section */}
        <View style={styles.headlineSection}>
          <Text style={styles.headline}>
            {trend.headline || trend.title || "Trend Analysis"}
          </Text>
          {trend.trend_category && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{trend.trend_category.toUpperCase()}</Text>
            </View>
          )}
        </View>

        {/* Brief trend text */}
        <View style={styles.trendTextSection}>
          <Text style={styles.trendText} numberOfLines={3}>
            {trend.trend_text || trend.description || "No trend data available"}
          </Text>
        </View>

        {/* View Full Trend Button */}
        <TouchableOpacity 
          style={styles.viewFullButton}
          onPress={onViewFullTrend}
          activeOpacity={0.8}
        >
          <Text style={styles.viewFullButtonText}>View Full Trend</Text>
          <TrendingUp size={normalize(16)} color="#00E5FF" />
        </TouchableOpacity>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: normalize(16),
    marginVertical: normalize(8),
    borderRadius: normalize(16),
    overflow: 'hidden',
    shadowColor: '#00E5FF',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  gradient: {
    padding: isTablet ? normalize(24) : normalize(20),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: normalize(16),
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sportIcon: {
    fontSize: normalize(24),
    marginRight: normalize(12),
  },
  typeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: normalize(20),
    paddingHorizontal: normalize(12),
    paddingVertical: normalize(6),
  },
  typeText: {
    fontSize: normalize(12),
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: normalize(6),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  headlineSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: normalize(12),
  },
  headline: {
    fontSize: normalize(20),
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    lineHeight: normalize(24),
  },
  categoryBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: normalize(8),
    paddingVertical: normalize(4),
    borderRadius: normalize(12),
    marginLeft: normalize(8),
  },
  categoryText: {
    fontSize: normalize(10),
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  trendTextSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: normalize(12),
    padding: normalize(14),
    marginBottom: normalize(12),
  },
  trendText: {
    fontSize: normalize(14),
    fontWeight: '500',
    color: '#E0F2FE',
    lineHeight: normalize(20),
    textAlign: 'left',
  },
  viewFullButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: normalize(10),
    paddingVertical: normalize(10),
    paddingHorizontal: normalize(16),
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
  },
  viewFullButtonText: {
    fontSize: normalize(13),
    fontWeight: '600',
    color: '#00E5FF',
    marginRight: normalize(6),
    letterSpacing: 0.3,
  },
});
