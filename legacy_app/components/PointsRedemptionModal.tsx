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
  Gift,
  Star,
  Crown,
  Zap,
  DollarSign,
  TrendingUp,
  Award,
  Sparkles,
} from 'lucide-react-native';
import PointsService, { PointsBalance, PointsRedemption } from '../services/pointsService';
import Colors from '../constants/Colors';

interface PointsRedemptionModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
}

const PointsRedemptionModal: React.FC<PointsRedemptionModalProps> = ({
  visible,
  onClose,
  userId,
}) => {
  const [loading, setLoading] = useState(false);
  const [pointsBalance, setPointsBalance] = useState<PointsBalance>({
    totalPoints: 0,
    availablePoints: 0,
    pendingPoints: 0,
    lifetimeEarned: 0,
  });
  const [redemptions, setRedemptions] = useState<PointsRedemption[]>([]);
  const pointsService = PointsService.getInstance();

  useEffect(() => {
    if (visible) {
      loadPointsData();
    }
  }, [visible]);

  const loadPointsData = async () => {
    try {
      setLoading(true);
      const balance = await pointsService.getPointsBalance(userId);
      const options = await pointsService.getRedemptionOptions();
      
      setPointsBalance(balance);
      setRedemptions(options);
    } catch (error) {
      console.error('Error loading points data:', error);
      Alert.alert('Error', 'Failed to load points data');
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async (redemptionId: string) => {
    const redemption = redemptions.find(r => r.id === redemptionId);
    if (!redemption) return;

    Alert.alert(
      'Confirm Redemption',
      `Redeem ${redemption.points_cost} points for ${redemption.reward_description}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Redeem',
          onPress: async () => {
            try {
              setLoading(true);
              const result = await pointsService.redeemPoints(userId, redemptionId);
              
              if (result.success) {
                Alert.alert('Success!', result.message);
                await loadPointsData(); // Refresh balance
              } else {
                Alert.alert('Error', result.message);
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to redeem points. Please try again.');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const getRedemptionIcon = (reward: PointsRedemption) => {
    if (reward.upgrade_tier === 'pro') return Crown;
    if (reward.upgrade_tier === 'elite') return Star;
    return Gift;
  };

  const getRedemptionColor = (reward: PointsRedemption) => {
    if (reward.upgrade_tier === 'pro') return '#3B82F6';
    if (reward.upgrade_tier === 'elite') return '#8B5CF6';
    return '#10B981';
  };

  const renderPointsBalance = () => (
    <View style={styles.balanceContainer}>
      <LinearGradient
        colors={['#3B82F6', '#1D4ED8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.balanceGradient}
      >
        <View style={styles.balanceContent}>
          <Sparkles size={24} color="#FFFFFF" />
          <View style={styles.balanceText}>
            <Text style={styles.balanceTitle}>Your Points Balance</Text>
            <Text style={styles.balanceAmount}>
              {pointsBalance.availablePoints.toLocaleString()} points
            </Text>
            <Text style={styles.balanceValue}>
              (${(pointsBalance.availablePoints / 100).toFixed(2)} value)
            </Text>
          </View>
          <Award size={24} color="#FFFFFF" />
        </View>
      </LinearGradient>
    </View>
  );

  const renderRedemptionOption = (redemption: PointsRedemption) => {
    const Icon = getRedemptionIcon(redemption);
    const color = getRedemptionColor(redemption);
    const canAfford = pointsBalance.availablePoints >= redemption.points_cost;

    const formatDuration = (hours: number) => {
      if (hours === 24) return '1 Day';
      if (hours === 48) return '2 Days'; 
      if (hours === 72) return '3 Days';
      if (hours === 168) return '1 Week';
      return `${hours}h`;
    };

    return (
      <TouchableOpacity
        key={redemption.id}
        style={[styles.redemptionCard, !canAfford && styles.redemptionCardDisabled]}
        onPress={() => canAfford && handleRedeem(redemption.id)}
        disabled={!canAfford || loading}
      >
        <View style={styles.redemptionContent}>
          <View style={[styles.redemptionIcon, { backgroundColor: color }]}>
            <Icon size={20} color="#FFFFFF" />
          </View>
          
          <View style={styles.redemptionDetails}>
            <Text style={styles.redemptionTitle}>{redemption.reward_name}</Text>
            {redemption.duration_hours && (
              <Text style={styles.redemptionDuration}>
                {formatDuration(redemption.duration_hours)} Access
              </Text>
            )}
            <Text style={styles.redemptionCost}>
              {redemption.points_cost.toLocaleString()} points
            </Text>
          </View>

          <View style={styles.redemptionAction}>
            {canAfford ? (
              <View style={[styles.redeemButton, { backgroundColor: color }]}>
                <Text style={styles.redeemButtonText}>Claim</Text>
              </View>
            ) : (
              <Text style={styles.insufficientText}>
                Need {(redemption.points_cost - pointsBalance.availablePoints).toLocaleString()} more
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

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
            <Text style={styles.headerTitle}>Redeem Points</Text>
            <View style={styles.headerSpacer} />
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={styles.loadingText}>Loading points...</Text>
            </View>
          ) : (
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
              {/* Points Balance */}
              {renderPointsBalance()}

              {/* Redemption Options */}
              <View style={styles.redemptionsContainer}>
                <Text style={styles.sectionTitle}>Available Rewards</Text>
                {redemptions.map(renderRedemptionOption)}
              </View>

              {/* How to Earn More Points */}
              <View style={styles.earnMoreContainer}>
                <Text style={styles.earnMoreTitle}>How to Earn More Points</Text>
                <View style={styles.earnMoreItem}>
                  <TrendingUp size={16} color="#10B981" />
                  <Text style={styles.earnMoreText}>
                    Refer friends: 100 points (Pro) / 200 points (Elite)
                  </Text>
                </View>
                <View style={styles.earnMoreItem}>
                  <Gift size={16} color="#F59E0B" />
                  <Text style={styles.earnMoreText}>
                    New referrals get: 25 points instantly
                  </Text>
                </View>
              </View>
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
    marginBottom: 30,
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
  balanceValue: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.8,
    marginTop: 2,
  },
  redemptionsContainer: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  redemptionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  redemptionCardDisabled: {
    opacity: 0.5,
  },
  redemptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  redemptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  redemptionDetails: {
    flex: 1,
    marginLeft: 16,
  },
  redemptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  redemptionCost: {
    fontSize: 14,
    fontWeight: '500',
    color: '#F59E0B',
  },
  redemptionValue: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 2,
  },
  redemptionDuration: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  redemptionAction: {
    alignItems: 'flex-end',
  },
  redeemButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  redeemButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  insufficientText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 80,
  },
  earnMoreContainer: {
    marginHorizontal: 20,
    marginTop: 30,
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
});

export default PointsRedemptionModal;
