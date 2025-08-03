import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, Linking } from 'react-native';
import { View, Dimensions, StyleSheet } from 'react-native';
import { useFrameworkReady } from '../hooks/useFrameworkReady';
import { Slot } from 'expo-router';
import { SubscriptionProvider, useSubscription } from './services/subscriptionContext';
import TieredSubscriptionModal from './components/TieredSubscriptionModal';
import { useReview } from './hooks/useReview';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';

// Get device dimensions to adapt UI for iPad
const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth > 768; // Standard breakpoint for tablet devices

function AppContent() {
  const { showSubscriptionModal, closeSubscriptionModal, subscribeToPro, openSubscriptionModal } = useSubscription();
  const { initializeReview } = useReview();

  // Initialize review service on app startup
  useEffect(() => {
    initializeReview();
  }, [initializeReview]);

  useEffect(() => {
    (async () => {
      if (Platform.OS === 'ios') {
        const { status } = await requestTrackingPermissionsAsync();
        if (status !== 'granted') {
          // Handle the case where the user denies permission
        }
      }
    })();
  }, []);

  // Handle deep links for App Store events
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const url = event.url;
      console.log('🔗 Deep link received:', url);
      
      // Handle free trial deep link from App Store event
      if (url.includes('free-trial') || url.includes('trial=true')) {
        console.log('🎯 Opening subscription modal from deep link');
        // Small delay to ensure app is fully loaded
        setTimeout(() => {
          openSubscriptionModal();
        }, 1000);
      }
    };

    // Listen for incoming deep links
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Check if app was opened with a deep link
    const getInitialURL = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        console.log('🔗 App opened with deep link:', initialUrl);
        handleDeepLink({ url: initialUrl });
      }
    };
    
    getInitialURL();

    // Clean up listener
    return () => subscription?.remove();
  }, [openSubscriptionModal]);

  return (
    <View style={styles.container}>
      <Slot />
      <StatusBar style="auto" />
      
      <TieredSubscriptionModal
        visible={showSubscriptionModal}
        onClose={closeSubscriptionModal}
        onSubscribe={async (plan, tier) => {
          await subscribeToPro(plan);
        }}
      />
    </View>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  return (
    <SubscriptionProvider>
      <AppContent />
    </SubscriptionProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Add iPad specific container styles if needed
    maxWidth: isTablet ? 1200 : undefined,
    alignSelf: 'center',
    width: '100%',
  },
});
