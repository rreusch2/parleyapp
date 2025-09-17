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
  Animated,
  Dimensions,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { supabase } from '@/app/services/api/supabaseClient';
import { LinearGradient } from 'expo-linear-gradient';
import { LogIn, Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import { normalize, isTablet } from '@/app/services/device';
import * as AppleAuthentication from 'expo-apple-authentication';

// No need to redefine isTablet since we're importing it

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [isAppleAuthAvailable, setIsAppleAuthAvailable] = useState(false);
  const router = useRouter();

  // Check if Apple Auth is available on mount
  React.useEffect(() => {
    // Apple Authentication is only available on iOS
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setIsAppleAuthAvailable);
    } else {
      setIsAppleAuthAvailable(false);
    }
  }, []);

  // Optimized handlers using useCallback to prevent unnecessary re-renders
  const handleEmailChange = useCallback((text: string) => {
    setEmail(text.trim()); // Trim whitespace automatically
  }, []);

  const handlePasswordChange = useCallback((text: string) => {
    setPassword(text); // Allow all characters including special characters
  }, []);

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  const handleEmailFocus = useCallback(() => setEmailFocused(true), []);
  const handleEmailBlur = useCallback(() => setEmailFocused(false), []);
  const handlePasswordFocus = useCallback(() => setPasswordFocused(true), []);
  const handlePasswordBlur = useCallback(() => setPasswordFocused(false), []);

  // Memoized styles for better performance
  const emailInputWrapperStyle = useMemo(() => [
    styles.inputWrapper,
    emailFocused && styles.inputWrapperFocused
  ], [emailFocused]);

  const passwordInputWrapperStyle = useMemo(() => [
    styles.inputWrapper,
    passwordFocused && styles.inputWrapperFocused
  ], [passwordFocused]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
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

  const handleAppleSignIn = async () => {
    try {
      setLoading(true);
      
      console.log('🍎 Starting Apple Sign In...');
      
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
          console.error('Supabase Apple Sign In error:', error);
          console.error('Error details:', {
            message: error.message,
            status: error.status,
            details: error.details,
            hint: error.hint,
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
          // Check if this is a new user (first time sign in with Apple)
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, created_at')
            .eq('id', data.user.id)
            .single();

          const isNewUser = !profile || !profile.username || 
            (profile.created_at && new Date(profile.created_at) > new Date(Date.now() - 60000)); // Created within last minute

          if (isNewUser) {
            // New user - update their profile with Apple-provided info
            const fullName = credential.fullName;
            const displayName = [fullName?.givenName, fullName?.familyName]
              .filter(Boolean)
              .join(' ') || credential.email?.split('@')[0] || 'User';

            await supabase
              .from('profiles')
              .update({
                username: displayName,
                email: credential.email || data.user.email,
              })
              .eq('id', data.user.id);

            // Redirect new users to signup page to go through subscription flow
            // Pass a flag to indicate they're already authenticated
            router.replace({
              pathname: '/signup',
              params: { 
                appleSignInComplete: 'true',
                userId: data.user.id 
              }
            });
          } else {
            // Existing user - go to main app
            router.replace('/(tabs)');
          }
        }
      }
    } catch (error: any) {
      if (error.code === 'ERR_REQUEST_CANCELED') {
        // User canceled the sign-in
        console.log('User canceled Apple Sign In');
      } else {
        console.error('Apple Sign In error details:', {
          code: error.code,
          message: error.message,
          error: error
        });
        
        // Provide more specific error messages
        let errorMessage = 'Failed to sign in with Apple. Please try again.';
        
        if (error.message?.includes('provider')) {
          errorMessage = 'Apple Sign In is not properly configured. Please contact support.';
        } else if (error.message?.includes('token')) {
          errorMessage = 'Invalid authentication token. Please try again.';
        } else if (error.message?.includes('network')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        }
        
        Alert.alert('Sign In Error', errorMessage);
      }
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
        <Pressable onPress={Keyboard.dismiss} style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.content}>
              <Text style={styles.title}>Welcome Back</Text>
              <Text style={styles.subtitle}>Sign in to continue your journey</Text>

              <View style={styles.form}>
                {/* Apple Sign In Button - Show first for better UX */}
                {isAppleAuthAvailable && (
                  <View style={styles.appleButtonContainer}>
                    <AppleAuthentication.AppleAuthenticationButton
                      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                      cornerRadius={30}
                      style={styles.appleButton}
                      onPress={handleAppleSignIn}
                    />
                    
                    <View style={styles.divider}>
                      <View style={styles.dividerLine} />
                      <Text style={styles.dividerText}>OR</Text>
                      <View style={styles.dividerLine} />
                    </View>
                  </View>
                )}

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
                </View>

                {/* Password Input */}
                <View style={styles.inputContainer}>
                  <View style={passwordInputWrapperStyle}>
                    <Lock color="#e0e0e0" size={20} />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your password"
                      placeholderTextColor="#cccccc"
                      value={password}
                      onChangeText={handlePasswordChange}
                      onFocus={handlePasswordFocus}
                      onBlur={handlePasswordBlur}
                      secureTextEntry={!showPassword}
                      returnKeyType="done"
                      onSubmitEditing={handleLogin}
                      selectionColor="#FFD700"
                      autoComplete="password"
                      textContentType="password"
                      autoCorrect={false}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      onPress={togglePasswordVisibility}
                      style={styles.passwordToggle}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      {showPassword ? (
                        <EyeOff color="#e0e0e0" size={20} />
                      ) : (
                        <Eye color="#e0e0e0" size={20} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleLogin}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <LogIn color="#ffffff" size={20} style={styles.buttonIcon} />
                  <Text style={styles.buttonText}>
                    {loading ? 'Signing in...' : 'Sign In'}
                  </Text>
                </TouchableOpacity>

                <Link href="/forgot-password" asChild>
                  <TouchableOpacity style={styles.forgotPassword} activeOpacity={0.7}>
                    <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                  </TouchableOpacity>
                </Link>
              </View>

              <View style={styles.signupPrompt}>
                <Text style={styles.signupPromptText}>Don&apos;t have an account? </Text>
                <Link href="/signup" asChild>
                  <TouchableOpacity activeOpacity={0.7}>
                    <Text style={styles.signupLink}>Sign Up</Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </View>
          </ScrollView>
        </Pressable>
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
    paddingVertical: normalize(20),
  },
  content: {
    flex: 1,
    padding: normalize(25),
    justifyContent: 'center',
    maxWidth: isTablet ? 600 : undefined, // Limit width on iPad
    alignSelf: 'center', // Center on iPad
    width: isTablet ? '80%' : '100%', // Use percentage width on iPad
  },
  title: {
    fontSize: isTablet ? 42 : 36,
    fontWeight: 'bold',
    marginBottom: normalize(10),
    color: '#ffffff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: isTablet ? 22 : 18,
    color: '#e0e0e0',
    marginBottom: isTablet ? 50 : 40,
    textAlign: 'center',
  },
  form: {
    marginBottom: normalize(30),
  },
  inputContainer: {
    marginBottom: normalize(20),
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
    transition: 'border-color 0.2s ease',
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
  passwordToggle: {
    padding: normalize(5),
    marginLeft: normalize(10),
  },
  button: {
    backgroundColor: '#4169e1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: isTablet ? 20 : 16,
    borderRadius: 30,
    marginTop: 20,
    shadowColor: '#4169e1',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonIcon: {
    marginRight: normalize(10),
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: isTablet ? 20 : 18,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto-Bold',
  },
  forgotPassword: {
    marginTop: normalize(20),
    alignItems: 'center',
    paddingVertical: normalize(10),
  },
  forgotPasswordText: {
    color: '#bfdbfe',
    fontSize: isTablet ? 18 : 16,
    textDecorationLine: 'underline',
  },
  signupPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: normalize(20),
  },
  signupPromptText: {
    color: '#e0e0e0',
    fontSize: isTablet ? 18 : 16,
  },
  signupLink: {
    color: '#00E5FF',
    fontSize: isTablet ? 18 : 16,
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  appleButtonContainer: {
    marginBottom: normalize(20),
  },
  appleButton: {
    width: '100%',
    height: isTablet ? 60 : 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: normalize(30),
    marginTop: normalize(10),
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
    color: '#e0e0e0',
    paddingHorizontal: 15,
    fontSize: isTablet ? 18 : 14,
  },
}); 