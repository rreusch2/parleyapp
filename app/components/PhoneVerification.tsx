import React, { useState, useEffect, useRef } from 'react';
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
  Keyboard,
  TouchableWithoutFeedback,
  Modal,
  Animated,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Phone, X, ArrowLeft, Shield, CheckCircle } from 'lucide-react-native';
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

  const handleClose = () => {
    onClose();
  };

  const renderPhoneStep = () => {
    return (
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <View style={styles.placeholder} />
          <Text style={styles.heroTitle}>Secure Your Account</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <X size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.heroSection}>
          <View style={styles.iconContainer}>
            <LinearGradient
              colors={['#00E5FF', '#0091EA']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconGradient}
            >
              <Shield size={32} color="#FFFFFF" />
            </LinearGradient>
          </View>
          <Text style={styles.heroSubtitle}>
            We'll send a verification code to prevent duplicate accounts and enhance security
          </Text>
        </View>

        <View style={styles.inputSection}>
          <View style={styles.inputContainer}>
            <View style={styles.inputIconWrapper}>
              <Phone size={20} color="#00E5FF" />
            </View>
            <TextInput
              style={styles.phoneInput}
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
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, !validatePhoneNumber(phoneNumber) && styles.primaryButtonDisabled]}
          onPress={sendVerificationCode}
          disabled={!validatePhoneNumber(phoneNumber) || loading}
        >
          {loading ? (
            <ActivityIndicator color="#000000" />
          ) : (
            <Text style={styles.primaryButtonText}>Send Verification Code</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.footerText}>
          By continuing, you agree that this phone number hasn't been used for a free trial before. 
          Standard message rates may apply.
        </Text>
      </View>
    );
  };

  const renderCodeStep = () => {
    return (
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setStep('phone')} style={styles.backButton}>
            <ArrowLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.heroTitle}>Enter Code</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <X size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.heroSection}>
          <View style={styles.iconContainer}>
            <LinearGradient
              colors={['#4CAF50', '#2E7D32']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconGradient}
            >
              <CheckCircle size={32} color="#FFFFFF" />
            </LinearGradient>
          </View>
          <Text style={styles.heroSubtitle}>
            Enter the 6-digit code sent to{' '}
            <Text style={styles.phoneHighlight}>{phoneNumber}</Text>
          </Text>
        </View>

        <View style={styles.codeContainer}>
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
          style={[styles.primaryButton, verificationCode.length !== 6 && styles.primaryButtonDisabled]}
          onPress={verifyCode}
          disabled={verificationCode.length !== 6 || loading}
        >
          {loading ? (
            <ActivityIndicator color="#000000" />
          ) : (
            <Text style={styles.primaryButtonText}>Verify Code</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, resendTimer > 0 && styles.secondaryButtonDisabled]}
          onPress={resendCode}
          disabled={resendTimer > 0 || loading}
        >
          <Text style={[styles.secondaryButtonText, resendTimer > 0 && styles.secondaryButtonTextDisabled]}>
            {resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Resend code'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>
          By continuing, you agree that this phone number hasn't been used for a free trial before. 
          Standard message rates may apply.
        </Text>
      </View>
    );
  };

  if (step === 'phone') {
    return (
      <Modal
        visible={true}
        transparent={true}
        animationType="none"
        onRequestClose={handleClose}
        statusBarTranslucent
      >
        <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.8)" translucent />
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <LinearGradient
              colors={['rgba(26,26,46,0.95)', 'rgba(22,33,62,0.95)', 'rgba(15,52,96,0.95)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.modalBackground}
            >
              <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardContainer}
              >
                {renderPhoneStep()}
              </KeyboardAvoidingView>
            </LinearGradient>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  }

  return (
    <Modal
      visible={true}
      transparent={true}
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" backgroundColor="rgba(0,0,0,0.8)" translucent />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.modalOverlay}>
          <LinearGradient
            colors={['rgba(26,26,46,0.95)', 'rgba(22,33,62,0.95)', 'rgba(15,52,96,0.95)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.modalBackground}
          >
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.keyboardContainer}
            >
              {renderCodeStep()}
            </KeyboardAvoidingView>
          </LinearGradient>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Modern Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackground: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: normalize(20),
  },
  modalContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: normalize(24),
    width: '100%',
    maxWidth: normalize(400),
    paddingHorizontal: normalize(24),
    paddingVertical: normalize(32),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: normalize(24),
  },
  backButton: {
    padding: normalize(8),
    borderRadius: normalize(12),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  closeButton: {
    padding: normalize(8),
    borderRadius: normalize(12),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  placeholder: {
    width: normalize(34), // Same width as close button for centering
  },
  
  // Hero Section
  heroSection: {
    alignItems: 'center',
    marginBottom: normalize(32),
  },
  iconContainer: {
    marginBottom: normalize(16),
  },
  iconGradient: {
    width: normalize(72),
    height: normalize(72),
    borderRadius: normalize(36),
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: normalize(24),
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: normalize(8),
  },
  heroSubtitle: {
    fontSize: normalize(16),
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: normalize(24),
  },
  phoneHighlight: {
    fontWeight: '600',
    color: '#00E5FF',
  },
  
  // Input Section
  inputSection: {
    marginBottom: normalize(24),
  },
  inputSectionKeyboard: {
    marginBottom: normalize(16),
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: normalize(16),
    marginBottom: normalize(20),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  inputIconWrapper: {
    padding: normalize(16),
  },
  phoneInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: normalize(16),
    paddingVertical: normalize(16),
    paddingRight: normalize(16),
    fontWeight: '500',
  },
  codeContainer: {
    marginBottom: normalize(20),
  },
  codeInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: normalize(16),
    height: normalize(64),
    fontSize: normalize(20),
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 6,
    paddingHorizontal: normalize(20),
  },
  
  // Buttons
  primaryButton: {
    backgroundColor: '#00E5FF',
    borderRadius: normalize(16),
    height: normalize(56),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: normalize(12),
  },
  primaryButtonDisabled: {
    backgroundColor: 'rgba(0, 229, 255, 0.3)',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: normalize(16),
    fontWeight: '600',
    marginRight: normalize(8),
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: normalize(16),
    height: normalize(48),
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonDisabled: {
    opacity: 0.5,
  },
  secondaryButtonText: {
    color: '#00E5FF',
    fontSize: normalize(14),
    fontWeight: '500',
  },
  secondaryButtonTextDisabled: {
    color: 'rgba(255, 255, 255, 0.4)',
  },
  
  // Footer
  modalFooter: {
    marginTop: normalize(16),
  },
  footerText: {
    fontSize: normalize(12),
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    lineHeight: normalize(18),
    marginTop: normalize(16),
  },
});
