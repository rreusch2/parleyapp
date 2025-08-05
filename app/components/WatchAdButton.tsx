import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Alert,
  ActivityIndicator 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Play, Gift } from 'lucide-react-native';
import { 
  rewardAdService, 
  canWatchPicksAd, 
  canWatchTrendsAd, 
  getDailyAdTracker,
  type RewardType 
} from '../services/rewardAdService';
import { isAdMobAvailable } from '../services/admobUtils';

interface WatchAdButtonProps {
  rewardType: RewardType;
  onRewardEarned?: () => void;
  style?: any;
}

const WatchAdButton: React.FC<WatchAdButtonProps> = ({ 
  rewardType, 
  onRewardEarned,
  style 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [canWatch, setCanWatch] = useState(false);
  const [rewardsEarned, setRewardsEarned] = useState(0);
  const maxRewards = 3;

  // Check if user can watch ads and get current count
  const checkAdStatus = async () => {
    try {
      console.log(`🔍 Checking ad status for ${rewardType}...`);
      
      const canWatchAd = rewardType === 'extra_pick' 
        ? await canWatchPicksAd() 
        : await canWatchTrendsAd();
      
      const tracker = await getDailyAdTracker();
      const earned = rewardType === 'extra_pick' 
        ? tracker.extraPicksEarned 
        : tracker.extraTrendsEarned;

      console.log(`📊 Ad status: canWatch=${canWatchAd}, earned=${earned}/3, isAdMobAvailable=${isAdMobAvailable}`);
      
      setCanWatch(canWatchAd);
      setRewardsEarned(earned);
    } catch (error) {
      console.error('Error checking ad status:', error);
    }
  };

  useEffect(() => {
    checkAdStatus();
  }, [rewardType]);

  const handleWatchAd = async () => {
    if (isLoading || !canWatch) {
      console.log(`❌ Cannot watch ad: loading=${isLoading}, canWatch=${canWatch}`);
      return;
    }

    console.log(`🎬 Starting ad watch process for ${rewardType}`);
    setIsLoading(true);
    
    try {
      console.log('📞 Calling rewardAdService.showRewardedAd...');
      const success = await rewardAdService.showRewardedAd(rewardType);
      console.log(`📊 Ad result: ${success ? 'SUCCESS' : 'FAILED'}`);
      
      if (success) {
        Alert.alert(
          "Reward Earned! 🎉",
          rewardType === 'extra_pick' 
            ? "You've unlocked 1 extra pick!" 
            : "You've unlocked 1 extra trend!",
          [
            {
              text: "Awesome!",
              onPress: () => {
                onRewardEarned?.();
                checkAdStatus(); // Refresh status
              }
            }
          ]
        );
      } else {
        Alert.alert(
          "Ad Not Available",
          "The ad couldn't load right now. Please try again later.",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error('Error showing ad:', error);
      Alert.alert(
        "Error",
        "Something went wrong. Please try again later.",
        [{ text: "OK" }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Don't show button if user has reached daily limit or AdMob not available
  if (!canWatch || !isAdMobAvailable) {
    console.log(`🚫 Not showing ad button: canWatch=${canWatch}, isAdMobAvailable=${isAdMobAvailable}`);
    return null;
  }

  const rewardText = rewardType === 'extra_pick' ? 'Pick' : 'Trend';
  const remainingRewards = maxRewards - rewardsEarned;

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={styles.button}
        onPress={handleWatchAd}
        disabled={isLoading}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#FFD700', '#FFA500']}
          style={styles.gradient}
        >
          <View style={styles.content}>
            <View style={styles.icon}>
              <Gift size={24} color="#1F2937" />
            </View>
            
            <View style={styles.textContainer}>
              <Text style={styles.title}>
                Watch Ad for Extra {rewardText}! 🎯
              </Text>
              
              <Text style={styles.subtitle}>
                Get 1 bonus {rewardText.toLowerCase()} by watching a short ad
              </Text>
              
              <Text style={styles.progress}>
                {remainingRewards} more available today
              </Text>
            </View>

            {isLoading ? (
              <ActivityIndicator size="small" color="#1F2937" />
            ) : (
              <View style={styles.playButton}>
                <Play size={16} color="#1F2937" fill="#1F2937" />
              </View>
            )}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  button: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#FFD700',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  gradient: {
    padding: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#374151',
    marginBottom: 4,
  },
  progress: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  playButton: {
    backgroundColor: 'rgba(31, 41, 55, 0.1)',
    borderRadius: 20,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
});

export default WatchAdButton;