import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ImageBackground, Image, Dimensions, Modal, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { listMedia } from './services/api/mediaService';
import type { MediaItem } from './components/MediaGallery';
import { Play, Image as ImageIcon, X, Volume2, VolumeX, ChevronLeft } from 'lucide-react-native';
import { normalize } from './services/device';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function MediaLibraryScreen() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [muted, setMuted] = useState(false);

  const VideoRef = useRef<any>(null);
  const VideoComponent = useMemo(() => {
    return ({ source }: { source: any }) => {
      try {
        const ExpoAV = require('expo-av');
        const { Video, ResizeMode } = ExpoAV;
        return (
          <Video
            ref={VideoRef}
            source={typeof source === 'string' ? { uri: source } : source}
            style={styles.viewerVideo}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay
            isLooping
            isMuted={muted}
            useNativeControls
          />
        );
      } catch (e) {
        return (
          <View style={styles.videoFallback}>
            <Text style={styles.videoFallbackText}>Video playback component unavailable. Install expo-av.</Text>
          </View>
        );
      }
    };
  }, [muted]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await listMedia();
        if (mounted) setItems(data);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selected) setMuted(false);
  }, [selected]);

  const renderItem = ({ item }: { item: MediaItem }) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={() => setSelected(item)}>
      <ImageBackground
        source={typeof item.thumbnail === 'string' ? { uri: item.thumbnail } : item.thumbnail}
        style={styles.cardImage}
        imageStyle={styles.cardImageInner}
      >
        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']} style={StyleSheet.absoluteFill} />
        <View style={styles.cardBadgeRow}>
          <View style={styles.badge}>
            {item.type === 'video' ? (
              <Play size={14} color="#0F172A" />
            ) : (
              <ImageIcon size={14} color="#0F172A" />
            )}
          </View>
        </View>
        {item.title ? <Text numberOfLines={1} style={styles.cardTitle}>{item.title}</Text> : null}
      </ImageBackground>
    </TouchableOpacity>
  );

  const numColumns = 2;
  const keyExtractor = (i: MediaItem) => i.id;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ChevronLeft size={18} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Media Library</Text>
        <View style={{ width: normalize(32) }} />
      </View>

      {/* Grid */}
      <FlatList
        data={items}
        keyExtractor={keyExtractor}
        numColumns={numColumns}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        renderItem={renderItem}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyState}><Text style={styles.emptyText}>Loading media…</Text></View>
          ) : (
            <View style={styles.emptyState}><Text style={styles.emptyText}>No media found yet</Text></View>
          )
        }
      />

      {/* Fullscreen viewer */}
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
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
            {selected?.type === 'video' && <VideoComponent source={selected.source} />}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? normalize(52) : normalize(24),
    paddingHorizontal: normalize(16),
    paddingBottom: normalize(8),
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: normalize(18),
    fontWeight: '700',
  },
  backBtn: {
    backgroundColor: '#00E5FF',
    borderRadius: normalize(16),
    padding: normalize(8),
  },
  listContent: {
    paddingHorizontal: normalize(12),
    paddingBottom: normalize(24),
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: normalize(12),
  },
  card: {
    width: (screenWidth - normalize(12) * 2 - normalize(12)) / 2,
    height: Math.min(screenWidth * 0.38, 220),
    borderRadius: normalize(12),
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardImage: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  cardImageInner: {
    resizeMode: 'cover',
  },
  cardBadgeRow: {
    position: 'absolute',
    top: normalize(8),
    left: normalize(8),
    flexDirection: 'row',
  },
  badge: {
    backgroundColor: '#00E5FF',
    borderRadius: normalize(12),
    paddingHorizontal: normalize(8),
    paddingVertical: normalize(6),
  },
  cardTitle: {
    color: '#E2E8F0',
    fontSize: normalize(12),
    fontWeight: '600',
    paddingHorizontal: normalize(8),
    paddingVertical: normalize(8),
  },
  emptyState: {
    paddingTop: normalize(40),
    alignItems: 'center',
  },
  emptyText: {
    color: '#94A3B8',
  },
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
  viewerVideo: {
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
