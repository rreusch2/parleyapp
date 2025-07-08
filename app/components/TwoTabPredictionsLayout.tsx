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
}

interface TwoTabPredictionsLayoutProps {
  user: any;
}

export function TwoTabPredictionsLayout({ user }: TwoTabPredictionsLayoutProps) {
  const [activeTab, setActiveTab] = useState<'team' | 'props'>('team');
  const [teamPicks, setTeamPicks] = useState<Pick[]>([]);
  const [playerPropsPicks, setPlayerPropsPicks] = useState<Pick[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [teamLoading, setTeamLoading] = useState(false);
  const [propsLoading, setPropsLoading] = useState(false);

  const fetchTeamPicks = async () => {
    if (teamPicks.length > 0) return; // Already loaded
    
    setTeamLoading(true);
    try {
      // Use the correct API endpoint for team picks
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://zooming-rebirth-production-a305.up.railway.app';
      const response = await fetch(`${baseUrl}/api/ai/team-picks?test=true`);
      const data = await response.json();
      
      if (data.success) {
        setTeamPicks(data.picks);
        console.log(`✅ Loaded ${data.picks.length} team picks`);
      } else {
        console.error('Failed to load team picks:', data.error);
        Alert.alert('Error', 'Failed to load team picks');
      }
    } catch (error) {
      console.error('Error fetching team picks:', error);
      Alert.alert('Error', 'Network error loading team picks');
    } finally {
      setTeamLoading(false);
    }
  };

  const fetchPlayerPropsPicks = async () => {
    if (playerPropsPicks.length > 0) return; // Already loaded
    
    setPropsLoading(true);
    try {
      // Use the correct API endpoint for player props picks
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://zooming-rebirth-production-a305.up.railway.app';
      const response = await fetch(`${baseUrl}/api/ai/player-props-picks?test=true`);
      const data = await response.json();
      
      if (data.success) {
        setPlayerPropsPicks(data.picks);
        console.log(`✅ Loaded ${data.picks.length} player props picks`);
      } else {
        console.error('Failed to load player props picks:', data.error);
        Alert.alert('Error', 'Failed to load player props picks');
      }
    } catch (error) {
      console.error('Error fetching player props:', error);
      Alert.alert('Error', 'Network error loading player props');
    } finally {
      setPropsLoading(false);
    }
  };

  // Load team picks by default
  useEffect(() => {
    fetchTeamPicks();
  }, []);

  // Load player props when tab is selected
  useEffect(() => {
    if (activeTab === 'props') {
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
        await fetchTeamPicks();
      } else {
        setPlayerPropsPicks([]);
        await fetchPlayerPropsPicks();
      }
    } catch (error) {
      console.error('Error during refresh:', error);
    } finally {
      setRefreshing(false);
    }
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
            onPress={type === 'team' ? fetchTeamPicks : fetchPlayerPropsPicks}
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
        {picks.map((pick, index) => (
          <EnhancedPredictionCard
            key={pick.id}
            prediction={pick}
            index={index}
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
                <Text style={styles.headerTitle}>Pro AI Predictions</Text>
                
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
                {activeTab === 'team' ? teamPicks.length : playerPropsPicks.length}
              </Text>
              <Text style={styles.statLabel}>
                {activeTab === 'team' ? 'Team Picks' : 'Player Props'}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>PRO</Text>
              <Text style={styles.statLabel}>Tier</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Tab Buttons */}
      <View style={styles.tabContainer}>
        <TabButton
          tab="team"
          title="Team Picks"
          subtitle="ML • Spreads • Totals"
          count={teamPicks.length}
        />
        <TabButton
          tab="props"
          title="Player Props"
          subtitle="Hits • HRs • RBIs • More"
          count={playerPropsPicks.length}
        />
      </View>

      {/* Content */}
      <View style={styles.contentContainer}>
        {activeTab === 'team' 
          ? renderPicks(teamPicks, teamLoading, 'team')
          : renderPicks(playerPropsPicks, propsLoading, 'player props')
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