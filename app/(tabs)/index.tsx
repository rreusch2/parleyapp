import React, { useState, useEffect, useCallback } from 'react';
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
  Trophy,
  Palette
} from 'lucide-react-native';
import { aiService, AIPrediction, UserStats } from '../services/api/aiService';
import { FacebookPixel } from '../services/analytics';
import appsFlyerService from '../services/appsFlyerService';
import { supabase } from '../services/api/supabaseClient';
import { router } from 'expo-router';

import { useSubscription } from '../services/subscriptionContext';
import EnhancedPredictionCard from '../components/EnhancedPredictionCard';
import ProAIPicksDisplay from '../components/ProAIPicksDisplay';
import PropPredictionCard from '../components/PropPredictionCard';
import TeamPredictionCard from '../components/TeamPredictionCard';
import EliteLockOfTheDay from '../components/EliteLockOfTheDay';
import EliteThemeModal from '../components/EliteThemeModal';
import EliteThemeQuickPicker from '../components/EliteThemeQuickPicker';
import NewsFeed from '../components/NewsFeed';
import DailyProfessorInsights from '../components/DailyProfessorInsights';
import NewsModal from '../components/NewsModal';
import HomeTrendsPreview from '../components/HomeTrendsPreview';
import InstantIntel from '../components/InstantIntel';
import MediaGallery from '../components/MediaGallery';
import type { MediaItem as MediaItemType } from '../components/MediaGallery';
import { listMedia } from '../services/api/mediaService';
import ATTPermissionTrigger from '../components/ATTPermissionTrigger';
import { useAIChat } from '../services/aiChatContext';
import { useReview } from '../hooks/useReview';
import FootballSeasonCard from '../components/FootballSeasonCard';
import { useOptimizedLoading } from '../hooks/useOptimizedLoading';
import AnimatedSplash from '../components/AnimatedSplash';
import { useUITheme } from '../services/uiThemeContext';
import AIParlayBuilder from '../components/AIParlayBuilder';
import OnboardingTutorial from '../components/OnboardingTutorial';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function HomeScreen() {
  const { isPro, isElite, subscriptionTier, openSubscriptionModal, eliteFeatures } = useSubscription();
  const { theme } = useUITheme();
  const { openChatWithContext, setSelectedPick } = useAIChat();
  const { trackPositiveInteraction } = useReview();
  const { isLoading: optimizedLoading, loadData } = useOptimizedLoading({ 
    timeout: 8000, 
    enableProgress: false 
  });
  const [refreshing, setRefreshing] = useState(false);
  const [todaysPicks, setTodaysPicks] = useState<AIPrediction[]>([]);
  const [userStats, setUserStats] = useState<UserStats>({
    todayPicks: 0,
    winRate: '0%',
    roi: '0%',
    streak: 0,
    totalBets: 0,
    profitLoss: '$0'
  });
  const [liveGamesCount, setLiveGamesCount] = useState(0);
  const [hotPicksCount, setHotPicksCount] = useState(0);

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
  const [mediaItems, setMediaItems] = useState<MediaItemType[]>([]);
  const [eliteThemeModalVisible, setEliteThemeModalVisible] = useState(false);
  const [eliteThemeQuickVisible, setEliteThemeQuickVisible] = useState(false);
  
  // Onboarding tutorial state
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();
    
    const initializeDashboard = async () => {
      if (!isMounted) return;
      
      // Use optimized loading with concurrent operations
      const operations = [
        // Data fetching operations
        () => fetchTodaysPicks(abortController.signal),
        () => fetchUserStats(abortController.signal),
        () => fetchUserPreferencesData(abortController.signal),
        () => loadMediaItems(abortController.signal),
        () => fetchLiveGamesCount(abortController.signal),
        () => fetchHotPicksCount(abortController.signal),
        
        // Analytics tracking (non-critical)
        async () => {
          try {
            await appsFlyerService.trackPredictionView();
          } catch (err) {
            console.error('Analytics tracking failed:', err);
          }
        },
        async () => {
          try {
            await appsFlyerService.trackPredictionView();
          } catch (err) {
            console.error('AppsFlyer tracking failed:', err);
          }
        }
      ];

      await loadData(operations);
    };
    
    initializeDashboard();
    const stopAnimation = startSparkleAnimation();
    
    return () => {
      isMounted = false;
      abortController.abort();
      if (stopAnimation) stopAnimation();
    };
  }, [isPro, loadData]); // Added loadData to dependencies

  const startSparkleAnimation = () => {
    const animation = Animated.loop(
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
    );
    
    animation.start();
    
    // Return cleanup function
    return () => {
      animation.stop();
      sparkleAnimation.setValue(0);
    };
  };

  // Helper functions for optimized loading
  const fetchUserPreferencesData = useCallback(async (signal?: AbortSignal) => {
    if (signal?.aborted) return;
    
    const newUserStatus = await aiService.isNewUser();
    if (signal?.aborted) return;
    setIsNewUser(newUserStatus);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (signal?.aborted) return;
    
    if (user) {
      setUserId(user.id);
      const { data: profile } = await supabase
        .from('profiles')
        .select('sport_preferences, betting_style, risk_tolerance, onboarding_completed')
        .eq('id', user.id)
        .single();
      
      if (profile && !signal?.aborted) {
        setUserPreferences({
          sportPreferences: profile.sport_preferences || { mlb: true, wnba: false, ufc: false },
          bettingStyle: profile.betting_style || 'balanced',
          riskTolerance: profile.risk_tolerance || 'medium'
        });
        
        // Check if user needs to see onboarding
        if (!profile.onboarding_completed && !onboardingChecked) {
          // Small delay to let the home screen load first
          setTimeout(() => {
            setShowOnboarding(true);
            setOnboardingChecked(true);
          }, 1000);
        } else {
          setOnboardingChecked(true);
        }
      }
    }
  }, [onboardingChecked]);

  const loadMediaItems = useCallback(async (signal?: AbortSignal) => {
    if (signal?.aborted) return;
    try {
      const items = await listMedia();
      if (!signal?.aborted) setMediaItems(items);
    } catch (err) {
      if (!signal?.aborted) console.error('Failed to load media items:', err);
    }
  }, []);



  const fetchTodaysPicks = async (signal?: AbortSignal) => {
    if (signal?.aborted) return;
    try {
      // Pass user context to get picks with welcome bonus logic
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;
      const currentUserTier = isElite ? 'elite' : (isPro ? 'pro' : 'free');
      
      // For consistency with Predictions tab, let's also check the metadata here
      if (!isPro && !isElite && currentUserId) {
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

  const fetchUserStats = async (signal?: AbortSignal) => {
    if (signal?.aborted) return;
    try {
      const stats = await aiService.getUserStats();
      setUserStats(stats);
    } catch (error) {
      console.error('Error fetching user stats:', error);
    }
  };

  const fetchLiveGamesCount = async (signal?: AbortSignal) => {
    if (signal?.aborted) return;
    try {
      const { data, error } = await supabase
        .from('sports_events')
        .select('id, start_time, status', { count: 'exact' })
        .or('status.eq.live,and(start_time.lte.now(),start_time.gte.now() - interval \'6 hours\')');
      
      if (!error && data) {
        setLiveGamesCount(data.length);
      }
    } catch (error) {
      console.error('Error fetching live games count:', error);
    }
  };

  const fetchHotPicksCount = async (signal?: AbortSignal) => {
    if (signal?.aborted) return;
    try {
      const { count, error } = await supabase
        .from('ai_predictions')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', new Date().toISOString().split('T')[0]) // Today's picks
        .gte('like_count', 3); // At least 3 likes to be "hot"
      
      if (!error && count !== null) {
        setHotPicksCount(count);
      }
    } catch (error) {
      console.error('Error fetching hot picks count:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    const abortController = new AbortController();
    
    try {
      const operations = [
        () => fetchTodaysPicks(abortController.signal),
        () => fetchUserStats(abortController.signal),
        () => fetchUserPreferencesData(abortController.signal),
        () => loadMediaItems(abortController.signal),
        () => fetchLiveGamesCount(abortController.signal),
        () => fetchHotPicksCount(abortController.signal)
      ];
      
      await loadData(operations);
    } catch (error) {
      if (!abortController.signal.aborted) {
        console.error('Refresh failed:', error);
      }
    } finally {
      if (!abortController.signal.aborted) {
        setRefreshing(false);
      }
    }
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

  // sparkleAnimation is used for subtle header animations; no separate opacity needed here

  if (optimizedLoading) {
    return (
      <AnimatedSplash 
        variant={isElite ? 'elite' : (isPro ? 'pro' : 'free')} 
      />
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
          colors={isElite ? theme.headerGradient : (isPro ? ['#1E40AF', '#7C3AED', '#0F172A'] as const : ['#1E293B', '#334155', '#0F172A'] as const)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          {/* Background Pattern */}
          <View style={styles.headerPattern} />
          {isElite ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
              <TouchableOpacity
                onPress={() => setEliteThemeQuickVisible(true)}
                onLongPress={() => setEliteThemeModalVisible(true)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 14,
                  backgroundColor: `${theme.accentPrimary}1A`,
                  borderWidth: 1,
                  borderColor: `${theme.accentPrimary}33`
                }}
              >
                <Palette size={14} color={theme.headerTextPrimary} />
                <Text style={{ marginLeft: 6, fontSize: 12, fontWeight: '700', color: theme.headerTextPrimary }}>Theme</Text>
              </TouchableOpacity>
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
                {/* Remove brain icon for Elite users */}
                {!isElite && (
                  <View>
                    <Brain size={28} color="#00E5FF" />
                  </View>
                )}
                <View style={styles.brandTextContainer}>
                  <Text style={[styles.welcomeText, isElite && { color: theme.headerTextSecondary }]}>Welcome back!</Text>
                  <Text style={[styles.headerTitle, isElite && { color: theme.headerTextPrimary }]}>
                    {isElite ? 'Elite Dashboard' : isPro ? 'Pro Dashboard' : 'Predictive Play'}
                  </Text>
                </View>
                <View style={styles.sparkleContainer}>
                  <Sparkles size={20} color={isElite ? "#FFD700" : "#00E5FF"} />
                </View>
              </View>
            </View>
            
            {/* Enhanced Stats Row with new order */}
            <View style={[
              isElite ? styles.eliteStatsContainer : styles.statsContainer,
              isElite && { backgroundColor: `${theme.accentPrimary}14`, borderColor: `${theme.accentPrimary}33`, shadowColor: theme.accentPrimary }
            ]}>
              <View style={styles.statsRow}>
                {/* Live Games - First Position */}
                <View style={styles.statItem}>
                  <View style={styles.statIconContainer}>
                    <Activity size={20} color={isElite ? theme.accentPrimary : "#00E5FF"} />
                  </View>
                  <Text style={[styles.statValue, isElite && { color: theme.headerTextPrimary }]}>
                    {liveGamesCount > 0 ? liveGamesCount : (isElite ? '4' : isPro ? '3' : '0')}
                  </Text>
                  <Text style={[styles.statLabel, isElite && styles.eliteStatLabel]}>Games Live</Text>
                </View>

                {/* Daily Picks - Center Position (Highlighted) */}
                <View style={[
                  styles.statItem, 
                  styles.centerStatItem,
                  isElite && { backgroundColor: `${theme.accentPrimary}1A`, borderColor: `${theme.accentPrimary}33` }
                ]}>
                  <View style={styles.centerStatIconContainer}>
                    <Target size={24} color={isElite ? theme.headerTextPrimary : "#00E5FF"} />
                  </View>
                  <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.statValue, styles.centerStatValue, isElite && { color: theme.headerTextPrimary }]}>
                    {isElite ? '30' : isPro ? '20' : todaysPicks.length}
                  </Text>
                  <Text style={[styles.statLabel, styles.centerStatLabel, isElite && styles.eliteCenterStatLabel]}>
                    {isElite ? 'Elite Picks' : isPro ? 'Pro Picks' : 'AI Picks'}
                  </Text>
                  {(welcomeBonusActive || homeIsNewUser) && !isPro && (
                    <View style={styles.bonusIndicator}>
                      <Text style={styles.bonusEmoji}>🎁</Text>
                    </View>
                  )}
                </View>

                {/* Hot Picks (Most Liked) - Third Position */}
                <View style={styles.statItem}>
                  <View style={styles.statIconContainer}>
                    <TrendingUp size={20} color={isElite ? theme.headerTextPrimary : "#10B981"} />
                  </View>
                  <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.statValue, { color: isElite ? theme.headerTextPrimary : '#10B981' }]}>
                    {hotPicksCount > 0 ? hotPicksCount : (isElite ? '12' : isPro ? '8' : '0')}
                  </Text>
                  <Text style={[styles.statLabel, isElite && styles.eliteStatLabel]}>Hot Picks</Text>
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
          ) : null}
        </LinearGradient>

        {/* ATT Permission Trigger - Shows only if permission not granted */}
        <ATTPermissionTrigger />

        {/* Football Season Announcement Card - For all tiers */}
        <FootballSeasonCard 
          tier={isElite ? 'elite' : (isPro ? 'pro' : 'free')}
          onPress={() => {
            // Navigate to predictions tab to see NFL/CFB picks
            router.push('/(tabs)/predictions');
          }}
        />

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
              <Text style={[styles.sectionTitle, isElite && { color: theme.accentPrimary, textShadowColor: `${theme.accentPrimary}4D`, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }]}>
                {isElite ? 'Elite AI Predictions' : 'Pro AI Predictions'}
              </Text>
            </View>
            
            {/* Display 2 most recent AI predictions with new card UI */}
            {todaysPicks.slice(0, 2).map((pick, index) => {
              const isPlayerProp = pick.bet_type === 'player_prop' || 
                                  (pick as any).prop_market_type ||
                                  (pick as any).line_value !== undefined;
              
              // Use PropPredictionCard for player props
              if (isPlayerProp) {
                return (
                  <PropPredictionCard
                    key={pick.id}
                    prediction={pick}
                    index={index}
                    onPress={() => {
                      setSelectedPick(pick);
                      openChatWithContext({ 
                        screen: 'home', 
                        selectedPick: pick 
                      }, pick);
                    }}
                  />
                );
              }
              
              // Use TeamPredictionCard for team picks
              return (
                <TeamPredictionCard
                  key={pick.id}
                  prediction={pick}
                  index={index}
                  onPress={() => {
                    setSelectedPick(pick);
                    openChatWithContext({ 
                      screen: 'home', 
                      selectedPick: pick 
                    }, pick);
                  }}
                />
              );
            })}
            
            {/* Pro: Add View All button below preview cards */}
            {!isElite && (
              <TouchableOpacity 
                style={styles.proViewAllButtonBelow}
                onPress={() => {
                  router.push('/(tabs)/predictions');
                }}
              >
                <LinearGradient
                  colors={['#00E5FF', '#0EA5E9']}
                  style={styles.proViewAllGradient}
                >
                  <Brain size={16} color="#000000" />
                  <Text style={styles.proViewAllButtonText}>
                    View All 20 Picks
                  </Text>
                  <ChevronRight size={16} color="#000000" />
                </LinearGradient>
              </TouchableOpacity>
            )}
            
            {/* Elite: Add View All button below preview cards */}
            {isElite && (
              <TouchableOpacity 
                style={styles.eliteViewAllButtonBelow}
                onPress={() => {
                  router.push('/(tabs)/predictions');
                }}
              >
                <LinearGradient
                  colors={theme.ctaGradient as any}
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
                {displayPicks.map((pick, index) => {
                  const isPlayerProp = pick.bet_type === 'player_prop' || 
                                      (pick as any).prop_market_type ||
                                      (pick as any).line_value !== undefined;
                  
                  // Use PropPredictionCard for player props
                  if (isPlayerProp) {
                    return (
                      <PropPredictionCard
                        key={pick.id}
                        prediction={pick}
                        index={index}
                        onPress={() => handlePickAnalyze(pick)}
                      />
                    );
                  }
                  
                  // Use TeamPredictionCard for team picks
                  return (
                    <TeamPredictionCard
                      key={pick.id}
                      prediction={pick}
                      index={index}
                      onPress={() => handlePickAnalyze(pick)}
                    />
                  );
                })}

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

        {/* AI Parlay Builder Section */}
        <View style={styles.section}>
          <AIParlayBuilder />
        </View>

        {/* Instant Intel Section - StatMuse Integration */}
        <View style={styles.section}>
          <InstantIntel />
        </View>

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

        {/* Media Gallery Section */}
        <View style={styles.section}>
          <MediaGallery title="Media" items={mediaItems.length ? mediaItems : undefined} />
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

        {/* Elite Theme Quick Picker (tap) and Full Modal (long-press or from quick picker) */}
        {isElite && (
          <EliteThemeQuickPicker
            visible={eliteThemeQuickVisible}
            onClose={() => setEliteThemeQuickVisible(false)}
            onOpenFull={() => setEliteThemeModalVisible(true)}
          />
        )}

        {/* Elite Theme Modal */}
        {isElite && (
          <EliteThemeModal
            visible={eliteThemeModalVisible}
            onClose={() => setEliteThemeModalVisible(false)}
          />
        )}

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
      
      {/* Onboarding Tutorial */}
      <OnboardingTutorial
        visible={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        tier={isElite ? 'elite' : isPro ? 'pro' : 'free'}
        userId={userId}
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
  proViewAllButtonBelow: {
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  proViewAllGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  proViewAllButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
    marginHorizontal: 8,
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
  // Elite-specific styles for better text readability against yellow background
  eliteStatLabel: {
    color: '#1E293B', // Dark color for readability against yellow background
    fontWeight: '600',
  },
  eliteCenterStatLabel: {
    color: '#0F172A', // Even darker for better contrast on the center stat
    fontWeight: '700',
  },
  
  // Progress indicator styles for optimized loading
  progressContainer: {
    marginTop: 20,
    width: '80%',
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#00E5FF',
    borderRadius: 10,
  },
  progressText: {
    position: 'absolute',
    top: -25,
    right: 0,
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
});