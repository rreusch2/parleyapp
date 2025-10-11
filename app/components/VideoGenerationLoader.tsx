import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Film, Sparkles, Zap } from 'lucide-react-native';
import { normalize } from '../services/device';

const { width } = Dimensions.get('window');

interface VideoGenerationLoaderProps {
  videoType: 'ai_pick_hype' | 'game_countdown' | 'weekly_recap' | 'player_spotlight' | 'custom';
  progress?: number; // 0-100
}

export default function VideoGenerationLoader({ videoType, progress = 0 }: VideoGenerationLoaderProps) {
  // Animation values
  const spinValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(1)).current;
  const sparkleValue = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(progress)).current;

  useEffect(() => {
    // Spinning animation
    const spinAnimation = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    );

    // Pulsing animation
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    // Sparkle animation
    const sparkleAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(sparkleValue, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(sparkleValue, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    spinAnimation.start();
    pulseAnimation.start();
    sparkleAnimation.start();

    return () => {
      spinAnimation.stop();
      pulseAnimation.stop();
      sparkleAnimation.stop();
    };
  }, []);

  // Update progress animation
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const sparkleOpacity = sparkleValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const getLoadingText = () => {
    const texts: Record<string, string[]> = {
      ai_pick_hype: [
        'Generating cinematic magic ✨',
        'Crafting your AI pick story 🎬',
        'Adding stadium atmosphere 🏟️',
        'Polishing final touches 🎨',
      ],
      game_countdown: [
        'Building countdown sequence ⏰',
        'Capturing stadium lights 🌃',
        'Adding fan energy 🎉',
        'Creating epic reveal 💥',
      ],
      weekly_recap: [
        'Compiling your victories 🏆',
        'Adding celebration moments 🎊',
        'Highlighting your wins 🌟',
        'Creating your highlight reel 🎥',
      ],
      player_spotlight: [
        'Focusing on player action ⚡',
        'Gathering performance stats 📊',
        'Creating highlight moments 🌟',
        'Polishing the spotlight 💫',
      ],
      custom: [
        'Bringing your vision to life 🎨',
        'Crafting custom scenes 🎬',
        'Adding creative flair ✨',
        'Finalizing masterpiece 🎭',
      ],
    };

    const stages = texts[videoType] || texts.ai_pick_hype;
    const stageIndex = Math.floor((progress / 100) * (stages.length - 1));
    return stages[stageIndex];
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(0, 229, 255, 0.1)', 'rgba(139, 92, 246, 0.1)', 'rgba(236, 72, 153, 0.1)']}
        style={styles.gradient}
      >
        {/* Animated Film Icon */}
        <View style={styles.iconContainer}>
          <Animated.View
            style={[
              styles.filmIconWrapper,
              {
                transform: [{ rotate: spin }, { scale: pulseValue }],
              },
            ]}
          >
            <Film size={60} color="#00E5FF" strokeWidth={2} />
          </Animated.View>

          {/* Sparkles around the icon */}
          <Animated.View style={[styles.sparkle, styles.sparkleTopLeft, { opacity: sparkleOpacity }]}>
            <Sparkles size={16} color="#FFD700" />
          </Animated.View>
          <Animated.View
            style={[
              styles.sparkle,
              styles.sparkleTopRight,
              { opacity: sparkleOpacity, transform: [{ scale: 1.2 }] },
            ]}
          >
            <Sparkles size={14} color="#FF1493" />
          </Animated.View>
          <Animated.View
            style={[
              styles.sparkle,
              styles.sparkleBottomLeft,
              { opacity: sparkleOpacity, transform: [{ scale: 0.9 }] },
            ]}
          >
            <Zap size={18} color="#00E5FF" />
          </Animated.View>
          <Animated.View style={[styles.sparkle, styles.sparkleBottomRight, { opacity: sparkleOpacity }]}>
            <Sparkles size={15} color="#8B5CF6" />
          </Animated.View>
        </View>

        {/* Loading Text */}
        <Text style={styles.loadingTitle}>Creating Your Video</Text>
        <Text style={styles.loadingSubtitle}>{getLoadingText()}</Text>

        {/* Progress Bar */}
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBackground}>
            <Animated.View
              style={[
                styles.progressBarFill,
                {
                  width: progressWidth,
                },
              ]}
            >
              <LinearGradient
                colors={['#00E5FF', '#8B5CF6', '#EC4899']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFillObject}
              />
            </Animated.View>
          </View>
          <Text style={styles.progressText}>{Math.round(progress)}%</Text>
        </View>

        {/* Tips */}
        <View style={styles.tipContainer}>
          <Text style={styles.tipText}>💡 This usually takes 30-60 seconds</Text>
          <Text style={styles.tipText}>✨ Your video will auto-save to your gallery</Text>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    marginVertical: 16,
  },
  gradient: {
    padding: 32,
    alignItems: 'center',
  },
  iconContainer: {
    position: 'relative',
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  filmIconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkle: {
    position: 'absolute',
  },
  sparkleTopLeft: {
    top: 0,
    left: 0,
  },
  sparkleTopRight: {
    top: 0,
    right: 0,
  },
  sparkleBottomLeft: {
    bottom: 0,
    left: 0,
  },
  sparkleBottomRight: {
    bottom: 0,
    right: 0,
  },
  loadingTitle: {
    fontSize: normalize(24),
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  loadingSubtitle: {
    fontSize: normalize(16),
    fontWeight: '600',
    color: '#00E5FF',
    marginBottom: 32,
    textAlign: 'center',
  },
  progressBarContainer: {
    width: '100%',
    marginBottom: 24,
  },
  progressBarBackground: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: normalize(14),
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  tipContainer: {
    alignItems: 'center',
    gap: 8,
  },
  tipText: {
    fontSize: normalize(12),
    color: '#94A3B8',
    textAlign: 'center',
    fontWeight: '500',
  },
});

