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
  Modal,
  Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  TrendingUp, 
  Zap, 
  BarChart3, 
  Target, 
  Brain, 
  Sparkles,
  Timer,
  Award,
  ArrowRight,
  Clock,
  Trophy,
  Flame,
  Eye,
  X,
  Activity,
  Search,
  AlertTriangle,
  CheckCircle,
  TrendingDown,
  Database,
  Globe,
  Users,
  BarChart,
  Shield,
  DollarSign,
  Gift,
  Crown,
  Lock,
  ChevronRight,
  Bell
} from 'lucide-react-native';
import { aiService, AIPrediction, AIInsight, UserStats, DailyInsight } from '@/app/services/api/aiService';
import { supabase } from '@/app/services/api/supabaseClient';
import { router } from 'expo-router';

import { useSubscription } from '@/app/services/subscriptionContext';
import EnhancedPredictionCard from '@/app/components/EnhancedPredictionCard';
import ProAIPicksDisplay from '@/app/components/ProAIPicksDisplay';
import NewsFeed from '@/app/components/NewsFeed';
import RecurringTrends from '@/app/components/RecurringTrends';
import InjuryReportsSection from '@/app/components/InjuryReportsSection';
import { useAIChat } from '@/app/services/aiChatContext';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Enhanced interfaces for DeepSeek analysis
interface DeepSeekAnalysis {
  id: string;
  gameId: string;
  pick: string;
  confidence: 'Low' | 'Medium' | 'High';
  reasoning: string;
  factors: {
    predictiveAnalytics: string;
    recentNews: string;
    userContext: string;
    valueAssessment: string;
  };
  metadata: {
    toolsUsed: string[];
    processingTime: number;
    modelVersion: string;
  };
  kellyStake?: number;
  expectedValue?: number;
  winProbability?: number;
  confidenceInterval?: [number, number];
}

// Use DailyInsight from service instead of custom interface
type EnhancedAIInsight = DailyInsight;

// Helper function to create consistent random picks for free users
const getConsistentRandomPicks = (picks: AIPrediction[], userId: string = 'anonymous', count: number = 2) => {
  if (picks.length <= count) return picks;
  
  // Create a seed based on today's date and user ID for consistency
  const today = new Date().toDateString();
  const seedString = `${userId}_${today}`;
  
  // Simple hash function to create a seed
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    const char = seedString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Use the hash as a seed for consistent randomization
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };
  
  // Create array of indices and shuffle using seeded random
  const indices = Array.from({ length: picks.length }, (_, i) => i);
  
  // Fisher-Yates shuffle with seeded randomization
  for (let i = indices.length - 1; i > 0; i--) {
    const randomIndex = Math.floor(seededRandom(hash + i) * (i + 1));
    [indices[i], indices[randomIndex]] = [indices[randomIndex], indices[i]];
  }
  
  // Return the first 'count' picks from the shuffled indices
  return indices.slice(0, count).map(index => picks[index]);
};

