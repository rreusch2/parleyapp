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
} from 'react-native';
import inAppPurchaseService from '../services/inAppPurchases';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  Crown,
  Check,
  Star,
  Zap,
  Shield,
  BarChart3,
  Brain,
  Target,
  Activity,
  Bell,
  DollarSign,
  TrendingUp,
  Eye,
  ChevronRight,
  Infinity,
  Gem,
} from 'lucide-react-native';
import { useSubscription } from '../services/subscriptionContext';
import { DEV_CONFIG } from '../config/development';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface SubscriptionModalProps {
  visible: boolean;
  onClose: () => void;
  onSubscribe?: (planId: 'monthly' | 'yearly' | 'lifetime') => Promise<void>;
}

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  visible,
  onClose,
  onSubscribe,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly' | 'lifetime'>('yearly'); // Default to yearly (best value)
  const [loading, setLoading] = useState(false);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const { subscribeToPro } = useSubscription();

  // Initialize IAP service when modal becomes visible
  useEffect(() => {
    if (visible) {
      initializeIAP();
    }
  }, [visible]);

  const initializeIAP = async () => {
    try {
      await inAppPurchaseService.initialize();
      const subs = inAppPurchaseService.getAllSubscriptions();
      setSubscriptions(subs);
      console.log('📱 IAP initialized, loaded subscriptions:', subs.length);
    } catch (error) {
      console.error('❌ Failed to initialize IAP:', error);
      Alert.alert('Error', 'Unable to load subscription options. Please try again.');
    }
  };

  const handleSubscribe = async () => {
    try {
      setLoading(true);
      
      // Check if test mode is enabled
      if (__DEV__ || DEV_CONFIG.ENABLE_TEST_PRO_SUBSCRIPTION) {
        console.log('🧪 Test mode: Using subscription context for Pro upgrade');
        const success = await subscribeToPro(selectedPlan);
        if (success) {
          onClose();
          return;
        }
      } else {
        // Production mode: Use IAP service
        const productId = getProductId(selectedPlan);
        
        if (!productId) {
          throw new Error('Product not available');
        }

        // Use IAP service to purchase
        await inAppPurchaseService.purchaseSubscription(productId);
        
        // Call the optional callback if provided
        if (onSubscribe) {
          await onSubscribe(selectedPlan);
        }
        
        // Close modal on success
        onClose();
      }
    } catch (error) {
      console.error('Subscription error:', error);
      Alert.alert('Error', 'Failed to process subscription. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getProductId = (plan: 'monthly' | 'yearly' | 'lifetime'): string | null => {
    const productIds = {
      monthly: Platform.OS === 'ios' ? 'com.parleyapp.premium_monthly' : 'premium_monthly',
      yearly: Platform.OS === 'ios' ? 'com.parleyapp.premium_yearly' : 'premium_yearly',
      lifetime: Platform.OS === 'ios' ? 'com.parleyapp.premium_lifetime' : 'premium_lifetime',
    };
    return productIds[plan];
  };

  const getSubscriptionPrice = (plan: 'monthly' | 'yearly' | 'lifetime'): string => {
    const productId = getProductId(plan);
    if (!productId) return '$9.99'; // fallback
    
    const subscription = subscriptions.find(sub => sub.productId === productId);
    return subscription?.localizedPrice || '$9.99'; // fallback
  };

  const features = [
    {
      icon: Brain,
      title: 'Unlimited AI Predictions',
      description: 'Get unlimited daily picks with advanced AI analysis',
    },
    {
      icon: BarChart3,
      title: 'Advanced Analytics',
      description: 'Kelly criterion, ROI tracking, bankroll management',
    },
    {
      icon: Activity,
      title: 'Live Injury Reports',
      description: 'Real-time injury updates and impact analysis',
    },
    {
      icon: TrendingUp,
      title: 'Recurring Trends',
      description: 'Track hot streaks and pattern recognition',
    },
    {
      icon: Eye,
      title: 'Multi-Book Odds',
      description: 'Compare odds across all major sportsbooks',
    },
    {
      icon: Bell,
      title: 'Live Alerts',
      description: 'Line movements, weather, breaking news notifications',
    },
    {
      icon: Target,
      title: 'Value Betting Tools',
      description: 'Identify value bets with edge detection',
    },
    {
      icon: Shield,
      title: 'Priority Support',
      description: '24/7 premium customer support',
    },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <LinearGradient
          colors={['#0F172A', '#1E293B', '#7C3AED']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={24} color="#94A3B8" />
            </TouchableOpacity>
            
            <View style={styles.headerContent}>
              <View style={styles.crownContainer}>
                <Crown size={40} color="#F59E0B" />
              </View>
              <Text style={styles.headerTitle}>Upgrade to Pro</Text>
              <Text style={styles.headerSubtitle}>
                Unlock the full power of Predictive Play AI
              </Text>
            </View>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Pricing Plans */}
            <View style={styles.pricingSection}>
              <Text style={styles.sectionTitle}>Choose Your Plan</Text>
              
              {/* Monthly Plan */}
              <TouchableOpacity
                style={[
                  styles.planCard,
                  selectedPlan === 'monthly' && styles.planCardSelected,
                ]}
                onPress={() => setSelectedPlan('monthly')}
              >
                <LinearGradient
                  colors={
                    selectedPlan === 'monthly'
                      ? ['#00E5FF', '#0891B2']
                      : ['#1E293B', '#334155']
                  }
                  style={styles.planGradient}
                >
                  <View style={styles.planHeader}>
                    <View style={styles.planInfo}>
                      <View style={styles.planNameContainer}>
                        <Text style={styles.planName}>Monthly Pro</Text>
                        {selectedPlan === 'monthly' && (
                          <View style={styles.selectedIndicator}>
                            <Check size={16} color="#0F172A" />
                          </View>
                        )}
                      </View>
                      <Text style={styles.planPrice}>$0.82</Text>
                      <Text style={styles.planPeriod}>per day</Text>
                    </View>
                    <View style={styles.planBilling}>
                      <Text style={styles.billingText}>Billed Monthly</Text>
                      <Text style={styles.billingAmount}>$24.99/month</Text>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              {/* Yearly Plan */}
              <TouchableOpacity
                style={[
                  styles.planCard,
                  selectedPlan === 'yearly' && styles.planCardSelected,
                ]}
                onPress={() => setSelectedPlan('yearly')}
              >
                <LinearGradient
                  colors={
                    selectedPlan === 'yearly'
                      ? ['#10B981', '#059669']
                      : ['#1E293B', '#334155']
                  }
                  style={styles.planGradient}
                >
                  <View style={styles.popularBadge}>
                    <Star size={12} color="#F59E0B" />
                    <Text style={styles.popularText}>MOST POPULAR</Text>
                  </View>
                  
                  <View style={styles.planHeader}>
                    <View style={styles.planInfo}>
                      <View style={styles.planNameContainer}>
                        <Text style={styles.planName}>Yearly Pro</Text>
                        {selectedPlan === 'yearly' && (
                          <View style={styles.selectedIndicator}>
                            <Check size={16} color="#0F172A" />
                          </View>
                        )}
                      </View>
                      <View style={styles.yearlyPricing}>
                        <Text style={styles.planPrice}>$149.99</Text>
                        <View style={styles.savingsBadge}>
                          <Text style={styles.savingsText}>Save 53%</Text>
                        </View>
                      </View>
                      <Text style={styles.planPeriod}>per year</Text>
                    </View>
                    <View style={styles.planBilling}>
                      <Text style={styles.billingText}>Best Value</Text>
                      <Text style={styles.billingAmount}>$12.50/month</Text>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              {/* Lifetime Plan */}
              <TouchableOpacity
                style={[
                  styles.planCard,
                  selectedPlan === 'lifetime' && styles.planCardSelected,
                ]}
                onPress={() => setSelectedPlan('lifetime')}
              >
                <LinearGradient
                  colors={
                    selectedPlan === 'lifetime'
                      ? ['#8B5CF6', '#7C3AED']
                      : ['#1E293B', '#334155']
                  }
                  style={styles.planGradient}
                >
                  <View style={styles.premiumBadge}>
                    <Gem size={12} color="#F59E0B" />
                    <Text style={styles.premiumText}>PREMIUM</Text>
                  </View>
                  
                  <View style={styles.planHeader}>
                    <View style={styles.planInfo}>
                      <View style={styles.planNameContainer}>
                        <Text style={styles.planName}>Lifetime Pro</Text>
                        <Infinity size={18} color="#F59E0B" style={{ marginLeft: 8 }} />
                        {selectedPlan === 'lifetime' && (
                          <View style={styles.selectedIndicator}>
                            <Check size={16} color="#0F172A" />
                          </View>
                        )}
                      </View>
                      <View style={styles.lifetimePricing}>
                        <Text style={styles.planPrice}>$349.99</Text>
                        <View style={styles.lifetimeBadge}>
                          <Text style={styles.lifetimeText}>One-time</Text>
                        </View>
                      </View>
                      <Text style={styles.planPeriod}>forever</Text>
                    </View>
                    <View style={styles.planBilling}>
                      <Text style={styles.billingText}>Never pay again</Text>
                      <Text style={styles.billingAmount}>$9.72/month</Text>
                      <Text style={styles.billingNote}>lifetime value</Text>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Features List */}
            <View style={styles.featuresSection}>
              <Text style={styles.sectionTitle}>What&apos;s Included</Text>
              <View style={styles.featuresGrid}>
                {features.map((feature, index) => (
                  <View key={index} style={styles.featureItem}>
                    <View style={styles.featureIcon}>
                      <feature.icon size={20} color="#00E5FF" />
                    </View>
                    <View style={styles.featureContent}>
                      <Text style={styles.featureTitle}>{feature.title}</Text>
                      <Text style={styles.featureDescription}>{feature.description}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Testimonial/Social Proof */}
            <View style={styles.socialProofSection}>
              <LinearGradient
                colors={['#1E293B', '#334155']}
                style={styles.socialProofCard}
              >
                <View style={styles.starsContainer}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} size={16} color="#F59E0B" fill="#F59E0B" />
                  ))}
                </View>
                <Text style={styles.testimonialText}>
                  &quot;Got the Lifetime Pro - best investment ever! ROI paid for itself in 2 months. The AI predictions are insanely accurate!&quot;
                </Text>
                <Text style={styles.testimonialAuthor}>- Marcus R., Lifetime Member</Text>
              </LinearGradient>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.subscribeButton}
              onPress={handleSubscribe}
              disabled={loading}
            >
              <LinearGradient
                colors={
                  selectedPlan === 'lifetime' 
                    ? ['#8B5CF6', '#7C3AED'] 
                    : selectedPlan === 'yearly' 
                      ? ['#10B981', '#059669'] 
                      : ['#00E5FF', '#0891B2']
                }
                style={styles.subscribeGradient}
              >
                {selectedPlan === 'lifetime' ? (
                  <Gem size={20} color="#FFFFFF" />
                ) : (
                  <Crown size={20} color="#FFFFFF" />
                )}
                <Text style={styles.subscribeText}>
                  {loading 
                    ? 'Processing...' 
                    : (__DEV__ || DEV_CONFIG.ENABLE_TEST_PRO_SUBSCRIPTION)
                      ? `🧪 Test ${selectedPlan === 'lifetime' ? 'Lifetime' : selectedPlan === 'monthly' ? 'Monthly' : 'Yearly'} Pro (Free)`
                      : selectedPlan === 'lifetime'
                        ? 'Get Lifetime Pro'
                        : `Start ${selectedPlan === 'monthly' ? 'Monthly' : 'Yearly'} Pro`
                  }
                </Text>
                <ChevronRight size={20} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
            
            <View style={styles.termsContainer}>
              <Text style={styles.termsText}>
                {selectedPlan === 'lifetime' 
                  ? 'One-time purchase. No recurring charges. By purchasing you agree to our Terms of Service and Privacy Policy.'
                  : 'Auto-renewable. Cancel anytime. By subscribing you agree to our Terms of Service and Privacy Policy.'
                }
              </Text>
            </View>
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
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  closeButton: {
    alignSelf: 'flex-end',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    alignItems: 'center',
    marginTop: 20,
  },
  crownContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 22,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  pricingSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  planCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  planCardSelected: {
    transform: [{ scale: 1.02 }],
  },
  planGradient: {
    padding: 20,
    position: 'relative',
  },
  popularBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F59E0B',
    marginLeft: 4,
  },
  premiumBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  premiumText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F59E0B',
    marginLeft: 4,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planInfo: {
    flex: 1,
  },
  planNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  planPrice: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  planPeriod: {
    fontSize: 14,
    color: '#E2E8F0',
    marginTop: 2,
  },
  yearlyPricing: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lifetimePricing: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  savingsBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 12,
  },
  lifetimeBadge: {
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 12,
  },
  savingsText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  lifetimeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  planBilling: {
    alignItems: 'flex-end',
  },
  billingText: {
    fontSize: 12,
    color: '#E2E8F0',
    marginBottom: 4,
  },
  billingAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  billingNote: {
    fontSize: 10,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  selectedIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  featuresSection: {
    marginBottom: 32,
  },
  featuresGrid: {
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    padding: 16,
    borderRadius: 12,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
  },
  socialProofSection: {
    marginBottom: 20,
  },
  socialProofCard: {
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  testimonialText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  testimonialAuthor: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  subscribeButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  subscribeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  subscribeText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginHorizontal: 12,
  },
  termsContainer: {
    alignItems: 'center',
  },
  termsText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default SubscriptionModal; 