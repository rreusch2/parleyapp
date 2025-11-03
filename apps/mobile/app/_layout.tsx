import { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, AppState, Alert } from 'react-native';
import { View, Dimensions, StyleSheet } from 'react-native';
import { useFrameworkReady } from './hooks/useFrameworkReady';
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
import { attService } from './services/attService';
// ReviewDebugPanel removed (dev-only overlay disabled)
// Removed deferred initialization to ensure ATT prompt appears immediately on launch
import Constants from 'expo-constants';
import { StripeProvider } from './services/stripeService';
// Remove the top-level import since it's not available on web
import * as Linking from 'expo-linking';
import Purchases from 'react-native-purchases';
import revenueCatService from './services/revenueCatService';


// Get device dimensions to adapt UI for iPad and web
const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth > 768; // Standard breakpoint for tablet devices
const isWeb = Platform.OS === 'web';
function AppContent() {
  const { showSubscriptionModal, closeSubscriptionModal, checkSubscriptionStatus } = useSubscription();
  const { initializeReview } = useReview();
  const router = useRouter();
  const appState = useRef(AppState.currentState);
  const hasRequestedATT = useRef(false);

  // Handle ATT permission when app becomes active (critical for iPad)
  useEffect(() => {
    const handleATTPermission = async () => {
      if (Platform.OS !== 'ios') return;
      if (hasRequestedATT.current) return;
      
      // Only request when app is active
      if (AppState.currentState === 'active') {
        console.log('📱 App is active, checking ATT...');
        
        // Use the dedicated ATT service for more robust handling
        const status = await attService.checkAndRequestPermission();
        if (status) {
          hasRequestedATT.current = true;
          console.log(`📱 ATT handled with status: ${status}`);
          
          // Initialize AppsFlyer after ATT
          await appsFlyerService.initialize();
          console.log('✅ AppsFlyer initialized after ATT');
        }
      }
    };

    // Handle app state changes (critical for iPad)
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('📱 App has come to foreground');
        handleATTPermission();
      }
      appState.current = nextAppState;
    });

    // Initial ATT check
    handleATTPermission();

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    // Initialize review service immediately (lightweight)
    initializeReview();

    (async () => {
      // Push notification registration (independent of ATT)
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
      
      // Initialize AppsFlyer for Android (iOS handled in ATT flow)
      if (Platform.OS === 'android') {
        await appsFlyerService.initialize();
        console.log('✅ AppsFlyer initialized (Android)');
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


  useEffect(() => {
    const handleUrl = async (url: string) => {
      try {
        const webPurchaseRedemption = await Purchases.parseAsWebPurchaseRedemption(url);
        if (webPurchaseRedemption) {
          try {
            const configured = await Purchases.isConfigured();
            if (!configured) {
              await revenueCatService.initialize();
            }
          } catch {}
          const result: any = await Purchases.redeemWebPurchase(webPurchaseRedemption);
          switch (result.result) {
            case 'SUCCESS':
              await checkSubscriptionStatus();
              Alert.alert('Purchase Redeemed', 'Your web purchase has been linked to your account.');
              break;
            case 'ERROR':
              Alert.alert('Redemption Error', result?.error?.message || 'Redemption failed.');
              break;
            case 'PURCHASE_BELONGS_TO_OTHER_USER':
              Alert.alert('Redemption Error', 'This purchase belongs to another user.');
              break;
            case 'INVALID_TOKEN':
              Alert.alert('Invalid Link', 'The redemption link is invalid.');
              break;
            case 'EXPIRED':
              Alert.alert('Link Expired', `A new link has been sent to ${result?.obfuscatedEmail || 'your email'}.`);
              break;
            default:
              Alert.alert('Redemption', 'Processed redemption link.');
          }
        }
      } catch (e) {
        console.warn('RevenueCat redemption handling error', e);
      }
    };

    (async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          await handleUrl(initialUrl);
        }
      } catch {}
    })();

    const linkSub = Linking.addEventListener('url', (event: { url: string }) => {
      handleUrl(event.url);
    });

    return () => {
      try { (linkSub as any)?.remove && (linkSub as any).remove(); } catch {}
    };
  }, [checkSubscriptionStatus]);



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
