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
  Trophy,
  Sparkles,
} from 'lucide-react-native';
import revenueCatService, { SubscriptionPlan, SubscriptionTier, SUBSCRIPTION_TIERS } from '../services/revenueCatService';
import { useSubscription } from '../services/subscriptionContext';
import Colors from '../constants/Colors';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface TieredSignupSubscriptionModalProps {
  visible: boolean;
  onClose: () => void;
  onSubscribe?: (planId: SubscriptionPlan, tier: SubscriptionTier) => Promise<void>;
  onContinueFree: () => void;
}

const TieredSignupSubscriptionModal: React.FC<TieredSignupSubscriptionModalProps> = ({
  visible,
  onClose,
  onSubscribe,
  onContinueFree,
}) => {
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('pro'); // Default to Pro tier
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('pro_yearly'); // Default to Pro yearly
  const [loading, setLoading] = useState(false);
  const [packages, setPackages] = useState<any[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const { subscribeToPro, restorePurchases } = useSubscription();

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
      
      console.log('🔄 Starting subscription purchase for:', selectedPlan, selectedTier);
      
      const result = await revenueCatService.purchasePackage(selectedPlan);
      
      if (result.success) {
        console.log('✅ Purchase completed successfully!');
        
        const tierName = selectedTier === 'pro' ? 'Pro' : 'All-Star';
        if (onSubscribe) {
          await onSubscribe(selectedPlan, selectedTier);
        } else {
          Alert.alert(
            `🎉 Welcome to ${tierName}!`,
            `You've successfully subscribed to the ${tierName} plan. Welcome to the premium experience!`,
            [{ 
              text: 'Let\'s Go!', 
              onPress: () => {
                onClose();
              }
            }]
          );
        }
      } else {
        if (result.error === 'cancelled') {
          console.log('ℹ️ User cancelled purchase');
        } else {
          console.error('❌ Purchase failed with error:', result.error);
          Alert.alert('Purchase Error', result.error || 'Unable to process purchase. Please try again.');
        }
      }
      
    } catch (error: any) {
      console.error('❌ Subscription error:', error);
      
      let errorMessage = 'Unable to process purchase. Please try again.';
      
      if (error && typeof error === 'object') {
        const errorStr = error.message || error.toString() || '';
        
        if (errorStr.includes('cancelled') || errorStr.includes('canceled')) {
          console.log('ℹ️ User cancelled purchase');
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

  const handleTierSelection = (tier: SubscriptionTier) => {
    setSelectedTier(tier);
    // Set default plan for the selected tier
    if (tier === 'pro') {
      setSelectedPlan('pro_yearly');
    } else if (tier === 'allstar') {
      setSelectedPlan('allstar_yearly');
    }
  };

  const handlePlanSelection = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    // Update tier based on plan selection
    if (plan.startsWith('pro_')) {
      setSelectedTier('pro');
    } else if (plan.startsWith('allstar_')) {
      setSelectedTier('allstar');
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

  const renderTierComparison = () => (
    <View style={styles.tierComparisonContainer}>
      <Text style={styles.chooseYourPlanTitle}>🚀 Choose Your Plan</Text>
      
      {/* Tier Selection Cards */}
      <View style={styles.tierCardsContainer}>
        {/* Pro Tier Card */}
        <TouchableOpacity
          style={[styles.tierCard, selectedTier === 'pro' && styles.tierCardSelected]}
          onPress={() => handleTierSelection('pro')}
        >
          <LinearGradient
            colors={selectedTier === 'pro' ? ['#3B82F6', '#1D4ED8'] : ['#1E293B', '#334155']}
            style={styles.tierCardGradient}
          >
            <View style={styles.mostPopularBadge}>
              <Star size={10} color="#F59E0B" />
              <Text style={styles.mostPopularText}>MOST POPULAR</Text>
            </View>
            
            <Crown size={24} color={selectedTier === 'pro' ? '#FFFFFF' : '#94A3B8'} />
            <Text style={[styles.tierTitle, selectedTier === 'pro' && styles.tierTitleSelected]}>
              Pro
            </Text>
            <Text style={[styles.tierSubtitle, selectedTier === 'pro' && styles.tierSubtitleSelected]}>
              Perfect for serious bettors
            </Text>
            
            <View style={styles.tierFeatures}>
              <Text style={[styles.tierFeature, selectedTier === 'pro' && styles.tierFeatureSelected]}>
                • 20 Daily AI Picks
              </Text>
              <Text style={[styles.tierFeature, selectedTier === 'pro' && styles.tierFeatureSelected]}>
                • 8 Daily Insights
              </Text>
              <Text style={[styles.tierFeature, selectedTier === 'pro' && styles.tierFeatureSelected]}>
                • Unlimited Chat
              </Text>
              <Text style={[styles.tierFeature, selectedTier === 'pro' && styles.tierFeatureSelected]}>
                • Play of the Day
              </Text>
            </View>
            
            {selectedTier === 'pro' && (
              <View style={styles.selectedIndicator}>
                <Check size={16} color="#1D4ED8" />
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* All-Star Tier Card */}
        <TouchableOpacity
          style={[styles.tierCard, selectedTier === 'allstar' && styles.tierCardSelected]}
          onPress={() => handleTierSelection('allstar')}
        >
          <LinearGradient
            colors={selectedTier === 'allstar' ? ['#8B5CF6', '#7C3AED'] : ['#1E293B', '#334155']}
            style={styles.tierCardGradient}
          >
            <View style={styles.premiumBadge}>
              <Sparkles size={10} color="#8B5CF6" />
              <Text style={styles.premiumText}>PREMIUM</Text>
            </View>
            
            <Trophy size={24} color={selectedTier === 'allstar' ? '#FFFFFF' : '#94A3B8'} />
            <Text style={[styles.tierTitle, selectedTier === 'allstar' && styles.tierTitleSelected]}>
              All-Star
            </Text>
            <Text style={[styles.tierSubtitle, selectedTier === 'allstar' && styles.tierSubtitleSelected]}>
              Ultimate betting experience
            </Text>
            
            <View style={styles.tierFeatures}>
              <Text style={[styles.tierFeature, selectedTier === 'allstar' && styles.tierFeatureSelected]}>
                • 30 Daily AI Picks
              </Text>
              <Text style={[styles.tierFeature, selectedTier === 'allstar' && styles.tierFeatureSelected]}>
                • 12 Daily Insights
              </Text>
              <Text style={[styles.tierFeature, selectedTier === 'allstar' && styles.tierFeatureSelected]}>
                • Advanced AI Chat
              </Text>
              <Text style={[styles.tierFeature, selectedTier === 'allstar' && styles.tierFeatureSelected]}>
                • Premium Analytics
              </Text>
            </View>
            
            {selectedTier === 'allstar' && (
              <View style={styles.selectedIndicator}>
                <Check size={16} color="#7C3AED" />
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPlanOptions = () => {
    const currentTierPlans = selectedTier === 'pro' 
      ? ['pro_yearly', 'pro_monthly', 'pro_weekly']
      : ['allstar_yearly', 'allstar_monthly', 'allstar_weekly'];

    return (
      <View style={styles.planOptionsContainer}>
        <Text style={styles.planOptionsTitle}>Select Billing Period</Text>
        
        {currentTierPlans.map((plan) => {
          const isSelected = selectedPlan === plan;
          const pricing = (SUBSCRIPTION_TIERS[selectedTier] as any).pricing;
          
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
          } else if (plan.includes('yearly')) {
            planName = 'Yearly';
            price = `$${pricing.yearly}`;
            period = 'per year';
            savings = 'Save 50%';
            isTrialEligible = true;
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
                
                {isTrialEligible && (
                  <View style={[styles.trialBadge, isSelected && styles.trialBadgeSelected]}>
                    <Gift size={12} color={isSelected ? '#0F172A' : '#F59E0B'} />
                    <Text style={[styles.trialText, isSelected && styles.trialTextSelected]}>
                      3-DAY FREE TRIAL
                    </Text>
                  </View>
                )}
                
                <View style={styles.planHeader}>
                  <View style={styles.planInfo}>
                    <View style={styles.planNameContainer}>
                      <Text style={styles.planName}>{planName}</Text>
                      {isSelected && (
                        <View style={styles.selectedIndicator}>
                          <Check size={16} color="#0F172A" />
                        </View>
                      )}
                    </View>
                    <View style={styles.priceContainer}>
                      <Text style={styles.planPrice}>{price}</Text>
                      <Text style={styles.planPeriod}>{period}</Text>
                    </View>
                    {isTrialEligible && (
                      <Text style={styles.trialDetails}>
                        3-day FREE trial, then {price}/{period.split(' ')[1]}
                      </Text>
                    )}
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
      presentationStyle={Platform.OS === 'ios' && Platform.isPad ? "overFullScreen" : "pageSheet"}
      transparent={Platform.OS === 'ios' && Platform.isPad ? true : false}
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'landscape']}
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
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Main Header */}
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
                      Start {selectedTier === 'pro' ? 'Pro' : 'All-Star'} Experience
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Continue Free Button */}
            <TouchableOpacity style={styles.continueButton} onPress={onContinueFree}>
              <Text style={styles.continueButtonText}>Continue with Free (2 picks daily)</Text>
            </TouchableOpacity>

            {/* Restore Purchases */}
            <TouchableOpacity style={styles.restoreButton} onPress={restorePurchases}>
              <Text style={styles.restoreText}>Restore Purchases</Text>
            </TouchableOpacity>

            {/* Apple-Required Subscription Information */}
            <View style={styles.appleRequiredInfo}>
              <Text style={styles.subscriptionSectionTitle}>
                {selectedTier === 'pro' ? 'Pro Tier' : 'All-Star Tier'} Subscription Options
              </Text>
              
              {selectedTier === 'pro' ? (
                <>
                  <View style={styles.subscriptionOption}>
                    <Text style={styles.subscriptionInfoTitle}>Weekly Pro Subscription</Text>
                    <Text style={styles.subscriptionInfoText}>$9.99 per week, auto-renewable</Text>
                  </View>
                  
                  <View style={styles.subscriptionOption}>
                    <Text style={styles.subscriptionInfoTitle}>Monthly Pro Subscription</Text>
                    <Text style={styles.subscriptionInfoText}>$19.99 per month, auto-renewable</Text>
                  </View>
                  
                  <View style={styles.subscriptionOption}>
                    <Text style={styles.subscriptionInfoTitle}>Yearly Pro Subscription</Text>
                    <Text style={styles.subscriptionInfoText}>$149.99 per year, auto-renewable</Text>
                    <Text style={styles.trialInfoText}>3-day free trial included</Text>
                  </View>
                  
                  <View style={styles.subscriptionOption}>
                    <Text style={styles.subscriptionInfoTitle}>Pro Day Pass</Text>
                    <Text style={styles.subscriptionInfoText}>$4.99 one-time purchase (24 hours)</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.subscriptionOption}>
                    <Text style={styles.subscriptionInfoTitle}>Weekly All-Star Subscription</Text>
                    <Text style={styles.subscriptionInfoText}>$14.99 per week, auto-renewable</Text>
                  </View>
                  
                  <View style={styles.subscriptionOption}>
                    <Text style={styles.subscriptionInfoTitle}>Monthly All-Star Subscription</Text>
                    <Text style={styles.subscriptionInfoText}>$29.99 per month, auto-renewable</Text>
                  </View>
                  
                  <View style={styles.subscriptionOption}>
                    <Text style={styles.subscriptionInfoTitle}>Yearly All-Star Subscription</Text>
                    <Text style={styles.subscriptionInfoText}>$199.99 per year, auto-renewable</Text>
                    <Text style={styles.trialInfoText}>3-day free trial included</Text>
                  </View>
                </>
              )}
              
              <View style={styles.termsRow}>
                <Text style={[styles.subscriptionInfoText, { marginBottom: 8 }]}>By subscribing you agree to our:</Text>
              </View>
              
              <View style={styles.termsLinksRow}>
                <TouchableOpacity style={styles.linkButton} onPress={openTermsOfService}>
                  <Text style={styles.linkText}>Terms of Service</Text>
                </TouchableOpacity>
                <Text style={styles.subscriptionInfoText}> and </Text>
                <TouchableOpacity style={styles.linkButton} onPress={openPrivacyPolicy}>
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
  headerContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  crownContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  crownGlow: {
    position: 'absolute',
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    backgroundColor: '#F59E0B',
    borderRadius: 30,
    opacity: 0.2,
    zIndex: -1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#CBD5E1',
    textAlign: 'center',
    lineHeight: 22,
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
  tierCardsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  tierCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  tierCardSelected: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  tierCardGradient: {
    padding: 20,
    alignItems: 'center',
    position: 'relative',
    minHeight: 200,
  },
  mostPopularBadge: {
    position: 'absolute',
    top: 8,
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
    top: 8,
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
  tierTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 12,
    marginBottom: 4,
  },
  tierTitleSelected: {
    color: '#FFFFFF',
  },
  tierSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 16,
  },
  tierSubtitleSelected: {
    color: '#CBD5E1',
  },
  tierFeatures: {
    alignItems: 'flex-start',
  },
  tierFeature: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  tierFeatureSelected: {
    color: '#CBD5E1',
  },
  planOptionsContainer: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  planOptionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
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
    alignItems: 'center',
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
  priceContainer: {
    alignItems: 'center',
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
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
  selectedIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  subscribeButton: {
    marginHorizontal: 20,
    marginBottom: 16,
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
  continueButton: {
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#CBD5E1',
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
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
});

export default TieredSignupSubscriptionModal;
