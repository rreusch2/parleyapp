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
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { supabase } from '@/app/services/api/supabaseClient';
import { LinearGradient } from 'expo-linear-gradient';
import { LogIn, Mail, Lock } from 'lucide-react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      Alert.alert('Login Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'parleyapp://auth/callback',
        },
      });

      if (error) throw error;
    } catch (error: any) {
      Alert.alert('Google Sign-In Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setLoading(true);
      
      // Check if Apple Sign-In is available on this device
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Apple Sign-In', 'Apple Sign-In is not available on this device');
        return;
      }

      // Request Apple Sign-In
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      // Sign in with Supabase using Apple credentials
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken!,
        nonce: credential.nonce,
      });

      if (error) throw error;

      if (data.user) {
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      console.log('Apple Sign-In Error:', error);
      if (error.code === 'ERR_REQUEST_CANCELED') {
        // User canceled Apple Sign-In
        return;
      }
      Alert.alert('Apple Sign-In Error', error.message);
    } finally {
      setLoading(false);
    }
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
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Sign in to continue your journey</Text>

          <View style={styles.form}>
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
                  selectionColor={styles.input.selectionColor}
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <View style={styles.inputWrapper}>
                <Lock color={styles.inputIcon.color} size={20} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor={styles.placeholderText.color}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  selectionColor={styles.input.selectionColor}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              <LogIn color={styles.buttonText.color} size={20} style={styles.buttonIcon} />
              <Text style={styles.buttonText}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Text>
            </TouchableOpacity>

            <Link href="/forgot-password" asChild>
              <TouchableOpacity style={styles.forgotPassword}>
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>
            </Link>

            {/* Social Authentication Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social Authentication Buttons */}
            <View style={styles.socialButtonsContainer}>
              {/* Google Sign-In Button */}
              <TouchableOpacity
                style={[styles.socialButton, styles.googleButton, loading && styles.buttonDisabled]}
                onPress={handleGoogleSignIn}
                disabled={loading}
              >
                <Text style={styles.socialButtonText}>Sign in with Google</Text>
              </TouchableOpacity>

              {/* Apple Sign-In Button (iOS only) */}
              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  style={[styles.socialButton, styles.appleButton, loading && styles.buttonDisabled]}
                  onPress={handleAppleSignIn}
                  disabled={loading}
                >
                  <Text style={[styles.socialButtonText, styles.appleButtonText]}>Sign in with Apple</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.signupPrompt}>
            <Text style={styles.signupPromptText}>Don&apos;t have an account? </Text>
            <Link href="/signup" asChild>
              <TouchableOpacity>
                <Text style={styles.signupLink}>Sign Up</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
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
    paddingVertical: 20,
  },
  content: {
    flex: 1,
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
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    minHeight: 60,
  },
  inputIcon: {
    marginRight: 10,
    color: '#e0e0e0',
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    marginLeft: 15,
    selectionColor: '#FFD700',
    paddingVertical: 0,
  } as any,
  placeholderText: {
    color: '#cccccc',
  },
  button: {
    backgroundColor: '#4169e1',
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
    opacity: 0.7,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  forgotPassword: {
    marginTop: 20,
    alignItems: 'center',
  },
  forgotPasswordText: {
    color: '#bfdbfe',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  signupPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  signupPromptText: {
    color: '#e0e0e0',
    fontSize: 16,
  },
  signupLink: {
    color: '#00E5FF',
    fontSize: 16,
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 30,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  dividerText: {
    color: '#e0e0e0',
    fontSize: 14,
    marginHorizontal: 15,
  },
  socialButtonsContainer: {
    marginBottom: 20,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 15,
    marginBottom: 12,
    borderWidth: 1,
  },
  googleButton: {
    backgroundColor: 'rgba(66, 133, 244, 0.1)',
    borderColor: 'rgba(66, 133, 244, 0.3)',
  },
  appleButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  appleButtonText: {
    color: '#ffffff',
  },
}); 