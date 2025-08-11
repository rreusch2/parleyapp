import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import revenueCatService, { SubscriptionPlan } from './revenueCatService';
import { DEV_CONFIG } from '../config/development';
import { supabase } from './api/supabaseClient';
import { Alert, Platform } from 'react-native';
import facebookAnalyticsService from './facebookAnalyticsService';


interface SubscriptionContextType {
  isPro: boolean;
  isElite: boolean;
  subscriptionTier: 'free' | 'pro' | 'elite';
  isLoading: boolean;
  showSubscriptionModal: boolean;
  checkSubscriptionStatus: () => Promise<void>;
  subscribe: (planId: SubscriptionPlan, tier: 'pro' | 'elite') => Promise<boolean>;
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

  // Realtime listener: react immediately to manual DB updates on profiles
  useEffect(() => {
    let channel: any | null = null;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        channel = supabase
          .channel(`profiles-changes-${user.id}`)
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${user.id}`,
          }, (payload: any) => {
            try {
              console.log('📡 Realtime: profile updated, refreshing subscription status', {
                newTier: payload?.new?.subscription_tier,
                oldTier: payload?.old?.subscription_tier,
              });
              // Re-run the authoritative checker (handles welcome bonus, RevenueCat sync, etc.)
              checkSubscriptionStatus();
            } catch (e) {
              console.warn('Realtime handler error', e);
            }
          })
          .subscribe((status: string) => {
            console.log('📡 Realtime channel status:', status);
          });
      } catch (e) {
        console.warn('Failed to start realtime subscription for profiles', e);
      }
    })();

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {}
      }
    };
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
            const customerInfo = await revenueCatService.getCustomerInfo();
            const hasActiveSubscription = customerInfo.entitlements.active.pro || customerInfo.entitlements.active.elite;
            
            console.log('🔄 DEBUG: RevenueCat active subscription:', hasActiveSubscription);

            if (hasActiveSubscription) {
              const isElite = customerInfo.entitlements.active.elite;
              const tier = isElite ? 'elite' : 'pro';
              
              // Only sync with RevenueCat if user doesn't have active welcome bonus
              const welcomeBonusExpires = profile?.welcome_bonus_expires_at ? new Date(profile.welcome_bonus_expires_at) : null;
              const hasActiveWelcomeBonus = profile?.welcome_bonus_claimed && welcomeBonusExpires && now < welcomeBonusExpires;
              
              if (!hasActiveWelcomeBonus && profile?.subscription_tier !== tier) {
                console.log(`🔄 Syncing ${tier} status from RevenueCat to database`);
                await supabase
                  .from('profiles')
                  .update({ subscription_tier: tier })
                  .eq('id', user.id);

                if (tier === 'elite') {
                  setIsElite(true);
                  setIsPro(true); // Elite includes Pro
                } else {
                  setIsPro(true);
                  setIsElite(false);
                }
                
                await AsyncStorage.setItem('subscriptionStatus', tier);
              }
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
  
    const subscribe = async (planId: SubscriptionPlan, tier: 'pro' | 'elite'): Promise<boolean> => {
    console.log(`🔥 DEBUG: subscribe called with planId: ${planId} and tier: ${tier}`);
    
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
        
        // Track successful subscription purchase with Facebook Analytics
        try {
          const planPrices = {
            'weekly': 12.49,
            'monthly': 24.99,
            'yearly': 199.99,
            'lifetime': 349.99,
            'allstar_weekly': 14.99,
            'allstar_monthly': 29.99,
            'allstar_yearly': 199.99
          };
          
          const price = planPrices[planId] || 0;
          facebookAnalyticsService.trackPurchase(price, 'USD', {
            subscription_tier: tier,
            subscription_plan: planId,
            user_id: user.id
          });
          console.log('📊 Facebook Analytics purchase event tracked');
        } catch (error) {
          console.error('❌ Failed to track purchase with Facebook Analytics:', error);
        }

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
        subscribe,
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
