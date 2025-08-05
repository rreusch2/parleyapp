import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TrendingUp, ChevronRight, BarChart3, Target } from 'lucide-react-native';
import { supabase } from '../services/api/supabaseClient';
import TrendCard from './TrendCard';
import { router } from 'expo-router';
import { normalize, isTablet } from '../services/device';
import { useSubscription } from '../services/subscriptionContext';

interface HomeTrendsPreviewProps {
  onViewAllTrends?: () => void;
}

export default function HomeTrendsPreview({ onViewAllTrends }: HomeTrendsPreviewProps) {
  const [trends, setTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { subscriptionTier } = useSubscription();

  // Transform trend data to match TrendCard interface
  const transformTrend = (aiTrend: any) => {
    return {
      id: aiTrend.id,
      type: aiTrend.trend_type,
      team: aiTrend.sport,
      title: aiTrend.title,
      description: aiTrend.description,
      trend_text: aiTrend.trend_text,
      headline: aiTrend.headline,
      chart_data: aiTrend.chart_data,
      trend_category: aiTrend.trend_category,
      key_stats: aiTrend.key_stats,
      visual_data: aiTrend.visual_data,
      insight: aiTrend.insight,
      supporting_data: aiTrend.supporting_data,
      full_player_name: aiTrend.full_player_name,
      metadata: aiTrend.metadata,
    };
  };

  const fetchTrendsPreview = async () => {
    setLoading(true);
    try {
      // Get 2 most recent trends (1 player prop, 1 team trend if available)
      const [playerResponse, teamResponse] = await Promise.all([
        supabase
          .from('ai_trends')
          .select('*')
          .eq('trend_type', 'player_prop')
          .eq('is_global', true)
          .eq('sport', 'MLB')
          .order('created_at', { ascending: false })
          .limit(1),
        supabase
          .from('ai_trends')
          .select('*')
          .eq('trend_type', 'team')
          .eq('is_global', true)
          .eq('sport', 'MLB')
          .order('created_at', { ascending: false })
          .limit(1)
      ]);

      if (playerResponse.error) throw playerResponse.error;
      if (teamResponse.error) throw teamResponse.error;

      // Combine and limit to 2 trends
      const allTrends = [
        ...(playerResponse.data || []),
        ...(teamResponse.data || [])
      ].slice(0, 2);

      setTrends(allTrends.map(transformTrend));
    } catch (error) {
      console.error('Error fetching trends preview:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrendsPreview();
  }, []);

  const handleViewAllTrends = () => {
    if (onViewAllTrends) {
      onViewAllTrends();
    } else {
      router.push('/(tabs)/trends');
    }
  };

  const handleTrendPress = (trend: any) => {
    // Could open trend modal here if needed
    router.push('/(tabs)/trends');
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#0F172A', '#1E293B']}
          style={styles.gradient}
        >
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <View style={styles.iconContainer}>
                <TrendingUp size={normalize(20)} color="#00E5FF" />
              </View>
              <Text style={styles.title}>Trending Now</Text>
            </View>
            <Text style={styles.subtitle}>Latest AI trend analysis</Text>
          </View>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00E5FF" />
          </View>
        </LinearGradient>
      </View>
    );
  }

  if (trends.length === 0) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#0F172A', '#1E293B']}
          style={styles.gradient}
        >
          <View style={styles.header}>
            <View style={styles.titleContainer}>
              <View style={styles.iconContainer}>
                <TrendingUp size={normalize(20)} color="#00E5FF" />
              </View>
              <Text style={styles.title}>Trending Now</Text>
            </View>
            <Text style={styles.subtitle}>Latest AI trend analysis</Text>
          </View>
          <View style={styles.noTrendsContainer}>
            <BarChart3 size={normalize(40)} color="#6B7280" />
            <Text style={styles.noTrendsText}>No trends available</Text>
            <Text style={styles.noTrendsSubtext}>Check back soon for fresh insights</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0F172A', '#1E293B']}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <View style={styles.iconContainer}>
              <TrendingUp size={normalize(20)} color="#00E5FF" />
            </View>
            <Text style={styles.title}>Trending Now</Text>
            <View style={styles.liveBadge}>
              <View style={styles.liveIndicator} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          </View>
          <Text style={styles.subtitle}>
            Latest AI trend analysis • {trends.length} insight{trends.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Trend Cards */}
        <View style={styles.trendsContainer}>
          {trends.map((trend, index) => (
            <View key={trend.id} style={[styles.trendWrapper, index === 1 && styles.lastTrendCard]}>
              <TrendCard 
                trend={trend} 
                onPress={() => handleTrendPress(trend)}
                onViewFullTrend={() => handleTrendPress(trend)}
              />
            </View>
          ))}
        </View>

        {/* View All Trends Button */}
        <TouchableOpacity style={styles.viewAllButton} onPress={handleViewAllTrends}>
          <LinearGradient
            colors={['#00E5FF', '#0891B2']}
            style={styles.viewAllGradient}
          >
            <Target size={normalize(18)} color="#0F172A" />
            <Text style={styles.viewAllText}>View All Trends</Text>
            <ChevronRight size={normalize(18)} color="#0F172A" />
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.trendsStats}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{trends.filter(t => t.type === 'player_prop').length}</Text>
            <Text style={styles.statLabel}>Player Props</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{trends.filter(t => t.type === 'team').length}</Text>
            <Text style={styles.statLabel}>Team Trends</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>MLB</Text>
            <Text style={styles.statLabel}>Baseball</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: normalize(16),
    marginBottom: normalize(24),
    borderRadius: normalize(20),
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  gradient: {
    padding: normalize(20),
  },
  header: {
    marginBottom: normalize(20),
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: normalize(8),
  },
  iconContainer: {
    width: normalize(36),
    height: normalize(36),
    borderRadius: normalize(18),
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: normalize(12),
  },
  title: {
    fontSize: normalize(22),
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    paddingHorizontal: normalize(8),
    paddingVertical: normalize(4),
    borderRadius: normalize(12),
  },
  liveIndicator: {
    width: normalize(6),
    height: normalize(6),
    borderRadius: normalize(3),
    backgroundColor: '#22C55E',
    marginRight: normalize(4),
  },
  liveText: {
    fontSize: normalize(10),
    fontWeight: '700',
    color: '#22C55E',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: normalize(14),
    color: '#94A3B8',
    fontWeight: '500',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: normalize(40),
  },
  noTrendsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: normalize(40),
  },
  noTrendsText: {
    fontSize: normalize(16),
    color: '#6B7280',
    fontWeight: '600',
    marginTop: normalize(12),
  },
  noTrendsSubtext: {
    fontSize: normalize(14),
    color: '#6B7280',
    marginTop: normalize(4),
    fontStyle: 'italic',
  },
  trendsContainer: {
    marginBottom: normalize(20),
  },
  trendWrapper: {
    marginBottom: normalize(16),
  },
  lastTrendCard: {
    marginBottom: 0,
  },
  viewAllButton: {
    borderRadius: normalize(12),
    overflow: 'hidden',
    marginBottom: normalize(16),
  },
  viewAllGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: normalize(16),
    paddingHorizontal: normalize(24),
  },
  viewAllText: {
    fontSize: normalize(16),
    fontWeight: '700',
    color: '#0F172A',
    marginHorizontal: normalize(8),
  },
  trendsStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: normalize(12),
    paddingVertical: normalize(12),
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: normalize(18),
    fontWeight: '700',
    color: '#00E5FF',
    marginBottom: normalize(2),
  },
  statLabel: {
    fontSize: normalize(11),
    color: '#94A3B8',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: normalize(30),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});