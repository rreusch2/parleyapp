import React, { useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, Animated, Platform, Dimensions, ColorValue } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';

const { width: screenWidth } = Dimensions.get('window');

export type SplashVariant = 'free' | 'pro' | 'elite';

interface AnimatedSplashProps {
  variant?: SplashVariant;
  logoSize?: number;
}

// Simple, high-performance pulse animation for the logo
export const AnimatedSplash: React.FC<AnimatedSplashProps> = ({
  variant = 'free',
  logoSize = Math.min(screenWidth * 0.28, 140),
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.04, duration: 900, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1.0, duration: 900, useNativeDriver: true }),
      ])
    );

    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    );

    loop.start();
    glowLoop.start();

    return () => {
      loop.stop();
      glowLoop.stop();
      scale.setValue(1);
      glow.setValue(0);
    };
  }, [glow, scale]);

  const gradient = useMemo<[ColorValue, ColorValue, ColorValue]>(() => {
    if (variant === 'elite') return ['#0F172A', '#1E293B', '#5B21B6'];
    if (variant === 'pro') return ['#0F172A', '#111827', '#0EA5E9'];
    return ['#0F172A', '#111827', '#1F2937'];
  }, [variant]);

  const glowOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 0.6],
  });

  const ringScale = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1.1],
  });

  const ringSize = logoSize * 1.8;

  return (
    <View style={styles.container} pointerEvents="none">
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      />

      {/* Soft vignette */}
      <View style={styles.vignette} />

      {/* Animated glow ring behind logo */}
      <Animated.View
        style={[
          styles.glowRing,
          {
            width: ringSize,
            height: ringSize,
            borderRadius: ringSize / 2,
            opacity: glowOpacity,
            transform: [{ scale: ringScale }],
          },
        ]}
      />

      {/* App logo with rounded corners */}
      <Animated.View style={[styles.logoWrapper, { transform: [{ scale }] }]}>
        <Image
          source={require('../../assets/images/icon.png')}
          style={{ width: logoSize, height: logoSize, borderRadius: 28 }}
          contentFit="contain"
        />
      </Animated.View>

      {/* No progress bar - clean, logo-only splash */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  glowRing: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: Platform.OS === 'ios' ? 0.35 : 0.25,
    shadowRadius: 24,
    elevation: 8,
  },
});

export default AnimatedSplash;