export default function HomeScreen() {
  const { isPro, proFeatures, subscribeToPro, openSubscriptionModal } = useSubscription();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [aiInsights, setAIInsights] = useState<EnhancedAIInsight[]>([]);
  const [todaysPicks, setTodaysPicks] = useState<AIPrediction[]>([]);
  const [userStats, setUserStats] = useState<UserStats>({
    todayPicks: 0,
    winRate: '0%',
    roi: '0%',
    streak: 0,
    totalBets: 0,
    profitLoss: '$0'
  });
  const [featuredInsight, setFeaturedInsight] = useState<EnhancedAIInsight | null>(null);

  const [sparkleAnimation] = useState(new Animated.Value(0));
  const [selectedAnalysis, setSelectedAnalysis] = useState<DeepSeekAnalysis | null>(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [deepSeekInsights, setDeepSeekInsights] = useState<EnhancedAIInsight[]>([]);
  const { openChatWithContext, setSelectedPick: setGlobalSelectedPick } = useAIChat();
  
  // New user state
  const [isNewUser, setIsNewUser] = useState<boolean | null>(null);

  

  useEffect(() => {
    loadInitialData();
    startSparkleAnimation();
    loadDailyInsights();
  }, []);

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
        fetchAIInsights(),
        fetchTodaysPicks(),
        fetchUserStats()
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAIInsights = async () => {
    try {
      const insights = await aiService.getDailyInsights('f08b56d3-d4ec-4815-b502-6647d723d2a6');
      // Free users get limited insights
      const limitedInsights = isPro ? insights : insights.slice(0, 3);
      setAIInsights(limitedInsights);
      if (limitedInsights.length > 0) {
        setFeaturedInsight(limitedInsights[0]);
      }
    } catch (error) {
      console.error('Error fetching AI insights:', error);
    }
  };

  const fetchTodaysPicks = async () => {
    try {
      // Pass user context to get picks with welcome bonus logic
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;
      const currentUserTier = isPro ? 'pro' : 'free';
      
      const picks = await aiService.getTodaysPicks(currentUserId, currentUserTier);
      // Backend now handles pick limits including welcome bonus logic
      setTodaysPicks(picks);
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
    setGlobalSelectedPick(pick);
    
    // Create a custom prompt for this specific pick
    const customPrompt = `Analyze this AI prediction in detail:

🏟️ Match: ${pick.match}
🏈 Sport: ${pick.sport}
🎯 Pick: ${pick.pick}
📊 Odds: ${pick.odds}
🔥 Confidence: ${pick.confidence}%
${pick.value ? `💰 Edge: +${pick.value}%` : ''}

💭 AI Reasoning: ${pick.reasoning}

Please provide deeper analysis on:
- Why this pick has potential
- Key factors that could affect the outcome
- Risk assessment and betting strategy
- Any additional insights you can provide

What are your thoughts on this prediction?`;
    
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
    if (confidence >= 70) return '#F59E0B';
    return '#EF4444';
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'value': return Target;
      case 'trend': return TrendingUp;
      case 'alert': return Zap;
      case 'prediction': return Brain;
      default: return Sparkles;
    }
  };

  const sparkleOpacity = sparkleAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1],
  });

  const loadDailyInsights = async () => {
    try {
      // Hardcoded user ID for development - replace with real user context
      const userId = 'f08b56d3-d4ec-4815-b502-6647d723d2a6';
      
      // Check if insights need regeneration (once per day)
      const needsRegeneration = await aiService.shouldRegenerateDailyInsights(userId);
      
      let insights: EnhancedAIInsight[] = [];
      
      if (needsRegeneration) {
        // Generate new insights using the orchestrator
        console.log('🔄 Generating new daily insights...');
        insights = await aiService.generateDailyInsights(userId);
      } else {
        // Load existing insights from database/cache
        insights = await aiService.getDailyInsights(userId);
      }
      
      // Limit insights for free users
      const limitedInsights = isPro ? insights : insights.slice(0, 3);
      setDeepSeekInsights(limitedInsights);
      
      // Set the first one as featured (with validation)
      if (limitedInsights.length > 0) {
        const validatedInsight = {
          ...limitedInsights[0],
          category: limitedInsights[0].category || 'analysis',
          impact: limitedInsights[0].impact || 'medium',
          title: limitedInsights[0].title || 'AI Insight',
          description: limitedInsights[0].description || 'Loading insight details...'
        };
        setFeaturedInsight(validatedInsight);
      }
    } catch (error) {
      console.error('Error loading daily insights:', error);
      // Fallback to mock data if service fails
      const fallbackInsights = await aiService.getDailyInsights('fallback');
      const limitedFallback = isPro ? fallbackInsights : fallbackInsights.slice(0, 3);
      setDeepSeekInsights(limitedFallback);
      if (limitedFallback.length > 0) {
        const validatedInsight = {
          ...limitedFallback[0],
          category: limitedFallback[0].category || 'analysis',
          impact: limitedFallback[0].impact || 'medium',
          title: limitedFallback[0].title || 'AI Insight',
          description: limitedFallback[0].description || 'Loading insight details...'
        };
        setFeaturedInsight(validatedInsight);
      }
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'analysis': return BarChart3;
      case 'news': return Globe;
      case 'performance': return TrendingUp;
      case 'calculator': return Target;
      case 'weather': return Activity;
      case 'line_movement': return TrendingUp;
      default: return Sparkles;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'analysis': return '#00E5FF';
      case 'news': return '#10B981';
      case 'performance': return '#F59E0B';
      case 'calculator': return '#8B5CF6';
      case 'weather': return '#64748B'; 
      case 'line_movement': return '#F59E0B';
      default: return '#64748B';
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Animated.View style={{ opacity: sparkleOpacity }}>
          <Sparkles size={40} color="#00E5FF" />
        </Animated.View>
        <Text style={styles.loadingText}>Loading AI Insights...</Text>
      </View>
    );
  }

  // Backend now handles pick limits with welcome bonus logic
  // Display all picks returned by backend (could be 2, 5, or 10 depending on user tier/bonus)
  const displayPicks = todaysPicks;
  const additionalPicksCount = isPro ? 0 : Math.max(0, 10 - displayPicks.length);

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
          colors={isPro ? ['#1E40AF', '#7C3AED'] : ['#1E293B', '#334155']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          {isPro && (
            <View style={styles.proBadge}>
              <Crown size={16} color="#F59E0B" />
              <Text style={styles.proBadgeText}>PRO MEMBER</Text>
            </View>
          )}

          <View style={styles.headerContent}>
            <View style={styles.headerTop}>
              <View>
                <Text style={styles.welcomeText}>Welcome back!</Text>
                <Text style={styles.headerTitle}>
                  {isPro ? 'Pro Dashboard' : 'Predictive Picks'}
                </Text>
              </View>
            </View>
            
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {isPro ? todaysPicks.length : todaysPicks.length}
                </Text>
                <Text style={styles.statLabel}>
                  {isPro ? 'Total Picks' : 'Daily Picks'}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {isPro ? userStats.winRate : '?'}
                </Text>
                <Text style={styles.statLabel}>Win Rate</Text>
                {!isPro && (
                  <View style={styles.lockOverlay}>
                    <Lock size={14} color="#64748B" />
                  </View>
                )}
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: isPro ? '#10B981' : '#64748B' }]}>
                  {isPro ? userStats.roi : '?'}
                </Text>
                <Text style={styles.statLabel}>ROI</Text>
                {!isPro && (
                  <View style={styles.lockOverlay}>
                    <Lock size={14} color="#64748B" />
                  </View>
                )}
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
                  Unlock unlimited picks & advanced analytics
                </Text>
                <ChevronRight size={16} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          )}
        </LinearGradient>

        {/* Featured Insight Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {isPro ? 'AI-Powered Insights' : 'Today\'s Insight'}
            </Text>
          </View>

          {featuredInsight && (
            <TouchableOpacity 
              style={styles.featuredInsightCard}
              activeOpacity={isPro ? 0.8 : 1}
              onPress={() => {
                if (!isPro) {
                  Alert.alert(
                    'Pro Feature 🌟',
                    'Get unlimited AI-powered insights with detailed analysis!',
                    [
                              { text: 'Maybe Later', style: 'cancel' },
        { 
          text: 'Upgrade to Pro', 
          onPress: openSubscriptionModal,
          style: 'default'
        }
                    ]
                  );
                }
              }}
            >
              <LinearGradient
                colors={isPro ? ['#7C3AED', '#1E40AF'] : ['#1E293B', '#334155']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.featuredGradient}
              >
                <View style={styles.insightHeader}>
                  <View style={[
                    styles.categoryBadge, 
                    { backgroundColor: getCategoryColor(featuredInsight.category || 'analysis') + '20' }
                  ]}>
                    {React.createElement(getCategoryIcon(featuredInsight.category || 'analysis'), {
                      size: 16,
                      color: getCategoryColor(featuredInsight.category || 'analysis')
                    })}
                    <Text style={[
                      styles.categoryText,
                      { color: getCategoryColor(featuredInsight.category || 'analysis') }
                    ]}>
                      {(featuredInsight.category || 'analysis').charAt(0).toUpperCase() + (featuredInsight.category || 'analysis').slice(1)}
                    </Text>
                  </View>
                  <View style={[
                    styles.impactBadge,
                    { backgroundColor: (featuredInsight.impact || 'medium') === 'high' ? '#EF444420' : '#F59E0B20' }
                  ]}>
                    <Text style={[
                      styles.impactText,
                      { color: (featuredInsight.impact || 'medium') === 'high' ? '#EF4444' : '#F59E0B' }
                    ]}>
                      {(featuredInsight.impact || 'medium').toUpperCase()} IMPACT
                    </Text>
                  </View>
                </View>
                
                <Text style={styles.insightTitle}>{featuredInsight.title}</Text>
                <Text style={styles.insightDescription} numberOfLines={isPro ? undefined : 2}>
                  {featuredInsight.description}
                </Text>
                
                {isPro && featuredInsight.tools_used && featuredInsight.tools_used.length > 0 && (
                  <View style={styles.toolsUsed}>
                    <Zap size={14} color="#00E5FF" />
                    <Text style={styles.toolsText}>
                      {featuredInsight.tools_used.length} AI tools analyzed
                    </Text>
                  </View>
                )}

                {!isPro && (
                  <View style={styles.lockSection}>
                    <Lock size={14} color="#64748B" />
                    <Text style={styles.lockText}>Full analysis available with Pro</Text>
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}
        </View>

        {/* AI Picks Section - Pro vs Free */}
        {isPro ? (
          <View style={styles.section}>
            <ProAIPicksDisplay 
              limit={3}
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
                setGlobalSelectedPick(transformedPick);
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
                <ArrowRight size={16} color="#00E5FF" />
              </TouchableOpacity>
            </View>

            {displayPicks.length === 0 && !isNewUser ? (
              <TouchableOpacity 
                style={styles.emptyPicksCard}
                onPress={onRefresh}
              >
                <Trophy size={40} color="#64748B" />
                <Text style={styles.emptyPicksTitle}>No picks yet today</Text>
                <Text style={styles.emptyPicksText}>
                  Generate your free picks to get started
                </Text>
                <View style={styles.generatePicksButton}>
                  <Zap size={16} color="#FFFFFF" />
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
                          {additionalPicksCount} More Picks Available
                        </Text>
                        <Text style={styles.upgradeSubtitle}>Pro Feature</Text>
                        <Text style={styles.upgradeDescription}>
                          Unlock unlimited AI-powered predictions with advanced analytics, 
                          confidence scoring, and detailed reasoning behind every pick.
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

        {/* Live News Feed Section */}
        <View style={styles.section}>
          <View style={styles.newsSection}>
            <NewsFeed 
              limit={isPro ? 15 : 5}
              showHeader={false}
              onNewsClick={(news) => {
                if (news.sourceUrl) {
                  Alert.alert(
                    'Open News Article',
                    `Open "${news.title}" in browser?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { 
                        text: 'Open', 
                        onPress: () => {
                          if (news.sourceUrl) {
                            require('react-native').Linking.openURL(news.sourceUrl);
                          }
                        }
                      }
                    ]
                  );
                }
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
                    <Text style={styles.upgradeTitle}>Full News Access</Text>
                    <Text style={styles.upgradeSubtitle}>Pro Feature</Text>
                    <Text style={styles.upgradeDescription}>
                      Get unlimited breaking news, real-time injury updates, trade alerts, 
                      and personalized news feeds tailored to your teams.
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

        {/* Recurring Trends Section - Pro Only */}
        <View style={styles.section}>
          <RecurringTrends sport="MLB" />
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
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  proBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F59E0B',
    marginLeft: 6,
    letterSpacing: 0.5,
  },
  headerContent: {
    marginTop: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 14,
    color: '#CBD5E1',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  generateButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    position: 'relative',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#CBD5E1',
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
  featuredInsightCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  featuredGradient: {
    padding: 20,
  },
  insightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  impactBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  impactText: {
    fontSize: 11,
    fontWeight: '700',
  },
  insightTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  insightDescription: {
    fontSize: 14,
    color: '#CBD5E1',
    lineHeight: 20,
  },
  toolsUsed: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  toolsText: {
    fontSize: 12,
    color: '#00E5FF',
    marginLeft: 6,
  },
  lockSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  lockText: {
    fontSize: 12,
    color: '#64748B',
    marginLeft: 6,
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
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  unlockButtonText: {
    color: '#F59E0B',
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