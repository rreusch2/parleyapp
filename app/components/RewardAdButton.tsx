import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gift, Play } from 'lucide-react-native';
import { useAdMob } from '../hooks/useAdMob';

interface RewardAdButtonProps {
  onRewardEarned?: () => void;
  title?: string;
  subtitle?: string;
  disabled?: boolean;
  style?: any;
  size?: 'small' | 'medium' | 'large';
}

export default function RewardAdButton({
  onRewardEarned,
  title = "Watch Ad for Reward",
  subtitle = "Get bonus features",
  disabled = false,
  style,
  size = 'medium'
}: RewardAdButtonProps) {
  const { isAdReady, showRewardedAd, isTestMode } = useAdMob();

  const handlePress = async () => {
    if (disabled || !isAdReady) return;
    
    await showRewardedAd();
    
    // Call reward callback if provided
    if (onRewardEarned) {
      onRewardEarned();
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          container: styles.smallContainer,
          title: styles.smallTitle,
          subtitle: styles.smallSubtitle,
          icon: 16,
        };
      case 'large':
        return {
          container: styles.largeContainer,
          title: styles.largeTitle,
          subtitle: styles.largeSubtitle,
          icon: 28,
        };
      default:
        return {
          container: styles.mediumContainer,
          title: styles.mediumTitle,
          subtitle: styles.mediumSubtitle,
          icon: 20,
        };
    }
  };

  const sizeStyles = getSizeStyles();
  const isDisabled = disabled || !isAdReady;

  return (
    <TouchableOpacity
      style={[styles.button, sizeStyles.container, style]}
      onPress={handlePress}
      disabled={isDisabled}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={isDisabled 
          ? ['#374151', '#4B5563'] 
          : ['#10B981', '#059669']
        }
        style={styles.gradient}
      >
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            {!isAdReady ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Gift size={sizeStyles.icon} color="#FFFFFF" />
            )}
          </View>
          
          <View style={styles.textContainer}>
            <Text style={[styles.title, sizeStyles.title]}>
              {!isAdReady ? "Loading Ad..." : title}
            </Text>
            {subtitle && size !== 'small' && (
              <Text style={[styles.subtitle, sizeStyles.subtitle]}>
                {subtitle} {isTestMode && '(Test)'}
              </Text>
            )}
          </View>

          <View style={styles.playIconContainer}>
            <Play size={sizeStyles.icon - 4} color="#FFFFFF" fill="#FFFFFF" />
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  title: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  playIconContainer: {
    opacity: 0.8,
  },
  
  // Size variants
  smallContainer: {
    minHeight: 48,
  },
  smallTitle: {
    fontSize: 14,
  },
  smallSubtitle: {
    fontSize: 11,
  },
  
  mediumContainer: {
    minHeight: 56,
  },
  mediumTitle: {
    fontSize: 16,
  },
  mediumSubtitle: {
    fontSize: 13,
  },
  
  largeContainer: {
    minHeight: 64,
  },
  largeTitle: {
    fontSize: 18,
  },
  largeSubtitle: {
    fontSize: 14,
  },
}); 