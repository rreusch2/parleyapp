import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  Image,
  Alert,
  Share,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Svg, G, Line, Text as SvgText, Circle, Rect, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { useUITheme } from '../services/uiThemeContext';
import { useSubscription } from '../services/subscriptionContext';
import * as Haptics from 'expo-haptics';

interface Player {
  id: string;
  name: string;
  team: string;
  sport: string;
  position?: string;
  headshot_url?: string;
}

interface GameStat {
  game_date: string;
  opponent: string;
  value: number;
  line_value?: number;
  result: 'over' | 'under' | 'push';
  is_home: boolean;
}

interface SportsbookOdds {
  bookmaker: string;
  logo_url?: string;
  over_odds: number;
  under_odds: number;
  line_value: number;
  is_best_over: boolean;
  is_best_under: boolean;
}

interface TrendData {
  id: string;
  player: Player;
  market_type: string;
  market_display_name: string;
  confidence_score: number;
  hit_rate: number;
  current_streak: number;
  streak_type: 'over' | 'under';
  sample_size: number;
  avg_value: number;
  median_value: number;
  last_10_games: GameStat[];
  ai_reasoning?: string;
  key_factors: string[];
  sportsbook_odds: SportsbookOdds[];
  next_game: {
    opponent: string;
    game_time: string;
    is_home: boolean;
  };
  line_movement: {
    opening_line: number;
    current_line: number;
    movement_direction: 'up' | 'down' | 'stable';
    movement_percentage: number;
  };
}

interface EnhancedTrendCardProps {
  trend: TrendData;
  onAddToPicks: (trend: TrendData) => void;
  onViewDetails: (trend: TrendData) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

const { width: screenWidth } = Dimensions.get('window');
const cardWidth = screenWidth - 40;
const chartWidth = cardWidth - 40;
const chartHeight = 90;

export default function EnhancedTrendCard({ 
  trend, 
  onAddToPicks, 
  onViewDetails,
  isExpanded = false,
  onToggleExpand
}: EnhancedTrendCardProps) {
  const { theme } = useUITheme();
  const { isElite, isPro } = useSubscription();
  const [showChart, setShowChart] = useState(false);
  const expandAnim = useRef(new Animated.Value(0)).current;

  const getSportColor = (sport: string) => {
    const colors = {
      'MLB': '#1E40AF',
      'WNBA': '#DC2626', 
      'NBA': '#DC2626',
      'NFL': '#16A34A',
      'College Football': '#F59E0B',
      'UFC': '#EA580C'
    };
    return colors[sport as keyof typeof colors] || '#6B7280';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 85) return '#10B981'; // Green
    if (confidence >= 70) return '#F59E0B'; // Yellow
    return '#EF4444'; // Red
  };

  const formatOdds = (odds: number) => {
    return odds > 0 ? `+${odds}` : `${odds}`;
  };

  const getBestOdds = (side: 'over' | 'under') => {
    return trend.sportsbook_odds.find(book => 
      side === 'over' ? book.is_best_over : book.is_best_under
    );
  };

