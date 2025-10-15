import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface PhoneVerificationScreenProps {
  onComplete: (data: { phoneNumber: string }) => void;
  currentPreferences: any;
  isExistingUser?: boolean;
}

const PhoneVerificationScreen: React.FC<PhoneVerificationScreenProps> = ({
  onComplete,
  currentPreferences,
  isExistingUser,
}) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const phoneInputRef = useRef<TextInput>(null);

  const formatPhoneNumber = (text: string) => {
    // Remove all non-digits
    const cleaned = text.replace(/\D/g, '');
    
    // Limit to 10 digits
    const limited = cleaned.substring(0, 10);
    
    // Format as (XXX) XXX-XXXX
    if (limited.length >= 6) {
      return `(${limited.substring(0, 3)}) ${limited.substring(3, 6)}-${limited.substring(6)}`;
    } else if (limited.length >= 3) {
      return `(${limited.substring(0, 3)}) ${limited.substring(3)}`;
    } else if (limited.length > 0) {
      return `(${limited}`;
    }
    return limited;
  };

  const handlePhoneChange = (text: string) => {
    const formatted = formatPhoneNumber(text);
    setPhoneNumber(formatted);
  };

  const validatePhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length === 10;
  };

  const handleContinue = async () => {
    if (!validatePhoneNumber(phoneNumber)) {
      Alert.alert(
        'Invalid Phone Number',
        'Please enter a valid 10-digit phone number.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsLoading(true);

    try {
      // Here you would typically integrate with a phone verification service
      // like Firebase Auth, Twilio, or AWS SNS
      // For now, we'll just simulate the verification
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // In a real implementation, you would:
      // 1. Send SMS verification code
      // 2. Show code input screen
      // 3. Verify the code
      // 4. Mark phone as verified
      
      const cleanedPhone = phoneNumber.replace(/\D/g, '');
      onComplete({ phoneNumber: `+1${cleanedPhone}` });
      
    } catch (error) {
      Alert.alert(
        'Verification Failed',
        'Unable to send verification code. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const isValidPhone = validatePhoneNumber(phoneNumber);

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="shield-checkmark" size={64} color="#00d4ff" />
        </View>
        
        <Text style={styles.title}>Verify your phone number</Text>
        <Text style={styles.subtitle}>
          We need to verify your phone number to ensure account security and prevent abuse of our free trial.
        </Text>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Phone Number</Text>
          <View style={styles.phoneInputContainer}>
            <View style={styles.countryCode}>
              <Text style={styles.countryCodeText}>🇺🇸 +1</Text>
            </View>
            <TextInput
              ref={phoneInputRef}
              style={styles.phoneInput}
              value={phoneNumber}
              onChangeText={handlePhoneChange}
              placeholder="(555) 123-4567"
              placeholderTextColor="rgba(255,255,255,0.5)"
              keyboardType="phone-pad"
              maxLength={14} // (XXX) XXX-XXXX
              autoFocus
            />
          </View>
          
          {phoneNumber.length > 0 && !isValidPhone && (
            <Text style={styles.errorText}>
              Please enter a valid 10-digit phone number
            </Text>
          )}
        </View>

        <View style={styles.securityInfo}>
          <View style={styles.securityItem}>
            <Ionicons name="lock-closed" size={20} color="#00d4ff" />
            <Text style={styles.securityText}>Your number is encrypted and secure</Text>
          </View>
          <View style={styles.securityItem}>
            <Ionicons name="eye-off" size={20} color="#00d4ff" />
            <Text style={styles.securityText}>We'll never share your information</Text>
          </View>
          <View style={styles.securityItem}>
            <Ionicons name="chatbubble-ellipses" size={20} color="#00d4ff" />
            <Text style={styles.securityText}>Used only for account verification</Text>
          </View>
        </View>

        <View style={styles.benefitsContainer}>
          <Text style={styles.benefitsTitle}>Why we verify phone numbers:</Text>
          <View style={styles.benefitItem}>
            <View style={styles.benefitBullet} />
            <Text style={styles.benefitText}>Prevent multiple free trial accounts</Text>
          </View>
          <View style={styles.benefitItem}>
            <View style={styles.benefitBullet} />
            <Text style={styles.benefitText}>Secure account recovery</Text>
          </View>
          <View style={styles.benefitItem}>
            <View style={styles.benefitBullet} />
            <Text style={styles.benefitText}>Enhanced account protection</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        onPress={handleContinue}
        style={[
          styles.continueButton,
          { opacity: (isValidPhone && !isLoading) ? 1 : 0.6 }
        ]}
        disabled={!isValidPhone || isLoading}
      >
        <LinearGradient
          colors={['#00d4ff', '#0099cc']}
          style={styles.continueGradient}
        >
          {isLoading ? (
            <>
              <Text style={styles.continueText}>Sending Code...</Text>
              <View style={styles.loadingSpinner}>
                <Ionicons name="refresh" size={20} color="#fff" />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.continueText}>Send Verification Code</Text>
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    marginTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 32,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  countryCode: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
  },
  countryCodeText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#fff',
  },
  errorText: {
    fontSize: 14,
    color: '#e74c3c',
    marginTop: 8,
    marginLeft: 4,
  },
  securityInfo: {
    width: '100%',
    backgroundColor: 'rgba(0, 212, 255, 0.05)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.2)',
  },
  securityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  securityText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginLeft: 12,
    flex: 1,
  },
  benefitsContainer: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 20,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  benefitBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00d4ff',
    marginRight: 12,
  },
  benefitText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    flex: 1,
  },
  continueButton: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  continueGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  continueText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  loadingSpinner: {
    // Add rotation animation if needed
  },
});

export default PhoneVerificationScreen;
