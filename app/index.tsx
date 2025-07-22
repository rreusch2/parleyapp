import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Dimensions, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { LogIn, UserPlus, TrendingUp, BarChart3 } from 'lucide-react-native';
import { supabase } from './services/api/supabaseClient';

// Sports Icons Components (using Unicode symbols for compatibility)
const SportsIcon = ({ type, style }) => {
  const icons = {
    football: '🏈',
    basketball: '🏀', 
    baseball: '⚾',
    boxing: '🥊',
    hockey: '🏒'
  };
  
  return (
    <Text style={[{ fontSize: 24, textAlign: 'center' }, style]}>
      {icons[type] || '⚽'}
    </Text>
  );
};

export default function LandingPage() {
  const router = useRouter(); // Initialize router
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const moveAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  // Animation for background sports icons
  const sportsTypes = ['football', 'basketball', 'baseball', 'boxing', 'hockey'];
  const sportsIconAnims = Array(6).fill(0).map((_, index) => ({
    position: useRef(new Animated.ValueXY({
      x: Math.random() * Dimensions.get('window').width,
      y: Math.random() * Dimensions.get('window').height
    })).current,
    opacity: useRef(new Animated.Value(Math.random() * 0.3 + 0.15)).current,
    rotation: useRef(new Animated.Value(0)).current,
    scale: useRef(new Animated.Value(Math.random() * 0.5 + 0.5)).current,
    type: sportsTypes[index % sportsTypes.length],
  }));
  
  useEffect(() => {
    // Check for existing session first
    checkSession();
    
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
    
    // Subtle floating animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(moveAnim, {
          toValue: 10,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(moveAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
    
    // Subtle pulsing animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.05,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
    
    // Animate background sports icons
    sportsIconAnims.forEach(sportsIcon => {
      animateSportsIcon(sportsIcon);
    });
  }, []);
  
  // Check if user has an active session
  const checkSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // User is already logged in, redirect to main app
        router.replace('/(tabs)');
      }
    } catch (error) {
      console.error('Error checking session:', error);
      // Continue showing landing page if there's an error
    }
  };
  
  const animateSportsIcon = (sportsIcon) => {
    const screenWidth = Dimensions.get('window').width;
    const screenHeight = Dimensions.get('window').height;
    
    // Keep icons within screen bounds with padding
    const newX = Math.random() * (screenWidth - 80) + 40; // 40px padding on each side
    const newY = Math.random() * (screenHeight - 160) + 80; // 80px padding top/bottom
    const duration = Math.random() * 12000 + 8000; // 8-20 seconds
    
    Animated.parallel([
      // Gentle floating movement
      Animated.timing(sportsIcon.position, {
        toValue: { x: newX, y: newY },
        duration: duration,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      // Subtle opacity breathing
      Animated.loop(
        Animated.sequence([
          Animated.timing(sportsIcon.opacity, {
            toValue: 0.4,
            duration: 4000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(sportsIcon.opacity, {
            toValue: 0.15,
            duration: 4000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      ),
      // Very slow rotation
      Animated.loop(
        Animated.timing(sportsIcon.rotation, {
          toValue: 360,
          duration: 30000, // 30 seconds for full rotation
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ),
    ]).start(() => {
      // Continue the animation loop
      setTimeout(() => animateSportsIcon(sportsIcon), 1000);
    });
  };

  return (
    <LinearGradient
      colors={['#1a2a6c', '#4a54c4', '#b21f1f']}
      style={styles.container}
    >
      {/* Animated Background Sports Icons */}
      {sportsIconAnims.map((sportsIcon, index) => (
        <Animated.View 
          key={index}
          style={[
            styles.sportsIcon,
            {
              opacity: sportsIcon.opacity,
              transform: [
                { translateX: sportsIcon.position.x },
                { translateY: sportsIcon.position.y },
                { scale: sportsIcon.scale },
                { rotate: sportsIcon.rotation.interpolate({
                  inputRange: [0, 360],
                  outputRange: ['0deg', '360deg']
                }) }
              ],
            },
          ]}
        >
          <SportsIcon type={sportsIcon.type} style={styles.iconEmoji} />
        </Animated.View>
      ))}
      <Animated.View 
        style={[
          styles.content,
          { 
            opacity: fadeAnim,
            transform: [{ translateY: moveAnim }] 
          }
        ]}
      >
        {/* Hero Section with Enhanced Typography */}
        <View style={styles.heroSection}>
          <Animated.View style={[{ transform: [{ scale: scaleAnim }] }]}>
            {/* Premium Brand Identity */}
            <View style={styles.brandIdentity}>
              <View style={styles.brandIcon}>
                <TrendingUp color="#4fc3f7" size={32} strokeWidth={2.5} />
              </View>
              
              <View style={styles.titleContainer}>
                <Text style={styles.mainTitle}>Predictive Play</Text>
                <View style={styles.titleUnderline} />
              </View>
              
              <Text style={styles.subtitle}>Smart Betting, Powered by AI</Text>
              
              {/* Value Proposition */}
              <View style={styles.valueProposition}>
                <View style={styles.featureItem}>
                  <BarChart3 color="rgba(255,255,255,0.8)" size={16} />
                  <Text style={styles.featureText}>Advanced Analytics</Text>
                </View>
                <Text style={styles.featureSeparator}>•</Text>
                <View style={styles.featureItem}>
                  <TrendingUp color="rgba(255,255,255,0.8)" size={16} />
                  <Text style={styles.featureText}>Predictive Intelligence</Text>
                </View>
              </View>
            </View>
          </Animated.View>
        </View>

        {/* Enhanced Call-to-Action Section */}
        <View style={styles.ctaSection}>
          <TouchableOpacity 
            style={[styles.primaryButton]} 
            onPress={() => router.push('/signup')}
          >
            <LinearGradient
              colors={['#4fc3f7', '#29b6f6']}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <UserPlus color="#ffffff" size={22} strokeWidth={2} style={styles.buttonIcon} />
              <Text style={styles.primaryButtonText}>Get Started</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.secondaryButton]}
            onPress={() => router.push('/login')}
          >
            <LogIn color="#4fc3f7" size={20} strokeWidth={2} style={styles.buttonIcon} />
            <Text style={styles.secondaryButtonText}>Sign In</Text>
          </TouchableOpacity>
          
          {/* Trust Indicator */}
          <Text style={styles.trustIndicator}>Join thousands of smart bettors</Text>
        </View>
      </Animated.View>
    </LinearGradient>
  );
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isTablet = screenWidth > 768;

const styles = StyleSheet.create({
  // Sports Icon Styles
  sportsIcon: {
    position: 'absolute',
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 22,
    opacity: 0.25,
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  
  // Main Container Styles
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: isTablet ? 60 : 24,
    paddingVertical: 40,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  
  // Hero Section Styles
  heroSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    maxWidth: isTablet ? 600 : '100%',
  },
  
  // Brand Identity Styles
  brandIdentity: {
    alignItems: 'center',
    width: '100%',
  },
  
  brandIcon: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 50,
    backgroundColor: 'rgba(79, 195, 247, 0.15)',
    borderWidth: 2,
    borderColor: 'rgba(79, 195, 247, 0.3)',
  },
  
  titleContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  
  mainTitle: {
    fontSize: isTablet ? 64 : screenWidth > 400 ? 52 : 44,
    fontWeight: Platform.OS === 'ios' ? '700' : 'bold',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'sans-serif',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: isTablet ? 72 : screenWidth > 400 ? 58 : 50,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    marginBottom: 8,
  },
  
  titleUnderline: {
    width: 60,
    height: 4,
    backgroundColor: '#4fc3f7',
    borderRadius: 2,
    shadowColor: '#4fc3f7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  
  subtitle: {
    fontSize: isTablet ? 22 : 18,
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Text' : 'sans-serif',
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    letterSpacing: 0.5,
    lineHeight: isTablet ? 28 : 24,
    marginBottom: 32,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  
  // Value Proposition Styles
  valueProposition: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  featureText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
    marginLeft: 6,
    letterSpacing: 0.3,
  },
  
  featureSeparator: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
    marginHorizontal: 16,
  },
  
  // CTA Section Styles
  ctaSection: {
    width: '100%',
    maxWidth: isTablet ? 400 : '100%',
    alignItems: 'center',
    paddingTop: 20,
  },
  
  // Primary Button Styles
  primaryButton: {
    width: '100%',
    marginBottom: 16,
    borderRadius: 28,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#4fc3f7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
  },
  
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  
  // Secondary Button Styles
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(79, 195, 247, 0.4)',
    marginBottom: 24,
  },
  
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4fc3f7',
    letterSpacing: 0.3,
  },
  
  // Button Icon Styles
  buttonIcon: {
    marginRight: 10,
  },
  
  // Trust Indicator
  trustIndicator: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    letterSpacing: 0.3,
    fontStyle: 'italic',
  },
});