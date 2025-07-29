import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { View, Dimensions, StyleSheet } from 'react-native';
import { useFrameworkReady } from '../hooks/useFrameworkReady';
import { Slot } from 'expo-router';
import { SubscriptionProvider, useSubscription } from './services/subscriptionContext';
import TieredSubscriptionModal from './components/TieredSubscriptionModal';
import { useReview } from './hooks/useReview';

// Get device dimensions to adapt UI for iPad
const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth > 768; // Standard breakpoint for tablet devices

function AppContent() {
  const { showSubscriptionModal, closeSubscriptionModal, subscribeToPro } = useSubscription();
  const { initializeReview } = useReview();

  // Initialize review service on app startup
  useEffect(() => {
    initializeReview();
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
