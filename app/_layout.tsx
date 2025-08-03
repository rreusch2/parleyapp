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


// Get device dimensions to adapt UI for iPad
const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth > 768; // Standard breakpoint for tablet devices

function AppContent() {
  const { showSubscriptionModal, closeSubscriptionModal, subscribeToPro } = useSubscription();
  const { initializeReview } = useReview();

  // Initialize review service on app startup
  useEffect(() => {
    initializeReview();
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
          await subscribeToPro(plan);
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
