/**
 * 🎥 Video Gallery Component
 *
 * Features:
 * - Display generated videos
 * - Video playback
 * - Download functionality
 * - Delete videos
 * - User tier-based features
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  Share,
  RefreshControl,
  Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Video,
  Play,
  Download,
  Share as ShareIcon,
  Trash2,
  Eye,
  Calendar,
  Sparkles,
  Crown,
  MoreHorizontal
} from 'lucide-react-native';
import { useSubscription } from '../services/subscriptionContext';
import { useUITheme } from '../services/uiThemeContext';
import { normalize } from '../services/device';

interface UserVideo {
  id: string;
  video_type: string;
  content_prompt: string;
  generation_status: string;
  video_url?: string;
  thumbnail_url?: string;
  video_duration: number;
  views_count: number;
  downloads_count: number;
  shares_count: number;
  sport?: string;
  created_at: string;
  metadata: any;
}

interface VideoGalleryProps {
  onVideoSelect?: (video: UserVideo) => void;
  showHeader?: boolean;
  limit?: number;
}

export default function VideoGallery({
  onVideoSelect,
  showHeader = true,
  limit = 20
}: VideoGalleryProps) {
  const { isPro, isElite } = useSubscription();
  const { theme } = useUITheme();

  const [videos, setVideos] = useState<UserVideo[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVideos();
  }, []);

  const loadVideos = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/videos/user`, {
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`
        }
      });

      const result = await response.json();
      setVideos(result.videos || []);
    } catch (error) {
      console.error('Error loading videos:', error);
      Alert.alert('Error', 'Failed to load videos');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadVideos();
    setRefreshing(false);
  };

  const handleVideoPress = (video: UserVideo) => {
    if (onVideoSelect) {
      onVideoSelect(video);
    }
  };

  const handleDownload = async (video: UserVideo) => {
    try {
      // Increment download count
      await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/videos/download/${video.id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await getAuthToken()}`
        }
      });

      // Open video URL in browser for download
      if (video.video_url) {
        // In a real app, you'd use react-native-fs or similar to download
        Alert.alert('Download', 'Opening video for download...');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to download video');
    }
  };

  const handleShare = async (video: UserVideo) => {
    try {
      await Share.share({
        message: `Check out this AI-generated sports video: ${video.content_prompt}`,
        url: video.video_url,
        title: 'AI Sports Video'
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share video');
    }
  };

  const handleDelete = async (video: UserVideo) => {
    Alert.alert(
      'Delete Video',
      'Are you sure you want to delete this video? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(
                `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/videos/${video.id}`,
                {
                  method: 'DELETE',
                  headers: {
                    'Authorization': `Bearer ${await getAuthToken()}`
                  }
                }
              );

              if (response.ok) {
                setVideos(prev => prev.filter(v => v.id !== video.id));
                Alert.alert('Success', 'Video deleted successfully');
              } else {
                throw new Error('Failed to delete video');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete video');
            }
          }
        }
      ]
    );
  };

  const getVideoTypeIcon = (videoType: string) => {
    switch (videoType) {
      case 'highlight_reel': return Video;
      case 'player_analysis': return Eye;
      case 'strategy_explanation': return Target;
      case 'trend_analysis': return Sparkles;
      default: return Video;
    }
  };

  const getVideoTypeColor = (videoType: string) => {
    switch (videoType) {
      case 'highlight_reel': return '#00E5FF';
      case 'player_analysis': return '#10B981';
      case 'strategy_explanation': return '#F59E0B';
      case 'trend_analysis': return '#8B5CF6';
      default: return '#EC4899';
    }
  };

  const renderVideoItem = ({ item }: { item: UserVideo }) => {
    const IconComponent = getVideoTypeIcon(item.video_type);
    const iconColor = getVideoTypeColor(item.video_type);

    return (
      <TouchableOpacity
        style={styles.videoItem}
        onPress={() => handleVideoPress(item)}
      >
        <LinearGradient
          colors={['#1E293B', '#334155']}
          style={styles.videoCard}
        >
          {/* Thumbnail/Video Preview */}
          <View style={styles.thumbnailContainer}>
            {item.thumbnail_url ? (
              <Image source={{ uri: item.thumbnail_url }} style={styles.thumbnail} />
            ) : (
              <View style={[styles.thumbnailPlaceholder, { backgroundColor: `${iconColor}20` }]}>
                <IconComponent size={40} color={iconColor} />
              </View>
            )}

            {/* Video Type Badge */}
            <View style={[styles.videoTypeBadge, { backgroundColor: iconColor }]}>
              <Text style={styles.videoTypeText}>
                {item.video_type.replace('_', ' ').toUpperCase()}
              </Text>
            </View>

            {/* Duration Badge */}
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{item.video_duration}s</Text>
            </View>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.videoPrompt} numberOfLines={2}>
              {item.content_prompt}
            </Text>

            <View style={styles.statsContainer}>
              <View style={styles.stat}>
                <Eye size={14} color="#64748B" />
                <Text style={styles.statText}>{item.views_count}</Text>
              </View>
              <View style={styles.stat}>
                <Download size={14} color="#64748B" />
                <Text style={styles.statText}>{item.downloads_count}</Text>
              </View>
              <View style={styles.stat}>
                <ShareIcon size={14} color="#64748B" />
                <Text style={styles.statText}>{item.shares_count}</Text>
              </View>
            </View>

            <Text style={styles.createdAt}>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleDownload(item)}
            >
              <Download size={20} color="#00E5FF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleShare(item)}
            >
              <ShareIcon size={20} color="#00E5FF" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleDelete(item)}
            >
              <Trash2 size={20} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Video size={60} color="#64748B" />
      <Text style={styles.emptyTitle}>No Videos Yet</Text>
      <Text style={styles.emptyText}>
        Create your first AI-generated video to get started!
      </Text>
    </View>
  );

  const renderHeader = () => {
    if (!showHeader) return null;

    return (
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>🎥 My AI Videos</Text>
          <Text style={styles.headerSubtitle}>
            {isElite ? 'Elite: Unlimited videos' :
             isPro ? 'Pro: 10 videos/day' : 'Free: 2 videos/day'}
          </Text>
        </View>

        {isElite && (
          <View style={styles.eliteBadge}>
            <Crown size={16} color="#FFD700" />
            <Text style={styles.eliteBadgeText}>Elite</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={videos}
        renderItem={renderVideoItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContainer}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00E5FF"
            colors={['#00E5FF']}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  listContainer: {
    padding: normalize(16),
    paddingBottom: normalize(100),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: normalize(16),
    paddingVertical: normalize(16),
    marginBottom: normalize(16),
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: normalize(24),
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: normalize(4),
  },
  headerSubtitle: {
    fontSize: normalize(14),
    color: '#64748B',
  },
  eliteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: normalize(12),
    paddingVertical: normalize(6),
    borderRadius: normalize(16),
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  eliteBadgeText: {
    fontSize: normalize(12),
    fontWeight: '700',
    color: '#FFD700',
    marginLeft: normalize(4),
  },
  videoItem: {
    flex: 1,
    margin: normalize(8),
    maxWidth: (Dimensions.get('window').width - 48) / 2,
  },
  videoCard: {
    borderRadius: normalize(16),
    overflow: 'hidden',
    padding: normalize(12),
  },
  thumbnailContainer: {
    position: 'relative',
    marginBottom: normalize(12),
  },
  thumbnail: {
    width: '100%',
    height: normalize(120),
    borderRadius: normalize(12),
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: normalize(120),
    borderRadius: normalize(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoTypeBadge: {
    position: 'absolute',
    top: normalize(8),
    left: normalize(8),
    paddingHorizontal: normalize(6),
    paddingVertical: normalize(2),
    borderRadius: normalize(8),
  },
  videoTypeText: {
    fontSize: normalize(10),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  durationBadge: {
    position: 'absolute',
    bottom: normalize(8),
    right: normalize(8),
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: normalize(6),
    paddingVertical: normalize(2),
    borderRadius: normalize(8),
  },
  durationText: {
    fontSize: normalize(10),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
  },
  videoPrompt: {
    fontSize: normalize(14),
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: normalize(18),
    marginBottom: normalize(8),
  },
  statsContainer: {
    flexDirection: 'row',
    marginBottom: normalize(8),
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: normalize(12),
  },
  statText: {
    fontSize: normalize(12),
    color: '#64748B',
    marginLeft: normalize(4),
  },
  createdAt: {
    fontSize: normalize(11),
    color: '#475569',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: normalize(8),
    paddingTop: normalize(8),
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  actionButton: {
    padding: normalize(4),
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: normalize(60),
  },
  emptyTitle: {
    fontSize: normalize(20),
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: normalize(16),
    marginBottom: normalize(8),
  },
  emptyText: {
    fontSize: normalize(16),
    color: '#64748B',
    textAlign: 'center',
    lineHeight: normalize(22),
  },
});
