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
        <SafeAreaView style={styles.safeArea}>
          {/* Custom Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              disabled={isLoading}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>User Preferences</Text>
            <View style={styles.headerSpacer} />
          </View>

          {/* Loading Overlay */}
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <View style={styles.loadingContainer}>
                <Ionicons name="refresh" size={32} color="#00d4ff" />
                <Text style={styles.loadingText}>Saving preferences...</Text>
              </View>
            </View>
          )}

          {/* Onboarding Flow */}
          <View style={styles.flowContainer}>
            <OnboardingFlow
              onComplete={handlePreferencesComplete}
              isExistingUser={true}
            />
          </View>
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerSpacer: {
    width: 40,
  },
  flowContainer: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  loadingContainer: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
});

export default UserPreferencesModal;
