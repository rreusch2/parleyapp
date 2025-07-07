import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Linking,
  Dimensions,
  ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AlertCircle,
  TrendingUp,
  Clock,
  ExternalLink,
  Filter,
  Activity,
  User,
  MapPin,
  Zap,
  Calendar,
  Flame,
  Eye,
  Heart,
  Share,
  ChevronRight,
  AlertTriangle,
  CloudRain,
  DollarSign,
  Trophy,
  BarChart3
} from 'lucide-react-native';
import { supabase } from '../services/api/supabaseClient';
import NewsModal from './NewsModal';

const { width: screenWidth } = Dimensions.get('window');

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  content?: string;
  type: 'trade' | 'lineup' | 'weather' | 'breaking' | 'analysis' | 'injury';
  sport: string;
  league?: string;
  team?: string;
  player?: string;
  impact: 'high' | 'medium' | 'low';
  timestamp: string;
  source: string;
  sourceUrl?: string;
  imageUrl?: string;
  gameId?: string;
  tags?: string[];
  relevantToBets?: boolean;
  starred?: boolean;
  read?: boolean;
}

interface Props {
  limit?: number;
  sport?: string;
  showHeader?: boolean;
  onNewsClick?: (news: NewsItem) => void;
}

export default function NewsFeed({ 
  limit = 10, 
  sport, 
  showHeader = true, 
  onNewsClick 
}: Props) {
  const [allNews, setAllNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Filter out injury and weather news items and apply selected filter
  const filteredNews = allNews.filter(item => item.type !== 'injury' && item.type !== 'weather'); // Remove injury and weather items
  const news = selectedFilter === 'all' 
    ? filteredNews 
    : filteredNews.filter(item => item.type === selectedFilter);
  
  // Show only 8 items when collapsed, all when expanded
  const displayedNews = isExpanded ? news : news.slice(0, 8);
  const hasMoreNews = news.length > 8;

  useEffect(() => {
    fetchNews();
  }, [sport]);

  // Reset expansion when filter changes
  useEffect(() => {
    setIsExpanded(false);
  }, [selectedFilter]);

  const fetchNews = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Get authentication token
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // Build API URL (remove client-side filter from API call since we'll filter locally)
      const params = new URLSearchParams();
      if (sport) params.append('sport', sport);
      params.append('limit', (limit * 2).toString()); // Get more items to ensure we have enough after filtering

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://zooming-rebirth-production-a305.up.railway.app';
      const response = await fetch(`${baseUrl}/api/news?${params}`, {
        headers
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setAllNews(data.news || []);
      } else {
        setError('Failed to fetch news');
        setAllNews(getFallbackNews());
      }
    } catch (error) {
      console.error('Error fetching news:', error);
      setError('Unable to load news. Please try again.');
      // Set fallback news for development
      setAllNews(getFallbackNews());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    fetchNews(true);
  };

  const handleNewsPress = (newsItem: NewsItem) => {
    if (onNewsClick) {
      onNewsClick(newsItem);
    } else {
      setSelectedNews(newsItem);
      setModalVisible(true);
    }
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedNews(null);
  };

  const getNewsIcon = (type: string) => {
    switch (type) {
      case 'trade': return <TrendingUp size={16} color="#3B82F6" />;
      case 'lineup': return <User size={16} color="#10B981" />;
      case 'weather': return <CloudRain size={16} color="#64748B" />;
      case 'breaking': return <Zap size={16} color="#F59E0B" />;
      case 'analysis': return <BarChart3 size={16} color="#8B5CF6" />;
      default: return <Activity size={16} color="#6366F1" />;
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return '#EF4444';
      case 'medium': return '#F59E0B';
      case 'low': return '#10B981';
      default: return '#64748B';
    }
  };

  const getSportEmoji = (sport: string) => {
    switch (sport.toLowerCase()) {
      case 'nba': return '🏀';
      case 'nfl': return '🏈';
      case 'mlb': return '⚾';
      case 'nhl': return '🏒';
      default: return '🏟️';
    }
  };

  const formatTimeAgo = (timestamp: string): string => {
    const now = Date.now();
    const then = new Date(timestamp).getTime();
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const filters = [
    { key: 'all', label: 'All', icon: Activity, count: news.length },
    { key: 'breaking', label: 'Breaking', icon: Zap, count: news.filter(n => n.type === 'breaking').length },
    { key: 'trade', label: 'Trade', icon: TrendingUp, count: news.filter(n => n.type === 'trade').length },
    { key: 'lineup', label: 'Lineup', icon: User, count: news.filter(n => n.type === 'lineup').length },
    { key: 'analysis', label: 'Analysis', icon: BarChart3, count: news.filter(n => n.type === 'analysis').length }
  ];

  const getFallbackNews = (): NewsItem[] => [
    {
      id: '1',
      title: 'NBA MVP Race Heating Up',
      summary: 'With the season progressing, several players are emerging as strong contenders for the MVP award based on recent performances.',
      type: 'analysis',
      sport: 'NBA',
      impact: 'medium',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      source: 'ESPN'
    },
    {
      id: '2',
      title: 'BREAKING: Major League Baseball Updates Playoff Format',
      summary: 'MLB has announced significant changes to the playoff structure that will affect betting strategies and team preparations.',
      type: 'breaking',
      sport: 'MLB',
      impact: 'high',
      timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      source: 'MLB.com'
    },
    {
      id: '3',
      title: 'Advanced Analytics Reveal Betting Trends',
      summary: 'Recent statistical analysis shows interesting patterns in team performance that smart bettors should consider.',
      type: 'analysis',
      sport: 'NBA',
      impact: 'medium',
      timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      source: 'The Athletic'
    }
  ];

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00E5FF" />
        <Text style={styles.loadingText}>Loading latest news...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showHeader && (
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Live News Feed</Text>
              <View style={styles.liveBadge}>
                <View style={styles.liveIndicator} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>
            <Text style={styles.subtitle}>Real-time sports news & updates</Text>
          </View>
        </View>
      )}

      {/* Filters */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filtersContainer}
        contentContainerStyle={styles.filtersContent}
      >
        {filters.map((filter) => {
          const IconComponent = filter.icon;
          const isSelected = selectedFilter === filter.key;
          const count = filter.count || 0;
          
          // Only show filters that have content (except 'all')
          if (filter.key !== 'all' && count === 0) return null;
          
          return (
            <TouchableOpacity
              key={filter.key}
              style={[styles.filterChip, isSelected && styles.filterChipSelected]}
              onPress={() => setSelectedFilter(filter.key)}
            >
              <IconComponent 
                size={12} 
                color={isSelected ? '#0F172A' : '#64748B'} 
              />
              <Text style={[
                styles.filterText, 
                isSelected && styles.filterTextSelected
              ]}>
                {filter.label}
              </Text>
              {count > 0 && (
                <View style={[
                  styles.countBadge,
                  isSelected && styles.countBadgeSelected
                ]}>
                  <Text style={[
                    styles.countText,
                    isSelected && styles.countTextSelected
                  ]}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* News List */}
      <ScrollView
        style={styles.newsList}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00E5FF"
            colors={['#00E5FF']}
          />
        }
      >
        {error ? (
          <View style={styles.errorContainer}>
            <AlertTriangle size={24} color="#00E5FF" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => fetchNews()}>
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : news.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Activity size={24} color="#64748B" />
            <Text style={styles.emptyText}>No news available</Text>
            <Text style={styles.emptySubtext}>Pull down to refresh</Text>
          </View>
        ) : (
          <>
            {displayedNews.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={styles.newsCard}
                onPress={() => handleNewsPress(item)}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['#1E293B', '#334155']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.newsGradient}
                >
                  {/* Header */}
                  <View style={styles.newsHeader}>
                    <View style={styles.newsMetadata}>
                      <View style={styles.typeContainer}>
                        {getNewsIcon(item.type)}
                        <Text style={styles.newsType}>{item.type.toUpperCase()}</Text>
                      </View>
                      
                      <View style={styles.rightMetadata}>
                        <View style={styles.timeContainer}>
                          <Clock size={12} color="#94A3B8" />
                          <Text style={styles.timeText}>
                            {formatTimeAgo(item.timestamp)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Sport Badge */}
                    <View style={styles.sportBadge}>
                      <Text style={styles.sportEmoji}>{getSportEmoji(item.sport)}</Text>
                      <Text style={styles.sportText}>{item.sport}</Text>
                      {item.team && (
                        <>
                          <Text style={styles.separator}>•</Text>
                          <Text style={styles.teamText}>{item.team}</Text>
                        </>
                      )}
                    </View>
                  </View>

                  {/* Content */}
                  <View style={styles.newsContent}>
                    <Text style={styles.newsTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text style={styles.newsSummary} numberOfLines={3}>
                      {item.summary}
                    </Text>
                  </View>

                  {/* Footer */}
                  <View style={styles.newsFooter}>
                    <View style={styles.sourceContainer}>
                      <Text style={styles.sourceText}>{item.source}</Text>
                      {item.relevantToBets && (
                        <View style={styles.relevantBadge}>
                          <DollarSign size={12} color="#10B981" />
                          <Text style={styles.relevantText}>Bet Impact</Text>
                        </View>
                      )}
                    </View>
                    
                    <ChevronRight size={16} color="#64748B" />
                  </View>


                </LinearGradient>
              </TouchableOpacity>
            ))}
            
            {/* Show All / Show Less Button */}
            {hasMoreNews && (
              <TouchableOpacity
                style={styles.showAllButton}
                onPress={() => setIsExpanded(!isExpanded)}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={['rgba(0, 229, 255, 0.1)', 'rgba(0, 229, 255, 0.05)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.showAllGradient}
                >
                  <View style={styles.showAllContent}>
                    <Text style={styles.showAllText}>
                      {isExpanded ? 'Show Less' : `Show All ${news.length}`}
                    </Text>
                    <ChevronRight 
                      size={16} 
                      color="#00E5FF" 
                      style={[
                        styles.showAllChevron,
                        isExpanded && styles.showAllChevronRotated
                      ]}
                    />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
      
      {/* News Modal */}
      <NewsModal
        visible={modalVisible}
        onClose={handleCloseModal}
        newsItem={selectedNews}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 12,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  titleContainer: {
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
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
  filtersContainer: {
    marginBottom: 4,
  },
  filtersContent: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 16,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#334155',
    minWidth: 45,
    height: 28,
  },
  filterChipSelected: {
    backgroundColor: '#00E5FF',
    borderColor: '#00E5FF',
  },
  filterText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginLeft: 3,
  },
  filterTextSelected: {
    color: '#0F172A',
  },
  countBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 3,
    paddingVertical: 0,
    borderRadius: 6,
    marginLeft: 3,
    minWidth: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeSelected: {
    backgroundColor: 'rgba(15, 23, 42, 0.2)',
  },
  countText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#94A3B8',
    lineHeight: 10,
  },
  countTextSelected: {
    color: '#0F172A',
  },
  newsList: {
    paddingHorizontal: 16,
  },
  newsCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  newsGradient: {
    padding: 20,
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.05)',
  },
  newsHeader: {
    marginBottom: 12,
  },
  newsMetadata: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  typeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  newsType: {
    fontSize: 10,
    fontWeight: '600',
    color: '#00E5FF',
    marginLeft: 4,
  },
  rightMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  impactBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginRight: 8,
  },
  impactText: {
    fontSize: 9,
    fontWeight: '700',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 11,
    color: '#94A3B8',
    marginLeft: 4,
  },
  sportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sportEmoji: {
    fontSize: 14,
    marginRight: 6,
  },
  sportText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  separator: {
    fontSize: 12,
    color: '#64748B',
    marginHorizontal: 6,
  },
  teamText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  newsContent: {
    marginBottom: 12,
  },
  newsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 20,
    marginBottom: 6,
  },
  newsSummary: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 16,
  },
  newsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sourceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sourceText: {
    fontSize: 11,
    color: '#64748B',
    marginRight: 8,
  },
  relevantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  relevantText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#10B981',
    marginLeft: 2,
  },
  highImpactIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  errorContainer: {
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#00E5FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  retryText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  emptySubtext: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },
  showAllButton: {
    marginTop: 8,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  showAllGradient: {
    padding: 16,
  },
  showAllContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  showAllText: {
    color: '#00E5FF',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
  showAllChevron: {
    transform: [{ rotate: '90deg' }],
  },
  showAllChevronRotated: {
    transform: [{ rotate: '270deg' }],
  },
}); 