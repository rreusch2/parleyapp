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
  TouchableWithoutFeedback,
} from 'react-native';
import { Link, useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/app/services/api/supabaseClient';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, Lock, User, CheckSquare, Square, UserPlus, Eye, EyeOff } from 'lucide-react-native';
import SimpleSpinningWheel from '@/app/components/SimpleSpinningWheel';
import TermsOfServiceModal from '@/app/components/TermsOfServiceModal';
import SignupSubscriptionModal from '@/app/components/SignupSubscriptionModal';
import { useSubscription } from '@/app/services/subscriptionContext';
import * as AppleAuthentication from 'expo-apple-authentication';

export default function SignupScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showSpinningWheel, setShowSpinningWheel] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [hasSubscribedToPro, setHasSubscribedToPro] = useState(false);
  const [isAppleAuthAvailable, setIsAppleAuthAvailable] = useState(false);
  
  // Focus states for better UX
  const [usernameFocused, setUsernameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);
  
  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const router = useRouter();
  const params = useLocalSearchParams();
  const { checkSubscriptionStatus } = useSubscription();

  // Check if Apple Auth is available on mount
  React.useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setIsAppleAuthAvailable);
    
    // Check if user was redirected from login after Apple Sign In
    if (params.appleSignInComplete === 'true' && params.userId) {
      console.log('User redirected from Apple Sign In, showing subscription modal');
      // Automatically agree to terms since they already authenticated
      setAgreeToTerms(true);
      // Show subscription modal immediately
      setShowSubscriptionModal(true);
    }
  }, [params]);

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

  // Validation states
  const isValidEmail = useMemo(() => {
    if (!email) return true; // Don't show error for empty email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }, [email]);

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
            updated_at: new Date().toISOString()
          })
          .eq('id', userData.user.id);

        if (updateError) {
          console.error('❌ Failed to activate welcome bonus:', updateError);
          console.error('❌ Error details:', JSON.stringify(updateError, null, 2));
        } else {
          console.log(`✅ Welcome bonus activated! User stays FREE tier with ${picks} picks until ${expiration.toISOString()}`);
          
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

  const handleSpinningWheelClose = () => {
    console.log('🎯 Spinning wheel closed, navigating to main app...');
    router.replace('/(tabs)');
  };

  const handleSubscribe = async (planId: 'monthly' | 'yearly' | 'lifetime') => {
    try {
      console.log(`🚀 User attempting to subscribe to ${planId} plan`);
      setLoading(true);

      // Use RevenueCat for purchase processing
      const revenueCatService = (await import('@/app/services/revenueCatService')).default;
      
      console.log('🔄 Processing subscription with RevenueCat...');
      
      // Add debug logging for yearly subscriptions
      if (planId === 'yearly') {
        console.log('🔍 DEBUG: Yearly subscription detected, running debug check...');
        await revenueCatService.debugSubscriptionStatus();
      }
      
      const result = await revenueCatService.purchasePackage(planId);
      
      if (result.success) {
        console.log('✅ User successfully subscribed to Pro!');
        setHasSubscribedToPro(true); // Mark that user has subscribed
        
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
    setShowSubscriptionModal(false);
    setShowSpinningWheel(true);
  };

  const handleSubscriptionModalClose = () => {
    // Only show spinning wheel if user hasn't subscribed to Pro
    if (!hasSubscribedToPro) {
      setShowSubscriptionModal(false);
      setShowSpinningWheel(true);
    } else {
      // If user subscribed to Pro, just close modal and navigate
      setShowSubscriptionModal(false);
    }
  };

  const handleAppleSignUp = async () => {
    if (!agreeToTerms) {
      Alert.alert('Terms Required', 'You must agree to the Terms of Service to create an account');
      return;
    }

    try {
      setLoading(true);
      
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (credential.identityToken) {
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: credential.identityToken,
          nonce: credential.authorizationCode ? 'nonce' : undefined,
        });

        if (error) throw error;

        if (data.user) {
          // For new sign ups, Apple provides the name and email
          const fullName = credential.fullName;
          const displayName = [fullName?.givenName, fullName?.familyName]
            .filter(Boolean)
            .join(' ') || credential.email?.split('@')[0] || 'AppleUser';

          // Update the user's profile with their name
          await supabase
            .from('profiles')
            .update({
              username: displayName,
              email: credential.email || data.user.email,
            })
            .eq('id', data.user.id);

          console.log('✅ Apple Sign Up successful! User ID:', data.user.id);
          
          // Show the subscription modal first, then spinning wheel or main app
          setShowSubscriptionModal(true);
        }
      }
    } catch (error: any) {
      if (error.code === 'ERR_REQUEST_CANCELED') {
        // User canceled the sign-in
        console.log('User canceled Apple Sign Up');
      } else {
        Alert.alert('Sign Up Error', 'Failed to sign up with Apple. Please try again.');
        console.error('Apple Sign Up error:', error);
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
            username: username,
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
        console.log('🎯 About to show subscription modal...');
        
        // Show the subscription modal first, then spinning wheel or main app
        setShowSubscriptionModal(true);
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
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
          <View style={styles.content}>
            <Text style={styles.title}>Create Your Account</Text>
            <Text style={styles.subtitle}>Join the Predictive Play Revolution!</Text>

            <View style={styles.form}>
              {/* Apple Sign Up Button - Show first for better UX */}
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
                    autoComplete="new-password"
                    textContentType="newPassword"
                    autoCorrect={false}
                    autoCapitalize="none"
                    keyboardType="default"
                    blurOnSubmit={false}
                    enablesReturnKeyAutomatically={false}
                    clearButtonMode="never"
                    spellCheck={false}
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
                    autoComplete="new-password"
                    textContentType="newPassword"
                    autoCorrect={false}
                    autoCapitalize="none"
                    keyboardType="default"
                    blurOnSubmit={false}
                    enablesReturnKeyAutomatically={false}
                    clearButtonMode="never"
                    spellCheck={false}
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
                  </Text>
                  <TouchableOpacity onPress={openTermsModal} activeOpacity={0.7}>
                    <Text style={styles.termsLink}>Terms of Service</Text>
                  </TouchableOpacity>
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
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* Subscription Modal */}
      <SignupSubscriptionModal
        visible={showSubscriptionModal}
        onClose={handleSubscriptionModalClose}
        onSubscribe={handleSubscribe}
        onContinueFree={handleContinueFree}
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
    justifyContent: 'center',
  },
  content: {
    padding: 25,
    justifyContent: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#ffffff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#e0e0e0',
    marginBottom: 40,
    textAlign: 'center',
  },
  form: {
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    minHeight: 60,
  },
  inputWrapperFocused: {
    borderColor: '#00E5FF',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    marginLeft: 15,
    paddingVertical: 0,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  passwordToggle: {
    padding: 5,
    marginLeft: 10,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginTop: 5,
    marginLeft: 5,
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  checkboxContainer: {
    marginRight: 12,
    marginTop: 2,
  },
  termsTextContainer: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  termsText: {
    fontSize: 15,
    color: '#e0e0e0',
    lineHeight: 22,
  },
  termsLink: {
    fontSize: 15,
    color: '#4169e1',
    fontWeight: '600',
    textDecorationLine: 'underline',
    lineHeight: 22,
  },
  button: {
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 30,
    marginTop: 20,
    shadowColor: '#ffffff',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonIcon: {
    marginRight: 10,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: 'black',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto-Bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    color: '#e0e0e0',
    marginRight: 5,
    fontSize: 15,
  },
  footerLink: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  appleButtonContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  appleButton: {
    width: '100%',
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 30,
    marginBottom: 15,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#e0e0e0',
    fontSize: 16,
  },
}); 