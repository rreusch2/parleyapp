import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { normalize, isTablet } from '../services/device';
import { useUITheme } from '../services/uiThemeContext';

const { width: screenWidth } = Dimensions.get('window');

interface FootballSeasonCardProps {
  onPress?: () => void;
  isVisible?: boolean;
  tier?: 'free' | 'pro' | 'elite';
}

const FootballSeasonCard: React.FC<FootballSeasonCardProps> = ({
  onPress,
  isVisible = true,
  tier = 'free'
}) => {
  const { theme } = useUITheme();
  // Animation values
  const slideAnim = useRef(new Animated.Value(50)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const sparkleRotation = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const footballBounce = useRef(new Animated.Value(0)).current;
  
  // Floating particles
  const particle1 = useRef(new Animated.Value(0)).current;
  const particle2 = useRef(new Animated.Value(0)).current;
  const particle3 = useRef(new Animated.Value(0)).current;
  
  // Text reveal animation
  const textRevealAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      startEntryAnimation();
      startContinuousAnimations();
    }
  }, [isVisible]);

  const startEntryAnimation = () => {
    // Staggered entry animation
    Animated.parallel([
      // Main card entrance
      Animated.sequence([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 800,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      // Text reveal after card appears
      Animated.sequence([
        Animated.delay(300),
        Animated.timing(textRevealAnim, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

  const startContinuousAnimations = () => {
    // Sparkle rotation
    Animated.loop(
      Animated.timing(sparkleRotation, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 2000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Football bounce
    Animated.loop(
      Animated.sequence([
        Animated.timing(footballBounce, {
          toValue: -8,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(footballBounce, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Floating particles
    const createParticleAnimation = (particle: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(particle, {
            toValue: -20,
            duration: 3000,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(particle, {
            toValue: 0,
            duration: 3000,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    createParticleAnimation(particle1, 0);
    createParticleAnimation(particle2, 1000);
    createParticleAnimation(particle3, 2000);
  };

  const sparkleRotationInterpolated = sparkleRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const textSlideUp = textRevealAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });

  const getTierGradient = (): readonly [string, string, ...string[]] => {
    switch (tier) {
      case 'elite':
        return theme.headerGradient;
      case 'pro':
        return ['#1E40AF', '#7C3AED', '#0F172A'] as const;
      default:
        return ['#0F766E', '#059669', '#064E3B'] as const;
    }
  };

  const getTierAccentColor = () => {
    switch (tier) {
      case 'elite':
        return theme.accentPrimary;
      case 'pro':
        return '#00E5FF';
      default:
        return '#10B981';
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [
            { translateY: slideAnim },
            { scale: scaleAnim },
          ],
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        style={styles.touchable}
      >
        <Animated.View
          style={[
            styles.cardContainer,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          <LinearGradient
            colors={getTierGradient()}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            {/* Animated Background Pattern */}
            <View style={styles.backgroundPattern}>
              <Animated.View
                style={[
                  styles.patternElement,
                  { transform: [{ rotate: sparkleRotationInterpolated }] },
                ]}
              >
                <Text style={styles.patternEmoji}>🏈</Text>
              </Animated.View>
              <Animated.View
                style={[
                  styles.patternElement2,
                  { transform: [{ rotate: sparkleRotationInterpolated }] },
                ]}
              >
                <Text style={styles.patternEmoji}>🏆</Text>
              </Animated.View>
            </View>

            {/* Floating Particles */}
            <Animated.View
              style={[
                styles.particle,
                styles.particle1,
                { transform: [{ translateY: particle1 }] },
              ]}
            >
              <Text style={styles.particleEmoji}>⭐</Text>
            </Animated.View>
            <Animated.View
              style={[
                styles.particle,
                styles.particle2,
                { transform: [{ translateY: particle2 }] },
              ]}
            >
              <Text style={styles.particleEmoji}>🔥</Text>
            </Animated.View>
            <Animated.View
              style={[
                styles.particle,
                styles.particle3,
                { transform: [{ translateY: particle3 }] },
              ]}
            >
              <Text style={styles.particleEmoji}>⚡</Text>
            </Animated.View>

            {/* Main Content */}
            <View style={styles.contentContainer}>
              {/* Left Side - Football Icon with Bounce */}
              <Animated.View
                style={[
                  styles.footballContainer,
                  { transform: [{ translateY: footballBounce }] },
                ]}
              >
                <View style={[styles.footballIcon, { borderColor: getTierAccentColor() }]}>
                  <Text style={styles.footballEmoji}>🏈</Text>
                </View>
              </Animated.View>

              {/* Center Content - Text */}
              <Animated.View
                style={[
                  styles.textContainer,
                  {
                    opacity: textRevealAnim,
                    transform: [{ translateY: textSlideUp }],
                  },
                ]}
              >
                <View style={styles.titleRow}>
                  <Text style={styles.mainTitle}>Football is Back!</Text>
                  <Animated.View
                    style={[
                      styles.sparkleIcon,
                      { transform: [{ rotate: sparkleRotationInterpolated }] },
                    ]}
                  >
                    <Ionicons 
                      name="sparkles" 
                      size={16} 
                      color={getTierAccentColor()} 
                    />
                  </Animated.View>
                </View>
                <Text style={styles.subtitle}>
                  Now featuring NFL & College Football predictions
                </Text>
                <View style={styles.featuresRow}>
                  <View style={[styles.featureBadge, { backgroundColor: `${getTierAccentColor()}20` }]}>
                    <Text style={[styles.featureText, { color: getTierAccentColor() }]}>
                      NFL
                    </Text>
                  </View>
                  <View style={[styles.featureBadge, { backgroundColor: `${getTierAccentColor()}20` }]}>
                    <Text style={[styles.featureText, { color: getTierAccentColor() }]}>
                      CFB
                    </Text>
                  </View>
                </View>
              </Animated.View>

              {/* Right Side - Arrow with Glow */}
              <View style={styles.arrowContainer}>
                <View style={[styles.arrowGlow, { shadowColor: getTierAccentColor() }]}>
                  <Ionicons 
                    name="chevron-forward" 
                    size={20} 
                    color={getTierAccentColor()} 
                  />
                </View>
              </View>
            </View>

            {/* Bottom Shine Effect */}
            <LinearGradient
              colors={['transparent', 'rgba(255,255,255,0.1)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.shineEffect}
            />
          </LinearGradient>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: normalize(16),
    marginVertical: normalize(8),
  },
  touchable: {
    borderRadius: normalize(16),
    overflow: 'hidden',
  },
  cardContainer: {
    borderRadius: normalize(16),
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  gradient: {
    paddingHorizontal: normalize(16),
    paddingVertical: normalize(14),
    minHeight: normalize(isTablet ? 90 : 80),
    position: 'relative',
    overflow: 'hidden',
  },
  backgroundPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.1,
  },
  patternElement: {
    position: 'absolute',
    top: normalize(10),
    right: normalize(20),
  },
  patternElement2: {
    position: 'absolute',
    bottom: normalize(10),
    left: normalize(20),
  },
  patternEmoji: {
    fontSize: normalize(20),
    opacity: 0.6,
  },
  particle: {
    position: 'absolute',
    opacity: 0.7,
  },
  particle1: {
    top: normalize(15),
    left: normalize(30),
  },
  particle2: {
    top: normalize(25),
    right: normalize(60),
  },
  particle3: {
    bottom: normalize(20),
    left: normalize(60),
  },
  particleEmoji: {
    fontSize: normalize(12),
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  footballContainer: {
    marginRight: normalize(12),
  },
  footballIcon: {
    width: normalize(44),
    height: normalize(44),
    borderRadius: normalize(22),
    borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footballEmoji: {
    fontSize: normalize(20),
  },
  textContainer: {
    flex: 1,
    marginRight: normalize(12),
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: normalize(4),
  },
  mainTitle: {
    fontSize: normalize(isTablet ? 18 : 16),
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginRight: normalize(6),
  },
  sparkleIcon: {
    marginLeft: normalize(2),
  },
  subtitle: {
    fontSize: normalize(isTablet ? 13 : 12),
    color: 'rgba(255,255,255,0.9)',
    marginBottom: normalize(6),
    lineHeight: normalize(16),
  },
  featuresRow: {
    flexDirection: 'row',
    gap: normalize(6),
  },
  featureBadge: {
    paddingHorizontal: normalize(8),
    paddingVertical: normalize(3),
    borderRadius: normalize(10),
  },
  featureText: {
    fontSize: normalize(10),
    fontWeight: '600',
  },
  arrowContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowGlow: {
    width: normalize(32),
    height: normalize(32),
    borderRadius: normalize(16),
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  shineEffect: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
  },
});

export default FootballSeasonCard;
