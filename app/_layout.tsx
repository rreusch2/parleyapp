import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { View, Dimensions, StyleSheet } from 'react-native';
import { useFrameworkReady } from '../hooks/useFrameworkReady';
import { Slot } from 'expo-router';
import { SubscriptionProvider, useSubscription } from './services/subscriptionContext';
import TieredSubscriptionModal from './components/TieredSubscriptionModal';
import ErrorBoundary from './components/ErrorBoundary';
import { useReview } from './hooks/useReview';
import { supabase } from './services/api/supabaseClient';
import { registerForPushNotificationsAsync, savePushTokenToProfile } from './services/notificationsService';
import appsFlyerService from './services/appsFlyerService';
import facebookAnalyticsService from './services/facebookAnalyticsService';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';


// Get device dimensions to adapt UI for iPad
const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth > 768; // Standard breakpoint for tablet devices

function AppContent() {
  const { showSubscriptionModal, closeSubscriptionModal } = useSubscription();
  const { initializeReview } = useReview();

  // Initialize review service, AppsFlyer, and Facebook Analytics on app startup
  useEffect(() => {
    initializeReview();
    
    // REQUEST iOS 14.5+ TRACKING PERMISSION - CRITICAL FOR META ADS
    (async () => {
      if (Platform.OS === 'ios') {
        try {
          console.log('🔐 Requesting iOS App Tracking Transparency permission...');
          const { status } = await requestTrackingPermissionsAsync();
          console.log(`📱 iOS Tracking Permission: ${status}`);
          
          if (status === 'granted') {
            console.log('✅ IDFA tracking granted - Meta campaigns can track conversions');
          } else {
            console.log('⚠️ IDFA tracking denied - Meta campaigns will have limited attribution');
          }
        } catch (error) {
          console.error('❌ iOS tracking permission request failed:', error);
        }
      }
    })();
    
    // Initialize AppsFlyer for TikTok ads tracking
    (async () => {
      try {
        console.log('🚀 Initializing AppsFlyer for TikTok ads tracking...');
        await appsFlyerService.initialize();
        console.log('✅ AppsFlyer initialized successfully');
      } catch (error) {
        console.error('❌ AppsFlyer initialization failed:', error);
      }
    })();
    
    // Initialize Facebook Analytics for Meta ads tracking - AFTER iOS permission
    (async () => {
      try {
        console.log('🚀 Initializing Facebook Analytics for Meta ads tracking...');
        await facebookAnalyticsService.initialize();
        
        // CRITICAL: Track app install immediately after FB SDK init
        facebookAnalyticsService.trackAppInstall();
        console.log('✅ Facebook Analytics initialized + App Install tracked');
      } catch (error) {
        console.error('❌ Facebook Analytics initialization failed:', error);
      }
    })();
    
    // Register push notifications
    (async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        if (token) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.id) {
            await savePushTokenToProfile(token, user.id);
          }
        }
      } catch (err) {
        console.error('Error during push notification registration', err);
      }
    })();
  }, [initializeReview]);



  return (
    <View style={styles.container}>
      <Slot />
      <StatusBar style="auto" />
      
      <TieredSubscriptionModal
        visible={showSubscriptionModal}
        onClose={closeSubscriptionModal}
        onSubscribe={async (plan, tier) => {
          // Track subscription with AppsFlyer
          await appsFlyerService.trackSubscription(plan, tier === 'pro' ? 19.99 : 29.99);
          closeSubscriptionModal();
        }}
      />
    </View>
  );
}

export default function RootLayout() {
  useFrameworkReady();
  

  return (
    <ErrorBoundary>
      <SubscriptionProvider>
        <AppContent />
      </SubscriptionProvider>
    </ErrorBoundary>
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
