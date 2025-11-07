import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Alert,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import EnhancedTrendCard from './EnhancedTrendCard';
import { useUITheme } from '../services/uiThemeContext';
import { useSubscription } from '../services/subscriptionContext';
import { trendsService } from '../services/trendsService';

interface FilterOption {
  key: string;
  name: string;
  icon: string;
  value?: any;
}

interface TrendData {
  id: string;
  player: {
    id: string;
    name: string;
    team: string;
    sport: string;
    position?: string;
    headshot_url?: string;
  };
  market_type: string;
  market_display_name: string;
  confidence_score: number;
  hit_rate: number;
  current_streak: number;
  streak_type: 'over' | 'under';
  sample_size: number;
  avg_value: number;
  median_value: number;
  last_10_games: any[];
  ai_reasoning?: string;
  key_factors: string[];
  sportsbook_odds: any[];
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

interface EnhancedTrendsListProps {
  onAddToPicks: (trend: TrendData) => void;
  onViewDetails: (trend: TrendData) => void;
}

const { width: screenWidth } = Dimensions.get('window');

export default function EnhancedTrendsList({ onAddToPicks, onViewDetails }: EnhancedTrendsListProps) {
  const { theme } = useUITheme();
  const { isElite, isPro } = useSubscription();
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSport, setSelectedSport] = useState<string>('all');
  const [selectedConfidence, setSelectedConfidence] = useState<number>(60);
  const [sortBy, setSortBy] = useState<string>('hit_rate');
  const [showFilters, setShowFilters] = useState(false);
  const [aiInsights, setAiInsights] = useState<any[]>([]);
  const [minSampleSize, setMinSampleSize] = useState<number>(5);
  const [gamesWindow, setGamesWindow] = useState<number>(10);
  const filterHeight = useRef(new Animated.Value(0)).current;

  const sports: FilterOption[] = [
    { key: 'all', name: 'All', icon: '🏆' },
    { key: 'NFL', name: 'NFL', icon: '🏈' },
    { key: 'NBA', name: 'NBA', icon: '🏀' },
    { key: 'MLB', name: 'MLB', icon: '⚾' },
    { key: 'WNBA', name: 'WNBA', icon: '🏀' },
    { key: 'College Football', name: 'CFB', icon: '🏈' },
    { key: 'UFC', name: 'UFC', icon: '🥊' }
  ];

  const sortOptions: FilterOption[] = [
    { key: 'hit_rate', name: 'Best Hit Rate', icon: '📊' },
    { key: 'confidence', name: 'Confidence (Legacy)', icon: '🎯' },
    { key: 'value', name: 'Best Value', icon: '💎' },
    { key: 'streak', name: 'Longest Streak', icon: '🔥' },
    { key: 'recent', name: 'Most Recent', icon: '⏰' }
  ];

  useEffect(() => {
    loadTrends();
    loadAIInsights();
  }, [selectedSport, selectedConfidence, sortBy, minSampleSize, gamesWindow]);

