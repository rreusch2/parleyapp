import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Dimensions } from 'react-native';
// import { Link } from 'expo-router'; // No longer needed for these buttons
import { useRouter } from 'expo-router'; // Import useRouter
import { LinearGradient } from 'expo-linear-gradient';
import { LogIn, UserPlus, CheckCircle } from 'lucide-react-native';
import { supabase } from './services/api/supabaseClient';

export default function LandingPage() {
  const router = useRouter(); // Initialize router
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const moveAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  // Animation for background particles
  const particleAnims = Array(8).fill(0).map(() => ({
    position: useRef(new Animated.ValueXY({
      x: Math.random() * Dimensions.get('window').width,
      y: Math.random() * Dimensions.get('window').height
    })).current,
    opacity: useRef(new Animated.Value(Math.random() * 0.5 + 0.25)).current,
    size: useRef(new Animated.Value(Math.random() * 40 + 10)).current,
  }));
  
  useEffect(() => {
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
    
    // Animate background particles
    particleAnims.forEach(particle => {
      animateParticle(particle);
    });
  }, []);
  
  const animateParticle = (particle) => {
    const newX = Math.random() * Dimensions.get('window').width;
    const newY = Math.random() * Dimensions.get('window').height;
    const duration = Math.random() * 15000 + 10000;
    
    Animated.parallel([
      Animated.timing(particle.position, {
        toValue: { x: newX, y: newY },
        duration: duration,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(particle.opacity, {
          toValue: Math.random() * 0.5 + 0.25,
          duration: duration / 2,
          useNativeDriver: true,
        }),
        Animated.timing(particle.opacity, {
          toValue: Math.random() * 0.3 + 0.1,
          duration: duration / 2,
          useNativeDriver: true,
        })
      ])
    ]).start(() => animateParticle(particle));
  };

  return (
    <LinearGradient
      colors={['#1a2a6c', '#4a54c4', '#b21f1f']}
      style={styles.container}
    >
      {/* Animated Background Particles */}
      {particleAnims.map((particle, index) => (
        <Animated.View 
          key={index}
          style={[
            styles.particle,
            {
              opacity: particle.opacity,
              transform: [
                { translateX: particle.position.x },
                { translateY: particle.position.y },
                { scale: particle.size.interpolate({
                  inputRange: [0, 50],
                  outputRange: [0, 1]
                }) }
              ],
            },
          ]}
        />
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
        <View style={styles.logoContainer}>
          <Animated.View style={[{ transform: [{ scale: scaleAnim }] }]}>
            <Text style={styles.logoTop}>PREDICTIVE</Text>
            <Text style={styles.logoBottom}>PLAY</Text>
          </Animated.View>
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
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  particle: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
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
    marginBottom: 20,
  },
  logoTop: {
    fontSize: 46,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 1.2,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
  },
  logoBottom: {
    fontSize: 50,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 1.2,
    marginBottom: 16,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
  },
  tagline: {
    fontSize: 22,
    color: '#ffffff',
    opacity: 0.95,
    textAlign: 'center',
    fontWeight: '500',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0.5, height: 0.5 },
    textShadowRadius: 3,
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
    paddingHorizontal: 30,
    marginVertical: 10,
    width: '85%',
    transform: [{ scale: 1 }],
  },
  loginButton: {
    backgroundColor: '#4169e1',
    borderRadius: 30,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  signupButton: {
    borderRadius: 30,
    backgroundColor: '#ffffff',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
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

  iconStyle: {
    marginRight: 10,
  },
  featuresContainer: {
    marginBottom: 50,
    paddingHorizontal: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 15,
    padding: 20,
  },
  featuresTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 12,
  },
  featureIcon: {
    marginRight: 15,
  },
  featureText: {
    fontSize: 17,
    color: '#ffffff',
    opacity: 0.95,
    fontWeight: '500',
  },
});