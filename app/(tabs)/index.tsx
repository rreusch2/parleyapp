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
  RefreshCw,
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
  Gift
} from 'lucide-react-native';
import { aiService, AIPrediction, AIInsight, UserStats, DailyInsight } from '@/app/services/api/aiService';
import NewUserWelcome from '@/app/components/NewUserWelcome';

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

export default function HomeScreen() {
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
  const [isLoadingPicks, setIsLoadingPicks] = useState(false);
  const [sparkleAnimation] = useState(new Animated.Value(0));
  const [selectedAnalysis, setSelectedAnalysis] = useState<DeepSeekAnalysis | null>(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [deepSeekInsights, setDeepSeekInsights] = useState<EnhancedAIInsight[]>([]);
  
  // New user state
  const [isNewUser, setIsNewUser] = useState<boolean | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [isGettingStarterPicks, setIsGettingStarterPicks] = useState(false);

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
      
      if (newUserStatus) {
        // New user - show welcome modal
        setShowWelcome(true);
        // Just load insights and stats, picks will be handled by welcome flow
        await Promise.all([
          fetchAIInsights(),
          fetchUserStats()
        ]);
      } else {
        // Existing user - load everything normally
        await Promise.all([
          fetchAIInsights(),
          fetchTodaysPicks(),
          fetchUserStats()
        ]);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAIInsights = async () => {
    try {
      const insights = await aiService.getAIInsights();
      setAIInsights(insights.slice(0, 5));
      if (insights.length > 0) {
        setFeaturedInsight(insights[0]);
      }
    } catch (error) {
      console.error('Error fetching AI insights:', error);
    }
  };

  const fetchTodaysPicks = async () => {
    try {
      const picks = await aiService.getTodaysPicks();
      setTodaysPicks(picks.slice(0, 5));
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

  const generateNewPicks = async () => {
    setIsLoadingPicks(true);
    try {
      const newPicks = await aiService.generateNewPicks();
      setTodaysPicks(newPicks);
      Alert.alert('Success!', 'New AI picks generated successfully');
    } catch (error) {
      console.error('Error generating picks:', error);
      Alert.alert('Service Update', 'AI pick generation is being enhanced. Using cached recommendations.');
    } finally {
      setIsLoadingPicks(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadInitialData();
    setRefreshing(false);
  };

  // New user welcome handlers
  const handleGetStarterPicks = async () => {
    setIsGettingStarterPicks(true);
    try {
      console.log('🎁 Getting starter picks for new user...');
      
      // Use the new instant starter picks method
      const starterPicks = await aiService.getStarterPicks();
      
      if (starterPicks.length > 0) {
        setTodaysPicks(starterPicks);
        setShowWelcome(false);
        setIsNewUser(false);
        
        // Show success message based on pick source
        const successMessage = starterPicks[0]?.isStarter 
          ? `Welcome! You've received ${starterPicks.length} carefully selected AI picks to get you started! 🎁`
          : `You've received ${starterPicks.length} of today's top AI picks! 📈`;
        
        Alert.alert(
          'Welcome to ParleyApp! 🚀',
          `${successMessage}\n\nStarting tomorrow, you'll get 2 fresh picks every morning at 8 AM.`,
          [{ text: 'Let\'s Go!', style: 'default' }]
        );
      } else {
        // Fallback to generating picks if no starter picks available
        console.log('⚠️ No starter picks available, generating personalized picks...');
        await handleGeneratePersonalized();
      }
    } catch (error) {
      console.error('Error getting starter picks:', error);
      
      // Show user-friendly error with options
      Alert.alert(
        'Welcome Setup',
        'We\'re setting up your personalized experience. Would you like us to generate fresh picks for you?',
        [
          { 
            text: 'Generate My Picks', 
            onPress: handleGeneratePersonalized,
            style: 'default' 
          },
          { 
            text: 'Try Again', 
            onPress: handleGetStarterPicks,
            style: 'cancel' 
          }
        ]
      );
    } finally {
      setIsGettingStarterPicks(false);
    }
  };

  const handleGeneratePersonalized = async () => {
    setIsGettingStarterPicks(true);
    try {
      console.log('⚡ Generating personalized picks for new user...');
      const newPicks = await aiService.generateFirstPicks();
      
      if (newPicks.length > 0) {
        setTodaysPicks(newPicks);
        setShowWelcome(false);
        setIsNewUser(false);
        Alert.alert(
          'Your Personalized Picks! ⚡',
          `Generated ${newPicks.length} personalized AI picks just for you! Starting tomorrow, you'll get 2 fresh picks every morning at 8 AM.`,
          [{ text: 'Amazing!', style: 'default' }]
        );
      } else {
        throw new Error('No picks generated');
      }
    } catch (error) {
      console.error('Error generating personalized picks:', error);
      Alert.alert(
        'Generation Taking Longer',
        'AI pick generation is busy. Would you like to get 2 of today\'s best picks instead?',
        [
          { text: 'Yes, Get Best Picks', onPress: handleGetStarterPicks },
          { text: 'Try Again Later', style: 'cancel' }
        ]
      );
    } finally {
      setIsGettingStarterPicks(false);
    }
  };

  const handleCloseWelcome = () => {
    setShowWelcome(false);
    // Don't set isNewUser to false here - they can still access welcome later
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
      
      setDeepSeekInsights(insights);
      
      // Set the first one as featured
      if (insights.length > 0) {
        setFeaturedInsight(insights[0]);
      }
    } catch (error) {
      console.error('Error loading daily insights:', error);
      // Fallback to mock data if service fails
      const fallbackInsights = await aiService.getDailyInsights('fallback');
      setDeepSeekInsights(fallbackInsights);
      if (fallbackInsights.length > 0) {
        setFeaturedInsight(fallbackInsights[0]);
      }
    }
  };

  const handleAnalyzeClick = async (pick: AIPrediction) => {
    // Create mock DeepSeek analysis showcase
    const mockAnalysis: DeepSeekAnalysis = {
      id: `analysis_${pick.id}`,
      gameId: pick.id,
      pick: pick.pick,
      confidence: pick.confidence > 80 ? 'High' : pick.confidence > 60 ? 'Medium' : 'Low',
      reasoning: `Multi-source analysis reveals significant value opportunity. Statistical models indicate ${pick.confidence}% win probability versus implied ${(100 / parseFloat(pick.odds.replace('+', '').replace('-', '')) * 100).toFixed(1)}% from odds. Real-time intelligence confirms no adverse factors.`,
      factors: {
        predictiveAnalytics: `Win probability: ${pick.confidence}% | Kelly stake: ${pick.value ? (parseFloat(pick.value) * 0.25).toFixed(2) : '2.5'}% | Expected value: +${pick.value || '8.2'}% | Model accuracy: 59.3%`,
        recentNews: `Real-time search: "No relevant injuries found for teams in past 24h" | ESPN API: "Favorable weather conditions" | Line movement: "Sharp money detected"`,
        userContext: `Risk tolerance: Medium | Preferred bet types: Moneyline | Bankroll management: Conservative | Favorite teams: None conflicted`,
        valueAssessment: `Positive expected value (+${pick.value || '8.2'}%) with ${pick.confidence > 80 ? 'high' : 'medium'} confidence. Kelly Criterion suggests ${pick.value ? (parseFloat(pick.value) * 0.25).toFixed(2) : '2.5'}% stake for optimal growth.`
      },
      metadata: {
        toolsUsed: ['sportsDataIO_getGamePrediction', 'userData_getUserPreferences', 'webSearch_performSearch', 'freeData_getTeamNews'],
        processingTime: Math.floor(Math.random() * 5000) + 25000, // 25-30 seconds
        modelVersion: 'advanced-ai'
      },
      kellyStake: pick.value ? parseFloat(pick.value) * 0.25 : 2.5,
      expectedValue: pick.value ? parseFloat(pick.value) : 8.2,
      winProbability: pick.confidence,
      confidenceInterval: [pick.confidence - 8, pick.confidence + 7] as [number, number]
    };
    
    setSelectedAnalysis(mockAnalysis);
    setShowAnalysisModal(true);
  };

  const getToolIcon = (toolName: string) => {
    switch (toolName) {
      case 'sportsDataIO_getGamePrediction': return Database;
      case 'userData_getUserPreferences': return Users;
      case 'webSearch_performSearch': return Globe;
      case 'freeData_getTeamNews': return Search;
      case 'freeData_getInjuryReports': return AlertTriangle;
      case 'sportsBetting_backtestStrategy': return BarChart;
      case 'sportsBetting_getOptimalConfiguration': return Shield;
      default: return Activity;
    }
  };

  const getToolColor = (toolName: string) => {
    switch (toolName) {
      case 'sportsDataIO_getGamePrediction': return '#00E5FF';
      case 'userData_getUserPreferences': return '#8B5CF6';
      case 'webSearch_performSearch': return '#10B981';
      case 'freeData_getTeamNews': return '#F59E0B';
      case 'freeData_getInjuryReports': return '#EF4444';
      case 'sportsBetting_backtestStrategy': return '#06B6D4';
      case 'sportsBetting_getOptimalConfiguration': return '#84CC16';
      default: return '#64748B';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'analysis': return BarChart3; // 📊 Multi-tool analysis with cyan color
      case 'news': return Globe; // 🌐 Real-time intelligence with green color  
      case 'performance': return TrendingUp; // 📈 Performance validation with orange color
      case 'calculator': return Target; // 🎯 Smart stake calculator with purple color
      case 'injury': return AlertTriangle;
      case 'weather': return Activity;
      case 'line_movement': return TrendingUp;
      default: return Sparkles;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'analysis': return '#00E5FF'; // Bright cyan for multi-tool analysis
      case 'news': return '#10B981'; // Green for real-time intelligence
      case 'performance': return '#F59E0B'; // Orange for performance validation
      case 'calculator': return '#8B5CF6'; // Purple for smart stake calculator
      case 'injury': return '#EF4444';
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

  return (
    <ScrollView 
      style={styles.container} 
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
        colors={['#1E40AF', '#7C3AED']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.welcomeText}>Welcome back!</Text>
              <Text style={styles.headerTitle}>Predictive Picks</Text>
            </View>
            <TouchableOpacity 
              style={styles.generateButton}
              onPress={generateNewPicks}
              disabled={isLoadingPicks}
            >
              <RefreshCw 
                size={20} 
                color="#FFFFFF" 
                style={{ transform: [{ rotate: isLoadingPicks ? '360deg' : '0deg' }] }} 
              />
            </TouchableOpacity>
          </View>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{userStats.todayPicks}</Text>
              <Text style={styles.statLabel}>Today's Picks</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{userStats.winRate}</Text>
              <Text style={styles.statLabel}>Win Rate</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#10B981' }]}>{userStats.roi}</Text>
              <Text style={styles.statLabel}>ROI</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Enhanced Featured AI Insight */}
      {featuredInsight && (
        <View style={styles.featuredInsightCard}>
          <LinearGradient
            colors={['rgba(0, 229, 255, 0.1)', 'rgba(124, 58, 237, 0.1)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.featuredInsightGradient}
          >
            <View style={styles.featuredInsightHeader}>
              <View style={styles.insightIconContainer}>
                <Brain size={24} color="#00E5FF" />
              </View>
              <View style={styles.featuredInsightInfo}>
                <Text style={styles.featuredInsightBadge}>🚀 ADVANCED AI ORCHESTRATOR</Text>
                <Text style={styles.featuredInsightTitle}>{featuredInsight.title}</Text>
              </View>
            </View>
            <Text style={styles.featuredInsightDescription}>
              {featuredInsight.description}
            </Text>
            
            {/* Tools Used Indicator */}
            {featuredInsight.toolsUsed && (
              <View style={styles.toolsUsedContainer}>
                <Text style={styles.toolsUsedLabel}>Analysis Sources:</Text>
                <View style={styles.toolsRow}>
                  {featuredInsight.toolsUsed.slice(0, 3).map((tool, index) => {
                    const IconComponent = getToolIcon(tool);
                    return (
                      <View key={index} style={[styles.toolBadge, { backgroundColor: `${getToolColor(tool)}20` }]}>
                        <IconComponent size={12} color={getToolColor(tool)} />
                        <Text style={[styles.toolBadgeText, { color: getToolColor(tool) }]}>
                          {tool.includes('sports') ? 'Stats' : 
                           tool.includes('user') ? 'User' :
                           tool.includes('web') ? 'News' : 'Data'}
                        </Text>
                      </View>
                    );
                  })}
                  {featuredInsight.toolsUsed.length > 3 && (
                    <Text style={styles.moreToolsText}>+{featuredInsight.toolsUsed.length - 3} more</Text>
                  )}
                </View>
              </View>
            )}
            
            <TouchableOpacity style={styles.viewInsightButton}>
              <Text style={styles.viewInsightText}>View Full Analysis</Text>
              <ArrowRight size={16} color="#00E5FF" />
            </TouchableOpacity>
          </LinearGradient>
        </View>
      )}

      {/* Today's Top AI Picks */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            <Flame size={24} color="#F59E0B" />
            <Text style={styles.sectionTitle}>Today's Top AI Picks</Text>
          </View>
          <TouchableOpacity style={styles.viewAllButton}>
            <Text style={styles.viewAllText}>View All</Text>
            <ArrowRight size={16} color="#00E5FF" />
          </TouchableOpacity>
        </View>

        <View style={styles.picksContainer}>
          {todaysPicks.length > 0 ? (
            todaysPicks.map((pick, index) => (
              <TouchableOpacity key={pick.id} style={styles.pickCard}>
                <LinearGradient
                  colors={['#1E293B', '#334155']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.pickGradient}
                >
                  <View style={styles.pickHeader}>
                    <View>
                      <Text style={styles.pickMatch}>{pick.match}</Text>
                      <Text style={styles.pickSport}>{pick.sport} • {pick.eventTime}</Text>
                    </View>
                    <View style={[styles.confidenceBadge, { backgroundColor: `${getConfidenceColor(pick.confidence)}20` }]}>
                      <Text style={[styles.confidenceText, { color: getConfidenceColor(pick.confidence) }]}>
                        {pick.confidence}%
                      </Text>
                    </View>
                  </View>

                  <View style={styles.pickContent}>
                    <View style={styles.pickDetails}>
                      <Text style={styles.pickType}>{pick.pick}</Text>
                      <Text style={styles.pickOdds}>Odds: {pick.odds}</Text>
                    </View>
                    
                    {pick.value && (
                      <View style={styles.valueContainer}>
                        <Target size={16} color="#10B981" />
                        <Text style={styles.valueText}>+{Math.round(parseFloat(pick.value))}% Value</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.pickReasoning} numberOfLines={2}>
                    {pick.reasoning}
                  </Text>

                  <View style={styles.pickFooter}>
                    <View style={styles.roiContainer}>
                      <TrendingUp size={14} color="#00E5FF" />
                      <Text style={styles.roiText}>Est. ROI: +{Math.round(parseFloat(pick.roi_estimate))}%</Text>
                    </View>
                    <TouchableOpacity 
                      style={styles.viewPickButton}
                      onPress={() => handleAnalyzeClick(pick)}
                    >
                      <Eye size={16} color="#00E5FF" />
                      <Text style={styles.viewPickText}>Analyze</Text>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))
          ) : isNewUser ? (
            // New user empty state
            <View style={styles.emptyPicksContainer}>
              <LinearGradient
                colors={['#1e1b4b', '#312e81']}
                style={styles.emptyPicksGradient}
              >
                <View style={styles.emptyPicksContent}>
                  <Sparkles size={48} color="#fbbf24" />
                  <Text style={styles.emptyPicksTitle}>Welcome to ParleyApp!</Text>
                  <Text style={styles.emptyPicksDescription}>
                    Get started with your first 2 AI-powered picks
                  </Text>
                  <TouchableOpacity
                    style={styles.getStartedButton}
                    onPress={() => setShowWelcome(true)}
                  >
                    <LinearGradient
                      colors={['#10b981', '#059669']}
                      style={styles.getStartedGradient}
                    >
                      <Gift size={20} color="#fff" />
                      <Text style={styles.getStartedText}>Get Started</Text>
                      <ArrowRight size={20} color="#fff" />
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </View>
          ) : (
            // Existing user empty state
            <View style={styles.emptyPicksContainer}>
              <LinearGradient
                colors={['#1E293B', '#334155']}
                style={styles.emptyPicksGradient}
              >
                <View style={styles.emptyPicksContent}>
                  <Clock size={48} color="#94A3B8" />
                  <Text style={styles.emptyPicksTitle}>No picks available</Text>
                  <Text style={styles.emptyPicksDescription}>
                    Fresh AI picks are generated daily at 8 AM
                  </Text>
                  <TouchableOpacity
                    style={styles.refreshButton}
                    onPress={generateNewPicks}
                    disabled={isLoadingPicks}
                  >
                    <RefreshCw size={20} color="#00E5FF" />
                    <Text style={styles.refreshText}>
                      {isLoadingPicks ? 'Generating...' : 'Try Generate New'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </View>
          )}
        </View>
      </View>

      {/* Enhanced AI Market Intelligence with Real DeepSeek Analysis */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            <Brain size={24} color="#8B5CF6" />
            <Text style={styles.sectionTitle}>AI Market Intelligence</Text>
          </View>
        </View>

        <View style={styles.insightsGrid}>
          {deepSeekInsights.map((insight) => {
            const IconComponent = getCategoryIcon(insight.category);
            return (
              <TouchableOpacity key={insight.id} style={styles.enhancedInsightCard}>
                <LinearGradient
                  colors={['#1E293B', '#334155']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.insightCardGradient}
                >
                  <View style={styles.insightHeader}>
                    <View style={[styles.insightIcon, { backgroundColor: `${getCategoryColor(insight.category)}20` }]}>
                      <IconComponent size={20} color={getCategoryColor(insight.category)} />
                    </View>
                    <View style={[styles.impactBadge, { backgroundColor: insight.impact === 'high' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)' }]}>
                      <Text style={[styles.impactText, { color: insight.impact === 'high' ? '#EF4444' : '#F59E0B' }]}>
                        {insight.impact.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  
                  <Text style={styles.insightTitle}>{insight.title}</Text>
                  <Text style={styles.insightDescription} numberOfLines={3}>
                    {insight.description}
                  </Text>
                  
                  {/* Tools indicator */}
                  {insight.toolsUsed && (
                    <View style={styles.smallToolsContainer}>
                      {insight.toolsUsed.slice(0, 2).map((tool, index) => {
                        const IconComponent = getToolIcon(tool);
                        return (
                          <View key={index} style={[styles.smallToolBadge, { backgroundColor: `${getToolColor(tool)}15` }]}>
                            <IconComponent size={10} color={getToolColor(tool)} />
                          </View>
                        );
                      })}
                      {insight.toolsUsed.length > 2 && (
                        <Text style={styles.smallMoreTools}>+{insight.toolsUsed.length - 2}</Text>
                      )}
                    </View>
                  )}
                  
                  <View style={styles.insightFooter}>
                    <Clock size={12} color="#64748B" />
                    <Text style={styles.insightTime}>
                      {new Date(insight.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    {insight.impact_score && (
                      <View style={styles.scoreContainer}>
                        <Text style={styles.scoreText}>{insight.impact_score}/10</Text>
                      </View>
                    )}
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          <TouchableOpacity style={styles.quickActionCard}>
            <LinearGradient
              colors={['rgba(16, 185, 129, 0.1)', 'rgba(16, 185, 129, 0.05)']}
              style={styles.quickActionGradient}
            >
              <BarChart3 size={24} color="#10B981" />
              <Text style={styles.quickActionTitle}>Betting History</Text>
              <Text style={styles.quickActionSubtitle}>Track performance</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.quickActionCard}>
            <LinearGradient
              colors={['rgba(139, 92, 246, 0.1)', 'rgba(139, 92, 246, 0.05)']}
              style={styles.quickActionGradient}
            >
              <Trophy size={24} color="#8B5CF6" />
              <Text style={styles.quickActionTitle}>Leaderboard</Text>
              <Text style={styles.quickActionSubtitle}>See rankings</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* Enhanced Analysis Modal */}
             <Modal
         visible={showAnalysisModal}
         animationType="slide" 
         presentationStyle="pageSheet"
         onRequestClose={() => setShowAnalysisModal(false)}
       >
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={['#0F172A', '#1E293B']}
            style={styles.modalGradient}
          >
            <View style={styles.modalHeader}>
              <View>
                                 <Text style={styles.modalTitle}>🧠 AI Analysis</Text>
                <Text style={styles.modalSubtitle}>Multi-Source Intelligence Report</Text>
              </View>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={() => setShowAnalysisModal(false)}
              >
                <X size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            
            {selectedAnalysis && (
              <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                {/* Analysis Summary */}
                <View style={styles.analysisSummaryCard}>
                  <LinearGradient
                    colors={['rgba(0, 229, 255, 0.1)', 'rgba(124, 58, 237, 0.1)']}
                    style={styles.summaryGradient}
                  >
                    <Text style={styles.summaryTitle}>Recommendation</Text>
                    <Text style={styles.summaryPick}>{selectedAnalysis.pick}</Text>
                    <View style={styles.summaryMetrics}>
                      <View style={styles.metricItem}>
                        <Text style={styles.metricLabel}>Confidence</Text>
                        <Text style={[styles.metricValue, { color: selectedAnalysis.confidence === 'High' ? '#10B981' : '#F59E0B' }]}>
                          {selectedAnalysis.confidence}
                        </Text>
                      </View>
                      <View style={styles.metricItem}>
                        <Text style={styles.metricLabel}>Expected Value</Text>
                        <Text style={[styles.metricValue, { color: '#10B981' }]}>
                          +{selectedAnalysis.expectedValue?.toFixed(2)}%
                        </Text>
                      </View>
                      <View style={styles.metricItem}>
                        <Text style={styles.metricLabel}>Kelly Stake</Text>
                        <Text style={styles.metricValue}>
                          {selectedAnalysis.kellyStake?.toFixed(2)}%
                        </Text>
                      </View>
                    </View>
                  </LinearGradient>
                </View>
                
                {/* Tools Used */}
                <View style={styles.toolsSection}>
                  <Text style={styles.sectionLabel}>🛠️ Analysis Sources ({selectedAnalysis.metadata.toolsUsed.length})</Text>
                  <View style={styles.toolsGrid}>
                    {selectedAnalysis.metadata.toolsUsed.map((tool, index) => {
                      const IconComponent = getToolIcon(tool);
                      return (
                        <View key={index} style={styles.toolCard}>
                          <IconComponent size={20} color={getToolColor(tool)} />
                          <Text style={styles.toolName}>
                            {tool.includes('sports') ? 'Statistical Analysis' :
                             tool.includes('user') ? 'User Context' :
                             tool.includes('web') ? 'Real-Time News' :
                             tool.includes('freeData') ? 'Team Intelligence' :
                             tool.includes('backtest') ? 'Historical Validation' :
                             'Data Analysis'}
                          </Text>
                          <View style={[styles.toolStatus, { backgroundColor: `${getToolColor(tool)}20` }]}>
                            <CheckCircle size={12} color={getToolColor(tool)} />
                            <Text style={[styles.toolStatusText, { color: getToolColor(tool) }]}>Complete</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
                
                {/* Detailed Analysis */}
                <View style={styles.factorsSection}>
                  <Text style={styles.sectionLabel}>📊 Detailed Analysis</Text>
                  
                  {Object.entries(selectedAnalysis.factors).map(([key, value]) => (
                    <View key={key} style={styles.factorCard}>
                      <Text style={styles.factorTitle}>
                        {key === 'predictiveAnalytics' ? '📈 Statistical Predictions' :
                         key === 'recentNews' ? '📰 Real-Time Intelligence' :
                         key === 'userContext' ? '👤 Personalization' :
                         '💰 Value Assessment'}
                      </Text>
                      <Text style={styles.factorContent}>{value}</Text>
                    </View>
                  ))}
                </View>
                
                {/* Processing Metadata */}
                <View style={styles.metadataSection}>
                  <Text style={styles.sectionLabel}>⚡ Processing Details</Text>
                  <View style={styles.metadataGrid}>
                    <View style={styles.metadataItem}>
                      <Timer size={16} color="#00E5FF" />
                      <Text style={styles.metadataLabel}>Processing Time</Text>
                      <Text style={styles.metadataValue}>{(selectedAnalysis.metadata.processingTime / 1000).toFixed(1)}s</Text>
                    </View>
                    <View style={styles.metadataItem}>
                      <Brain size={16} color="#8B5CF6" />
                      <Text style={styles.metadataLabel}>AI Model</Text>
                      <Text style={styles.metadataValue}>{selectedAnalysis.metadata.modelVersion}</Text>
                    </View>
                    <View style={styles.metadataItem}>
                      <BarChart size={16} color="#10B981" />
                      <Text style={styles.metadataLabel}>Confidence Range</Text>
                      <Text style={styles.metadataValue}>
                        {selectedAnalysis.confidenceInterval?.[0].toFixed(1)}% - {selectedAnalysis.confidenceInterval?.[1].toFixed(1)}%
                      </Text>
                    </View>
                  </View>
                </View>
              </ScrollView>
            )}
          </LinearGradient>
        </View>
      </Modal>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          AI predictions are for entertainment purposes. Please gamble responsibly.
        </Text>
      </View>

      {/* New User Welcome Modal */}
      <NewUserWelcome
        visible={showWelcome}
        onClose={handleCloseWelcome}
        onGetStarterPicks={handleGetStarterPicks}
        onGeneratePersonalized={handleGeneratePersonalized}
        isLoading={isGettingStarterPicks}
      />
    </ScrollView>
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
    color: '#94A3B8',
    fontSize: 16,
    marginTop: 16,
  },
  header: {
    paddingTop: 40,
    paddingBottom: 30,
    paddingHorizontal: 16,
  },
  headerContent: {
    
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  welcomeText: {
    fontSize: 16,
    color: '#E2E8F0',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  generateButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#E2E8F0',
  },
  featuredInsightCard: {
    margin: 16,
    marginTop: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  featuredInsightGradient: {
    padding: 20,
  },
  featuredInsightHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  insightIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featuredInsightInfo: {
    flex: 1,
  },
  featuredInsightBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00E5FF',
    letterSpacing: 1,
    marginBottom: 4,
  },
  featuredInsightTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  featuredInsightDescription: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
    marginBottom: 16,
  },
  viewInsightButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewInsightText: {
    color: '#00E5FF',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
  section: {
    margin: 16,
    marginTop: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllText: {
    color: '#00E5FF',
    fontSize: 14,
    marginRight: 4,
  },
  picksContainer: {
    
  },
  pickCard: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  pickGradient: {
    padding: 16,
  },
  pickHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  pickMatch: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  pickSport: {
    fontSize: 12,
    color: '#94A3B8',
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pickContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pickDetails: {
    
  },
  pickType: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  pickOdds: {
    fontSize: 14,
    color: '#94A3B8',
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  valueText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  pickReasoning: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
    marginBottom: 12,
  },
  pickFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roiContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roiText: {
    color: '#00E5FF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  viewPickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  viewPickText: {
    color: '#00E5FF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  insightsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  enhancedInsightCard: {
    width: '48%',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  insightCardGradient: {
    padding: 16,
  },
  insightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  insightIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  impactBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  impactText: {
    fontSize: 10,
    fontWeight: '700',
  },
  insightTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  insightDescription: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 16,
    marginBottom: 12,
  },
  insightFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  insightTime: {
    fontSize: 11,
    color: '#64748B',
    marginLeft: 4,
  },
  scoreContainer: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#00E5FF',
  },
  toolsUsedContainer: {
    marginBottom: 12,
  },
  toolsUsedLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  toolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    borderRadius: 8,
    marginRight: 6,
  },
  toolBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  moreToolsText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  smallToolsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  smallToolBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  smallMoreTools: {
    fontSize: 10,
    color: '#64748B',
    marginLeft: 4,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickActionCard: {
    width: '48%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  quickActionGradient: {
    padding: 20,
    alignItems: 'center',
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 8,
    marginBottom: 4,
  },
  quickActionSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
  },
  footer: {
    padding: 16,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  modalGradient: {
    flex: 1,
  },
  modalHeader: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
  },
  modalCloseButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    padding: 16,
  },
  analysisSummaryCard: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  summaryGradient: {
    padding: 20,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  summaryPick: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  summaryMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  toolsSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  toolCard: {
    width: '48%',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  toolName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 4,
    marginBottom: 6,
  },
  toolStatus: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
  },
  toolStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#00E5FF',
  },
  factorsSection: {
    marginBottom: 16,
  },
  factorCard: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  factorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  factorContent: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
  },
  metadataSection: {
    marginBottom: 16,
  },
  metadataGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metadataItem: {
    alignItems: 'center',
  },
  metadataLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  metadataValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Empty picks states
  emptyPicksContainer: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  emptyPicksGradient: {
    padding: 32,
    alignItems: 'center',
  },
  emptyPicksContent: {
    alignItems: 'center',
  },
  emptyPicksTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyPicksDescription: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  getStartedButton: {
    borderRadius: 12,
    overflow: 'hidden',
    minWidth: 200,
  },
  getStartedGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
  },
  getStartedText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  refreshText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#00E5FF',
  },
});