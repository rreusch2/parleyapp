import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import revenueCatService, { SubscriptionPlan } from './revenueCatService';
import { DEV_CONFIG } from '../config/development';
import { supabase } from './api/supabaseClient';
import { Alert, Platform } from 'react-native';


interface SubscriptionContextType {
  isPro: boolean;
  isElite: boolean;
  subscriptionTier: 'free' | 'pro' | 'elite';
  isLoading: boolean;
  showSubscriptionModal: boolean;
  checkSubscriptionStatus: () => Promise<void>;
  subscribeToPro: (planId: SubscriptionPlan) => Promise<boolean>;
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
  eliteFeatures: {
    hasLockOfTheDay: boolean;
    hasAdvancedAnalytics: boolean;
    hasEliteTheme: boolean;
    hasEarlyAccess: boolean;
    hasEliteInsights: boolean;
    hasPrioritySupport: boolean;
    maxPicks: number;
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
  const [isElite, setIsElite] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'pro' | 'elite'>('free');
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
    console.log('🔄 DEBUG: checkSubscriptionStatus called');
    
    try {
      setIsLoading(true);
      
      console.log('🔄 DEBUG: Getting user from Supabase...');
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        console.log('✅ DEBUG: User found:', user.id);
        
        // Check database for subscription_tier first - this is the source of truth
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('subscription_tier, welcome_bonus_claimed, welcome_bonus_expires_at')
          .eq('id', user.id)
          .single();
        
        const now = new Date(); // Define now here for use throughout the function
        
        if (!profileError && profile) {
          console.log('🔄 DEBUG: Profile found:', profile);
          
          // CRITICAL: Check if user has active welcome bonus
          const welcomeBonusExpires = profile.welcome_bonus_expires_at ? new Date(profile.welcome_bonus_expires_at) : null;
          const hasActiveWelcomeBonus = profile.welcome_bonus_claimed && welcomeBonusExpires && now < welcomeBonusExpires;
          
          console.log('🔄 DEBUG: Welcome bonus check:', { hasActiveWelcomeBonus, expires: welcomeBonusExpires });
          
          // CRITICAL FIX: Users with welcome bonus should ALWAYS be treated as Free tier
          if (hasActiveWelcomeBonus) {
            console.log('🎁 User has active welcome bonus - keeping as FREE tier');
            setIsPro(false);
            setIsElite(false);
            setSubscriptionTier('free');
            await AsyncStorage.setItem('subscriptionStatus', 'free');
          } else if (profile.subscription_tier === 'elite') {
            console.log('👑 User is Elite according to database');
            setIsPro(true); // Elite users are also Pro
            setIsElite(true);
            setSubscriptionTier('elite');
            await AsyncStorage.setItem('subscriptionStatus', 'elite');
          } else if (profile.subscription_tier === 'pro') {
            console.log('✅ User is Pro according to database');
            setIsPro(true);
            setIsElite(false);
            setSubscriptionTier('pro');
            await AsyncStorage.setItem('subscriptionStatus', 'pro');
          } else {
            console.log('ℹ️ User is Free according to database');
            setIsPro(false);
            setIsElite(false);
            setSubscriptionTier('free');
            await AsyncStorage.setItem('subscriptionStatus', 'free');
          }
        } else {
          console.log('⚠️ Could not fetch user profile, defaulting to Free');
          setIsPro(false);
          await AsyncStorage.setItem('subscriptionStatus', 'free');
        }
        
        // Also check with RevenueCat for subscription validation (but don't override welcome bonus users)
        try {
          console.log('🔄 DEBUG: Checking RevenueCat subscription...');
          await revenueCatService.initialize();
          const hasActive = await revenueCatService.hasActiveSubscription();
          
          console.log('🔄 DEBUG: RevenueCat active subscription:', hasActive);
          
          // Only sync with RevenueCat if user doesn't have active welcome bonus
          const welcomeBonusExpires = profile?.welcome_bonus_expires_at ? new Date(profile.welcome_bonus_expires_at) : null;
          const hasActiveWelcomeBonus = profile?.welcome_bonus_claimed && welcomeBonusExpires && now < welcomeBonusExpires;
          
          if (!hasActiveWelcomeBonus && hasActive && profile?.subscription_tier !== 'pro') {
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
      } else {
        console.log('❌ DEBUG: No user found, setting isPro to false');
        setIsPro(false);
        await AsyncStorage.setItem('subscriptionStatus', 'free');
      }
    } catch (error) {
      console.error('❌ DEBUG: Error checking subscription:', error);
      console.error('❌ DEBUG: Error details:', JSON.stringify(error, null, 2));
      setIsPro(false);
      await AsyncStorage.setItem('subscriptionStatus', 'free');
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
        console.log('✅ DEBUG: Purchase completed successfully, now verifying status...');
        


        // CRITICAL FIX: Remove optimistic update.
        // Instead of setting isPro(true) immediately, we rely on checkSubscriptionStatus
        // to get the authoritative state from the backend after the purchase is processed.
        
        // Force a full subscription status check to ensure everything is synced.
        // This will fetch the latest receipt info from RevenueCat and update the database.
        console.log('🔄 DEBUG: Running full subscription status check post-purchase...');
        await checkSubscriptionStatus();
        console.log('✅ DEBUG: Full subscription check completed post-purchase.');
        
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

  // Use SUBSCRIPTION_TIERS.elite for Elite tier features
  const eliteFeatures = {
    hasLockOfTheDay: isElite,
    hasAdvancedAnalytics: isElite,
    hasEliteTheme: isElite,
    hasEarlyAccess: isElite,
    hasEliteInsights: isElite,
    hasPrioritySupport: isElite,
    maxPicks: isElite ? 999 : (isPro ? 999 : 2),
  };
  
  return (
    <SubscriptionContext.Provider
      value={{
        isPro,
        isElite,
        subscriptionTier,
        isLoading,
        showSubscriptionModal,
        checkSubscriptionStatus,
        subscribeToPro,
        openSubscriptionModal,
        closeSubscriptionModal,
        restorePurchases,
        proFeatures,
        eliteFeatures,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};
