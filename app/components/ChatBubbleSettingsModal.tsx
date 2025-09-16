import React, { useMemo, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useUISettings, ChatBubbleAnimation, BubbleSize, RingTheme } from '../services/uiSettingsContext';
import ChatBubblePreview from './ChatBubblePreview';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const ANIM_LABELS: Record<ChatBubbleAnimation, string> = {
  glow: 'Subtle Glow (default)',
  pulse: 'Gentle Pulse',
  shimmer: 'Logo Shimmer',
  static: 'Static (no animation)',
};

const SIZE_LABELS: Record<BubbleSize, string> = {
  standard: 'Standard',
  compact: 'Compact',
};

const THEME_LABELS: Record<RingTheme, string> = {
  auto: 'Auto (match tier)',
  aqua: 'Aqua',
  sunset: 'Sunset',
  indigo: 'Indigo',
};

function OptionRow({ selected, title, subtitle, onPress }: { selected: boolean; title: string; subtitle?: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.optionRow, selected && styles.optionRowSelected]} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.optionBullet}>
        <View style={[styles.bulletInner, selected && styles.bulletInnerSelected]} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.optionTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.optionSubtitle}>{subtitle}</Text>}
      </View>
    </TouchableOpacity>
  );
}

export default function ChatBubbleSettingsModal({ visible, onClose }: Props) {
  const {
    chatBubbleAnimation,
    bubbleSize,
    respectReduceMotion,
    ringTheme,
    setChatBubbleAnimation,
    setBubbleSize,
    setRespectReduceMotion,
    setRingTheme,
  } = useUISettings();
  const [exiting, setExiting] = useState(false);

  const animOptions = useMemo<ChatBubbleAnimation[]>(() => ['glow', 'pulse', 'shimmer', 'static'], []);
  const sizeOptions = useMemo<BubbleSize[]>(() => ['standard', 'compact'], []);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <LinearGradient colors={["#0EA5E9", "#0369A1"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
            <Text style={styles.headerTitle}>Chat Bubble Customization</Text>
            <Text style={styles.headerSubtitle}>Make it yours. Changes apply instantly.</Text>
          </LinearGradient>

          {/* Live Preview */}
          <View style={styles.previewArea}>
            <Text style={styles.previewTitle}>Preview</Text>
            <View style={styles.previewFrame}>
              <ChatBubblePreview animateOut={exiting} onExited={onClose} />
            </View>
          </View>

          <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ padding: 16 }}>
            <Text style={styles.sectionTitle}>Animation</Text>
            {animOptions.map((opt) => (
              <OptionRow
                key={opt}
                selected={chatBubbleAnimation === opt}
                title={ANIM_LABELS[opt]}
                onPress={() => setChatBubbleAnimation(opt)}
              />
            ))}

            <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Size</Text>
            {sizeOptions.map((opt) => (
              <OptionRow
                key={opt}
                selected={bubbleSize === opt}
                title={SIZE_LABELS[opt]}
                onPress={() => setBubbleSize(opt)}
              />
            ))}

            <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Ring Theme</Text>
            {(Object.keys(THEME_LABELS) as RingTheme[]).map((opt) => (
              <OptionRow
                key={opt}
                selected={ringTheme === opt}
                title={THEME_LABELS[opt]}
                onPress={() => setRingTheme(opt)}
              />
            ))}

            <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Motion</Text>
            <OptionRow
              selected={respectReduceMotion}
              title="Respect iOS/Android Reduce Motion"
              subtitle="When enabled, animations turn off automatically if the system setting is on."
              onPress={() => setRespectReduceMotion(!respectReduceMotion)}
            />
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setExiting(true);
                // ChatBubblePreview will call onExited -> onClose
              }}
            >
              <Text style={styles.closeText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0B1220',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  header: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#D1D5DB',
    marginTop: 4,
    fontSize: 12,
  },
  previewArea: {
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  previewTitle: {
    color: '#93C5FD',
    fontWeight: '700',
    marginBottom: 8,
  },
  previewFrame: {
    height: 140,
    backgroundColor: '#0A1220',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    color: '#93C5FD',
    fontWeight: '700',
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  optionRowSelected: {
    borderColor: '#0EA5E9',
    backgroundColor: '#0B1726',
  },
  optionBullet: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  bulletInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'transparent',
  },
  bulletInnerSelected: {
    backgroundColor: '#0EA5E9',
  },
  optionTitle: {
    color: 'white',
    fontWeight: '700',
  },
  optionSubtitle: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
  },
  closeButton: {
    backgroundColor: '#0EA5E9',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeText: {
    color: 'white',
    fontWeight: '800',
  },
});
