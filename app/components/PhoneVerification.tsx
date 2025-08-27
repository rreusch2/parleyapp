import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Phone, X, ArrowLeft } from 'lucide-react-native';
import { supabase, supabaseConfig } from '../services/api/supabaseClient';
import { normalize } from '../services/device';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import EnhancedFraudPreventionService from '../services/enhancedFraudPreventionService';

interface PhoneVerificationProps {
  onVerificationComplete: (phoneNumber: string) => void;
  onClose: () => void;
}

export default function PhoneVerification({ 
  onVerificationComplete, 
  onClose 
}: PhoneVerificationProps) {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [wasLoggedInWhenCodeSent, setWasLoggedInWhenCodeSent] = useState(false);
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const keyboardOffset = Platform.OS === 'ios' ? insets.top + normalize(80) : 20;

  // Format phone number as user types
  const formatPhoneNumber = (input: string) => {
    const cleaned = input.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
    if (match) {
      return !match[2] ? match[1] : `(${match[1]}) ${match[2]}${match[3] ? `-${match[3]}` : ''}`;
    }
    return input;
  };

  const handlePhoneChange = (input: string) => {
    const formatted = formatPhoneNumber(input);
    setPhoneNumber(formatted);
  };

  // Convert formatted phone to E.164 format
  const toE164Format = (formattedPhone: string) => {
    const cleaned = formattedPhone.replace(/\D/g, '');
    return cleaned.length === 10 ? `+1${cleaned}` : `+${cleaned}`;
  };

  const validatePhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length === 10 || cleaned.length === 11;
  };

  const sendVerificationCode = async () => {
    console.log('🔥 DEBUG: sendVerificationCode called');
    console.log('🔥 DEBUG: phoneNumber:', phoneNumber);
    if (!supabaseConfig.isConfigured) {
      console.log('❌ DEBUG: Supabase not configured at runtime');
      Alert.alert(
        'Configuration Error',
        'Supabase is not configured. Please ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set and the app has been rebuilt.'
      );
      return;
    }
    
    if (!validatePhoneNumber(phoneNumber)) {
      console.log('❌ DEBUG: Phone validation failed');
      Alert.alert('Invalid Phone', 'Please enter a valid phone number');
      return;
    }

    setLoading(true);
    try {
      const e164Phone = toE164Format(phoneNumber);
      console.log('🔥 DEBUG: e164Phone:', e164Phone);

      // If user is logged in, use updateUser to initiate phone change; otherwise use signInWithOtp
      const { data: sessionData } = await supabase.auth.getUser();
      // Track whether the user was logged in when we initiated the code
      setWasLoggedInWhenCodeSent(!!sessionData.user);
      console.log('🔥 DEBUG: sessionData:', sessionData.user ? 'User logged in' : 'No user session');
      
      // Uniqueness check before sending OTP
      const isUnique = await EnhancedFraudPreventionService.getInstance().validatePhoneNumberUnique(
        e164Phone,
        sessionData.user?.id || ''
      );
      if (!isUnique) {
        console.log('❌ DEBUG: Phone number already used by another verified account');
        Alert.alert('Phone number already used', 'This phone number is already associated with another account.');
        setLoading(false);
        return;
      }
      
      let error: any = null;
      let response: any = null;
      
      if (sessionData.user) {
        console.log('🔥 DEBUG: Using updateUser method');
        const result = await supabase.auth.updateUser({ phone: e164Phone });
        error = result.error;
        response = result;
      } else {
        console.log('🔥 DEBUG: Using signInWithOtp method');
        const result = await supabase.auth.signInWithOtp({ phone: e164Phone });
        error = result.error;
        response = result;
      }

      console.log('🔥 DEBUG: Supabase response:', response);
      console.log('🔥 DEBUG: Supabase error:', error);

      if (error) {
        console.log('❌ DEBUG: SMS send failed with error:', error);
        
        if (error.message.includes('rate limit')) {
          Alert.alert('Too Many Attempts', 'Please wait before requesting another code');
        } else if (error.message.includes('Invalid phone')) {
          Alert.alert('Invalid Phone', 'Please enter a valid phone number with country code');
        } else if (error.message.includes('Phone provider not configured')) {
          Alert.alert('SMS Not Configured', 'SMS verification is not properly set up. Please contact support.');
        } else {
          Alert.alert('Error', `SMS Error: ${error.message}`);
        }
        throw error;
      }

      console.log('✅ DEBUG: SMS sent successfully, switching to code step');
      setStep('code');
      setResendTimer(60); // 60 second cooldown
      Alert.alert('Code Sent', `Verification code sent to ${phoneNumber}`);
      
    } catch (error: any) {
      console.error('❌ DEBUG: Exception in sendVerificationCode:', error);
      Alert.alert('Error', `Failed to send verification code: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (verificationCode.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter the 6-digit code');
      return;
    }

    setLoading(true);
    try {
      if (!supabaseConfig.isConfigured) {
        console.log('❌ DEBUG: Supabase not configured at runtime (verify)');
        Alert.alert(
          'Configuration Error',
          'Supabase is not configured. Please ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set and the app has been rebuilt.'
        );
        return;
      }
      const e164Phone = toE164Format(phoneNumber);

      // Use the correct verification type based on whether this was a phone change or a sign-in OTP
      const verificationType: 'sms' | 'phone_change' = wasLoggedInWhenCodeSent ? 'phone_change' : 'sms';

      const { data, error } = await supabase.auth.verifyOtp({
        phone: e164Phone,
        token: verificationCode,
        type: verificationType,
      });

      if (error) {
        if (error.message.includes('invalid')) {
          Alert.alert('Invalid Code', 'The verification code is incorrect');
        } else if (error.message.includes('expired')) {
          Alert.alert('Code Expired', 'The verification code has expired. Please request a new one.');
          setStep('phone');
        } else {
          Alert.alert('Error', error.message);
        }
        throw error;
      }

      // If we verified without being logged in (pre-signup flow), sign out to avoid creating a phone-only account
      if (!wasLoggedInWhenCodeSent) {
        await supabase.auth.signOut();
      }

      onVerificationComplete(e164Phone);
      
    } catch (error: any) {
      console.error('Error verifying code:', error);
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (resendTimer > 0) return;
    await sendVerificationCode();
  };

  // Countdown timer for resend
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // Track keyboard height to keep content above the keyboard (especially on iOS)
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvt, (e) => {
      setKeyboardHeight(e.endCoordinates?.height || 0);
    });
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardHeight(0));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  if (step === 'phone') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <LinearGradient
          colors={['#1a1a2e', '#16213e', '#0f3460']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.innerContainer}>
              <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <X size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <Text style={styles.title}>Verify Phone Number</Text>
                <View style={styles.placeholder} />
              </View>

              <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardAvoidingContainer}
                keyboardVerticalOffset={keyboardOffset}
              >
                <ScrollView 
                  contentContainerStyle={[
                    styles.scrollContent,
                    { paddingBottom: normalize(50) + (Platform.OS === 'ios' ? keyboardHeight : 0) }
                  ]}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                  contentInset={{ bottom: Platform.OS === 'ios' ? keyboardHeight : 0 }}
                  scrollIndicatorInsets={{ bottom: Platform.OS === 'ios' ? keyboardHeight : 0 }}
                  keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                >
                  <View style={styles.content}>
                    <Text style={styles.subtitle}>
                      We'll send you a verification code to prevent multiple accounts
                    </Text>

                    <View style={styles.inputWrapper}>
                      <Phone size={20} color="#00E5FF" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="(555) 123-4567"
                        placeholderTextColor="rgba(255, 255, 255, 0.5)"
                        value={phoneNumber}
                        onChangeText={handlePhoneChange}
                        keyboardType="phone-pad"
                        maxLength={14}
                        autoFocus
                        returnKeyType="done"
                        onSubmitEditing={() => {
                          if (validatePhoneNumber(phoneNumber)) {
                            sendVerificationCode();
                          }
                        }}
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.sendButton, !validatePhoneNumber(phoneNumber) && styles.sendButtonDisabled]}
                      onPress={sendVerificationCode}
                      disabled={!validatePhoneNumber(phoneNumber) || loading}
                    >
                      {loading ? (
                        <ActivityIndicator color="#000000" />
                      ) : (
                        <Text style={styles.sendButtonText}>Send Verification Code</Text>
                      )}
                    </TouchableOpacity>

                    <Text style={styles.disclaimer}>
                      By continuing, you agree that this phone number hasn't been used for a free trial before. 
                      Standard message rates may apply.
                    </Text>
                  </View>
                </ScrollView>
              </KeyboardAvoidingView>
            </View>
          </TouchableWithoutFeedback>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#1a1a2e', '#16213e', '#0f3460']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.innerContainer}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => setStep('phone')} style={styles.backButton}>
                <ArrowLeft size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.title}>Enter Verification Code</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.keyboardAvoidingContainer}
              keyboardVerticalOffset={keyboardOffset}
            >
              <ScrollView 
                contentContainerStyle={[
                  styles.scrollContent,
                  { paddingBottom: normalize(50) + (Platform.OS === 'ios' ? keyboardHeight : 0) }
                ]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
                contentInset={{ bottom: Platform.OS === 'ios' ? keyboardHeight : 0 }}
                scrollIndicatorInsets={{ bottom: Platform.OS === 'ios' ? keyboardHeight : 0 }}
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              >
                <View style={styles.content}>
                  <Text style={styles.subtitle}>
                    Enter the 6-digit code sent to{'\n'}{phoneNumber}
                  </Text>

                  <View style={styles.codeInputWrapper}>
                    <TextInput
                      style={styles.codeInput}
                      placeholder="123456"
                      placeholderTextColor="rgba(255, 255, 255, 0.5)"
                      value={verificationCode}
                      onChangeText={setVerificationCode}
                      keyboardType="number-pad"
                      maxLength={6}
                      autoFocus
                      textAlign="center"
                      returnKeyType="done"
                      onSubmitEditing={() => {
                        if (verificationCode.length === 6) {
                          verifyCode();
                        }
                      }}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.verifyButton, verificationCode.length !== 6 && styles.verifyButtonDisabled]}
                    onPress={verifyCode}
                    disabled={verificationCode.length !== 6 || loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#000000" />
                    ) : (
                      <Text style={styles.verifyButtonText}>Verify Code</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.resendButton, resendTimer > 0 && styles.resendButtonDisabled]}
                    onPress={resendCode}
                    disabled={resendTimer > 0 || loading}
                  >
                    <Text style={[styles.resendButtonText, resendTimer > 0 && styles.resendButtonTextDisabled]}>
                      {resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Resend code'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    minHeight: Dimensions.get('window').height * 0.6,
    justifyContent: 'center',
    paddingBottom: normalize(50), // Extra padding for keyboard
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: normalize(20),
    paddingTop: normalize(60),
    paddingBottom: normalize(20),
  },
  backButton: {
    padding: normalize(5),
  },
  closeButton: {
    padding: normalize(5),
  },
  placeholder: {
    width: normalize(34), // Same width as close button for centering
  },
  title: {
    fontSize: normalize(20),
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: normalize(20),
    justifyContent: 'center',
    paddingBottom: normalize(60), // Increased bottom padding
    paddingTop: normalize(20), // Add top padding for better spacing
  },
  subtitle: {
    fontSize: normalize(16),
    color: '#e0e0e0',
    textAlign: 'center',
    marginBottom: normalize(40),
    lineHeight: normalize(24),
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
    marginBottom: normalize(30),
    minHeight: normalize(60),
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  inputIcon: {
    marginRight: normalize(15),
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: normalize(16),
    paddingVertical: 0,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  sendButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: normalize(30),
    height: normalize(50),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: normalize(20),
    shadowColor: '#ffffff',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    transform: [{ scale: 1 }],
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    shadowOpacity: 0,
    elevation: 0,
  },
  sendButtonText: {
    color: '#000000',
    fontSize: normalize(16),
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: normalize(12),
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: normalize(18),
    paddingHorizontal: normalize(10),
  },
  codeInputWrapper: {
    marginBottom: normalize(30),
  },
  codeInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: normalize(15),
    height: normalize(70),
    fontSize: normalize(24),
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 8,
    paddingHorizontal: normalize(20),
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  verifyButton: {
    backgroundColor: '#00E5FF',
    borderRadius: normalize(30),
    height: normalize(50),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: normalize(20),
    shadowColor: '#00E5FF',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    transform: [{ scale: 1 }],
  },
  verifyButtonDisabled: {
    backgroundColor: 'rgba(0, 229, 255, 0.3)',
    shadowOpacity: 0,
    elevation: 0,
  },
  verifyButtonText: {
    color: '#000000',
    fontSize: normalize(16),
    fontWeight: '600',
  },
  resendButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: normalize(40),
    paddingHorizontal: normalize(20),
  },
  resendButtonDisabled: {
    opacity: 0.5,
  },
  resendButtonText: {
    color: '#00E5FF',
    fontSize: normalize(14),
    fontWeight: '500',
  },
  resendButtonTextDisabled: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
});
