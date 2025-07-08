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
  Gift,
  ArrowRight,
} from 'lucide-react-native';
import inAppPurchaseService from '../services/inAppPurchases';
import { useSubscription } from '../services/subscriptionContext';
import { DEV_CONFIG } from '../config/development';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface SignupSubscriptionModalProps {
  visible: boolean;
  onClose: () => void;
  onSubscribe?: (planId: 'monthly' | 'yearly' | 'lifetime') => Promise<void>;
  onContinueFree: () => void;
}

const SignupSubscriptionModal: React.FC<SignupSubscriptionModalProps> = ({
  visible,
  onClose,
  onSubscribe,
  onContinueFree,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly' | 'lifetime'>('yearly');
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
      console.log('📱 IAP initialized for signup, loaded subscriptions:', subs.length);
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
    const prices = {
      monthly: '$24.99',
      yearly: '$149.99',
      lifetime: '$349.99'
    };
    return prices[plan];
  };

     const topFeatures = [
     {
       icon: Brain,
               title: '20 Daily AI Predictions',
        description: 'Get 20 daily AI picks vs. 2 free picks',
        highlight: '20 vs 2',
     },
    {
      icon: BarChart3,
      title: 'Advanced Analytics',
      description: 'Kelly criterion, ROI tracking, bankroll management',
      highlight: 'Pro Analytics',
    },
    {
      icon: Activity,
      title: 'Live Injury Reports',
      description: 'Real-time injury updates and impact analysis',
      highlight: 'Live Updates',
    },
    {
      icon: TrendingUp,
      title: 'Multi-Book Odds',
      description: 'Compare odds across all major sportsbooks',
      highlight: 'Best Odds',
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
              <Text style={styles.headerTitle}>🎉 Welcome to Predictive Play!</Text>
              <Text style={styles.headerSubtitle}>
                Start your betting journey with Pro features
              </Text>
            </View>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Value Proposition */}
            <View style={styles.valueSection}>
              <Text style={styles.sectionTitle}>Choose Your Experience</Text>
              <Text style={styles.valueText}>
                Join thousands of winning bettors using our AI-powered predictions
              </Text>
            </View>

            {/* Quick Feature Comparison */}
            <View style={styles.featuresSection}>
              <Text style={styles.featuresTitle}>What You Get</Text>
              <View style={styles.featuresGrid}>
                {topFeatures.map((feature, index) => (
                  <View key={index} style={styles.featureItem}>
                    <View style={styles.featureIcon}>
                      <feature.icon size={20} color="#00E5FF" />
                    </View>
                    <View style={styles.featureContent}>
                      <Text style={styles.featureTitle}>{feature.title}</Text>
                      <Text style={styles.featureDescription}>{feature.description}</Text>
                      <View style={styles.featureHighlight}>
                        <Text style={styles.featureHighlightText}>{feature.highlight}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Pricing Plans - Simplified */}
            <View style={styles.pricingSection}>
              {/* Yearly Plan - Featured */}
              <TouchableOpacity
                style={[
                  styles.planCard,
                  styles.featuredPlan,
                  selectedPlan === 'yearly' && styles.planCardSelected,
                ]}
                onPress={() => setSelectedPlan('yearly')}
              >
                <LinearGradient
                  colors={['#10B981', '#059669']}
                  style={styles.planGradient}
                >
                  <View style={styles.popularBadge}>
                    <Star size={12} color="#F59E0B" />
                    <Text style={styles.popularText}>MOST POPULAR</Text>
                  </View>
                  
                  <View style={styles.planHeader}>
                    <View style={styles.planInfo}>
                      <Text style={styles.planName}>Yearly Pro</Text>
                      <View style={styles.yearlyPricing}>
                        <Text style={styles.planPrice}>$149.99</Text>
                        <View style={styles.savingsBadge}>
                          <Text style={styles.savingsText}>Save 53%</Text>
                        </View>
                      </View>
                      <Text style={styles.planPeriod}>$12.50/month • billed yearly</Text>
                    </View>
                    {selectedPlan === 'yearly' && (
                      <View style={styles.selectedIndicator}>
                        <Check size={16} color="#0F172A" />
                      </View>
                    )}
                  </View>
                </LinearGradient>
              </TouchableOpacity>

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
                      <Text style={styles.planName}>Monthly Pro</Text>
                      <Text style={styles.planPrice}>$26.70</Text>
                      <Text style={styles.planPeriod}>per month</Text>
                    </View>
                    {selectedPlan === 'monthly' && (
                      <View style={styles.selectedIndicator}>
                        <Check size={16} color="#0F172A" />
                      </View>
                    )}
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
                    <Text style={styles.premiumText}>BEST VALUE</Text>
                  </View>
                  
                  <View style={styles.planHeader}>
                    <View style={styles.planInfo}>
                      <View style={styles.planNameContainer}>
                        <Text style={styles.planName}>Lifetime Pro</Text>
                        <Infinity size={18} color="#F59E0B" style={{ marginLeft: 8 }} />
                      </View>
                      <Text style={styles.planPrice}>$349.99</Text>
                      <Text style={styles.planPeriod}>one-time payment</Text>
                    </View>
                    {selectedPlan === 'lifetime' && (
                      <View style={styles.selectedIndicator}>
                        <Check size={16} color="#0F172A" />
                      </View>
                    )}
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Footer with Action Buttons */}
          <View style={styles.footer}>
            {/* Pro Subscribe Button */}
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
                <Crown size={20} color="#FFFFFF" />
                <Text style={styles.subscribeText}>
                  {loading 
                    ? 'Processing...' 
                    : (__DEV__ || DEV_CONFIG.ENABLE_TEST_PRO_SUBSCRIPTION)
                      ? `🧪 Test ${selectedPlan === 'lifetime' ? 'Lifetime' : selectedPlan === 'monthly' ? 'Monthly' : 'Yearly'} Pro (Free)`
                      : `Start ${selectedPlan === 'lifetime' ? 'Lifetime' : selectedPlan === 'monthly' ? 'Monthly' : 'Yearly'} Pro`
                  }
                </Text>
                <ChevronRight size={20} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>

            {/* Continue Free Button */}
            <TouchableOpacity
              style={styles.freeButton}
              onPress={onContinueFree}
              disabled={loading}
            >
              <View style={styles.freeButtonContent}>
                <Gift size={20} color="#94A3B8" />
                <Text style={styles.freeButtonText}>Continue with Free Account</Text>
                <ArrowRight size={16} color="#94A3B8" />
              </View>
            </TouchableOpacity>

                         {/* Benefit Reminder */}
             <View style={styles.benefitReminder}>
               <Text style={styles.benefitText}>
                 Free: 2 daily picks • Pro: 20 daily AI picks + advanced features
               </Text>
             </View>
            
            <View style={styles.termsContainer}>
              <Text style={styles.termsText}>
                Auto-renewable. Cancel anytime. By subscribing you agree to our Terms of Service.
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
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
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
  valueSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  valueText: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 22,
  },
  featuresSection: {
    marginBottom: 24,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
  },
  featuresGrid: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    marginBottom: 6,
  },
  featureHighlight: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  featureHighlightText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },
  pricingSection: {
    marginBottom: 20,
  },
  planCard: {
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  featuredPlan: {
    transform: [{ scale: 1.02 }],
    marginBottom: 16,
  },
  planCardSelected: {
    borderWidth: 2,
    borderColor: '#00E5FF',
  },
  planGradient: {
    padding: 16,
    position: 'relative',
  },
  popularBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
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
    top: 8,
    right: 8,
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
    marginBottom: 4,
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  planPrice: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  planPeriod: {
    fontSize: 14,
    color: '#E2E8F0',
  },
  yearlyPricing: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  savingsBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  savingsText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F59E0B',
  },
  selectedIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#00E5FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  subscribeButton: {
    marginBottom: 12,
    borderRadius: 30,
    overflow: 'hidden',
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
  freeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
    marginBottom: 16,
  },
  freeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  freeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94A3B8',
    marginHorizontal: 12,
  },
  benefitReminder: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  benefitText: {
    fontSize: 14,
    color: '#10B981',
    textAlign: 'center',
    fontWeight: '500',
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

export default SignupSubscriptionModal; 