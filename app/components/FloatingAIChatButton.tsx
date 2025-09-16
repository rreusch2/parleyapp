import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSubscription } from '@/app/services/subscriptionContext';
import { useAIChat } from '@/app/services/aiChatContext';

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
  const { isPro } = useSubscription();
  const { setShowAIChat, setChatContext } = useAIChat();
  const [appearScale] = useState(new Animated.Value(0));
  const [pressScale] = useState(new Animated.Value(1));
  const [breath] = useState(new Animated.Value(0));

  // Adaptive sizing for tablet vs phone
  const { width: screenWidth } = Dimensions.get('window');
  const isTablet = screenWidth > 768;
  const SIZE = isTablet ? 68 : 56; // overall button size
  const RING_PAD = 2; // gradient ring thickness

  useEffect(() => {
    // Gentle appear animation
    Animated.spring(appearScale, {
      toValue: 1,
      tension: 60,
      friction: 7,
      useNativeDriver: true,
    }).start();

    // Subtle breathing for ambient presence (very low amplitude, slow)
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
  }, []);

  const ringScale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });
  const ringOpacity = breath.interpolate({ inputRange: [0, 1], outputRange: [0.06, 0.14] });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          bottom,
          right,
          transform: [{ scale: appearScale }, { scale: pressScale }],
        },
      ]}
    >
      {/* Ambient breathing glow ring */}
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
          backgroundColor: '#00E5FF',
          zIndex: -1,
        }}
      />

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
          colors={["#00E5FF", "#0891B2"]}
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