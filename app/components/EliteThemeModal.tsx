import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AVAILABLE_ELITE_THEMES, getThemeTokens, ThemeId, useUITheme } from '../services/uiThemeContext';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function EliteThemeModal({ visible, onClose }: Props) {
  const { themeId, setThemeId } = useUITheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <LinearGradient colors={["#0EA5E9", "#0369A1"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
            <Text style={styles.headerTitle}>Elite Theme</Text>
            <Text style={styles.headerSubtitle}>Personalize your Elite experience</Text>
          </LinearGradient>

          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.grid}>
              {AVAILABLE_ELITE_THEMES.map((opt) => {
                const tokens = getThemeTokens(opt.id);
                const selected = themeId === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.tile, selected && styles.tileSelected]}
                    activeOpacity={0.9}
                    onPress={() => setThemeId(opt.id)}
                  >
                    <LinearGradient colors={tokens.headerGradient} style={styles.tileGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                      <View style={styles.tileHeader}>
                        <Text style={[styles.tileTitle, { color: tokens.headerTextPrimary }]}>{opt.name}</Text>
                      </View>
                      <LinearGradient colors={tokens.ctaGradient} style={styles.ctaPreview} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                        <Text style={styles.ctaText}>Preview CTA</Text>
                      </LinearGradient>
                    </LinearGradient>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={[styles.resetButton]} onPress={() => setThemeId('elite_default')}>
              <Text style={styles.resetText}>Reset to Default</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0B1220',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    maxHeight: '86%',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#D1D5DB',
    marginTop: 4,
    fontSize: 12,
  },
  content: {
    padding: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tile: {
    width: '48%',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tileSelected: {
    borderColor: '#FFD700',
  },
  tileGradient: {
    height: 140,
    padding: 10,
    justifyContent: 'space-between',
  },
  tileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tileTitle: {
    fontWeight: '800',
    fontSize: 14,
  },
  ctaPreview: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6 }, android: { elevation: 3 } })
  },
  ctaText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '800',
  },
  footer: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    flexDirection: 'row',
    gap: 10,
  },
  resetButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)'
  },
  resetText: {
    fontWeight: '800',
    color: '#E5E7EB',
  },
  closeButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    flex: 1,
  },
  closeText: {
    fontWeight: '800',
    color: '#0F172A',
  },
});
