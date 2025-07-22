import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Dimensions, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { LogIn, UserPlus, TrendingUp, Target, BarChart3, Activity, Zap } from 'lucide-react-native';
import { supabase } from './services/api/supabaseClient';

export default function LandingPage() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const moveAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  
  // Sports-themed floating elements
  const sportsElements = Array(6).fill(0).map((_, index) => ({
    position: useRef(new Animated.ValueXY({
      x: Math.random() * Dimensions.get('window').width,
      y: Math.random() * Dimensions.get('window').height
    })).current,
    opacity: useRef(new Animated.Value(Math.random() * 0.3 + 0.1)).current,
    rotation: useRef(new Animated.Value(0)).current,
    scale: useRef(new Animated.Value(Math.random() * 0.5 + 0.5)).current,
    type: ['chart', 'target', 'trending', 'activity', 'zap', 'bar'][index % 6]
  }));
  
  useEffect(() => {
    checkSession();
    
    // Enhanced fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    
    // Sophisticated floating animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(moveAnim, {
          toValue: 15,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(moveAnim, {
          toValue: 0,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
    
    // Professional pulsing animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.02,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
    
    // Glow effect animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
    
    // Animate sports elements
    sportsElements.forEach(element => {
      animateSportsElement(element);
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
  
  const animateSportsElement = (element) => {
    const newX = Math.random() * (Dimensions.get('window').width - 60);
    const newY = Math.random() * (Dimensions.get('window').height - 60);
    const duration = Math.random() * 20000 + 15000;
    
    Animated.parallel([
      Animated.timing(element.position, {
        toValue: { x: newX, y: newY },
        duration: duration,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(element.rotation, {
        toValue: Math.random() * 360,
        duration: duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(element.opacity, {
          toValue: Math.random() * 0.4 + 0.2,
          duration: duration / 2,
          useNativeDriver: true,
        }),
        Animated.timing(element.opacity, {
          toValue: Math.random() * 0.2 + 0.1,
          duration: duration / 2,
          useNativeDriver: true,
        })
      ])
    ]).start(() => animateSportsElement(element));
  };
  
  const getSportsIcon = (type, size = 24) => {
    const iconProps = { size, color: 'rgba(255, 255, 255, 0.3)' };
    switch (type) {
      case 'chart': return <BarChart3 {...iconProps} />;
      case 'target': return <Target {...iconProps} />;
      case 'trending': return <TrendingUp {...iconProps} />;
      case 'activity': return <Activity {...iconProps} />;
      case 'zap': return <Zap {...iconProps} />;
      case 'bar': return <BarChart3 {...iconProps} />;
      default: return <TrendingUp {...iconProps} />;
    }
  };

  return (
    <LinearGradient
      colors={['#0F172A', '#1E293B', '#334155', '#1E40AF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      {/* Sports-themed Background Elements */}
      {sportsElements.map((element, index) => (
        <Animated.View 
          key={index}
          style={[
            styles.sportsElement,
            {
              opacity: element.opacity,
              transform: [
                { translateX: element.position.x },
                { translateY: element.position.y },
                { rotate: element.rotation.interpolate({
                  inputRange: [0, 360],
                  outputRange: ['0deg', '360deg']
                }) },
                { scale: element.scale }
              ],
            },
          ]}
        >
          {getSportsIcon(element.type, 32)}
        </Animated.View>
      ))}
      
      {/* Subtle Grid Pattern Overlay */}
      <View style={styles.gridOverlay} />
      
      <Animated.View 
        style={[
          styles.content,
          { 
            opacity: fadeAnim,
            transform: [{ translateY: moveAnim }] 
          }
        ]}
      >
        <View style={styles.logoContainer}>
          <Animated.View style={[
            styles.logoWrapper,
            { 
              transform: [{ scale: scaleAnim }],
              shadowOpacity: glowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 0.8]
              })
            }
          ]}>
            <Text style={styles.logoTop}>PREDICTIVE</Text>
            <Text style={styles.logoBottom}>PLAY</Text>
            <Animated.View 
              style={[
                styles.logoGlow,
                {
                  opacity: glowAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.2, 0.6]
                  })
                }
              ]}
            />
          </Animated.View>
          <Text style={styles.tagline}>Smart Betting, Powered by AI</Text>
          <View style={styles.featureHighlights}>
            <View style={styles.featureItem}>
              <TrendingUp size={16} color="#00E5FF" />
              <Text style={styles.featureText}>AI Predictions</Text>
            </View>
            <View style={styles.featureItem}>
              <Target size={16} color="#00E5FF" />
              <Text style={styles.featureText}>Expert Analysis</Text>
            </View>
            <View style={styles.featureItem}>
              <BarChart3 size={16} color="#00E5FF" />
              <Text style={styles.featureText}>Live Stats</Text>
            </View>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, styles.loginButton]} 
            onPress={() => router.push('/login')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#1E40AF', '#3B82F6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              <LogIn color="white" size={20} style={styles.iconStyle} />
              <Text style={styles.loginButtonText}>Login</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.signupButton]}
            onPress={() => router.push('/signup')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#7C3AED', '#A855F7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              <UserPlus color="white" size={20} style={styles.iconStyle} />
              <Text style={styles.signupButtonText}>Sign Up</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sportsElement: {
    position: 'absolute',
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.03,
    backgroundColor: 'transparent',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 50,
  },
  logoWrapper: {
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 20,
    elevation: 10,
  },
  logoGlow: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    backgroundColor: '#00E5FF',
    borderRadius: 100,
    zIndex: -1,
  },
  logoTop: {
    fontSize: 48,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 2,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 229, 255, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto',
  },
  logoBottom: {
    fontSize: 52,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 2,
    marginBottom: 20,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 229, 255, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'Roboto',
  },
  tagline: {
    fontSize: 20,
    color: '#E2E8F0',
    opacity: 0.9,
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: 0.8,
    marginBottom: 25,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  featureHighlights: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 15,
  },
  featureItem: {
    alignItems: 'center',
    opacity: 0.8,
  },
  featureText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  buttonContainer: {
    marginVertical: 40,
    alignItems: 'center',
  },
  button: {
    marginVertical: 8,
    width: '85%',
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  loginButton: {
    // Gradient styling handled by LinearGradient component
  },
  signupButton: {
    // Gradient styling handled by LinearGradient component
  },
  loginButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  signupButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  iconStyle: {
    marginRight: 12,
  },
});