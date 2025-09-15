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
  Linking,
  ActivityIndicator,
} from 'react-native';
import revenueCatService, { SubscriptionPlan, SubscriptionTier, SUBSCRIPTION_TIERS } from '../services/revenueCatService';
import { useSubscription } from '../services/subscriptionContext';
import Colors from '../constants/Colors';
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
  Sparkles,
  Trophy,
  Calendar,
} from 'lucide-react-native';
import { supabase } from '../services/api/supabaseClient';
import { useReview } from '../hooks/useReview';
import facebookAnalyticsService from '../services/facebookAnalyticsService';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface TieredSubscriptionModalProps {
  visible: boolean;
  onClose: () => void;
  onSubscribe?: (planId: SubscriptionPlan, tier: SubscriptionTier) => Promise<void>;
  hasReferralBonus?: boolean;
  referralBonusType?: 'free_trial' | 'discount';
}

const TieredSubscriptionModal: React.FC<TieredSubscriptionModalProps> = ({
  visible,
  onClose,
  onSubscribe,
  hasReferralBonus = false,
  referralBonusType = 'free_trial',
}) => {
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('pro');
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('pro_lifetime');
  const [loading, setLoading] = useState(false);
  const [packages, setPackages] = useState<any[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const { subscribe, checkSubscriptionStatus, restorePurchases } = useSubscription();
  const { trackPositiveInteraction } = useReview();

  // Function to calculate original price (double current price for 50% off promo)
  const getOriginalPrice = (currentPrice: string): string => {
    const price = parseFloat(currentPrice.replace('$', ''));
    const originalPrice = price * 2;
    return `$${originalPrice.toFixed(2)}`;
  };

  // Initialize IAP service when modal becomes visible
  useEffect(() => {
    if (visible) {
      initializeIAP();
      setIsInitialized(false);
      setTimeout(() => setIsInitialized(true), 100);
    }
  }, [visible]);

  const initializeIAP = async () => {
    try {
      await revenueCatService.initialize();
      await revenueCatService.refreshOfferings();
      const availablePackages = revenueCatService.getAvailablePackages();
      setPackages(availablePackages);
      console.log('📱 RevenueCat initialized, loaded packages:', availablePackages.length);
    } catch (error) {
      console.error('❌ Failed to initialize RevenueCat:', error);
      Alert.alert('Error', 'Unable to load subscription options. Please try again.');
    }
  };

  const handleSubscribe = async () => {
    try {
      setLoading(true);
      console.log('🔄 Starting subscription purchase for:', selectedPlan, selectedTier);
      
      // Track subscription intent with Facebook Analytics (Add to Cart event)
      try {
        const planPrices = {
          'pro_weekly': 12.49,
          'pro_monthly': 24.99,
          'pro_yearly': 199.99,
          'pro_lifetime': 349.99,
          'elite_weekly': 14.99,
          'elite_monthly': 29.99,
          'elite_yearly': 199.99
        };
        
        const price = planPrices[selectedPlan] || 0;
        facebookAnalyticsService.trackAddToCart(selectedTier, price, {
          subscription_plan: selectedPlan,
          subscription_tier: selectedTier
        });
        console.log('📊 Facebook Analytics Add to Cart event tracked');
      } catch (error) {
        console.error('❌ Failed to track Add to Cart with Facebook Analytics:', error);
      }

      const success = await subscribe(selectedPlan, selectedTier as 'pro' | 'elite');

            if (success) {
        console.log('✅ Purchase flow completed successfully in modal.');
        
        trackPositiveInteraction({ eventType: 'successful_subscription' });
        
        // Close modal immediately and let the dashboard update
        onClose();
        if (onSubscribe) {
          onSubscribe(selectedPlan, selectedTier);
        }
      } else {
        console.log('ℹ️ Purchase was cancelled or failed, handled in subscriptionContext.');
      }
    } catch (error: any) {
      console.error('❌ Subscription error in modal:', error);
      Alert.alert('Purchase Error', error.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    try {
      setLoading(true);
      await restorePurchases();
    } catch (error: any) {
      console.error('❌ Restore purchases error:', error);
      Alert.alert('Restore Failed', error?.message || 'Could not restore purchases. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTierSelection = (tier: SubscriptionTier) => {
    setSelectedTier(tier);
    // Set default plan for the selected tier
    if (tier === 'pro') {
      setSelectedPlan('pro_lifetime');
    } else if (tier === 'elite') {
      setSelectedPlan('elite_weekly');
    }
  };

  const handlePlanSelection = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    // Update tier based on plan selection
    if (plan.startsWith('pro_')) {
      setSelectedTier('pro');
    } else if (plan.startsWith('elite_')) {
      setSelectedTier('elite');
    }
  };

  const openTermsOfService = async () => {
    const url = 'https://rreusch2.github.io/ppwebsite/terms.html';
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Unable to open Terms of Service');
      }
    } catch (error) {
      console.error('Error opening Terms of Service:', error);
      Alert.alert('Error', 'Unable to open Terms of Service');
    }
  };

  const openPrivacyPolicy = async () => {
    const url = 'https://rreusch2.github.io/ppwebsite/privacy.html';
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Unable to open Privacy Policy');
      }
    } catch (error) {
      console.error('Error opening Privacy Policy:', error);
      Alert.alert('Error', 'Unable to open Privacy Policy');
    }
  };

  const renderReferralBonus = () => {
    if (!hasReferralBonus) return null;

    return (
      <View style={styles.referralBonusContainer}>
        <LinearGradient
          colors={['#10B981', '#059669']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.referralBonusGradient}
        >
          <View style={styles.referralBonusContent}>
            <Gift size={24} color="#FFFFFF" />
            <View style={styles.referralBonusText}>
              <Text style={styles.referralBonusTitle}>
                🎉 Referral Bonus Applied!
              </Text>
              <Text style={styles.referralBonusSubtitle}>
                {referralBonusType === 'free_trial' 
                  ? '2,500 bonus points ($25 value) - Use for discounts or free upgrades!'
                  : '50% off your first month - Limited time offer!'
                }
              </Text>
            </View>
            <Sparkles size={20} color="#FFFFFF" />
          </View>
        </LinearGradient>
      </View>
    );
  };

  const renderTierComparison = () => (
    <View style={styles.tierComparisonContainer}>
      <Text style={styles.chooseYourPlanTitle}>Unlock Premium Intelligence</Text>
      
      {/* Tier Selection Tabs */}
      <View style={styles.tierTabsContainer}>
        <TouchableOpacity
          style={[styles.tierTab, selectedTier === 'pro' && styles.tierTabSelected]}
          onPress={() => handleTierSelection('pro')}
        >
          <Crown size={20} color={selectedTier === 'pro' ? '#FFFFFF' : '#94A3B8'} />
          <Text style={[styles.tierTabText, selectedTier === 'pro' && styles.tierTabTextSelected]}>
            Pro
          </Text>
          <View style={styles.mostPopularBadge}>
            <Star size={10} color="#F59E0B" />
            <Text style={styles.mostPopularText}>MOST POPULAR</Text>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tierTab, selectedTier === 'elite' && styles.tierTabSelected]}
          onPress={() => handleTierSelection('elite')}
        >
          <Trophy size={20} color={selectedTier === 'elite' ? '#FFFFFF' : '#94A3B8'} />
          <Text style={[styles.tierTabText, selectedTier === 'elite' && styles.tierTabTextSelected]}>
            Elite
          </Text>
          <View style={styles.premiumBadge}>
            <Sparkles size={10} color="#8B5CF6" />
            <Text style={styles.premiumText}>PREMIUM</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Tier Features Comparison */}
      <View style={styles.featuresComparisonContainer}>
        <View style={styles.featureRow}>
          <Text style={styles.featureLabel}>Daily AI Picks</Text>
          <Text style={styles.featureValue}>
            {selectedTier === 'pro' ? '20 picks' : '30 picks'}
          </Text>
        </View>
        <View style={styles.featureRow}>
          <Text style={styles.featureLabel}>Daily Insights</Text>
          <Text style={styles.featureValue}>
            {selectedTier === 'pro' ? '8 insights' : '12 insights'}
          </Text>
        </View>
        <View style={styles.featureRow}>
          <Text style={styles.featureLabel}>Professor Lock Chat</Text>
          <Text style={styles.featureValue}>Unlimited</Text>
        </View>
        <View style={styles.featureRow}>
          <Text style={styles.featureLabel}>Daily AI Predictions</Text>
          <Text style={styles.featureValue}>✓ Included</Text>
        </View>
        {selectedTier === 'elite' && (
          <View style={styles.featureRow}>
            <Text style={styles.featureLabel}>🔒 Lock of the Day</Text>
            <Text style={styles.featureValuePremium}>✓ Elite Exclusive</Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderPlanOptions = () => {
    const currentTierPlans = selectedTier === 'pro' 
      ? ['pro_weekly', 'pro_monthly', 'pro_yearly', 'pro_daypass', 'pro_lifetime']
      : ['elite_weekly', 'elite_monthly', 'elite_yearly'];

    return (
      <View style={styles.planOptionsContainer}>
        {currentTierPlans.map((plan) => {
          const isSelected = selectedPlan === plan;
          // Make sure we're using correct tier names
          const tierKey = selectedTier === 'elite' ? 'elite' : selectedTier;
          const pricing = (SUBSCRIPTION_TIERS[tierKey] as any).pricing;
          
          let planName = '';
          let price = '';
          let period = '';
          let savings = '';
          let isTrialEligible = false;
          
          if (plan.includes('weekly')) {
            planName = 'Weekly';
            price = `$${pricing.weekly}`;
            period = 'per week';
          } else if (plan.includes('monthly')) {
            planName = 'Monthly';
            price = `$${pricing.monthly}`;
            period = 'per month';
            savings = 'Save 17%';
            isTrialEligible = true;
          } else if (plan.includes('yearly')) {
            planName = 'Yearly';
            price = `$${pricing.yearly}`;
            period = 'per year';
            savings = 'Save 50%';
          } else if (plan.includes('daypass')) {
            planName = 'Day Pass';
            price = `$${pricing.daypass}`;
            period = 'one day';
          } else if (plan.includes('lifetime')) {
            planName = 'Lifetime';
            price = `$${pricing.lifetime}`;
            period = 'one time';
            savings = 'Best Value';
          }

          return (
            <TouchableOpacity
              key={plan}
              style={[styles.planCard, isSelected && styles.planCardSelected]}
              onPress={() => handlePlanSelection(plan as SubscriptionPlan)}
            >
              <LinearGradient
                colors={isSelected 
                  ? (selectedTier === 'pro' ? ['#3B82F6', '#1D4ED8'] : ['#8B5CF6', '#7C3AED'])
                  : ['#1E293B', '#334155']
                }
                style={styles.planGradient}
              >
                {savings && (
                  <View style={styles.savingsBadge}>
                    <Text style={styles.savingsText}>{savings}</Text>
                  </View>
                )}
                
                
                <View style={styles.planHeader}>
                  <View style={styles.planInfo}>
                    <View style={styles.planNameContainer}>
                      <View style={styles.planNameWithIcon}>
                        {plan.includes('lifetime') && (
                          <Infinity size={16} color="#F59E0B" style={{ marginRight: 4 }} />
                        )}
                        <Text style={styles.planName}>{planName}</Text>
                      </View>
                      {isSelected && (
                        <View style={styles.selectedIndicator}>
                          <Check size={16} color="#0F172A" />
                        </View>
                      )}
                    </View>
                    <View style={styles.priceContainer}>
                      {/* Show original price with strikethrough for 50% off promo */}
                      <View style={styles.pricingRow}>
                        <Text style={styles.originalPrice}>{getOriginalPrice(price)}</Text>
                        <View style={styles.discountBadge}>
                          <Text style={styles.discountText}>50% OFF</Text>
                        </View>
                      </View>
                      <Text style={styles.planPrice}>
                        <Text style={styles.currencySymbol}>$</Text>
                        {price.replace('$', '')}
                      </Text>
                      <Text style={styles.planPeriod}>{period}</Text>
                    </View>
                    {/* Remove duplicate trial text to fix overlap - badge is enough */}
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          );
        })}
      </View>
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
          colors={['#0F172A', '#1E293B', selectedTier === 'pro' ? '#3B82F6' : '#8B5CF6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={24} color="#94A3B8" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Join 25,000+ Elite Bettors</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Referral Bonus Banner */}
            {renderReferralBonus()}
            
            {/* Tier Comparison */}
            {renderTierComparison()}

            {/* Plan Options */}
            {renderPlanOptions()}

            {/* Subscribe Button */}
            <TouchableOpacity
              style={[styles.subscribeButton, loading && styles.subscribeButtonDisabled]}
              onPress={handleSubscribe}
              disabled={loading}
            >
              <LinearGradient
                colors={selectedTier === 'pro' ? ['#3B82F6', '#1D4ED8'] : ['#8B5CF6', '#7C3AED']}
                style={styles.subscribeButtonGradient}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Crown size={20} color="#FFFFFF" />
                    <Text style={styles.subscribeButtonText}>
                      Start {selectedTier === 'pro' ? 'Pro' : 'Elite'} Subscription
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.restoreButton}
              onPress={restorePurchases}
            >
              <Text style={styles.restoreText}>Restore Purchases</Text>
            </TouchableOpacity>

            {/* Apple-Required Subscription Information */}
            <View style={styles.appleRequiredInfo}>
              <Text style={styles.subscriptionSectionTitle}>
                {selectedTier === 'pro' ? 'Pro Tier' : 'Elite Tier'} Subscription Options
              </Text>
              
              {selectedTier === 'pro' ? (
                <>
                  <View style={styles.subscriptionOption}>
                    <Text style={styles.subscriptionInfoTitle}>Weekly Pro Subscription</Text>
                    <Text style={styles.subscriptionInfoText}>Only $12.49 per week, auto-renewable</Text>
                  </View>
                  
                  <View style={styles.subscriptionOption}>
                    <Text style={styles.subscriptionInfoTitle}>Monthly Pro Subscription</Text>
                    <Text style={styles.subscriptionInfoText}>Just $24.99 per month, auto-renewable</Text>
                  </View>
                  
                  <View style={styles.subscriptionOption}>
                    <Text style={styles.subscriptionInfoTitle}>Yearly Pro Subscription</Text>
                    <Text style={styles.subscriptionInfoText}>Only $199.99 per year, auto-renewable</Text>
                  </View>
                  
                  <View style={styles.subscriptionOption}>
                    <Text style={styles.subscriptionInfoTitle}>Pro Day Pass</Text>
                    <Text style={styles.subscriptionInfoText}>Just $4.99 one-time purchase (24 hours)</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.subscriptionOption}>
                    <Text style={styles.subscriptionInfoTitle}>Weekly Elite Subscription</Text>
                    <Text style={styles.subscriptionInfoText}>Only $14.99 per week, auto-renewable</Text>
                  </View>
                  
                  <View style={styles.subscriptionOption}>
                    <Text style={styles.subscriptionInfoTitle}>Monthly Elite Subscription</Text>
                    <Text style={styles.subscriptionInfoText}>Just $29.99 per month, auto-renewable</Text>
                  </View>
                  
                  <View style={styles.subscriptionOption}>
                    <Text style={styles.subscriptionInfoTitle}>Yearly Elite Subscription</Text>
                    <Text style={styles.subscriptionInfoText}>Only $199.99 per year, auto-renewable</Text>
                  </View>
                </>
              )}
              
              <View style={styles.termsRow}>
                <Text style={[styles.subscriptionInfoText, { marginBottom: 8 }]}>By subscribing you agree to our:</Text>
              </View>
              
              <View style={styles.termsLinksRow}>
                <TouchableOpacity style={styles.linkButton} onPress={() => {
                  // Add terms of service handler
                }}>
                  <Text style={styles.linkText}>Terms of Service</Text>
                </TouchableOpacity>
                <Text style={styles.subscriptionInfoText}> and </Text>
                <TouchableOpacity style={styles.linkButton} onPress={() => {
                  // Add privacy policy handler  
                }}>
                  <Text style={styles.linkText}>Privacy Policy</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Footer Links */}
            <View style={styles.footer}>
              <View style={styles.legalLinks}>
                <TouchableOpacity onPress={openTermsOfService}>
                  <Text style={styles.legalLinkText}>Terms of Service</Text>
                </TouchableOpacity>
                <Text style={styles.legalSeparator}> • </Text>
                <TouchableOpacity onPress={openPrivacyPolicy}>
                  <Text style={styles.legalLinkText}>Privacy Policy</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
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
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 20,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  tierComparisonContainer: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  chooseYourPlanTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  tierTabsContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tierTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    position: 'relative',
  },
  tierTabSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  tierTabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94A3B8',
    marginLeft: 8,
  },
  tierTabTextSelected: {
    color: '#FFFFFF',
  },
  mostPopularBadge: {
    position: 'absolute',
    top: -8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  mostPopularText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 2,
  },
  premiumBadge: {
    position: 'absolute',
    top: -8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  premiumText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 2,
  },
  featuresComparisonContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  featureLabel: {
    fontSize: 14,
    color: '#CBD5E1',
  },
  featureValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  featureValuePremium: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FBBF24',
  },
  planOptionsContainer: {
    paddingHorizontal: 20,
    marginBottom: 30,
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
    padding: 20,
    position: 'relative',
  },
  savingsBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  savingsText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  trialBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  trialBadgeSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderColor: '#FFFFFF',
  },
  trialText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F59E0B',
    marginLeft: 4,
  },
  trialTextSelected: {
    color: '#0F172A',
  },
  planHeader: {
    marginTop: 20,
  },
  planInfo: {
    alignItems: 'center',
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
  selectedIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  priceContainer: {
    alignItems: 'flex-start',
    marginBottom: 4,
    paddingLeft: 8,
  },
  planPrice: {
    fontSize: 36,
    fontWeight: '800',
    color: '#EF4444',
    textAlign: 'left',
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: '600',
    color: '#EF4444',
    marginRight: 2,
  },
  planPeriod: {
    fontSize: 14,
    color: '#CBD5E1',
  },
  trialDetails: {
    fontSize: 12,
    color: '#CBD5E1',
    textAlign: 'center',
  },
  subscribeButton: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  subscribeButtonDisabled: {
    opacity: 0.6,
  },
  subscribeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  subscribeButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  footerButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  footerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94A3B8',
  },
  legalLinks: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legalLinkText: {
    fontSize: 12,
    color: '#64748B',
    textDecorationLine: 'underline',
  },
  legalSeparator: {
    color: '#64748B',
    fontSize: 12,
    marginHorizontal: 4,
  },
  appleRequiredInfo: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  subscriptionInfoTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  subscriptionInfoText: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 4,
  },
  trialInfoText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
  },
  termsRow: {
    marginTop: 12,
  },
  termsLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  linkButton: {
    padding: 2,
  },
  linkText: {
    color: '#00E5FF',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  restoreButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    marginHorizontal: 20,
  },
  restoreText: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  subscriptionSectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  subscriptionOption: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  // New styles for strikethrough pricing and 50% off promotion
  pricingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    justifyContent: 'flex-start',
  },
  originalPrice: {
    fontSize: 16,
    color: '#64748B',
    textDecorationLine: 'line-through',
    marginRight: 12,
    fontWeight: '500',
  },
  discountBadge: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  discountText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  planNameWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Referral bonus styles
  referralBonusContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  referralBonusGradient: {
    padding: 16,
  },
  referralBonusContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  referralBonusText: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  referralBonusTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  referralBonusSubtitle: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
  },
});

export default TieredSubscriptionModal;
