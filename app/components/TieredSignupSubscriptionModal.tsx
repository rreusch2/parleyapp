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
  Image,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  Crown,
  Check,
  Star,
  Zap,
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
import { supabase } from '../services/api/supabaseClient';
import Colors from '../constants/Colors';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface TieredSignupSubscriptionModalProps {
  visible: boolean;
  onClose: () => void;
  onSubscribe?: (planId: SubscriptionPlan, tier: SubscriptionTier) => Promise<void>;
  onContinueFree: () => void;
  onPurchaseSuccess?: () => void; // New callback for successful purchases
}

const TieredSignupSubscriptionModal: React.FC<TieredSignupSubscriptionModalProps> = ({
  visible,
  onClose,
  onSubscribe,
  onContinueFree,
  onPurchaseSuccess,
}) => {
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('pro'); // Default to Pro tier
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('pro_weekly'); // Default to Pro weekly
  const [loading, setLoading] = useState(false);
  const [packages, setPackages] = useState<any[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const { subscribe, restorePurchases } = useSubscription();
  // Optional remote video URL for Elite preview (configure in app.json/app.config.ts under expo.extra.elitePreviewVideoUrl)
  const eliteVideoUri: string | undefined = (Constants as any)?.expoConfig?.extra?.elitePreviewVideoUrl;

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
      // Apple App Store checkout
      const success = await subscribe(selectedPlan, selectedTier as 'pro' | 'elite');
      if (success) {
        console.log('✅ Apple IAP purchase completed successfully!');
        // Call the purchase success callback to navigate directly to app
        if (onPurchaseSuccess) {
          onPurchaseSuccess();
        } else {
          onClose();
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
      setSelectedPlan('pro_weekly');
    } else if (tier === 'elite') {
      setSelectedPlan('elite_daypass');
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
    const url = 'https://www.predictive-play.com/terms';
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
    const url = 'https://www.predictive-play.com/privacy';
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
      <Text style={styles.chooseYourPlanTitle}>🚀 Choose Your Winning Plan</Text>
      <View style={styles.urgencyContainer}>
        <View style={styles.urgencyBadge}>
          <Text style={styles.urgencyText}>⚡ Limited Time: 50% OFF All Plans</Text>
        </View>
      </View>
      
      {/* Tier Selection Cards */}
      <View style={styles.tierCardsContainer}>
        {/* Pro Tier Card */}
        <TouchableOpacity
          style={[styles.tierCard, styles.tierCardLeft, selectedTier === 'pro' && styles.tierCardSelected]}
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
                • 20 Winning AI Picks
              </Text>
              <Text style={[styles.tierFeature, selectedTier === 'pro' && styles.tierFeatureSelected]}>
                • 8 Expert Insights
              </Text>
              <Text style={[styles.tierFeature, selectedTier === 'pro' && styles.tierFeatureSelected]}>
                • Unlimited AI Chat
              </Text>
              <Text style={[styles.tierFeature, selectedTier === 'pro' && styles.tierFeatureSelected]}>
                • Live Analytics
              </Text>
            </View>
            
            <View>
              {selectedTier === 'pro' ? (
                <View style={styles.selectedIndicator}>
                  <Check size={16} color="#1D4ED8" />
                </View>
              ) : (
                <View style={styles.selectedIndicatorPlaceholder} />
              )}
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Elite Tier Card */}
        <TouchableOpacity
          style={[styles.tierCard, styles.tierCardRight, selectedTier === 'elite' && styles.tierCardSelected]}
          onPress={() => handleTierSelection('elite')}
        >
          <LinearGradient
            colors={selectedTier === 'elite' ? ['#8B5CF6', '#7C3AED'] : ['#1E293B', '#334155']}
            style={styles.tierCardGradient}
          >
            <View style={styles.premiumBadge}>
              <Sparkles size={10} color="#8B5CF6" />
              <Text style={styles.premiumText}>PREMIUM</Text>
            </View>
            
            <Trophy size={24} color={selectedTier === 'elite' ? '#FFFFFF' : '#94A3B8'} />
            <Text style={[styles.tierTitle, selectedTier === 'elite' && styles.tierTitleSelected]}>
              Elite
            </Text>
            <Text style={[styles.tierSubtitle, selectedTier === 'elite' && styles.tierSubtitleSelected]}>
              Ultimate betting experience
            </Text>
            
            <View style={styles.tierFeatures}>
              <Text style={[styles.tierFeature, selectedTier === 'elite' && styles.tierFeatureSelected]}>
                • 30 Elite AI Picks
              </Text>
              <Text style={[styles.tierFeature, selectedTier === 'elite' && styles.tierFeatureSelected]}>
                • 12 Pro Insights
              </Text>
              <Text style={[styles.tierFeature, selectedTier === 'elite' && styles.tierFeatureSelected]}>
                • Advanced Professor Lock
              </Text>
              <Text style={[styles.tierFeature, selectedTier === 'elite' && styles.tierFeatureSelected]}>
                • Premium Analytics
              </Text>
              <Text style={[styles.tierFeature, selectedTier === 'elite' && styles.tierFeatureSelected]}>
                • Ultra Customization & Themes
              </Text>
            </View>
            {/* Removed guarantee row to keep Pro/Elite cards the same height */}
            
            <View>
              {selectedTier === 'elite' ? (
                <View style={styles.selectedIndicator}>
                  <Check size={16} color="#7C3AED" />
                </View>
              ) : (
                <View style={styles.selectedIndicatorPlaceholder} />
              )}
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );


  const renderPlanOptions = () => {
    const currentTierPlans = selectedTier === 'pro' 
      ? ['pro_weekly', 'pro_monthly', 'pro_yearly', 'pro_daypass', 'pro_lifetime']
      : ['elite_daypass', 'elite_weekly', 'elite_monthly', 'elite_yearly', 'elite_lifetime'];

    return (
      <View style={styles.planOptionsContainer}>
        <Text style={styles.planOptionsTitle}>Select Billing Period</Text>
        
        {currentTierPlans.map((plan) => {
          const isSelected = selectedPlan === plan;
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
            savings = null;
            isTrialEligible = true;
          } else if (plan.includes('yearly')) {
            planName = 'Yearly';
            price = `$${pricing.yearly}`;
            period = 'per year';
            savings = 'Save 50%';
          } else if (plan.includes('daypass')) {
            planName = selectedTier === 'elite' ? 'Elite Day Pass' : 'Day Pass';
            price = `$${pricing.daypass}`;
            period = selectedTier === 'elite' ? '24 hours' : 'for 24 hours';
            if (selectedTier === 'elite') {
              savings = 'Try Elite';
            }
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
                  <View
                    style={[
                      styles.savingsBadge,
                      selectedTier === 'pro' ? styles.savingsBadgePro : styles.savingsBadgeElite,
                    ]}
                  >
                    <Text
                      style={[
                        styles.savingsText,
                        { color: selectedTier === 'pro' ? '#3B82F6' : '#8B5CF6' },
                      ]}
                    >
                      {savings}
                    </Text>
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
                      <Text style={styles.planPrice}>{price}</Text>
                      <Text style={styles.planPeriod}>{period}</Text>
                    </View>
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

          <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
            {/* Main Header */}
            <View style={styles.headerContent}>
              <View style={styles.logoContainer}>
                <Image source={require('../../assets/images/icon.png')} style={styles.appLogo} />
              </View>
              <Text style={styles.headerTitleLine1}>Welcome to</Text>
              <Text
                style={styles.headerTitleLine2}
              >
                {'Predictive\u00A0Play'}
              </Text>
              <Text
                style={[
                  styles.headerSocialProof,
                  { color: selectedTier === 'pro' ? '#3B82F6' : '#8B5CF6' },
                ]}
              >
                Join 10,000+ Elite Winners
              </Text>
            </View>

            {/* Tier Comparison */}
            {renderTierComparison()}

            {/* App Store / Play payment note */}
            <View style={{ paddingHorizontal: 20, marginBottom: 8, alignItems: 'center' }}>
              <Text style={{ color: '#94A3B8', fontSize: 12 }}>
                {Platform.OS === 'ios' ? 'Secure checkout via Apple App Store' : 'Secure checkout via Google Play'}
              </Text>
            </View>

            {/* Plan Options */}
            {renderPlanOptions()}

            {/* Continue Free Button */}
            <TouchableOpacity style={styles.continueButton} onPress={onContinueFree}>
              <Text style={styles.continueButtonText}>Skip Upgrade (Limited to 2 picks daily)</Text>
            </TouchableOpacity>

            {/* Tier Screenshot Preview below Skip */}
            {selectedTier === 'pro' && (
              <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
                <Image
                  source={require('../../assets/images/previews/pro-dashboard.png')}
                  style={styles.tierScreenshot}
                  resizeMode="cover"
                />
              </View>
            )}
            {selectedTier === 'elite' && (
              <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
                {eliteVideoUri ? (
                  <Video
                    source={{ uri: eliteVideoUri }}
                    style={styles.tierScreenshot}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay
                    isLooping
                    isMuted
                    usePoster
                    posterSource={require('../../assets/images/previews/elite-dashboard.png')}
                  />
                ) : (
                  <Image
                    source={require('../../assets/images/previews/elite-dashboard.png')}
                    style={styles.tierScreenshot}
                    resizeMode="cover"
                  />
                )}
                <View style={styles.eliteCustomizationNote}>
                  <Text style={styles.eliteCustomizationTitle}>Elite Unlocks Ultra Customization</Text>
                  <Text style={styles.eliteCustomizationText}>
                    Switch between premium themes and personalize the look of your app with Elite. Make it yours.
                  </Text>
                </View>
              </View>
            )}

            {/* Restore Purchases */}
            <TouchableOpacity style={styles.restoreButton} onPress={restorePurchases}>
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
                    <Text style={styles.subscriptionInfoText}>$12.49 per week, auto-renewable</Text>
                  </View>
                  
                  <View style={styles.subscriptionOption}>
                    <Text style={styles.subscriptionInfoTitle}>Monthly Pro Subscription</Text>
                    <Text style={styles.subscriptionInfoText}>$24.99 per month, auto-renewable</Text>
                  </View>
                  
                  <View style={styles.subscriptionOption}>
                    <Text style={styles.subscriptionInfoTitle}>Yearly Pro Subscription</Text>
                    <Text style={styles.subscriptionInfoText}>$149.99 per year, auto-renewable</Text>
                  </View>
                  
                  <View style={styles.subscriptionOption}>
                    <Text style={styles.subscriptionInfoTitle}>Pro Day Pass</Text>
                    <Text style={styles.subscriptionInfoText}>$6.49 one-time purchase (24 hours)</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.subscriptionOption}>
                    <Text style={styles.subscriptionInfoTitle}>Weekly Elite Subscription</Text>
                    <Text style={styles.subscriptionInfoText}>$14.99 per week, auto-renewable</Text>
                  </View>
                  
                  <View style={styles.subscriptionOption}>
                    <Text style={styles.subscriptionInfoTitle}>Monthly Elite Subscription</Text>
                    <Text style={styles.subscriptionInfoText}>$29.99 per month, auto-renewable</Text>
                  </View>
                  
                  <View style={styles.subscriptionOption}>
                    <Text style={styles.subscriptionInfoTitle}>Yearly Elite Subscription</Text>
                    <Text style={styles.subscriptionInfoText}>$199.99 per year, auto-renewable</Text>
                  </View>

                  <View style={styles.subscriptionOption}>
                    <Text style={styles.subscriptionInfoTitle}>Elite Day Pass</Text>
                    <Text style={styles.subscriptionInfoText}>$8.99 one-time purchase (24 hours), non-renewable</Text>
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

            
          </ScrollView>
        </LinearGradient>
        {/* Floating CTA */}
        <View style={styles.floatingFooter}>
          <TouchableOpacity
            style={[styles.floatingCTAButton, loading && styles.subscribeButtonDisabled]}
            onPress={handleSubscribe}
            disabled={loading}
          >
            <LinearGradient
              colors={selectedTier === 'pro' ? ['#3B82F6', '#1D4ED8'] : ['#8B5CF6', '#7C3AED']}
              style={styles.floatingCTAButtonGradient}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.floatingCTAButtonText}>
                  🚀 Start Winning Now - {selectedTier === 'pro' ? 'Pro' : 'Elite'}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
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
  logoContainer: {
    marginBottom: 16,
  },
  appLogo: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  headerTitleLine1: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  headerTitleLine2: {
    fontSize: 30,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#CBD5E1',
    textAlign: 'center',
    lineHeight: 22,
  },
  headerSocialProof: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 0,
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
  },
  tierCard: {
    flex: 1,
    borderRadius: 16,
  },
  tierCardLeft: {
    marginRight: 6,
  },
  tierCardRight: {
    marginLeft: 6,
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
    minHeight: 240,
    paddingBottom: 32,
    borderRadius: 16,
    overflow: 'hidden',
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
    borderWidth: 1,
  },
  savingsBadgePro: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: '#3B82F6',
  },
  savingsBadgeElite: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderColor: '#8B5CF6',
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
  selectedIndicatorPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginLeft: 8,
    opacity: 0,
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
  tierScreenshot: {
    width: '100%',
    height: Math.min(screenHeight * 0.65, 640),
    borderRadius: 16,
    overflow: 'hidden',
  },
  eliteCustomizationNote: {
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)'
  },
  eliteCustomizationTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  eliteCustomizationText: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 16,
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
  floatingFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Platform.OS === 'ios' ? 14 : 10,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 16 : 12,
    paddingTop: 4,
  },
  floatingCTAButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  floatingCTAButtonGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  floatingCTAButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
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
    marginBottom: 4,
  },
  originalPrice: {
    fontSize: 14,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
    marginRight: 8,
  },
  discountBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  planNameWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  // Conversion optimization styles
  urgencyContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  urgencyBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  urgencyText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  socialProofContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  socialProofText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
    textAlign: 'center',
  },
  guaranteeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  guaranteeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10B981',
    marginLeft: 4,
  },
  popularBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  popularBadgeSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderColor: '#FFFFFF',
  },
  popularBadgePro: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: '#3B82F6',
  },
  popularBadgeElite: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderColor: '#8B5CF6',
  },
  popularText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
    marginLeft: 4,
  },
  popularTextSelected: {
    color: '#0F172A',
  },
  valuePropositionContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  valuePropositionText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
    textAlign: 'center',
  },
  valuePropositionPillPro: {
    alignSelf: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: '#3B82F6',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 6,
  },
  valuePropositionPillElite: {
    alignSelf: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderColor: '#8B5CF6',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 6,
  },
  valuePropositionTextPro: {
    color: '#3B82F6',
    fontWeight: '700',
  },
  valuePropositionTextElite: {
    color: '#8B5CF6',
    fontWeight: '700',
  },
  previewSection: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 15,
  },
  previewContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  previewImageContainer: {
    flex: 1,
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  previewImage: {
    width: '100%',
    height: 160,
    borderRadius: 12,
  },
  previewImageDimmed: {
    opacity: 0.6,
  },
  previewOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    opacity: 0.8,
  },
  previewOverlayActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    opacity: 1,
  },
  previewLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  previewFeature: {
    color: '#CBD5E1',
    fontSize: 13,
    marginTop: 2,
  },
  // Payment method selection styles
  paymentMethodContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  paymentMethodTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  paymentMethodCards: {
    flexDirection: 'row',
    gap: 14,
  },
  paymentMethodCard: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  paymentMethodCardSelected: {
    transform: [{ scale: 1.03 }],
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  paymentMethodGradient: {
    padding: 18,
    borderRadius: 14,
    minHeight: 120,
  },
  paymentMethodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  paymentMethodIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  paymentMethodName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  paymentMethodDescription: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  paymentMethodFeatures: {
    gap: 2,
  },
  paymentMethodFeature: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 11,
    fontWeight: '500',
  },
});

export default TieredSignupSubscriptionModal;
