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
import revenueCatService, { SubscriptionPlan } from '../services/revenueCatService';
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
} from 'lucide-react-native';
import { supabase } from '../services/api/supabaseClient';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface SubscriptionModalProps {
  visible: boolean;
  onClose: () => void;
  onSubscribe?: (planId: SubscriptionPlan) => Promise<void>;
}

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  visible,
  onClose,
  onSubscribe,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('yearly'); // Default to yearly (best value)
  const [loading, setLoading] = useState(false);
  const [packages, setPackages] = useState<any[]>([]);
  // Include restorePurchases so users (and Apple reviewers) can easily restore previous transactions
  const { subscribeToPro, checkSubscriptionStatus, restorePurchases } = useSubscription();

  // Initialize IAP service when modal becomes visible
  useEffect(() => {
    if (visible) {
      initializeIAP();
    }
  }, [visible]);

  const initializeIAP = async () => {
    try {
      await revenueCatService.initialize();
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
      
      console.log('🔄 Starting subscription purchase for:', selectedPlan);
      
      // Initialize RevenueCat service first
      await revenueCatService.initialize();
      
      // Call RevenueCat to start the purchase process
      // This will trigger the Apple purchase dialog
      const result = await revenueCatService.purchasePackage(selectedPlan);
      
      if (result.success) {
        console.log('✅ Purchase completed successfully!');
        
        // CRITICAL FIX: Update subscription context immediately after purchase
        console.log('🔄 Updating subscription context to Pro status...');
        
        // Update database to mark user as Pro
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            console.log('🔄 Updating user subscription_tier to Pro in database...');
            await supabase
              .from('profiles')
              .update({ subscription_tier: 'pro' })
              .eq('id', user.id);
            console.log('✅ Database updated with Pro status');
          }
        } catch (dbError) {
          console.error('⚠️ Database update failed, but RevenueCat should sync:', dbError);
        }
        
        // Use the subscription context hook to refresh status
        await checkSubscriptionStatus();
        
        // Small delay to ensure context is fully updated
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Show success message
        Alert.alert(
          '🎉 Welcome to Pro!',
          `You've successfully subscribed to the ${selectedPlan} plan. Welcome to the premium experience!`,
          [{ 
            text: 'Great!', 
            onPress: () => {
              onClose();
              // Force app refresh by triggering re-render
              console.log('✅ Pro subscription activated - UI should update to Pro layout');
              
              // If parent provided onSubscribe callback, use it for additional actions
              if (onSubscribe) {
                onSubscribe(selectedPlan);
              }
            }
          }]
        );
      } else {
        // Handle purchase failure
        if (result.error === 'cancelled') {
          console.log('ℹ️ User cancelled purchase');
          // Don't show error for cancellation
        } else {
          Alert.alert('Purchase Error', result.error || 'Unable to process purchase. Please try again.');
        }
      }
      
    } catch (error: any) {
      console.error('❌ Subscription error:', error);
      console.error('❌ Error type:', typeof error);
      console.error('❌ Error constructor:', error?.constructor?.name);
      
      // More robust error handling
      let errorMessage = 'Unable to process purchase. Please try again.';
      
      if (error && typeof error === 'object') {
        const errorStr = error.message || error.toString() || '';
        
        if (errorStr.includes('cancelled') || errorStr.includes('canceled')) {
          console.log('ℹ️ User cancelled purchase');
          // Don't show error for cancellation
          return;
        } else if (errorStr.includes('not available') || errorStr.includes('unavailable')) {
          errorMessage = 'This subscription is not available right now. Please try again later.';
        } else if (errorStr.includes('Network') || errorStr.includes('network')) {
          errorMessage = 'Please check your internet connection and try again.';
        } else if (errorStr.includes('payment') || errorStr.includes('Payment')) {
          errorMessage = 'Payment processing failed. Please check your payment method and try again.';
        } else if (error.message) {
          errorMessage = error.message;
        }
      }
      
      Alert.alert('Purchase Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle restore purchases flow from the paywall.
   * Apple requires a prominent "Restore" button in the purchase view (Guideline 3.1.1).
   */
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


  const getSubscriptionPrice = (plan: 'monthly' | 'yearly' | 'lifetime'): string => {
    // Use RevenueCat packages to get pricing
    const packageForPlan = packages.find(pkg => {
      const productId = pkg.product.identifier;
      return (
        (plan === 'monthly' && productId.includes('monthly')) ||
        (plan === 'yearly' && productId.includes('yearly')) ||
        (plan === 'lifetime' && productId.includes('lifetime'))
      );
    });
    
    return packageForPlan?.product.priceString || (
      plan === 'monthly' ? '$24.99' : 
      plan === 'yearly' ? '$199.99' : 
      '$349.99'
    );
  };

  // Open Terms of Service (Apple required functional link)
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

  // Open Privacy Policy (Apple required functional link)
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
    <>
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
                        <View style={styles.priceContainer}>
                          <Text style={styles.planPrice}>$24.99</Text>
                          <Text style={styles.planPeriod}>per month</Text>
                        </View>
                        <Text style={styles.billingDetails}>$0.83 per day</Text>
                        <Text style={styles.originalPriceText}>Regular price: $49.98 (Save 50%)</Text>
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
                        <View style={styles.priceContainer}>
                          <Text style={styles.planPrice}>$199.99</Text>
                          <Text style={styles.planPeriod}>per year</Text>
                        </View>
                        <Text style={styles.billingDetails}>$16.67/month • billed annually</Text>
                        <Text style={styles.originalPriceText}>Regular price: $399.98 (Save 50%)</Text>
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
                        <View style={styles.priceContainer}>
                          <Text style={styles.planPrice}>$349.99</Text>
                          <Text style={styles.planPeriod}>one-time payment</Text>
                        </View>
                        <Text style={styles.originalPriceText}>Regular price: $699.98 (Save 50%)</Text>
                      </View>
                      
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {/* Monthly Pro Giveaway - Positioned between pricing and features */}
              <View style={styles.giveawayContainer}>
                <Gift size={20} color="#F59E0B" />
                <Text style={styles.giveawayText}>
                  All Monthly Pro members are entered in a monthly giveaway to win a free Yearly Pro subscription!
                </Text>
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

              {/* Apple-Required Subscription Information - Inside ScrollView */}
              <View style={styles.appleRequiredInfo}>
                <Text style={styles.subscriptionInfoTitle}>
                  {selectedPlan === 'monthly' ? 'Monthly Pro Subscription'
                  : selectedPlan === 'yearly' ? 'Yearly Pro Subscription'
                  : 'Lifetime Pro Purchase'}
                </Text>
                <Text style={styles.subscriptionInfoText}>
                  {selectedPlan === 'monthly'
                    ? '$24.99 per month, auto-renewable'
                    : selectedPlan === 'yearly'
                      ? '$199.99 per year, auto-renewable'
                      : '$349.99 one-time payment'}
                </Text>
                
                <View style={styles.termsRow}>
                  <Text style={[styles.subscriptionInfoText, { marginBottom: 8 }]}>By subscribing you agree to our:</Text>
                </View>
                
                <View style={styles.termsLinksRow}>
                  <TouchableOpacity style={styles.linkButton} onPress={() => openTermsOfService()}>
                    <Text style={styles.linkText}>Terms of Service</Text>
                  </TouchableOpacity>
                  <Text style={styles.subscriptionInfoText}> and </Text>
                  <TouchableOpacity style={styles.linkButton} onPress={() => openPrivacyPolicy()}>
                    <Text style={styles.linkText}>Privacy Policy</Text>
                  </TouchableOpacity>
                </View>
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
                      : selectedPlan === 'lifetime'
                        ? 'Get Lifetime Pro'
                        : `Start ${selectedPlan === 'monthly' ? 'Monthly' : 'Yearly'} Pro`
                    }
                  </Text>
                  <ChevronRight size={20} color="#FFFFFF" />
                </LinearGradient>
              </TouchableOpacity>
              
              {/* Restore Purchases Button - required by Apple */}
              <TouchableOpacity
                onPress={handleRestore}
                style={[styles.restoreButton, loading && { opacity: 0.7 }]}
                disabled={loading}
              >
                <Text style={styles.restoreButtonText}>Restore Purchases</Text>
              </TouchableOpacity>
              
              <View style={styles.termsContainer}>
                <Text style={styles.termsText}>
                  {selectedPlan === 'lifetime' 
                    ? 'One-time purchase. No recurring charges.'
                    : 'Auto-renewable. Cancel anytime in iTunes Account Settings.'
                  }
                </Text>
              </View>
            </View>
          </LinearGradient>
        </View>
      </Modal>

    </>
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
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingHorizontal: 20,
    paddingBottom: 10,
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
    marginTop: 10,
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
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  priceContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginTop: 8,
    marginBottom: 4,
  },
  originalPriceText: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '400',
  },
  planPeriod: {
    fontSize: 16,
    color: '#E2E8F0',
    fontWeight: '600',
    marginTop: 2,
  },
  billingDetails: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
    fontWeight: '400',
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
  giveawayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  giveawayText: {
    fontSize: 15,
    color: '#F59E0B',
    marginLeft: 12,
    fontWeight: '600',
    flex: 1,
    lineHeight: 22,
  },
  // Apple-required subscription information styles
  appleRequiredInfo: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
  },
  subscriptionInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subscriptionInfoText: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
    textAlign: 'center',
  },
  // Terms and Privacy Policy link styles
  termsRow: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  termsLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  linkButton: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  linkText: {
    fontSize: 12,
    color: '#3B82F6',
    textDecorationLine: 'underline',
    fontWeight: '500',
  },
  restoreButton: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFFFFF55',
    marginBottom: 12,
  },
  restoreButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },

});

export default SubscriptionModal; 