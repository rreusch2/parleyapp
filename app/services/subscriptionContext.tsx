import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { applePaymentService } from './paymentService';
import { DEV_CONFIG } from '@/app/config/development';
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
      
      // Development mode: Check actual user's database subscription tier
      if (__DEV__) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Fetch user's actual subscription tier from database
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('subscription_tier')
            .eq('id', user.id)
            .single();
          
          if (profile && !error) {
            const userIsPro = profile.subscription_tier === 'pro';
            setIsPro(userIsPro);
            
            if (DEV_CONFIG.LOG_SUBSCRIPTION_STATUS) {
              console.log(`🔧 Development Mode: User ${user.email} has ${profile.subscription_tier} subscription`);
            }
            return;
          } else {
            console.log('📝 No profile found, defaulting to free tier');
            setIsPro(false);
            return;
          }
        } else {
          // No user logged in, default to free
          setIsPro(false);
          return;
        }
      }
      
      // Production mode: Use payment service
      // Check local storage first
      const storedStatus = await AsyncStorage.getItem('subscriptionStatus');
      if (storedStatus) {
        setIsPro(storedStatus === 'pro');
      }
      
      // Then verify with payment service
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const subscriptionStatus = await applePaymentService.validateSubscription(user.id);
        const isSubscribed = subscriptionStatus.isActive && subscriptionStatus.tier !== 'free';
        setIsPro(isSubscribed);
        
        // Update local storage
        await AsyncStorage.setItem('subscriptionStatus', isSubscribed ? 'pro' : 'free');
        
        if (DEV_CONFIG.LOG_SUBSCRIPTION_STATUS) {
          console.log(`📱 Subscription Status: ${isSubscribed ? 'Pro' : 'Free'}`);
        }
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

      // Development mode: Skip payment processing and directly upgrade user
      if (__DEV__) {
        console.log(`🔧 Development Mode: Upgrading user to ${planId} pro plan (skipping payment)`);
        
        try {
          // Update user profile to Pro status in Supabase
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ 
              subscription_tier: 'pro',
              updated_at: new Date().toISOString()
            })
            .eq('id', user.id);

          if (updateError) {
            console.error('❌ Failed to update user profile:', updateError);
            Alert.alert('Error', 'Failed to update subscription status. Please try again.');
            return false;
          }

          // Update local state and storage
          setIsPro(true);
          await AsyncStorage.setItem('subscriptionStatus', 'pro');
          
          // Close the modal on successful upgrade
          setShowSubscriptionModal(false);
          
          // Show success message
          Alert.alert(
            '🎉 Welcome to Pro!',
            `You've been upgraded to ${planId} plan! All Pro features are now unlocked.`,
            [{ text: 'Awesome!', style: 'default' }]
          );

          console.log(`✅ Successfully upgraded user to Pro (${planId} plan)`);
          return true;
        } catch (error) {
          console.error('❌ Error during dev subscription upgrade:', error);
          Alert.alert('Error', 'Failed to upgrade account. Please try again.');
          return false;
        }
      }

      // Production mode: Use actual payment service
      const result = await applePaymentService.purchaseSubscription(planId, user.id);
      if (result.success) {
        setIsPro(true);
        await AsyncStorage.setItem('subscriptionStatus', 'pro');
        
        // Close the modal on successful purchase
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