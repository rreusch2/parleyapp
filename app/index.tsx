import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from 'react-native';
// import { Link } from 'expo-router'; // No longer needed for these buttons
import { useRouter } from 'expo-router'; // Import useRouter
import { LinearGradient } from 'expo-linear-gradient';
import { LogIn, UserPlus, CheckCircle, Zap } from 'lucide-react-native';
import { supabase } from '@/app/services/api/supabaseClient';
import { DEV_CONFIG } from '@/app/config/development';

export default function LandingPage() {
  const router = useRouter(); // Initialize router

  // Development login function for Pro User
  const handleDevLogin = async () => {
    try {
      console.log('🔧 Attempting dev login for Pro user...');
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'reid123456789@gmail.com',
        password: 'Rekaja20',
      });

      if (error) {
        console.error('❌ Dev login error:', error);
        Alert.alert(
          'Dev Login Error', 
          'Could not log in with Pro account. Try regular login instead.',
          [
            { text: 'Regular Login', onPress: () => router.push('/login') },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
        return;
      }

      if (data.user) {
        console.log(`✅ Successfully logged in as reid123456789@gmail.com`);
        
        // Try to update profile to Pro tier if possible
        try {
          await supabase
            .from('profiles')
            .update({ subscription_tier: 'pro' })
            .eq('id', data.user.id);
          console.log(`✅ Updated profile to pro tier`);
        } catch (profileError) {
          console.log('⚠️ Could not update profile, but login successful');
        }
        
        console.log('🎯 Dev login successful, navigating to app...');
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      console.error('Dev login error:', error);
      Alert.alert(
        'Dev Login Error', 
        'Login failed. Try regular login instead.',
        [
          { text: 'Regular Login', onPress: () => router.push('/login') },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    }
  };

  // Development login function for Free User
  const handleDevLoginFree = async () => {
    try {
      console.log('🔧 Attempting dev login for Free user...');
      
      // Try multiple existing free test accounts
      const freeTestAccounts = [
        { email: 'free@predictiveplay.com', tier: 'free' },
        { email: 'test.free@predictiveplay.com', tier: 'free' },
        { email: 'demo@predictiveplay.com', tier: 'free' },
        { email: 'user@predictiveplay.com', tier: 'free' }
      ];

      let loginSuccess = false;
      
      for (const account of freeTestAccounts) {
        try {
          console.log(`🔍 Trying free account: ${account.email}`);
          const { data, error } = await supabase.auth.signInWithPassword({
            email: account.email,
            password: 'devpassword123',
          });

          if (!error && data.user) {
            console.log(`✅ Successfully logged in as ${account.email}`);
            
            // Try to update profile if possible, but don't fail if it doesn't work
            try {
              await supabase
                .from('profiles')
                .update({ subscription_tier: account.tier })
                .eq('id', data.user.id);
              console.log(`✅ Updated profile to ${account.tier} tier`);
            } catch (profileError) {
              console.log('⚠️ Could not update profile, but login successful');
            }
            
            loginSuccess = true;
            break;
          }
        } catch (accountError) {
          console.log(`❌ Failed to login with ${account.email}:`, accountError);
          continue;
        }
      }

      if (!loginSuccess) {
        // If all existing accounts fail, show helpful message
        Alert.alert(
          'Dev Login Issue',
          'Could not log in with existing free test accounts. This might be due to database configuration. Please try the regular login.',
          [
            { text: 'Use Regular Login', onPress: () => router.push('/login') },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
        return;
      }

      console.log('🎯 Dev free login successful, navigating to app...');
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Dev free login error:', error);
      Alert.alert(
        'Dev Login Error', 
        'Login failed. Try regular login instead.',
        [
          { text: 'Regular Login', onPress: () => router.push('/login') },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    }
  };

  return (
    <LinearGradient
      colors={['#1a2a6c', '#b21f1f']}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>PREDICTIVE PLAY</Text>
          <Text style={styles.tagline}>Smart Betting, Powered by AI</Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, styles.loginButton]} 
            onPress={() => router.push('/login')} // Programmatic navigation
          >
            <LogIn color="black" size={20} style={styles.iconStyle} />
            <Text style={styles.loginButtonText}>Login</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.signupButton]}
            onPress={() => router.push('/signup')} // Programmatic navigation
          >
            <UserPlus color="black" size={20} style={styles.iconStyle} />
            <Text style={styles.signupButtonText}>Sign Up</Text>
          </TouchableOpacity>

          {/* Development Login Button - only show in development */}
          {__DEV__ && (
            <>
              <TouchableOpacity 
                style={[styles.button, styles.devButton]}
                onPress={handleDevLogin}
              >
                <Zap color="white" size={20} style={styles.iconStyle} />
                <Text style={styles.devButtonText}>Dev Login (Pro User)</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.button, styles.devButtonFree]}
                onPress={handleDevLoginFree}
              >
                <Zap color="white" size={20} style={styles.iconStyle} />
                <Text style={styles.devButtonText}>Dev Login (Free User)</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>Features</Text>
          
          <View style={styles.featureItem}>
            <CheckCircle color="#ffffff" size={20} style={styles.featureIcon} />
            <Text style={styles.featureText}>AI-Powered Predictions</Text>
          </View>
          
          <View style={styles.featureItem}>
            <CheckCircle color="#ffffff" size={20} style={styles.featureIcon} />
            <Text style={styles.featureText}>Personalized Betting Strategy</Text>
          </View>
          
          <View style={styles.featureItem}>
            <CheckCircle color="#ffffff" size={20} style={styles.featureIcon} />
            <Text style={styles.featureText}>Real-time Updates</Text>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'space-around',
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 80,
  },
  logo: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
  },
  tagline: {
    fontSize: 18,
    color: '#ffffff',
    opacity: 0.9,
    textAlign: 'center',
  },
  buttonContainer: {
    marginVertical: 30,
    alignItems: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginVertical: 10,
    width: '85%',
  },
  loginButton: {
    backgroundColor: '#4169e1',
    borderRadius: 30,
    // borderWidth: 2, // Removed diagnostic
    // borderColor: 'blue', // Removed diagnostic
    // opacity: 1, // Removed diagnostic
  },
  signupButton: {
    borderRadius: 30,
    backgroundColor: '#ffffff',
    // borderWidth: 2, // Removed diagnostic
    // borderColor: 'green', // Removed diagnostic
    // opacity: 1, // Removed diagnostic
  },
  loginButtonText: {
    color: 'black',
    fontSize: 18,
    fontWeight: 'bold',
  },
  signupButtonText: {
    color: 'black',
    fontSize: 18,
    fontWeight: 'bold',
  },
  devButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'white',
  },
  devButtonFree: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  devButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  iconStyle: {
    marginRight: 10,
  },
  featuresContainer: {
    marginBottom: 40,
    paddingHorizontal: 10,
  },
  featuresTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 20,
    textAlign: 'center',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  featureIcon: {
    marginRight: 10,
  },
  featureText: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.9,
  },
});