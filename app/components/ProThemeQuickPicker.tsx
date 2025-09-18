import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform, TouchableWithoutFeedback, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Lock, Crown } from 'lucide-react-native';
import { getThemeTokens, ThemeId, useUITheme, AVAILABLE_ELITE_THEMES } from '../services/uiThemeContext';

interface ProThemeQuickPickerProps {
  visible: boolean;
  onClose: () => void;
  onUpgrade?: () => void;
}

export default function ProThemeQuickPicker({ visible, onClose, onUpgrade }: ProThemeQuickPickerProps) {
  const { themeId, setThemeId, theme } = useUITheme();

  const handleSelect = (id: ThemeId) => {
    // Guarding is already handled in setThemeId for Pro, but we limit UI to safe options
    setThemeId(id);
    onClose();
  };

  const proOptions: { id: ThemeId; name: string }[] = [
    { id: 'pro_default', name: 'Pro Default' },
    { id: 'midnight_aqua', name: 'Midnight Aqua' },
  ];

  const lockedElite = AVAILABLE_ELITE_THEMES.filter((t) => t.id !== 'midnight_aqua');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      {/* Dropdown sheet anchored near the top-right (under the header Theme button) */}
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <View style={[styles.dropdownContainer, { borderColor: `${theme.accentPrimary}33`, shadowColor: theme.accentPrimary }]}> 
          <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ paddingVertical: 6 }}>
            {/* Pro-allowed options */}
            {proOptions.map((opt) => {
              const tokens = getThemeTokens(opt.id);
              const selected = themeId === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.itemRow, selected && { backgroundColor: `${theme.accentPrimary}14`, borderColor: `${theme.accentPrimary}55` }]}
                  activeOpacity={0.9}
                  onPress={() => handleSelect(opt.id)}
                >
                  {/* Mini color preview - gradient bar */}
                  <LinearGradient
                    colors={tokens.headerGradient as any}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.miniPreview, { borderColor: `${theme.accentPrimary}33` }]}
                  />

                  {/* Theme name */}
                  <Text style={[styles.itemText, { color: tokens.headerTextPrimary }]}>
                    {opt.name}
                  </Text>

                  {/* Selected checkmark */}
                  {selected && (
                    <View style={styles.checkContainer}>
                      <Check size={16} color={theme.accentPrimary} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}

            {/* Divider */}
            <View style={[styles.divider, { borderBottomColor: `${theme.accentPrimary}22` }]} />

            {/* Locked Elite themes */}
            <View style={styles.lockedHeaderRow}>
              <Crown size={14} color={theme.accentPrimary} />
              <Text style={[styles.lockedHeaderText, { color: theme.accentPrimary }]}>Go Elite to unlock more themes</Text>
            </View>
            {lockedElite.map((opt) => {
              const tokens = getThemeTokens(opt.id);
              return (
                <View key={opt.id} style={[styles.itemRow, { opacity: 0.6 }]}
                >
                  <LinearGradient
                    colors={tokens.headerGradient as any}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.miniPreview, { borderColor: `${theme.accentPrimary}22` }]}
                  />
                  <Text style={[styles.itemText, { color: tokens.headerTextPrimary }]}>
                    {opt.name}
                  </Text>
                  <Lock size={14} color={theme.accentPrimary} />
                </View>
              );
            })}

            {!!onUpgrade && (
              <TouchableOpacity style={styles.upgradeRow} onPress={onUpgrade}>
                <LinearGradient colors={['#00E5FF', '#0891B2']} style={styles.upgradeButton}>
                  <Crown size={16} color="#0F172A" />
                  <Text style={styles.upgradeText}>Upgrade to Elite</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)'
  },
  dropdownContainer: {
    position: 'absolute',
    top: Platform.select({ ios: 110, android: 110, default: 100 }) as number,
    right: 12,
    width: 260,
    backgroundColor: '#0B1220',
    borderRadius: 12,
    borderWidth: 1,
    ...Platform.select({
      ios: { shadowOpacity: 0.25, shadowOffset: { width: 0, height: 8 }, shadowRadius: 20 },
      android: { elevation: 8 },
      default: {}
    })
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
    marginHorizontal: 6,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)'
  },
  miniPreview: {
    width: 40,
    height: 18,
    borderRadius: 6,
    marginRight: 10,
    borderWidth: 1
  },
  itemText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700'
  },
  checkContainer: {
    marginLeft: 8
  },
  divider: {
    marginTop: 4,
    marginBottom: 8,
    marginHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  lockedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8
  },
  lockedHeaderText: {
    fontSize: 12,
    fontWeight: '800'
  },
  upgradeRow: {
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 999
  },
  upgradeText: {
    color: '#0F172A',
    fontWeight: '800',
    marginLeft: 8
  }
});
