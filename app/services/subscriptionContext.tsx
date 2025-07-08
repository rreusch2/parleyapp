import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { applePaymentService } from './paymentService';
import { DEV_CONFIG } from '../config/development';
import { supabase } from './api/supabaseClient';
import { Alert } from 'react-native';

interface SubscriptionContextType {
  isPro: boolean;
  isLoading: boolean;
  showSubscriptionModal: boolean;
  checkSubscriptionStatus: () => Promise<void>;
  subscribeToPro: (planId: 'monthly' | 'yearly' | 'lifetime') => Promise<boolean>;
  openSubscriptionModal: () => void;
  closeSubscriptionModal: () => void;
  restorePurchases: () => Promise<void>;
  proFeatures: {
    maxPicks: number;
    hasAIChat: boolean;
    hasAdvancedAnalytics: boolean;
    hasLiveAlerts: boolean;
    hasUnlimitedInsights: boolean;
    hasPrioritySupport: boolean;
  };
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

export const SubscriptionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isPro, setIsPro] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  useEffect(() => {
    checkSubscriptionStatus();
    
    // Listen for auth state changes to update subscription status
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        checkSubscriptionStatus();
      } else if (event === 'SIGNED_OUT') {
        setIsPro(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkSubscriptionStatus = async () => {
    try {
      setIsLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Check local storage first
        const storedStatus = await AsyncStorage.getItem('subscriptionStatus');
        if (storedStatus) {
          setIsPro(storedStatus === 'pro');
        }
        
        // Check database for subscription_tier
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('subscription_tier')
          .eq('id', user.id)
          .single();
        
        // If the database says the user is pro, respect that
        if (!profileError && profile && profile.subscription_tier === 'pro') {
          setIsPro(true);
          await AsyncStorage.setItem('subscriptionStatus', 'pro');
          setIsLoading(false);
          return;
        }
        
        // Then verify with payment service as a fallback
        const subscriptionStatus = await applePaymentService.validateSubscription(user.id);
        const isSubscribed = subscriptionStatus.isActive && subscriptionStatus.tier !== 'free';
        setIsPro(isSubscribed);
        
        // Update local storage
        await AsyncStorage.setItem('subscriptionStatus', isSubscribed ? 'pro' : 'free');
      }
    } catch (error) {
      console.error('Error checking subscription status:', error);
      setIsPro(false);
    } finally {
      setIsLoading(false);
    }
  };
  
  const subscribeToPro = async (planId: 'monthly' | 'yearly' | 'lifetime'): Promise<boolean> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Production mode: Use actual payment service
    const result = await applePaymentService.purchaseSubscription(planId, user.id);
    if (result.success) {
      setIsPro(true);
      await AsyncStorage.setItem('subscriptionStatus', 'pro');
      setShowSubscriptionModal(false);
    }
    return result.success;
  } catch (error) {
    console.error('Error subscribing to Pro:', error);
    return false;
  }
};
  
  const restorePurchases = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const restored = await applePaymentService.restorePurchases(user.id);
      if (restored) {
        setIsPro(true);
        await AsyncStorage.setItem('subscriptionStatus', 'pro');
      }
    } catch (error) {
      console.error('Error restoring purchases:', error);
      throw error;
    }
  };

  const openSubscriptionModal = () => {
    setShowSubscriptionModal(true);
  };

  const closeSubscriptionModal = () => {
    setShowSubscriptionModal(false);
  };
  
  const proFeatures = {
    maxPicks: isPro ? 999 : 2,
    hasAIChat: isPro,
    hasAdvancedAnalytics: isPro,
    hasLiveAlerts: isPro,
    hasUnlimitedInsights: isPro,
    hasPrioritySupport: isPro,
  };
  
  return (
    <SubscriptionContext.Provider
      value={{
        isPro,
        isLoading,
        showSubscriptionModal,
        checkSubscriptionStatus,
        subscribeToPro,
        openSubscriptionModal,
        closeSubscriptionModal,
        restorePurchases,
        proFeatures,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}; 