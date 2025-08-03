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
  Brain, 
  Target, 
  Trophy, 
  Crown, 
  BarChart3,
  ChevronRight,
  Activity,
  Clock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Zap,
  TrendingUp,
  Flame,
  Eye,
  Search,
  Database,
  Globe,
  Lock
} from 'lucide-react-native';
import { useSubscription } from '../services/subscriptionContext';

interface DailyInsight {
  id: string;
  title: string;
  description: string;
  category: 'weather' | 'injury' | 'pitcher' | 'bullpen' | 'trends' | 'matchup' | 'research' | 'intro';
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  research_sources: string[];
  created_at: string;
  insight_order?: number;
  insight_text?: string;
  teams?: string[];
  game_info?: {
    home_team: string;
    away_team: string;
    game_time: string;
    odds?: {
      home: number;
      away: number;
    };
  };
}

interface DailyProfessorInsightsProps {
  sport?: string;
}

const DailyProfessorInsights: React.FC<DailyProfessorInsightsProps> = ({ sport = 'MLB' }) => {
  const [insights, setInsights] = useState<DailyInsight[]>([]);
  const [dailyMessage, setDailyMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { isPro, isLoading: subLoading, openSubscriptionModal } = useSubscription();

  useEffect(() => {
    if (!subLoading) {
      fetchInsights();
    }
  }, [sport, subLoading]);

  const extractDailyMessage = (insights: DailyInsight[]): { message: string | null, remainingInsights: DailyInsight[] } => {
    if (!insights || insights.length === 0) {
      return { message: null, remainingInsights: [] };
    }

    // Find Professor Lock's introductory message - look for category 'intro' or insight_order = 1
    const introIndex = insights.findIndex(insight => 
      // Look for category 'intro' first, then fallback to insight_order = 1
      insight.category === 'intro' || 
      insight.insight_order === 1 ||
      insight.title === 'Daily AI Greeting' ||
      (insight.description && insight.description.toLowerCase().includes('brother') && 
       insight.description.length > 100 && 
       (insight.description.toLowerCase().includes('actionable') || 
        insight.description.toLowerCase().includes('intel') ||
        insight.description.toLowerCase().includes('insights')))
    );

    if (introIndex !== -1) {
      const introInsight = insights[introIndex];
      
      // Extract and clean up the intro message
      let message = introInsight.description || introInsight.insight_text || '';
      
      // Only process if we have a message
      if (!message) {
        return { message: null, remainingInsights: insights };
      }
      
      // Remove "no picks yet" references and similar phrases
      message = message.replace(/—no picks yet.*?win\./gi, '');
      message = message.replace(/no picks yet.*?win\./gi, '');
      message = message.replace(/—just pure value.*?win\./gi, '');
      message = message.replace(/just pure value.*?win\./gi, '');
      message = message.replace(/—pure value.*?win\./gi, '');
      message = message.replace(/pure value.*?win\./gi, '');
      
      // Clean up any double spaces or formatting
      message = message.replace(/\s+/g, ' ').trim();
      
      // Remove the intro message from the insights array
      const remainingInsights = insights.filter((_, index) => index !== introIndex);
      
      return { 
        message: message,
        remainingInsights: remainingInsights
      };
    }

    return { message: null, remainingInsights: insights };
  };

  const fetchInsights = async () => {
    try {
      setLoading(true);
      setError(null);

      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://zooming-rebirth-production-a305.up.railway.app';
      
      console.log('🧠 Fetching Daily AI Insights...');

      const response = await fetch(`${baseUrl}/api/insights/daily-professor-lock`);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Professor Lock insights response:', data);
        
        if (data.success && data.insights) {
          const { message, remainingInsights } = extractDailyMessage(data.insights);
          setDailyMessage(message);
          setInsights(remainingInsights);
          setLastGenerated(new Date(data.generated_at));
        } else {
          // If no insights exist, show empty state
          setDailyMessage(null);
          setInsights([]);
        }
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch insights:', response.status, errorText);
        setError('Failed to load insights. Please try again.');
      }

    } catch (error) {
      console.error('Error fetching Professor Lock insights:', error);
      setError('Connection error. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  const generateNewInsights = async () => {
    try {
      setRefreshing(true);
      setError(null);

      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://zooming-rebirth-production-a305.up.railway.app';
      
      console.log('🔄 Generating new Professor Lock insights...');

      const response = await fetch(`${baseUrl}/api/insights/generate-daily-professor-lock`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ New insights generated:', data);
        
        if (data.success && data.insights) {
          const { message, remainingInsights } = extractDailyMessage(data.insights);
          setDailyMessage(message);
          setInsights(remainingInsights);
          setLastGenerated(new Date());
          Alert.alert('Success', 'New Professor Lock insights generated!');
        }
      } else {
        const errorText = await response.text();
        console.error('Failed to generate insights:', response.status, errorText);
        Alert.alert('Error', 'Failed to generate new insights. Please try again.');
      }

    } catch (error) {
      console.error('Error generating insights:', error);
      Alert.alert('Error', 'Connection error. Please check your internet connection.');
    } finally {
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchInsights();
    setRefreshing(false);
  };

  const handleUpgrade = () => {
    openSubscriptionModal();
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'weather': return Activity;
      case 'injury': return AlertTriangle;
      case 'pitcher': return Target;
      case 'bullpen': return BarChart3;
      case 'trends': return TrendingUp;
      case 'matchup': return Trophy;
      case 'research': return Search;
      case 'intro': return Brain;
      default: return Brain;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'weather': return '#3B82F6';     // Blue
      case 'injury': return '#EF4444';      // Red  
      case 'pitcher': return '#00E5FF';     // Cyan
      case 'bullpen': return '#10B981';     // Green
      case 'trends': return '#F59E0B';      // Orange
      case 'matchup': return '#8B5CF6';     // Purple
      case 'research': return '#06B6D4';    // Teal
      case 'intro': return '#F472B6';       // Pink
      default: return '#00E5FF';
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return '#00E5FF';
      case 'medium': return '#8B5CF6';
      case 'low': return '#10B981';
      default: return '#64748B';
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return `${Math.floor(diffInHours / 24)}d ago`;
  };

    const renderDailyMessage = () => {
    if (!dailyMessage) return null;

    return (
      <View style={styles.dailyMessageContainer}>
        <LinearGradient
          colors={['#1E293B', '#0F172A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.dailyMessageGradient}
        >
          <Text style={styles.dailyMessageText}>
            {dailyMessage}
          </Text>
        </LinearGradient>
      </View>
    );
  };

  const renderInsightCard = (insight: DailyInsight) => (
    <TouchableOpacity key={insight.id} style={styles.insightCard} activeOpacity={0.85}>
      <LinearGradient
        colors={['#1E293B', '#334155']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.insightCardGradient}
      >
        {/* Category accent line */}
        <View style={[
          styles.categoryAccentLine,
          { backgroundColor: getCategoryColor(insight.category) }
        ]} />

        <View style={styles.cardContent}>
          {/* Header with category */}
          <View style={styles.insightHeader}>
            <View style={[
              styles.categoryBadge,
              { 
                backgroundColor: getCategoryColor(insight.category) + '20',
                borderWidth: 1,
                borderColor: getCategoryColor(insight.category) + '30'
              }
            ]}>
              {React.createElement(getCategoryIcon(insight.category), {
                size: 16,
                color: getCategoryColor(insight.category)
              })}
              <Text style={[
                styles.categoryText,
                { color: getCategoryColor(insight.category) }
              ]}>
                {insight.category.charAt(0).toUpperCase() + insight.category.slice(1)}
              </Text>
            </View>
          </View>

          {/* Title with category color and description */}
          {insight.title && (
            <Text style={[
              styles.insightTitle,
              { 
                color: getCategoryColor(insight.category),
                textShadowColor: getCategoryColor(insight.category) + '40',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 3,
              }
            ]}>
              {insight.title}
            </Text>
          )}
          <Text style={styles.insightDescription}>
            {insight.description || insight.insight_text || ''}
          </Text>
        </View>

        {/* Game info if available (without the problematic date) */}
        {insight.game_info && (
          <View style={styles.gameInfoSection}>
            <View style={styles.gameTeams}>
              <Text style={styles.gameTeamsText}>
                {insight.game_info.away_team} @ {insight.game_info.home_team}
              </Text>
            </View>
            {insight.game_info.odds && (
              <View style={styles.oddsContainer}>
                <Text style={styles.oddsText}>
                  {insight.game_info.odds.away > 0 ? '+' : ''}{insight.game_info.odds.away} / {insight.game_info.odds.home > 0 ? '+' : ''}{insight.game_info.odds.home}
                </Text>
              </View>
            )}
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );

  if (subLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00E5FF" />
      </View>
    );
  }



  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00E5FF" />
        <Text style={styles.loadingText}>Professor Lock is researching...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <AlertTriangle size={48} color="#00E5FF" />
        <Text style={styles.errorTitle}>Research Interrupted</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchInsights}>
          <RefreshCw size={16} color="#FFFFFF" />
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={['#0F172A', '#1E293B', '#0F172A']}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Brain size={24} color="#00E5FF" />
          <Text style={styles.title}>Daily AI Insights</Text>
          <View style={styles.proBadge}>
            <Crown size={12} color="#0F172A" />
            <Text style={styles.proText}>PRO</Text>
          </View>
        </View>
        <View style={styles.subtitleRow}>
          <Text style={styles.subtitle}>
            {sport} • Research-backed intelligence
          </Text>
          {lastGenerated && (
            <Text style={styles.timeStamp}>
              {formatTimeAgo(lastGenerated)}
            </Text>
          )}
        </View>
      </View>



      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00E5FF" />
        }
        showsVerticalScrollIndicator={false}
      >
        {insights.length > 0 || dailyMessage ? (
          <>
            {renderDailyMessage()}
            
            {isPro || isElite ? (
              /* Pro users see up to 8 insights, Elite users see up to 12 insights */
              (() => {
                const maxInsights = isElite ? 12 : 8;
                const filteredInsights = insights.slice(0, maxInsights);
                return filteredInsights.map(renderInsightCard);
              })()
            ) : (
              /* Free users see 1 random insight + upgrade prompt */
              <>
                {insights.length > 0 && renderInsightCard(insights[Math.floor(Math.random() * insights.length)])}
                
                {/* Locked content indicator */}
                <View style={styles.lockedSection}>
                  <LinearGradient
                    colors={['#1E293B', '#334155']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.lockedGradient}
                  >
                    <View style={styles.lockIconContainer}>
                      <View style={styles.lockIconBg}>
                        <Lock size={28} color="#00E5FF" />
                      </View>
                    </View>
                    
                    <Text style={styles.lockedTitle}>
                      {insights.length > 1 ? `${insights.length - 1} More Insights` : 'More Insights'} Available
                    </Text>
                    
                    <Text style={styles.lockedDescription}>
                      Unlock the complete daily analysis with advanced insights on weather, injuries, pitching matchups, and betting trends.
                    </Text>
                    
                    <TouchableOpacity style={styles.freeUpgradeButton} onPress={handleUpgrade}>
                      <LinearGradient
                        colors={['#00E5FF', '#0891B2']}
                        style={styles.freeUpgradeButtonGradient}
                      >
                        <Crown size={16} color="#0F172A" />
                        <Text style={styles.freeUpgradeButtonText}>Upgrade to Pro</Text>
                        <ChevronRight size={16} color="#0F172A" />
                      </LinearGradient>
                    </TouchableOpacity>
                  </LinearGradient>
                </View>
              </>
            )}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Brain size={56} color="#00E5FF" />
            <Text style={styles.emptyTitle}>Insights Loading</Text>
            <Text style={styles.emptyMessage}>
              AI is analyzing today's games with advanced metrics and real-time data. Fresh insights coming soon!
            </Text>
          </View>
        )}
      </ScrollView>
    </LinearGradient>
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
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 16,
    backgroundColor: 'rgba(30, 41, 59, 0.2)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 229, 255, 0.1)',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    marginLeft: 12,
    flex: 1,
    letterSpacing: 0.5,
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
  subtitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
  },
  timeStamp: {
    fontSize: 12,
    color: '#64748B',
  },

  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  dailyMessageContainer: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  dailyMessageGradient: {
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
  },
  dailyMessageText: {
    fontSize: 15,
    color: '#E2E8F0',
    lineHeight: 22,
    fontWeight: '400',
    fontStyle: 'italic',
  },

  insightCard: {
    marginBottom: 24,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
    transform: [{ scale: 1 }],
  },
  insightCardGradient: {
    padding: 0,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.15)',
    borderRadius: 20,
  },
  categoryAccentLine: {
    height: 3,
    width: '100%',
    shadowColor: 'rgba(0, 229, 255, 0.5)',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  cardContent: {
    padding: 24,
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
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
    letterSpacing: 0.3,
  },
  impactBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  impactText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  insightTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 14,
    letterSpacing: 0.8,
    lineHeight: 26,
  },
  insightDescription: {
    fontSize: 16,
    color: '#E2E8F0',
    lineHeight: 24,
    marginBottom: 20,
    fontWeight: '400',
    opacity: 0.95,
  },
  gameInfoSection: {
    backgroundColor: 'rgba(51, 65, 85, 0.4)',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#00E5FF',
    shadowColor: '#00E5FF',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  gameTeams: {
    marginBottom: 12,
  },
  gameTeamsText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  oddsContainer: {
    alignItems: 'center',
  },
  oddsText: {
    fontSize: 12,
    color: '#00E5FF',
    fontWeight: '600',
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
    backgroundColor: 'rgba(30, 41, 59, 0.3)',
    borderRadius: 20,
    marginHorizontal: 8,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.1)',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 20,
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  emptyMessage: {
    fontSize: 16,
    color: '#CBD5E1',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '400',
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

  // Free user locked section styles
  lockedSection: {
    marginTop: 20,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#00E5FF',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  lockedGradient: {
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
    borderRadius: 20,
    backgroundColor: 'rgba(0, 229, 255, 0.05)',
  },
  lockIconContainer: {
    marginBottom: 16,
  },
  lockIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    shadowColor: '#00E5FF',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  lockedTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  lockedDescription: {
    fontSize: 15,
    color: '#CBD5E1',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 12,
    fontWeight: '400',
  },
  freeUpgradeButton: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  freeUpgradeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  freeUpgradeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginHorizontal: 8,
  },
});

export default DailyProfessorInsights; 