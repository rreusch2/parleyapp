import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import OnboardingFlow, { UserPreferences } from './onboarding/OnboardingFlow';
import { supabase } from '../services/api/supabaseClient';

interface UserPreferencesModalProps {
  visible: boolean;
  onClose: () => void;
  currentPreferences?: any;
  onPreferencesUpdated?: (preferences: UserPreferences) => void;
}

const UserPreferencesModal: React.FC<UserPreferencesModalProps> = ({
  visible,
  onClose,
  currentPreferences,
  onPreferencesUpdated,
}) => {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    if (visible) {
      getUser();
    }
  }, [visible]);

  const handlePreferencesComplete = async (preferences: UserPreferences) => {
    if (!user?.id) {
      Alert.alert('Error', 'User not found. Please try again.');
      return;
    }

    setIsLoading(true);

    try {
      console.log('🔄 Updating user preferences for user:', user.id);
      console.log('📦 Preferences data:', preferences);
      
      // Transform preferences to match database format
      const updateData = {
        sport_preferences: preferences.sportPreferences,
        betting_style: preferences.bettingStyle,
        pick_distribution: preferences.pickDistribution,
        // Update other preference fields as needed
        preferred_sports: Object.keys(preferences.sportPreferences).filter(
          sport => preferences.sportPreferences[sport as keyof typeof preferences.sportPreferences]
        ),
        updated_at: new Date().toISOString(),
      };

      console.log('🔄 Database update data:', updateData);

      // Update preferences directly via Supabase (bypassing broken API)
      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) {
        console.error('❌ Supabase update error:', error);
        throw new Error(`Database update failed: ${error.message}`);
      }

      console.log('✅ Preferences successfully updated in database!');
      
      // Verify the update worked
      const { data: verifyData, error: verifyError } = await supabase
        .from('profiles')
        .select('sport_preferences, betting_style, pick_distribution')
        .eq('id', user.id)
        .single();
        
      if (!verifyError && verifyData) {
        console.log('✅ Verification - Database now contains:', verifyData);
      }

      // Notify parent component
      onPreferencesUpdated?.(preferences);

      // Show success message
      Alert.alert(
        'Preferences Updated',
        'Your preferences have been saved successfully!',
        [{ text: 'OK', onPress: onClose }]
      );

    } catch (error) {
      console.error('❌ Failed to update preferences:', error);
      Alert.alert(
        'Update Failed',
        `Failed to save your preferences: ${error instanceof Error ? error.message : 'Unknown error'}`,
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <LinearGradient
        colors={['#1a1a2e', '#16213e', '#0f3460']}
        style={styles.container}
      >
        {/* Compact Header with Close Button */}
        <SafeAreaView style={styles.headerSafeArea}>
          <View style={styles.compactHeader}>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              disabled={isLoading}
            >
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Update Preferences</Text>
            <View style={styles.headerSpacer} />
          </View>
        </SafeAreaView>

        {/* Loading Overlay */}
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingContainer}>
              <Ionicons name="refresh" size={32} color="#00d4ff" />
              <Text style={styles.loadingText}>Saving preferences...</Text>
            </View>
          </View>
        )}

        {/* Full Screen Onboarding Flow - No extra SafeAreaView */}
        <View style={styles.flowContainer}>
          <OnboardingFlow
            onComplete={handlePreferencesComplete}
            isExistingUser={true}
            isModal={true}
          />
        </View>
      </LinearGradient>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerSafeArea: {
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 44,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    opacity: 0.95,
  },
  headerSpacer: {
    width: 32,
  },
  flowContainer: {
    flex: 1,
    // Remove any extra padding - let OnboardingFlow handle its own layout
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  loadingContainer: {
    backgroundColor: 'rgba(26,26,46,0.95)',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  loadingText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '500',
    opacity: 0.9,
  },
});

export default UserPreferencesModal;
