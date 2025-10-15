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
import { Crown, Sparkles, Target, Brain } from 'lucide-react-native';
import Colors from '../constants/Colors';
import EnhancedPredictionCard from './EnhancedPredictionCard';
import PropPredictionCard from './PropPredictionCard';
import TeamPredictionCard from './TeamPredictionCard';
import SportFilterDropdown from './SportFilterDropdown';
import { useAIChat } from '../services/aiChatContext';
import { supabase } from '../services/api/supabaseClient';
import { useUITheme } from '../services/uiThemeContext';
import { AIPrediction } from '../services/api/aiService';

interface Pick {
  id: string;
  match_teams: string;
  pick: string;
  odds: string;
  confidence: number;
  value_percentage: number;
  reasoning: string;
  bet_type: string;
  sport: string;
  event_time?: string;
  created_at?: string;
  // Add ROI estimate which is stored as text/number in DB
  roi_estimate?: number | string;
}

interface TwoTabPredictionsLayoutProps {
  user: any;
}

export function TwoTabPredictionsLayout({ user }: TwoTabPredictionsLayoutProps) {
  const [activeTab, setActiveTab] = useState<'team' | 'props'>('props');
  const [teamPicks, setTeamPicks] = useState<Pick[]>([]);
  const [playerPropsPicks, setPlayerPropsPicks] = useState<Pick[]>([]);
  const [isLoadingTeam, setIsLoadingTeam] = useState(true);
  const [isLoadingProps, setIsLoadingProps] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSportFilter, setSelectedSportFilter] = useState<string>('ALL'); // NEW: Sport filter
  const { openChatWithContext } = useAIChat();
  const { theme } = useUITheme();
  
  // Extract Elite status from user prop
  const isElite = user?.isElite || false;
  const isPro = user?.isPro || false;

  const fetchTeamPicks = async (force = false) => {
    if (!force && teamPicks.length > 0) return; // Already loaded
    
    setIsLoadingTeam(true);
    try {
      if (isElite) {
        // Elite users: Get 15 team picks from Supabase with sport preferences
        console.log('🏆 Loading Elite team picks (15 picks)');
        
        // NEW: Check if sport filter is active (overrides preferences)
        let preferredSports: string[] = [];
        if (selectedSportFilter !== 'ALL') {
          // Sport filter overrides user preferences
          preferredSports = [selectedSportFilter.toLowerCase()];
          console.log(`🎯 Sport filter active: ${selectedSportFilter}`);
        } else if (user?.id) {
          // Use user preferences when no filter is set
          const { data: profile } = await supabase
            .from('profiles')
            .select('sport_preferences')
            .eq('id', user.id)
            .single();
          
          // Get preferred sports and normalize them
          preferredSports = profile?.sport_preferences 
            ? Object.entries(profile.sport_preferences)
                .filter(([sport, enabled]) => enabled)
                .map(([sport]) => sport.toLowerCase())
            : [];
        }
        
        console.log('🎯 User preferred sports:', preferredSports);
        
        // Build query for team picks - FIXED: Use bet_type instead of pick text
        let query = supabase
          .from('ai_predictions')
          .select('*')
          .in('bet_type', ['moneyline', 'spread', 'total'])
          .order('created_at', { ascending: false })
          .limit(15);
        
        // If user has sport preferences, apply them as filter with robust matching
        if (preferredSports.length > 0) {
          // Build comprehensive sport filter to handle variations
          const sportFilters: string[] = [];
          
          preferredSports.forEach((sport) => {
            // Handle different sport name variations
            if (sport === 'mlb' || sport === 'baseball') {
              sportFilters.push('sport.ilike.%MLB%', 'sport.ilike.%Baseball%');
            } else if (sport === 'nfl' || sport === 'football') {
              sportFilters.push('sport.ilike.%NFL%', 'sport.ilike.%Football%');
            } else if (sport === 'cfb' || sport === 'college football') {
              sportFilters.push('sport.ilike.%College Football%', 'sport.ilike.%CFB%');
            } else if (sport === 'wnba' || sport === 'basketball' || sport === 'women\'s basketball') {
              sportFilters.push('sport.ilike.%WNBA%', 'sport.ilike.%Basketball%');
            } else if (sport === 'nba') {
              sportFilters.push('sport.ilike.%NBA%', 'sport.ilike.%National Basketball Association%');
            } else if (sport === 'nhl' || sport === 'hockey') {
              sportFilters.push('sport.ilike.%NHL%', 'sport.ilike.%Hockey%');
            } else if (sport === 'ufc' || sport === 'mma') {
              sportFilters.push('sport.ilike.%UFC%', 'sport.ilike.%MMA%');
            } else {
              // Fallback: try exact match with different cases
              sportFilters.push(`sport.ilike.%${sport}%`);
            }
          });
          
          if (sportFilters.length > 0) {
            query = query.or(sportFilters.join(','));
          }
        }
        
        const { data: picks, error } = await query;
        
        if (error) {
          console.error('Error fetching Elite team picks:', error);
          throw error;
        }
        
        const uniqueTeamPicks = picks ? Array.from(new Map(picks.map(p => [p.id, p])).values()) : [];
        setTeamPicks(uniqueTeamPicks);
        console.log(`✅ Loaded ${picks?.length || 0} Elite team picks`);
      } else {
        // Pro users: Get 10 team picks from Supabase with sport preferences
        console.log('💎 Loading Pro team picks (10 picks)');

        // NEW: Check if sport filter is active (overrides preferences)
        let preferredSports: string[] = [];
        if (selectedSportFilter !== 'ALL') {
          // Sport filter overrides user preferences
          preferredSports = [selectedSportFilter.toUpperCase()];
          console.log(`🎯 Sport filter active: ${selectedSportFilter}`);
        } else if (user?.id) {
          // Use user preferences when no filter is set
          const { data: profile } = await supabase
            .from('profiles')
            .select('sport_preferences')
            .eq('id', user.id)
            .single();

          preferredSports = profile?.sport_preferences
            ? Object.entries(profile.sport_preferences)
                .filter(([sport, enabled]) => enabled)
                .map(([sport]) => sport.toUpperCase())
            : [];
        }

        let query = supabase
          .from('ai_predictions')
          .select('*')
          .in('bet_type', ['moneyline', 'spread', 'total'])
          .order('created_at', { ascending: false })
          .limit(10);

        if (preferredSports.length > 0) {
          const filterString = preferredSports.map(sport => `sport.ilike.%${sport}%`).join(',');
          query = query.or(filterString);
        }

        const { data: picks, error } = await query;

        if (error) {
          console.error('Error fetching Pro team picks:', error);
          throw error;
        }

        const uniqueTeamPicks = picks ? Array.from(new Map(picks.map(p => [p.id, p])).values()) : [];
        setTeamPicks(uniqueTeamPicks);
        console.log(`✅ Loaded ${picks?.length || 0} Pro team picks`);
      }
    } catch (error) {
      console.error('Error fetching team picks:', error);
      setTeamPicks([]); // Set to empty array instead of showing an alert
      console.log('Setting empty team picks due to error:', error);
    } finally {
      setIsLoadingTeam(false);
    }
  };

  const fetchPlayerPropsPicks = async (force = false) => {
    if (!force && playerPropsPicks.length > 0) return; // Already loaded
    
    setIsLoadingProps(true);
    try {
      if (isElite) {
        // Elite users: Get 15 player props picks from Supabase with sport preferences
        console.log('🏆 Loading Elite player props picks (15 picks)');
        
        // NEW: Check if sport filter is active (overrides preferences)
        let preferredSports: string[] = [];
        if (selectedSportFilter !== 'ALL') {
          // Sport filter overrides user preferences
          preferredSports = [selectedSportFilter.toUpperCase()];
          console.log(`🎯 Sport filter active for props: ${selectedSportFilter}`);
        } else if (user?.id) {
          // Use user preferences when no filter is set
          const { data: profile } = await supabase
            .from('profiles')
            .select('sport_preferences')
            .eq('id', user.id)
            .single();
          
          preferredSports = profile?.sport_preferences 
            ? Object.entries(profile.sport_preferences)
                .filter(([sport, enabled]) => enabled)
                .map(([sport]) => sport.toUpperCase())
            : [];
        }
        
        console.log('🎯 User preferred sports for props:', preferredSports);
        
        // Build query for player props picks - FIXED: Use bet_type instead of pick text
        let query = supabase
          .from('ai_predictions')
          .select('*')
          .eq('bet_type', 'player_prop')
          .order('created_at', { ascending: false })
          .limit(15);
        
        // If user has sport preferences, apply them as filter
        if (preferredSports.length > 0) {
          // Use dynamic filter building
          let filterString = '';
          
          preferredSports.forEach((sport, index) => {
            if (index > 0) filterString += ',';
            filterString += `sport.ilike.%${sport}%`;
          });
          
          if (filterString) {
            query = query.or(filterString);
          }
        }
        
        const { data: picks, error } = await query;
        
        if (error) {
          console.error('Error fetching Elite player props picks:', error);
          throw error;
        }
        
        const uniquePropPicks = picks ? Array.from(new Map(picks.map(p => [p.id, p])).values()) : [];
        setPlayerPropsPicks(uniquePropPicks);
        console.log(`✅ Loaded ${picks?.length || 0} Elite player props picks`);
      } else {
        // Pro users: Get 10 player prop picks from Supabase with sport preferences
        console.log('💎 Loading Pro player props picks (10 picks)');

        // NEW: Check if sport filter is active (overrides preferences)
        let preferredSports: string[] = [];
        if (selectedSportFilter !== 'ALL') {
          // Sport filter overrides user preferences
          preferredSports = [selectedSportFilter.toUpperCase()];
          console.log(`🎯 Sport filter active for props: ${selectedSportFilter}`);
        } else if (user?.id) {
          // Use user preferences when no filter is set
          const { data: profile } = await supabase
            .from('profiles')
            .select('sport_preferences')
            .eq('id', user.id)
            .single();

          preferredSports = profile?.sport_preferences
            ? Object.entries(profile.sport_preferences)
                .filter(([sport, enabled]) => enabled)
                .map(([sport]) => sport.toUpperCase())
            : [];
        }

        let query = supabase
          .from('ai_predictions')
          .select('*')
          .eq('bet_type', 'player_prop')
          .order('created_at', { ascending: false })
          .limit(10);

        if (preferredSports.length > 0) {
          const filterString = preferredSports.map(sport => `sport.ilike.%${sport}%`).join(',');
          query = query.or(filterString);
        }

        const { data: picks, error } = await query;

        if (error) {
          console.error('Error fetching Pro player props picks:', error);
          throw error;
        }

        const uniquePropPicks = picks ? Array.from(new Map(picks.map(p => [p.id, p])).values()) : [];
        setPlayerPropsPicks(uniquePropPicks);
        console.log(`✅ Loaded ${picks?.length || 0} Pro player props picks`);
      }
    } catch (error) {
      console.error('Error fetching player props picks:', error);
      setPlayerPropsPicks([]); // Set to empty array instead of showing an alert
      console.log('Setting empty player props picks due to error:', error);
    } finally {
      setIsLoadingProps(false);
    }
  };

  // NEW: Refetch picks when sport filter changes
  useEffect(() => {
    if (selectedSportFilter) {
      fetchTeamPicks(true);
      fetchPlayerPropsPicks(true);
    }
  }, [selectedSportFilter]);

  // Load picks when component mounts
  useEffect(() => {
    // Fetch data (with or without user context)
    fetchTeamPicks(true);
    
    // Pre-load props for Elite users or when props tab is active (default)
    if (isElite || activeTab === 'props') {
      fetchPlayerPropsPicks(true);
    }
  }, [isElite]);

  // Load player props when tab is selected (for Pro users)
  useEffect(() => {
    if (!isElite && activeTab === 'props') {
      fetchPlayerPropsPicks();
    }
  }, [activeTab]);

  // Refresh function for pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Clear existing data and refetch
      if (activeTab === 'team') {
        setTeamPicks([]);
        await fetchTeamPicks(true);
      } else {
        setPlayerPropsPicks([]);
        await fetchPlayerPropsPicks(true);
      }
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
      eventTime: pick.event_time || pick.created_at || new Date().toISOString(),
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
        activeTab === tab && [
          styles.activeTabButton,
          isElite && {
            backgroundColor: theme.accentPrimary,
            borderColor: theme.accentPrimary,
            shadowColor: theme.accentPrimary
          }
        ]
      ]}
      onPress={() => setActiveTab(tab)}
    >
      <Text style={[
        styles.tabTitle,
        activeTab === tab && [
          styles.activeTabTitle,
          isElite && activeTab === tab && { color: '#000000' }
        ]
      ]}>
        {title}
      </Text>
      {/* Removed subtitle text to support multi-sport without confusion */}
      {count > 0 && (
        <View style={[
          styles.countBadge,
          isElite && { backgroundColor: theme.accentPrimary, shadowColor: theme.accentPrimary }
        ]}>
          <Text style={[
            styles.countText,
            isElite && { color: '#000000' }
          ]}>{count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const toAIPrediction = (p: Pick): AIPrediction => ({
    id: p.id,
    match: p.match_teams,
    pick: p.pick,
    odds: p.odds,
    confidence: p.confidence,
    sport: p.sport,
    eventTime: p.event_time || p.created_at || new Date().toISOString(),
    reasoning: p.reasoning,
    value: p.value_percentage,
    value_percentage: p.value_percentage,
    bet_type: p.bet_type,
    // Pass through ROI so the card can render it instead of "Calculating..."
    roi_estimate: p.roi_estimate !== undefined && p.roi_estimate !== null
      ? parseFloat(String(p.roi_estimate))
      : undefined,
    // Pass through metadata for new prop card
    metadata: (p as any).metadata,
    prop_market_type: (p as any).prop_market_type,
    line_value: (p as any).line_value,
    risk_level: (p as any).risk_level,
  });

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
            onPress={() => type === 'team' ? fetchTeamPicks(true) : fetchPlayerPropsPicks(true)}
          >
            <Text style={styles.retryButtonText}>Generate Picks</Text>
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
        {picks.map((pick, index) => {
          const prediction = toAIPrediction(pick);
          const isPlayerProp = pick.bet_type === 'player_prop' || type === 'player props';
          
          // Use new PropPredictionCard for player props
          if (isPlayerProp) {
            return (
              <PropPredictionCard
                key={pick.id}
                prediction={prediction}
                index={index}
                onPress={() => handlePickAnalyze(pick)}
              />
            );
          }
          
          // Use new TeamPredictionCard for team picks (moneyline, spread, total)
          return (
            <TeamPredictionCard
              key={pick.id}
              prediction={prediction}
              index={index}
              onPress={() => handlePickAnalyze(pick)}
            />
          );
        })}
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      {/* Enhanced Premium Header */}
      <LinearGradient
        colors={isElite ? theme.headerGradient : ['#1E40AF', '#7C3AED', '#0F172A']}
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
              <Crown size={20} color={isElite ? theme.accentPrimary : '#00E5FF'} />
              <View style={styles.titleTextContainer}>
                <Text style={[styles.headerTitle, isElite && { color: theme.headerTextPrimary }]}>{isElite ? 'Elite AI Predictions' : 'Pro AI Predictions'}</Text>
              </View>
              <Sparkles size={20} color={isElite ? theme.accentPrimary : '#00E5FF'} />
            </View>
            
            {/* NEW: Sport Filter Dropdown */}
            <SportFilterDropdown
              selectedSport={selectedSportFilter}
              onSelectSport={setSelectedSportFilter}
              isElite={isElite}
              theme={theme}
            />
          </View>

          {/* Compact Tabs under Title */}
          <View style={styles.headerTabs}>
            <TabButton
              tab="props"
              title="Player Props"
              subtitle=""
              count={playerPropsPicks.length}
            />
            <TabButton
              tab="team"
              title="Team Picks"
              subtitle=""
              count={teamPicks.length}
            />
          </View>
        </View>
      </LinearGradient>

      {/* Content */}
      <View style={styles.contentContainer}>
        {activeTab === 'team' 
          ? renderPicks(teamPicks, isLoadingTeam, 'team')
          : renderPicks(playerPropsPicks, isLoadingProps, 'player props')
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
    padding: 12,
    paddingTop: 18,
    position: 'relative',
    minHeight: 90,
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
    marginBottom: 8,
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
  // Compact header tabs row
  headerTabs: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    marginTop: 8,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#00E5FF', // Default color for Pro
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
  // Removed bottom tab container to increase scrollable area
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    borderRadius: 14,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
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
  // Removed tabSubtitle styles since subtitles are no longer used
  countBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: '#00E5FF',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
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
    fontSize: 9,
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