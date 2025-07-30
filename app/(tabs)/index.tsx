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
import { normalize, isTablet } from '../services/device';
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
import { aiService, AIPrediction, UserStats } from '../services/api/aiService';
import { supabase } from '../services/api/supabaseClient';
import { router } from 'expo-router';

import { useSubscription } from '../services/subscriptionContext';
import EnhancedPredictionCard from '../components/EnhancedPredictionCard';
import ProAIPicksDisplay from '../components/ProAIPicksDisplay';
import EliteLockOfTheDay from '../components/EliteLockOfTheDay';
import NewsFeed from '../components/NewsFeed';
import DailyProfessorInsights from '../components/DailyProfessorInsights';
import InjuryReportsSection from '../components/InjuryReportsSection';
import NewsModal from '../components/NewsModal';
import { useAIChat } from '../services/aiChatContext';
import { useReview } from '../hooks/useReview';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function HomeScreen() {
  const { isPro, isElite, subscriptionTier, openSubscriptionModal, eliteFeatures } = useSubscription();
  const { openChatWithContext, setSelectedPick } = useAIChat();
  const { trackPositiveInteraction } = useReview();
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
  
  // User preferences for Elite features
  const [userPreferences, setUserPreferences] = useState<any>({
    sportPreferences: { mlb: true, wnba: false, ufc: false }
  });
  const [userId, setUserId] = useState<string>('');

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
      
      // Fetch user preferences for Elite features
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data: profile } = await supabase
          .from('profiles')
          .select('sport_preferences, betting_style, risk_tolerance')
          .eq('id', user.id)
          .single();
        
        if (profile) {
          setUserPreferences({
            sportPreferences: profile.sport_preferences || { mlb: true, wnba: false, ufc: false },
            bettingStyle: profile.betting_style || 'balanced',
            riskTolerance: profile.risk_tolerance || 'medium'
          });
        }
      }
      
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
            
            // Track daily picks viewing for potential review prompt
            if (data.predictions.length > 0) {
              trackPositiveInteraction({ 
                eventType: 'daily_picks_viewed', 
                metadata: { picksViewed: data.predictions.length } 
              });
            }
            
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
          
          // Track daily picks viewing for potential review prompt
          if (picks.length > 0) {
            trackPositiveInteraction({ 
              eventType: 'daily_picks_viewed', 
              metadata: { picksViewed: picks.length } 
            });
          }
        }
        } catch (error) {
          console.error('Error fetching picks with metadata:', error);
          // Fallback to service method
          const picks = await aiService.getTodaysPicks(currentUserId, currentUserTier);
          setTodaysPicks(picks);
          
          // Track daily picks viewing for potential review prompt
          if (picks.length > 0) {
            trackPositiveInteraction({ 
              eventType: 'daily_picks_viewed', 
              metadata: { picksViewed: picks.length } 
            });
          }
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
        
        // Track daily picks viewing for potential review prompt
        if (picks.length > 0) {
          trackPositiveInteraction({ 
            eventType: 'daily_picks_viewed', 
            metadata: { picksViewed: picks.length } 
          });
        }
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
          colors={isElite ? ['#8B5CF6', '#EC4899', '#F59E0B'] : isPro ? ['#1E40AF', '#7C3AED', '#0F172A'] : ['#1E293B', '#334155', '#0F172A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          {/* Background Pattern */}
          <View style={styles.headerPattern} />

          {isElite ? (
            <View style={styles.eliteBadge}>
              <Crown size={16} color="#FFD700" />
              <Text style={styles.eliteBadgeText}>ELITE</Text>
              <Animated.View style={[styles.eliteSparkle, { opacity: sparkleAnimation }]}>
                <Text style={styles.sparkleEmoji}>✨</Text>
              </Animated.View>
            </View>
          ) : isPro ? (
            <View style={styles.proBadge}>
              <Crown size={14} color="#00E5FF" />
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          ) : null}

          <View style={styles.headerContent}>
            {/* Centered Welcome Section */}
            <View style={styles.welcomeSection}>
              <View style={styles.brandContainer}>
                <View style={isElite ? styles.eliteBrainIconContainer : undefined}>
                  <Brain size={28} color={isElite ? "#FFD700" : "#00E5FF"} />
                </View>
                <View style={styles.brandTextContainer}>
                  <Text style={styles.welcomeText}>Welcome back!</Text>
                  <Text style={styles.headerTitle}>
                    {isElite ? 'Elite Dashboard' : isPro ? 'Pro Dashboard' : 'Predictive Play'}
                  </Text>
                </View>
                <View style={styles.sparkleContainer}>
                  <Sparkles size={20} color={isElite ? "#FFD700" : "#00E5FF"} />
                </View>
              </View>
            </View>
            
            {/* Enhanced Stats Row with new order */}
            <View style={isElite ? styles.eliteStatsContainer : styles.statsContainer}>
              <View style={styles.statsRow}>
                {/* Win Rate - First Position */}
                <View style={[styles.statItem, !isPro && styles.lockedStatItem]}>
                  <View style={styles.statIconContainer}>
                    <Trophy size={20} color={isPro ? "#10B981" : "#64748B"} />
                  </View>
                  <Text style={styles.statValue}>
                    {isPro ? (isElite ? '73%' : '73%') : '?'}
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
                    {isElite ? '30' : isPro ? '20' : todaysPicks.length}
                  </Text>
                  <Text style={[styles.statLabel, styles.centerStatLabel]}>
                    {isElite ? 'Elite Picks' : isPro ? 'Pro Picks' : 'Daily Picks'}
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
                  <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.statValue, { color: isPro ? (isElite ? '#FFD700' : '#10B981') : '#64748B' }, !isPro && styles.lockedStatValue]}>
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

          {!isElite && !isPro ? (
            <TouchableOpacity 
              style={styles.upgradePrompt}
              onPress={openSubscriptionModal}
            >
              <LinearGradient
                colors={['#8B5CF6', '#EC4899', '#F59E0B']}
                style={styles.upgradeGradient}
              >
                <View style={styles.upgradeLeftContent}>
                  <Crown size={20} color="#FFFFFF" />
                </View>
                <View style={styles.upgradeRightContent}>
                  <Text style={styles.upgradeMainText}>
                    Unlock Elite Features
                  </Text>
                  <Text style={styles.upgradeSubText}>
                    Lock of the Day & Premium Analytics
                  </Text>
                </View>
                <View style={styles.eliteUpgradeSparkle}>
                  <Text style={styles.sparkleEmoji}>✨</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ) : isPro && !isElite ? (
            <TouchableOpacity 
              style={styles.eliteUpgradePrompt}
              onPress={openSubscriptionModal}
            >
              <LinearGradient
                colors={['#FFD700', '#FFA500', '#FF6B35']}
                style={styles.eliteUpgradeGradient}
              >
                <View style={styles.upgradeLeftContent}>
                  <Crown size={24} color="#FFFFFF" />
                </View>
                <View style={styles.upgradeRightContent}>
                  <Text style={styles.eliteUpgradeMainText}>
                    Upgrade to Elite
                  </Text>
                  <Text style={styles.eliteUpgradeSubText}>
                    Exclusive Lock of the Day & Premium Features
                  </Text>
                </View>
                <View style={styles.eliteUpgradeSparkle}>
                  <Text style={styles.eliteSparkleEmoji}>👑</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ) : null}
        </LinearGradient>

        {/* Elite Lock of the Day - Only for Elite users */}
        {isElite && eliteFeatures?.hasLockOfTheDay && (
          <View style={styles.section}>
            <EliteLockOfTheDay 
              userId={userId}
              userPreferences={userPreferences}
              onPickPress={(pick) => {
                // Transform the pick to match expected interface
                const transformedPick: AIPrediction = {
                  id: pick.id,
                  match: pick.match_teams || '',
                  sport: pick.sport || '',
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
            />
          </View>
        )}

        {/* AI Picks Section - Pro vs Free */}
        {(() => {
          console.log('🔴 RENDERING PRO/FREE BRANCH - isPro:', isPro, 'todaysPicks.length:', todaysPicks.length);
          return null;
        })()}
        {isPro ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, isElite && styles.eliteSectionTitle]}>
                {isElite ? 'Elite AI Predictions' : 'Pro AI Predictions'}
              </Text>
              {/* Only show header button for Pro users, not Elite */}
              {!isElite && (
                <TouchableOpacity 
                  style={styles.viewAllButton}
                  onPress={() => {
                    router.push('/(tabs)/predictions');
                  }}
                >
                  <Text style={styles.viewAllText}>
                    View All 20 Picks
                  </Text>
                  <ChevronRight size={16} color="#00E5FF" />
                </TouchableOpacity>
              )}
            </View>
            
            <ProAIPicksDisplay 
              limit={2}
              showViewAllButton={false}
              isElite={isElite}
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
            
            {/* Elite: Add View All button below preview cards */}
            {isElite && (
              <TouchableOpacity 
                style={styles.eliteViewAllButtonBelow}
                onPress={() => {
                  router.push('/(tabs)/predictions');
                }}
              >
                <LinearGradient
                  colors={['#FFD700', '#FFA500']}
                  style={styles.eliteViewAllGradient}
                >
                  <Trophy size={16} color="#000000" />
                  <Text style={styles.eliteViewAllButtonText}>
                    View All 30 Picks
                  </Text>
                  <ChevronRight size={16} color="#000000" />
                </LinearGradient>
              </TouchableOpacity>
            )}
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
    paddingBottom: normalize(30),
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: normalize(16),
    color: '#94A3B8',
    marginTop: normalize(16),
  },
  header: {
    padding: normalize(20),
    paddingTop: Platform.OS === 'ios' ? normalize(60) : normalize(40),
    position: 'relative',
    minHeight: normalize(200),
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
    top: Platform.OS === 'ios' ? normalize(40) : normalize(20),
    right: normalize(20),
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
    paddingHorizontal: normalize(12),
    paddingVertical: normalize(6),
    borderRadius: normalize(20),
  },
  proBadgeText: {
    fontSize: normalize(11),
    fontWeight: '700',
    color: '#00E5FF',
    marginLeft: normalize(6),
    letterSpacing: 0.5,
  },
  eliteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    top: Platform.OS === 'ios' ? normalize(40) : normalize(20),
    right: normalize(20),
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: normalize(12),
    paddingVertical: normalize(6),
    borderRadius: normalize(20),
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  eliteBadgeText: {
    fontSize: normalize(12),
    fontWeight: '800',
    color: '#FFD700',
    marginLeft: normalize(6),
    letterSpacing: 1,
  },
  eliteSparkle: {
    marginLeft: normalize(6),
  },
  sparkleEmoji: {
    fontSize: normalize(12),
  },
  headerContent: {
    marginTop: normalize(20),
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: normalize(32),
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eliteBrainIconContainer: {
    marginLeft: normalize(12),
    marginRight: normalize(8),
    paddingLeft: normalize(4),
  },
  brandTextContainer: {
    alignItems: 'center',
    marginHorizontal: normalize(16),
  },
  sparkleContainer: {
    opacity: 0.8,
  },
  welcomeText: {
    fontSize: normalize(16),
    color: '#CBD5E1',
    marginBottom: normalize(6),
    textAlign: 'center',
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: normalize(32),
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  generateButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: normalize(12),
    padding: normalize(12),
  },
  statsContainer: {
    backgroundColor: 'rgba(0, 229, 255, 0.05)',
    borderRadius: normalize(20),
    padding: normalize(20),
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.1)',
  },
  eliteStatsContainer: {
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    borderRadius: normalize(24),
    padding: normalize(24),
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.2)',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
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
    paddingVertical: normalize(12),
  },
  lockedStatItem: {
    opacity: 0.6,
  },
  statIconContainer: {
    marginBottom: normalize(8),
    padding: normalize(8),
    borderRadius: normalize(12),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  centerStatItem: {
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderRadius: normalize(16),
    paddingVertical: normalize(16),
    paddingHorizontal: normalize(12),
    marginHorizontal: normalize(8),
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
  },
  centerStatIconContainer: {
    marginBottom: normalize(10),
    padding: normalize(12),
    borderRadius: normalize(16),
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
  },
  statValue: {
    fontSize: normalize(24),
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: normalize(6),
  },
  lockedStatValue: {
    color: '#64748B',
  },
  centerStatValue: {
    fontSize: normalize(28),
    fontWeight: '800',
    color: '#00E5FF',
    marginBottom: normalize(8),
  },
  statLabel: {
    fontSize: normalize(12),
    color: '#CBD5E1',
    fontWeight: '500',
    textAlign: 'center',
  },
  centerStatLabel: {
    fontSize: normalize(13),
    color: '#00E5FF',
    fontWeight: '600',
  },
  bonusIndicator: {
    position: 'absolute',
    top: normalize(-8),
    right: normalize(8),
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
    borderRadius: normalize(12),
    padding: normalize(4),
  },
  bonusEmoji: {
    fontSize: normalize(16),
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
    borderRadius: normalize(8),
  },
  upgradePrompt: {
    marginTop: normalize(16),
    borderRadius: normalize(12),
    overflow: 'hidden',
  },
  upgradeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: normalize(14),
    paddingHorizontal: normalize(16),
  },
  upgradeLeftContent: {
    flex: 0,
    marginRight: normalize(12),
  },
  upgradeRightContent: {
    flex: 1,
    alignItems: 'flex-start',
  },
  upgradeMainText: {
    color: '#FFFFFF',
    fontSize: normalize(15),
    fontWeight: '700',
    lineHeight: normalize(18),
  },
  upgradeSubText: {
    color: '#FFFFFF',
    fontSize: normalize(13),
    fontWeight: '500',
    opacity: 0.9,
    marginTop: normalize(2),
  },
  eliteUpgradePrompt: {
    marginHorizontal: normalize(16),
    marginTop: normalize(16),
    borderRadius: normalize(16),
    overflow: 'hidden',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  eliteUpgradeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: normalize(18),
    paddingHorizontal: normalize(20),
  },
  eliteUpgradeMainText: {
    color: '#FFFFFF',
    fontSize: normalize(16),
    fontWeight: '800',
    lineHeight: normalize(20),
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  eliteUpgradeSubText: {
    color: '#FFFFFF',
    fontSize: normalize(14),
    fontWeight: '600',
    opacity: 0.95,
    marginTop: normalize(2),
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  eliteUpgradeSparkle: {
    marginLeft: normalize(12),
  },
  eliteSparkleEmoji: {
    fontSize: normalize(20),
  },
  upgradeArrow: {
    flex: 0,
    marginLeft: normalize(8),
  },
  upgradeText: {
    color: '#FFFFFF',
    fontSize: normalize(14),
    fontWeight: '600',
    marginHorizontal: normalize(8),
  },
  section: {
    paddingHorizontal: normalize(16),
    marginTop: normalize(24),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: normalize(16),
  },
  sectionTitle: {
    fontSize: normalize(20),
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
    paddingHorizontal: normalize(8),
    paddingVertical: normalize(4),
    borderRadius: normalize(12),
    marginLeft: normalize(12),
  },
  liveIndicator: {
    width: normalize(6),
    height: normalize(6),
    borderRadius: normalize(3),
    backgroundColor: '#00E5FF',
    marginRight: normalize(4),
  },
  liveText: {
    fontSize: normalize(10),
    fontWeight: '600',
    color: '#00E5FF',
  },
  aiPoweredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    paddingHorizontal: normalize(12),
    paddingVertical: normalize(6),
    borderRadius: normalize(20),
  },
  aiPoweredText: {
    fontSize: normalize(11),
    color: '#00E5FF',
    fontWeight: '600',
    marginLeft: normalize(4),
  },
  limitedText: {
    fontSize: normalize(12),
    color: '#64748B',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: normalize(14),
    color: '#00E5FF',
    fontWeight: '600',
    marginRight: normalize(4),
  },

  emptyPicksCard: {
    backgroundColor: '#1E293B',
    borderRadius: normalize(16),
    padding: normalize(32),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  emptyPicksTitle: {
    fontSize: normalize(18),
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: normalize(16),
    marginBottom: normalize(8),
  },
  emptyPicksText: {
    fontSize: normalize(14),
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: normalize(20),
  },
  generatePicksButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00E5FF',
    paddingHorizontal: normalize(20),
    paddingVertical: normalize(10),
    borderRadius: normalize(20),
  },
  generatePicksText: {
    color: '#0F172A',
    fontSize: normalize(14),
    fontWeight: '700',
    marginLeft: normalize(6),
  },
  lockedPicksCard: {
    marginTop: normalize(16),
    borderRadius: normalize(16),
    overflow: 'hidden',
  },
  lockedGradient: {
    padding: normalize(24),
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#334155',
    borderRadius: normalize(16),
  },
  lockedTitle: {
    fontSize: normalize(18),
    fontWeight: '700',
    color: '#E2E8F0',
    marginTop: normalize(12),
    marginBottom: normalize(8),
  },
  lockedSubtitle: {
    fontSize: normalize(14),
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: normalize(20),
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
    paddingHorizontal: normalize(16),
    paddingVertical: normalize(8),
    borderRadius: normalize(16),
  },
  unlockButtonText: {
    color: '#00E5FF',
    fontSize: normalize(14),
    fontWeight: '700',
    marginLeft: normalize(6),
  },

  // News Section Styles
  newsSection: {
    flex: 1,
  },
  
  // Pro Upgrade Card Styles (consistent with RecurringTrends)
  proUpgradeCard: {
    marginTop: normalize(16),
    borderRadius: normalize(16),
    overflow: 'hidden',
  },
  upgradeCard: {
    padding: normalize(24),
  },
  upgradeContent: {
    alignItems: 'center',
  },
  upgradeIcon: {
    width: normalize(64),
    height: normalize(64),
    borderRadius: normalize(32),
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: normalize(20),
  },
  upgradeTitle: {
    fontSize: normalize(20),
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: normalize(4),
  },
  upgradeSubtitle: {
    fontSize: normalize(12),
    color: '#00E5FF',
    marginBottom: normalize(16),
    fontWeight: '600',
  },
  upgradeDescription: {
    fontSize: normalize(14),
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: normalize(20),
    marginBottom: normalize(24),
  },
  upgradeButton: {
    borderRadius: normalize(25),
    overflow: 'hidden',
  },
  upgradeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: normalize(24),
    paddingVertical: normalize(12),
  },
  upgradeButtonText: {
    fontSize: normalize(16),
    fontWeight: '700',
    color: '#0F172A',
    marginHorizontal: normalize(8),
  },

  // AI Disclaimer Styles
  disclaimerContainer: {
    paddingHorizontal: normalize(16),
    paddingTop: normalize(8),
    paddingBottom: normalize(16),
    backgroundColor: '#0F172A',
  },
  disclaimerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: normalize(12),
    paddingVertical: normalize(6),
    backgroundColor: 'rgba(100, 116, 139, 0.1)',
    borderRadius: normalize(12),
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.2)',
  },
  disclaimerText: {
    fontSize: normalize(11),
    color: '#64748B',
    marginLeft: normalize(6),
    fontWeight: '400',
    textAlign: 'center',
  },

  eliteSectionTitle: {
    color: '#FFD700',
    textShadowColor: 'rgba(255, 215, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  eliteViewAllButton: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  eliteViewAllText: {
    color: '#FFD700',
  },
  eliteViewAllButtonBelow: {
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  eliteViewAllGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  eliteViewAllButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
    marginHorizontal: 8,
  },
});