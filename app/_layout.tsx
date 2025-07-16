import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar, Platform } from 'expo-status-bar';
import { View, Dimensions, StyleSheet } from 'react-native';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { Slot } from 'expo-router';
import { SubscriptionProvider, useSubscription } from '@/app/services/subscriptionContext';
import SubscriptionModal from '@/app/components/SubscriptionModal';

// Get device dimensions to adapt UI for iPad
const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth > 768; // Standard breakpoint for tablet devices

function AppContent() {
  const { showSubscriptionModal, closeSubscriptionModal, subscribeToPro } = useSubscription();

  return (
    <View style={styles.container}>
      <Slot />
      <StatusBar style="auto" />
      
      <SubscriptionModal
        visible={showSubscriptionModal}
        onClose={closeSubscriptionModal}
        onSubscribe={subscribeToPro}
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
