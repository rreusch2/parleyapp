import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { 
  Rect, 
  Line, 
  Text as SvgText, 
  G,
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop
} from 'react-native-svg';
import { supabase } from '../services/api/supabaseClient';

interface Player {
  id: string;
  name: string;
  team: string;
  sport: string;
  position?: string;
}

interface GameStat {
  game_date: string;
  opponent: string;
  is_home: boolean;
  value: number;
  game_result?: string;
}

interface PropType {
  key: string;
  name: string;
  current_line?: number;
}

interface PlayerTrendsModalProps {
  visible: boolean;
  player: Player | null;
  onClose: () => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const chartWidth = screenWidth - 80;
const chartHeight = 200;

export default function PlayerTrendsModal({ visible, player, onClose }: PlayerTrendsModalProps) {
  const [loading, setLoading] = useState(false);
  const [gameStats, setGameStats] = useState<GameStat[]>([]);
  const [selectedPropType, setSelectedPropType] = useState<string>('hits');
  const [propTypes, setPropTypes] = useState<PropType[]>([]);
  const [currentPropLine, setCurrentPropLine] = useState<number | null>(null);

  // Sport-specific prop types
  const getAvailableProps = (sport: string): PropType[] => {
    const propMappings = {
      'MLB': [
        { key: 'hits', name: 'Hits' },
        { key: 'home_runs', name: 'Home Runs' },
        { key: 'rbis', name: 'RBIs' },
        { key: 'runs_scored', name: 'Runs Scored' },
        { key: 'stolen_bases', name: 'Stolen Bases' },
        { key: 'strikeouts', name: 'Strikeouts' },
        { key: 'walks', name: 'Walks' },
        { key: 'total_bases', name: 'Total Bases' }
      ],
      'WNBA': [
        { key: 'points', name: 'Points' },
        { key: 'rebounds', name: 'Rebounds' },
        { key: 'assists', name: 'Assists' },
        { key: 'steals', name: 'Steals' },
        { key: 'blocks', name: 'Blocks' },
        { key: 'three_pointers', name: '3-Pointers' }
      ],
      'NBA': [
        { key: 'points', name: 'Points' },
        { key: 'rebounds', name: 'Rebounds' },
        { key: 'assists', name: 'Assists' },
        { key: 'steals', name: 'Steals' },
        { key: 'blocks', name: 'Blocks' },
        { key: 'three_pointers', name: '3-Pointers' }
      ],
      'NFL': [
        { key: 'passing_yards', name: 'Passing Yards' },
        { key: 'rushing_yards', name: 'Rushing Yards' },
        { key: 'receiving_yards', name: 'Receiving Yards' },
        { key: 'touchdowns', name: 'Touchdowns' },
        { key: 'receptions', name: 'Receptions' }
      ]
    };

    return propMappings[sport as keyof typeof propMappings] || [];
  };

  useEffect(() => {
    if (visible && player) {
      const props = getAvailableProps(player.sport);
      setPropTypes(props);
      if (props.length > 0) {
        setSelectedPropType(props[0].key);
      }
      fetchPlayerStats();
      fetchCurrentPropLine();
    }
  }, [visible, player, selectedPropType]);

  const fetchPlayerStats = async () => {
    if (!player) return;

    setLoading(true);
    try {
      // First try player_game_stats for more comprehensive data
      const { data: gameStatsData, error: gameStatsError } = await supabase
        .from('player_game_stats')
        .select('stats, created_at')
        .eq('player_id', player.id)
        .order('created_at', { ascending: false })
        .limit(10);

      let formattedStats: GameStat[] = [];

      if (!gameStatsError && gameStatsData && gameStatsData.length > 0) {
        // Parse data from player_game_stats JSONB format
        formattedStats = gameStatsData.map(stat => {
          const statsData = stat.stats as any;
          let value = 0;
          
          // Map selectedPropType to the actual stat in the JSONB
          switch (selectedPropType) {
            case 'points':
              value = statsData.points || 0;
              break;
            case 'rebounds':
              value = statsData.rebounds || 0;
              break;
            case 'assists':
              value = statsData.assists || 0;
              break;
            case 'steals':
              value = statsData.steals || 0;
              break;
            case 'blocks':
              value = statsData.blocks || 0;
              break;
            case 'three_pointers':
              value = statsData.three_pointers_made || 0;
              break;
            default:
              value = statsData[selectedPropType] || 0;
          }

          return {
            game_date: statsData.game_date || stat.created_at,
            opponent: 'VS OPP', // Placeholder as this data isn't in the stats
            is_home: Math.random() > 0.5, // Placeholder
            value,
            game_result: statsData.plus_minus && statsData.plus_minus > 0 ? 'W' : 'L'
          };
        }).filter(stat => stat.value !== undefined);
      }

      // Fallback to player_recent_stats if no game stats found
      if (formattedStats.length === 0) {
        const { data: recentStatsData, error: recentStatsError } = await supabase
          .from('player_recent_stats')
          .select('*')
          .eq('player_id', player.id)
          .order('game_date', { ascending: false })
          .limit(10);

        if (!recentStatsError && recentStatsData && recentStatsData.length > 0) {
          formattedStats = recentStatsData.map(stat => ({
            game_date: stat.game_date,
            opponent: stat.opponent,
            is_home: stat.is_home,
            value: stat[selectedPropType] || 0,
            game_result: stat.game_result
          }));
        }
      }

      // If we still have no data, inform user instead of using mock data
      if (formattedStats.length === 0) {
        setGameStats([]);
        return;
      }

      setGameStats(formattedStats.reverse()); // Show oldest to newest for chart
    } catch (error) {
      console.error('Error fetching player stats:', error);
      setGameStats([]); // No mock data - show empty state
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentPropLine = async () => {
    if (!player) return;

    try {
      // Map UI prop to possible prop_key aliases by sport
      const sport = player.sport;
      const aliasMap: Record<string, Record<string, string[]>> = {
        MLB: {
          hits: ['player_hits', 'batter_hits', 'hits', 'player_hits_o_u'],
          home_runs: ['player_home_runs', 'batter_home_runs', 'home_runs'],
          rbis: ['player_rbis', 'batter_rbis', 'rbi', 'rbis'],
          runs_scored: ['batter_runs_scored', 'runs', 'player_runs_scored'],
          total_bases: ['player_total_bases', 'batter_total_bases', 'total_bases'],
          strikeouts: ['player_strikeouts', 'strikeouts'],
          strikeouts_pitched: ['pitcher_strikeouts', 'strikeouts_pitched'],
          hits_allowed: ['pitcher_hits_allowed', 'hits_allowed']
        },
        NBA: {
          points: ['player_points', 'points'],
          rebounds: ['player_rebounds', 'rebounds'],
          assists: ['player_assists', 'assists'],
          three_pointers: ['threes', 'three_pointers']
        },
        WNBA: {
          points: ['player_points', 'points'],
          rebounds: ['player_rebounds', 'rebounds'],
          assists: ['player_assists', 'assists'],
          three_pointers: ['threes', 'three_pointers']
        },
        NFL: {
          passing_yards: ['player_pass_yds'],
          rushing_yards: ['player_rush_yds'],
          receiving_yards: ['player_reception_yds'],
          receptions: ['player_receptions']
        }
      };
      const aliases = aliasMap[sport]?.[selectedPropType] || [selectedPropType];

      // Find prop_type_id for any alias
      const { data: propTypeRows, error: propTypeErr } = await supabase
        .from('player_prop_types')
        .select('id, prop_key')
        .in('prop_key', aliases)
        .limit(1);
      if (propTypeErr) throw propTypeErr;

      let line: number | null = null;
      if (propTypeRows && propTypeRows.length > 0) {
        const propTypeId = propTypeRows[0].id;
        const { data: oddsRows } = await supabase
          .from('player_props_odds')
          .select('line, last_update')
          .eq('player_id', player.id)
          .eq('prop_type_id', propTypeId)
          .order('last_update', { ascending: false })
          .limit(1);
        if (oddsRows && oddsRows.length > 0) {
          line = Number(oddsRows[0].line);
        }
      }
      // Fallback default if not found
      if (line === null) {
        const mockLines: Record<string, number> = {
          hits: 1.5,
          home_runs: 0.5,
          rbis: 1.5,
          runs_scored: 1.5,
          points: 18.5,
          rebounds: 8.5,
          assists: 6.5
        };
        line = mockLines[selectedPropType] ?? 1.5;
      }
      setCurrentPropLine(line);
    } catch (error) {
      console.error('Error fetching prop line:', error);
      setCurrentPropLine(1.5); // Default mock line
    }
  };

  const renderChart = () => {
    if (gameStats.length === 0) return null;

    const maxValue = Math.max(...gameStats.map(stat => stat.value), currentPropLine || 0) + 1;
    const barWidth = (chartWidth - 60) / gameStats.length;
    const barSpacing = barWidth * 0.8;
    
    return (
      <View style={{ alignItems: 'center', marginVertical: 20 }}>
        <Text style={{
          fontSize: 18,
          fontWeight: '600',
          color: '#FFFFFF',
          marginBottom: 16,
          textAlign: 'center'
        }}>
          Last 10 Games - {propTypes.find(p => p.key === selectedPropType)?.name}
        </Text>
        
        <Svg width={chartWidth} height={chartHeight + 60}>
          <Defs>
            <SvgLinearGradient id="overGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#10B981" stopOpacity={1} />
              <Stop offset="100%" stopColor="#059669" stopOpacity={1} />
            </SvgLinearGradient>
            <SvgLinearGradient id="underGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#6B7280" stopOpacity={1} />
              <Stop offset="100%" stopColor="#4B5563" stopOpacity={1} />
            </SvgLinearGradient>
          </Defs>

          {/* Draw bars */}
          {gameStats.map((stat, index) => {
            const barHeight = (stat.value / maxValue) * chartHeight;
            const x = 30 + index * barWidth;
            const y = chartHeight - barHeight;
            const isOver = currentPropLine ? stat.value > currentPropLine : false;
            
            return (
              <G key={index}>
                {/* Bar */}
                <Rect
                  x={x}
                  y={y}
                  width={barSpacing}
                  height={barHeight}
                  fill={isOver ? "url(#overGradient)" : "url(#underGradient)"}
                  rx={4}
                />
                
                {/* Value label on top of bar */}
                <SvgText
                  x={x + barSpacing / 2}
                  y={y - 5}
                  fontSize="12"
                  fill="#FFFFFF"
                  textAnchor="middle"
                  fontWeight="600"
                >
                  {stat.value}
                </SvgText>
                
                {/* Game date at bottom */}
                <SvgText
                  x={x + barSpacing / 2}
                  y={chartHeight + 15}
                  fontSize="10"
                  fill="#9CA3AF"
                  textAnchor="middle"
                  transform={`rotate(-45, ${x + barSpacing / 2}, ${chartHeight + 15})`}
                >
                  {new Date(stat.game_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </SvgText>
                
                {/* Opponent */}
                <SvgText
                  x={x + barSpacing / 2}
                  y={chartHeight + 30}
                  fontSize="9"
                  fill="#6B7280"
                  textAnchor="middle"
                >
                  {stat.is_home ? 'vs' : '@'} {stat.opponent}
                </SvgText>
              </G>
            );
          })}

          {/* Prop line */}
          {currentPropLine && (
            <G>
              <Line
                x1={20}
                y1={chartHeight - (currentPropLine / maxValue) * chartHeight}
                x2={chartWidth - 20}
                y2={chartHeight - (currentPropLine / maxValue) * chartHeight}
                stroke="#F59E0B"
                strokeWidth={2}
                strokeDasharray="5,5"
              />
              <Circle
                cx={chartWidth - 15}
                cy={chartHeight - (currentPropLine / maxValue) * chartHeight}
                r={4}
                fill="#F59E0B"
              />
              <SvgText
                x={chartWidth - 40}
                y={chartHeight - (currentPropLine / maxValue) * chartHeight - 8}
                fontSize="12"
                fill="#F59E0B"
                textAnchor="end"
                fontWeight="600"
              >
                {currentPropLine}
              </SvgText>
            </G>
          )}
        </Svg>

        {/* Legend */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'center',
          marginTop: 16,
          gap: 24
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{
              width: 16,
              height: 16,
              backgroundColor: '#10B981',
              borderRadius: 4,
              marginRight: 8
            }} />
            <Text style={{ color: '#FFFFFF', fontSize: 14 }}>Over Line</Text>
          </View>
          
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{
              width: 16,
              height: 16,
              backgroundColor: '#6B7280',
              borderRadius: 4,
              marginRight: 8
            }} />
            <Text style={{ color: '#FFFFFF', fontSize: 14 }}>Under Line</Text>
          </View>
          
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{
              width: 16,
              height: 2,
              backgroundColor: '#F59E0B',
              marginRight: 8
            }} />
            <Text style={{ color: '#FFFFFF', fontSize: 14 }}>Prop Line ({currentPropLine})</Text>
          </View>
        </View>
      </View>
    );
  };

  const getSportColor = (sport: string) => {
    const colors = {
      'MLB': '#1E40AF',
      'WNBA': '#DC2626', 
      'NBA': '#DC2626',
      'NFL': '#16A34A',
      'UFC': '#EA580C'
    };
    return colors[sport as keyof typeof colors] || '#6B7280';
  };

  const getOverUnderStats = () => {
    if (!currentPropLine || gameStats.length === 0) return { over: 0, under: 0, percentage: 0 };
    
    const overCount = gameStats.filter(stat => stat.value > currentPropLine).length;
    const underCount = gameStats.length - overCount;
    const percentage = Math.round((overCount / gameStats.length) * 100);
    
    return { over: overCount, under: underCount, percentage };
  };

  const stats = getOverUnderStats();

  if (!player) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: '#0A0A0B' }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 20,
          paddingTop: 50,
          borderBottomWidth: 1,
          borderBottomColor: '#374151'
        }}>
          <View style={{ flex: 1 }}>
            <Text style={{
              fontSize: 24,
              fontWeight: 'bold',
              color: '#FFFFFF',
              marginBottom: 4
            }}>
              {player.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{
                backgroundColor: getSportColor(player.sport),
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 6,
                marginRight: 8
              }}>
                <Text style={{
                  color: '#FFFFFF',
                  fontSize: 12,
                  fontWeight: '600'
                }}>
                  {player.sport}
                </Text>
              </View>
              <Text style={{
                color: '#9CA3AF',
                fontSize: 16
              }}>
                {player.team} • {player.position || 'Player'}
              </Text>
            </View>
          </View>
          
