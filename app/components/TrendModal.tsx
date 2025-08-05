import React from 'react';
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
import { LineChart, BarChart } from 'react-native-chart-kit';
import { normalize, isTablet } from '../services/device';

interface TrendModalProps {
  visible: boolean;
  trend: any;
  onClose: () => void;
}

const { width: screenWidth } = Dimensions.get('window');

export default function TrendModal({ visible, trend, onClose }: TrendModalProps) {
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

  const renderChart = () => {
    const chartData = trend.chart_data;
    const visualData = trend.visual_data;
    
    if (!chartData?.recent_games || chartData.recent_games.length === 0) {
      return (
        <View style={styles.noChartContainer}>
          <BarChart3 size={normalize(40)} color="#6B7280" />
          <Text style={styles.noChartText}>No performance data available</Text>
          <Text style={styles.noChartSubtext}>Check back after more games are played</Text>
        </View>
      );
    }

    try {
      // Prepare data for the chart - limit to last 8 games for readability
      const recentGames = chartData.recent_games.slice(-8);
      
      // Create meaningful labels based on available data
      const labels = recentGames.map((game: any, index: number) => {
        if (game.opponent) {
          return `vs ${game.opponent}`;
        } else if (game.date) {
          const date = new Date(game.date);
          return `${date.getMonth() + 1}/${date.getDate()}`;
        } else {
          return `Game ${recentGames.length - index}`;
        }
      });
      
      let datasets = [];
      let yAxisLabel = '';
      let chartTitle = '';
      let maxValue = 0;
      let isDecimalData = false;
      
      if (trend.type === 'player_prop') {
        // Determine what stat to show based on available data
        let values = [];
        
        if (recentGames[0]?.hits !== undefined) {
          values = recentGames.map((game: any) => game.hits || 0);
          yAxisLabel = 'Hits';
          chartTitle = `${trend.full_player_name || 'Player'} - Recent Hits`;
        } else if (recentGames[0]?.rbis !== undefined) {
          values = recentGames.map((game: any) => game.rbis || 0);
          yAxisLabel = 'RBIs';
          chartTitle = `${trend.full_player_name || 'Player'} - Recent RBIs`;
        } else if (recentGames[0]?.runs !== undefined) {
          values = recentGames.map((game: any) => game.runs || 0);
          yAxisLabel = 'Runs';
          chartTitle = `${trend.full_player_name || 'Player'} - Recent Runs`;
        } else if (recentGames[0]?.ba !== undefined) {
          values = recentGames.map((game: any) => parseFloat(game.ba) || 0);
          yAxisLabel = 'Batting Avg';
          chartTitle = `${trend.full_player_name || 'Player'} - Batting Average`;
          isDecimalData = true;
        } else {
          values = recentGames.map((game: any) => game.value || 0);
          yAxisLabel = 'Performance';
          chartTitle = `${trend.full_player_name || 'Player'} - Performance`;
        }
        
        maxValue = Math.max(...values);
        
        datasets = [{
          data: values.length > 0 ? values : [0],
          color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})`, // Green
          strokeWidth: 3,
        }];
      } else {
        // Team trends
        let values = [];
        
        if (recentGames[0]?.runs !== undefined) {
          values = recentGames.map((game: any) => game.runs || 0);
          yAxisLabel = 'Runs';
          chartTitle = 'Team Runs Per Game';
        } else if (recentGames[0]?.ba !== undefined) {
          values = recentGames.map((game: any) => parseFloat(game.ba) || 0);
          yAxisLabel = 'Team BA';
          chartTitle = 'Team Batting Average';
          isDecimalData = true;
        } else if (recentGames[0]?.home_runs !== undefined) {
          values = recentGames.map((game: any) => game.home_runs || 0);
          yAxisLabel = 'Home Runs';
          chartTitle = 'Team Home Runs';
        } else {
          values = recentGames.map((game: any) => game.value || 0);
          yAxisLabel = 'Performance';
          chartTitle = 'Team Performance';
        }
        
        maxValue = Math.max(...values);
        
        datasets = [{
          data: values.length > 0 ? values : [0],
          color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`, // Blue
          strokeWidth: 3,
        }];
      }

      const data = {
        labels,
        datasets,
      };

      const chartConfig = {
        backgroundColor: 'transparent',
        backgroundGradientFrom: 'rgba(15, 23, 42, 0.8)',
        backgroundGradientTo: 'rgba(30, 41, 59, 0.8)',
        decimalPlaces: isDecimalData ? 3 : 0,
        color: (opacity = 1) => `rgba(226, 232, 240, ${opacity})`,
        labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
        style: {
          borderRadius: 16,
        },
        propsForDots: {
          r: '5',
          strokeWidth: '2',
          stroke: visualData?.trend_color || '#00E5FF',
          fill: visualData?.trend_color || '#00E5FF',
        },
        propsForBackgroundLines: {
          strokeDasharray: '', // solid lines
          strokeOpacity: 0.1,
        },
        // Adjust Y-axis range for better visibility
        fromZero: !isDecimalData,
        segments: 4,
      };

      if (visualData?.chart_type === 'bar') {
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
              fromZero={!isDecimalData}
              verticalLabelRotation={30}
            />
          </View>
        );
      } else {
        return (
          <View>
            <Text style={styles.chartTitle}>{chartTitle}</Text>
            <Text style={styles.chartSubtitle}>Last {recentGames.length} Games • {yAxisLabel}</Text>
            <LineChart
              data={data}
              width={screenWidth - 80}
              height={220}
              chartConfig={chartConfig}
              style={styles.chart}
              bezier
              withInnerLines={true}
              withOuterLines={true}
              withVerticalLines={true}
              withHorizontalLines={true}
            />
          </View>
        );
      }
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

  const renderKeyStats = () => {
    const keyStats = trend.key_stats;
    if (!keyStats || Object.keys(keyStats).length === 0) return null;

    return (
      <View style={styles.keyStatsContainer}>
        <View style={styles.sectionHeader}>
          <Activity size={normalize(20)} color="#00E5FF" />
          <Text style={styles.sectionTitle}>Key Statistics</Text>
        </View>
        <View style={styles.statsGrid}>
          {Object.entries(keyStats).map(([key, value]) => {
            // Format the value based on its type
            let formattedValue = String(value);
            if (typeof value === 'number') {
              if (key.includes('ba') || key.includes('avg') || key.includes('rate')) {
                formattedValue = value < 1 ? value.toFixed(3) : value.toString();
              } else {
                formattedValue = value.toString();
              }
            }

            return (
              <View key={key} style={styles.statItem}>
                <Text style={styles.statLabel}>
                  {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Text>
                <Text style={styles.statValue}>{formattedValue}</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderTrendMetrics = () => {
    const chartData = trend.chart_data;
    if (!chartData) return null;

    return (
      <View style={styles.metricsContainer}>
        <View style={styles.sectionHeader}>
          <TrendingUp size={normalize(20)} color="#22C55E" />
          <Text style={styles.sectionTitle}>Trend Metrics</Text>
        </View>
        <View style={styles.metricsGrid}>
          {chartData.success_rate && (
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Success Rate</Text>
              <Text style={[styles.metricValue, { color: chartData.success_rate >= 70 ? '#22C55E' : '#F59E0B' }]}>
                {chartData.success_rate}%
              </Text>
            </View>
          )}
          {chartData.trend_direction && (
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Trend</Text>
              <View style={styles.trendIndicator}>
                {chartData.trend_direction === 'up' ? (
                  <TrendingUp size={normalize(16)} color="#22C55E" />
                ) : chartData.trend_direction === 'down' ? (
                  <TrendingDown size={normalize(16)} color="#EF4444" />
                ) : (
                  <Activity size={normalize(16)} color="#F59E0B" />
                )}
                <Text style={[
                  styles.metricValue, 
                  { color: chartData.trend_direction === 'up' ? '#22C55E' : chartData.trend_direction === 'down' ? '#EF4444' : '#F59E0B' }
                ]}>
                  {chartData.trend_direction.charAt(0).toUpperCase() + chartData.trend_direction.slice(1)}
                </Text>
              </View>
            </View>
          )}
          {chartData.performance_increase && (
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Performance Change</Text>
              <Text style={[styles.metricValue, { color: chartData.performance_increase.includes('+') ? '#22C55E' : '#F59E0B' }]}>
                {chartData.performance_increase}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      transparent={Platform.OS === 'web'}
    >
      {Platform.OS === 'web' ? (
        <Pressable 
          style={styles.modalOverlay} 
          onPress={onClose}
        >
          <Pressable 
            style={styles.modalContent} 
            onPress={(e) => e.stopPropagation()}
          >
            <LinearGradient
              colors={['#0F172A', '#1E293B']}
              style={styles.container}
            >
              {renderModalContent()}
            </LinearGradient>
          </Pressable>
        </Pressable>
      ) : (
        <LinearGradient
          colors={['#0F172A', '#1E293B']}
          style={styles.container}
        >
          {renderModalContent()}
        </LinearGradient>
      )}
    </Modal>
  );

  function renderModalContent() {
    return (
      <>
        {/* Header */}
        <View style={styles.header}>
          <Pressable 
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.closeButtonPressed,
              Platform.OS === 'web' && styles.closeButtonWeb
            ]} 
            onPress={onClose}
            accessible={true}
            accessibilityLabel="Close modal"
            accessibilityRole="button"
          >
            <X size={normalize(24)} color="#FFFFFF" />
          </Pressable>
          <View style={styles.headerInfo}>
            <Text style={styles.sportIcon}>{getSportIcon(trend.team)}</Text>
            <View style={styles.typeIndicator}>
              {getTrendIcon()}
              <Text style={styles.typeText}>
                {trend.type === 'player_prop' ? 'Player Prop' : 'Team Trend'}
              </Text>
            </View>
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Title and Category */}
          <View style={styles.titleSection}>
            <Text style={styles.title}>{trend.headline || trend.title}</Text>
            {trend.trend_category && (
              <View 
                style={[
                  styles.categoryBadge, 
                  { backgroundColor: getCategoryColor(trend.trend_category) }
                ]}
              >
                <Text style={styles.categoryText}>
                  {trend.trend_category.toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {/* Player Name (if applicable) */}
          {trend.full_player_name && (
            <View style={styles.playerSection}>
              <Award size={normalize(16)} color="#F59E0B" />
              <Text style={styles.playerName}>{trend.full_player_name}</Text>
            </View>
          )}

          {/* Main Description */}
          <View style={styles.descriptionSection}>
            <Text style={styles.description}>
              {trend.trend_text || trend.description}
            </Text>
          </View>

          {/* Chart Section */}
          <View style={styles.chartSection}>
            <View style={styles.chartHeader}>
              <BarChart3 size={normalize(20)} color="#00E5FF" />
              <Text style={styles.sectionTitle}>Performance Trend</Text>
            </View>
            {renderChart()}
          </View>

          {/* Trend Metrics */}
          {renderTrendMetrics()}

          {/* Key Statistics */}
          {renderKeyStats()}

          {/* Insight */}
          {trend.insight && (
            <View style={styles.insightSection}>
              <View style={styles.insightHeader}>
                <Star size={normalize(20)} color="#F59E0B" />
                <Text style={styles.insightTitle}>Expert Insight</Text>
              </View>
              <Text style={styles.insightText}>{trend.insight}</Text>
            </View>
          )}

          {/* Supporting Data */}
          {trend.supporting_data && (
            <View style={styles.supportingSection}>
              <View style={styles.supportingHeader}>
                <Activity size={normalize(20)} color="#8B5CF6" />
                <Text style={styles.supportingTitle}>Supporting Data</Text>
              </View>
              <Text style={styles.supportingText}>{trend.supporting_data}</Text>
            </View>
          )}
        </ScrollView>
      </>
    );
  }
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: normalize(20),
  },
  modalContent: {
    width: '100%',
    maxWidth: normalize(800),
    height: '90%',
    borderRadius: normalize(20),
    overflow: 'hidden',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: normalize(20),
    paddingTop: normalize(60),
    paddingBottom: normalize(20),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeButton: {
    padding: normalize(8),
    borderRadius: normalize(20),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 1000,
    position: 'relative',
  },
  closeButtonPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    transform: [{ scale: 0.95 }],
  },
  closeButtonWeb: {
    cursor: 'pointer',
    userSelect: 'none',
    // Ensure it's above other elements
    zIndex: 1001,
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    marginLeft: normalize(-40), // Center alignment accounting for close button
  },
  sportIcon: {
    fontSize: normalize(28),
    marginRight: normalize(12),
  },
  typeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: normalize(20),
    paddingHorizontal: normalize(12),
    paddingVertical: normalize(8),
  },
  typeText: {
    fontSize: normalize(14),
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: normalize(8),
  },
  content: {
    flex: 1,
    paddingHorizontal: normalize(20),
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: normalize(24),
    marginBottom: normalize(16),
  },
  title: {
    fontSize: normalize(24),
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    lineHeight: normalize(30),
  },
  categoryBadge: {
    paddingHorizontal: normalize(12),
    paddingVertical: normalize(6),
    borderRadius: normalize(16),
    marginLeft: normalize(12),
  },
  categoryText: {
    fontSize: normalize(11),
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  playerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: normalize(20),
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: normalize(16),
    paddingVertical: normalize(12),
    borderRadius: normalize(12),
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  playerName: {
    fontSize: normalize(16),
    fontWeight: '600',
    color: '#F59E0B',
    marginLeft: normalize(8),
  },
  descriptionSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: normalize(16),
    padding: normalize(20),
    marginBottom: normalize(24),
  },
  description: {
    fontSize: normalize(16),
    fontWeight: '500',
    color: '#E2E8F0',
    lineHeight: normalize(24),
  },
  chartSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: normalize(16),
    padding: normalize(20),
    marginBottom: normalize(24),
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: normalize(16),
  },
  chartTitle: {
    fontSize: normalize(18),
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: normalize(8),
  },
  chart: {
    borderRadius: normalize(12),
  },
  noChartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: normalize(40),
  },
  noChartText: {
    fontSize: normalize(14),
    color: '#6B7280',
    marginTop: normalize(8),
    fontWeight: '600',
  },
  noChartSubtext: {
    fontSize: normalize(12),
    color: '#6B7280',
    marginTop: normalize(4),
    fontStyle: 'italic',
  },
  chartTitle: {
    fontSize: normalize(18),
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: normalize(4),
    textAlign: 'center',
  },
  chartSubtitle: {
    fontSize: normalize(12),
    color: '#94A3B8',
    marginBottom: normalize(16),
    textAlign: 'center',
    fontWeight: '500',
  },
  keyStatsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: normalize(16),
    padding: normalize(20),
    marginBottom: normalize(24),
  },
  sectionTitle: {
    fontSize: normalize(18),
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: normalize(16),
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: normalize(12),
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: normalize(12),
    padding: normalize(12),
  },
  statLabel: {
    fontSize: normalize(12),
    color: '#94A3B8',
    marginBottom: normalize(4),
  },
  statValue: {
    fontSize: normalize(18),
    fontWeight: '700',
    color: '#00E5FF',
  },
  insightSection: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: normalize(16),
    padding: normalize(20),
    marginBottom: normalize(24),
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: normalize(12),
  },
  insightTitle: {
    fontSize: normalize(18),
    fontWeight: '600',
    color: '#F59E0B',
    marginLeft: normalize(8),
  },
  insightText: {
    fontSize: normalize(15),
    color: '#FED7AA',
    lineHeight: normalize(22),
  },
  supportingSection: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: normalize(16),
    padding: normalize(20),
    marginBottom: normalize(40),
    borderLeftWidth: 4,
    borderLeftColor: '#8B5CF6',
  },
  supportingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: normalize(12),
  },
  supportingTitle: {
    fontSize: normalize(18),
    fontWeight: '600',
    color: '#8B5CF6',
    marginLeft: normalize(8),
  },
  supportingText: {
    fontSize: normalize(15),
    color: '#DDD6FE',
    lineHeight: normalize(22),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: normalize(16),
  },
  metricsContainer: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: normalize(16),
    padding: normalize(20),
    marginBottom: normalize(24),
    borderLeftWidth: 4,
    borderLeftColor: '#22C55E',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricItem: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: normalize(12),
    padding: normalize(12),
    marginBottom: normalize(12),
  },
  metricLabel: {
    fontSize: normalize(12),
    color: '#94A3B8',
    marginBottom: normalize(4),
    fontWeight: '500',
  },
  metricValue: {
    fontSize: normalize(16),
    fontWeight: '700',
    color: '#22C55E',
  },
  trendIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});