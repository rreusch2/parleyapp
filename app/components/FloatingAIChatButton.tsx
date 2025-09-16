import React, { useEffect, useRef, useState } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  Animated,
  View,
  Text,
  Platform,
  Image,
  Easing,
  Dimensions,
  PanResponder,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSubscription } from '../services/subscriptionContext';
import { useAIChat } from '../services/aiChatContext';
import { useUISettings } from '../services/uiSettingsContext';
import { getRingColors } from '../utils/chatBubbleTheme';

interface FloatingAIChatButtonProps {
  onPress?: () => void; // Made optional since we'll use context
  bottom?: number;
  right?: number;
}

export default function FloatingAIChatButton({ 
  onPress, 
  bottom = 110, 
  right = 20 
}: FloatingAIChatButtonProps) {
  const { isPro, isElite } = useSubscription();
  const { setShowAIChat, setChatContext } = useAIChat();
  const { chatBubbleAnimation, bubbleSize, shouldReduceMotion, ringTheme } = useUISettings();
  const [appearScale] = useState(new Animated.Value(0));
  const [pressScale] = useState(new Animated.Value(1));
  const [breath] = useState(new Animated.Value(0));
  const [pulse] = useState(new Animated.Value(0));
  const [shimmerX] = useState(new Animated.Value(0));
  const drag = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  // Adaptive sizing for tablet vs phone
  const { width: screenWidth } = Dimensions.get('window');
  const isTablet = screenWidth > 768;
  const SIZE = (() => {
    if (bubbleSize === 'compact') return isTablet ? 60 : 50;
    return isTablet ? 68 : 56;
  })();
  const RING_PAD = 2; // gradient ring thickness
  const SIDE_MARGIN = 20;
  const TOP_SPACING = isTablet ? 32 : 20;
  const STORAGE_KEY = 'pp_fab_corner_v1';

  type Corner = 'bottomRight' | 'bottomLeft' | 'topRight' | 'topLeft';
  const [corner, setCorner] = useState<Corner>('bottomRight');

  useEffect(() => {
    // Gentle appear animation
    Animated.spring(appearScale, {
      toValue: 1,
      tension: 60,
      friction: 7,
      useNativeDriver: true,
    }).start();

    // Load persisted corner preference
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved === 'bottomLeft' || saved === 'bottomRight' || saved === 'topLeft' || saved === 'topRight') {
          setCorner(saved);
        }
      } catch {}
    })();
  }, []);


  // Handle animation mode changes
  useEffect(() => {
    // Reset values
    breath.setValue(0);
    pulse.setValue(0);
    shimmerX.setValue(0);

    if (shouldReduceMotion || chatBubbleAnimation === 'static') {
      return; // No continuous animations
    }

    if (chatBubbleAnimation === 'glow') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(breath, {
            toValue: 1,
            duration: 4200,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(breath, {
            toValue: 0,
            duration: 4200,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else if (chatBubbleAnimation === 'pulse') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1,
            duration: 2800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 0,
            duration: 2800,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else if (chatBubbleAnimation === 'shimmer') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerX, {
            toValue: 1,
            duration: 3200,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerX, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [chatBubbleAnimation, shouldReduceMotion]);

  const ringScale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });
  const ringOpacity = breath.interpolate({ inputRange: [0, 1], outputRange: [0.06, 0.14] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });
  const shimmerTranslate = shimmerX.interpolate({ inputRange: [0, 1], outputRange: [-SIZE, SIZE] });

  // PanResponder for drag gesture (activates only on movement)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gesture) => Math.abs(gesture.dx) + Math.abs(gesture.dy) > 2,
      onPanResponderGrant: () => {
        drag.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: drag.x, dy: drag.y }], { useNativeDriver: false }),
      onPanResponderRelease: async (_evt, gesture) => {
        const { width, height } = Dimensions.get('window');

        // Compute initial anchor in absolute coords based on current corner
        const initialX =
          corner === 'bottomRight' || corner === 'topRight'
            ? width - (right ?? SIDE_MARGIN) - SIZE
            : SIDE_MARGIN;
        const initialY =
          corner === 'bottomRight' || corner === 'bottomLeft'
            ? height - (bottom ?? 95) - SIZE
            : TOP_SPACING;

        const finalCenterX = initialX + gesture.dx + SIZE / 2;
        const finalCenterY = initialY + gesture.dy + SIZE / 2;

        const newCorner: Corner = (finalCenterY < height / 2 ? 'top' : 'bottom') + (finalCenterX < width / 2 ? 'Left' : 'Right') as Corner;
        setCorner(newCorner);
        try {
          await AsyncStorage.setItem(STORAGE_KEY, newCorner);
        } catch {}

        // Reset drag offset after snapping
        drag.setValue({ x: 0, y: 0 });
      },
    })
  ).current;

  return (
    <Animated.View
      style={[
        styles.container,
        // Corner-based anchoring
        corner === 'bottomRight'
          ? { bottom, right }
          : corner === 'bottomLeft'
            ? { bottom, left: SIDE_MARGIN }
            : corner === 'topRight'
              ? { top: TOP_SPACING, right: SIDE_MARGIN }
              : { top: TOP_SPACING, left: SIDE_MARGIN },
        { transform: [
            { translateX: drag.x },
            { translateY: drag.y },
            { scale: appearScale },
            // apply subtle pulse scale only if chosen
            ...(chatBubbleAnimation === 'pulse' && !shouldReduceMotion ? [{ scale: pulseScale }] as any : []),
            { scale: pressScale },
          ]
        },
      ]}
      {...panResponder.panHandlers}
    >
      {/* Ambient breathing glow ring */}
      {(!shouldReduceMotion && chatBubbleAnimation === 'glow') && (
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
          backgroundColor: getRingColors(ringTheme, { isPro, isElite })[0],
          zIndex: -1,
        }}
      />)}

      <TouchableOpacity
        onPress={() => {
          if (onPress) {
            onPress();
          } else {
            setChatContext({ screen: 'global' });
            setShowAIChat(true);
          }
        }}
        onPressIn={() => {
          Animated.spring(pressScale, {
            toValue: 0.96,
            useNativeDriver: true,
            stiffness: 180,
            damping: 18,
            mass: 0.6,
          }).start();
        }}
        onPressOut={() => {
          Animated.spring(pressScale, {
            toValue: 1,
            useNativeDriver: true,
            stiffness: 180,
            damping: 18,
            mass: 0.6,
          }).start();
        }}
        activeOpacity={0.9}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {/* Gradient ring with circular logo inside */}
        <LinearGradient
          colors={getRingColors(ringTheme, { isPro, isElite })}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: SIZE,
            height: SIZE,
            borderRadius: SIZE / 2,
            padding: RING_PAD,
            ...Platform.select({
              ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 7,
              },
              android: { elevation: 8 },
            }),
          }}
        >
          <View
            style={{
              flex: 1,
              borderRadius: (SIZE - RING_PAD * 2) / 2,
              overflow: 'hidden',
              backgroundColor: '#0B1220',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Image
              // Static require ensures Metro bundles the asset
              source={require('../../assets/images/icon.png')}
              style={{
                width: SIZE - 8,
                height: SIZE - 8,
                borderRadius: (SIZE - 8) / 2,
                resizeMode: 'cover',
              }}
            />

            {/* Shimmer sweep */}
            {(!shouldReduceMotion && chatBubbleAnimation === 'shimmer') && (
              <Animated.View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  width: SIZE * 0.3,
                  transform: [{ translateX: shimmerTranslate }, { rotate: '20deg' }],
                  opacity: 0.2,
                }}
              >
                <LinearGradient
                  colors={[ 'transparent', 'rgba(255,255,255,0.9)', 'transparent' ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ flex: 1 }}
                />
              </Animated.View>
            )}

            {/* User tier badge */}
            <View style={[styles.proBadge, { bottom: 3, right: 3 }]}> 
              <Text style={styles.proText}>{isPro ? 'PRO' : 'AI'}</Text>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 999,
  },
  proBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  proText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0891B2',
  },
}); 