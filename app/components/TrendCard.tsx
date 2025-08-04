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
}

export default function TrendCard({ trend, onPress }: TrendCardProps) {
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

        {/* Main trend text */}
        <View style={styles.trendTextSection}>
          <Text style={styles.trendText}>
            {trend.trend_text || trend.description || trend.title || "No trend data available"}
          </Text>
        </View>
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

  trendTextSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: normalize(12),
    padding: normalize(16),
  },
  trendText: {
    fontSize: isTablet ? normalize(16) : normalize(18),
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: isTablet ? normalize(24) : normalize(26),
    textAlign: 'left',
  },
});
