import React, { useEffect, useState } from 'react';
import { Animated, Easing, Image, Platform, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useUISettings } from '../services/uiSettingsContext';
import { useSubscription } from '../services/subscriptionContext';
import { getRingColors } from '../utils/chatBubbleTheme';

interface Props {
  animateOut?: boolean;
  onExited?: () => void;
}

export default function ChatBubblePreview({ animateOut = false, onExited }: Props) {
  const { chatBubbleAnimation, bubbleSize, shouldReduceMotion, ringTheme } = useUISettings();
  const { isPro, isElite } = useSubscription();

  const [appear] = useState(new Animated.Value(0)); // 0 -> in, 1 -> center
  const [scale] = useState(new Animated.Value(0.9));
  const [opacity] = useState(new Animated.Value(0));
  const [breath] = useState(new Animated.Value(0));
  const [pulse] = useState(new Animated.Value(0));
  const [shimmerX] = useState(new Animated.Value(0));

  const SIZE = bubbleSize === 'compact' ? 50 : 56;
  const RING_PAD = 2;

  useEffect(() => {
    // Entrance
    Animated.parallel([
      Animated.timing(appear, { toValue: 1, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();

    if (!shouldReduceMotion && chatBubbleAnimation === 'glow') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(breath, { toValue: 1, duration: 4200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(breath, { toValue: 0, duration: 4200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ])
      ).start();
    }
    if (!shouldReduceMotion && chatBubbleAnimation === 'pulse') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 2800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 2800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ])
      ).start();
    }
    if (!shouldReduceMotion && chatBubbleAnimation === 'shimmer') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerX, { toValue: 1, duration: 3200, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(shimmerX, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ).start();
    }
  }, []);

  useEffect(() => {
    if (animateOut) {
      Animated.parallel([
        Animated.timing(appear, { toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.96, duration: 200, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) onExited?.();
      });
    }
  }, [animateOut, onExited]);

  const translateY = appear.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
  const ringScale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });
  const ringOpacity = breath.interpolate({ inputRange: [0, 1], outputRange: [0.06, 0.14] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });
  const shimmerTranslate = shimmerX.interpolate({ inputRange: [0, 1], outputRange: [-SIZE, SIZE] });

  const colors = getRingColors(ringTheme, { isPro, isElite });

  return (
    <Animated.View style={{ transform: [{ translateY }, { scale }, ...(chatBubbleAnimation === 'pulse' && !shouldReduceMotion ? [{ scale: pulseScale }] as any : [])], opacity }}>
      {/* Glow ring */}
      {!shouldReduceMotion && chatBubbleAnimation === 'glow' && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -(SIZE * 0.12),
            left: -(SIZE * 0.12),
            width: SIZE * 1.24,
            height: SIZE * 1.24,
            borderRadius: (SIZE * 1.24) / 2,
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
            backgroundColor: colors[0],
            zIndex: -1,
          }}
        />
      )}

      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: SIZE,
          height: SIZE,
          borderRadius: SIZE / 2,
          padding: RING_PAD,
          ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 7 }, android: { elevation: 8 } }),
        }}
      >
        <View style={{ flex: 1, borderRadius: (SIZE - RING_PAD * 2) / 2, overflow: 'hidden', backgroundColor: '#0B1220', alignItems: 'center', justifyContent: 'center' }}>
          <Image
            source={require('../../assets/images/icon.png')}
            style={{ width: SIZE - 8, height: SIZE - 8, borderRadius: (SIZE - 8) / 2, resizeMode: 'cover' }}
          />

          {!shouldReduceMotion && chatBubbleAnimation === 'shimmer' && (
            <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, width: SIZE * 0.3, transform: [{ translateX: shimmerTranslate }, { rotate: '20deg' }], opacity: 0.2 }}>
              <LinearGradient colors={[ 'transparent', 'rgba(255,255,255,0.9)', 'transparent' ]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} />
            </Animated.View>
          )}

          <View style={{ position: 'absolute', bottom: 3, right: 3, backgroundColor: '#FFFFFF', borderRadius: 8, paddingHorizontal: 4, paddingVertical: 2 }}>
            <Text style={{ fontSize: 9, fontWeight: '800', color: isElite ? '#8B5CF6' : isPro ? '#F59E0B' : '#0891B2' }}>{isElite ? 'ELITE' : isPro ? 'PRO' : 'AI'}</Text>
          </View>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}
