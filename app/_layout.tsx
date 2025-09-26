import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { View, Dimensions, StyleSheet } from 'react-native';
import { useFrameworkReady } from '../hooks/useFrameworkReady';
import { Slot } from 'expo-router';
import { SubscriptionProvider, useSubscription } from './services/subscriptionContext';
import { UIThemeProvider } from './services/uiThemeContext';
import { UISettingsProvider } from './services/uiSettingsContext';
import { useRouter } from 'expo-router';
import TieredSubscriptionModal from './components/TieredSubscriptionModal';
import ErrorBoundary from './components/ErrorBoundary';
import { useReview } from './hooks/useReview';
import { supabase } from './services/api/supabaseClient';
import { registerForPushNotificationsAsync, savePushTokenToProfile } from './services/notificationsService';
import appsFlyerService from './services/appsFlyerService';
// ReviewDebugPanel removed (dev-only overlay disabled)
import { runAfterInteractions, batchAsyncOperations } from './utils/performanceOptimizer';
import Constants from 'expo-constants';
import { StripeProvider } from './services/stripeService';
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
        // iOS tracking permission + AppsFlyer initialization (sequential for proper ATE)
        async () => {
          if (Platform.OS === 'ios') {
            try {
              // 1. Request ATT permission first
              const { requestTrackingPermissionsAsync } = await import('expo-tracking-transparency');
              const { status } = await requestTrackingPermissionsAsync();
              console.log(`📱 iOS ATT Status: ${status}`);
              
              // 2. Initialize AppsFlyer AFTER ATT decision (critical for ATE parameter)
              await appsFlyerService.initialize();
              console.log('✅ AppsFlyer initialized after ATT consent');
              
              return { attStatus: status, appsFlyerReady: true };
            } catch (error) {
              console.error('❌ ATT + AppsFlyer initialization failed:', error);
              return null;
            }
          } else {
            // Android - just initialize AppsFlyer
            try {
              await appsFlyerService.initialize();
              console.log('✅ AppsFlyer initialized (Android)');
              return { appsFlyerReady: true };
            } catch (error) {
              console.error('❌ AppsFlyer failed (Android):', error);
              return null;
            }
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
      {/* ReviewDebugPanel removed for now */}
    </View>
  );
}

export default function RootLayout() {
  useFrameworkReady();
  const stripePublishableKey = Constants.expoConfig?.extra?.stripePublishableKey;
  const appleMerchantId = Constants.expoConfig?.extra?.appleMerchantId;

  if (!stripePublishableKey) {
    console.warn('Stripe publishable key is missing from app.config.js extra.stripePublishableKey');
  }
  if (!appleMerchantId) {
    console.warn('Apple merchant ID is missing from app.config.js extra.appleMerchantId');
  }

  return (
    <ErrorBoundary>
      <UISettingsProvider>
        <SubscriptionProvider>
          <StripeProvider
            publishableKey={stripePublishableKey || ''}
            merchantIdentifier={appleMerchantId || 'merchant.com.parleyapp.payments'}
            urlScheme="predictiveplay"
          >
            <UIThemeProvider>
              <AppContent />
            </UIThemeProvider>
          </StripeProvider>
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
