/**
 * 🎥 Video Player Component
 *
 * Features:
 * - Full-screen video playback
 * - Custom controls
 * - Share and download options
 * - Video analytics tracking
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Share,
  Dimensions,
  StatusBar
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Download,
  Share as ShareIcon,
  X,
  Heart,
  MessageCircle
} from 'lucide-react-native';
import { normalize } from '../services/device';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface VideoPlayerProps {
  video: {
    id: string;
    video_url: string;
    thumbnail_url?: string;
    content_prompt: string;
    video_type: string;
    views_count: number;
    downloads_count: number;
    shares_count: number;
    video_duration: number;
    created_at: string;
  };
  visible: boolean;
  onClose: () => void;
  onDownload?: () => void;
  onShare?: () => void;
}

export default function VideoPlayer({
  video,
  visible,
  onClose,
  onDownload,
  onShare
}: VideoPlayerProps) {
  const videoRef = useRef<Video>(null);
  const [status, setStatus] = useState<any>({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    if (visible) {
      StatusBar.setHidden(true, 'fade');
      setShowControls(true);
    } else {
      StatusBar.setHidden(false, 'fade');
    }

    return () => {
      StatusBar.setHidden(false, 'fade');
    };
  }, [visible]);

  const handlePlayPause = async () => {
    if (status.isPlaying) {
      await videoRef.current?.pauseAsync();
    } else {
      await videoRef.current?.playAsync();
    }
  };

  const handleMute = async () => {
    await videoRef.current?.setIsMutedAsync(!isMuted);
    setIsMuted(!isMuted);
  };

  const handleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleDownload = () => {
    if (onDownload) {
      onDownload();
    } else {
      Alert.alert('Download', 'Download functionality coming soon!');
    }
  };

  const handleShare = async () => {
    try {
      if (onShare) {
        onShare();
      } else {
        await Share.share({
          message: `Check out this AI-generated sports video: ${video.content_prompt}`,
          url: video.video_url,
          title: 'AI Sports Video'
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to share video');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = status.durationMillis
    ? (status.positionMillis / status.durationMillis) * 100
    : 0;

  if (!visible) return null;

  return (
    <View style={styles.container}>
      {/* Video */}
      <Video
        ref={videoRef}
        style={styles.video}
        source={{ uri: video.video_url }}
        useNativeControls={false}
        resizeMode={ResizeMode.CONTAIN}
        isLooping
        onPlaybackStatusUpdate={setStatus}
      />

      {/* Overlay Controls */}
      <TouchableOpacity
        style={styles.overlay}
        onPress={() => setShowControls(!showControls)}
        activeOpacity={1}
      >
        {/* Top Bar */}
        {showControls && (
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
            >
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.videoInfo}>
              <Text style={styles.videoType}>
                {video.video_type.replace('_', ' ').toUpperCase()}
              </Text>
              <Text style={styles.videoDuration}>
                {formatTime(video.video_duration)}
              </Text>
            </View>
          </View>
        )}

        {/* Center Play Button */}
        {showControls && !status.isPlaying && (
          <TouchableOpacity
            style={styles.centerPlayButton}
            onPress={handlePlayPause}
          >
            <View style={styles.playButtonCircle}>
              <Play size={40} color="#FFFFFF" fill="#FFFFFF" />
            </View>
          </TouchableOpacity>
        )}

        {/* Bottom Controls */}
        {showControls && (
          <View style={styles.bottomControls}>
            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBackground}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${progressPercentage}%` }
                  ]}
                />
              </View>
              <Text style={styles.timeText}>
                {formatTime(currentPosition)} / {formatTime(video.video_duration)}
              </Text>
            </View>

            {/* Control Buttons */}
            <View style={styles.controlsRow}>
              <TouchableOpacity
                style={styles.controlButton}
                onPress={handlePlayPause}
              >
                {status.isPlaying ? (
                  <Pause size={24} color="#FFFFFF" />
                ) : (
                  <Play size={24} color="#FFFFFF" fill="#FFFFFF" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.controlButton}
                onPress={handleMute}
              >
                {isMuted ? (
                  <VolumeX size={24} color="#FFFFFF" />
                ) : (
                  <Volume2 size={24} color="#FFFFFF" />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.controlButton}
                onPress={handleDownload}
              >
                <Download size={24} color="#00E5FF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.controlButton}
                onPress={handleShare}
              >
                <ShareIcon size={24} color="#00E5FF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.controlButton}
                onPress={() => setLiked(!liked)}
              >
                <Heart
                  size={24}
                  color={liked ? "#EF4444" : "#FFFFFF"}
                  fill={liked ? "#EF4444" : "transparent"}
                />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </TouchableOpacity>

      {/* Video Description */}
      {showControls && (
        <View style={styles.descriptionContainer}>
          <Text style={styles.descriptionTitle}>Video Description</Text>
          <Text style={styles.descriptionText}>{video.content_prompt}</Text>

          <View style={styles.statsContainer}>
            <View style={styles.stat}>
              <Text style={styles.statText}>{video.views_count}</Text>
              <Text style={styles.statLabel}>Views</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statText}>{video.downloads_count}</Text>
              <Text style={styles.statLabel}>Downloads</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statText}>{video.shares_count}</Text>
              <Text style={styles.statLabel}>Shares</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  video: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: normalize(20),
    paddingTop: normalize(40),
    paddingBottom: normalize(20),
  },
  closeButton: {
    padding: normalize(8),
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: normalize(20),
  },
  videoInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  videoType: {
    fontSize: normalize(12),
    fontWeight: '600',
    color: '#00E5FF',
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
    paddingHorizontal: normalize(8),
    paddingVertical: normalize(4),
    borderRadius: normalize(12),
    marginRight: normalize(8),
  },
  videoDuration: {
    fontSize: normalize(12),
    color: '#FFFFFF',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: normalize(8),
    paddingVertical: normalize(4),
    borderRadius: normalize(12),
  },
  centerPlayButton: {
    alignSelf: 'center',
    marginTop: 'auto',
    marginBottom: 'auto',
  },
  playButtonCircle: {
    width: normalize(80),
    height: normalize(80),
    borderRadius: normalize(40),
    backgroundColor: 'rgba(0, 229, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#00E5FF',
  },
  bottomControls: {
    paddingHorizontal: normalize(20),
    paddingBottom: normalize(40),
  },
  progressContainer: {
    marginBottom: normalize(16),
  },
  progressBackground: {
    height: normalize(4),
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: normalize(2),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#00E5FF',
    borderRadius: normalize(2),
  },
  timeText: {
    fontSize: normalize(12),
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: normalize(4),
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  controlButton: {
    padding: normalize(8),
  },
  descriptionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    padding: normalize(20),
    paddingBottom: normalize(40),
  },
  descriptionTitle: {
    fontSize: normalize(16),
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: normalize(8),
  },
  descriptionText: {
    fontSize: normalize(14),
    color: '#CBD5E1',
    lineHeight: normalize(20),
    marginBottom: normalize(16),
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statText: {
    fontSize: normalize(16),
    fontWeight: '700',
    color: '#00E5FF',
    marginBottom: normalize(2),
  },
  statLabel: {
    fontSize: normalize(12),
    color: '#64748B',
  },
});
