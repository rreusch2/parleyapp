
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Dimensions,
  Platform,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  TrendingUp,
  TrendingDown,
  Target,
  Trophy,
  BarChart3,
  Calendar,
  Star,
  Activity,
  Award,
} from 'lucide-react-native';
import { BarChart } from 'react-native-chart-kit';
import { normalize, isTablet } from '../services/device';
import Constants from 'expo-constants';

interface TrendModalProps {
  visible: boolean;
  trend: any;
  onClose: () => void;
}

const { width: screenWidth } = Dimensions.get('window');

export default function TrendModal({ visible, trend, onClose }: TrendModalProps) {
  const [trendData, setTrendData] = useState(trend);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrendDetails = async () => {
      if (visible && trend?.id) {
        try {
          const apiUrl = Constants.expoConfig?.extra?.apiUrl;
          if (!apiUrl) {
            throw new Error('API URL not configured');
          }
          const response = await fetch(`${apiUrl}/trends?trendId=${trend.id}`);
          if (!response.ok) {
            throw new Error('Failed to fetch trend details');
          }
          const data = await response.json();
          setTrendData(data);
        } catch (err) {
          setError(err.message);
        }
      }
    };

    fetchTrendDetails();
  }, [visible, trend]);

  if (!trendData) return null;

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
    if (trendData.type === 'player_prop') {
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

  const renderChart = () => {
    const { chart_data, visual_data, prop_line } = trendData;
    
    if (!chart_data?.recent_games || chart_data.recent_games.length === 0) {
      return (
        <View style={styles.noChartContainer}>
          <BarChart3 size={normalize(40)} color="#6B7280" />
          <Text style={styles.noChartText}>No performance data available</Text>
          <Text style={styles.noChartSubtext}>Check back after more games are played</Text>
        </View>
      );
    }

    try {
      const recentGames = chart_data.recent_games.slice(-8).reverse();
      const propKey = Object.keys(recentGames[0]).find(key => key !== 'date' && key !== 'opponent' && key !== 'game_number');
      
      const labels = recentGames.map((game: any) => game.opponent || game.date);
      const values = recentGames.map((game: any) => game[propKey] || 0);

      const yAxisLabel = visual_data?.y_axis || propKey?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Value';
      const chartTitle = `${trendData.full_player_name} - Recent ${yAxisLabel}`;

      const maxValue = Math.max(...values, prop_line || 0);
      const yAxisMax = chart_data.y_axis_max || Math.ceil(maxValue) + 1;
      const yAxisIntervals = chart_data.y_axis_intervals || [0, 1, 2, 3, 4, 5];

      const barColors = values.map(v => {
        if (prop_line === undefined || prop_line === null) {
          return (opacity = 1) => `rgba(59, 130, 246, ${opacity})`; // Default blue
        }
        if (v > prop_line) {
          return (opacity = 1) => `rgba(34, 197, 94, ${opacity})`; // Green for 'Over'
        } else if (v < prop_line) {
          return (opacity = 1) => `rgba(239, 68, 68, ${opacity})`; // Red for 'Under'
        } else {
          return (opacity = 1) => `rgba(148, 163, 184, ${opacity})`; // Grey for 'Push'
        }
      });

      const data = {
        labels,
        datasets: [{
          data: values,
          colors: barColors,
        }],
      };

      const chartConfig = {
        backgroundColor: 'transparent',
        backgroundGradientFrom: 'rgba(15, 23, 42, 0.8)',
        backgroundGradientTo: 'rgba(30, 41, 59, 0.8)',
        decimalPlaces: 0,
        color: (opacity = 1) => `rgba(226, 232, 240, ${opacity})`,
        labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
        style: {
          borderRadius: 16,
        },
        propsForBackgroundLines: {
          strokeDasharray: '',
          strokeOpacity: 0.1,
        },
        fromZero: true,
        segments: yAxisIntervals.length - 1,
      };

      return (
        <View>
          <Text style={styles.chartTitle}>{chartTitle}</Text>
          <Text style={styles.chartSubtitle}>Last {recentGames.length} Games • {yAxisLabel}</Text>
          <BarChart
            data={data}
            width={screenWidth - 80}
            height={220}
            chartConfig={chartConfig}
            style={styles.chart}
            showValuesOnTopOfBars
            fromZero
            verticalLabelRotation={30}
            withCustomBarColorFromData
            flatColor
            decorator={() => {
                if (prop_line === undefined || prop_line === null) return null;
                const propLineY = 220 - ((prop_line / yAxisMax) * 180) - 20;

                return (
                  <View style={{ position: 'absolute', top: propLineY, left: 40, right: 10 }}>
                    <View style={styles.propLine} />
                    <Text style={styles.propLineLabel}>Line: {prop_line}</Text>
                  </View>
                );
            }}
            onDataPointClick={({ value, index }) => {
                const game = recentGames[index];
                alert(
                  `${trendData.full_player_name} vs ${game.opponent || game.date}\n` +
                  `${yAxisLabel}: ${value}`
                );
            }}
          />
        </View>
      );
    } catch (error) {
      console.error('Chart rendering error:', error);
      return (
        <View style={styles.noChartContainer}>
          <BarChart3 size={normalize(40)} color="#6B7280" />
          <Text style={styles.noChartText}>Unable to render chart</Text>
          <Text style={styles.noChartSubtext}>Data format may be incompatible</Text>
        </View>
      );
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <LinearGradient
          colors={['rgba(30, 41, 59, 0.9)', 'rgba(15, 23, 42, 0.95)']}
          style={styles.modalContent}
        >
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={normalize(24)} color="#94A3B8" />
          </TouchableOpacity>
          <ScrollView>
            <View style={styles.header}>
              {getTrendIcon()}
              <Text style={styles.title}>{trendData.title}</Text>
              <Text style={styles.sportIcon}>{getSportIcon(trendData.sport)}</Text>
            </View>
            <Text style={styles.description}>{trendData.description}</Text>
            
            <View style={styles.infoRow}>
                <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(trendData.trend_category) }]}>
                    <Text style={styles.categoryText}>{trendData.trend_category}</Text>
                </View>
                <View style={styles.confidenceBadge}>
                    <TrendingUp size={normalize(14)} color="#22C55E" />
                    <Text style={styles.confidenceText}>{trendData.confidence_score}% Confidence</Text>
                </View>
            </View>

            {renderChart()}

            <View style={styles.statsContainer}>
              <Text style={styles.statsTitle}>Key Stats</Text>
              {trendData.key_stats && Object.entries(trendData.key_stats).map(([key, value]) => (
                <View key={key} style={styles.statRow}>
                  <Text style={styles.statKey}>{key}</Text>
                  <Text style={styles.statValue}>{String(value)}</Text>
                </View>
              ))}
            </View>
            
            <View style={styles.insightContainer}>
              <Text style={styles.insightTitle}>Analyst's Insight</Text>
              <Text style={styles.insightText}>{trendData.insight}</Text>
            </View>

          </ScrollView>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    modalContent: {
        width: screenWidth - 40,
        maxHeight: '85%',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    closeButton: {
        position: 'absolute',
        top: 15,
        right: 15,
        zIndex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    title: {
        fontSize: normalize(20),
        fontWeight: 'bold',
        color: '#F1F5F9',
        marginLeft: 10,
        flex: 1,
    },
    sportIcon: {
        fontSize: normalize(20),
    },
    description: {
        fontSize: normalize(14),
        color: '#94A3B8',
        marginBottom: 15,
    },
    infoRow: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    categoryBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 15,
        marginRight: 10,
    },
    categoryText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: normalize(12),
    },
    confidenceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 15,
    },
    confidenceText: {
        color: '#22C55E',
        fontWeight: 'bold',
        marginLeft: 5,
        fontSize: normalize(12),
    },
    chartTitle: {
        fontSize: normalize(16),
        fontWeight: 'bold',
        color: '#F1F5F9',
        textAlign: 'center',
    },
    chartSubtitle: {
        fontSize: normalize(12),
        color: '#94A3B8',
        textAlign: 'center',
        marginBottom: 10,
    },
    chart: {
        borderRadius: 16,
        marginVertical: 8,
    },
    noChartContainer: {
        height: 220,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        borderRadius: 16,
        marginVertical: 8,
    },
    noChartText: {
        marginTop: 10,
        fontSize: normalize(16),
        color: '#94A3B8',
        fontWeight: 'bold',
    },
    noChartSubtext: {
        fontSize: normalize(12),
        color: '#6B7280',
    },
    statsContainer: {
        marginTop: 20,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        borderRadius: 16,
        padding: 15,
    },
    statsTitle: {
        fontSize: normalize(18),
        fontWeight: 'bold',
        color: '#F1F5F9',
        marginBottom: 10,
    },
    statRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    statKey: {
        fontSize: normalize(14),
        color: '#94A3B8',
    },
    statValue: {
        fontSize: normalize(14),
        color: '#F1F5F9',
        fontWeight: 'bold',
    },
    insightContainer: {
        marginTop: 20,
        backgroundColor: 'rgba(30, 41, 59, 0.8)',
        borderRadius: 16,
        padding: 15,
    },
    insightTitle: {
        fontSize: normalize(18),
        fontWeight: 'bold',
        color: '#00E5FF',
        marginBottom: 10,
    },
    insightText: {
        fontSize: normalize(14),
        color: '#E2E8F0',
        lineHeight: 20,
    },
    propLine: {
        height: 1,
        width: '100%',
        backgroundColor: '#A5B4FC',
    },
    propLineLabel: {
        position: 'absolute',
        top: -18,
        left: 0,
        color: '#A5B4FC',
        backgroundColor: 'rgba(30, 41, 59, 0.8)',
        paddingHorizontal: 4,
        fontSize: normalize(10),
    },
});
