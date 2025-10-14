import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Settings, Crown, Sparkles, Plus, Minus } from 'lucide-react-native';
import { supabase } from '../services/api/supabaseClient';

interface ElitePickDistributionProps {
  visible: boolean;
  onClose: () => void;
  userPreferences: any;
  onSave: (distribution: any) => void;
}

export const ElitePickDistribution: React.FC<ElitePickDistributionProps> = ({
  visible,
  onClose,
  userPreferences,
  onSave,
}) => {
  const [distribution, setDistribution] = useState({
    mlb_team: 10,
    mlb_prop: 10,
    wnba_team: 5,
    wnba_prop: 3,
    ufc_team: 2,
    ufc_prop: 0,
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Initialize distribution from user preferences
    if (userPreferences?.pickDistribution && !userPreferences.pickDistribution.auto) {
      setDistribution(userPreferences.pickDistribution);
    }
  }, [userPreferences]);

  const getTotalPicks = () => {
    return Object.values(distribution).reduce((sum: number, value: any) => sum + (value || 0), 0);
  };

  const adjustPick = (sport: string, type: string, delta: number) => {
    const key = `${sport}_${type}`;
    const newValue = Math.max(0, (distribution[key] || 0) + delta);
    const newDistribution = { ...distribution, [key]: newValue };
    
    // Ensure total doesn't exceed 30
    const total = Object.values(newDistribution).reduce((sum: number, value: any) => sum + (value || 0), 0);
    if (total <= 30) {
      setDistribution(newDistribution);
    }
  };

  const handleSave = async () => {
    const total = getTotalPicks();
    if (total !== 30) {
      Alert.alert('Invalid Distribution', `Please select exactly 30 picks. Current total: ${total}`);
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from('profiles')
          .update({
            pick_distribution: { ...distribution, auto: false }
          })
          .eq('id', user.id);

        if (error) throw error;

        onSave({ ...distribution, auto: false });
        onClose();
        Alert.alert('Success', 'Your Elite pick distribution has been saved!');
      }
    } catch (error) {
      console.error('Error saving distribution:', error);
      Alert.alert('Error', 'Failed to save distribution');
    } finally {
      setSaving(false);
    }
  };

  const resetToAuto = () => {
    setDistribution({
      mlb_team: 10,
      mlb_prop: 10,
      wnba_team: 5,
      wnba_prop: 3,
      ufc_team: 2,
      ufc_prop: 0,
    });
  };

  if (!visible) return null;

  const totalPicks = getTotalPicks();
  const isValidTotal = totalPicks === 30;

  return (
    <View style={styles.overlay}>
      <LinearGradient
        colors={['#FFD700', '#FFA500', '#FF8C00']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Crown size={24} color="#FFFFFF" />
            <Text style={styles.title}>Elite Pick Distribution</Text>
            <Sparkles size={20} color="#FFFFFF" />
          </View>
          <Text style={styles.subtitle}>Customize your 30 daily picks</Text>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Total Counter */}
          <View style={[styles.totalCard, { backgroundColor: isValidTotal ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)' }]}>
            <Text style={styles.totalText}>
              Total Picks: {totalPicks}/30
            </Text>
            {!isValidTotal && (
              <Text style={styles.warningText}>
                {totalPicks < 30 ? `Add ${30 - totalPicks} more picks` : `Remove ${totalPicks - 30} picks`}
              </Text>
            )}
          </View>

          {/* MLB Section */}
          <View style={styles.sportSection}>
            <Text style={styles.sportTitle}>⚾ MLB</Text>
            <View style={styles.pickRow}>
              <Text style={styles.pickLabel}>Team Picks</Text>
              <View style={styles.counter}>
                <TouchableOpacity
                  style={styles.counterButton}
                  onPress={() => adjustPick('mlb', 'team', -1)}
                >
                  <Minus size={16} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.counterValue}>{distribution.mlb_team}</Text>
                <TouchableOpacity
                  style={styles.counterButton}
                  onPress={() => adjustPick('mlb', 'team', 1)}
                >
                  <Plus size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.pickRow}>
              <Text style={styles.pickLabel}>Prop Picks</Text>
              <View style={styles.counter}>
                <TouchableOpacity
                  style={styles.counterButton}
                  onPress={() => adjustPick('mlb', 'prop', -1)}
                >
                  <Minus size={16} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.counterValue}>{distribution.mlb_prop}</Text>
                <TouchableOpacity
                  style={styles.counterButton}
                  onPress={() => adjustPick('mlb', 'prop', 1)}
                >
                  <Plus size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* WNBA Section */}
          <View style={styles.sportSection}>
            <Text style={styles.sportTitle}>🏀 WNBA</Text>
            <View style={styles.pickRow}>
              <Text style={styles.pickLabel}>Team Picks</Text>
              <View style={styles.counter}>
                <TouchableOpacity
                  style={styles.counterButton}
                  onPress={() => adjustPick('wnba', 'team', -1)}
                >
                  <Minus size={16} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.counterValue}>{distribution.wnba_team}</Text>
                <TouchableOpacity
                  style={styles.counterButton}
                  onPress={() => adjustPick('wnba', 'team', 1)}
                >
                  <Plus size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.pickRow}>
              <Text style={styles.pickLabel}>Prop Picks</Text>
              <View style={styles.counter}>
                <TouchableOpacity
                  style={styles.counterButton}
                  onPress={() => adjustPick('wnba', 'prop', -1)}
                >
                  <Minus size={16} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.counterValue}>{distribution.wnba_prop}</Text>
                <TouchableOpacity
                  style={styles.counterButton}
                  onPress={() => adjustPick('wnba', 'prop', 1)}
                >
                  <Plus size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* UFC Section */}
          <View style={styles.sportSection}>
            <Text style={styles.sportTitle}>🥊 UFC</Text>
            <View style={styles.pickRow}>
              <Text style={styles.pickLabel}>Fight Picks</Text>
              <View style={styles.counter}>
                <TouchableOpacity
                  style={styles.counterButton}
                  onPress={() => adjustPick('ufc', 'team', -1)}
                >
                  <Minus size={16} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.counterValue}>{distribution.ufc_team}</Text>
                <TouchableOpacity
                  style={styles.counterButton}
                  onPress={() => adjustPick('ufc', 'team', 1)}
                >
                  <Plus size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.pickRow}>
              <Text style={styles.pickLabel}>Prop Picks</Text>
              <View style={styles.counter}>
                <TouchableOpacity
                  style={styles.counterButton}
                  onPress={() => adjustPick('ufc', 'prop', -1)}
                >
                  <Minus size={16} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.counterValue}>{distribution.ufc_prop}</Text>
                <TouchableOpacity
                  style={styles.counterButton}
                  onPress={() => adjustPick('ufc', 'prop', 1)}
                >
                  <Plus size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.resetButton}
            onPress={resetToAuto}
          >
            <Text style={styles.resetButtonText}>Reset to Default</Text>
          </TouchableOpacity>

          <View style={styles.primaryActions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveButton, !isValidTotal && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={!isValidTotal || saving}
            >
              <Text style={styles.saveButtonText}>
                {saving ? 'Saving...' : 'Save Distribution'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    zIndex: 1000,
  },
  container: {
    flex: 1,
    margin: 20,
    marginTop: 60,
    borderRadius: 20,
    overflow: 'hidden',
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  totalCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  totalText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  warningText: {
    fontSize: 14,
    color: '#FFFFFF',
    marginTop: 4,
  },
  sportSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sportTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  pickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pickLabel: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  counterButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    minWidth: 24,
    textAlign: 'center',
  },
  actions: {
    padding: 20,
    gap: 12,
  },
  resetButton: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  primaryActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 2,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  saveButtonText: {
    color: '#FF8C00',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
