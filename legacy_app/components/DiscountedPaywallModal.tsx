import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  Crown,
  Trophy,
  Sparkles,
  ChevronRight,
  Gift,
  Clock,
  Zap,
  Star,
  TrendingUp,
  BarChart3,
  Brain,
  Check,
} from 'lucide-react-native';
import revenueCatService, { SubscriptionPlan, SubscriptionTier } from '../services/revenueCatService';
import { useSubscription } from '../services/subscriptionContext';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface DiscountedPaywallModalProps {
  visible: boolean;
  onClose: () => void;
  onContinueFree: () => void;
  onPurchaseSuccess?: () => void;
}

const DiscountedPaywallModal: React.FC<DiscountedPaywallModalProps> = ({
  visible,
  onClose,
  onContinueFree,
  onPurchaseSuccess,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<string>('pro_monthly'); // Default to Pro monthly discount
  const [loading, setLoading] = useState(false);
  const [packages, setPackages] = useState<any[]>([]);
  const [countdownTime, setCountdownTime] = useState('23:59:59');
  const { subscribe } = useSubscription();
  const pulseAnimation = React.useRef(new Animated.Value(1)).current;

  // Discount plan mapping with promotional offer codes
  const discountPlans = [
    {
      id: 'pro_weekly',
      tier: 'pro',
      name: 'Weekly Pro',
      originalPrice: '$12.49',
      discountPrice: '$9.99',
      discountPercentage: '20% OFF',
      period: 'per week',
      promoCode: 'com.parleyapp.wpdis', // Your promotional offer code
      icon: <Zap size={20} color="#3B82F6" />,
      gradient: ['#3B82F6', '#1D4ED8'],
      features: ['20 AI Picks Daily', 'Unlimited Chat', '8 Expert Insights'],
      badge: null,
    },
    {
      id: 'pro_monthly',
      tier: 'pro',
      name: 'Monthly Pro',
      originalPrice: '$24.99',
      discountPrice: '$19.99',
      discountPercentage: '20% OFF',
      period: 'first month',
      promoCode: 'com.parleyapp.mpdis', // Your promotional offer code
      icon: <Crown size={20} color="#3B82F6" />,
      gradient: ['#3B82F6', '#1D4ED8'],
      features: ['20 AI Picks Daily', 'Live Analytics', 'Priority Support'],
      badge: 'MOST POPULAR',
    },
    {
      id: 'elite_weekly',
      tier: 'elite',
      name: 'Weekly Elite',
      originalPrice: '$14.99',
      discountPrice: '$12.99',
      discountPercentage: '13% OFF',
      period: 'per week',
      promoCode: 'com.parleyapp.wedis', // Your promotional offer code
      icon: <Trophy size={20} color="#8B5CF6" />,
      gradient: ['#8B5CF6', '#7C3AED'],
      features: ['30 Elite Picks', 'Advanced AI', '12 Pro Insights'],
      badge: null,
    },
    {
      id: 'elite_monthly',
      tier: 'elite',
      name: 'Monthly Elite',
      originalPrice: '$29.99',
      discountPrice: '$24.99',
      discountPercentage: '17% OFF',
      period: 'first month',
      promoCode: 'com.parleyapp.medis', // Your promotional offer code
      icon: <Sparkles size={20} color="#8B5CF6" />,
      gradient: ['#8B5CF6', '#7C3AED'],
      features: ['30 Elite Picks', 'Premium Analytics', 'Ultra Themes'],
      badge: 'BEST VALUE',
    },
  ];

  // Countdown timer effect
  useEffect(() => {
    if (!visible) return;
    
    const interval = setInterval(() => {
      const now = new Date();
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59);
      
      const diff = endOfDay.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setCountdownTime(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [visible]);

  // Pulse animation for urgency
  useEffect(() => {
    if (visible) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [visible]);

  // Initialize RevenueCat with discount offering
  useEffect(() => {
    if (visible) {
      initializeDiscountOffering();
    }
  }, [visible]);

  const initializeDiscountOffering = async () => {
    try {
      await revenueCatService.initialize();
      const offerings = await revenueCatService.getOfferings();
      
      // Get the discount offering you created
      const discountOffering = offerings?.all?.['Discount'];
      
      if (discountOffering) {
        setPackages(discountOffering.availablePackages);
        console.log('📱 Loaded discount offering:', discountOffering.identifier);
      } else {
        console.warn('⚠️ Discount offering not found');
      }
    } catch (error) {
      console.error('❌ Failed to load discount offering:', error);
    }
  };

  const handlePurchase = async () => {
    try {
      setLoading(true);
      const selectedPlanData = discountPlans.find(p => p.id === selectedPlan);
      
      if (!selectedPlanData) {
        Alert.alert('Error', 'Please select a subscription plan');
        return;
      }

      console.log('🔄 Starting discounted purchase for:', selectedPlan);
      console.log('📍 Using promotional code:', selectedPlanData.promoCode);
      
      // Find the package for the selected plan
      const packageToPurchase = packages.find(pkg => {
        return pkg.product.identifier.includes(selectedPlan.replace('_', ''));
      });
      
      if (packageToPurchase) {
        // Purchase with promotional offer
        const purchaseResult = await revenueCatService.purchaseDiscountedPackage(
          packageToPurchase,
          selectedPlanData.promoCode // Pass the promotional offer code
        );
        
        if (purchaseResult) {
          console.log('✅ Discounted purchase completed successfully!');
          if (onPurchaseSuccess) {
            onPurchaseSuccess();
          } else {
            onClose();
          }
        }
      } else {
        Alert.alert('Error', 'Selected plan is not available. Please try another option.');
      }
      
    } catch (error: any) {
      console.error('❌ Purchase error:', error);
      
      if (error?.message?.includes('cancelled')) {
        console.log('ℹ️ User cancelled purchase');
      } else {
        Alert.alert('Purchase Error', 'Unable to process purchase. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const renderDiscountPlan = (plan: typeof discountPlans[0]) => {
    const isSelected = selectedPlan === plan.id;
    
    return (
      <TouchableOpacity
        key={plan.id}
        style={[styles.planCard, isSelected && styles.planCardSelected]}
        onPress={() => setSelectedPlan(plan.id)}
      >
        <LinearGradient
          colors={isSelected ? plan.gradient : ['#1E293B', '#334155']}
          style={styles.planGradient}
        >
          {plan.badge && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{plan.badge}</Text>
            </View>
          )}
          
          <View style={styles.planHeader}>
            <View style={styles.planIconContainer}>
              {plan.icon}
            </View>
            <View style={styles.planInfo}>
              <Text style={styles.planName}>{plan.name}</Text>
              <View style={styles.priceRow}>
                <Text style={styles.originalPrice}>{plan.originalPrice}</Text>
                <Text style={styles.discountPrice}>{plan.discountPrice}</Text>
                <View style={styles.discountBadge}>
                  <Text style={styles.discountBadgeText}>{plan.discountPercentage}</Text>
                </View>
              </View>
              <Text style={styles.planPeriod}>{plan.period}</Text>
            </View>
            {isSelected && (
              <View style={styles.checkCircle}>
                <Check size={14} color="#0F172A" />
              </View>
            )}
          </View>
          
          <View style={styles.planFeatures}>
            {plan.features.map((feature, index) => (
              <View key={index} style={styles.featureRow}>
                <Check size={12} color={isSelected ? '#FFFFFF' : '#94A3B8'} />
                <Text style={[styles.featureText, isSelected && styles.featureTextSelected]}>
                  {feature}
                </Text>
              </View>
            ))}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <LinearGradient
          colors={['#0F172A', '#1E293B']}
          style={styles.gradient}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={24} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            style={styles.content} 
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Urgency Section */}
            <Animated.View style={[styles.urgencySection, { transform: [{ scale: pulseAnimation }] }]}>
              <LinearGradient
                colors={['#EF4444', '#DC2626']}
                style={styles.urgencyGradient}
              >
                <Gift size={24} color="#FFFFFF" />
                <View style={styles.urgencyContent}>
                  <Text style={styles.urgencyTitle}>🎉 WAIT! Exclusive One-Time Offer</Text>
                  <Text style={styles.urgencySubtitle}>This special discount expires in:</Text>
                  <View style={styles.timerContainer}>
                    <Clock size={16} color="#FFFFFF" />
                    <Text style={styles.timerText}>{countdownTime}</Text>
                  </View>
                </View>
              </LinearGradient>
            </Animated.View>

            {/* Main Content */}
            <View style={styles.mainContent}>
              <Image source={require('../../assets/images/icon.png')} style={styles.appIcon} />
              <Text style={styles.mainTitle}>You're One Step Away from Winning!</Text>
              <Text style={styles.mainSubtitle}>
                Get instant access to our premium AI picks with these exclusive discounts - 
                available only right now!
              </Text>

              {/* Value Props */}
              <View style={styles.valueProps}>
                <View style={styles.valueProp}>
                  <BarChart3 size={24} color="#10B981" />
                  <Text style={styles.valuePropText}>85% Win Rate</Text>
                </View>
                <View style={styles.valueProp}>
                  <TrendingUp size={24} color="#F59E0B" />
                  <Text style={styles.valuePropText}>+250% ROI</Text>
                </View>
                <View style={styles.valueProp}>
                  <Brain size={24} color="#8B5CF6" />
                  <Text style={styles.valuePropText}>AI-Powered</Text>
                </View>
              </View>

              {/* Discount Plans */}
              <Text style={styles.sectionTitle}>Choose Your Discounted Plan</Text>
              <View style={styles.plansContainer}>
                {discountPlans.map(plan => renderDiscountPlan(plan))}
              </View>

              {/* Social Proof */}
              <View style={styles.socialProof}>
                <View style={styles.socialProofBadge}>
                  <Star size={14} color="#F59E0B" />
                  <Text style={styles.socialProofText}>
                    Join 10,000+ users already winning with our AI picks!
                  </Text>
                </View>
              </View>

              {/* Continue Free Button */}
              <TouchableOpacity style={styles.continueFreeButton} onPress={onContinueFree}>
                <Text style={styles.continueFreeText}>No thanks, I'll continue with limited access</Text>
              </TouchableOpacity>

              {/* Trust Badges */}
              <View style={styles.trustBadges}>
                <Text style={styles.trustText}>
                  {Platform.OS === 'ios' ? '🔒 Secure checkout via Apple' : '🔒 Secure checkout via Google Play'}
                </Text>
                <Text style={styles.trustText}>✓ Cancel anytime • ✓ Instant access</Text>
              </View>
            </View>
          </ScrollView>

          {/* Floating CTA */}
          <View style={styles.floatingCTA}>
            <TouchableOpacity
              style={[styles.ctaButton, loading && styles.ctaButtonDisabled]}
              onPress={handlePurchase}
              disabled={loading}
            >
              <LinearGradient
                colors={selectedPlan?.includes('elite') ? ['#8B5CF6', '#7C3AED'] : ['#3B82F6', '#1D4ED8']}
                style={styles.ctaGradient}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.ctaText}>
                      🔥 Claim Your Discount Now
                    </Text>
                    <ChevronRight size={20} color="#FFFFFF" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
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
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 120,
  },
  urgencySection: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  urgencyGradient: {
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  urgencyContent: {
    flex: 1,
    marginLeft: 12,
  },
  urgencyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  urgencySubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 6,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginLeft: 6,
  },
  mainContent: {
    paddingHorizontal: 20,
  },
  appIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignSelf: 'center',
    marginBottom: 16,
  },
  mainTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  mainSubtitle: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  valueProps: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 32,
    paddingHorizontal: 10,
  },
  valueProp: {
    alignItems: 'center',
  },
  valuePropText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#CBD5E1',
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  plansContainer: {
    marginBottom: 24,
  },
  planCard: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  planCardSelected: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  planGradient: {
    padding: 16,
  },
  badge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  planIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  originalPrice: {
    fontSize: 14,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
    marginRight: 8,
  },
  discountPrice: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginRight: 8,
  },
  discountBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  discountBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  planPeriod: {
    fontSize: 12,
    color: '#94A3B8',
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planFeatures: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  featureText: {
    fontSize: 12,
    color: '#94A3B8',
    marginLeft: 8,
  },
  featureTextSelected: {
    color: '#CBD5E1',
  },
  socialProof: {
    alignItems: 'center',
    marginBottom: 20,
  },
  socialProofBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  socialProofText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B',
    marginLeft: 6,
  },
  continueFreeButton: {
    marginTop: 8,
    marginBottom: 20,
    paddingVertical: 14,
    alignItems: 'center',
  },
  continueFreeText: {
    fontSize: 14,
    color: '#64748B',
    textDecorationLine: 'underline',
  },
  trustBadges: {
    alignItems: 'center',
    marginBottom: 20,
  },
  trustText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  floatingCTA: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
  },
  ctaButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  ctaButtonDisabled: {
    opacity: 0.6,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  ctaText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginRight: 8,
  },
});

export default DiscountedPaywallModal;