          <TouchableOpacity
            onPress={onClose}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: '#1F2937',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {/* Prop Type Selector */}
          <View style={{ padding: 20, paddingBottom: 0 }}>
            <Text style={{
              fontSize: 18,
              fontWeight: '600',
              color: '#FFFFFF',
              marginBottom: 12
            }}>
              Select Prop Type
            </Text>
            
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 4 }}
            >
              {propTypes.map((prop) => (
                <TouchableOpacity
                  key={prop.key}
                  onPress={() => setSelectedPropType(prop.key)}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    marginRight: 12,
                    borderRadius: 20,
                    backgroundColor: selectedPropType === prop.key ? '#3B82F6' : '#1F2937',
                    borderWidth: 1,
                    borderColor: selectedPropType === prop.key ? '#3B82F6' : '#374151'
                  }}
                >
                  <Text style={{
                    color: selectedPropType === prop.key ? '#FFFFFF' : '#9CA3AF',
                    fontWeight: selectedPropType === prop.key ? '600' : 'normal',
                    fontSize: 14
                  }}>
                    {prop.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Stats Summary */}
          <View style={{
            marginHorizontal: 20,
            marginTop: 20,
            padding: 16,
            backgroundColor: '#1F2937',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#374151'
          }}>
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: '#FFFFFF',
              marginBottom: 12,
              textAlign: 'center'
            }}>
              Performance Summary
            </Text>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{
                  fontSize: 24,
                  fontWeight: 'bold',
                  color: '#10B981'
                }}>
                  {stats.over}
                </Text>
                <Text style={{
                  fontSize: 12,
                  color: '#9CA3AF'
                }}>
                  Over Line
                </Text>
              </View>
              
              <View style={{ alignItems: 'center' }}>
                <Text style={{
                  fontSize: 24,
                  fontWeight: 'bold',
                  color: '#6B7280'
                }}>
                  {stats.under}
                </Text>
                <Text style={{
                  fontSize: 12,
                  color: '#9CA3AF'
                }}>
                  Under Line
                </Text>
              </View>
              
              <View style={{ alignItems: 'center' }}>
                <Text style={{
                  fontSize: 24,
                  fontWeight: 'bold',
                  color: '#F59E0B'
                }}>
                  {stats.percentage}%
                </Text>
                <Text style={{
                  fontSize: 12,
                  color: '#9CA3AF'
                }}>
                  Over Rate
                </Text>
              </View>
            </View>
          </View>

          {/* Chart */}
          {loading ? (
            <View style={{
              height: 300,
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={{
                color: '#9CA3AF',
                marginTop: 16,
                fontSize: 16
              }}>
                Loading player trends...
              </Text>
            </View>
          ) : gameStats.length === 0 ? (
            <View style={{
              height: 300,
              justifyContent: 'center',
              alignItems: 'center',
              marginHorizontal: 20
            }}>
              <Ionicons name="stats-chart-outline" size={64} color="#6B7280" />
              <Text style={{
                color: '#FFFFFF',
                marginTop: 16,
                fontSize: 18,
                fontWeight: '600',
                textAlign: 'center'
              }}>
                No Recent Game Data
              </Text>
              <Text style={{
                color: '#9CA3AF',
                marginTop: 8,
                fontSize: 14,
                textAlign: 'center',
                lineHeight: 20
              }}>
                We don't have recent {propTypes.find(p => p.key === selectedPropType)?.name.toLowerCase()} stats for {player?.name} yet.{'\n'}Check back after their next game!
              </Text>
            </View>
          ) : (
            renderChart()
          )}

          {/* Game by Game Breakdown */}
          <View style={{
            marginHorizontal: 20,
            marginTop: 20,
            padding: 16,
            backgroundColor: '#1F2937',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#374151'
          }}>
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: '#FFFFFF',
              marginBottom: 12
            }}>
              Game by Game Breakdown
            </Text>
            
            {gameStats.slice().reverse().map((stat, index) => (
              <View key={index} style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 8,
                borderBottomWidth: index < gameStats.length - 1 ? 1 : 0,
                borderBottomColor: '#374151'
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{
                    color: '#FFFFFF',
                    fontSize: 14,
                    fontWeight: '500'
                  }}>
                    {new Date(stat.game_date).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric' 
                    })} {stat.is_home ? 'vs' : '@'} {stat.opponent}
                  </Text>
                </View>
                
                <View style={{
                  backgroundColor: currentPropLine && stat.value > currentPropLine ? '#10B981' : '#6B7280',
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 6,
                  minWidth: 40,
                  alignItems: 'center'
                }}>
                  <Text style={{
                    color: '#FFFFFF',
                    fontSize: 14,
                    fontWeight: '600'
                  }}>
                    {stat.value}
                  </Text>
                </View>
                
                {stat.game_result && (
                  <View style={{
                    backgroundColor: stat.game_result === 'W' ? '#10B981' : '#DC2626',
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 4,
                    marginLeft: 8
                  }}>
                    <Text style={{
                      color: '#FFFFFF',
                      fontSize: 12,
                      fontWeight: '600'
                    }}>
                      {stat.game_result}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}
