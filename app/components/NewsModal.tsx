import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Platform,
  Share,
  ActivityIndicator,
  Alert,
  Linking
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  Calendar,
  Clock,
  ExternalLink,
  Share as ShareIcon,
  Bookmark,
  BookmarkCheck,
  AlertCircle,
  TrendingUp,
  User,
  CloudRain,
  Zap,
  BarChart3,
  Activity,
  Eye,
  DollarSign,
  Flame
} from 'lucide-react-native';
import { NewsItem } from './NewsFeed';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface NewsModalProps {
  visible: boolean;
  onClose: () => void;
  newsItem: NewsItem | null;
}

// Helper function to safely convert any value to string for rendering
const safeStringify = (value: any): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'boolean') return value.toString();
  if (typeof value === 'object' && value.name) return value.name;
  if (typeof value === 'object' && value.title) return value.title;
  return JSON.stringify(value);
};

export default function NewsModal({ visible, onClose, newsItem }: NewsModalProps) {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!newsItem) return null;

  const getNewsIcon = (type: any) => {
    const typeStr = safeStringify(type);
    switch (typeStr) {
      case 'trade': return <TrendingUp size={20} color="#3B82F6" />;
      case 'lineup': return <User size={20} color="#10B981" />;
      case 'weather': return <CloudRain size={20} color="#64748B" />;
      case 'breaking': return <Zap size={20} color="#F59E0B" />;
      case 'analysis': return <BarChart3 size={20} color="#8B5CF6" />;
      case 'injury': return <AlertCircle size={20} color="#EF4444" />;
      default: return <Activity size={20} color="#6366F1" />;
    }
  };

  const getImpactColor = (impact: any) => {
    const impactStr = safeStringify(impact);
    switch (impactStr) {
      case 'high': return '#EF4444';
      case 'medium': return '#F59E0B';
      case 'low': return '#10B981';
      default: return '#64748B';
    }
  };

  const getSportEmoji = (sport: any) => {
    const sportStr = safeStringify(sport).toLowerCase();
    switch (sportStr) {
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

  const handleShare = async () => {
    try {
      const shareContent = {
        title: safeStringify(newsItem.title),
        message: `${safeStringify(newsItem.title)}\n\n${safeStringify(newsItem.summary)}\n\nShared from ParleyApp`,
        url: newsItem.sourceUrl || undefined
      };

      if (Platform.OS === 'ios') {
        await Share.share(shareContent);
      } else {
        await Share.share({
          title: shareContent.title,
          message: shareContent.message
        });
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleBookmark = () => {
    setIsBookmarked(!isBookmarked);
    // TODO: Implement bookmark functionality with backend
  };

  const handleExternalLink = async () => {
    if (newsItem.sourceUrl) {
      try {
        const supported = await Linking.canOpenURL(newsItem.sourceUrl);
        if (supported) {
                      Alert.alert(
              'Open External Link',
              `This will open ${safeStringify(newsItem.source)} in your browser`,
              [
                { text: 'Cancel', style: 'cancel' },
                { 
                  text: 'Open', 
                  onPress: () => Linking.openURL(newsItem.sourceUrl!)
                }
              ]
            );
        } else {
          Alert.alert('Error', 'Cannot open this link');
        }
      } catch (error) {
        console.error('Error opening link:', error);
        Alert.alert('Error', 'Failed to open link');
      }
    }
  };

  const getFullContent = () => {
    if (newsItem.content) {
      return safeStringify(newsItem.content);
    }
    
    // If no full content, show just the summary
    const summary = safeStringify(newsItem.summary);
    return summary;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <View style={styles.modalContainer}>
        <LinearGradient
          colors={['#0F172A', '#1E293B']}
          style={styles.modalGradient}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>
            
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={handleBookmark} style={styles.actionButton}>
                {isBookmarked ? (
                  <BookmarkCheck size={20} color="#00E5FF" />
                ) : (
                  <Bookmark size={20} color="#94A3B8" />
                )}
              </TouchableOpacity>
              
              <TouchableOpacity onPress={handleShare} style={styles.actionButton}>
                <ShareIcon size={20} color="#94A3B8" />
              </TouchableOpacity>
              
              {newsItem.sourceUrl && (
                <TouchableOpacity onPress={handleExternalLink} style={styles.actionButton}>
                  <ExternalLink size={20} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Article Content */}
          <ScrollView 
            style={styles.content}
            showsVerticalScrollIndicator={false}
            bounces={true}
          >
            {/* Article Header */}
            <View style={styles.articleHeader}>
              {/* Type Badge */}
              <View style={styles.badgeContainer}>
                <View style={styles.typeBadge}>
                  {getNewsIcon(newsItem.type)}
                  <Text style={styles.typeText}>{newsItem.type.toUpperCase()}</Text>
                </View>
                
                {Boolean(newsItem.relevantToBets) && (
                  <View style={styles.relevantBadge}>
                    <DollarSign size={12} color="#10B981" />
                    <Text style={styles.relevantText}>BET IMPACT</Text>
                  </View>
                )}
              </View>

              {/* Sport Info */}
              <View style={styles.sportInfo}>
                <Text style={styles.sportEmoji}>{getSportEmoji(newsItem.sport)}</Text>
                <Text style={styles.sportText}>{safeStringify(newsItem.sport)}</Text>
                {newsItem.team && (
                  <>
                    <Text style={styles.separator}>•</Text>
                    <Text style={styles.teamText}>
                      {safeStringify(newsItem.team)}
                    </Text>
                  </>
                )}
                {newsItem.player && (
                  <>
                    <Text style={styles.separator}>•</Text>
                    <Text style={styles.playerText}>
                      {safeStringify(newsItem.player)}
                    </Text>
                  </>
                )}
              </View>

              {/* Title */}
              <Text style={styles.title}>
                {safeStringify(newsItem.title)}
              </Text>

              {/* Metadata */}
              <View style={styles.metadata}>
                <View style={styles.metadataItem}>
                  <Clock size={14} color="#94A3B8" />
                  <Text style={styles.metadataText}>{formatTimeAgo(newsItem.timestamp)}</Text>
                </View>
                <View style={styles.metadataItem}>
                  <Text style={styles.sourceText}>
                    By {safeStringify(newsItem.source)}
                  </Text>
                </View>
              </View>


            </View>

            {/* Article Body */}
            <View style={styles.articleBody}>
              <Text style={styles.bodyText}>{getFullContent()}</Text>
              
              {!newsItem.content && newsItem.sourceUrl && (
                <View style={styles.contentNote}>
                  <Text style={styles.contentNoteText}>
                    📖 This is a summary. Tap "Read Full Article" below for the complete story.
                  </Text>
                </View>
              )}
            </View>



            {/* Footer */}
            {newsItem.sourceUrl && (
              <View style={styles.footer}>
                <TouchableOpacity onPress={handleExternalLink} style={styles.readMoreButton}>
                  <Text style={styles.readMoreText}>Read Full Article</Text>
                  <ExternalLink size={14} color="#00E5FF" />
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  modalGradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeButton: {
    padding: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  content: {
    flex: 1,
  },
  articleHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 4,
  },
  impactBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  impactText: {
    fontSize: 10,
    fontWeight: '600',
  },
  relevantBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  relevantText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#10B981',
    marginLeft: 4,
  },
  sportInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sportEmoji: {
    fontSize: 16,
    marginRight: 8,
  },
  sportText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#00E5FF',
  },
  separator: {
    fontSize: 12,
    color: '#64748B',
    marginHorizontal: 6,
  },
  teamText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  playerText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 32,
    marginBottom: 16,
  },
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metadataText: {
    fontSize: 12,
    color: '#94A3B8',
    marginLeft: 4,
  },
  sourceText: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
  },
  highImpactAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 16,
  },
  highImpactText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
    marginLeft: 6,
  },
  articleBody: {
    padding: 20,
  },
  bodyText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#E2E8F0',
    fontWeight: '400',
  },
  contentNote: {
    marginTop: 20,
    backgroundColor: 'rgba(0, 229, 255, 0.05)',
    borderLeftWidth: 3,
    borderLeftColor: '#00E5FF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  contentNoteText: {
    fontSize: 14,
    color: '#94A3B8',
    fontStyle: 'italic',
    lineHeight: 20,
  },

  footer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  readMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
  },
  readMoreText: {
    fontSize: 14,
    color: '#00E5FF',
    fontWeight: '600',
    marginRight: 8,
  },
}); 