  const loadTrends = async () => {
    try {
      setLoading(true);
      const data = await trendsService.getEnhancedTrends({
        sport: selectedSport === 'all' ? undefined : selectedSport,
        hit_rate_min: selectedConfidence,
        sort_by: (sortBy as any),
        limit: 20,
        min_sample_size: minSampleSize,
        games_window: gamesWindow,
      });
      setTrends(data || []);
    } catch (error) {
      console.error('Error loading trends:', error);
      setTrends([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAIInsights = async () => {
    try {
      if (!isPro && !isElite) return;
      const insights = await trendsService.getAIInsights();
      setAiInsights(insights || []);
    } catch (error) {
      console.error('Error loading AI insights:', error);
    }
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
    Animated.timing(filterHeight, {
      toValue: showFilters ? 0 : 200,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTrends();
    await loadAIInsights();
    setRefreshing(false);
  };

  const renderAIInsightsCard = () => {
    if (!isPro && !isElite) return null;
    if (!aiInsights || aiInsights.length === 0) return null;

    const iconForType = (type: string) => {
      switch (type) {
        case 'value': return 'trending-up';
        case 'weather': return 'cloudy';
        case 'injury': return 'medkit';
        case 'trend': return 'pulse';
        case 'contrarian': return 'flash';
        default: return 'sparkles';
      }
    };

    return (
      <View style={{
        backgroundColor: isElite ? `${theme.accentPrimary}1A` : 'rgba(59, 130, 246, 0.1)',
        borderRadius: 16,
        margin: 20,
        marginBottom: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: isElite ? `${theme.accentPrimary}33` : '#3B82F6'
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Ionicons 
            name="sparkles" 
            size={20} 
            color={isElite ? theme.accentPrimary : '#3B82F6'} 
            style={{ marginRight: 8 }} 
          />
          <Text style={{
            color: isElite ? theme.accentPrimary : '#3B82F6',
            fontSize: 16,
            fontWeight: '700'
          }}>
            Today's AI Insights
          </Text>
        </View>
        
        <View style={{ gap: 10 }}>
          {aiInsights.slice(0, 3).map((ins: any) => (
            <View key={ins.id} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <Ionicons 
                name={iconForType(ins.type) as any}
                size={16}
                color={isElite ? theme.accentPrimary : '#3B82F6'}
                style={{ marginRight: 8, marginTop: 2 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600' }}>
                  {ins.title}
                </Text>
                <Text style={{ color: '#D1D5DB', fontSize: 13, lineHeight: 18 }}>
                  {ins.description}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderFilterBar = () => (
    <View>
      {/* Quick Filters */}
      <View style={{
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginBottom: 12,
        alignItems: 'center'
      }}>
        <View style={{ flex: 1, flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={toggleFilters}
            style={{
              backgroundColor: '#374151',
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 10,
              flexDirection: 'row',
              alignItems: 'center'
            }}
          >
            <Ionicons name="filter" size={16} color="#9CA3AF" style={{ marginRight: 6 }} />
            <Text style={{ color: '#D1D5DB', fontSize: 14, fontWeight: '500' }}>
              Filters
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={{
              backgroundColor: selectedSport !== 'all' ? (isElite ? theme.accentPrimary : '#3B82F6') : '#374151',
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 10
            }}
          >
            <Text style={{
              color: selectedSport !== 'all' ? '#FFFFFF' : '#D1D5DB',
              fontSize: 14,
              fontWeight: '600'
            }}>
              {sports.find(s => s.key === selectedSport)?.name || 'All Sports'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={{
            backgroundColor: '#374151',
            borderRadius: 12,
            padding: 10
          }}
        >
          <Ionicons name="swap-vertical" size={18} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      {/* Expandable Filter Panel */}
      <Animated.View
        style={{
          height: filterHeight,
          overflow: 'hidden',
          paddingHorizontal: 20
        }}
      >
        <View style={{
          backgroundColor: '#1F2937',
          borderRadius: 16,
          padding: 16,
          marginBottom: 12
        }}>
          {/* Sport Selection */}
          <Text style={{
            color: '#FFFFFF',
            fontSize: 16,
            fontWeight: '600',
            marginBottom: 12
          }}>
            Sports
          </Text>
          <View style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 20
          }}>
            {sports.map((sport) => (
              <TouchableOpacity
                key={sport.key}
                onPress={() => setSelectedSport(sport.key)}
                style={{
                  backgroundColor: selectedSport === sport.key ? (isElite ? theme.accentPrimary : '#3B82F6') : '#374151',
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 12
                }}
              >
                <Text style={{
                  color: selectedSport === sport.key ? '#FFFFFF' : '#9CA3AF',
                  fontSize: 13,
                  fontWeight: '600'
                }}>
                  {sport.icon} {sport.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Hit Rate Threshold */}
          <Text style={{
            color: '#FFFFFF',
            fontSize: 16,
            fontWeight: '600',
            marginBottom: 12
          }}>
            Minimum Hit Rate: {selectedConfidence}%
          </Text>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 20
          }}>
            {[60, 70, 80, 90].map((threshold) => (
              <TouchableOpacity
                key={threshold}
                onPress={() => setSelectedConfidence(threshold)}
                style={{
                  backgroundColor: selectedConfidence === threshold ? '#10B981' : '#374151',
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 12
                }}
              >
                <Text style={{
                  color: selectedConfidence === threshold ? '#FFFFFF' : '#9CA3AF',
                  fontSize: 13,
                  fontWeight: '600'
                }}>
                  {threshold}%+
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={{
            color: '#FFFFFF',
            fontSize: 16,
            fontWeight: '600',
            marginBottom: 12
          }}>
            Last N Games
          </Text>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 20
          }}>
            {[5, 10, 20].map((n) => (
              <TouchableOpacity
                key={n}
                onPress={() => setGamesWindow(n)}
                style={{
                  backgroundColor: gamesWindow === n ? '#10B981' : '#374151',
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 12
                }}
              >
                <Text style={{
                  color: gamesWindow === n ? '#FFFFFF' : '#9CA3AF',
                  fontSize: 13,
                  fontWeight: '600'
                }}>
                  {n}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={{
            color: '#FFFFFF',
            fontSize: 16,
            fontWeight: '600',
            marginBottom: 12
          }}>
            Min Sample Size
          </Text>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 8
          }}>
            {[3, 5, 10].map((n) => (
              <TouchableOpacity
                key={n}
                onPress={() => setMinSampleSize(n)}
                style={{
                  backgroundColor: minSampleSize === n ? '#10B981' : '#374151',
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 12
                }}
              >
                <Text style={{
                  color: minSampleSize === n ? '#FFFFFF' : '#9CA3AF',
                  fontSize: 13,
                  fontWeight: '600'
                }}>
                  {n}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Animated.View>
    </View>
  );

  const renderTrendCard = ({ item }: { item: TrendData }) => (
    <EnhancedTrendCard
      trend={item}
      onAddToPicks={onAddToPicks}
      onViewDetails={onViewDetails}
    />
  );

  const renderHeader = () => (
    <View>
      {renderAIInsightsCard()}
      {renderFilterBar()}
      
      {/* Results Header */}
      <View style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 12
      }}>
        <Text style={{
          color: '#FFFFFF',
          fontSize: 18,
          fontWeight: '700'
        }}>
          Top Trends ({trends.length})
        </Text>
        
        {trends.length > 0 && (
          <TouchableOpacity
            style={{
              backgroundColor: '#374151',
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 6
            }}
          >
            <Text style={{
              color: '#9CA3AF',
              fontSize: 12,
              fontWeight: '500'
            }}>
              Last updated: 2m ago
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={{
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
      paddingTop: 60
    }}>
      <Ionicons name="analytics-outline" size={64} color="#374151" />
      <Text style={{
        color: '#9CA3AF',
        fontSize: 18,
        fontWeight: '600',
        textAlign: 'center',
        marginTop: 16,
        marginBottom: 8
      }}>
        No trends found
      </Text>
      <Text style={{
        color: '#6B7280',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20
      }}>
        Try adjusting your filters or check back later for new player prop trends
      </Text>
    </View>
  );

  if (loading && trends.length === 0) {
    return (
      <View style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0A0A0B'
      }}>
        <ActivityIndicator size="large" color={isElite ? theme.accentPrimary : '#3B82F6'} />
        <Text style={{
          color: '#9CA3AF',
          fontSize: 16,
          marginTop: 16
        }}>
          Loading enhanced trends...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0B' }}>
      <FlatList
        data={trends}
        renderItem={renderTrendCard}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isElite ? theme.accentPrimary : '#3B82F6'}
            colors={[isElite ? theme.accentPrimary : '#3B82F6']}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
        removeClippedSubviews={true}
        maxToRenderPerBatch={5}
        windowSize={10}
        initialNumToRender={3}
      />
    </View>
  );
}
