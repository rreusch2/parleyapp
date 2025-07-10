import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Animated,
  Alert,
  Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  TrendingUp, 
  Target, 
  Brain, 
  Sparkles,
  Activity,
  Search,
  Crown,
  ChevronRight,
  Calendar,
  Lock,
  Shield,
  Trophy
} from 'lucide-react-native';
import { aiService, AIPrediction, UserStats } from '@/app/services/api/aiService';
import { supabase } from '@/app/services/api/supabaseClient';
import { router } from 'expo-router';

import { useSubscription } from '@/app/services/subscriptionContext';
import EnhancedPredictionCard from '@/app/components/EnhancedPredictionCard';
import ProAIPicksDisplay from '@/app/components/ProAIPicksDisplay';
import NewsFeed from '@/app/components/NewsFeed';
import DailyProfessorInsights from '@/app/components/DailyProfessorInsights';
import InjuryReportsSection from '@/app/components/InjuryReportsSection';
import NewsModal from '@/app/components/NewsModal';
import { useAIChat } from '@/app/services/aiChatContext';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function HomeScreen() {
  const { isPro, openSubscriptionModal } = useSubscription();
  const { openChatWithContext, setSelectedPick } = useAIChat();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [todaysPicks, setTodaysPicks] = useState<AIPrediction[]>([]);
  const [userStats, setUserStats] = useState<UserStats>({
    todayPicks: 0,
    winRate: '0%',
    roi: '0%',
    streak: 0,
    totalBets: 0,
    profitLoss: '$0'
  });

  const [sparkleAnimation] = useState(new Animated.Value(0));
  
  // New user state
  const [isNewUser, setIsNewUser] = useState<boolean | null>(null);
  
  // News modal state
  const [newsModalVisible, setNewsModalVisible] = useState(false);
  const [selectedNewsItem, setSelectedNewsItem] = useState<any>(null);
  
  // Welcome bonus state
  const [welcomeBonusActive, setWelcomeBonusActive] = useState(false);
  const [homeIsNewUser, setHomeIsNewUser] = useState(false);

  useEffect(() => {
    loadInitialData();
    startSparkleAnimation();
  }, [isPro]); // Added isPro to dependencies

  const startSparkleAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(sparkleAnimation, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(sparkleAnimation, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Check if user is new first
      const newUserStatus = await aiService.isNewUser();
      setIsNewUser(newUserStatus);
      
      // Load all data regardless of user status
      await Promise.all([
        fetchTodaysPicks(),
        fetchUserStats()
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };



  const fetchTodaysPicks = async () => {
    try {
      // Pass user context to get picks with welcome bonus logic
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;
      const currentUserTier = isPro ? 'pro' : 'free';
      
      // For consistency with Predictions tab, let's also check the metadata here
      if (!isPro && currentUserId) {
        // Get API response directly to check metadata
        try {
          const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://zooming-rebirth-production-a305.up.railway.app';
          const apiResponse = await fetch(`${baseUrl}/api/ai/picks?userId=${currentUserId}&userTier=${currentUserTier}`);
          const data = await apiResponse.json();
          
          if (data.success && data.predictions) {
            setTodaysPicks(data.predictions);
            
            // Check metadata for new user or welcome bonus status
            if (data.metadata) {
              const isNewUserScenario = data.metadata.isNewUser || false;
              const bonusActiveFromAPI = data.metadata.welcomeBonusActive || false;
              
              setHomeIsNewUser(isNewUserScenario);
              setWelcomeBonusActive(bonusActiveFromAPI);
              
              if (isNewUserScenario) {
                console.log(`🆕 New user on Home tab: ${data.predictions.length} picks (automatic welcome bonus)`);
              } else if (bonusActiveFromAPI) {
                console.log(`🎁 Welcome bonus active on Home tab: ${data.predictions.length} picks`);
              } else {
                console.log(`🎲 Free user on Home tab: ${data.predictions.length} picks`);
              }
            }
          } else {
            // Fallback to service method
            const picks = await aiService.getTodaysPicks(currentUserId, currentUserTier);
            setTodaysPicks(picks);
          }
        } catch (error) {
          console.error('Error fetching picks with metadata:', error);
          // Fallback to service method
          const picks = await aiService.getTodaysPicks(currentUserId, currentUserTier);
          setTodaysPicks(picks);
        }
      } else {
        // Pro users or no user ID - use service method
        const picks = await aiService.getTodaysPicks(currentUserId, currentUserTier);
        console.log('🏠 HOME TAB DEBUG - getTodaysPicks returned:', {
          picksCount: picks.length,
          samplePick: picks[0] || null,
          allPickIds: picks.map(p => p.id)
        });
        setTodaysPicks(picks);
      }
    } catch (error) {
      console.error('Error fetching today\'s picks:', error);
    }
  };

  const fetchUserStats = async () => {
    try {
      const stats = await aiService.getUserStats();
      setUserStats(stats);
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInitialData();
    setRefreshing(false);
  };

  const handlePickAnalyze = (pick: AIPrediction) => {
    setSelectedPick(pick);
    
    // Create a custom prompt for this specific pick
    const customPrompt = `Analyze this AI prediction in detail:\n\n🏟️ Match: ${pick.match}\n🏈 Sport: ${pick.sport}\n🎯 Pick: ${pick.pick}\n📊 Odds: ${pick.odds}\n🔥 Confidence: ${pick.confidence}%\n${pick.value ? `💰 Edge: +${pick.value}%` : ''}\n\n💭 AI Reasoning: ${pick.reasoning}\n\nPlease provide deeper analysis on:\n- Why this pick has potential\n- Key factors that could affect the outcome\n- Risk assessment and betting strategy\n- Any additional insights you can provide\n\nWhat are your thoughts on this prediction?`;
    
    openChatWithContext({ 
      screen: 'home', 
      selectedPick: pick,
      customPrompt: customPrompt
    }, pick);
  };

  const handlePickTrack = (pick: AIPrediction) => {
    if (!isPro) {
      Alert.alert(
        'Pro Feature 🌟',
        'Track your bets and build a betting portfolio with Pro!',
        [
          { text: 'Maybe Later', style: 'cancel' },
          { 
            text: 'Upgrade to Pro', 
            onPress: openSubscriptionModal,
            style: 'default'
          }
        ]
      );
      return;
    }
    Alert.alert('Track Bet', 'Bet tracking coming soon!');
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 85) return '#10B981';
    if (confidence >= 70) return '#00E5FF';
    return '#00E5FF'; // Changed from red to cyan for better UX
  };

  const sparkleOpacity = sparkleAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1],
  });

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Animated.View style={{ opacity: sparkleOpacity }}>
          <Sparkles size={40} color="#00E5FF" />
        </Animated.View>
        <Text style={styles.loadingText}>Loading your dashboard...</Text>
      </View>
    );
  }

  // Backend now handles pick limits with welcome bonus logic
  // Display all picks returned by backend (could be 2, 5, or 20 depending on user tier/bonus)
  const displayPicks = todaysPicks;
  const additionalPicksCount = isPro ? 0 : Math.max(0, 20 - displayPicks.length);
  
  console.log('🏠 HOME TAB DISPLAY DEBUG:', {
    isPro,
    isNewUser,
    welcomeBonusActive,
    homeIsNewUser,
    displayPicksLength: displayPicks.length,
    additionalPicksCount,
    willShowEmptyState: displayPicks.length === 0 && !isNewUser
  });

  // Debug logging for pick display
  if (!isPro) {
    if (displayPicks.length === 5) {
      console.log(`🎁 Welcome bonus active: showing ${displayPicks.length} picks instead of usual 2`);
    } else {
      console.log(`🎲 Free user: showing ${displayPicks.length} picks`);
    }
    console.log(`📊 Pick IDs: ${displayPicks.map(p => p.id).join(', ')}`);
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00E5FF"
            colors={['#00E5FF']}
          />
        }
      >
        {/* Header */}
        <LinearGradient
          colors={isPro ? ['#1E40AF', '#7C3AED', '#0F172A'] : ['#1E293B', '#334155', '#0F172A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          {/* Background Pattern */}
          <View style={styles.headerPattern} />

          {isPro && (
            <View style={styles.proBadge}>
              <Crown size={16} color="#F59E0B" />
              <Text style={styles.proBadgeText}>PRO MEMBER</Text>
            </View>
          )}

          <View style={styles.headerContent}>
            {/* Centered Welcome Section */}
            <View style={styles.welcomeSection}>
              <View style={styles.brandContainer}>
                <Brain size={28} color="#00E5FF" />
                <View style={styles.brandTextContainer}>
                  <Text style={styles.welcomeText}>Welcome back!</Text>
                  <Text style={styles.headerTitle}>
                    {isPro ? 'Pro Dashboard' : 'Predictive Play'}
                  </Text>
                </View>
                <View style={styles.sparkleContainer}>
                  <Sparkles size={20} color="#00E5FF" />
                </View>
              </View>
            </View>
            
            {/* Enhanced Stats Row with new order */}
            <View style={styles.statsContainer}>
              <View style={styles.statsRow}>
                {/* Win Rate - First Position */}
                <View style={[styles.statItem, !isPro && styles.lockedStatItem]}>
                  <View style={styles.statIconContainer}>
                    <Trophy size={20} color={isPro ? "#10B981" : "#64748B"} />
                  </View>
                  <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.statValue, !isPro && styles.lockedStatValue]}>
                    {isPro ? userStats.winRate : '?'}
                  </Text>
                  <Text style={styles.statLabel}>Win Rate</Text>
                  {!isPro && (
                    <View style={styles.lockOverlay}>
                      <Lock size={16} color="#64748B" />
                    </View>
                  )}
                </View>

                {/* Daily Picks - Center Position (Highlighted) */}
                <View style={[styles.statItem, styles.centerStatItem]}>
                  <View style={styles.centerStatIconContainer}>
                    <Target size={24} color="#00E5FF" />
                  </View>
                  <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.statValue, styles.centerStatValue]}>
                    {isPro ? '20' : todaysPicks.length}
                  </Text>
                  <Text style={[styles.statLabel, styles.centerStatLabel]}>
                    {isPro ? 'Pro Picks' : 'Daily Picks'}
                  </Text>
                  {(welcomeBonusActive || homeIsNewUser) && !isPro && (
                    <View style={styles.bonusIndicator}>
                      <Text style={styles.bonusEmoji}>🎁</Text>
                    </View>
                  )}
                </View>

                {/* ROI - Third Position */}
                <View style={[styles.statItem, !isPro && styles.lockedStatItem]}>
                  <View style={styles.statIconContainer}>
                    <TrendingUp size={20} color={isPro ? "#10B981" : "#64748B"} />
                  </View>
                  <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.statValue, { color: isPro ? '#10B981' : '#64748B' }, !isPro && styles.lockedStatValue]}>
                    {isPro ? userStats.roi : '?'}
                  </Text>
                  <Text style={styles.statLabel}>ROI</Text>
                  {!isPro && (
                    <View style={styles.lockOverlay}>
                      <Lock size={16} color="#64748B" />
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>

          {!isPro && (
            <TouchableOpacity 
              style={styles.upgradePrompt}
              onPress={openSubscriptionModal}
            >
              <LinearGradient
                colors={['#00E5FF', '#0891B2']}
                style={styles.upgradeGradient}
              >
                <Crown size={16} color="#FFFFFF" />
                <Text style={styles.upgradeText}>
                  Unlock 20 daily picks & premium analytics
                </Text>
                <ChevronRight size={16} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          )}
        </LinearGradient>



        {/* AI Picks Section - Pro vs Free */}
        {(() => {
          console.log('🔴 RENDERING PRO/FREE BRANCH - isPro:', isPro, 'todaysPicks.length:', todaysPicks.length);
          return null;
        })()}
        {isPro ? (
          <View style={styles.section}>
            <ProAIPicksDisplay 
              limit={2}
              showViewAllButton={true}
              onViewAllPress={() => {
                // Navigate to predictions tab
                router.push('/(tabs)/predictions');
              }}
              onPickPress={(pick) => {
                // Transform the pick to match expected interface
                const transformedPick: AIPrediction = {
                  id: pick.id,
                  match: pick.match_teams || '',
                  sport: pick.league || '',
                  eventTime: pick.created_at || new Date().toISOString(),
                  pick: pick.pick,
                  odds: pick.odds,
                  confidence: pick.confidence,
                  reasoning: pick.reasoning || ''
                };
                setSelectedPick(transformedPick);
                openChatWithContext({ 
                  screen: 'home', 
                  selectedPick: transformedPick 
                }, transformedPick);
              }}
              onRefresh={onRefresh}
              refreshing={refreshing}
            />
          </View>
        ) : (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Your Daily Picks</Text>
              <TouchableOpacity 
                style={styles.viewAllButton}
                onPress={() => {
                  // Navigate to predictions tab
                  router.push('/(tabs)/predictions');
                }}
              >
                <Text style={styles.viewAllText}>View All</Text>
                <ChevronRight size={16} color="#00E5FF" />
              </TouchableOpacity>
            </View>

            {displayPicks.length === 0 && !isNewUser ? (
              <TouchableOpacity 
                style={styles.emptyPicksCard}
                onPress={onRefresh}
              >
                <Sparkles size={40} color="#64748B" />
                <Text style={styles.emptyPicksTitle}>No picks yet today</Text>
                <Text style={styles.emptyPicksText}>
                  Generate your free picks to get started
                </Text>
                <View style={styles.generatePicksButton}>
                  <Sparkles size={16} color="#FFFFFF" />
                  <Text style={styles.generatePicksText}>Generate Picks</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <>
                {displayPicks.map((pick, index) => (
                  <EnhancedPredictionCard
                    key={pick.id}
                    prediction={pick}
                    index={index}
                    onAnalyze={() => handlePickAnalyze(pick)}
                    welcomeBonusActive={welcomeBonusActive || homeIsNewUser}
                  />
                ))}

                {/* Show locked picks for free users */}
                {additionalPicksCount > 0 && (
                  <View style={styles.proUpgradeCard}>
                    <LinearGradient
                      colors={['#1a1a2e', '#16213e']}
                      style={styles.upgradeCard}
                    >
                      <View style={styles.upgradeContent}>
                        <View style={styles.upgradeIcon}>
                          <Lock size={32} color="#00E5FF" />
                        </View>
                        <Text style={styles.upgradeTitle}>
                          {additionalPicksCount} More Premium Picks Available
                        </Text>
                        <Text style={styles.upgradeSubtitle}>Pro Feature • 20 Total Picks</Text>
                        <Text style={styles.upgradeDescription}>
                          Unlock all 20 daily AI-powered predictions with advanced analytics, 
                          Kelly Criterion calculations, and detailed multi-source reasoning.
                        </Text>
                        <TouchableOpacity style={styles.upgradeButton} onPress={openSubscriptionModal}>
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
                )}
              </>
            )}
          </View>
        )}

        {/* Daily AI Insights Section - Pro Only */}
        <View style={styles.section}>
          <DailyProfessorInsights sport="MLB" />
        </View>

        {/* Live News Feed Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleContainer}>
              <Text style={styles.sectionTitle}>Latest News</Text>
              <View style={styles.liveBadge}>
                <View style={styles.liveIndicator} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.viewAllButton}
              onPress={() => {
                // Could navigate to a full news page in the future
                console.log('View all news');
              }}
            >
              <Text style={styles.viewAllText}>View All</Text>
              <ChevronRight size={16} color="#00E5FF" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.newsSection}>
            <NewsFeed 
              limit={isPro ? 15 : 5}
              showHeader={false}
              onNewsClick={(news) => {
                setSelectedNewsItem(news);
                setNewsModalVisible(true);
              }}
            />
            
            {!isPro && (
              <View style={styles.proUpgradeCard}>
                <LinearGradient
                  colors={['#1a1a2e', '#16213e']}
                  style={styles.upgradeCard}
                >
                  <View style={styles.upgradeContent}>
                    <View style={styles.upgradeIcon}>
                      <Activity size={32} color="#00E5FF" />
                    </View>
                    <Text style={styles.upgradeTitle}>Premium News Access</Text>
                    <Text style={styles.upgradeSubtitle}>Pro Feature • Real-time Updates</Text>
                    <Text style={styles.upgradeDescription}>
                      Get unlimited breaking news, real-time injury updates, trade alerts, 
                      and AI-curated news feeds with insider intelligence.
                    </Text>
                    <TouchableOpacity style={styles.upgradeButton} onPress={openSubscriptionModal}>
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
            )}
          </View>
        </View>

        {/* Injury Reports Section - Pro Only */}
        <View style={styles.section}>
          <InjuryReportsSection isPro={isPro} />
        </View>



        {/* AI Disclaimer */}
        <View style={styles.disclaimerContainer}>
          <View style={styles.disclaimerContent}>
            <Shield size={12} color="#64748B" />
            <Text style={styles.disclaimerText}>
              AI can make mistakes. Verify important info and bet responsibly.
            </Text>
          </View>
        </View>

      </ScrollView>
      
      {/* News Modal */}
      <NewsModal
        visible={newsModalVisible}
        onClose={() => {
          setNewsModalVisible(false);
          setSelectedNewsItem(null);
        }}
        newsItem={selectedNewsItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  contentContainer: {
    paddingBottom: 30,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#94A3B8',
    marginTop: 16,
  },
  header: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    position: 'relative',
    minHeight: 200,
  },
  headerPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.05,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    top: Platform.OS === 'ios' ? 40 : 20,
    right: 20,
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  proBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00E5FF',
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  headerContent: {
    marginTop: 20,
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTextContainer: {
    alignItems: 'center',
    marginHorizontal: 16,
  },
  sparkleContainer: {
    opacity: 0.8,
  },
  welcomeText: {
    fontSize: 16,
    color: '#CBD5E1',
    marginBottom: 6,
    textAlign: 'center',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  generateButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
  },
  statsContainer: {
    backgroundColor: 'rgba(0, 229, 255, 0.05)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.1)',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    position: 'relative',
    paddingVertical: 12,
  },
  lockedStatItem: {
    opacity: 0.6,
  },
  statIconContainer: {
    marginBottom: 8,
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  centerStatItem: {
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
  },
  centerStatIconContainer: {
    marginBottom: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  lockedStatValue: {
    color: '#64748B',
  },
  centerStatValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#00E5FF',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#CBD5E1',
    fontWeight: '500',
    textAlign: 'center',
  },
  centerStatLabel: {
    fontSize: 13,
    color: '#00E5FF',
    fontWeight: '600',
  },
  bonusIndicator: {
    position: 'absolute',
    top: -8,
    right: 8,
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
    borderRadius: 12,
    padding: 4,
  },
  bonusEmoji: {
    fontSize: 16,
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  upgradePrompt: {
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  upgradeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  upgradeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 8,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 12,
  },
  liveIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00E5FF',
    marginRight: 4,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#00E5FF',
  },
  aiPoweredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  aiPoweredText: {
    fontSize: 11,
    color: '#00E5FF',
    fontWeight: '600',
    marginLeft: 4,
  },
  limitedText: {
    fontSize: 12,
    color: '#64748B',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 14,
    color: '#00E5FF',
    fontWeight: '600',
    marginRight: 4,
  },

  emptyPicksCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  emptyPicksTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyPicksText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 20,
  },
  generatePicksButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00E5FF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  generatePicksText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  lockedPicksCard: {
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  lockedGradient: {
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#334155',
    borderRadius: 16,
  },
  lockedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#E2E8F0',
    marginTop: 12,
    marginBottom: 8,
  },
  lockedSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 20,
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  unlockButtonText: {
    color: '#00E5FF',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },

  // News Section Styles
  newsSection: {
    flex: 1,
  },
  
  // Pro Upgrade Card Styles (consistent with RecurringTrends)
  proUpgradeCard: {
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  upgradeCard: {
    padding: 24,
  },
  upgradeContent: {
    alignItems: 'center',
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
    borderRadius: 25,
    overflow: 'hidden',
  },
  upgradeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginHorizontal: 8,
  },

  // AI Disclaimer Styles
  disclaimerContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    backgroundColor: '#0F172A',
  },
  disclaimerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(100, 116, 139, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.2)',
  },
  disclaimerText: {
    fontSize: 11,
    color: '#64748B',
    marginLeft: 6,
    fontWeight: '400',
    textAlign: 'center',
  },
});