  const handleAddToPicks = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAddToPicks(trend);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `🔥 ${trend.player.name} ${trend.market_display_name}\n\n` +
                `📊 ${trend.hit_rate}% hit rate (${trend.sample_size} games)\n` +
                `⚡ ${trend.current_streak} game ${trend.streak_type} streak\n\n` +
                `Check out Predictive Play for more AI-powered picks!`
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const toggleChart = () => {
    setShowChart(!showChart);
    Animated.timing(expandAnim, {
      toValue: showChart ? 0 : 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const renderMiniChart = () => {
    if (!trend.last_10_games || trend.last_10_games.length === 0) return null;

    // Use only valid numeric values
    const games = trend.last_10_games
      .filter((g) => typeof g?.value === 'number' && isFinite(g.value))
      .slice(-10);
    if (games.length === 0) return null;

    const values = games.map(g => g.value as number);
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const range = maxValue - minValue || 1;
    const barWidth = (chartWidth - 60) / games.length;

    return (
      <Animated.View
        style={{
          height: expandAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, chartHeight + 40],
          }),
          opacity: expandAnim,
          overflow: 'hidden',
          marginTop: 12,
          backgroundColor: '#0F172A',
          borderRadius: 12,
          padding: 16
        }}
      >
        <Text style={{
          color: '#FFFFFF',
          fontSize: 14,
          fontWeight: '600',
          marginBottom: 12
        }}>
          Last 10 Games Performance
        </Text>
        
        <Svg height={chartHeight} width={chartWidth}>
          <Defs>
            <SvgLinearGradient id="barGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#10B981" stopOpacity="0.8" />
              <Stop offset="100%" stopColor="#10B981" stopOpacity="0.4" />
            </SvgLinearGradient>
          </Defs>
          
          {games.map((game, index) => {
            const x = 30 + index * barWidth;
            const normalizedValue = ((game.value as number) - minValue) / range;
            const barHeight = Math.max(normalizedValue * (chartHeight - 40), 8);
            const y = chartHeight - 20 - barHeight;
            
            const barColor = game.result === 'over' ? '#10B981' : 
                           game.result === 'under' ? '#EF4444' : '#F59E0B';

            return (
              <G key={index}>
                <Rect
                  x={x - barWidth/3}
                  y={y}
                  width={barWidth * 0.6}
                  height={barHeight}
                  fill={barColor}
                  rx={2}
                />
                <SvgText
                  x={x}
                  y={chartHeight - 5}
                  textAnchor="middle"
                  fontSize="8"
                  fill="#9CA3AF"
                >
                  {Number.isFinite(game.value) ? (game.value as number).toFixed(1) : '-'}
                </SvgText>
              </G>
            );
          })}
          
          {/* Average line */}
          <Line
            x1={20}
            x2={chartWidth - 20}
            y1={chartHeight - 20 - ((((Number.isFinite(trend.avg_value as any) ? (trend.avg_value as number) : minValue) - minValue) / range) * (chartHeight - 40))}
            y2={chartHeight - 20 - ((((Number.isFinite(trend.avg_value as any) ? (trend.avg_value as number) : minValue) - minValue) / range) * (chartHeight - 40))}
            stroke="#3B82F6"
            strokeWidth={1.5}
            strokeDasharray="4,2"
          />
        </Svg>
      </Animated.View>
    );
  };

