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
import revenueCatService, { SubscriptionPlan, SubscriptionTier, SUBSCRIPTION_TIERS } from '../services/revenueCatService';
import { useSubscription } from '../services/subscriptionContext';
import { supabase } from '../services/api/supabaseClient';
import Colors from '../constants/Colors';



const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface SignupSubscriptionModalProps {
  visible: boolean;
  onClose: () => void;
  onSubscribe?: (planId: SubscriptionPlan, tier: SubscriptionTier) => Promise<void>;
  onContinueFree: () => void;
}

const SignupSubscriptionModal: React.FC<SignupSubscriptionModalProps> = ({
  visible,
  onClose,
  onSubscribe,
  onContinueFree,
}) => {
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('pro'); // Default to Pro tier
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('monthly'); // Default to monthly with trial
  const [loading, setLoading] = useState(false);
  const [packages, setPackages] = useState<any[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [userTrialUsed, setUserTrialUsed] = useState(false);
  const { subscribeToPro, restorePurchases } = useSubscription();

  // Initialize IAP service when modal becomes visible
  useEffect(() => {
    if (visible) {
      initializeIAP();
      checkUserTrialStatus();
      // Force re-render to ensure bottom section appears
      setIsInitialized(false);
      setTimeout(() => setIsInitialized(true), 100);
    }
  }, [visible]);

  // Check if user has already used their trial
  const checkUserTrialStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('trial_used')
          .eq('id', user.id)
          .single();
        
        setUserTrialUsed(profile?.trial_used || false);
      }
    } catch (error) {
      console.error('❌ Failed to check trial status:', error);
    }
  };

  const initializeIAP = async () => {
    try {
      await revenueCatService.initialize();
      const availablePackages = revenueCatService.getAvailablePackages();
      setPackages(availablePackages);
      console.log('📱 RevenueCat initialized for signup, loaded packages:', availablePackages.length);
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
        
        // If parent provided onSubscribe callback, use it
        if (onSubscribe) {
          await onSubscribe(selectedPlan, selectedTier);
        } else {
          // Otherwise show success message here
          Alert.alert(
            '🎉 Welcome to Pro!',
            `You've successfully subscribed to the ${selectedPlan} plan. Welcome to the premium experience!`,
            [{ 
              text: 'Let\'s Go!', 
              onPress: () => {
                onClose();
              }
            }]
          );
        }
      } else {
        // Handle purchase failure
        if (result.error === 'cancelled') {
          console.log('ℹ️ User cancelled purchase');
          // Don't show error for cancellation
        } else {
          console.error('❌ Purchase failed with error:', result.error);
          Alert.alert('Purchase Error', result.error || 'Unable to process purchase. Please try again.');
        }
      }
      
    } catch (error: any) {
      console.error('❌ Subscription error:', error);
      console.error('❌ Error type:', typeof error);
      console.error('❌ Error constructor:', error?.constructor?.name);
      
      // More robust error handling without instanceof
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
      // On successful restore, show a confirmation and close the modal
      Alert.alert(
        'Purchases Restored',
        'Your previous purchases have been successfully restored.',
        [{
          text: 'Continue',
          onPress: onClose,
        }]
      );
    } catch (error: any) {
      console.error('❌ Restore purchases error:', error);
      Alert.alert('Restore Failed', error?.message || 'Could not restore purchases. Please try again or contact support if the issue persists.');
    } finally {
      setLoading(false);
    }
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
      presentationStyle={Platform.OS === 'ios' && Platform.isPad ? "overFullScreen" : "pageSheet"}
      transparent={Platform.OS === 'ios' && Platform.isPad ? true : false}
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'landscape']}
    >
      {/* Debug logging for iPad */}
      {Platform.OS === 'ios' && Platform.isPad ? (() => {
        console.log('📱 [iPad Fix] Rendering SignupSubscriptionModal on iPad');
        return null;
      })() : null}
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
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Main Header - Now inside ScrollView */}
            <View style={styles.headerContent}>
              <View style={styles.crownContainer}>
                <Crown size={42} color="#F59E0B" />
                <View style={styles.crownGlow} />
              </View>
              <Text style={styles.headerTitle}>🚀 Welcome to Predictive Play!</Text>
              <Text style={styles.headerSubtitle}>
                Join elite bettors using AI-powered predictions
              </Text>
            </View>
            
            {/* Value Proposition */}
            <View style={styles.valueSection}>
              <Text style={styles.sectionTitle}>⚡ Choose Your Experience</Text>
              <Text style={styles.valueText}>
                Get started with AI-powered predictions and advanced betting tools
              </Text>
            </View>

            {/* Pricing Plans - Moved before features */}
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
                        <View style={styles.priceContainer}>
                          <Text style={styles.planPrice}>$199.99</Text>
                          <Text style={styles.planPeriod}>per year</Text>
                        </View>

                      </View>
                      <View style={styles.trialPriceContainer}>
                        <Text style={styles.trialPriceText}>7-day FREE trial, then $199.99/year</Text>
                      </View>
                      <Text style={styles.originalPriceText}>Cancel anytime during trial • No refunds after</Text>
                    </View>
                    {selectedPlan === 'yearly' && (
                      <View style={styles.selectedIndicator}>
                        <Check size={16} color="#0F172A" />
                      </View>
                    )}
                  </View>
                </LinearGradient>
              </TouchableOpacity>

              {/* Weekly Plan */}
              <TouchableOpacity
                style={[
                  styles.planCard,
                  selectedPlan === 'weekly' && styles.planCardSelected,
                ]}
                onPress={() => setSelectedPlan('weekly')}
              >
                <LinearGradient
                  colors={
                    selectedPlan === 'weekly'
                      ? ['#F59E0B', '#D97706']
                      : ['#1E293B', '#334155']
                  }
                  style={styles.planGradient}
                >
                  <View style={styles.planHeader}>
                    <View style={styles.planInfo}>
                      <Text style={styles.planName}>Weekly Pro</Text>
                      <View style={styles.priceContainer}>
                        <Text style={styles.planPrice}>$12.49</Text>
                        <Text style={styles.planPeriod}>per week</Text>
                      </View>
                      <Text style={styles.billingDetails}>$1.78 per day</Text>
                      <Text style={styles.originalPriceText}>Perfect for short-term needs</Text>
                    </View>
                    {selectedPlan === 'weekly' && (
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
                  {/* Free Trial Badge - Only show if user hasn't used trial */}
                  {!userTrialUsed && (
                    <View style={[
                      styles.trialBadge,
                      selectedPlan === 'monthly' && styles.trialBadgeSelected
                    ]}>
                      <Gift size={12} color={selectedPlan === 'monthly' ? '#0F172A' : '#F59E0B'} />
                      <Text style={[
                        styles.trialText,
                        selectedPlan === 'monthly' && styles.trialTextSelected
                      ]}>3-DAY FREE TRIAL</Text>
                    </View>
                  )}
                  
                  <View style={styles.planHeader}>
                    <View style={styles.planInfo}>
                      <Text style={styles.planName}>Monthly Pro</Text>
                      <View style={styles.priceContainer}>
                        <Text style={styles.planPrice}>$24.99</Text>
                        <Text style={styles.planPeriod}>per month</Text>
                      </View>
                      <Text style={styles.billingDetails}>
                        {!userTrialUsed ? '3-day FREE trial, then $0.83 per day' : '$0.83 per day'}
                      </Text>
                      <Text style={styles.originalPriceText}>Regular price: $49.98 (Save 50%)</Text>
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
                      <View style={styles.priceContainer}>
                        <Text style={styles.planPrice}>$349.99</Text>
                        <Text style={styles.planPeriod}>one-time payment</Text>
                      </View>
                      <Text style={styles.originalPriceText}>Regular price: $699.98 (Save 50%)</Text>
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

            {/* Monthly Pro Giveaway - Positioned between pricing and features */}
            <View style={styles.giveawayContainer}>
              <Gift size={20} color="#F59E0B" />
              <Text style={styles.giveawayText}>
                All Monthly Pro members are entered in a monthly giveaway to win a free Yearly Pro subscription!
              </Text>
            </View>

            {/* Quick Feature Comparison - After pricing */}
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

            {/* Apple Required Subscription Information - Inside ScrollView */}
            <View style={styles.appleRequiredInfo}>
              <Text style={styles.subscriptionInfoTitle}>Subscription Details</Text>
              <Text style={styles.subscriptionInfoText}>
                Weekly Pro: $12.49/week, auto-renewable{"\n"}
                Monthly Pro: $24.99/month, auto-renewable{"\n"}
                Yearly Pro: $199.99/year, auto-renewable{"\n"}
                Lifetime Pro: $349.99 one-time payment
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
            
            {/* Restore Purchases Button - moved to scrollable area */}
            <TouchableOpacity
              onPress={handleRestore}
              style={[styles.restoreButton, styles.restoreButtonInScroll, loading && { opacity: 0.7 }]}
              disabled={loading}
            >
              <Text style={styles.restoreButtonText}>Restore Purchases</Text>
            </TouchableOpacity>
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
                      : selectedPlan === 'weekly'
                        ? ['#F59E0B', '#D97706']
                        : ['#00E5FF', '#0891B2']
                }
                style={styles.subscribeGradient}
              >
                {selectedPlan === 'lifetime' ? (
                  <Gem size={20} color="#FFFFFF" />
                ) : selectedPlan === 'yearly' ? (
                  <Gift size={20} color="#FFFFFF" />
                ) : (
                  <Crown size={20} color="#FFFFFF" />
                )}
                <Text style={styles.subscribeText}>
                  {loading 
                    ? 'Processing...' 
                    : selectedPlan === 'yearly'
                      ? 'Start Free Trial'
                      : selectedPlan === 'weekly'
                        ? 'Start Weekly Pro'
                        : selectedPlan === 'monthly'
                          ? 'Start Monthly Pro'
                          : 'Get Lifetime Pro'
                  }
                </Text>
                <ChevronRight size={20} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>

            {/* Continue Free Button */}
            <TouchableOpacity
              style={styles.freeButton}
              onPress={() => {
                console.log('🎯 Try Free Account button pressed');
                // Simply call the onContinueFree callback
                // The parent component will handle the modal transitions properly
                if (onContinueFree) {
                  onContinueFree();
                }
              }}
              disabled={loading}
              activeOpacity={0.7}
            >
              <View style={styles.freeButtonContent}>
                <Gift size={20} color="#94A3B8" />
                <Text style={styles.freeButtonText}>Try Free Account (Limited)</Text>
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
                  Auto-renewable. Cancel anytime in iTunes Account Settings.
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
    // For iPad, center the content and limit the width
    ...(Platform.OS === 'ios' && Platform.isPad ? {
      maxWidth: 600,
      alignSelf: 'center',
      width: '100%',
      marginHorizontal: 'auto',
    } : {}),
  },
  gradient: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 45 : 30,
    paddingHorizontal: 20,
    paddingBottom: 0,
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
    marginTop: 5,
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  crownContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    position: 'relative',
  },
  crownGlow: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
    top: -5,
    left: -5,
    zIndex: -1,
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
    marginVertical: 12,
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
    fontSize: 20, // Increased size
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
    marginBottom: 8, // Added spacing between features
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
  trialBadge: {
    position: 'absolute',
    top: 40,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  trialText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F59E0B',
    marginLeft: 4,
  },
  trialBadgeSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  trialTextSelected: {
    color: '#0F172A',
  },
  trialPriceContainer: {
    marginTop: 4,
    marginBottom: 2,
  },
  trialPriceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F59E0B',
    textAlign: 'center',
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
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textAlign: 'left',
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
  giveawayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  giveawayText: {
    fontSize: 15,
    color: '#F59E0B',
    fontWeight: '600',
    marginLeft: 12,
    flex: 1,
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
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
    marginBottom: 16,
  },
  restoreButtonText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
  restoreButtonInScroll: {
    marginTop: 20,
    marginBottom: 20,
    alignSelf: 'center',
  },
});

export default SignupSubscriptionModal;