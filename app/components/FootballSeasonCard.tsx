import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  Easing,
  AccessibilityInfo,
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
  // Subtle shimmer animation (no entry transitions)
  const shimmerX = useRef(new Animated.Value(-screenWidth)).current;
  const SHIMMER_DURATION = 8000;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((rm) => { if (mounted) setReduceMotion(rm); })
      .catch(() => {});
    const listener = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (rm: boolean) => {
      setReduceMotion(rm);
    });
    return () => {
      mounted = false;
      // @ts-ignore - RN new API returns subscription object, older returns void
      listener?.remove?.();
    };
  }, []);

  useEffect(() => {
    // Start a very light shimmer that moves across the card slowly only if reduce motion is off.
    // No mount-time transitions for the card container itself.
    if (reduceMotion) {
      shimmerX.setValue(-screenWidth);
      return;
    }
    const anim = Animated.loop(
      Animated.timing(shimmerX, {
        toValue: screenWidth,
        duration: SHIMMER_DURATION,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => {
      anim.stop();
      shimmerX.setValue(-screenWidth);
    };
  }, [reduceMotion, screenWidth]);
  // Removed heavy entry/continuous animations to prioritize performance

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
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        style={styles.touchable}
      >
        <View style={styles.cardContainer}>
          <LinearGradient
            colors={getTierGradient()}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            {/* Subtle shimmer line */}
            <Animated.View
              pointerEvents="none"
              style={[
                styles.shimmer,
                { transform: [{ translateX: shimmerX }] },
              ]}
            >
              <LinearGradient
                colors={['transparent', 'rgba(255,255,255,0.15)', 'transparent']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.shimmerGradient}
              />
            </Animated.View>

            {/* Main Content */}
            <View style={styles.contentContainer}>
              {/* Left Side - Football Icon (static for performance) */}
              <View style={styles.footballContainer}>
                <View style={[styles.footballIcon, { borderColor: getTierAccentColor() }]}>
                  <Ionicons name="american-football" size={20} color="#FFFFFF" />
                </View>
              </View>

              {/* Center Content - Text (no reveal transition) */}
              <View style={styles.textContainer}>
                <View style={styles.titleRow}>
                  <Text style={styles.mainTitle}>Football Season Is Live</Text>
                </View>
                <Text style={styles.subtitle}>
                  NFL + College Football predictions now in your feed
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
              </View>

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
          </LinearGradient>
        </View>
      </TouchableOpacity>
    </View>
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
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  gradient: {
    paddingHorizontal: normalize(16),
    paddingVertical: normalize(14),
    minHeight: normalize(isTablet ? 90 : 80),
    position: 'relative',
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: normalize(100),
    opacity: 0.2,
  },
  shimmerGradient: {
    flex: 1,
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

export default React.memo(FootballSeasonCard);
