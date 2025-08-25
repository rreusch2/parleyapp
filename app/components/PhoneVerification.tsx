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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/api/supabaseClient';

interface PhoneVerificationProps {
  onVerificationComplete: (phoneNumber: string) => void;
  onBack?: () => void;
}

export default function PhoneVerification({ 
  onVerificationComplete, 
  onBack 
}: PhoneVerificationProps) {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

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
    if (!validatePhoneNumber(phoneNumber)) {
      Alert.alert('Invalid Phone', 'Please enter a valid phone number');
      return;
    }

    setLoading(true);
    try {
      const e164Phone = toE164Format(phoneNumber);

      // If user is logged in, use updateUser to initiate phone change; otherwise use signInWithOtp
      const { data: sessionData } = await supabase.auth.getUser();
      let error: any = null;
      if (sessionData.user) {
        const { error: updErr } = await supabase.auth.updateUser({ phone: e164Phone });
        error = updErr;
      } else {
        const resp = await supabase.auth.signInWithOtp({ phone: e164Phone });
        error = resp.error;
      }

      if (error) {
        if (error.message.includes('rate limit')) {
          Alert.alert('Too Many Attempts', 'Please wait before requesting another code');
        } else {
          Alert.alert('Error', error.message);
        }
        throw error;
      }

      setStep('code');
      setResendTimer(60); // 60 second cooldown
      
    } catch (error: any) {
      console.error('Error sending verification code:', error);
      Alert.alert('Error', 'Failed to send verification code. Please try again.');
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
      const e164Phone = toE164Format(phoneNumber);

      const { data, error } = await supabase.auth.verifyOtp({
        phone: e164Phone,
        token: verificationCode,
        type: 'sms'
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

      // If we verified without being logged in, clear the session to avoid creating a phone-only account
      const { data: sessionData } = await supabase.auth.getUser();
      if (!sessionData.user) {
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

  if (step === 'phone') {
    return (
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          {onBack && (
            <TouchableOpacity onPress={onBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
          )}
          <Text style={styles.title}>Verify Phone Number</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.subtitle}>
            We'll send you a verification code to prevent multiple accounts
          </Text>

          <View style={styles.inputContainer}>
            <Ionicons name="call-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.phoneInput}
              placeholder="(555) 123-4567"
              value={phoneNumber}
              onChangeText={handlePhoneChange}
              keyboardType="phone-pad"
              maxLength={14}
              autoFocus
            />
          </View>

          <TouchableOpacity
            style={[styles.sendButton, !validatePhoneNumber(phoneNumber) && styles.sendButtonDisabled]}
            onPress={sendVerificationCode}
            disabled={!validatePhoneNumber(phoneNumber) || loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.sendButtonText}>Send Code</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            By continuing, you agree that this phone number hasn't been used for a free trial before. 
            Standard message rates may apply.
          </Text>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setStep('phone')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Enter Verification Code</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.subtitle}>
          Enter the 6-digit code sent to{'\n'}{phoneNumber}
        </Text>

        <View style={styles.codeInputContainer}>
          <TextInput
            style={styles.codeInput}
            placeholder="123456"
            value={verificationCode}
            onChangeText={setVerificationCode}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
            textAlign="center"
          />
        </View>

        <TouchableOpacity
          style={[styles.verifyButton, verificationCode.length !== 6 && styles.verifyButtonDisabled]}
          onPress={verifyCode}
          disabled={verificationCode.length !== 6 || loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.verifyButtonText}>Verify</Text>
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    marginRight: 15,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 30,
    backgroundColor: '#f9f9f9',
  },
  inputIcon: {
    marginRight: 10,
  },
  phoneInput: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#333',
  },
  sendButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    lineHeight: 18,
  },
  codeInputContainer: {
    marginBottom: 30,
  },
  codeInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    height: 60,
    fontSize: 24,
    fontWeight: '600',
    backgroundColor: '#f9f9f9',
    letterSpacing: 8,
  },
  verifyButton: {
    backgroundColor: '#34C759',
    borderRadius: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  verifyButtonDisabled: {
    backgroundColor: '#ccc',
  },
  verifyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  resendButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
  },
  resendButtonDisabled: {
    opacity: 0.5,
  },
  resendButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '500',
  },
  resendButtonTextDisabled: {
    color: '#888',
  },
});
