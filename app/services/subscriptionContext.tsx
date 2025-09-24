import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import revenueCatService, { SubscriptionPlan } from './revenueCatService';
import { DEV_CONFIG } from '../config/development';
import { supabase } from './api/supabaseClient';
import { Alert, Platform } from 'react-native';
import eliteDayPassService from './eliteDayPassService';


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
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('❌ DEBUG: No user found, defaulting to Free');
        setIsPro(false);
        setIsElite(false);
        setSubscriptionTier('free');
        await AsyncStorage.setItem('subscriptionStatus', 'free');
        return;
      }

      console.log('✅ DEBUG: User found:', user.id);
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier, welcome_bonus_claimed, welcome_bonus_expires_at, subscription_plan_type, subscription_expires_at, temporary_tier_active, temporary_tier, temporary_tier_expires_at')
        .eq('id', user.id)
        .single();

      const now = new Date();

      if (profile) {
        // 1) Temporary tier (RPC day pass) takes precedence
        const tempActive = !!(profile.temporary_tier_active && profile.temporary_tier_expires_at && new Date(profile.temporary_tier_expires_at) > now);
        if (tempActive) {
          const tier = profile.temporary_tier === 'elite' ? 'elite' : 'pro';
          console.log('🏁 Temporary Tier active →', tier);
          setIsPro(true);
          setIsElite(tier === 'elite');
          setSubscriptionTier(tier as 'pro' | 'elite');
          await AsyncStorage.setItem('subscriptionStatus', tier);
        } else {
          // 2) Purchases endpoint fallback (plan_type daypass)
          const dayPassActive = !!(profile.subscription_plan_type === 'daypass' && profile.subscription_expires_at && new Date(profile.subscription_expires_at) > now);
          if (dayPassActive) {
            const tier = profile.subscription_tier === 'elite' ? 'elite' : 'pro';
            console.log('🏁 Day Pass active →', tier);
            setIsPro(true);
            setIsElite(tier === 'elite');
            setSubscriptionTier(tier as 'pro' | 'elite');
            await AsyncStorage.setItem('subscriptionStatus', tier);
          } else {
            // 3) Welcome bonus (never overrides paid access)
            const welcomeActive = !!(profile.welcome_bonus_claimed && profile.welcome_bonus_expires_at && new Date(profile.welcome_bonus_expires_at) > now);
            if (welcomeActive) {
              console.log('🎁 Welcome bonus active → FREE tier');
              setIsPro(false);
              setIsElite(false);
              setSubscriptionTier('free');
              await AsyncStorage.setItem('subscriptionStatus', 'free');
            } else if (profile.subscription_tier === 'elite') {
              setIsPro(true);
              setIsElite(true);
              setSubscriptionTier('elite');
              await AsyncStorage.setItem('subscriptionStatus', 'elite');
            } else if (profile.subscription_tier === 'pro') {
              setIsPro(true);
              setIsElite(false);
              setSubscriptionTier('pro');
              await AsyncStorage.setItem('subscriptionStatus', 'pro');
            } else {
              setIsPro(false);
              setIsElite(false);
              setSubscriptionTier('free');
              await AsyncStorage.setItem('subscriptionStatus', 'free');
            }
          }
        }
      } else {
        console.log('⚠️ No profile found → FREE tier');
        setIsPro(false);
        setIsElite(false);
        setSubscriptionTier('free');
        await AsyncStorage.setItem('subscriptionStatus', 'free');
      }

      // RevenueCat sync (non-authoritative when day pass or welcome bonus active)
      try {
        await revenueCatService.initialize();
        const customerInfo = await revenueCatService.getCustomerInfo();
        const hasAny = Object.keys(customerInfo.entitlements.active).length > 0;
        if (hasAny) {
          const eliteEnt = Object.values(customerInfo.entitlements.active).find((e: any) => e?.productIdentifier?.includes('allstar') || e?.productIdentifier === 'com.parleyapp.elitedaypass');
          const tier = eliteEnt ? 'elite' : 'pro';
          const welcomeActive = !!(profile?.welcome_bonus_claimed && profile?.welcome_bonus_expires_at && new Date(profile?.welcome_bonus_expires_at) > now);
          const dayPassActive = !!(profile?.subscription_plan_type === 'daypass' && profile?.subscription_expires_at && new Date(profile?.subscription_expires_at) > now);
          if (!welcomeActive && !dayPassActive && profile?.subscription_tier !== tier) {
            console.log(`🔄 Syncing ${tier} from RevenueCat`);
            await supabase.from('profiles').update({ subscription_tier: tier }).eq('id', user.id);
            setIsPro(true);
            setIsElite(tier === 'elite');
            setSubscriptionTier(tier as 'pro' | 'elite');
            await AsyncStorage.setItem('subscriptionStatus', tier);
          }
        }
      } catch (rcErr) {
        console.log('⚠️ RevenueCat check failed:', rcErr);
      }
    } catch (err) {
      console.error('❌ DEBUG: Error checking subscription:', err);
      setIsPro(false);
      setIsElite(false);
      setSubscriptionTier('free');
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

      // Handle Pro Day Pass specially (non-renewable, 24h access)
      if (planId === 'pro_daypass') {
        console.log('🎯 DEBUG: Processing Pro Day Pass purchase...');
        // Complete purchase via RevenueCat first
        const purchaseResult = await revenueCatService.purchasePackage('pro_daypass');
        if (!purchaseResult.success) {
          Alert.alert('Purchase Failed', purchaseResult.error || 'Unable to activate Pro Day Pass');
          return false;
        }

        // Persist 24h Pro access on the server (RPC)
        try {
          const { error: activationError } = await supabase.rpc('activate_pro_daypass', { user_id_param: user.id });
          if (activationError) {
            console.error('Pro Day Pass activation error:', activationError);
            Alert.alert('Activation Error', 'Purchase succeeded but activation failed. Please use Restore Purchases.');
            return false;
          }
        } catch (e) {
          console.error('RPC error during Pro Day Pass activation:', e);
          Alert.alert('Activation Error', 'Purchase succeeded but activation failed. Please use Restore Purchases.');
          return false;
        }

        // Update local state immediately
        setIsPro(true);
        setIsElite(false);
        setSubscriptionTier('pro');
        await AsyncStorage.setItem('subscriptionStatus', 'pro');

        // Purchase tracked via RevenueCat/AppsFlyer

        // Success message
        Alert.alert(
          '🎉 Pro Day Pass Activated!',
          'You now have Pro access for 24 hours. Enjoy 20 daily picks and premium features!',
          [{ text: 'Get Started', style: 'default' }]
        );

        // Ensure downstream UI reflects DB
        await checkSubscriptionStatus();
        return true;
      }

      // Handle Elite Day Pass specially
      if (planId === 'elite_daypass') {
        console.log('🎯 DEBUG: Processing Elite Day Pass purchase...');
        const dayPassResult = await eliteDayPassService.purchaseEliteDayPass(user.id);
        
        if (dayPassResult.success) {
          console.log('✅ Elite Day Pass activated successfully!');
          
          // Update local state immediately
          setIsPro(true);
          setIsElite(true);
          setSubscriptionTier('elite');
          await AsyncStorage.setItem('subscriptionStatus', 'elite');
          
          // Purchase tracked via RevenueCat/AppsFlyer
          
          // Show success message
          Alert.alert(
            '🎉 Elite Day Pass Activated!',
            `You now have Elite access for 24 hours. Enjoy premium features, advanced analytics, and priority support!`,
            [{ text: 'Get Started', style: 'default' }]
          );
          
          return true;
        } else {
          Alert.alert('Purchase Failed', dayPassResult.error || 'Unable to activate Elite Day Pass');
          return false;
        }
      }

      // Handle regular subscriptions
      console.log('🔥 DEBUG: Initializing RevenueCat service...');
      await revenueCatService.initialize();
      
      console.log('🔥 DEBUG: Calling purchasePackage...');
      const result = await revenueCatService.purchasePackage(planId);
      
      if (result.success) {
        console.log('✅ DEBUG: Purchase completed successfully, now verifying status...');
        
        // Track successful subscription purchase with Facebook Analytics
        try {
          const planPrices = {
            'weekly': 9.99,
            'monthly': 24.99,
            'yearly': 199.99,
            'lifetime': 349.99,
            'allstar_weekly': 14.99,
            'allstar_monthly': 29.99,
            'allstar_yearly': 199.99
          };
          
          const price = planPrices[planId] || 0;
          // Purchase tracking handled by RevenueCat and AppsFlyer
          console.log('📊 Purchase event tracked via RevenueCat');
        } catch (error) {
          console.error('❌ Purchase tracking error:', error);
        }

        // CRITICAL FIX: Remove optimistic update.
        // Instead of setting isPro(true) immediately, we rely on checkSubscriptionStatus
        // to get the authoritative state from the backend after the purchase is processed.
        
        // Force a full subscription status check to ensure everything is synced.
        // This will fetch the latest receipt info from RevenueCat and update the database.
        console.log('🔄 DEBUG: Running full subscription status check post-purchase...');
        await checkSubscriptionStatus();
        console.log('✅ DEBUG: Full subscription check completed post-purchase.');
        
        // CRITICAL: Process referral conversion for successful subscription
        try {
          console.log('🎯 Processing referral conversion for user subscription...');
          const PointsService = (await import('./pointsService')).default;
          const pointsService = PointsService.getInstance();
          await pointsService.processReferralConversion(user.id);
          console.log('✅ Referral conversion processing completed');
        } catch (referralError) {
          console.error('❌ Failed to process referral conversion:', referralError);
          // Don't block the subscription success for referral errors
        }
        
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
