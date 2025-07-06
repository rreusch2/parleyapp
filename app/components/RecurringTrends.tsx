import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  TrendingUp, 
  Target, 
  Flame, 
  Trophy, 
  Crown, 
  BarChart3,
  ChevronRight,
  Activity,
  Clock,
  CheckCircle,
  AlertTriangle,
  RefreshCw
} from 'lucide-react-native';
import { useSubscription } from '../services/subscriptionContext';

interface TrendData {
  id: string;
  type: 'player_prop' | 'team_prop';
  player_name?: string;
  team?: string;
  prop_type: string;
  current_streak: number;
  streak_type: 'over' | 'under' | 'hit' | 'cover';
  confidence_score: number;
  trend_strength: 'strong' | 'moderate' | 'weak';
  last_line?: number;
  avg_line?: number;
  games_in_streak: number;
  recent_games?: RecentGame[];
  next_game?: {
    date: string;
    opponent: string;
  };
}

interface RecentGame {
  date: string;
  opponent: string;
  line: number;
  actual_value: number;
  result: 'over' | 'under' | 'hit' | 'cover';
  margin: number;
}

interface TeamTrend {
  team: string;
  trend_type: 'spread_cover' | 'total_over' | 'total_under' | 'moneyline';
  current_streak: number;
  trend_strength: 'strong' | 'moderate' | 'weak';
}

interface RecurringTrendsProps {
  sport?: string;
}

