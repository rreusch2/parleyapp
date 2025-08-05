import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Play, Gift, Trophy, Target, Sparkles, CheckCircle } from 'lucide-react-native';
import { normalize, isTablet } from '../services/device';
import { rewardedAdService, RewardType } from '../services/rewardedAdService';
import { useSubscription } from '../services/subscriptionContext';

interface WatchAdButtonProps {
  rewardType: RewardType;
  onRewardEarned?: () => void;
  style?: any;
}

export default function WatchAdButton({ 
  rewardType, 
  onRewardEarned, 
  style 
}: WatchAdButtonProps) {
  const [loading, setLoading] = useState(false);
  const [remainingRewards, setRemainingRewards] = useState(0);
  const [earnedToday, setEarnedToday] = useState(0);
  const { isPro, isElite } = useSubscription();

  // Don't show for Pro/Elite users or on web
  if (isPro || isElite || Platform.OS === 'web') {
    return null;
  }

  const updateRewardStats = async () => {
    try {
      const remaining = await rewardedAdService.getRemainingRewards(rewardType);
      const earned = await rewardedAdService.getEarnedRewardsToday(rewardType);
      setRemainingRewards(remaining);
      setEarnedToday(earned);
    } catch (error) {
      console.error('Error updating reward stats:', error);
    }
  };

  useEffect(() => {
    updateRewardStats();
  }, [rewardType]);

  const getRewardText = () => {
    switch (rewardType) {
      case 'extra_pick':
        return {
          title: 'Watch Ad for Extra Pick',
          subtitle: 'Get 1 additional AI prediction',
          icon: <Target size={normalize(18)} color="#0F172A" />,
          rewardName: 'Pick',
        };
      case 'extra_trend':
        return {
          title: 'Watch Ad for Extra Trend',
          subtitle: 'Get 1 additional trend analysis',
          icon: <Trophy size={normalize(18)} color="#0F172A" />,
          rewardName: 'Trend',
        };
      default:
        return {
          title: 'Watch Ad for Reward',
          subtitle: 'Get additional content',
          icon: <Gift size={normalize(18)} color="#0F172A" />,
          rewardName: 'Reward',
        };
    }
  };

  const handleWatchAd = async () => {
    if (loading) return;

    // Check if user can earn more rewards
    if (remainingRewards <= 0) {
      Alert.alert(
        'Daily Limit Reached',
        `You've earned all 3 extra ${getRewardText().rewardName.toLowerCase()}s for today! Come back tomorrow for more.`,
        [{ text: 'OK' }]
      );
      return;
    }

    // Check if ad is ready
    if (!rewardedAdService.isAdReady()) {
      Alert.alert(
        'Ad Not Ready',
        'The ad is still loading. Please try again in a moment.',
        [{ text: 'OK' }]
      );
      return;
    }

    setLoading(true);

    try {
      const adType = rewardedAdService.getAdType();
      console.log(`🎬 Showing ${adType} rewarded ad for ${rewardType}`);

      const success = await rewardedAdService.showRewardedAd(rewardType);
      
      if (success) {
        // Update local state immediately
        setRemainingRewards(prev => Math.max(0, prev - 1));
        setEarnedToday(prev => prev + 1);
        
        // Call the callback to refresh parent component
        if (onRewardEarned) {
          onRewardEarned();
        }

        // Show success message
        Alert.alert(
          '🎉 Reward Earned!',
          `You've earned an extra ${getRewardText().rewardName.toLowerCase()}! Check it out below.`,
          [{ text: 'Awesome!' }]
        );
      } else {
        Alert.alert(
          'Ad Error',
          'Unable to show the ad right now. Please try again later.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error showing rewarded ad:', error);
      Alert.alert(
        'Error',
        'Something went wrong. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
      // Refresh stats from service
      setTimeout(updateRewardStats, 1000);
    }
  };

  const rewardText = getRewardText();

  // Don't show button if no rewards remaining
  if (remainingRewards <= 0) {
    return (
      <View style={[styles.container, styles.completedContainer, style]}>
        <LinearGradient
          colors={['#22C55E', '#16A34A']}
          style={styles.completedGradient}
        >
          <CheckCircle size={normalize(20)} color="#FFFFFF" />
          <View style={styles.completedTextContainer}>
            <Text style={styles.completedTitle}>All Rewards Earned!</Text>
            <Text style={styles.completedSubtitle}>
              {earnedToday}/3 extra {getRewardText().rewardName.toLowerCase()}s earned today
            </Text>
          </View>
          <Sparkles size={normalize(16)} color="#FFFFFF" />
        </LinearGradient>
      </View>
    );
  }

  return (
    <TouchableOpacity 
      style={[styles.container, style]} 
      onPress={handleWatchAd}
      disabled={loading}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={loading ? ['#6B7280', '#4B5563'] : ['#F59E0B', '#D97706']}
        style={styles.gradient}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Play size={normalize(18)} color="#0F172A" />
        )}
        
        <View style={styles.textContainer}>
          <Text style={styles.title}>
            {loading ? 'Loading Ad...' : rewardText.title}
          </Text>
          <Text style={styles.subtitle}>
            {loading ? 'Please wait' : rewardText.subtitle}
          </Text>
        </View>

        <View style={styles.rewardBadge}>
          <Text style={styles.rewardBadgeText}>{remainingRewards}</Text>
        </View>
      </LinearGradient>
      
      {/* Progress indicator */}
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${(earnedToday / 3) * 100}%` }
            ]} 
          />
        </View>
        <Text style={styles.progressText}>
          {earnedToday}/3 earned today
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: normalize(16),
    marginVertical: normalize(8),
    borderRadius: normalize(16),
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: normalize(20),
    paddingVertical: normalize(16),
  },
  textContainer: {
    flex: 1,
    marginLeft: normalize(12),
  },
  title: {
    fontSize: normalize(16),
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: normalize(2),
  },
  subtitle: {
    fontSize: normalize(13),
    color: '#374151',
    fontWeight: '500',
  },
  rewardBadge: {
    backgroundColor: 'rgba(15, 23, 42, 0.1)',
    borderRadius: normalize(12),
    paddingHorizontal: normalize(8),
    paddingVertical: normalize(4),
    marginLeft: normalize(8),
  },
  rewardBadgeText: {
    fontSize: normalize(12),
    fontWeight: '700',
    color: '#0F172A',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: normalize(20),
    paddingBottom: normalize(12),
  },
  progressTrack: {
    flex: 1,
    height: normalize(4),
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: normalize(2),
    marginRight: normalize(8),
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#22C55E',
    borderRadius: normalize(2),
  },
  progressText: {
    fontSize: normalize(11),
    color: '#6B7280',
    fontWeight: '500',
  },
  completedContainer: {
    opacity: 0.8,
  },
  completedGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: normalize(20),
    paddingVertical: normalize(16),
  },
  completedTextContainer: {
    flex: 1,
    marginLeft: normalize(12),
  },
  completedTitle: {
    fontSize: normalize(16),
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: normalize(2),
  },
  completedSubtitle: {
    fontSize: normalize(13),
    color: '#D1FAE5',
    fontWeight: '500',
  },
});