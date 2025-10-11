import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Film, Sparkles, Lock, Crown, Trophy, Star, Play, Download, Trash2, X } from 'lucide-react-native';
import { normalize } from '../services/device';
import soraVideoService, { GeneratedVideo } from '../services/api/soraVideoService';
import VideoGenerationLoader from './VideoGenerationLoader';
import { Video, ResizeMode } from 'expo-av';
import { useSubscription } from '../services/subscriptionContext';
import { supabase } from '../services/api/supabaseClient';

interface SoraVideoGeneratorProps {
  todaysPicks?: any[];
}

export default function SoraVideoGenerator({ todaysPicks = [] }: SoraVideoGeneratorProps) {
  const { isPro, isElite, openSubscriptionModal } = useSubscription();
  const [modalVisible, setModalVisible] = useState(false);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [userVideos, setUserVideos] = useState<GeneratedVideo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<GeneratedVideo | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    initializeUser();
  }, []);

  const initializeUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      loadUserVideos(user.id);
    }
  };

  const loadUserVideos = async (uid: string) => {
    try {
      const videos = await soraVideoService.getUserVideos(uid, 10);
      setUserVideos(videos);
    } catch (error) {
      console.error('Error loading videos:', error);
    }
  };

  const handleGenerateAIPickVideo = async () => {
    if (!userId) {
      Alert.alert('Error', 'Please sign in to generate videos');
      return;
    }

    if (!todaysPicks || todaysPicks.length === 0) {
      Alert.alert('No Picks Available', 'You need at least one AI pick to generate a hype video!');
      return;
    }

    // Get the best pick (highest confidence)
    const bestPick = todaysPicks.reduce((prev, current) => 
      (current.confidence > prev.confidence) ? current : prev
    );

    try {
      setGeneratingVideo(true);
      setGenerationProgress(0);
      
      const prompt = soraVideoService.constructor.buildAIPickHypePrompt(bestPick);
      
      const result = await soraVideoService.generateVideo({
        userId,
        videoType: 'ai_pick_hype',
        title: `${bestPick.sport} - ${bestPick.match_teams || bestPick.match}`,
        description: `AI Pick Hype Video: ${bestPick.pick} (${bestPick.confidence}% confidence)`,
        prompt,
        metadata: {
          pick: bestPick.pick,
          confidence: bestPick.confidence,
          odds: bestPick.odds,
          sport: bestPick.sport,
        },
        relatedPredictionId: bestPick.id,
      });

      setCurrentGenerationId(result.id);
      
      // Start progress simulation
      simulateProgress();
      
      // Subscribe to real-time updates
      const unsubscribe = soraVideoService.subscribeToVideo(result.id, (updatedVideo) => {
        if (updatedVideo.generation_status === 'completed') {
          setGeneratingVideo(false);
          setGenerationProgress(100);
          setSelectedVideo(updatedVideo);
          loadUserVideos(userId);
          unsubscribe();
          
          Alert.alert(
            '🎉 Video Ready!',
            'Your AI Pick Hype video has been generated successfully!',
            [{ text: 'View Now', onPress: () => setModalVisible(true) }]
          );
        } else if (updatedVideo.generation_status === 'failed') {
          setGeneratingVideo(false);
          unsubscribe();
          Alert.alert('Generation Failed', 'Sorry, we could not generate your video. Please try again.');
        }
      });

    } catch (error: any) {
      setGeneratingVideo(false);
      
      if (error.message.includes('limit')) {
        Alert.alert(
          'Daily Limit Reached',
          'Upgrade to Pro or Elite for more daily video generations!',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Upgrade', onPress: openSubscriptionModal },
          ]
        );
      } else {
        Alert.alert('Error', error.message || 'Failed to generate video');
      }
    }
  };

  const simulateProgress = () => {
    // Simulate progress while actual generation happens
    let progress = 0;
    const interval = setInterval(() => {
      progress += 2;
      if (progress >= 95) {
        clearInterval(interval);
        setGenerationProgress(95); // Stop at 95% until actual completion
      } else {
        setGenerationProgress(progress);
      }
    }, 1000);
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!userId) return;

    Alert.alert(
      'Delete Video',
      'Are you sure you want to delete this video?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await soraVideoService.deleteVideo(videoId, userId);
              loadUserVideos(userId);
              if (selectedVideo?.id === videoId) {
                setSelectedVideo(null);
              }
            } catch (error: any) {
              Alert.alert('Error', 'Failed to delete video');
            }
          },
        },
      ]
    );
  };

  const renderVideoTypeCard = (
    type: { key: string; title: string; description: string; tier: string; emoji: string },
    locked: boolean
  ) => (
    <TouchableOpacity
      key={type.key}
      style={[styles.videoTypeCard, locked && styles.videoTypeCardLocked]}
      onPress={() => {
        if (locked) {
          Alert.alert(
            `${type.tier === 'pro' ? 'Pro' : 'Elite'} Feature`,
            `Upgrade to ${type.tier === 'pro' ? 'Pro' : 'Elite'} to unlock ${type.title}!`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Upgrade', onPress: openSubscriptionModal },
            ]
          );
        } else if (type.key === 'ai_pick_hype') {
          handleGenerateAIPickVideo();
        } else {
          Alert.alert('Coming Soon', 'This video type will be available soon!');
        }
      }}
      disabled={generatingVideo}
    >
      <LinearGradient
        colors={locked ? ['#1E293B', '#0F172A'] : ['rgba(0, 229, 255, 0.1)', 'rgba(139, 92, 246, 0.1)']}
        style={styles.videoTypeGradient}
      >
        <View style={styles.videoTypeHeader}>
          <Text style={styles.videoTypeEmoji}>{type.emoji}</Text>
          {locked && <Lock size={16} color="#64748B" />}
        </View>
        <Text style={[styles.videoTypeTitle, locked && styles.lockedText]}>{type.title}</Text>
        <Text style={[styles.videoTypeDescription, locked && styles.lockedText]}>
          {type.description}
        </Text>
        {locked && (
          <View style={styles.tierBadge}>
            {type.tier === 'elite' ? (
              <Trophy size={12} color="#FFD700" />
            ) : (
              <Crown size={12} color="#00E5FF" />
            )}
            <Text style={styles.tierBadgeText}>{type.tier.toUpperCase()}</Text>
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );

  const videoTypes = [
    soraVideoService.constructor.getVideoTypeInfo('ai_pick_hype'),
    soraVideoService.constructor.getVideoTypeInfo('game_countdown'),
    soraVideoService.constructor.getVideoTypeInfo('player_spotlight'),
    soraVideoService.constructor.getVideoTypeInfo('weekly_recap'),
  ];

  return (
    <View style={styles.container}>
      {/* Main Card */}
      <TouchableOpacity
        style={styles.mainCard}
        onPress={() => setModalVisible(true)}
        disabled={generatingVideo}
      >
        <LinearGradient
          colors={['#8B5CF6', '#EC4899', '#F59E0B']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.mainGradient}
        >
          <View style={styles.mainCardContent}>
            <View style={styles.iconCircle}>
              <Film size={32} color="#FFFFFF" />
            </View>
            <View style={styles.mainTextContainer}>
              <Text style={styles.mainTitle}>AI Video Generator</Text>
              <Text style={styles.mainSubtitle}>Create epic sports videos with Sora 2</Text>
            </View>
            <Sparkles size={24} color="#FFD700" />
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Loading State */}
      {generatingVideo && (
        <VideoGenerationLoader videoType="ai_pick_hype" progress={generationProgress} />
      )}

      {/* Recent Videos Preview */}
      {userVideos.length > 0 && !generatingVideo && (
        <View style={styles.recentVideosContainer}>
          <Text style={styles.recentVideosTitle}>Your Videos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recentVideosScroll}>
            {userVideos.slice(0, 3).map((video) => (
              <TouchableOpacity
                key={video.id}
                style={styles.recentVideoCard}
                onPress={() => {
                  setSelectedVideo(video);
                  setModalVisible(true);
                }}
              >
                {video.thumbnail_url ? (
                  <Video
                    source={{ uri: video.video_url! }}
                    style={styles.recentVideoThumbnail}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay={false}
                    isLooping={false}
                  />
                ) : (
                  <View style={styles.recentVideoPlaceholder}>
                    <Film size={24} color="#00E5FF" />
                  </View>
                )}
                <Text style={styles.recentVideoTitle} numberOfLines={1}>
                  {video.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Full Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>AI Video Generator</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalScrollContent}>
            {selectedVideo && selectedVideo.generation_status === 'completed' ? (
              // Video Player View
              <View style={styles.videoPlayerContainer}>
                <Video
                  source={{ uri: selectedVideo.video_url! }}
                  style={styles.videoPlayer}
                  resizeMode={ResizeMode.CONTAIN}
                  useNativeControls
                  shouldPlay={false}
                  isLooping
                />
                <View style={styles.videoActions}>
                  <TouchableOpacity style={styles.actionButton}>
                    <Download size={20} color="#00E5FF" />
                    <Text style={styles.actionButtonText}>Download</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleDeleteVideo(selectedVideo.id)}
                  >
                    <Trash2 size={20} color="#EF4444" />
                    <Text style={[styles.actionButtonText, { color: '#EF4444' }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              // Video Type Selection
              <>
                <Text style={styles.sectionTitle}>Choose Video Type</Text>
                <View style={styles.videoTypesGrid}>
                  {videoTypes.map((type, index) => {
                    const locked =
                      (type.tier === 'pro' && !isPro && !isElite) ||
                      (type.tier === 'elite' && !isElite);
                    return renderVideoTypeCard({ key: `type-${index}`, ...type }, locked);
                  })}
                </View>

                {userVideos.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>Your Video Library</Text>
                    <View style={styles.videoLibrary}>
                      {userVideos.map((video) => (
                        <TouchableOpacity
                          key={video.id}
                          style={styles.videoLibraryCard}
                          onPress={() => setSelectedVideo(video)}
                        >
                          <View style={styles.videoLibraryThumbnail}>
                            <Play size={24} color="#00E5FF" />
                          </View>
                          <View style={styles.videoLibraryInfo}>
                            <Text style={styles.videoLibraryTitle} numberOfLines={1}>
                              {video.title}
                            </Text>
                            <Text style={styles.videoLibraryMeta}>
                              {new Date(video.created_at).toLocaleDateString()} • {video.views_count} views
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  mainCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  mainGradient: {
    padding: 20,
  },
  mainCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  mainTextContainer: {
    flex: 1,
  },
  mainTitle: {
    fontSize: normalize(18),
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  mainSubtitle: {
    fontSize: normalize(14),
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  recentVideosContainer: {
    marginTop: 12,
  },
  recentVideosTitle: {
    fontSize: normalize(16),
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  recentVideosScroll: {
    flexDirection: 'row',
  },
  recentVideoCard: {
    width: 120,
    marginRight: 12,
  },
  recentVideoThumbnail: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: '#1E293B',
  },
  recentVideoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentVideoTitle: {
    fontSize: normalize(12),
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  modalTitle: {
    fontSize: normalize(24),
    fontWeight: '800',
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 8,
  },
  modalContent: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: normalize(20),
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
    marginTop: 8,
  },
  videoTypesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  videoTypeCard: {
    width: '48%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  videoTypeCardLocked: {
    opacity: 0.7,
  },
  videoTypeGradient: {
    padding: 16,
    minHeight: 140,
  },
  videoTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  videoTypeEmoji: {
    fontSize: normalize(32),
  },
  videoTypeTitle: {
    fontSize: normalize(16),
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  videoTypeDescription: {
    fontSize: normalize(12),
    fontWeight: '500',
    color: '#94A3B8',
  },
  lockedText: {
    color: '#64748B',
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
    alignSelf: 'flex-start',
    gap: 4,
  },
  tierBadgeText: {
    fontSize: normalize(10),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  videoPlayerContainer: {
    marginBottom: 24,
  },
  videoPlayer: {
    width: '100%',
    height: 400,
    backgroundColor: '#000000',
    borderRadius: 16,
  },
  videoActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    fontSize: normalize(14),
    fontWeight: '600',
    color: '#00E5FF',
  },
  videoLibrary: {
    gap: 12,
  },
  videoLibraryCard: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  videoLibraryThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  videoLibraryInfo: {
    flex: 1,
  },
  videoLibraryTitle: {
    fontSize: normalize(14),
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  videoLibraryMeta: {
    fontSize: normalize(12),
    color: '#64748B',
  },
});

