import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import revenueCatService, { SubscriptionPlan } from './revenueCatService';
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
        // Check database for subscription_tier first - this is the source of truth
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('subscription_tier')
          .eq('id', user.id)
          .single();
        
        // If the database says the user is pro, respect that
        if (!profileError && profile && profile.subscription_tier === 'pro') {
          console.log('✅ User is Pro according to database');
          setIsPro(true);
          await AsyncStorage.setItem('subscriptionStatus', 'pro');
        } else {
          console.log('ℹ️ User is Free according to database');
          setIsPro(false);
          await AsyncStorage.setItem('subscriptionStatus', 'free');
        }
        
        // Also check with RevenueCat for subscription validation
        try {
          await revenueCatService.initialize();
          const hasActive = await revenueCatService.hasActiveSubscription();
          
          // If RevenueCat says they have an active subscription but DB doesn't, update DB
          if (hasActive && profile?.subscription_tier !== 'pro') {
            console.log('🔄 Syncing Pro status from RevenueCat to database');
            await supabase
              .from('profiles')
              .update({ subscription_tier: 'pro' })
              .eq('id', user.id);
            setIsPro(true);
            await AsyncStorage.setItem('subscriptionStatus', 'pro');
          }
        } catch (rcError) {
          console.log('⚠️ RevenueCat check failed, using database status:', rcError);
          // Continue with database status
        }
      }
    } catch (error) {
      console.error('Error checking subscription status:', error);
      setIsPro(false);
    } finally {
      setIsLoading(false);
    }
  };
  
  const subscribeToPro = async (planId: SubscriptionPlan): Promise<boolean> => {
    console.log('🔥 DEBUG: subscribeToPro called with planId:', planId);
    
    try {
      console.log('🔥 DEBUG: Getting user from Supabase...');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('❌ DEBUG: No user found');
        return false;
      }
      console.log('✅ DEBUG: User found:', user.id);

      console.log('🔥 DEBUG: Initializing RevenueCat service...');
      await revenueCatService.initialize();
      
      console.log('🔥 DEBUG: Calling purchasePackage...');
      const result = await revenueCatService.purchasePackage(planId);
      
      if (result.success) {
        console.log('✅ DEBUG: Purchase completed successfully');
        
        // Immediately update local state
        setIsPro(true);
        await AsyncStorage.setItem('subscriptionStatus', 'pro');
        
        // Force a full subscription status check to ensure everything is synced
        await checkSubscriptionStatus();
        
        return true;
      } else {
        console.error('❌ DEBUG: Purchase failed:', result.error);
        if (result.error !== 'cancelled') {
          Alert.alert('Purchase Error', result.error || 'Failed to complete purchase');
        }
        return false;
      }
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

      await revenueCatService.initialize();
      await revenueCatService.restorePurchases();
      
      // After restore, check subscription status again
      await checkSubscriptionStatus();
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