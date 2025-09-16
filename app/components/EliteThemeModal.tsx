import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Lock, Crown } from 'lucide-react-native';
import { ALL_THEMES, getThemeTokens, ThemeId, useUITheme, canUserAccessTheme } from '../services/uiThemeContext';
import { useSubscription } from '../services/subscriptionContext';

interface Props {
  visible: boolean;
  onClose: () => void;
  onUpgradePress?: () => void;
}

export default function EliteThemeModal({ visible, onClose, onUpgradePress }: Props) {
  const { themeId, setThemeId } = useUITheme();
  const { isElite, isPro } = useSubscription();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <LinearGradient colors={["#0EA5E9", "#0369A1"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
            <Text style={styles.headerTitle}>App Themes</Text>
            <Text style={styles.headerSubtitle}>
              {isElite ? 'Choose from all 6 premium themes' : isPro ? 'Choose from 2 Pro themes' : 'Upgrade to unlock premium themes'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.headerClose}>
              <X size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </LinearGradient>

          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.grid}>
              {ALL_THEMES.map((opt) => {
                const tokens = getThemeTokens(opt.id);
                const selected = themeId === opt.id;
                const canAccess = canUserAccessTheme(opt.id, isElite, isPro);
                const isLocked = !canAccess;
                
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.tile, selected && styles.tileSelected, isLocked && styles.tileLocked]}
                    activeOpacity={0.9}
                    onPress={() => {
                      if (isLocked && onUpgradePress) {
                        onUpgradePress();
                      } else if (canAccess) {
                        setThemeId(opt.id);
                      }
                    }}
                  >
                    <LinearGradient colors={tokens.headerGradient} style={[styles.tileGradient, isLocked && styles.tileGradientLocked]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                      <View style={styles.tileHeader}>
                        <Text style={[styles.tileTitle, { color: tokens.headerTextPrimary }, isLocked && styles.titleLocked]}>{opt.name}</Text>
                        {isLocked && (
                          <View style={styles.lockIcon}>
                            <Lock size={14} color="rgba(255,255,255,0.6)" />
                          </View>
                        )}
                      </View>
                      <LinearGradient colors={tokens.ctaGradient} style={[styles.ctaPreview, isLocked && styles.ctaPreviewLocked]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                        <Text style={[styles.ctaText, isLocked && styles.ctaTextLocked]}>Preview CTA</Text>
                      </LinearGradient>
                    </LinearGradient>
                    {isLocked && (
                      <View style={styles.lockOverlay}>
                        <Lock size={20} color="rgba(255,255,255,0.8)" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            {!isElite && (
              <View style={styles.upgradeNotice}>
                <Crown size={16} color="#FFD700" />
                <Text style={styles.upgradeText}>
                  {isPro ? 'Elite tier unlocks 4 additional themes' : 'Pro tier unlocks 2 themes • Elite unlocks all 6'}
                </Text>
              </View>
            )}
            <View style={styles.footerButtons}>
              <TouchableOpacity style={[styles.resetButton]} onPress={() => {
                const defaultTheme = isElite ? 'elite_default' : isPro ? 'pro_default' : 'free_default';
                setThemeId(defaultTheme);
              }}>
                <Text style={styles.resetText}>Reset to Default</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeText}>Done</Text>
              </TouchableOpacity>
            </View>
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
    position: 'relative',
  },
  headerClose: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 6,
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
  tileLocked: {
    opacity: 0.6,
  },
  tileGradientLocked: {
    opacity: 0.7,
  },
  titleLocked: {
    opacity: 0.7,
  },
  lockIcon: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
    padding: 4,
  },
  ctaPreviewLocked: {
    opacity: 0.6,
  },
  ctaTextLocked: {
    opacity: 0.8,
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
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
  },
  upgradeNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
    padding: 8,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  upgradeText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
  },
  footerButtons: {
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
