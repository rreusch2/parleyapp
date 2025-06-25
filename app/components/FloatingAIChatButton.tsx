import React, { useEffect, useState } from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  Animated,
  View,
  Text,
  Platform
} from 'react-native';
import { MessageCircle, Sparkles } from 'lucide-react-native';
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
  const [scaleAnimation] = useState(new Animated.Value(0));
  const [pulseAnimation] = useState(new Animated.Value(1));
  const [rotateAnimation] = useState(new Animated.Value(0));

  useEffect(() => {
    // Initial appearance animation (for all users)
    Animated.spring(scaleAnimation, {
      toValue: 1,
      tension: 50,
      friction: 5,
      useNativeDriver: true,
    }).start();

    // Continuous pulse animation (for all users)
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnimation, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Sparkle rotation animation (for all users)
    Animated.loop(
      Animated.timing(rotateAnimation, {
        toValue: 1,
        duration: 10000,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const rotateInterpolation = rotateAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View 
      style={[
        styles.container, 
        { 
          bottom, 
          right,
          transform: [
            { scale: scaleAnimation },
            { scale: pulseAnimation }
          ]
        }
      ]}
    >
      <TouchableOpacity 
        onPress={() => {
          if (onPress) {
            onPress();
          } else {
            // Use global context - set current screen context
            setChatContext({ screen: 'global' });
            setShowAIChat(true);
          }
        }} 
        activeOpacity={0.9}
      >
        <LinearGradient
          colors={['#00E5FF', '#0891B2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.button}
        >
          {/* Sparkle decoration */}
          <Animated.View 
            style={[
              styles.sparkle,
              { transform: [{ rotate: rotateInterpolation }] }
            ]}
          >
            <Sparkles size={16} color="#FFFFFF" style={{ opacity: 0.8 }} />
          </Animated.View>
          
          {/* Main icon */}
          <MessageCircle size={24} color="#FFFFFF" strokeWidth={2.5} />
          
          {/* User tier badge */}
          <View style={styles.proBadge}>
            <Text style={styles.proText}>{isPro ? 'PRO' : 'AI'}</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Glow effect */}
      <Animated.View 
        style={[
          styles.glowEffect,
          {
            transform: [{ scale: pulseAnimation }],
            opacity: pulseAnimation.interpolate({
              inputRange: [1, 1.1],
              outputRange: [0.3, 0.1],
            })
          }
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 999,
  },
  button: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  sparkle: {
    position: 'absolute',
    top: 8,
    right: 8,
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
  glowEffect: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    backgroundColor: '#00E5FF',
    borderRadius: 40,
    zIndex: -1,
  },
}); 