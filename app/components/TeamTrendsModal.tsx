import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

interface Team {
  id: string;
  name: string;
  abbreviation: string;
  city: string;
  sport: string;
  logo_url?: string;
}

interface TeamGameStat {
  game_date: string;
  opponent: string;
  is_home: boolean;
  value: number;
  game_result?: string;
  opponent_score?: number;
  team_score?: number;
}

interface TeamPropType {
  key: string;
  name: string;
  current_line?: number;
}

interface TeamTrendsModalProps {
  visible: boolean;
  team: Team | null;
  onClose: () => void;
}

const { width: screenWidth } = Dimensions.get('window');
const chartWidth = screenWidth - 80;
const chartHeight = 200;

export default function TeamTrendsModal({ visible, team, onClose }: TeamTrendsModalProps) {
  const [loading, setLoading] = useState(false);
  const [gameStats, setGameStats] = useState<TeamGameStat[]>([]);
  const [selectedPropType, setSelectedPropType] = useState<string>('points_scored');
  const [propTypes, setPropTypes] = useState<TeamPropType[]>([]);
  const [currentSportsbookLine, setCurrentSportsbookLine] = useState<number | null>(null);

  const getAvailableProps = (sport: string): TeamPropType[] => {
    const propMappings = {
      'MLB': [
        { key: 'points_scored', name: 'Runs Scored' },
        { key: 'points_allowed', name: 'Runs Allowed' },
        { key: 'run_differential', name: 'Run Differential' }
      ],
      'NBA': [
        { key: 'points_scored', name: 'Points Scored' },
        { key: 'points_allowed', name: 'Points Allowed' },
        { key: 'point_differential', name: 'Point Differential' }
      ],
      'WNBA': [
        { key: 'points_scored', name: 'Points Scored' },
        { key: 'points_allowed', name: 'Points Allowed' },
        { key: 'point_differential', name: 'Point Differential' }
      ],
      'NFL': [
        { key: 'points_scored', name: 'Points Scored' },
        { key: 'points_allowed', name: 'Points Allowed' },
        { key: 'point_differential', name: 'Point Differential' }
      ]
    };

    return propMappings[sport as keyof typeof propMappings] || [];
  };

  useEffect(() => {
    if (visible && team) {
      const props = getAvailableProps(team.sport);
      setPropTypes(props);
      if (props.length > 0) {
        setSelectedPropType(props[0].key);
      }
      fetchTeamTrends();
    }
  }, [visible, team, selectedPropType]);

  const fetchTeamTrends = async () => {
    if (!team) return;

    setLoading(true);
    try {
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://zooming-rebirth-production-a305.up.railway.app';
      const apiUrl = `${backendUrl}/api/teams/${team.id}/trends`;
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        const recentGames = data.recent_games || [];
        const formattedStats: TeamGameStat[] = recentGames.map((game: any) => {
          let value = 0;
          
          switch (selectedPropType) {
            case 'points_scored':
              value = game.team_score || 0;
              break;
            case 'points_allowed':
              value = game.opponent_score || 0;
              break;
            case 'point_differential':
            case 'run_differential':
              value = (game.team_score || 0) - (game.opponent_score || 0);
              break;
            default:
              value = game[selectedPropType] || 0;
          }

          return {
            game_date: game.game_date,
            opponent: game.opponent,
            is_home: game.is_home,
            value,
            game_result: game.game_result,
            team_score: game.team_score,
            opponent_score: game.opponent_score
          };
        });

        setGameStats(formattedStats.reverse());
        
        // Set sportsbook line from API data
        const lines = data.sportsbook_lines || [];
        const relevantLine = findRelevantLine(lines);
        setCurrentSportsbookLine(relevantLine);
        
      } else {
        setGameStats([]);
      }
    } catch (error) {
      console.error('Error fetching team trends:', error);
      Alert.alert('Error', 'Failed to load team trends');
      setGameStats([]);
    } finally {
      setLoading(false);
    }
  };

  const findRelevantLine = (lines: any[]): number | null => {
    const lineTypeMap: Record<string, string[]> = {
      'points_scored': ['total_points', 'team_total', 'over_under'],
      'points_allowed': ['total_points', 'team_total', 'over_under'],
      'point_differential': ['spread', 'point_spread'],
      'run_differential': ['spread', 'run_line']
    };

    const relevantLineTypes = lineTypeMap[selectedPropType] || [];
    const relevantLines = lines.filter(line => 
      relevantLineTypes.some(type => line.line_type?.toLowerCase().includes(type.toLowerCase()))
    );

    if (relevantLines.length > 0) {
      relevantLines.sort((a, b) => new Date(b.game_date).getTime() - new Date(a.game_date).getTime());
      return relevantLines[0].line_value;
    }

    const defaultLines: Record<string, number> = {
      points_scored: team?.sport === 'MLB' ? 4.5 : 110.5,
      points_allowed: team?.sport === 'MLB' ? 4.5 : 110.5,
      point_differential: 0,
      run_differential: 0
    };

    return defaultLines[selectedPropType] ?? null;
  };

  const renderChart = () => {
    if (gameStats.length === 0) return null;

    const maxValue = Math.max(...gameStats.map(stat => Math.abs(stat.value)), Math.abs(currentSportsbookLine || 0)) + 2;
    const minValue = Math.min(...gameStats.map(stat => stat.value), currentSportsbookLine || 0) - 2;
    const valueRange = maxValue - minValue;
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
            <SvgLinearGradient id="winGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#10B981" stopOpacity={1} />
              <Stop offset="100%" stopColor="#059669" stopOpacity={1} />
            </SvgLinearGradient>
            <SvgLinearGradient id="lossGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#DC2626" stopOpacity={1} />
              <Stop offset="100%" stopColor="#B91C1C" stopOpacity={1} />
            </SvgLinearGradient>
          </Defs>

          {/* Zero line for differential stats */}
          {(selectedPropType.includes('differential') || selectedPropType.includes('spread')) && (
            <Line
              x1={20}
              y1={chartHeight - ((-minValue) / valueRange) * chartHeight}
              x2={chartWidth - 20}
              y2={chartHeight - ((-minValue) / valueRange) * chartHeight}
              stroke="#4B5563"
              strokeWidth={1}
              strokeDasharray="2,2"
            />
          )}

          {/* Draw bars */}
          {gameStats.map((stat, index) => {
            const normalizedValue = (stat.value - minValue) / valueRange;
            const x = 30 + index * barWidth;
            const y = chartHeight - normalizedValue * chartHeight;
            
            let fillColor = stat.game_result === 'W' ? "url(#winGradient)" : "url(#lossGradient)";
            
            return (
              <G key={index}>
                <Rect
                  x={x}
                  y={Math.min(y, chartHeight - ((-minValue) / valueRange) * chartHeight)}
                  width={barSpacing}
                  height={Math.abs(y - (chartHeight - ((-minValue) / valueRange) * chartHeight))}
                  fill={fillColor}
                  rx={4}
                />
                
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

          {/* Horizontal dotted sportsbook line */}
          {currentSportsbookLine !== null && (
            <G>
              <Line
                x1={20}
                y1={chartHeight - ((currentSportsbookLine - minValue) / valueRange) * chartHeight}
                x2={chartWidth - 20}
                y2={chartHeight - ((currentSportsbookLine - minValue) / valueRange) * chartHeight}
                stroke="#F59E0B"
                strokeWidth={3}
                strokeDasharray="8,4"
              />
              <Circle
                cx={chartWidth - 15}
                cy={chartHeight - ((currentSportsbookLine - minValue) / valueRange) * chartHeight}
                r={5}
                fill="#F59E0B"
              />
              <SvgText
                x={chartWidth - 45}
                y={chartHeight - ((currentSportsbookLine - minValue) / valueRange) * chartHeight - 8}
                fontSize="12"
                fill="#F59E0B"
                textAnchor="end"
                fontWeight="600"
              >
                {currentSportsbookLine}
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
            <Text style={{ color: '#FFFFFF', fontSize: 14 }}>Win</Text>
          </View>
          
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{
              width: 16,
              height: 16,
              backgroundColor: '#DC2626',
              borderRadius: 4,
              marginRight: 8
            }} />
            <Text style={{ color: '#FFFFFF', fontSize: 14 }}>Loss</Text>
          </View>
          
          {currentSportsbookLine !== null && (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{
                width: 16,
                height: 3,
                backgroundColor: '#F59E0B',
                marginRight: 8
              }} />
              <Text style={{ color: '#FFFFFF', fontSize: 14 }}>Sportsbook Line</Text>
            </View>
          )}
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

  const getPerformanceStats = () => {
    if (gameStats.length === 0) return { wins: 0, losses: 0, winRate: 0, overLine: 0, overRate: 0 };
    
    const wins = gameStats.filter(stat => stat.game_result === 'W').length;
    const losses = gameStats.filter(stat => stat.game_result === 'L').length;
    const winRate = Math.round((wins / gameStats.length) * 100);
    
    let overLine = 0;
    if (currentSportsbookLine !== null) {
      overLine = gameStats.filter(stat => {
        if (selectedPropType.includes('differential')) {
          return stat.value > currentSportsbookLine;
        } else {
          return stat.value > currentSportsbookLine;
        }
      }).length;
    }
    const overRate = gameStats.length > 0 ? Math.round((overLine / gameStats.length) * 100) : 0;
    
    return { wins, losses, winRate, overLine, overRate };
  };

  const stats = getPerformanceStats();

  if (!team) return null;

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
          padding: 20,
          paddingTop: 50,
          borderBottomWidth: 1,
          borderBottomColor: '#374151'
        }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 16
          }}>
            {/* Team Logo */}
            <View style={{
              position: 'relative',
              marginRight: 16
            }}>
              <View style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                borderWidth: 3,
                borderColor: getSportColor(team.sport),
                backgroundColor: '#374151',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: getSportColor(team.sport),
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 8
              }}>
                <Text style={{
                  color: '#FFFFFF',
                  fontSize: 18,
                  fontWeight: 'bold'
                }}>
                  {team.abbreviation}
                </Text>
                <View style={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: getSportColor(team.sport),
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: '#0A0A0B'
                }}>
                  <Text style={{
                    color: '#FFFFFF',
                    fontSize: 10,
                    fontWeight: 'bold'
                  }}>
                    {team.sport === 'MLB' ? '⚾' : team.sport === 'WNBA' || team.sport === 'NBA' ? '🏀' : '🏈'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Team Info */}
            <View style={{ flex: 1 }}>
              <Text style={{
                fontSize: 24,
                fontWeight: 'bold',
                color: '#FFFFFF',
                marginBottom: 6
              }}>
                {team.name}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <View style={{
                  backgroundColor: getSportColor(team.sport),
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 8,
                  marginRight: 10
                }}>
                  <Text style={{
                    color: '#FFFFFF',
                    fontSize: 12,
                    fontWeight: '700'
                  }}>
                    {team.sport}
                  </Text>
                </View>
                <Text style={{
                  color: '#D1D5DB',
                  fontSize: 16,
                  fontWeight: '600'
                }}>
                  {team.city}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: '#1F2937',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: '#374151'
              }}
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
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
              Select Metric
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
                  {stats.wins}
                </Text>
                <Text style={{
                  fontSize: 12,
                  color: '#9CA3AF'
                }}>
                  Wins
                </Text>
              </View>
              
              <View style={{ alignItems: 'center' }}>
                <Text style={{
                  fontSize: 24,
                  fontWeight: 'bold',
                  color: '#DC2626'
                }}>
                  {stats.losses}
                </Text>
                <Text style={{
                  fontSize: 12,
                  color: '#9CA3AF'
                }}>
                  Losses
                </Text>
              </View>
              
              <View style={{ alignItems: 'center' }}>
                <Text style={{
                  fontSize: 24,
                  fontWeight: 'bold',
                  color: '#F59E0B'
                }}>
                  {stats.winRate}%
                </Text>
                <Text style={{
                  fontSize: 12,
                  color: '#9CA3AF'
                }}>
                  Win Rate
                </Text>
              </View>

              {currentSportsbookLine !== null && (
                <View style={{ alignItems: 'center' }}>
                  <Text style={{
                    fontSize: 24,
                    fontWeight: 'bold',
                    color: '#3B82F6'
                  }}>
                    {stats.overRate}%
                  </Text>
                  <Text style={{
                    fontSize: 12,
                    color: '#9CA3AF'
                  }}>
                    Over Line
                  </Text>
                </View>
              )}
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
                Loading team trends...
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
                We don't have recent {propTypes.find(p => p.key === selectedPropType)?.name.toLowerCase()} stats for {team?.name} yet.{'\n'}Check back after their next game!
              </Text>
            </View>
          ) : (
            renderChart()
          )}

          {/* Game by Game Breakdown */}
          {gameStats.length > 0 && (
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
                    {stat.team_score !== undefined && stat.opponent_score !== undefined && (
                      <Text style={{
                        color: '#9CA3AF',
                        fontSize: 12,
                        marginTop: 2
                      }}>
                        Score: {stat.team_score} - {stat.opponent_score}
                      </Text>
                    )}
                  </View>
                  
                  <View style={{
                    backgroundColor: currentSportsbookLine && stat.value > currentSportsbookLine ? '#10B981' : '#6B7280',
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
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}
