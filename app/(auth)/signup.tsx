import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  Keyboard,
  Pressable,
  Dimensions,
  Image,
} from 'react-native';
import { Link, useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../services/api/supabaseClient';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, Lock, User, CheckSquare, Square, UserPlus, Eye, EyeOff } from 'lucide-react-native';
import { normalize, isTablet } from '../services/device';
import TermsOfServiceModal from '../components/TermsOfServiceModal';
import TieredSignupSubscriptionModal from '../components/TieredSignupSubscriptionModal';
import UserPreferencesModal from '../components/UserPreferencesModal';
import SimpleSpinningWheel from '../components/SimpleSpinningWheel';
import { useSubscription } from '../services/subscriptionContext';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';
import { makeRedirectUri } from 'expo-auth-session';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';

// Complete pending auth sessions (required by expo-auth-session)
WebBrowser.maybeCompleteAuthSession();
import appsFlyerService from '../services/appsFlyerService';


export default function SignupScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showSpinningWheel, setShowSpinningWheel] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [hasPurchasedSubscription, setHasPurchasedSubscription] = useState(false); // Tracks both Pro and Elite purchases
  const [isAppleAuthAvailable, setIsAppleAuthAvailable] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Focus states for better UX
  const [usernameFocused, setUsernameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);
  const [referralCodeFocused, setReferralCodeFocused] = useState(false);
  
  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const router = useRouter();
  const params = useLocalSearchParams();
  const { checkSubscriptionStatus, isPro, isElite } = useSubscription();
  const extra = (Constants?.expoConfig?.extra ?? (Constants as any)?.manifest?.extra) || {};

  // Configure native Google Sign-In
  React.useEffect(() => {
    const webClientId = (process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID as string) || (extra as any)?.googleWebClientId;
    const iosClientId = (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID as string) || (extra as any)?.googleIosClientId;
    GoogleSignin.configure({
      webClientId,
      iosClientId, // Need this for iOS native flow
      scopes: ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile'],
      offlineAccess: false,
    });
  }, []);

  // Check if Apple Auth is available on mount
  React.useEffect(() => {
    // Apple Authentication is only available on iOS
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setIsAppleAuthAvailable);
    } else {
      setIsAppleAuthAvailable(false);
    }
    
    // Check if user was redirected from login after Apple/Google Sign In
    if (params.appleSignInComplete === 'true' && params.userId) {
      console.log('User redirected from Apple Sign In, showing subscription modal');
      // Automatically agree to terms since they already authenticated
      setAgreeToTerms(true);
      // Show subscription modal immediately
      setShowSubscriptionModal(true);
    }
    if (params.googleSignInComplete === 'true' && params.userId) {
      console.log('User redirected from Google Sign In, showing preferences modal first');
      setAgreeToTerms(true);
      setShowPreferencesModal(true);
    }
    if ((params as any).discordSignInComplete === 'true' && params.userId) {
      console.log('User redirected from Discord Sign In, showing preferences modal first');
      setAgreeToTerms(true);
      setShowPreferencesModal(true);
    }
  }, [params]);

  // Handle OAuth return when starting Discord from this screen
  React.useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        try {
          const user = session.user as any;
          const emailAddr: string = user.email || '';
          const meta = (user.user_metadata || {}) as any;
          const fullName: string = meta.full_name || meta.name || meta.user_name || '';
          const avatarUrl: string | null = meta.avatar_url || null;
          const displayName: string = fullName || (emailAddr ? emailAddr.split('@')[0] : 'DiscordUser');

          await supabase
            .from('profiles')
            .upsert(
              {
                id: user.id,
                username: displayName,
                email: emailAddr,
                avatar_url: avatarUrl,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'id' }
            );

          setCurrentUserId(user.id);
          setAgreeToTerms(true);
          setShowPreferencesModal(true);
        } catch (e) {
          console.error('Discord OAuth profile upsert error (signup):', e);
          // Fallback to main app
          router.replace('/(tabs)');
        }
      }
    });
    return () => sub.subscription?.unsubscribe();
  }, [router]);

  // Optimized handlers using useCallback to prevent unnecessary re-renders
  const handleUsernameChange = useCallback((text: string) => {
    // Allow alphanumeric and underscores, remove spaces and special chars for username
    const cleanText = text.replace(/[^a-zA-Z0-9_]/g, '');
    setUsername(cleanText);
  }, []);

  const handleEmailChange = useCallback((text: string) => {
    setEmail(text.trim().toLowerCase()); // Trim and lowercase for email
  }, []);

  const handlePasswordChange = useCallback((text: string) => {
    setPassword(text); // Allow ALL characters including special characters
  }, []);

  const handleConfirmPasswordChange = useCallback((text: string) => {
    setConfirmPassword(text); // Allow ALL characters including special characters
  }, []);

  // Focus handlers
  const handleUsernameFocus = useCallback(() => setUsernameFocused(true), []);
  const handleUsernameBlur = useCallback(() => setUsernameFocused(false), []);
  const handleEmailFocus = useCallback(() => setEmailFocused(true), []);
  const handleEmailBlur = useCallback(() => setEmailFocused(false), []);
  const handlePasswordFocus = useCallback(() => setPasswordFocused(true), []);
  const handlePasswordBlur = useCallback(() => setPasswordFocused(false), []);
  const handleConfirmPasswordFocus = useCallback(() => setConfirmPasswordFocused(true), []);
  const handleConfirmPasswordBlur = useCallback(() => setConfirmPasswordFocused(false), []);

  // Referral code handlers
  const handleReferralCodeChange = useCallback((text: string) => {
    // Convert to uppercase and remove spaces
    const cleanCode = text.toUpperCase().replace(/\s/g, '');
    setReferralCode(cleanCode);
  }, []);
  
  const handleReferralCodeFocus = useCallback(() => setReferralCodeFocused(true), []);
  const handleReferralCodeBlur = useCallback(() => setReferralCodeFocused(false), []);

  // Password visibility toggles
  const togglePasswordVisibility = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  const toggleConfirmPasswordVisibility = useCallback(() => {
    setShowConfirmPassword(prev => !prev);
  }, []);

  const toggleTermsAgreement = useCallback(() => {
    setAgreeToTerms(prev => !prev);
  }, []);

  // Memoized styles for better performance
  const usernameInputWrapperStyle = useMemo(() => [
    styles.inputWrapper,
    usernameFocused && styles.inputWrapperFocused
  ], [usernameFocused]);

  const emailInputWrapperStyle = useMemo(() => [
    styles.inputWrapper,
    emailFocused && styles.inputWrapperFocused
  ], [emailFocused]);

  const passwordInputWrapperStyle = useMemo(() => [
    styles.inputWrapper,
    passwordFocused && styles.inputWrapperFocused
  ], [passwordFocused]);

  const confirmPasswordInputWrapperStyle = useMemo(() => [
    styles.inputWrapper,
    confirmPasswordFocused && styles.inputWrapperFocused
  ], [confirmPasswordFocused]);

  const referralCodeInputWrapperStyle = useMemo(() => [
    styles.inputWrapper,
    referralCodeFocused && styles.inputWrapperFocused
  ], [referralCodeFocused]);

  // Validation states
  const isValidEmail = useMemo(() => {
    if (!email) return true; // Don't show error for empty email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }, [email]);

  const isValidReferralCode = useMemo(() => {
    if (!referralCode) return true; // Optional field
    return referralCode.length >= 6 && referralCode.length <= 10; // Reasonable length
  }, [referralCode]);

  const passwordsMatch = useMemo(() => {
    if (!confirmPassword) return true; // Don't show error for empty confirm password
    return password === confirmPassword;
  }, [password, confirmPassword]);

  const handleSpinningWheelComplete = async (picks: number) => {
    console.log(`🎊 User won ${picks} picks! Activating welcome bonus...`);
    
    try {
      // Get current user
      const { data: userData } = await supabase.auth.getUser();
      
      if (userData.user) {
        // Calculate expiration time (24 hours from now for fair trial period)
        const now = new Date();
        const expiration = new Date(now.getTime() + (24 * 60 * 60 * 1000)); // 24 hours from now
        
        console.log(`🕛 Setting welcome bonus to expire at: ${expiration.toISOString()} (24 hours from signup)`);
        
        // CRITICAL: Update user profile to activate welcome bonus BUT ensure they stay FREE tier
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            subscription_tier: 'free',  // EXPLICITLY set to free (critical!)
            welcome_bonus_claimed: true,
            welcome_bonus_expires_at: expiration.toISOString(),
            // Do NOT set trial_used here - welcome bonus is separate from trial eligibility
            updated_at: new Date().toISOString()
          })
          .eq('id', userData.user.id);

        if (updateError) {
          console.error('❌ Failed to activate welcome bonus:', updateError);
          console.error('❌ Error details:', JSON.stringify(updateError, null, 2));
        } else {
          console.log(`✅ Welcome bonus activated! User stays FREE tier with ${picks} picks until ${expiration.toISOString()}`);
          
          // Welcome bonus claimed - tracked via AppsFlyer
          
          // Force refresh the subscription context to ensure isPro stays false
          await checkSubscriptionStatus();
          
          // Verify the update worked
          const { data: verifyProfile, error: verifyError } = await supabase
            .from('profiles')
            .select('subscription_tier, welcome_bonus_claimed, welcome_bonus_expires_at')
            .eq('id', userData.user.id)
            .single();
            
          if (!verifyError && verifyProfile) {
            console.log(`✅ Verification: tier=${verifyProfile.subscription_tier}, bonus_claimed=${verifyProfile.welcome_bonus_claimed}, expires_at=${verifyProfile.welcome_bonus_expires_at}`);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error activating welcome bonus:', error);
    }
    
    router.replace('/(tabs)');
  };

  const handleGoogleSignUp = async () => {
    if (!agreeToTerms) {
      Alert.alert('Terms Required', 'You must agree to the Terms of Service to create an account');
      return;
    }
    try {
      setLoading(true);
      
      // Check Play Services on Android only
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices();
      }

      const info = await GoogleSignin.signIn();
      console.log('🔍 Google userInfo (Signup):', JSON.stringify(info, null, 2));
      
      const idToken = info.data?.idToken;
      if (!idToken) {
        Alert.alert('Sign Up Error', 'Google did not return an ID token.');
        return;
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (error) throw error;

      if (data?.user) {
        // Derive profile fields
        const emailAddr = data.user.email || '';
        const fullName = (data.user as any)?.user_metadata?.full_name || (data.user as any)?.user_metadata?.name || '';
        const avatarUrl = (data.user as any)?.user_metadata?.avatar_url || (data.user as any)?.user_metadata?.picture || null;
        const displayName = fullName || (emailAddr ? emailAddr.split('@')[0] : 'GoogleUser');

        // Generate unique referral code for new user
        const generateReferralCode = () => {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
          let result = '';
          for (let i = 0; i < 8; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
          return result;
        };
        const userReferralCode = generateReferralCode();

        // Capture entered referral code if provided
        let referredBy = null as string | null;
        if (referralCode && referralCode.trim().length > 0) {
          referredBy = referralCode.trim().toUpperCase();
          console.log('🎯 Google user entered referral code:', referredBy);
        }

        // Upsert profile
        await supabase
          .from('profiles')
          .upsert(
            {
              id: data.user.id,
              username: displayName,
              email: emailAddr,
              avatar_url: avatarUrl,
              referral_code: userReferralCode,
              referred_by: referredBy,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'id' }
          );

        // Process referral points if applicable
        if (referredBy) {
          try {
            const PointsService = (await import('../services/pointsService')).default;
            const pointsService = PointsService.getInstance();
            const success = await pointsService.processReferralSignup(data.user.id, referredBy);
            if (success) console.log('✅ Google user referral processed - 2,500 points awarded');
          } catch (err) {
            console.error('❌ Error processing Google user referral:', err);
          }
        }

        console.log('✅ Google Sign Up successful! User ID:', data.user.id);
        setCurrentUserId(data.user.id);
        setShowPreferencesModal(true);
      }
    } catch (error: any) {
      console.error('Google Sign Up error:', error);
      const msg = error?.message?.includes('network')
        ? 'Network error. Please check your connection and try again.'
        : 'Failed to sign up with Google. Please try again.';
      Alert.alert('Sign Up Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSpinningWheelClose = () => {
    console.log('🎯 Spinning wheel closed, navigating to main app...');
    router.replace('/(tabs)');
  };

  const handleSubscribe = async (planId: 'weekly' | 'monthly' | 'yearly' | 'lifetime' | 'pro_weekly' | 'pro_monthly' | 'pro_yearly' | 'pro_daypass') => {
    try {
      console.log(`🚀 User attempting to subscribe to ${planId} plan`);
      setLoading(true);

      // Use RevenueCat for purchase processing
      const revenueCatService = (await import('../services/revenueCatService')).default;
      
      console.log('🔄 Processing subscription with RevenueCat...');
      
      // Add debug logging for yearly subscriptions
      if (planId === 'yearly') {
        console.log('🔍 DEBUG: Yearly subscription detected, running debug check...');
        await revenueCatService.debugSubscriptionStatus();
      }
      
      const result = await revenueCatService.purchasePackage(planId);
      
      if (result.success) {
        console.log('✅ User successfully subscribed to Pro/Elite!');
        setHasPurchasedSubscription(true); // Mark that user has purchased a subscription (Pro or Elite)
        
        // Add debug logging after successful purchase
        if (planId === 'yearly') {
          console.log('🔍 DEBUG: Yearly subscription successful, checking final status...');
          await revenueCatService.debugSubscriptionStatus();
        }
        
        // Update subscription status in context and wait for it to complete
        console.log('🔄 Updating subscription status...');
        await checkSubscriptionStatus();
        
        // Small delay to ensure context is fully updated
        await new Promise(resolve => setTimeout(resolve, 500));
        
        Alert.alert(
          '🎉 Welcome to Pro!',
          `You've successfully subscribed to ${planId} plan. Welcome to the premium experience!`,
          [{ 
            text: 'Let\'s Go!', 
            onPress: () => {
              setShowSubscriptionModal(false);
              // Navigate directly to app without showing spinning wheel
              router.replace('/(tabs)');
            }
          }]
        );
      } else {
        console.error('❌ Purchase failed with error:', result.error);
        if (result.error !== 'cancelled') {
          Alert.alert(
            'Purchase Error',
            result.error || 'Failed to process subscription. Please try again.',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error: any) {
      console.error('❌ Subscription error:', error);
      console.error('❌ Error type:', typeof error);
      console.error('❌ Error constructor:', error?.constructor?.name);
      
      // More robust error handling
      let errorMessage = 'Failed to process subscription. Please try again.';
      
      if (error && typeof error === 'object') {
        const errorStr = error.message || error.toString() || '';
        
        if (errorStr.includes('cancelled') || errorStr.includes('canceled')) {
          console.log('ℹ️ User cancelled purchase');
          // Don't show error for cancellation
          return;
        } else if (errorStr.includes('not available') || errorStr.includes('unavailable')) {
          errorMessage = 'This subscription is not available right now. Please try again later.';
        } else if (errorStr.includes('Network') || errorStr.includes('network')) {
          errorMessage = 'Please check your internet connection and try again.';
        } else if (errorStr.includes('payment') || errorStr.includes('Payment')) {
          errorMessage = 'Payment processing failed. Please check your payment method and try again.';
        } else if (error.message) {
          errorMessage = error.message;
        }
      }
      
      Alert.alert(
        'Subscription Error',
        errorMessage,
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleContinueFree = () => {
    console.log('🎯 User chose to continue with free account');
    
    try {
      // Close the subscription modal immediately
      setShowSubscriptionModal(false);
      
      // Use requestAnimationFrame to ensure the modal is fully closed before showing the wheel
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Now it's safe to show the spinning wheel
          setShowSpinningWheel(true);
          console.log('🎯 Spinning wheel should now be visible');
        });
      });
    } catch (error) {
      console.error('❌ Error in handleContinueFree:', error);
      // Fallback: navigate directly to the app
      router.replace('/(tabs)');
    }
  };

  const handleSubscriptionModalClose = () => {
    console.log('🎯 Subscription modal close requested');
    console.log('🎯 hasPurchasedSubscription:', hasPurchasedSubscription);
    
    try {
      // Close the subscription modal
      setShowSubscriptionModal(false);
      
      // If user purchased a subscription (Pro or Elite), navigate to the app
      if (hasPurchasedSubscription) {
        console.log('🎯 User has purchased subscription (Pro/Elite), navigating to main app');
        router.replace('/(tabs)');
      } else {
        // Otherwise show the spinning wheel after ensuring modal is closed
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setShowSpinningWheel(true);
            console.log('🎯 Spinning wheel should now be visible');
          });
        });
      }
    } catch (error) {
      console.error('❌ Error in handleSubscriptionModalClose:', error);
      // Fallback: navigate directly to the app
      router.replace('/(tabs)');
    }
  };

  const handleAppleSignUp = async () => {
    if (!agreeToTerms) {
      Alert.alert('Terms Required', 'You must agree to the Terms of Service to create an account');
      return;
    }

    try {
      setLoading(true);
      
      console.log('🍎 Starting Apple Sign Up...');
      
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      console.log('🍎 Apple credential received:', {
        identityToken: credential.identityToken ? 'Present' : 'Missing',
        authorizationCode: credential.authorizationCode ? 'Present' : 'Missing',
        user: credential.user,
        email: credential.email,
        fullName: credential.fullName,
        state: credential.state,
        realUserStatus: credential.realUserStatus
      });

      if (credential.identityToken) {
        console.log('🍎 Attempting Supabase signInWithIdToken...');
        console.log('🍎 Identity token length:', credential.identityToken.length);
        
        // First attempt with identity token
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
          // Remove the nonce parameter - let Supabase handle it
        });

        if (error) {
          console.error('Supabase Apple Sign Up error:', error);
          console.error('Error details:', {
            message: error.message,
            status: error.status,
            code: error.code
          });
          
          // If identity token fails, try with user + email as fallback
          if (credential.email && error.message?.includes('token')) {
            console.log('🍎 Attempting email-based fallback...');
            // This is just for debugging - remove in production
            Alert.alert(
              'Debug Info',
              `Apple ID: ${credential.user}\nEmail: ${credential.email || 'Not provided'}\nError: ${error.message}`,
              [{ text: 'OK' }]
            );
          }
          
          throw error;
        }

        if (data.user) {
          // For new sign ups, Apple provides the name and email
          const fullName = credential.fullName;
          const displayName = [fullName?.givenName, fullName?.familyName]
            .filter(Boolean)
            .join(' ') || credential.email?.split('@')[0] || 'AppleUser';

          // Generate unique referral code for new user
          const generateReferralCode = () => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let result = '';
            for (let i = 0; i < 8; i++) {
              result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
          };

          const userReferralCode = generateReferralCode();
          
          // Check if user entered a referral code
          let referredBy = null;
          if (referralCode && referralCode.trim().length > 0) {
            referredBy = referralCode.trim().toUpperCase();
            console.log('🎯 Apple user entered referral code:', referredBy);
          }

          // Update the user's profile with their name and referral info
          await supabase
            .from('profiles')
            .update({
              username: displayName,
              email: credential.email || data.user.email,
              referral_code: userReferralCode,
              referred_by: referredBy,
              updated_at: new Date().toISOString()
            })
            .eq('id', data.user.id);

          console.log('✅ Apple user profile updated with referral code:', userReferralCode);

          // If user was referred, process with points system
          if (referredBy) {
            try {
              const PointsService = (await import('../services/pointsService')).default;
              const pointsService = PointsService.getInstance();
              
              const success = await pointsService.processReferralSignup(data.user.id, referredBy);
              if (success) {
                console.log('✅ Apple user referral processed - 2,500 points awarded');
              } else {
                console.log('❌ Invalid referral code for Apple user');
              }
            } catch (error) {
              console.error('❌ Error processing Apple user referral:', error);
            }
          }

          console.log('✅ Apple Sign Up successful! User ID:', data.user.id);
          
          // Store user ID and show preferences modal first
          setCurrentUserId(data.user.id);
          setShowPreferencesModal(true);
        }
      }
    } catch (error) {
      if (error.code === 'ERR_REQUEST_CANCELED') {
        // User canceled the sign-in
        console.log('User canceled Apple Sign Up');
      } else {
        console.error('Apple Sign Up error details:', {
          code: error.code,
          message: error.message,
          error: error
        });
        
        // Provide more specific error messages
        let errorMessage = 'Failed to sign up with Apple. Please try again.';
        
        if (error.message?.includes('provider')) {
          errorMessage = 'Apple Sign In is not properly configured. Please contact support.';
        } else if (error.message?.includes('token')) {
          errorMessage = 'Invalid authentication token. Please try again.';
        } else if (error.message?.includes('network')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        }
        
        Alert.alert('Sign Up Error', errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    console.log('🔥 Signup button clicked!');
    console.log('Form data:', { username, email, password: password ? '***' : '', confirmPassword: confirmPassword ? '***' : '', agreeToTerms });

    if (!username || !email || !password || !confirmPassword) {
      console.log('❌ Validation failed: Missing fields');
      Alert.alert('Signup Error', 'Please fill in all fields');
      return;
    }

    if (!agreeToTerms) {
      console.log('❌ Validation failed: Terms not agreed to');
      Alert.alert('Terms Required', 'You must agree to the Terms of Service to create an account');
      return;
    }

    if (!isValidEmail) {
      console.log('❌ Validation failed: Invalid email');
      Alert.alert('Signup Error', 'Please enter a valid email address');
      return;
    }

    if (password !== confirmPassword) {
      console.log('❌ Validation failed: Passwords do not match');
      Alert.alert('Signup Error', 'Passwords do not match');
      return;
    }

    // Updated password validation - removed special character requirement
    if (password.length < 8) {
      console.log('❌ Validation failed: Password too short');
      Alert.alert(
        'Signup Error',
        'Password must be at least 8 characters long.'
      );
      return;
    }

    console.log('✅ Validation passed, attempting signup...');

    try {
      console.log('🔄 Setting loading state...');
      setLoading(true);
      console.log('🚀 About to call Supabase signup...');
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { 
          data: { 
            username: username
          } 
        }
      });

      console.log('📥 Supabase response:', { 
        data: data ? 'User data received' : 'No data', 
        error: error ? error.message : 'No error',
        userId: data?.user?.id 
      });

      if (error) {
        console.log('❌ Supabase error:', error);
        throw error;
      }

      if (data.user) {
        console.log('✅ Signup successful! User ID:', data.user.id);
        console.log('🎯 About to show preferences modal...');
        
        // Track signup with AppsFlyer for TikTok attribution
        try {
          await appsFlyerService.trackSignup('email');
          console.log('📊 AppsFlyer signup event tracked');
        } catch (error) {
          console.error('❌ Failed to track signup with AppsFlyer:', error);
        }
        
        // Generate unique referral code for new user
        const generateReferralCode = () => {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
          let result = '';
          for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          return result;
        };

        const userReferralCode = generateReferralCode();
        
        // Check if user entered a referral code
        let referredBy = null;
        if (referralCode && referralCode.trim().length > 0) {
          referredBy = referralCode.trim().toUpperCase();
          console.log('🎯 User entered referral code:', referredBy);
        }

        // Update user profile with referral code and referral attribution
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            username: username,
            email: email,
            referral_code: userReferralCode,
            referred_by: referredBy,
            updated_at: new Date().toISOString()
          })
          .eq('id', data.user.id);

        if (profileError) {
          console.error('❌ Failed to update profile with referral code:', profileError);
        } else {
          console.log('✅ Profile updated with referral code:', userReferralCode);
          if (referredBy) {
            console.log('✅ User attributed to referrer:', referredBy);
          }
        }

        // If user was referred, process with points system
        if (referredBy) {
          try {
            const PointsService = (await import('../services/pointsService')).default;
            const pointsService = PointsService.getInstance();
            
            const success = await pointsService.processReferralSignup(data.user.id, referredBy);
            if (success) {
              console.log('✅ Email user referral processed - 2,500 points awarded');
            } else {
              console.log('❌ Invalid referral code for email user');
            }
          } catch (error) {
            console.error('❌ Error processing email user referral:', error);
          }
        }

        // Track signup with AppsFlyer for attribution
        try {
          await appsFlyerService.trackSignup('email');
          console.log('📊 AppsFlyer signup event tracked');
        } catch (error) {
          console.error('❌ Failed to track signup with AppsFlyer:', error);
        }
        
        // Store user ID and show preferences modal first
        setCurrentUserId(data.user.id);
        setShowPreferencesModal(true);
      } else {
        console.log('⚠️ No user data returned');
        Alert.alert('Signup Warning', 'Account may have been created but no user data returned.');
      }
    } catch (error: any) {
      console.log('💥 Caught error in signup process:', error);
      console.log('💥 Error message:', error?.message);
      console.log('💥 Error stack:', error?.stack);
      Alert.alert('Signup Error', error.message || 'Unknown error occurred');
    } finally {
      console.log('🔄 Finally block - setting loading to false');
      setLoading(false);
      console.log('🏁 Signup process complete');
    }
  };

  const openTermsModal = () => {
    setShowTermsModal(true);
  };

  const closeTermsModal = () => {
    setShowTermsModal(false);
  };

  return (
    <LinearGradient
      colors={['#1a2a6c', '#b21f1f']}
      style={styles.gradientContainer}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 25}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          scrollEnabled={true}
          bounces={true}
        >
          <Pressable onPress={Keyboard.dismiss} style={styles.pressableContent}>
          <View style={styles.content}>
            <Text style={styles.title}>Create Your Account</Text>
            <Text style={styles.subtitle}>Join the Predictive Play Revolution!</Text>

            <View style={styles.form}>
              {/* Google Sign Up Button - Show above Apple */}
              <View style={styles.googleButtonContainer}>
                <TouchableOpacity
                  style={[styles.googleButton, loading && styles.buttonDisabled]}
                  onPress={handleGoogleSignUp}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    <Image
                      source={{ uri: 'https://developers.google.com/identity/images/g-logo.png' }}
                      style={styles.googleIcon}
                    />
                    <Text style={styles.googleButtonText}>
                      {loading ? 'Working…' : 'Sign up with Google'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Discord Sign Up Button */}
              <View style={styles.discordButtonContainer}>
                <TouchableOpacity
                  style={[styles.discordButton, loading && styles.buttonDisabled]}
                  onPress={async () => {
                    try {
                      if (!agreeToTerms) {
                        Alert.alert('Terms Required', 'You must agree to the Terms of Service to create an account');
                        return;
                      }
                      setLoading(true);
                      const redirectTo = makeRedirectUri({ scheme: 'predictiveplay', preferLocalhost: false });
                      const { error } = await supabase.auth.signInWithOAuth({
                        provider: 'discord',
                        options: { redirectTo, scopes: 'identify email' },
                      });
                      if (error) throw error;
                    } catch (err: any) {
                      console.error('Discord Sign Up error:', err);
                      Alert.alert('Sign Up Error', 'Failed to sign up with Discord. Please try again.');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    <FontAwesome5 name="discord" size={20} color="#5865F2" style={styles.discordIcon} />
                    <Text style={styles.discordButtonText}>
                      {loading ? 'Working…' : 'Sign up with Discord'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Apple Sign Up Button - Show next for better UX */}
              {isAppleAuthAvailable && (
                <View style={styles.appleButtonContainer}>
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                    cornerRadius={30}
                    style={styles.appleButton}
                    onPress={handleAppleSignUp}
                  />
                  
                  <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>OR</Text>
                    <View style={styles.dividerLine} />
                  </View>
                </View>
              )}

              {/* Username Input */}
              <View style={styles.inputContainer}>
                <View style={usernameInputWrapperStyle}>
                  <User color="#e0e0e0" size={20} />
                  <TextInput
                    style={styles.input}
                    placeholder="Choose a username"
                    placeholderTextColor="#cccccc"
                    value={username}
                    onChangeText={handleUsernameChange}
                    onFocus={handleUsernameFocus}
                    onBlur={handleUsernameBlur}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="next"
                    selectionColor="#FFD700"
                    maxLength={20}
                    autoComplete="username"
                    textContentType="username"
                  />
                </View>
                {username.length > 0 && username.length < 3 && (
                  <Text style={styles.errorText}>Username must be at least 3 characters</Text>
                )}
              </View>

              {/* Email Input */}
              <View style={styles.inputContainer}>
                <View style={emailInputWrapperStyle}>
                  <Mail color="#e0e0e0" size={20} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your email"
                    placeholderTextColor="#cccccc"
                    value={email}
                    onChangeText={handleEmailChange}
                    onFocus={handleEmailFocus}
                    onBlur={handleEmailBlur}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    returnKeyType="next"
                    selectionColor="#FFD700"
                    autoComplete="email"
                    textContentType="emailAddress"
                  />
                </View>
                {email.length > 0 && !isValidEmail && (
                  <Text style={styles.errorText}>Please enter a valid email address</Text>
                )}
              </View>

              {/* Password Input */}
              <View style={styles.inputContainer}>
                <View style={passwordInputWrapperStyle}>
                  <Lock color="#e0e0e0" size={20} />
                  <TextInput
                    style={styles.input}
                    placeholder="Create a password (min. 8 characters)"
                    placeholderTextColor="#cccccc"
                    value={password}
                    onChangeText={handlePasswordChange}
                    onFocus={handlePasswordFocus}
                    onBlur={handlePasswordBlur}
                    secureTextEntry={!showPassword}
                    returnKeyType="next"
                    selectionColor="#FFD700"
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={togglePasswordVisibility}
                    style={styles.passwordToggle}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.6}
                  >
                    {showPassword ? (
                      <EyeOff color="#e0e0e0" size={20} />
                    ) : (
                      <Eye color="#e0e0e0" size={20} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm Password Input */}
              <View style={styles.inputContainer}>
                <View style={confirmPasswordInputWrapperStyle}>
                  <Lock color="#e0e0e0" size={20} />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm your password"
                    placeholderTextColor="#cccccc"
                    value={confirmPassword}
                    onChangeText={handleConfirmPasswordChange}
                    onFocus={handleConfirmPasswordFocus}
                    onBlur={handleConfirmPasswordBlur}
                    secureTextEntry={!showConfirmPassword}
                    returnKeyType="done"
                    onSubmitEditing={handleSignup}
                    selectionColor="#FFD700"
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={toggleConfirmPasswordVisibility}
                    style={styles.passwordToggle}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    activeOpacity={0.6}
                  >
                    {showConfirmPassword ? (
                      <EyeOff color="#e0e0e0" size={20} />
                    ) : (
                      <Eye color="#e0e0e0" size={20} />
                    )}
                  </TouchableOpacity>
                </View>
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <Text style={styles.errorText}>Passwords do not match</Text>
                )}
              </View>

              {/* Referral Code Input (Optional) */}
              <View style={styles.inputContainer}>
                <View style={referralCodeInputWrapperStyle}>
                  <UserPlus color="#e0e0e0" size={20} />
                  <TextInput
                    style={styles.input}
                    placeholder="Referral code (optional)"
                    placeholderTextColor="#cccccc"
                    value={referralCode}
                    onChangeText={handleReferralCodeChange}
                    onFocus={handleReferralCodeFocus}
                    onBlur={handleReferralCodeBlur}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    returnKeyType="done"
                    selectionColor="#FFD700"
                    maxLength={10}
                  />
                </View>
                {referralCode.length > 0 && !isValidReferralCode && (
                  <Text style={styles.errorText}>Referral code should be 6-10 characters</Text>
                )}
                {referralCode.length > 0 && isValidReferralCode && (
                  <Text style={styles.successText}>✓ Referral code looks good!</Text>
                )}
              </View>

              {/* Terms of Service Agreement */}
              <View style={styles.termsContainer}>
                <TouchableOpacity 
                  style={styles.checkboxContainer} 
                  onPress={toggleTermsAgreement}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {agreeToTerms ? (
                    <CheckSquare size={24} color="#4169e1" />
                  ) : (
                    <Square size={24} color="#e0e0e0" />
                  )}
                </TouchableOpacity>
                
                <View style={styles.termsTextContainer}>
                  <Text style={styles.termsText}>
                    I have read and agree to the{' '}
                    <TouchableOpacity onPress={openTermsModal} activeOpacity={0.7} style={styles.termsLinkTouchable}>
                      <Text style={styles.termsLink}>Terms of Service</Text>
                    </TouchableOpacity>
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.button, 
                  (loading || !agreeToTerms) && styles.buttonDisabled
                ]}
                onPress={handleSignup}
                disabled={loading || !agreeToTerms}
                activeOpacity={0.8}
              >
                <UserPlus color="#000000" size={20} style={styles.buttonIcon} />
                <Text style={styles.buttonText}>
                  {loading ? 'Creating Account...' : 'Create Account'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account?</Text>
              <Link href="/login" asChild>
                <TouchableOpacity activeOpacity={0.7}>
                  <Text style={styles.footerLink}>Sign In</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <TermsOfServiceModal visible={showTermsModal} onClose={closeTermsModal} />

      
      <UserPreferencesModal 
        visible={showPreferencesModal} 
        onClose={() => {
          setShowPreferencesModal(false);
          // Show subscription modal after preferences
          setShowSubscriptionModal(true);
        }}
        onPreferencesUpdated={(preferences) => {
          console.log('✅ User preferences updated:', preferences);
          setShowPreferencesModal(false);
          // Show subscription modal after preferences
          setShowSubscriptionModal(true);
        }}
      />
      
      <TieredSignupSubscriptionModal
        visible={showSubscriptionModal}
        onClose={() => {
          setShowSubscriptionModal(false);
          // If user is Pro or Elite (including day passes), skip welcome wheel
          // The subscription context will have updated isPro/isElite after successful purchase
          if (isPro || isElite || hasPurchasedSubscription) {
            console.log('🎯 User has subscription - navigating to app. isPro:', isPro, 'isElite:', isElite, 'hasPurchasedSubscription:', hasPurchasedSubscription);
            router.replace('/(tabs)');
          } else {
            console.log('🎯 User has no subscription - showing welcome wheel. isPro:', isPro, 'isElite:', isElite, 'hasPurchasedSubscription:', hasPurchasedSubscription);
            setShowSpinningWheel(true);
          }
        }}
        onSubscribe={handleSubscribe}
        onContinueFree={handleContinueFree}
        onPurchaseSuccess={() => {
          console.log('🎉 Purchase successful (Pro/Elite) - navigating directly to app without wheel');
          setShowSubscriptionModal(false);
          setHasPurchasedSubscription(true);
          router.replace('/(tabs)');
        }}
      />

      {/* Spinning Wheel Modal */}
      <SimpleSpinningWheel
        visible={showSpinningWheel}
        onClose={handleSpinningWheelClose}
        onComplete={handleSpinningWheelComplete}
      />

      {/* Terms of Service Modal */}
      <TermsOfServiceModal
        visible={showTermsModal}
        onClose={closeTermsModal}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: Platform.OS === 'ios' ? normalize(60) : normalize(40),
    paddingBottom: normalize(40),
  },
  pressableContent: {
    minHeight: Dimensions.get('window').height - normalize(100),
    justifyContent: 'center',
  },
  content: {
    padding: normalize(25),
    justifyContent: 'center',
    maxWidth: isTablet ? 500 : '100%',
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    fontSize: normalize(32),
    fontWeight: 'bold',
    marginBottom: normalize(10),
    color: '#ffffff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: normalize(18),
    color: '#e0e0e0',
    marginBottom: normalize(32),
    textAlign: 'center',
  },
  form: {
    marginBottom: normalize(20),
  },
  inputContainer: {
    marginBottom: normalize(16),
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: normalize(15),
    paddingHorizontal: normalize(20),
    paddingVertical: normalize(18),
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    minHeight: isTablet ? 70 : 60,
  },
  inputWrapperFocused: {
    borderColor: '#00E5FF',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: isTablet ? 18 : 16,
    marginLeft: 15,
    paddingVertical: 0,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  googleButtonContainer: {
    marginBottom: normalize(12),
  },
  googleButton: {
    width: '100%',
    height: isTablet ? 60 : 50,
    backgroundColor: '#FFFFFF',
    borderRadius: normalize(30),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dadce0',
    shadowColor: '#000',
    shadowOpacity: Platform.OS === 'ios' ? 0.1 : 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  googleButtonText: {
    color: '#3c4043',
    fontWeight: '700',
    fontSize: isTablet ? 18 : 16,
  },
  googleIcon: {
    width: 18,
    height: 18,
    marginRight: 10,
    resizeMode: 'contain',
  },
  discordButtonContainer: {
    marginBottom: normalize(12),
  },
  discordButton: {
    width: '100%',
    height: isTablet ? 60 : 50,
    backgroundColor: '#FFFFFF',
    borderRadius: normalize(30),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dadce0',
    shadowColor: '#000',
    shadowOpacity: Platform.OS === 'ios' ? 0.1 : 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  discordButtonText: {
    color: '#3c4043',
    fontWeight: '700',
    fontSize: isTablet ? 18 : 16,
  },
  discordIcon: {
    marginRight: 10,
  },
  // Generic primary button used for email signup submit
  button: {
    backgroundColor: '#4169e1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: isTablet ? 20 : 16,
    borderRadius: 30,
    marginTop: 20,
    shadowColor: '#4169e1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonIcon: {
    marginRight: normalize(10),
  },
  buttonText: {
    color: '#ffffff',
    fontSize: isTablet ? 20 : 18,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto-Bold',
  },
  errorText: {
    color: '#fecaca',
    marginTop: normalize(6),
    fontSize: normalize(13),
  },
  successText: {
    color: '#bbf7d0',
    marginTop: normalize(6),
    fontSize: normalize(13),
  },
  passwordToggle: {
    padding: normalize(5),
    marginLeft: normalize(10),
  },
  // Terms / footer
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: normalize(16),
    marginBottom: normalize(16),
    paddingHorizontal: normalize(4),
  },
  checkboxContainer: {
    marginRight: normalize(12),
    marginTop: normalize(2),
  },
  termsTextContainer: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  termsText: {
    color: '#e0e0e0',
    fontSize: normalize(14),
    lineHeight: normalize(20),
    flexWrap: 'wrap',
  },
  termsLinkTouchable: {
    marginLeft: 0,
  },
  termsLink: {
    color: '#00E5FF',
    fontSize: normalize(14),
    fontWeight: 'bold',
    textDecorationLine: 'underline',
    lineHeight: normalize(20),
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: normalize(20),
  },
  footerText: {
    color: '#e0e0e0',
    fontSize: isTablet ? 18 : 16,
  },
  footerLink: {
    color: '#00E5FF',
    fontSize: isTablet ? 18 : 16,
    fontWeight: 'bold',
    textDecorationLine: 'underline',
    marginLeft: normalize(6),
  },
  appleButton: {
    width: '100%',
    height: isTablet ? 60 : 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: normalize(30),
    marginTop: normalize(10),
  },
  appleButtonContainer: {
    marginBottom: normalize(20),
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: normalize(20),
    paddingHorizontal: normalize(10),
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  dividerText: {
    marginHorizontal: normalize(10),
    color: '#e0e0e0',
    fontSize: normalize(16),
  },
}); 