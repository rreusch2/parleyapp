

import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '@react-navigation/native';

// Legacy interface for backward compatibility
export interface ChartPoint {
  label: string;
  value: number;
}

const { width: screenWidth } = Dimensions.get('window');
const CHART_WIDTH = screenWidth - 40;
const CHART_HEIGHT = 250; // Increased height to prevent cutoff

interface GameStat {
  gameNumber: number;
  value: number;
  opponent: string;
  date: string;
  isHome: boolean;
  gameResult?: 'W' | 'L';
}

interface PlayerStatsChartProps {
  playerName: string;
  propType: string;
  currentLine: number; // Current prop line from player_props_odds
  last10Games: GameStat[];
  sport: 'MLB' | 'WNBA';
}

export const PlayerStatsChart: React.FC<PlayerStatsChartProps> = ({
  playerName,
  propType,
  currentLine,
  last10Games,
  sport,
}) => {
  const { colors } = useTheme();
  
  // Calculate chart dimensions and scaling with better handling of edge cases
  const gameValues = last10Games.map(g => g.value).filter(v => v !== undefined && v !== null);
  const maxValue = Math.max(
    ...gameValues,
    currentLine * 1.2,
    10 // Minimum scale to prevent division by zero
  );
  const barWidth = Math.max((CHART_WIDTH - 100) / 10, 20); // Ensure minimum bar width
  const barSpacing = 4;
  
  const getBarHeight = (value: number) => {
    return (value / maxValue) * (CHART_HEIGHT - 80); // More space for labels and prevent cutoff
  };
  
  const getLineY = () => {
    return CHART_HEIGHT - 40 - getBarHeight(currentLine);
  };
  
  const getBarColor = (value: number) => {
    if (value > currentLine) {
      return '#4CAF50'; // Green for over
    } else {
      return '#9E9E9E'; // Grey for under
    }
  };

  const formatPropType = (prop: string) => {
    switch (prop.toLowerCase()) {
      case 'hits': return 'Hits';
      case 'home_runs': return 'Home Runs';
      case 'rbis': return 'RBIs';
      case 'runs_scored': return 'Runs';
      case 'strikeouts': return 'Strikeouts';
      case 'total_bases': return 'Total Bases';
      case 'points': return 'Points';
      case 'rebounds': return 'Rebounds';
      case 'assists': return 'Assists';
      default: return prop;
    }
  };

  const getYAxisLabels = () => {
    const step = Math.ceil(maxValue / 4);
    return Array.from({ length: 5 }, (_, i) => i * step);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.playerName, { color: colors.text }]}>
          {playerName}
        </Text>
        <Text style={[styles.propType, { color: colors.text }]}>
          {formatPropType(propType)} - Last 10 Games
        </Text>
        <View style={styles.lineInfo}>
          <View style={styles.propLineBadge}>
            <Text style={styles.propLineText}>
              Current Line: {currentLine}
            </Text>
          </View>
        </View>
      </View>

      {/* Chart Container */}
      <View style={styles.chartContainer}>
        {/* Y-Axis Labels */}
        <View style={styles.yAxis}>
          {getYAxisLabels().reverse().map((value, index) => (
            <View key={index} style={styles.yAxisLabel}>
              <Text style={[styles.yAxisText, { color: colors.text }]}>
                {value}
              </Text>
            </View>
          ))}
        </View>

        {/* Chart Area */}
        <View style={styles.chartArea}>
          {/* Horizontal Grid Lines */}
          {getYAxisLabels().map((value, index) => (
            <View
              key={index}
              style={[
                styles.gridLine,
                {
                  bottom: getBarHeight(value),
                  borderTopColor: colors.border,
                }
              ]}
            />
          ))}

          {/* Prop Line (Dotted) */}
          <View
            style={[
              styles.propLine,
              {
                bottom: getBarHeight(currentLine),
                borderTopColor: '#FF9800',
              }
            ]}
          >
            <View style={styles.propLineLabel}>
              <Text style={styles.propLineLabelText}>
                Line: {currentLine}
              </Text>
            </View>
          </View>

          {/* Bars */}
          <View style={styles.barsContainer}>
            {last10Games.map((game, index) => (
              <View
                key={index}
                style={[
                  styles.barColumn,
                  { width: barWidth, marginRight: index < 9 ? barSpacing : 0 }
                ]}
              >
                {/* Bar */}
                <View
                  style={[
                    styles.bar,
                    {
                      height: getBarHeight(game.value),
                      backgroundColor: getBarColor(game.value),
                    }
                  ]}
                >
                  {/* Value Label on Bar */}
                  <View style={styles.valueLabel}>
                    <Text style={styles.valueLabelText}>
                      {game.value}
                    </Text>
                  </View>
                </View>

                {/* Game Info */}
                <View style={styles.gameInfo}>
                  <Text style={[styles.gameNumber, { color: colors.text }]}>
                    G{10 - index}
                  </Text>
                  <Text style={[styles.opponent, { color: colors.text }]}>
                    {game.isHome ? 'vs' : '@'} {game.opponent}
                  </Text>
                  {game.gameResult && (
                    <View style={[
                      styles.resultBadge,
                      { backgroundColor: game.gameResult === 'W' ? '#4CAF50' : '#F44336' }
                    ]}>
                      <Text style={styles.resultText}>{game.gameResult}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#4CAF50' }]} />
          <Text style={[styles.legendText, { color: colors.text }]}>
            Over Line
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#9E9E9E' }]} />
          <Text style={[styles.legendText, { color: colors.text }]}>
            Under Line
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#FF9800' }]} />
          <Text style={[styles.legendText, { color: colors.text }]}>
            Current Line
          </Text>
        </View>
      </View>

      {/* Stats Summary */}
      <View style={[styles.summary, { borderTopColor: colors.border }]}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: colors.text }]}>
            Over Rate
          </Text>
          <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>
            {Math.round((last10Games.filter(g => g.value > currentLine).length / 10) * 100)}%
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: colors.text }]}>
            Average
          </Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>
            {(last10Games.reduce((sum, g) => sum + g.value, 0) / 10).toFixed(1)}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: colors.text }]}>
            Best Game
          </Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>
            {Math.max(...last10Games.map(g => g.value))}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    borderRadius: 12,
    marginVertical: 10,
  },
  header: {
    marginBottom: 20,
  },
  playerName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  propType: {
    fontSize: 16,
    fontWeight: '500',
    opacity: 0.8,
    marginBottom: 8,
  },
  lineInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  propLineBadge: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  propLineText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  chartContainer: {
    flexDirection: 'row',
    height: CHART_HEIGHT,
    marginBottom: 20,
  },
  yAxis: {
    width: 30,
    justifyContent: 'space-between',
    paddingRight: 8,
  },
  yAxisLabel: {
    height: 20,
    justifyContent: 'center',
  },
  yAxisText: {
    fontSize: 10,
    textAlign: 'right',
  },
  chartArea: {
    flex: 1,
    position: 'relative',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    opacity: 0.2,
  },
  propLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 2,
    borderStyle: 'dashed',
  },
  propLineLabel: {
    position: 'absolute',
    right: 0,
    top: -10,
    backgroundColor: '#FF9800',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
  propLineLabelText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '600',
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: '100%',
    paddingBottom: 40,
  },
  barColumn: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    position: 'relative',
    minHeight: 4,
  },
  valueLabel: {
    position: 'absolute',
    top: -15,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  valueLabelText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  gameInfo: {
    marginTop: 8,
    alignItems: 'center',
    minHeight: 40,
  },
  gameNumber: {
    fontSize: 9,
    fontWeight: '600',
    marginBottom: 2,
  },
  opponent: {
    fontSize: 8,
    marginBottom: 2,
  },
  resultBadge: {
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 2,
  },
  resultText: {
    color: '#FFFFFF',
    fontSize: 7,
    fontWeight: '600',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 15,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 12,
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 15,
    borderTopWidth: 1,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
  },
});

// Default export for backward compatibility
export default PlayerStatsChart;
