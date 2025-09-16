import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { View, Dimensions, StyleSheet } from 'react-native';
import { useFrameworkReady } from '../hooks/useFrameworkReady';
import { Slot } from 'expo-router';
import { SubscriptionProvider, useSubscription } from './services/subscriptionContext';
import { UISettingsProvider } from './services/uiSettingsContext';
import { useRouter } from 'expo-router';
import TieredSubscriptionModal from './components/TieredSubscriptionModal';
import ErrorBoundary from './components/ErrorBoundary';
import { useReview } from './hooks/useReview';
import { supabase } from './services/api/supabaseClient';
import { registerForPushNotificationsAsync, savePushTokenToProfile } from './services/notificationsService';
import appsFlyerService from './services/appsFlyerService';
import facebookAnalyticsService from './services/facebookAnalyticsService';
import ReviewDebugPanel from './components/ReviewDebugPanel';
import { runAfterInteractions, batchAsyncOperations } from './utils/performanceOptimizer';
// Remove the top-level import since it's not available on web


// Get device dimensions to adapt UI for iPad
const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth > 768; // Standard breakpoint for tablet devices

function AppContent() {
  const { showSubscriptionModal, closeSubscriptionModal } = useSubscription();
  const { initializeReview } = useReview();
  const router = useRouter();

  // Initialize services with performance optimizations
  useEffect(() => {
    // Initialize review service immediately (lightweight)
    initializeReview();
    
    // Run heavy operations after interactions complete (non-blocking)
    runAfterInteractions(async () => {
      const initializationOperations = [
        // iOS tracking permission
        async () => {
          if (Platform.OS === 'ios') {
            try {
              const { requestTrackingPermissionsAsync } = await import('expo-tracking-transparency');
              const { status } = await requestTrackingPermissionsAsync();
              console.log(`📱 iOS Tracking: ${status}`);
              return status;
            } catch (error) {
              console.error('❌ iOS tracking failed:', error);
              return null;
            }
          }
          return null;
        },

        // AppsFlyer initialization
        async () => {
          try {
            await appsFlyerService.initialize();
            console.log('✅ AppsFlyer initialized');
            return true;
          } catch (error) {
            console.error('❌ AppsFlyer failed:', error);
            return false;
          }
        },

        // Facebook Analytics initialization
        async () => {
          try {
            await facebookAnalyticsService.initialize();
            facebookAnalyticsService.trackAppInstall();
            console.log('✅ Facebook Analytics initialized');
            return true;
          } catch (error) {
            console.error('❌ Facebook Analytics failed:', error);
            return false;
          }
        },

        // Push notification registration
        async () => {
          try {
            const token = await registerForPushNotificationsAsync();
            if (token) {
              const { data: { user } } = await supabase.auth.getUser();
              if (user?.id) {
                await savePushTokenToProfile(token, user.id);
                return token;
              }
            }
            return null;
          } catch (err) {
            console.error('Push notification registration failed', err);
            return null;
          }
        }
      ];

      // Execute all operations concurrently instead of sequentially
      const results = await batchAsyncOperations(initializationOperations);
      console.log('🚀 App initialization completed:', {
        tracking: results[0]?.status === 'fulfilled',
        appsFlyer: results[1]?.status === 'fulfilled',
        facebook: results[2]?.status === 'fulfilled',
        pushNotifications: results[3]?.status === 'fulfilled'
      });
    });
  }, [initializeReview]);

  // Handle notification taps (navigate to the right tab)
  useEffect(() => {
    let subscription: any;
    (async () => {
      try {
        const Notifications = await import('expo-notifications');
        subscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
          const data = response?.notification?.request?.content?.data as any;
          const deeplink = data?.deeplink;
          if (deeplink === 'predictions') router.push('/(tabs)/predictions');
          else if (deeplink === 'insights') router.push('/(tabs)/index');
          else if (deeplink === 'news') router.push('/(tabs)/index');
          else router.push('/(tabs)/index');
        });
      } catch (e) {
        console.warn('Notification listener setup failed', e);
      }
    })();
    return () => {
      try { subscription?.remove && subscription.remove(); } catch {}
    };
  }, [router]);



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

      {__DEV__ && (
        // Dev-only overlay to QA the in-app review system
        <ReviewDebugPanel />
      )}
    </View>
  );
}

export default function RootLayout() {
  useFrameworkReady();
  

  return (
    <ErrorBoundary>
      <UISettingsProvider>
        <SubscriptionProvider>
          <AppContent />
        </SubscriptionProvider>
      </UISettingsProvider>
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