const RecurringTrends: React.FC<RecurringTrendsProps> = ({ sport = 'MLB' }) => {
  const [playerTrends, setPlayerTrends] = useState<TrendData[]>([]);
  const [teamTrends, setTeamTrends] = useState<TeamTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'player' | 'team'>('player');
  const [error, setError] = useState<string | null>(null);
  const { isPro, isLoading: subLoading, openSubscriptionModal } = useSubscription();

  useEffect(() => {
    if (!subLoading) {
      fetchTrends();
    }
  }, [sport, subLoading]);

  const fetchTrends = async () => {
    try {
      if (!isPro) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      // Use appropriate base URL for development 
      const baseUrl = Platform.OS === 'web' ? 'http://localhost:3001' : 'http://192.168.1.58:3001';
      
      console.log(`🔍 Fetching trends for ${sport}...`);

      const [playerResponse, teamResponse] = await Promise.all([
        fetch(`${baseUrl}/api/trends/player-props/${sport.toLowerCase()}?tier=pro&min_streak=3`),
        fetch(`${baseUrl}/api/trends/team/${sport.toLowerCase()}?tier=pro&min_streak=3`)
      ]);

      if (playerResponse.ok) {
        const playerData = await playerResponse.json();
        console.log(`📊 Player trends response:`, playerData);
        console.log(`📊 Trends array length:`, playerData.trends?.length || 0);
        if (playerData.success && playerData.trends) {
          console.log(`✅ Setting ${playerData.trends.length} player trends`);
          setPlayerTrends(playerData.trends);
        } else {
          console.warn('Invalid response structure:', playerData);
          setPlayerTrends([]);
        }
      } else {
        const errorText = await playerResponse.text();
        console.error('Failed to fetch player trends:', playerResponse.status, errorText);
      }

      if (teamResponse.ok) {
        const teamData = await teamResponse.json();
        console.log(`🏆 Team trends response:`, teamData);
        setTeamTrends(teamData.trends || []);
      } else {
        console.warn('Failed to fetch team trends:', teamResponse.status);
      }

    } catch (error) {
      console.error('Error fetching trends:', error);
      setError('Failed to load trends. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTrends();
    setRefreshing(false);
  };

  const handleUpgrade = () => {
    openSubscriptionModal();
  };

  const getStreakIcon = (streakType: string) => {
    switch (streakType) {
      case 'over': return <TrendingUp size={16} color="#10B981" />;
      case 'under': return <TrendingUp size={16} color="#EF4444" style={{ transform: [{ rotate: '180deg' }] }} />;
      case 'hit': return <Target size={16} color="#00E5FF" />;
      case 'cover': return <CheckCircle size={16} color="#8B5CF6" />;
      default: return <Flame size={16} color="#F59E0B" />;
    }
  };



  const shouldShowStrength = (strength: string) => {
    // Only show strong and moderate, hide weak
    return strength === 'strong' || strength === 'moderate';
  };

  const getTrendTypeDisplay = (type: string) => {
    switch (type) {
      case 'spread_cover': return 'Spread Cover';
      case 'total_over': return 'Over Trend';
      case 'total_under': return 'Under Trend';
      case 'moneyline': return 'ML Wins';
      default: return type.replace('_', ' ').toUpperCase();
    }
  };

  const formatLine = (line?: number) => {
    if (!line) return 'N/A';
    return line % 1 === 0 ? line.toString() : line.toFixed(1);
  };

  const renderPlayerTrendCard = (trend: TrendData) => (
    <TouchableOpacity key={trend.id} style={styles.trendCard} activeOpacity={0.8}>
      <LinearGradient
        colors={['#1E293B', '#334155']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.trendCardGradient}
      >
        {/* Header with player info and streak */}
        <View style={styles.trendHeader}>
          <View style={styles.playerSection}>
            <Text style={styles.playerName}>{trend.player_name}</Text>
            <Text style={styles.teamName}>{trend.team}</Text>
          </View>
          <View style={styles.streakDisplay}>
            <View style={styles.streakIconContainer}>
              {getStreakIcon(trend.streak_type)}
            </View>
            <Text style={styles.streakNumber}>{trend.current_streak}</Text>
          </View>
        </View>

        {/* Prominent betting line */}
        <View style={styles.propSection}>
          <Text style={styles.propType}>{trend.prop_type}</Text>
          <View style={styles.propLine}>
            <Text style={styles.propLineText}>
              {trend.streak_type.toUpperCase()} {formatLine(trend.last_line)}
            </Text>
            {shouldShowStrength(trend.trend_strength) && (
              <View style={[
                styles.strengthIndicator,
                { backgroundColor: trend.trend_strength === 'strong' ? '#10B981' : '#F59E0B' }
              ]}>
                <Text style={styles.strengthLabel}>
                  {trend.trend_strength === 'strong' ? 'STRONG' : 'SOLID'}
                </Text>
              </View>
            )}
          </View>
        </View>



        {/* Improved recent games */}
        {trend.recent_games && trend.recent_games.length > 0 && (
          <View style={styles.recentGamesSection}>
            <View style={styles.recentGamesHeader}>
              <Clock size={14} color="#94A3B8" />
              <Text style={styles.recentGamesTitle}>Last 3 Games</Text>
            </View>
            <View style={styles.gamesContainer}>
              {trend.recent_games.slice(0, 3).map((game, index) => (
                <View key={index} style={styles.gameResult}>
                  <Text style={styles.gameOpponent}>{game.opponent}</Text>
                  <View style={styles.gameStats}>
                    <Text style={styles.gameValue}>{game.actual_value}</Text>
                    <Text style={[
                      styles.gameMargin,
                      { color: game.result === 'over' ? '#10B981' : '#EF4444' }
                    ]}>
                      {game.result === 'over' ? '+' : ''}{game.margin.toFixed(1)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}


      </LinearGradient>
    </TouchableOpacity>
  );

  const renderTeamTrendCard = (trend: TeamTrend) => (
    <TouchableOpacity key={trend.team + trend.trend_type} style={styles.trendCard} activeOpacity={0.8}>
      <LinearGradient
        colors={['#1E293B', '#334155']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.trendCardGradient}
      >
        <View style={styles.trendHeader}>
          <View style={styles.playerSection}>
            <Text style={styles.playerName}>{trend.team}</Text>
            <Text style={styles.teamName}>{getTrendTypeDisplay(trend.trend_type)}</Text>
          </View>
          <View style={styles.streakDisplay}>
            <View style={styles.streakIconContainer}>
              <Trophy size={16} color="#F59E0B" />
            </View>
            <Text style={styles.streakNumber}>{trend.current_streak}</Text>
          </View>
        </View>

        {shouldShowStrength(trend.trend_strength) && (
          <View style={styles.teamStrengthSection}>
            <View style={[
              styles.strengthIndicator,
              { backgroundColor: trend.trend_strength === 'strong' ? '#10B981' : '#F59E0B' }
            ]}>
              <Text style={styles.strengthLabel}>
                {trend.trend_strength === 'strong' ? 'STRONG PATTERN' : 'SOLID TREND'}
              </Text>
            </View>
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );

  if (subLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!isPro) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#1a1a2e', '#16213e']}
          style={styles.upgradeCard}
        >
          <View style={styles.upgradeContent}>
            <View style={styles.upgradeIcon}>
              <BarChart3 size={32} color="#00E5FF" />
            </View>
            <Text style={styles.upgradeTitle}>Recurring Trends</Text>
            <Text style={styles.upgradeSubtitle}>Pro Feature</Text>
            <Text style={styles.upgradeDescription}>
              Track player props and team trends that have hit 3+ times in a row. 
              Get the insider edge with hot streaks and pattern recognition.
            </Text>
            <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgrade}>
              <LinearGradient
                colors={['#00E5FF', '#0891B2']}
                style={styles.upgradeButtonGradient}
              >
                <Crown size={16} color="#0F172A" />
                <Text style={styles.upgradeButtonText}>Upgrade to Pro</Text>
                <ChevronRight size={16} color="#0F172A" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Analyzing trends...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <AlertTriangle size={48} color="#EF4444" />
        <Text style={styles.errorTitle}>Unable to Load Trends</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchTrends}>
          <RefreshCw size={16} color="#FFFFFF" />
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <BarChart3 size={24} color="#00E5FF" />
          <Text style={styles.title}>Recurring Trends</Text>
          <View style={styles.proBadge}>
            <Crown size={12} color="#0F172A" />
            <Text style={styles.proText}>PRO</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>
          {sport} • Hot streaks & patterns
        </Text>
      </View>

      {/* Tab Selection */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'player' && styles.activeTab]}
          onPress={() => setActiveTab('player')}
        >
          <Text style={[styles.tabText, activeTab === 'player' && styles.activeTabText]}>
            Player Props ({playerTrends.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'team' && styles.activeTab]}
          onPress={() => setActiveTab('team')}
        >
          <Text style={[styles.tabText, activeTab === 'team' && styles.activeTabText]}>
            Team Trends ({teamTrends.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#007AFF" />
        }
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'player' ? (
          <>
            {playerTrends.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>🔥 Hot Player Streaks</Text>
                {playerTrends.map(renderPlayerTrendCard)}
              </>
            ) : (
              <View style={styles.emptyState}>
                <Activity size={48} color="#64748B" />
                <Text style={styles.emptyTitle}>No Player Trends Found</Text>
                <Text style={styles.emptyMessage}>
                  We&apos;re analyzing recent games to find recurring patterns. Check back soon!
                </Text>
              </View>
            )}
          </>
        ) : (
          <>
            {teamTrends.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>🏆 Team Patterns</Text>
                {teamTrends.map(renderTeamTrendCard)}
              </>
            ) : (
              <View style={styles.emptyState}>
                <Trophy size={48} color="#64748B" />
                <Text style={styles.emptyTitle}>No Team Trends Found</Text>
                <Text style={styles.emptyMessage}>
                  We&apos;re analyzing team performance patterns. Check back soon!
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    padding: 32,
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 12,
    fontSize: 14,
  },
  upgradeCard: {
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  upgradeContent: {
    alignItems: 'center',
    padding: 24,
  },
  upgradeIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  upgradeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  upgradeSubtitle: {
    fontSize: 12,
    color: '#00E5FF',
    marginBottom: 16,
    fontWeight: '600',
  },
  upgradeDescription: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  upgradeButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  upgradeButtonGradient: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeButtonText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 14,
    marginHorizontal: 8,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 8,
    flex: 1,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00E5FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  proText: {
    color: '#0F172A',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#00E5FF',
  },
  tabText: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 12,
  },
  activeTabText: {
    color: '#0F172A',
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  trendCard: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  trendCardGradient: {
    padding: 16,
    position: 'relative',
  },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  playerSection: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  teamName: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  streakDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  streakIconContainer: {
    marginRight: 8,
  },
  streakNumber: {
    color: '#00E5FF',
    fontWeight: '700',
    fontSize: 16,
  },
  // Prop section styles
  propSection: {
    marginBottom: 16,
  },
  propType: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
    marginBottom: 8,
  },
  propLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  propLineText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  strengthIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  strengthLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },


  // Recent games section styles
  recentGamesSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  recentGamesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  recentGamesTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginLeft: 6,
  },
  gamesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gameResult: {
    flex: 1,
    backgroundColor: 'rgba(51, 65, 85, 0.3)',
    borderRadius: 8,
    padding: 8,
    marginHorizontal: 2,
    alignItems: 'center',
  },
  gameOpponent: {
    color: '#CBD5E1',
    fontWeight: '500',
    fontSize: 10,
    marginBottom: 4,
  },
  gameStats: {
    alignItems: 'center',
  },
  gameValue: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 2,
  },
  gameMargin: {
    fontWeight: '600',
    fontSize: 10,
  },

  // Team strength section
  teamStrengthSection: {
    marginTop: 8,
  },


  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00E5FF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 8,
  },
});

export default RecurringTrends; 