  return (
    <View style={{
      backgroundColor: '#1F2937',
      borderRadius: 16,
      marginHorizontal: 20,
      marginVertical: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 3,
      borderWidth: 1,
      borderColor: '#374151'
    }}>
      <LinearGradient
        colors={['rgba(59, 130, 246, 0.06)', 'rgba(59, 130, 246, 0.02)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 16,
          padding: 12
        }}
      >
        {/* Header Section */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          {/* Player Avatar */}
          <View style={{ position: 'relative', marginRight: 16 }}>
            {trend.player.headshot_url ? (
              <View style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                borderWidth: 3,
                borderColor: getSportColor(trend.player.sport),
                shadowColor: getSportColor(trend.player.sport),
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.4,
                shadowRadius: 8,
                elevation: 8
              }}>
                <Image
                  source={{ uri: trend.player.headshot_url }}
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    backgroundColor: '#374151'
                  }}
                />
                {/* Hot Streak Badge */}
                {trend.current_streak >= 5 && (
                  <View style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    backgroundColor: '#EF4444',
                    borderRadius: 10,
                    width: 20,
                    height: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: '#1F2937'
                  }}>
                    <Text style={{ fontSize: 10 }}>🔥</Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: '#374151',
                borderWidth: 3,
                borderColor: getSportColor(trend.player.sport),
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Ionicons name="person" size={22} color="#9CA3AF" />
              </View>
            )}
          </View>

          {/* Player Info */}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{
                color: '#FFFFFF',
                fontSize: 18,
                fontWeight: '700',
                flex: 1
              }}>
                {trend.player.name}
              </Text>
              {/* Hit Rate Badge */}
              <View style={{
                backgroundColor: getConfidenceColor(trend.hit_rate),
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 12
              }}>
                <Text style={{
                  color: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: '700'
                }}>
                  HR {trend.hit_rate}%
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <View style={{
                backgroundColor: getSportColor(trend.player.sport),
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 6,
                marginRight: 8
              }}>
                <Text style={{
                  color: '#FFFFFF',
                  fontSize: 11,
                  fontWeight: '700'
                }}>
                  {trend.player.sport}
                </Text>
              </View>
              <Text style={{
                color: '#D1D5DB',
                fontSize: 15,
                fontWeight: '600'
              }}>
                {trend.player.team}
              </Text>
            </View>

            <Text style={{
              color: '#9CA3AF',
              fontSize: 12
            }}>
              vs {trend.next_game.opponent} • {trend.next_game.game_time}
            </Text>
          </View>

          {/* Share Button */}
          <TouchableOpacity
            onPress={handleShare}
            style={{
              backgroundColor: '#374151',
              borderRadius: 12,
              padding: 8,
              marginLeft: 8
            }}
          >
            <Ionicons name="share-outline" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Market Info */}
        <View style={{
          backgroundColor: '#0F172A',
          borderRadius: 10,
          padding: 10,
          marginBottom: 10
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ionicons name="trending-up" size={18} color="#3B82F6" style={{ marginRight: 8 }} />
            <Text style={{
              color: '#FFFFFF',
              fontSize: 16,
              fontWeight: '600',
              flex: 1
            }}>
              {trend.market_display_name}
            </Text>
            <TouchableOpacity onPress={toggleChart}>
              <Ionicons 
                name={showChart ? "chevron-up" : "stats-chart"} 
                size={18} 
                color="#3B82F6" 
              />
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: '#9CA3AF', fontSize: 12 }}>Hit Rate</Text>
              <Text style={{ color: '#10B981', fontSize: 16, fontWeight: '700' }}>
                {trend.hit_rate}% ({trend.sample_size})
              </Text>
            </View>
            <View>
              <Text style={{ color: '#9CA3AF', fontSize: 12 }}>Streak</Text>
              <Text style={{ 
                color: trend.streak_type === 'over' ? '#10B981' : '#EF4444', 
                fontSize: 16, 
                fontWeight: '700' 
              }}>
                {trend.current_streak} {trend.streak_type.toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={{ color: '#9CA3AF', fontSize: 12 }}>Avg</Text>
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
                {Number.isFinite(trend.avg_value as any) ? (trend.avg_value as number).toFixed(1) : '-'}
              </Text>
            </View>
          </View>
        </View>

        {/* Chart */}
        {renderMiniChart()}

        {/* Sportsbook Odds */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 10 }}
        >
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {trend.sportsbook_odds.slice(0, 4).map((book, index) => (
              <TouchableOpacity
                key={index}
                style={{
                  backgroundColor: book.is_best_over || book.is_best_under ? '#10B981' : '#374151',
                  borderRadius: 10,
                  padding: 10,
                  minWidth: 88,
                  alignItems: 'center'
                }}
              >
                <Text style={{
                  color: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: '600',
                  marginBottom: 4
                }}>
                  {book.bookmaker}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Text style={{
                    color: book.is_best_over ? '#FFFFFF' : '#9CA3AF',
                    fontSize: 11,
                    fontWeight: '600'
                  }}>
                    O {formatOdds(book.over_odds)}
                  </Text>
                  <Text style={{
                    color: book.is_best_under ? '#FFFFFF' : '#9CA3AF',
                    fontSize: 11,
                    fontWeight: '600'
                  }}>
                    U {formatOdds(book.under_odds)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Removed per-card AI Analysis to keep card compact */}

        {/* Action Buttons */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity
            onPress={handleAddToPicks}
            style={{
              flex: 1,
              backgroundColor: isElite ? theme.accentPrimary : '#3B82F6',
              borderRadius: 12,
              paddingVertical: 12,
              alignItems: 'center',
              shadowColor: isElite ? theme.accentPrimary : '#3B82F6',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 4
            }}
          >
            <Text style={{
              color: '#FFFFFF',
              fontSize: 15,
              fontWeight: '700'
            }}>
              Add to Picks
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => onViewDetails(trend)}
            style={{
              backgroundColor: '#374151',
              borderRadius: 12,
              paddingVertical: 12,
              paddingHorizontal: 16,
              alignItems: 'center'
            }}
          >
            <Text style={{
              color: '#D1D5DB',
              fontSize: 15,
              fontWeight: '600'
            }}>
              Details
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}
