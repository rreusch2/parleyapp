import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import inAppPurchaseService from './inAppPurchases';
import { DEV_CONFIG } from '../config/development';
import { supabase } from './api/supabaseClient';
import { Alert, Platform } from 'react-native';

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
        
        // Initialize IAP service and check subscription status via backend
        await inAppPurchaseService.initialize();
        // Note: Subscription validation now happens via purchase verification
        // The backend will update user status when purchases are verified
        
        // Default to current isPro state for storage
        await AsyncStorage.setItem('subscriptionStatus', isPro ? 'pro' : 'free');
      }
    } catch (error) {
      console.error('Error checking subscription status:', error);
      setIsPro(false);
    } finally {
      setIsLoading(false);
    }
  };
  
  const subscribeToPro = async (planId: 'monthly' | 'yearly' | 'lifetime'): Promise<boolean> => {
    console.log('🔥 DEBUG: subscribeToPro called with planId:', planId);
    
    try {
      console.log('🔥 DEBUG: Getting user from Supabase...');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('❌ DEBUG: No user found');
        return false;
      }
      console.log('✅ DEBUG: User found:', user.id);

      // Get the product ID for the plan
      const productIds = {
        monthly: Platform.OS === 'ios' ? 'com.parleyapp.premium_monthly' : 'premium_monthly',
        yearly: Platform.OS === 'ios' ? 'com.parleyapp.premiumyearly' : 'premium_yearly', 
        lifetime: Platform.OS === 'ios' ? 'com.parleyapp.premium_lifetime' : 'premium_lifetime',
      };
      
      const productId = productIds[planId];
      console.log('🔥 DEBUG: Platform:', Platform.OS);
      console.log('🔥 DEBUG: Selected productId:', productId);
      
      if (!productId) {
        console.error('Invalid plan ID:', planId);
        Alert.alert('Error', 'Invalid subscription plan');
        return false;
      }

      console.log('🔥 DEBUG: Initializing IAP service...');
      await inAppPurchaseService.initialize();
      
      console.log('🔥 DEBUG: Calling purchaseSubscription...');
      await inAppPurchaseService.purchaseSubscription(productId);
      
      console.log('✅ DEBUG: purchaseSubscription call completed');
      // Success handling is done in the purchase listeners
      // The backend verification will update the user's pro status
      return true;
    } catch (error) {
      console.error('❌ DEBUG: Error in subscribeToPro:', error);
      console.error('❌ DEBUG: Error details:', JSON.stringify(error, null, 2));
      Alert.alert('Purchase Error', `Failed to start purchase: ${error.message || error}`);
      return false;
    }
  };
  
  const restorePurchases = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await inAppPurchaseService.initialize();
      await inAppPurchaseService.restorePurchases();
      // Restore success will be handled by purchase listeners
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