import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  Star,
  Crown,
  Timer,
  Award,
  Sparkles,
  Clock,
  Zap,
  TrendingUp,
} from 'lucide-react-native';
import { referralsService, ReferralReward, ReferralStatus } from '../services/api/referralsService';

interface TimeBasedRewardsModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
}

const TimeBasedRewardsModal: React.FC<TimeBasedRewardsModalProps> = ({
  visible,
  onClose,
  userId,
}) => {
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [rewards, setRewards] = useState<ReferralReward[]>([]);
  const [status, setStatus] = useState<ReferralStatus | null>(null);

  useEffect(() => {
    if (visible) {
      loadRewardsData();
    }
  }, [visible]);

  const loadRewardsData = async () => {
    try {
      setLoading(true);
      const [rewardsResult, statusResult] = await Promise.all([
        referralsService.getRewards(),
        referralsService.getReferralStatus(),
      ]);

      if (rewardsResult.success && rewardsResult.rewards) {
        setRewards(rewardsResult.rewards);
      }

      if (statusResult.success && statusResult.data) {
        setStatus(statusResult.data);
      }
    } catch (error) {
      console.error('Error loading rewards data:', error);
      Alert.alert('Error', 'Failed to load rewards data');
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async (rewardId: string) => {
    if (!status) return;

    const reward = rewards.find(r => r.id === rewardId);
    if (!reward) return;

    if (status.points.available < reward.points_cost) {
      Alert.alert(
        'Insufficient Points',
        `You need ${reward.points_cost - status.points.available} more points to claim this reward.`,
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Claim Reward',
      `Use ${reward.points_cost} points to get ${reward.reward_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Claim',
          onPress: async () => {
            try {
              setClaiming(rewardId);
              const result = await referralsService.claimReward(rewardId);
              
              if (result.success) {
                Alert.alert('Success! 🎉', result.message);
                await loadRewardsData(); // Refresh data
              } else {
                Alert.alert('Error', result.error || 'Failed to claim reward');
              }
            } catch (error) {
              Alert.alert('Error', 'Something went wrong. Please try again.');
            } finally {
              setClaiming(null);
            }
          },
        },
      ]
    );
  };

  const getTierGradient = (tier?: string) => {
    switch (tier?.toLowerCase()) {
      case 'pro':
        return ['#3B82F6', '#1D4ED8'];
      case 'elite':
        return ['#F59E0B', '#D97706'];
      default:
        return ['#6B7280', '#4B5563'];
    }
  };

  const getTierIcon = (tier?: string) => {
    switch (tier?.toLowerCase()) {
      case 'pro':
        return Star;
      case 'elite':
        return Crown;
      default:
        return Award;
    }
  };

  const renderPointsBalance = () => (
    <View style={styles.balanceContainer}>
      <LinearGradient
        colors={['#8B5CF6', '#7C3AED']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.balanceGradient}
      >
        <View style={styles.balanceContent}>
          <Sparkles size={24} color="#FFFFFF" />
          <View style={styles.balanceText}>
            <Text style={styles.balanceTitle}>Referral Points</Text>
            <Text style={styles.balanceAmount}>
              {status?.points.available.toLocaleString() || '0'} points
            </Text>
            {status?.points.pending && status.points.pending > 0 && (
              <Text style={styles.pendingText}>
                +{status.points.pending} pending
              </Text>
            )}
          </View>
          <Award size={24} color="#FFFFFF" />
        </View>
      </LinearGradient>
    </View>
  );

  const renderActiveUpgrades = () => {
    if (!status?.activeClaims || status.activeClaims.length === 0) return null;

    return (
      <View style={styles.activeUpgradesContainer}>
        <Text style={styles.sectionTitle}>Active Rewards</Text>
        {status.activeClaims.map((claim) => {
          const TierIcon = getTierIcon(claim.referral_rewards.upgrade_tier);
          const gradient = getTierGradient(claim.referral_rewards.upgrade_tier);
          const timeRemaining = claim.expires_at ? 
            referralsService.formatTimeRemaining(claim.expires_at) : 
            'Permanent';

          return (
            <View key={claim.id} style={styles.activeUpgradeCard}>
              <LinearGradient
                colors={gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.activeUpgradeGradient}
              >
                <View style={styles.activeUpgradeContent}>
                  <TierIcon size={20} color="#FFFFFF" />
                  <View style={styles.activeUpgradeText}>
                    <Text style={styles.activeUpgradeTitle}>
                      {claim.referral_rewards.reward_name}
                    </Text>
                    <Text style={styles.activeUpgradeTime}>
                      <Clock size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                      {timeRemaining}
                    </Text>
                  </View>
                  <Zap size={16} color="#FFFFFF" />
                </View>
              </LinearGradient>
            </View>
          );
        })}
      </View>
    );
  };

  const renderReward = (reward: ReferralReward) => {
    const TierIcon = getTierIcon(reward.upgrade_tier);
    const gradient = getTierGradient(reward.upgrade_tier);
    const canAfford = status ? status.points.available >= reward.points_cost : false;
    const isClaiming = claiming === reward.id;

    return (
      <TouchableOpacity
        key={reward.id}
        style={[styles.rewardCard, !canAfford && styles.rewardCardDisabled]}
        onPress={() => canAfford && !isClaiming && handleClaim(reward.id)}
        disabled={!canAfford || isClaiming}
      >
        <View style={styles.rewardContent}>
          <LinearGradient
            colors={gradient}
            style={styles.rewardIconContainer}
          >
            <TierIcon size={24} color="#FFFFFF" />
          </LinearGradient>
          
          <View style={styles.rewardDetails}>
            <Text style={styles.rewardTitle}>{reward.reward_name}</Text>
            <Text style={styles.rewardDescription} numberOfLines={2}>
              {reward.reward_description}
            </Text>
            <View style={styles.rewardMeta}>
              <Text style={styles.rewardCost}>
                {reward.points_cost.toLocaleString()} points
              </Text>
              {reward.duration_hours && (
                <Text style={styles.rewardDuration}>
                  <Timer size={12} color="#94A3B8" /> {reward.duration_hours}h access
                </Text>
              )}
            </View>
          </View>

          <View style={styles.rewardAction}>
            {isClaiming ? (
              <ActivityIndicator size="small" color="#3B82F6" />
            ) : canAfford ? (
              <LinearGradient
                colors={gradient}
                style={styles.claimButton}
              >
                <Text style={styles.claimButtonText}>Claim</Text>
              </LinearGradient>
            ) : (
              <Text style={styles.insufficientText}>
                Need {(reward.points_cost - (status?.points.available || 0)).toLocaleString()} more
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEarnMorePoints = () => (
    <View style={styles.earnMoreContainer}>
      <Text style={styles.earnMoreTitle}>Earn More Points</Text>
      <View style={styles.earnMoreItem}>
        <TrendingUp size={16} color="#10B981" />
        <Text style={styles.earnMoreText}>
          Share your referral code: <Text style={styles.referralCode}>{status?.referralCode}</Text>
        </Text>
      </View>
      <View style={styles.earnMoreItem}>
        <Star size={16} color="#F59E0B" />
        <Text style={styles.earnMoreText}>
          Get 100 points when a friend subscribes to Pro
        </Text>
      </View>
      <View style={styles.earnMoreItem}>
        <Crown size={16} color="#8B5CF6" />
        <Text style={styles.earnMoreText}>
          Get 200 points when a friend subscribes to Elite
        </Text>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <LinearGradient
          colors={['#0F172A', '#1E293B', '#3B82F6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={24} color="#94A3B8" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Claim Rewards</Text>
            <View style={styles.headerSpacer} />
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={styles.loadingText}>Loading rewards...</Text>
            </View>
          ) : (
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
              {/* Points Balance */}
              {renderPointsBalance()}

              {/* Active Upgrades */}
              {renderActiveUpgrades()}

              {/* Available Rewards */}
              <View style={styles.rewardsContainer}>
                <Text style={styles.sectionTitle}>Available Rewards</Text>
                {rewards.length > 0 ? (
                  rewards.map(renderReward)
                ) : (
                  <Text style={styles.noRewardsText}>
                    No rewards available at this time
                  </Text>
                )}
              </View>

              {/* How to Earn More */}
              {renderEarnMorePoints()}
            </ScrollView>
          )}
        </LinearGradient>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#94A3B8',
  },
  scrollView: {
    flex: 1,
  },
  balanceContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  balanceGradient: {
    padding: 20,
  },
  balanceContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceText: {
    flex: 1,
    marginLeft: 16,
    marginRight: 16,
  },
  balanceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.9,
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 4,
  },
  pendingText: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.7,
    marginTop: 2,
  },
  activeUpgradesContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  activeUpgradeCard: {
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  activeUpgradeGradient: {
    padding: 16,
  },
  activeUpgradeContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeUpgradeText: {
    flex: 1,
    marginLeft: 12,
  },
  activeUpgradeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  activeUpgradeTime: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rewardsContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  noRewardsText: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 20,
  },
  rewardCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  rewardCardDisabled: {
    opacity: 0.5,
  },
  rewardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  rewardIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rewardDetails: {
    flex: 1,
    marginLeft: 16,
  },
  rewardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  rewardDescription: {
    fontSize: 14,
    color: '#CBD5E1',
    marginBottom: 8,
    lineHeight: 20,
  },
  rewardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rewardCost: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
  },
  rewardDuration: {
    fontSize: 12,
    color: '#94A3B8',
    flexDirection: 'row',
    alignItems: 'center',
  },
  rewardAction: {
    marginLeft: 16,
    alignItems: 'center',
    minWidth: 70,
  },
  claimButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  claimButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  insufficientText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 14,
  },
  earnMoreContainer: {
    marginHorizontal: 20,
    marginBottom: 40,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
  },
  earnMoreTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  earnMoreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  earnMoreText: {
    fontSize: 14,
    color: '#CBD5E1',
    marginLeft: 12,
    flex: 1,
  },
  referralCode: {
    fontWeight: '600',
    color: '#F59E0B',
  },
});

export default TimeBasedRewardsModal;
