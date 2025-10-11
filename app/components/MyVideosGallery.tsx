import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  Share,
  Platform,
  Modal,
  Dimensions,
} from 'react-native';
import { Video as ExpoVideo, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { Film, Play, Download, Share2, Trash2, X, Eye } from 'lucide-react-native';
import { normalize } from '../services/device';
import { useUITheme } from '../services/uiThemeContext';
import { supabase } from '../services/api/supabaseClient';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface UserVideo {
  id: string;
  video_url: string;
  prompt_text: string;
  prompt_type: string;
  created_at: string;
  duration_seconds: number;
  views_count: number;
  downloads_count: number;
  shares_count: number;
}

export default function MyVideosGallery() {
  const { theme } = useUITheme();
  const [videos, setVideos] = useState<UserVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<UserVideo | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) return;

      const response = await fetch(`${baseUrl}/api/sora/my-videos?limit=50`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setVideos(data.videos.filter((v: any) => v.generation_status === 'completed'));
      }
    } catch (error) {
      console.error('Failed to fetch videos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVideoPress = async (video: UserVideo) => {
    setSelectedVideo(video);
    
    // Increment view count
    try {
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
      await fetch(`${baseUrl}/api/sora/video/${video.id}/increment-views`, {
        method: 'POST',
      });
    } catch (error) {
      console.error('Failed to increment views:', error);
    }
  };

  const handleShare = async (video: UserVideo) => {
    try {
      await Share.share({
        message: `Check out my AI-generated bet hype video from ParleyApp! 🎬🔥`,
        url: video.video_url,
      });

      // Increment share count
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
      await fetch(`${baseUrl}/api/sora/video/${video.id}/increment-shares`, {
        method: 'POST',
      });
    } catch (error) {
      console.error('Share failed:', error);
    }
  };

  const handleDownload = async (video: UserVideo) => {
    try {
      // Request media library permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant media library access to download videos.');
        return;
      }

      // Download video
      const fileUri = `${FileSystem.documentDirectory}${video.id}.mp4`;
      const { uri } = await FileSystem.downloadAsync(video.video_url, fileUri);

      // Save to media library
      await MediaLibrary.createAssetAsync(uri);

      Alert.alert('Success', 'Video saved to your gallery!');

      // Increment download count
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
      await fetch(`${baseUrl}/api/sora/video/${video.id}/increment-downloads`, {
        method: 'POST',
      });

    } catch (error: any) {
      console.error('Download failed:', error);
      Alert.alert('Download Failed', error.message || 'Could not save video');
    }
  };

  const handleDelete = async (video: UserVideo) => {
    Alert.alert(
      'Delete Video?',
      'This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
              const { data: { session } } = await supabase.auth.getSession();

              if (!session) return;

              await fetch(`${baseUrl}/api/sora/video/${video.id}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${session.access_token}`,
                },
              });

              // Remove from local state
              setVideos(videos.filter(v => v.id !== video.id));

            } catch (error) {
              console.error('Delete failed:', error);
              Alert.alert('Error', 'Failed to delete video');
            }
          },
        },
      ]
    );
  };

  const renderVideoItem = ({ item }: { item: UserVideo }) => (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => handleVideoPress(item)}
      style={styles.videoCard}
    >
      <LinearGradient
        colors={['#1E293B', '#334155']}
        style={styles.videoGradient}
      >
        {/* Thumbnail placeholder */}
        <View style={styles.thumbnailContainer}>
          <Film size={40} color="#00E5FF" />
          <View style={styles.playOverlay}>
            <Play size={24} color="#FFFFFF" fill="#FFFFFF" />
          </View>
        </View>

        <View style={styles.videoInfo}>
          <Text style={styles.videoType} numberOfLines={1}>
            {item.prompt_type === 'bet_slip_hype' ? '🔥 Bet Hype' : '📊 Pick Explainer'}
          </Text>
          <Text style={styles.videoDate}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
          
          <View style={styles.videoStats}>
            <View style={styles.stat}>
              <Eye size={12} color="#64748B" />
              <Text style={styles.statText}>{item.views_count}</Text>
            </View>
            <View style={styles.stat}>
              <Download size={12} color="#64748B" />
              <Text style={styles.statText}>{item.downloads_count}</Text>
            </View>
            <View style={styles.stat}>
              <Share2 size={12} color="#64748B" />
              <Text style={styles.statText}>{item.shares_count}</Text>
            </View>
          </View>
        </View>

        <View style={styles.videoActions}>
          <TouchableOpacity
            onPress={() => handleShare(item)}
            style={styles.actionButton}
          >
            <Share2 size={20} color="#00E5FF" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDownload(item)}
            style={styles.actionButton}
          >
            <Download size={20} color="#10B981" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDelete(item)}
            style={styles.actionButton}
          >
            <Trash2 size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <>
      <View style={styles.container}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Film size={40} color="#64748B" />
            <Text style={styles.loadingText}>Loading your videos...</Text>
          </View>
        ) : videos.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Film size={48} color="#64748B" />
            <Text style={styles.emptyTitle}>No videos yet</Text>
            <Text style={styles.emptyText}>
              Generate your first AI video to get started!
            </Text>
          </View>
        ) : (
          <FlatList
            data={videos}
            renderItem={renderVideoItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Video Player Modal */}
      <Modal
        visible={selectedVideo !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedVideo(null)}
      >
        <View style={styles.playerOverlay}>
          <TouchableOpacity
            style={styles.playerClose}
            onPress={() => setSelectedVideo(null)}
          >
            <X size={28} color="#FFFFFF" />
          </TouchableOpacity>

          {selectedVideo && (
            <ExpoVideo
              source={{ uri: selectedVideo.video_url }}
              style={styles.videoPlayer}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              isLooping
              shouldPlay={true}
            />
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: normalize(16),
  },
  videoCard: {
    marginBottom: normalize(12),
    borderRadius: normalize(12),
    overflow: 'hidden',
  },
  videoGradient: {
    flexDirection: 'row',
    padding: normalize(12),
    alignItems: 'center',
  },
  thumbnailContainer: {
    width: normalize(80),
    height: normalize(80),
    borderRadius: normalize(8),
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  playOverlay: {
    position: 'absolute',
    width: normalize(32),
    height: normalize(32),
    borderRadius: normalize(16),
    backgroundColor: 'rgba(0, 229, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoInfo: {
    flex: 1,
    marginLeft: normalize(12),
  },
  videoType: {
    fontSize: normalize(14),
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: normalize(4),
  },
  videoDate: {
    fontSize: normalize(12),
    color: '#94A3B8',
    marginBottom: normalize(8),
  },
  videoStats: {
    flexDirection: 'row',
    gap: normalize(12),
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: normalize(4),
  },
  statText: {
    fontSize: normalize(11),
    color: '#64748B',
    fontWeight: '500',
  },
  videoActions: {
    flexDirection: 'column',
    gap: normalize(8),
  },
  actionButton: {
    width: normalize(36),
    height: normalize(36),
    borderRadius: normalize(18),
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: normalize(60),
  },
  loadingText: {
    fontSize: normalize(14),
    color: '#64748B',
    marginTop: normalize(12),
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: normalize(60),
  },
  emptyTitle: {
    fontSize: normalize(18),
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: normalize(16),
    marginBottom: normalize(8),
  },
  emptyText: {
    fontSize: normalize(14),
    color: '#94A3B8',
    textAlign: 'center',
  },
  playerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerClose: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  videoPlayer: {
    width: SCREEN_WIDTH * 0.9,
    height: (SCREEN_WIDTH * 0.9) * (1280 / 720), // Portrait aspect ratio
    borderRadius: normalize(12),
  },
});

