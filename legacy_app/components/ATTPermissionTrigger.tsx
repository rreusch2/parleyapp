import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert } from 'react-native';
import { attService } from '../services/attService';

/**
 * A component that can manually trigger ATT permission request
 * This is a fallback in case the automatic request doesn't work on iPad
 */
export default function ATTPermissionTrigger() {
  const [attStatus, setAttStatus] = useState<string | null>(null);
  const [isIPad, setIsIPad] = useState(false);
  
  useEffect(() => {
    checkCurrentStatus();
  }, []);
  
  const checkCurrentStatus = async () => {
    const status = await attService.getCurrentStatus();
    setAttStatus(status);
    setIsIPad(attService.isIPad());
  };
  
  const handleManualRequest = async () => {
    Alert.alert(
      'Tracking Permission',
      'This app uses tracking to deliver personalized ads and improve your experience.',
      [
        {
          text: 'Continue',
          onPress: async () => {
            const status = await attService.forceRequestPermission();
            setAttStatus(status);
            if (status) {
              Alert.alert('Permission Updated', `Tracking permission is now: ${status}`);
            }
          }
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };
  
  // Only show on iOS when permission is undetermined or denied
  if (Platform.OS !== 'ios') return null;
  // Avoid rendering until status is known to prevent initial flash
  if (attStatus === null) return null;
  if (attStatus === 'granted' || attStatus === 'restricted') return null;
  
  return (
    <View style={styles.container}>
      <Text style={styles.status}>
        Tracking Status: {attStatus || 'Unknown'}
      </Text>
      {(attStatus === 'undetermined' || attStatus === 'denied') && (
        <TouchableOpacity style={styles.button} onPress={handleManualRequest}>
          <Text style={styles.buttonText}>
            Enable Personalized Ads
          </Text>
        </TouchableOpacity>
      )}
      <Text style={styles.info}>
        This helps us show you more relevant ads and measure campaign performance.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a2e',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  status: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  info: {
    color: '#6b7280',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
