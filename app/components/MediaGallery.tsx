import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ImageBackground,
  Modal,
  Dimensions,
  Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Play, Image as ImageIcon, X, Volume2, VolumeX } from 'lucide-react-native';
import { normalize } from '../services/device';

// Types
export type MediaType = 'video' | 'image';

export interface MediaItem {
  id: string;
  type: MediaType;
  title?: string;
  thumbnail: string | number; // allow remote URL or require('...')
  source: string | number;    // allow remote URL or require('...')
}

interface MediaGalleryProps {
  title?: string;
  items?: MediaItem[];
}

// Provide a couple of safe default items users can replace later
const defaultItems: MediaItem[] = [
  {
    id: 'vid-1',
    type: 'video',
    title: 'How We Pick Winners',
    // Thumbnail is a generic gradient image hosted by unsplash (safe, public)
    thumbnail: 'https://images.unsplash.com/photo-1542332213-9b6f1b4a5efa?q=80&w=1200&auto=format&fit=crop',
    // Use a public sample video. Replace with your CDN/Supabase Storage URL later.
    source: 'https://www.w3schools.com/html/mov_bbb.mp4',
  },
  {
    id: 'img-1',
    type: 'image',
    title: 'Community Wins',
    thumbnail: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200&auto=format&fit=crop',
    source: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2400&auto=format&fit=crop',
  },
];

export default function MediaGallery({ title = 'Media', items = defaultItems }: MediaGalleryProps) {
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [muted, setMuted] = useState(false);
  const [videoAvailable, setVideoAvailable] = useState<boolean | null>(null);

  // Lazy-load expo-av only when a video is opened
  const VideoRef = useRef<any>(null);
  const VideoComponent = useMemo(() => {
    // Return a function to render the video once required
    return ({ source }: { source: any }) => {
      try {
        // We require inside render path to avoid crashing when expo-av isn't installed yet
        const ExpoAV = require('expo-av');
        const { Video } = ExpoAV;
        if (videoAvailable !== true) setVideoAvailable(true);
        return (
          <Video
            ref={VideoRef}
            source={typeof source === 'string' ? { uri: source } : source}
            style={styles.video}
            resizeMode={ExpoAV.ResizeMode.CONTAIN}
            shouldPlay
            isLooping
            isMuted={muted}
            useNativeControls
          />
        );
      } catch (e) {
        if (videoAvailable !== false) setVideoAvailable(false);
        return (
          <View style={styles.videoFallback}>
            <Text style={styles.videoFallbackText}>
              Video playback is unavailable. Please install expo-av.
            </Text>
          </View>
        );
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [muted, videoAvailable]);

  useEffect(() => {
    // Ensure video is muted state resets when closing
    if (!selected) {
      setMuted(false);
    }
  }, [selected]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        <TouchableOpacity onPress={() => router.push('/media')}>
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>

      {/* Thumbnails Row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.thumbRow}
      >
        {items.map((item) => (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.85}
            onPress={() => setSelected(item)}
            style={styles.thumbCard}
          >
            <ImageBackground
              source={typeof item.thumbnail === 'string' ? { uri: item.thumbnail } : item.thumbnail}
              style={styles.thumbImage}
              imageStyle={styles.thumbImageInner}
            >
              <LinearGradient
                colors={['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.55)']}
                style={styles.thumbGradient}
              />
              <View style={styles.thumbFooter}>
                <View style={styles.badge}>
                  {item.type === 'video' ? (
                    <Play size={14} color="#0F172A" />
                  ) : (
                    <ImageIcon size={14} color="#0F172A" />
                  )}
                </View>
                {item.title ? <Text numberOfLines={1} style={styles.thumbTitle}>{item.title}</Text> : null}
              </View>
            </ImageBackground>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Fullscreen Viewer */}
      <Modal
        visible={!!selected}
        animationType="fade"
        transparent
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSelected(null)} style={styles.closeBtn}>
              <X size={18} color="#0F172A" />
            </TouchableOpacity>
            {selected?.type === 'video' && (
              <TouchableOpacity onPress={() => setMuted((m) => !m)} style={styles.muteBtn}>
                {muted ? <VolumeX size={18} color="#0F172A" /> : <Volume2 size={18} color="#0F172A" />}
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.viewerBody}>
            {selected?.type === 'image' && (
              <Image
                source={typeof selected.source === 'string' ? { uri: selected.source } : selected.source}
                style={styles.viewerImage}
                resizeMode="contain"
              />
            )}

            {selected?.type === 'video' && (
              <VideoComponent source={selected.source} />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E293B',
    borderRadius: normalize(16),
    padding: normalize(16),
    borderWidth: 1,
    borderColor: '#334155',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: normalize(12),
  },
  title: {
    fontSize: normalize(18),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  viewAllText: {
    fontSize: normalize(14),
    color: '#00E5FF',
    fontWeight: '600',
  },
  thumbRow: {
    paddingRight: normalize(4),
  },
  thumbCard: {
    width: Math.min(screenWidth * 0.6, 280),
    height: Math.min(screenWidth * 0.34, 180),
    marginRight: normalize(12),
    borderRadius: normalize(12),
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  thumbImage: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  thumbImageInner: {
    resizeMode: 'cover',
  },
  thumbGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  thumbFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: normalize(10),
    paddingVertical: normalize(8),
  },
  badge: {
    backgroundColor: '#00E5FF',
    borderRadius: normalize(12),
    paddingHorizontal: normalize(8),
    paddingVertical: normalize(6),
    marginRight: normalize(8),
  },
  thumbTitle: {
    color: '#E2E8F0',
    fontSize: normalize(12),
    fontWeight: '600',
    flexShrink: 1,
  },
  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    paddingTop: Platform.OS === 'ios' ? normalize(44) : normalize(20),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: normalize(12),
    marginBottom: normalize(8),
  },
  closeBtn: {
    backgroundColor: '#00E5FF',
    borderRadius: normalize(16),
    padding: normalize(8),
    marginRight: normalize(8),
  },
  muteBtn: {
    backgroundColor: '#00E5FF',
    borderRadius: normalize(16),
    padding: normalize(8),
  },
  viewerBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImage: {
    width: screenWidth,
    height: screenHeight * 0.75,
  },
  video: {
    width: screenWidth,
    height: screenHeight * 0.75,
    backgroundColor: 'black',
  },
  videoFallback: {
    width: screenWidth,
    height: screenHeight * 0.75,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoFallbackText: {
    color: '#94A3B8',
    fontSize: normalize(14),
  },
});
