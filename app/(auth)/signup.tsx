import React, { useState } from 'react';
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
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { supabase } from '@/app/services/api/supabaseClient';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, Lock, User, CheckSquare, Square, UserPlus } from 'lucide-react-native';
import SimpleSpinningWheel from '@/app/components/SimpleSpinningWheel';
import TermsOfServiceModal from '@/app/components/TermsOfServiceModal';
import SignupSubscriptionModal from '@/app/components/SignupSubscriptionModal';

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
  const router = useRouter();

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
        
        // Update user profile to activate welcome bonus
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            welcome_bonus_claimed: true,
            welcome_bonus_expires_at: expiration.toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', userData.user.id);

        if (updateError) {
          console.error('❌ Failed to activate welcome bonus:', updateError);
          console.error('❌ Error details:', JSON.stringify(updateError, null, 2));
        } else {
          console.log(`✅ Welcome bonus activated! User gets ${picks} picks until ${expiration.toISOString()}`);
          
          // Verify the update worked
          const { data: verifyProfile, error: verifyError } = await supabase
            .from('profiles')
            .select('welcome_bonus_claimed, welcome_bonus_expires_at')
            .eq('id', userData.user.id)
            .single();
            
          if (!verifyError && verifyProfile) {
            console.log(`✅ Verification: bonus_claimed=${verifyProfile.welcome_bonus_claimed}, expires_at=${verifyProfile.welcome_bonus_expires_at}`);
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

      // Import payment service dynamically to avoid loading issues
      const { applePaymentService } = await import('@/app/services/paymentService');
      
      // For demo purposes, we'll simulate a successful subscription
      // In production, this would process the actual payment
      if (__DEV__) {
        console.log('🔧 Development mode: simulating subscription success');
        
        // Update user profile to Pro status in Supabase
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ 
              subscription_tier: 'pro', // Set to 'pro' for all paid plans
              updated_at: new Date().toISOString()
            })
            .eq('id', userData.user.id);

          if (updateError) {
            console.error('❌ Failed to update user profile:', updateError);
            throw new Error('Failed to update subscription status');
          }
        }

        Alert.alert(
          '🎉 Welcome to Pro!',
          `You've successfully subscribed to ${planId} plan. Welcome to the premium experience!`,
          [{ 
            text: 'Let\'s Go!', 
            onPress: () => {
              setShowSubscriptionModal(false);
              router.replace('/(tabs)');
            }
          }]
        );
      } else {
        // Production: Process actual payment
        const { data: userData } = await supabase.auth.getUser();
        const result = await applePaymentService.purchaseSubscription(planId, userData.user?.id || '');
        
        if (result.success) {
          setShowSubscriptionModal(false);
          router.replace('/(tabs)');
        } else {
          throw new Error(result.error || 'Subscription failed');
        }
      }
    } catch (error: any) {
      console.error('❌ Subscription error:', error);
      Alert.alert(
        'Subscription Error',
        error.message || 'Failed to process subscription. Please try again.',
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
    setShowSubscriptionModal(false);
    setShowSpinningWheel(true);
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

    if (password !== confirmPassword) {
      console.log('❌ Validation failed: Passwords do not match');
      Alert.alert('Signup Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      console.log('❌ Validation failed: Password too short');
      Alert.alert('Signup Error', 'Password must be at least 6 characters long');
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

  const toggleTermsAgreement = () => {
    setAgreeToTerms(!agreeToTerms);
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
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <Text style={styles.title}>Create Your Account</Text>
            <Text style={styles.subtitle}>Join the Predictive Play Revolution!</Text>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                  <User color={styles.inputIcon.color} size={20} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Choose a username"
                    placeholderTextColor={styles.placeholderText.color}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    selectionColor={styles.inputSelectionColor.color}
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                  <Mail color={styles.inputIcon.color} size={20} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your email"
                    placeholderTextColor={styles.placeholderText.color}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    selectionColor={styles.inputSelectionColor.color}
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                  <Lock color={styles.inputIcon.color} size={20} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Create a password (min. 6 characters)"
                    placeholderTextColor={styles.placeholderText.color}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    selectionColor={styles.inputSelectionColor.color}
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <View style={styles.inputWrapper}>
                  <Lock color={styles.inputIcon.color} size={20} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm your password"
                    placeholderTextColor={styles.placeholderText.color}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    selectionColor={styles.inputSelectionColor.color}
                  />
                </View>
              </View>

              {/* Terms of Service Agreement */}
              <View style={styles.termsContainer}>
                <TouchableOpacity 
                  style={styles.checkboxContainer} 
                  onPress={toggleTermsAgreement}
                  activeOpacity={0.7}
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
                activeOpacity={0.7}
              >
                <UserPlus color={styles.buttonText.color} size={20} style={styles.buttonIcon} />
                <Text style={styles.buttonText}>
                  {loading ? 'Creating Account...' : 'Create Account'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account?</Text>
              <Link href="/login" asChild>
                <TouchableOpacity>
                  <Text style={styles.footerLink}>Sign In</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
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
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 15,
  },
  inputIcon: {
    marginRight: 10,
    color: '#e0e0e0',
  },
  input: {
    flex: 1,
    paddingVertical: 15,
    fontSize: 16,
    color: '#ffffff',
  },
  inputSelectionColor: {
    color: '#4169e1',
  },
  placeholderText: {
    color: '#cccccc',
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
    paddingVertical: 15,
    borderRadius: 30,
    marginTop: 20,
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
}); 