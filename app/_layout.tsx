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
// Removed deferred initialization to ensure ATT prompt appears immediately on launch
import Constants from 'expo-constants';
import { StripeProvider } from './services/stripeService';
// Remove the top-level import since it's not available on web


// Get device dimensions to adapt UI for iPad and web
const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth > 768; // Standard breakpoint for tablet devices
const isWeb = Platform.OS === 'web';
function AppContent() {
  const { showSubscriptionModal, closeSubscriptionModal } = useSubscription();
  const { initializeReview } = useReview();
  const router = useRouter();

  useEffect(() => {
    // Initialize review service immediately (lightweight)
    initializeReview();

    (async () => {
      // 1) ATT request must occur BEFORE any SDK that may access IDFA
      try {
        if (Platform.OS === 'ios') {
          const { getTrackingPermissionsAsync, requestTrackingPermissionsAsync } = await import('expo-tracking-transparency');
          const current = await getTrackingPermissionsAsync();
          if (current.status === 'undetermined') {
            const { status } = await requestTrackingPermissionsAsync();
            console.log(`📱 iOS ATT Status: ${status}`);
          } else {
            console.log(`📱 iOS ATT Existing Status: ${current.status}`);
          }
          // Initialize AppsFlyer AFTER ATT decision
          await appsFlyerService.initialize();
          console.log('✅ AppsFlyer initialized after ATT decision');
        } else {
          // Android - initialize AppsFlyer normally
          await appsFlyerService.initialize();
          console.log('✅ AppsFlyer initialized (Android)');
        }
      } catch (error) {
        console.error('❌ ATT/AppsFlyer initialization error:', error);
      }

      // 2) Push notification registration (independent)
      try {
        const token = await registerForPushNotificationsAsync();
        if (token) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.id) {
            await savePushTokenToProfile(token, user.id);
          }
        }
      } catch (err) {
        console.error('Push notification registration failed', err);
      }
    })();
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
          <StripeProvider>
            <UIThemeProvider>
              <View style={isWeb ? styles.webContainer : styles.container}>
                <AppContent />
              </View>
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
  webContainer: {
    flex: 1,
    maxWidth: 428, // iPhone 14 Pro Max width for mobile simulation
    alignSelf: 'center',
    width: '100%',
    backgroundColor: '#000000', // Match app background
    // Add subtle border for visual separation on web
    borderLeftWidth: Platform.OS === 'web' ? 1 : 0,
    borderRightWidth: Platform.OS === 'web' ? 1 : 0,
    borderColor: '#1F2937',
  },
});
