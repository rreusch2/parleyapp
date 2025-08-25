import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { 
  Line, 
  Rect, 
  Text as SvgText, 
  G,
  Defs,
  Pattern,
  Path
} from 'react-native-svg';
import { 
  TrendingUp, 
  TrendingDown, 
  Target,
  BarChart3,
  Activity
} from 'lucide-react-native';
import { normalize } from '../services/device';

interface GamePerformance {
  date: string;
  opponent: string;
  actual_value: number;
  ai_line: number;
  result: 'over' | 'under';
  margin: number;
  hit_rate?: number;
}

interface ChartData {
  recent_games: GamePerformance[];
  ai_prediction_line: number;
  prop_type: string;
  hit_rate: number;
  recent_form: number;
  trend_strength: string;
  strength_color: string;
  last_5_average: number;
  confidence_score?: number;
}

interface EnhancedTrendChartProps {
  data: ChartData;
  playerName: string;
}

const { width: screenWidth } = Dimensions.get('window');
const chartWidth = screenWidth - 40;
const chartHeight = 200;
const barWidth = 25;
const barSpacing = 8;

export default function EnhancedTrendChart({ data, playerName }: EnhancedTrendChartProps) {
  if (!data?.recent_games || data.recent_games.length === 0) {
    return (
      <View style={styles.noDataContainer}>
        <BarChart3 size={normalize(40)} color="#6B7280" />
        <Text style={styles.noDataText}>No performance data available</Text>
        <Text style={styles.noDataSubtext}>Check back after more games are played</Text>
      </View>
    );
  }

  const games = data.recent_games.slice(0, 10); // Show last 10 games
  const maxValue = Math.max(
    ...games.map(game => game.actual_value),
    data.ai_prediction_line
  ) + 1;
  
  const minValue = 0;
  const valueRange = maxValue - minValue;
  
  // Calculate chart dimensions
  const totalBarsWidth = games.length * (barWidth + barSpacing) - barSpacing;
  const chartPadding = 20;
  const actualChartWidth = Math.max(chartWidth - 40, totalBarsWidth + 40);
  
  // Calculate positions
  const getYPosition = (value: number) => {
    return chartHeight - 40 - ((value - minValue) / valueRange) * (chartHeight - 80);
  };
  
  const getXPosition = (index: number) => {
    return chartPadding + index * (barWidth + barSpacing) + barWidth / 2;
  };
  
  const aiLineY = getYPosition(data.ai_prediction_line);
  
  const renderStatCards = () => (
    <View style={styles.statsContainer}>
      <View style={[styles.statCard, { backgroundColor: data.strength_color + '20' }]}>
        <View style={styles.statHeader}>
          <Target size={normalize(16)} color={data.strength_color} />
          <Text style={styles.statLabel}>Hit Rate</Text>
        </View>
        <Text style={[styles.statValue, { color: data.strength_color }]}>
          {data.hit_rate}%
        </Text>
        <Text style={styles.statSubtext}>vs AI Line</Text>
      </View>
      
      <View style={styles.statCard}>
        <View style={styles.statHeader}>
          <Activity size={normalize(16)} color="#3B82F6" />
          <Text style={styles.statLabel}>Recent Form</Text>
        </View>
        <Text style={[styles.statValue, { color: '#3B82F6' }]}>
          {data.recent_form}%
        </Text>
        <Text style={styles.statSubtext}>Last 5 Games</Text>
      </View>
      
      <View style={styles.statCard}>
        <View style={styles.statHeader}>
          {data.hit_rate >= 60 ? 
            <TrendingUp size={normalize(16)} color="#22C55E" /> : 
            <TrendingDown size={normalize(16)} color="#EF4444" />
          }
          <Text style={styles.statLabel}>Trend</Text>
        </View>
        <Text style={[styles.statValue, { color: data.hit_rate >= 60 ? '#22C55E' : '#EF4444' }]}>
          {data.trend_strength}
        </Text>
        <Text style={styles.statSubtext}>Strength</Text>
      </View>
    </View>
  );

  const renderChart = () => (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      style={styles.chartScrollContainer}
      contentContainerStyle={{ paddingHorizontal: 20 }}
    >
      <View style={[styles.chartContainer, { width: actualChartWidth }]}>
        <Svg width={actualChartWidth} height={chartHeight} style={styles.svg}>
          <Defs>
            {/* Dotted line pattern for AI prediction line */}
            <Pattern
              id="dottedLine"
              patternUnits="userSpaceOnUse"
              width="8"
              height="1"
            >
              <Rect width="4" height="1" fill="#F59E0B" />
              <Rect x="4" width="4" height="1" fill="transparent" />
            </Pattern>
          </Defs>
          
          {/* AI Prediction Line (Dotted) */}
          <Line
            x1={chartPadding}
            y1={aiLineY}
            x2={actualChartWidth - chartPadding}
            y2={aiLineY}
            stroke="url(#dottedLine)"
            strokeWidth="3"
          />
          
          {/* AI Line Label */}
          <SvgText
            x={actualChartWidth - chartPadding - 5}
            y={aiLineY - 5}
            fill="#F59E0B"
            fontSize="12"
            fontWeight="600"
            textAnchor="end"
          >
            AI Line: {data.ai_prediction_line}
          </SvgText>
          
          {/* Performance Bars */}
          {games.map((game, index) => {
            const x = getXPosition(index);
            const barHeight = ((game.actual_value - minValue) / valueRange) * (chartHeight - 80);
            const barY = chartHeight - 40 - barHeight;
            
            // Determine bar color based on performance vs AI line
            const barColor = game.result === 'over' ? '#22C55E' : '#94A3B8';
            const barOpacity = game.result === 'over' ? 1 : 0.7;
            
            return (
              <G key={index}>
                {/* Performance Bar */}
                <Rect
                  x={x - barWidth / 2}
                  y={barY}
                  width={barWidth}
                  height={Math.max(barHeight, 2)}
                  fill={barColor}
                  opacity={barOpacity}
                  rx="3"
                />
                
                {/* Value Label on Bar */}
                <SvgText
                  x={x}
                  y={barY - 5}
                  fill="#FFFFFF"
                  fontSize="10"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {game.actual_value}
                </SvgText>
                
                {/* Opponent Label */}
                <SvgText
                  x={x}
                  y={chartHeight - 20}
                  fill="#6B7280"
                  fontSize="10"
                  textAnchor="middle"
                  transform={`rotate(-45, ${x}, ${chartHeight - 20})`}
                >
                  {game.opponent || `G${index + 1}`}
                </SvgText>
                
                {/* Performance Indicator (Over/Under) */}
                <SvgText
                  x={x}
                  y={chartHeight - 5}
                  fill={game.result === 'over' ? '#22C55E' : '#94A3B8'}
                  fontSize="8"
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {game.result === 'over' ? '✓' : '✗'}
                </SvgText>
              </G>
            );
          })}
          
          {/* Y-Axis Labels */}
          {Array.from({ length: 6 }, (_, i) => {
            const value = Math.round(minValue + (valueRange * i) / 5);
            const y = getYPosition(value);
            
            return (
              <G key={i}>
                <SvgText
                  x={15}
                  y={y + 3}
                  fill="#6B7280"
                  fontSize="10"
                  textAnchor="middle"
                >
                  {value}
                </SvgText>
                <Line
                  x1={chartPadding - 5}
                  y1={y}
                  x2={actualChartWidth - chartPadding}
                  y2={y}
                  stroke="#E5E7EB"
                  strokeWidth="1"
                  opacity="0.3"
                />
              </G>
            );
          })}
        </Svg>
        
        {/* Chart Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#22C55E' }]} />
            <Text style={styles.legendText}>Over AI Line</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#94A3B8' }]} />
            <Text style={styles.legendText}>Under AI Line</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendLine, { borderColor: '#F59E0B' }]} />
            <Text style={styles.legendText}>AI Prediction</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{playerName}</Text>
        <Text style={styles.subtitle}>{data.prop_type} Performance vs AI Line</Text>
      </View>
      
      {/* Stats Cards */}
      {renderStatCards()}
      
      {/* Chart Section */}
      <View style={styles.chartSection}>
        <Text style={styles.chartTitle}>Last {games.length} Games Performance</Text>
        {renderChart()}
      </View>
      
      {/* Analysis Summary */}
      <LinearGradient
        colors={['#F8FAFC', '#F1F5F9']}
        style={styles.analysisContainer}
      >
        <Text style={styles.analysisTitle}>📊 Quick Analysis</Text>
        <Text style={styles.analysisText}>
          {playerName} has hit the over on {data.prop_type.toLowerCase()} in{' '}
          <Text style={[styles.highlightText, { color: data.strength_color }]}>
            {data.hit_rate}% of games
          </Text>
          {' '}with recent form trending{' '}
          <Text style={[styles.highlightText, { color: data.recent_form >= data.hit_rate ? '#22C55E' : '#EF4444' }]}>
            {data.recent_form >= data.hit_rate ? 'upward' : 'downward'}
          </Text>
          {' '}at {data.recent_form}% in the last 5 games.
        </Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: normalize(18),
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: normalize(14),
    color: '#6B7280',
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: normalize(12),
    color: '#6B7280',
    fontWeight: '500',
    marginLeft: 6,
  },
  statValue: {
    fontSize: normalize(18),
    fontWeight: '700',
    marginBottom: 2,
  },
  statSubtext: {
    fontSize: normalize(10),
    color: '#9CA3AF',
  },
  chartSection: {
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: normalize(16),
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  chartScrollContainer: {
    maxHeight: chartHeight + 20,
  },
  chartContainer: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  svg: {
    backgroundColor: 'transparent',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    marginVertical: 2,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 4,
  },
  legendLine: {
    width: 12,
    height: 2,
    borderWidth: 1,
    borderStyle: 'dotted',
    marginRight: 4,
  },
  legendText: {
    fontSize: normalize(11),
    color: '#6B7280',
    fontWeight: '500',
  },
  analysisContainer: {
    borderRadius: 12,
    padding: 16,
  },
  analysisTitle: {
    fontSize: normalize(14),
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  analysisText: {
    fontSize: normalize(13),
    color: '#4B5563',
    lineHeight: 18,
  },
  highlightText: {
    fontWeight: '600',
  },
  noDataContainer: {
    alignItems: 'center',
    padding: 40,
  },
  noDataText: {
    fontSize: normalize(16),
    color: '#6B7280',
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  noDataSubtext: {
    fontSize: normalize(13),
    color: '#9CA3AF',
    textAlign: 'center',
  },
});
