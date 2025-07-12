import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { Slot } from 'expo-router';
import { SubscriptionProvider, useSubscription } from '@/app/services/subscriptionContext';
import SubscriptionModal from '@/app/components/SubscriptionModal';

function AppContent() {
  const { showSubscriptionModal, closeSubscriptionModal, subscribeToPro } = useSubscription();

  return (
    <>
      <Slot />
      <StatusBar style="auto" />
      
      <SubscriptionModal
        visible={showSubscriptionModal}
        onClose={closeSubscriptionModal}
        onSubscribe={subscribeToPro}
      />
    </>
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
