import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown, Sparkles, Target, Brain, Info } from 'lucide-react-native';
import Colors from '../constants/Colors';
import EnhancedPredictionCard from './EnhancedPredictionCard';
import { useAIChat } from '../services/aiChatContext';
import { createClient } from '@supabase/supabase-js';
import SmartPickFilteringService, { Pick, UserProfile, FilterResult } from '../services/smartPickFilteringService';

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface TwoTabPredictionsLayoutProps {
  user: any;
}

export function TwoTabPredictionsLayout({ user }: TwoTabPredictionsLayoutProps) {
  const [activeTab, setActiveTab] = useState<'team' | 'props'>('team');
  const [allTeamPicks, setAllTeamPicks] = useState<Pick[]>([]);
  const [allPropPicks, setAllPropPicks] = useState<Pick[]>([]);
  const [filteredTeamPicks, setFilteredTeamPicks] = useState<Pick[]>([]);
  const [filteredPropPicks, setFilteredPropPicks] = useState<Pick[]>([]);
  const [isLoadingTeam, setIsLoadingTeam] = useState(true);
  const [isLoadingProps, setIsLoadingProps] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [filterResult, setFilterResult] = useState<FilterResult | null>(null);
  const [showNotification, setShowNotification] = useState(false);
  const { openChatWithContext } = useAIChat();
  
  // Extract tier information from user prop
  const isElite = user?.isElite || false;
  const isPro = user?.isPro || false;
  const subscriptionTier = isElite ? 'elite' : isPro ? 'pro' : 'free';

  // Fetch user profile with preferences
  const fetchUserProfile = async (): Promise<UserProfile | null> => {
    // Guard clause: if user.id is not available, return default profile
    if (!user?.id) {
      console.log('User ID not available, using default profile');
      return {
        subscription_tier: subscriptionTier,
        max_daily_picks: subscriptionTier === 'elite' ? 30 : subscriptionTier === 'pro' ? 20 : 10,
        sport_preferences: { mlb: true, wnba: true, ufc: true }
      };
    }

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('subscription_tier, max_daily_picks, sport_preferences, pick_distribution')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        // Return default profile based on subscription status
        return {
          subscription_tier: subscriptionTier,
          max_daily_picks: subscriptionTier === 'elite' ? 30 : subscriptionTier === 'pro' ? 20 : 10,
          sport_preferences: { mlb: true, wnba: true, ufc: true }
        };
      }

      return {
        subscription_tier: profile.subscription_tier || subscriptionTier,
        max_daily_picks: profile.max_daily_picks || (subscriptionTier === 'elite' ? 30 : subscriptionTier === 'pro' ? 20 : 10),
        sport_preferences: profile.sport_preferences || { mlb: true, wnba: true, ufc: true },
        pick_distribution: profile.pick_distribution
      };
    } catch (error) {
      console.error('Error in fetchUserProfile:', error);
      return {
        subscription_tier: subscriptionTier,
        max_daily_picks: subscriptionTier === 'elite' ? 30 : subscriptionTier === 'pro' ? 20 : 10,
        sport_preferences: { mlb: true, wnba: true, ufc: true }
      };
    }
  };

  const fetchAllTeamPicks = async () => {
    if (allTeamPicks.length > 0) return; // Already loaded
    
    setIsLoadingTeam(true);
    try {
      console.log('🎯 Loading ALL available team picks for smart filtering...');
      
      // Fetch ALL team picks from Supabase (not filtered by user)
      const { data: picks, error } = await supabase
        .from('ai_predictions')
        .select('*')
        .not('pick', 'ilike', '%over%')
        .not('pick', 'ilike', '%under%')
        .not('pick', 'ilike', '%total%')
        .order('created_at', { ascending: false })
        .limit(100); // Get plenty of picks for filtering
      
      if (error) {
        console.error('Error fetching team picks:', error);
        throw error;
      }
      
      setAllTeamPicks(picks || []);
      console.log(`✅ Loaded ${picks?.length || 0} total team picks for filtering`);
      
    } catch (error) {
      console.error('Error fetching team picks:', error);
      Alert.alert('Error', 'Network error loading team picks');
    } finally {
      setIsLoadingTeam(false);
    }
  };

  const fetchAllPropPicks = async () => {
    if (allPropPicks.length > 0) return; // Already loaded
    
    setIsLoadingProps(true);
    try {
      console.log('🎯 Loading ALL available prop picks for smart filtering...');
      
      // Fetch ALL prop picks from Supabase (not filtered by user)
      const { data: picks, error } = await supabase
        .from('ai_predictions')
        .select('*')
        .or('pick.ilike.%over%,pick.ilike.%under%,pick.ilike.%total%')
        .order('created_at', { ascending: false })
        .limit(100); // Get plenty of picks for filtering
      
      if (error) {
        console.error('Error fetching prop picks:', error);
        throw error;
      }
      
      setAllPropPicks(picks || []);
      console.log(`✅ Loaded ${picks?.length || 0} total prop picks for filtering`);
      
    } catch (error) {
      console.error('Error fetching prop picks:', error);
      Alert.alert('Error', 'Network error loading prop picks');
    } finally {
      setIsLoadingProps(false);
    }
  };

  // Apply smart filtering when data is ready
  const applySmartFiltering = async () => {
    console.log('🧠 Applying smart filtering...');
    
    if (!userProfile || allTeamPicks.length === 0 || allPropPicks.length === 0) {
      console.log('⏳ Waiting for data...');
      return;
    }

    const result = SmartPickFilteringService.filterPicksForUser(
      allTeamPicks,
      allPropPicks,
      userProfile
    );

    setFilterResult(result);
    
    // Separate team and prop picks from filtered results
    const teamPicks = SmartPickFilteringService.getPicksByType(result.filteredPicks, 'team');
    const propPicks = SmartPickFilteringService.getPicksByType(result.filteredPicks, 'props');
    
    setFilteredTeamPicks(teamPicks);
    setFilteredPropPicks(propPicks);

    console.log('✅ Smart filtering applied:', {
      totalPicks: result.filteredPicks.length,
      teamPicks: teamPicks.length,
      propPicks: propPicks.length,
      distribution: result.distribution,
      fallbackUsed: result.fallbackUsed
    });

    // Show notification if fallback was used
    if (result.notificationMessage) {
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 5000); // Hide after 5 seconds
    }
  };

  // Initialize data loading
  useEffect(() => {
    const initializeData = async () => {
      console.log('🚀 Initializing smart pick filtering system...');
      
      // Fetch user profile first
      const profile = await fetchUserProfile();
      setUserProfile(profile);
      
      // Fetch all picks in parallel
      await Promise.all([
        fetchAllTeamPicks(),
        fetchAllPropPicks()
      ]);
    };
    
    initializeData();
  }, [user.id]);

  // Apply filtering when all data is ready
  useEffect(() => {
    if (userProfile && allTeamPicks.length > 0 && allPropPicks.length > 0) {
      applySmartFiltering();
    }
  }, [userProfile, allTeamPicks, allPropPicks]);

  // Refresh function for pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      console.log('🔄 Refreshing smart pick filtering system...');
      
      // Clear existing data
      setAllTeamPicks([]);
      setAllPropPicks([]);
      setFilteredTeamPicks([]);
      setFilteredPropPicks([]);
      setFilterResult(null);
      
      // Fetch user profile and all picks again
      const profile = await fetchUserProfile();
      setUserProfile(profile);
      
      await Promise.all([
        fetchAllTeamPicks(),
        fetchAllPropPicks()
      ]);
      
    } catch (error) {
      console.error('Error during refresh:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handlePickAnalyze = (pick: Pick) => {
    // Transform pick to match AIPrediction interface and create custom prompt
    const customPrompt = `Analyze this AI prediction in detail:

🏟️ Match: ${pick.match_teams}
🏈 Sport: ${pick.sport}
🎯 Pick: ${pick.pick}
📊 Odds: ${pick.odds}
🔥 Confidence: ${pick.confidence}%
${pick.value_percentage ? `💰 Edge: +${pick.value_percentage}%` : ''}

💭 AI Reasoning: ${pick.reasoning}

Please provide deeper analysis on:
- Why this pick has potential
- Key factors that could affect the outcome
- Risk assessment and betting strategy
- Any additional insights you can provide

What are your thoughts on this prediction?`;
    
    const predictionForChat = {
      id: pick.id,
      match: pick.match_teams,
      sport: pick.sport,
      eventTime: new Date().toISOString(),
      pick: pick.pick,
      odds: pick.odds,
      confidence: pick.confidence,
      reasoning: pick.reasoning,
      value: pick.value_percentage
    };
    
    openChatWithContext({ 
      screen: 'predictions', 
      selectedPrediction: predictionForChat,
      customPrompt: customPrompt
    }, predictionForChat);
  };

  const TabButton = ({ 
    tab, 
    title, 
    subtitle, 
    count 
  }: { 
    tab: 'team' | 'props'; 
    title: string; 
    subtitle: string;
    count: number;
  }) => (
    <TouchableOpacity
      style={[
        styles.tabButton,
        activeTab === tab && styles.activeTabButton
      ]}
      onPress={() => setActiveTab(tab)}
    >
      <Text style={[
        styles.tabTitle,
        activeTab === tab && styles.activeTabTitle
      ]}>
        {title}
      </Text>
      <Text style={[
        styles.tabSubtitle,
        activeTab === tab && styles.activeTabSubtitle
      ]}>
        {subtitle}
      </Text>
      {count > 0 && (
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderPicks = (picks: Pick[], isLoading: boolean, type: string) => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.tint} />
          <Text style={styles.loadingText}>Loading {type} picks...</Text>
        </View>
      );
    }

    if (picks.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No {type} picks available</Text>
          <Text style={styles.emptySubtitle}>
            {type === 'team' 
              ? 'Team picks (ML, spreads, totals) will appear here'
              : 'Player props picks will appear here when available'
            }
          </Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={onRefresh}
          >
            <Text style={styles.retryButtonText}>Refresh Picks</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <ScrollView 
        style={styles.picksContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.light.tint}
          />
        }
      >
        {picks.map((pick, index) => (
          <EnhancedPredictionCard
            key={pick.id}
            prediction={pick}
            index={index}
            onAnalyze={() => handlePickAnalyze(pick)}
          />
        ))}
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      {/* Enhanced Premium Header */}
      <LinearGradient
        colors={['#1E40AF', '#7C3AED', '#0F172A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        {/* Background Pattern */}
        <View style={styles.headerPattern} />
        
        <View style={styles.headerContent}>
          {/* Centered Title Section */}
          <View style={styles.titleSection}>
            <View style={styles.titleContainer}>
              <Crown size={20} color="#00E5FF" />
              <View style={styles.titleTextContainer}>
                <Text style={styles.headerTitle}>{isElite ? 'Elite AI Predictions' : 'Pro AI Predictions'}</Text>
                
              </View>
              <Sparkles size={20} color="#00E5FF" />
            </View>
          </View>
          
          {/* Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>20</Text>
              <Text style={styles.statLabel}>Total Picks</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {activeTab === 'team' ? filteredTeamPicks.length : filteredPropPicks.length}
              </Text>
              <Text style={styles.statLabel}>
                {activeTab === 'team' ? 'Team Picks' : 'Player Props'}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{isElite ? 'ELITE' : 'PRO'}</Text>
              <Text style={styles.statLabel}>Tier</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Smart Filtering Notification */}
      {showNotification && filterResult?.notificationMessage && (
        <View style={styles.notificationContainer}>
          <Info size={16} color="#00E5FF" />
          <Text style={styles.notificationText}>
            {filterResult.notificationMessage}
          </Text>
        </View>
      )}

      {/* Filtering Stats */}
      {filterResult && (
        <View style={styles.filterStatsContainer}>
          <Text style={styles.filterStatsText}>
            Showing {filterResult.totalAllocated} of {userProfile?.max_daily_picks || 0} daily picks
            {filterResult.fallbackUsed && ' (includes all sports)'}
          </Text>
        </View>
      )}

      {/* Tab Buttons */}
      <View style={styles.tabContainer}>
        <TabButton
          tab="team"
          title="Team Picks"
          subtitle="ML • Spreads • Totals"
          count={filteredTeamPicks.length}
        />
        <TabButton
          tab="props"
          title="Player Props"
          subtitle="Hits • HRs • RBIs • More"
          count={filteredPropPicks.length}
        />
      </View>

      {/* Content */}
      <View style={styles.contentContainer}>
        {activeTab === 'team' 
          ? renderPicks(filteredTeamPicks, isLoadingTeam, 'team')
          : renderPicks(filteredPropPicks, isLoadingProps, 'player props')
        }
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    padding: 15,
    paddingTop: 25,
    position: 'relative',
    minHeight: 110,
  },
  headerPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.05,
  },
  headerContent: {
    alignItems: 'center',
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 10,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleTextContainer: {
    alignItems: 'center',
    marginHorizontal: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.8,
    textShadowColor: 'rgba(0, 229, 255, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  subtitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#E2E8F0',
    marginLeft: 8,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    shadowColor: '#00E5FF',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#00E5FF',
    marginBottom: 2,
    textShadowColor: 'rgba(0, 229, 255, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  statLabel: {
    fontSize: 10,
    color: '#CBD5E1',
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(0, 229, 255, 0.3)',
    marginHorizontal: 8,
  },
  notificationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderColor: 'rgba(0, 229, 255, 0.3)',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    margin: 15,
    marginBottom: 0,
  },
  notificationText: {
    color: '#E2E8F0',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
    fontWeight: '500',
  },
  filterStatsContainer: {
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  filterStatsText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 229, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 3,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginHorizontal: 4,
    borderRadius: 14,
    backgroundColor: '#334155',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#475569',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  activeTabButton: {
    backgroundColor: '#00E5FF',
    borderColor: '#00E5FF',
    shadowColor: '#00E5FF',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
    transform: [{ scale: 1.02 }],
  },
  tabTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E2E8F0',
    letterSpacing: 0.3,
  },
  activeTabTitle: {
    color: '#0F172A',
    fontWeight: '800',
  },
  tabSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  activeTabSubtitle: {
    color: 'rgba(15, 23, 42, 0.8)',
    fontWeight: '600',
  },
  countBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#00E5FF',
    borderRadius: 8,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    shadowColor: '#00E5FF',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  countText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  contentContainer: {
    flex: 1,
  },
  picksContainer: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#00E5FF',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: 'rgba(30, 41, 59, 0.3)',
    margin: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.2)',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#E2E8F0',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 32,
    paddingVertical: 16,
    backgroundColor: '#00E5FF',
    borderRadius: 20,
    shadowColor: '#00E5FF',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.5)',
  },
  retryButtonText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(15, 23, 42, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
}); 