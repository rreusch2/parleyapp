import React, { useState, useEffect } from 'react';
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
import { LineChart, BarChart, ContributionGraph } from 'react-native-chart-kit';
import { normalize, isTablet } from '../services/device';
import { supabase } from '../services/api/supabaseClient';

interface TrendModalProps {
  visible: boolean;
  trend: any;
  onClose: () => void;
}

interface PropLineData {
  line: number;
  propType: string;
  eventId: string;
}

const { width: screenWidth } = Dimensions.get('window');

export default function TrendModal({ visible, trend, onClose }: TrendModalProps) {
  const [propLineData, setPropLineData] = useState<PropLineData | null>(null);
  const [loadingPropLine, setLoadingPropLine] = useState(false);

  if (!trend) return null;

  // Fetch the actual prop line from the database
  useEffect(() => {
    const fetchPropLine = async () => {
      if (!trend?.player_id || !trend?.metadata?.prop_type_id) return;
      
      setLoadingPropLine(true);
      try {
        // Get the most recent prop line for this player and prop type
        const { data: propData, error } = await supabase
          .from('player_props_odds')
          .select(`
            line,
            event_id,
            player_prop_types!inner(prop_name, prop_key)
          `)
          .eq('player_id', trend.player_id)
          .eq('prop_type_id', trend.metadata.prop_type_id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) {
          console.error('Error fetching prop line:', error);
          return;
        }

        if (propData && propData.length > 0) {
          const prop = propData[0];
          const propTypes = prop.player_prop_types as any;
          const lineValue = parseFloat(prop.line);
          if (!isNaN(lineValue) && lineValue > 0) {
            setPropLineData({
              line: lineValue,
              propType: propTypes?.prop_name || 'Unknown',
              eventId: prop.event_id
            });
          }
        }
      } catch (error) {
        console.error('Error fetching prop line:', error);
        setPropLineData(null);
      } finally {
        setLoadingPropLine(false);
      }
    };

    if (visible && trend?.type === 'player_prop') {
      fetchPropLine();
    } else {
      setPropLineData(null);
    }
  }, [visible, trend?.player_id, trend?.metadata?.prop_type_id, trend?.type]);

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
    const chartData = trend?.chart_data;
    const visualData = trend?.visual_data;
    
    if (!chartData?.recent_games || !Array.isArray(chartData.recent_games) || chartData.recent_games.length === 0) {
      return (
        <View style={styles.noChartContainer}>
          <BarChart3 size={normalize(40)} color="#6B7280" />
          <Text style={styles.noChartText}>No performance data available</Text>
          <Text style={styles.noChartSubtext}>Check back after more games are played</Text>
        </View>
      );
    }

    try {

      // Process recent games data for chart
      const recentGames = Array.isArray(visualData?.recent_games) ? visualData.recent_games : [];
      
      // Ensure we have valid data
      if (recentGames.length === 0) {
        return (
          <View style={styles.noDataContainer}>
            <Text style={styles.noDataText}>No chart data available</Text>
          </View>
        );
      }
      
      // Generate meaningful X-axis labels with safety checks
      const labels = recentGames.map((game: any, index: number) => {
        try {
          // Try to get opponent abbreviation first
          if (game?.opponent && game.opponent !== 'NaN' && game.opponent !== 'null' && game.opponent !== null) {
            const opponent = String(game.opponent).trim();
            // If opponent is already short, use it
            if (opponent.length <= 4) {
              return `vs ${opponent}`;
            } else {
              // Extract abbreviation from full team name
              const words = opponent.split(' ').filter(word => word.length > 0);
              if (words.length > 1) {
                return `vs ${words[words.length - 1].substring(0, 3).toUpperCase()}`;
              }
              return `vs ${opponent.substring(0, 3).toUpperCase()}`;
            }
          }
          // Fallback to date if available
          else if (game?.date && game.date !== 'NaN' && game.date !== null) {
            const date = new Date(game.date);
            if (!isNaN(date.getTime())) {
              return `${date.getMonth() + 1}/${date.getDate()}`;
            }
          }
        } catch (e) {
          console.warn('Error processing game label:', e);
        }
        // Final fallback to game number
        return `G${recentGames.length - index}`;
      });
      
      let datasets = [];
      let yAxisLabel = '';
      let chartTitle = '';
      let maxValue = 0;
      let isDecimalData = false;
      
      if (trend?.type === 'player_prop') {
        // Determine what stat to show based on available data
        let values = [];
        
        // Safely check first game data
        const firstGame = recentGames[0] || {};
        
        if (typeof firstGame.hits === 'number' || firstGame.hits !== undefined) {
          values = recentGames.map((game: any) => {
            const hits = game?.hits;
            return typeof hits === 'number' ? hits : 0;
          });
          yAxisLabel = 'Hits';
          chartTitle = `${trend.full_player_name || 'Player'} - Recent Hits`;
        } else if (typeof firstGame.rbis === 'number' || firstGame.rbis !== undefined) {
          values = recentGames.map((game: any) => {
            const rbis = game?.rbis;
            return typeof rbis === 'number' ? rbis : 0;
          });
          yAxisLabel = 'RBIs';
          chartTitle = `${trend.full_player_name || 'Player'} - Recent RBIs`;
        } else if (typeof firstGame.runs === 'number' || firstGame.runs !== undefined) {
          values = recentGames.map((game: any) => {
            const runs = game?.runs;
            return typeof runs === 'number' ? runs : 0;
          });
          yAxisLabel = 'Runs';
          chartTitle = `${trend.full_player_name || 'Player'} - Recent Runs`;
        } else if (firstGame.ba !== undefined) {
          values = recentGames.map((game: any) => {
            const ba = parseFloat(game?.ba);
            return !isNaN(ba) ? ba : 0;
          });
          yAxisLabel = 'Batting Avg';
          chartTitle = `${trend.full_player_name || 'Player'} - Batting Average`;
          isDecimalData = true;
        } else {
          values = recentGames.map((game: any) => {
            const value = game?.value;
            return typeof value === 'number' ? value : 0;
          });
          yAxisLabel = 'Performance';
          chartTitle = `${trend.full_player_name || 'Player'} - Performance`;
        }
        
        // Ensure we have valid values
        if (values.length === 0) {
          values = [0];
        }
        
        maxValue = Math.max(...values.filter(v => typeof v === 'number' && !isNaN(v)));
        if (!isFinite(maxValue) || maxValue <= 0) {
          maxValue = 1; // Fallback to prevent chart errors
        }
        
        // Create dynamic colors based on prop line if available
        let barColors = [];
        if (propLineData && typeof propLineData.line === 'number' && propLineData.line > 0) {
          barColors = values.map(value => {
            return (typeof value === 'number' && value >= propLineData.line) 
              ? 'rgba(34, 197, 94, 0.8)' // Green for above line
              : 'rgba(239, 68, 68, 0.8)'; // Red for below line
          });
        } else {
          // Default color if no prop line
          barColors = values.map(() => 'rgba(34, 197, 94, 0.8)');
        }

        datasets = [{
          data: values,
          color: (opacity = 1) => `rgba(34, 197, 94, ${opacity})`, // Green for line charts
          strokeWidth: 3,
          colors: barColors, // For bar charts
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

      // Calculate better Y-axis intervals
      const calculateYAxisIntervals = (maxVal: number, minVal: number = 0) => {
        const range = maxVal - minVal;
        let interval;
        
        if (range <= 5) {
          interval = 1;
        } else if (range <= 10) {
          interval = 2;
        } else if (range <= 25) {
          interval = 5;
        } else {
          interval = Math.ceil(range / 5);
        }
        
        return Math.max(1, interval);
      };

      const minValue = Math.min(...datasets[0].data, 0);
      const yAxisInterval = calculateYAxisIntervals(maxValue, minValue);
      const segments = Math.min(6, Math.ceil((maxValue - minValue) / yAxisInterval));

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
        // Improved Y-axis configuration
        fromZero: !isDecimalData,
        segments: segments,
        yAxisInterval: yAxisInterval,
        // Add prop line if available
        ...(propLineData && propLineData.line > 0 && {
          horizontalLines: [{
            value: propLineData.line,
            color: '#F59E0B',
            strokeDasharray: '5,5',
            strokeWidth: 2,
            opacity: 0.8,
          }]
        })
      };

      if (visualData?.chart_type === 'bar') {
        return (
          <View>
            <Text style={styles.chartTitle}>{chartTitle}</Text>
            <Text style={styles.chartSubtitle}>
              Last {recentGames.length} Games • {yAxisLabel}
              {propLineData && (
                <Text style={styles.propLineIndicator}>
                  {' '}• Line: {propLineData.line}
                </Text>
              )}
            </Text>
            <View style={styles.chartContainer}>
              <BarChart
                data={data}
                width={screenWidth - 80}
                height={220}
                yAxisLabel=""
                yAxisSuffix=""
                chartConfig={chartConfig}
                style={styles.chart}
                showValuesOnTopOfBars
                fromZero={!isDecimalData}
                verticalLabelRotation={labels.some(label => label.length > 6) ? 45 : 0}
              />
              
              {/* Render prop line overlay */}
              {propLineData && typeof propLineData.line === 'number' && propLineData.line > 0 && typeof maxValue === 'number' && maxValue > 0 && (
                <View style={[
                  styles.propLineOverlay,
                  {
                    bottom: Math.max(40, Math.min(220, ((propLineData.line / Math.max(maxValue, propLineData.line + 1)) * 180) + 40)),
                  }
                ]}>
                  <View style={styles.propLineDashed} />
                  <Text style={styles.propLineLabel}>
                    Line: {propLineData.line.toFixed(1)}
                  </Text>
                </View>
              )}
              
              {/* Render colored indicators for each bar */}
              {propLineData && typeof propLineData.line === 'number' && propLineData.line > 0 && datasets && datasets[0] && Array.isArray(datasets[0].data) && (
                <View style={styles.barIndicators}>
                  {datasets[0].data.map((value: number, index: number) => {
                    const isAboveLine = typeof value === 'number' && !isNaN(value) && value >= propLineData.line;
                    const barWidth = Math.max(10, (screenWidth - 120) / Math.max(datasets[0].data.length, 1) - 4);
                    return (
                      <View 
                        key={`bar-indicator-${index}`}
                        style={[
                          styles.barIndicator,
                          {
                            backgroundColor: isAboveLine ? '#22C55E' : '#EF4444',
                            width: barWidth,
                          }
                        ]} 
                      />
                    );
                  })}
                </View>
              )}
            </View>
            {/* Legend */}
            {propLineData && (
              <View style={styles.chartLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#22C55E' }]} />
                  <Text style={styles.legendText}>Above Line</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, { backgroundColor: '#EF4444' }]} />
                  <Text style={styles.legendText}>Below Line</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendLine]} />
                  <Text style={styles.legendText}>Prop Line ({propLineData.line})</Text>
                </View>
              </View>
            )}
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
      console.error('Error rendering chart:', error);
      return (
        <View style={styles.noChartContainer}>
          <BarChart3 size={normalize(40)} color="#EF4444" />
          <Text style={styles.noChartText}>Chart temporarily unavailable</Text>
          <Text style={styles.noChartSubtext}>Please try refreshing the trend</Text>
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
  propLineIndicator: {
    color: '#F59E0B',
    fontWeight: '600',
  },
  chartContainer: {
    position: 'relative',
  },
  barIndicators: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 180,
    pointerEvents: 'none',
  },
  barIndicator: {
    height: 4,
    borderRadius: 2,
    marginHorizontal: 2,
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noDataText: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  propLineOverlay: {
    position: 'absolute',
    left: 40,
    right: 40,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  propLineDashed: {
    flex: 1,
    height: 2,
    backgroundColor: '#F59E0B',
    opacity: 0.8,
  },
  propLineLabel: {
    fontSize: normalize(10),
    color: '#F59E0B',
    fontWeight: '600',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    paddingHorizontal: normalize(6),
    paddingVertical: normalize(2),
    borderRadius: normalize(4),
    marginLeft: normalize(8),
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: normalize(12),
    paddingTop: normalize(12),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: normalize(8),
  },
  legendColor: {
    width: normalize(12),
    height: normalize(12),
    borderRadius: normalize(2),
    marginRight: normalize(6),
  },
  legendLine: {
    width: normalize(16),
    height: 2,
    backgroundColor: '#F59E0B',
    marginRight: normalize(6),
  },
  legendText: {
    fontSize: normalize(11),
    color: '#94A3B8',
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