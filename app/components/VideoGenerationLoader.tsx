/**
 * 🎥 Beautiful Video Generation Loading Component
 *
 * Features:
 * - Animated loading states
 * - Progress tracking
 * - Sports-themed animations
 * - User tier-based features
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Video,
  Camera,
  Sparkles,
  Target,
  Trophy,
  Crown,
  Zap
} from 'lucide-react-native';
import { useSubscription } from '../services/subscriptionContext';
import { useUITheme } from '../services/uiThemeContext';
import { normalize } from '../services/device';

const { width: screenWidth } = Dimensions.get('window');

interface VideoGenerationLoaderProps {
  videoType: 'highlight_reel' | 'player_analysis' | 'strategy_explanation' | 'trend_analysis' | 'custom_content';
  isGenerating: boolean;
  progress?: number;
  estimatedTime?: number;
  onCancel?: () => void;
  userTier?: 'free' | 'pro' | 'elite';
}

export default function VideoGenerationLoader({
  videoType,
  isGenerating,
  progress = 0,
  estimatedTime = 45,
  onCancel,
  userTier = 'free'
}: VideoGenerationLoaderProps) {
  const { isPro, isElite } = useSubscription();
  const { theme } = useUITheme();

  const [pulseAnim] = useState(new Animated.Value(0));
  const [rotateAnim] = useState(new Animated.Value(0));
  const [sparkleAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (isGenerating) {
      // Start animations
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );

      const rotateAnimation = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        })
      );

      const sparkleAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(sparkleAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(sparkleAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      );

      pulseAnimation.start();
      rotateAnimation.start();
      sparkleAnimation.start();

      return () => {
        pulseAnimation.stop();
        rotateAnimation.stop();
        sparkleAnimation.stop();
      };
    }
  }, [isGenerating]);

  const getVideoTypeConfig = () => {
    switch (videoType) {
      case 'highlight_reel':
        return {
          icon: Video,
          title: 'Highlight Reel',
          description: 'Creating cinematic highlights',
          color: '#00E5FF',
          gradient: ['#1E40AF', '#7C3AED', '#EC4899']
        };
      case 'player_analysis':
        return {
          icon: Target,
          title: 'Player Analysis',
          description: 'Analyzing performance data',
          color: '#10B981',
          gradient: ['#059669', '#10B981', '#34D399']
        };
      case 'strategy_explanation':
        return {
          icon: Trophy,
          title: 'Strategy Guide',
          description: 'Explaining betting concepts',
          color: '#F59E0B',
          gradient: ['#D97706', '#F59E0B', '#FBBF24']
        };
      case 'trend_analysis':
        return {
          icon: Sparkles,
          title: 'Trend Analysis',
          description: 'Visualizing data patterns',
          color: '#8B5CF6',
          gradient: ['#7C3AED', '#8B5CF6', '#A78BFA']
        };
      default:
        return {
          icon: Camera,
          title: 'Custom Video',
          description: 'Generating your content',
          color: '#EC4899',
          gradient: ['#BE185D', '#EC4899', '#F472B6']
        };
    }
  };

  const config = getVideoTypeConfig();
  const IconComponent = config.icon;

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.1]
  });

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const sparkleOpacity = sparkleAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 1, 0.3]
  });

  const progressWidth = `${Math.min(progress, 100)}%`;

  if (!isGenerating) {
    return null;
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        <LinearGradient
          colors={config.gradient}
          style={styles.background}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Animated Background Elements */}
          <Animated.View
            style={[
              styles.backgroundCircle,
              {
                transform: [{ scale: pulseScale }],
                backgroundColor: `${config.color}20`
              }
            ]}
          />
          <Animated.View
            style={[
              styles.backgroundCircle2,
              {
                transform: [{ rotate }],
                backgroundColor: `${config.color}15`
              }
            ]}
          />

          {/* Main Content */}
          <View style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <Animated.View style={{ opacity: sparkleOpacity }}>
                <Sparkles size={24} color="#FFFFFF" />
              </Animated.View>
              <Text style={styles.headerTitle}>🎥 AI Video Magic</Text>
              <Text style={styles.headerSubtitle}>Powered by Sora 2</Text>
            </View>

            {/* Video Type Icon */}
            <Animated.View
              style={[
                styles.iconContainer,
                { transform: [{ scale: pulseScale }] }
              ]}
            >
              <LinearGradient
                colors={[config.color, `${config.color}80`]}
                style={styles.iconGradient}
              >
                <IconComponent size={48} color="#FFFFFF" />
              </LinearGradient>
            </Animated.View>

            {/* Video Type Info */}
            <View style={styles.videoInfo}>
              <Text style={styles.videoTitle}>{config.title}</Text>
              <Text style={styles.videoDescription}>{config.description}</Text>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBackground}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      width: progressWidth,
                      backgroundColor: config.color
                    }
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {progress.toFixed(0)}% Complete
              </Text>
            </View>

            {/* Estimated Time */}
            <View style={styles.timeContainer}>
              <Text style={styles.timeText}>
                Estimated time: {estimatedTime}s remaining
              </Text>
            </View>

            {/* User Tier Badge */}
            {isElite && (
              <View style={styles.tierBadge}>
                <Crown size={16} color="#FFD700" />
                <Text style={styles.tierText}>Elite Quality</Text>
              </View>
            )}

            {/* Cancel Button */}
            {onCancel && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={onCancel}
              >
                <Text style={styles.cancelText}>Cancel Generation</Text>
              </TouchableOpacity>
            )}

            {/* Loading Animation */}
            <View style={styles.loadingAnimation}>
              <ActivityIndicator size="large" color={config.color} />
            </View>
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    elevation: 10,
  },
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
    position: 'relative',
  },
  backgroundCircle: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    top: -50,
    right: -50,
  },
  backgroundCircle2: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    bottom: -30,
    left: -30,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: normalize(20),
  },
  header: {
    alignItems: 'center',
    marginBottom: normalize(30),
  },
  headerTitle: {
    fontSize: normalize(28),
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: normalize(8),
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: normalize(16),
    color: '#FFFFFF',
    opacity: 0.8,
    marginTop: normalize(4),
    textAlign: 'center',
  },
  iconContainer: {
    marginBottom: normalize(24),
  },
  iconGradient: {
    width: normalize(80),
    height: normalize(80),
    borderRadius: normalize(40),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  videoInfo: {
    alignItems: 'center',
    marginBottom: normalize(32),
  },
  videoTitle: {
    fontSize: normalize(24),
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: normalize(8),
    textAlign: 'center',
  },
  videoDescription: {
    fontSize: normalize(16),
    color: '#FFFFFF',
    opacity: 0.9,
    textAlign: 'center',
    lineHeight: normalize(22),
  },
  progressContainer: {
    width: '100%',
    marginBottom: normalize(24),
  },
  progressBackground: {
    height: normalize(8),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: normalize(4),
    overflow: 'hidden',
    marginBottom: normalize(8),
  },
  progressFill: {
    height: '100%',
    borderRadius: normalize(4),
  },
  progressText: {
    fontSize: normalize(14),
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '600',
  },
  timeContainer: {
    marginBottom: normalize(16),
  },
  timeText: {
    fontSize: normalize(14),
    color: '#FFFFFF',
    opacity: 0.8,
    textAlign: 'center',
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: normalize(12),
    paddingVertical: normalize(6),
    borderRadius: normalize(16),
    marginBottom: normalize(16),
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  tierText: {
    fontSize: normalize(12),
    color: '#FFD700',
    fontWeight: '600',
    marginLeft: normalize(4),
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: normalize(20),
    paddingVertical: normalize(12),
    borderRadius: normalize(20),
    marginBottom: normalize(24),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  cancelText: {
    color: '#FFFFFF',
    fontSize: normalize(14),
    fontWeight: '600',
  },
  loadingAnimation: {
    marginTop: normalize(16),
  },
});
