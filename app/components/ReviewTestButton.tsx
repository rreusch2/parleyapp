import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
  View,
} from 'react-native';
import { Star, TestTube } from 'lucide-react-native';
import { useReview } from '../hooks/useReview';

/**
 * Simple button for testing review system - shows in settings for easy access
 */
export default function ReviewTestButton() {
  const { forceShowReview, trackPositiveInteraction } = useReview();
  const [testing, setTesting] = useState(false);

  const handleTestReview = async () => {
    try {
      setTesting(true);
      
      Alert.alert(
        '🧪 Test Review System',
        'Choose a test method:',
        [
          {
            text: 'Force Native Dialog',
            onPress: async () => {
              console.log('🧪 [ReviewTest] Force showing native review dialog...');
              await forceShowReview();
              Alert.alert(
                '✅ Test Complete',
                'If you\'re on a real iOS device, the native review dialog should have appeared.\n\nCheck console logs for detailed results.'
              );
              setTesting(false);
            }
          },
          {
            text: 'Test Subscription Event',
            onPress: async () => {
              console.log('🧪 [ReviewTest] Testing subscription event trigger...');
              await trackPositiveInteraction({ eventType: 'successful_subscription' });
              Alert.alert(
                '✅ Event Tracked',
                'Subscription event tracked! Check console logs to see if review prompt conditions were met.'
              );
              setTesting(false);
            }
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setTesting(false)
          }
        ]
      );
    } catch (error) {
      console.error('❌ [ReviewTest] Error:', error);
      Alert.alert('❌ Error', `Test failed: ${error}`);
      setTesting(false);
    }
  };

  // Only show in development mode
  if (!__DEV__) {
    return null;
  }

  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={handleTestReview}
      disabled={testing}
    >
      <View style={styles.iconContainer}>
        <TestTube size={20} color="#00E5FF" />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.title}>
          {testing ? 'Testing...' : 'Test Review System'}
        </Text>
        <Text style={styles.subtitle}>
          Test native App Store review prompts
        </Text>
      </View>
      <Star size={16} color="#94A3B8" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: '#94A3B8',
  },
});
