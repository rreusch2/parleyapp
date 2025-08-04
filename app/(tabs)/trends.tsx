import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown, Star, Zap, TrendingUp, Play, Gift } from 'lucide-react-native';
import { useSubscription } from '../services/subscriptionContext';
import TrendCard from '../components/TrendCard';
import TieredSubscriptionModal from '../components/TieredSubscriptionModal';
import { supabase } from '../services/api/supabaseClient';


export default function TrendsScreen() {
  const [activeTab, setActiveTab] = useState<'player' | 'team'>('player');
  const [activeSport, setActiveSport] = useState<'All' | 'NBA' | 'MLB' | 'NFL' | 'NHL'>('All');
  const [playerTrends, setPlayerTrends] = useState([]);
  const [teamTrends, setTeamTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const { isPro, isElite, subscriptionTier } = useSubscription();
  // Temporary: Disabled reward ads functionality
  const isAdLoading = false;
  const canWatchTrendsAdToday = false;
  const extraTrendsAvailable = 0;
  const showTrendsRewardAd = async () => false;
  const refreshAdStatus = async () => {};

  const getTrendLimit = () => {
    switch (subscriptionTier) {
      case 'elite': return 15;
      case 'pro': return 10;
      case 'free': return 2 + extraTrendsAvailable; // Base 2 + extra from ads
      default: return 2 + extraTrendsAvailable;
    }
  };

  // Transform ai_trends data to TrendCard format
  const transformTrend = (aiTrend: any) => {
    return {
      id: aiTrend.id,
      type: aiTrend.trend_type,
      team: aiTrend.sport,
      trend_text: aiTrend.trend_text,
      title: aiTrend.trend_text,
      description: aiTrend.trend_text,
    };
  };

  const fetchTrends = async () => {
    setLoading(true);
    try {
      let playerQuery = supabase
        .from('ai_trends')
        .select('*')
        .eq('trend_type', 'player_prop')
        .eq('is_global', true)
        .order('created_at', { ascending: false });

      let teamQuery = supabase
        .from('ai_trends')
        .select('*')
        .eq('trend_type', 'team')
        .eq('is_global', true)
        .order('created_at', { ascending: false });

      // Filter by sport if not "All"
      if (activeSport !== 'All') {
        playerQuery = playerQuery.eq('sport', activeSport);
        teamQuery = teamQuery.eq('sport', activeSport);
      }

      const limit = getTrendLimit();
      playerQuery = playerQuery.limit(limit);
      teamQuery = teamQuery.limit(limit);

      const [playerResponse, teamResponse] = await Promise.all([
        playerQuery,
        teamQuery
      ]);

      if (playerResponse.error) throw playerResponse.error;
      if (teamResponse.error) throw teamResponse.error;

      setPlayerTrends((playerResponse.data || []).map(transformTrend));
      setTeamTrends((teamResponse.data || []).map(transformTrend));
    } catch (error) {
      console.error('Error fetching trends:', error);
      Alert.alert('Error', 'Failed to fetch trends. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrends();
  }, [subscriptionTier, activeTab, activeSport]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTrends();
    setRefreshing(false);
  };

  const renderRewardAdButton = () => {
    if (subscriptionTier !== 'free' || !canWatchTrendsAdToday) return null;

    return (
      <View style={styles.rewardAdContainer}>
        <LinearGradient
          colors={['#FFD700', '#FFA500']}
          style={styles.rewardAdCard}
        >
          <View style={styles.rewardAdContent}>
            <View style={styles.rewardAdIcon}>
              <Gift size={24} color="#1F2937" />
            </View>
            <Text style={styles.rewardAdTitle}>
              Watch Ad for Extra Trend! 📈
            </Text>
            <Text style={styles.rewardAdSubtitle}>
              Get 1 additional trend insight
            </Text>
            <Text style={styles.rewardAdProgress}>
              {extraTrendsAvailable}/3 extra trends earned today
            </Text>
            <TouchableOpacity 
              style={styles.rewardAdButton} 
              onPress={showTrendsRewardAd}
              disabled={isAdLoading}
            >
              <View style={styles.rewardAdButtonContent}>
                {isAdLoading ? (
                  <ActivityIndicator size={16} color="#1F2937" />
                ) : (
                  <Play size={16} color="#1F2937" />
                )}
                <Text style={styles.rewardAdButtonText}>
                  {isAdLoading ? 'Loading Ad...' : 'Watch Ad'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  };

  const renderUpgradeButton = () => {
    if (subscriptionTier !== 'free') return null;

    return (
      <TouchableOpacity
        style={styles.upgradeButton}
        onPress={() => setShowUpgradeModal(true)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#3B82F6', '#1D4ED8']}
          style={styles.upgradeButtonGradient}
        >
          <Crown size={20} color="#FFFFFF" />
          <Text style={styles.upgradeButtonText}>Unlock More Trends</Text>
          <TrendingUp size={16} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const renderTrendLimitInfo = () => {
    const limit = getTrendLimit();
    const tierName = subscriptionTier === 'free' ? 'Free' : 
                     subscriptionTier === 'pro' ? 'Pro' : 'Elite';
    
    return (
      <View style={styles.limitInfoContainer}>
        <View style={styles.limitInfo}>
          <Text style={styles.limitText}>
            {tierName} Plan: {subscriptionTier === 'free' ? '2' : limit} daily trends
            {subscriptionTier === 'free' && extraTrendsAvailable > 0 && (
              <Text style={styles.bonusText}> + {extraTrendsAvailable} bonus</Text>
            )}
          </Text>
          {subscriptionTier === 'free' && (
            <TouchableOpacity 
              onPress={() => setShowUpgradeModal(true)}
              style={styles.upgradeLink}
            >
              <Text style={styles.upgradeLinkText}>Upgrade for more</Text>
              <Star size={12} color="#F59E0B" style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Sport Selector */}
      <View style={styles.sportContainer}>
        {['All', 'NBA', 'MLB', 'NFL', 'NHL'].map((sport) => (
          <TouchableOpacity
            key={sport}
            style={[styles.sportTab, activeSport === sport && styles.activeSportTab]}
            onPress={() => setActiveSport(sport as any)}
          >
            <Text style={[styles.sportTabText, activeSport === sport && styles.activeSportTabText]}>
              {sport}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Trend Limit Info */}
      {renderTrendLimitInfo()}

      {/* Trend Type Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={activeTab === 'player' ? styles.activeTab : styles.tab}
          onPress={() => setActiveTab('player')}
        >
          <Text style={[styles.tabText, activeTab === 'player' && styles.activeTabText]}>
            Player Props
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={activeTab === 'team' ? styles.activeTab : styles.tab}
          onPress={() => setActiveTab('team')}
        >
          <Text style={[styles.tabText, activeTab === 'team' && styles.activeTabText]}>
            Team Trends
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00E5FF" />
          <Text style={styles.loadingText}>Loading {activeSport} trends...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {activeTab === 'player' ? (
            playerTrends.length > 0 ? (
              <>
                {playerTrends.map((trend, index) => (
                  <TrendCard key={trend.id || index} trend={trend} />
                ))}
                {renderRewardAdButton()}
                {renderUpgradeButton()}
              </>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No player prop trends available for {activeSport === 'All' ? 'All Sports' : activeSport}</Text>
                <Text style={styles.emptySubtext}>Check back later for new trends!</Text>
              </View>
            )
          ) : (
            teamTrends.length > 0 ? (
              <>
                {teamTrends.map((trend, index) => (
                  <TrendCard key={trend.id || index} trend={trend} />
                ))}
                {renderRewardAdButton()}
                {renderUpgradeButton()}
              </>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No team trends available for {activeSport === 'All' ? 'All Sports' : activeSport}</Text>
                <Text style={styles.emptySubtext}>Check back later for new trends!</Text>
              </View>
            )
          )}
        </ScrollView>
      )}

      {/* Upgrade Modal */}
      <TieredSubscriptionModal
        visible={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onSubscribe={async (planId, tier) => {
          setShowUpgradeModal(false);
          // Refresh trends after subscription
          setTimeout(() => {
            fetchTrends();
          }, 1000);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  sportContainer: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sportTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  activeSportTab: {
    backgroundColor: '#00E5FF',
  },
  sportTabText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
    fontSize: 14,
  },
  activeSportTabText: {
    color: '#000000',
    fontWeight: '700',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  tab: {
    padding: 16,
    flex: 1,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    padding: 16,
    flex: 1,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#00E5FF',
  },
  tabText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
    fontSize: 16,
  },
  activeTabText: {
    color: '#00E5FF',
    fontWeight: '700',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
  },
  limitInfoContainer: {
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  limitInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  limitText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
  upgradeLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  upgradeLinkText: {
    color: '#F59E0B',
    fontSize: 14,
    fontWeight: '600',
  },
  upgradeButton: {
    marginHorizontal: 16,
    marginVertical: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  upgradeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginHorizontal: 12,
  },
  upgradeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 20,
  },
  upgradeText: {
    color: '#FFD700',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  bonusText: {
    color: '#00E5FF',
    fontWeight: '600',
  },
  // Reward Ad Styles
  rewardAdContainer: {
    marginHorizontal: 16,
    marginVertical: 16,
  },
  rewardAdCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#FFD700',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  rewardAdContent: {
    padding: 20,
    alignItems: 'center',
  },
  rewardAdIcon: {
    marginBottom: 12,
  },
  rewardAdTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 4,
  },
  rewardAdSubtitle: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 8,
  },
  rewardAdProgress: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '500',
  },
  rewardAdButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    paddingHorizontal: 24,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  rewardAdButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardAdButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 8,
  },
});

