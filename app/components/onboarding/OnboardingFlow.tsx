import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import SportsSelectionScreen from './SportsSelectionScreen';
import BettingStyleScreen from './BettingStyleScreen';
import PhoneVerificationScreen from './PhoneVerificationScreen';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isSmallScreen = screenHeight < 700;

interface OnboardingFlowProps {
  onComplete: (preferences: UserPreferences) => void;
  onSkip?: () => void;
  isExistingUser?: boolean;
  isModal?: boolean;
}

export interface UserPreferences {
  sportPreferences: {
    nfl: boolean;
    cfb: boolean;
    mlb: boolean;
    wnba: boolean;
    ufc: boolean;
  };
  bettingStyle: 'conservative' | 'balanced' | 'aggressive';
  phoneNumber?: string;
}

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  onComplete,
  onSkip,
  isExistingUser = false,
  isModal = false,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [preferences, setPreferences] = useState<UserPreferences>({
    sportPreferences: { nfl: true, cfb: true, mlb: true, wnba: false, ufc: false },
    bettingStyle: 'balanced',
  });

  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const steps = [
    {
      title: 'Sports Selection',
      component: SportsSelectionScreen,
      icon: 'basketball-outline',
    },
    {
      title: 'Betting Style',
      component: BettingStyleScreen,
      icon: 'trending-up-outline',
    },
    ...(isExistingUser ? [] : [{
      title: 'Phone Verification',
      component: PhoneVerificationScreen,
      icon: 'phone-portrait-outline',
    }]),
  ];

  const animateToNextStep = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -screenWidth,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setCurrentStep(prev => prev + 1);
      slideAnim.setValue(screenWidth);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  const handleStepComplete = (stepData: any) => {
    const updatedPreferences = { ...preferences, ...stepData };
    setPreferences(updatedPreferences);

    if (currentStep < steps.length - 1) {
      animateToNextStep();
    } else {
      onComplete(updatedPreferences);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: screenWidth,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setCurrentStep(prev => prev - 1);
        slideAnim.setValue(-screenWidth);
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }
  };

  const CurrentStepComponent = steps[currentStep]?.component;

  // Choose layout based on modal context
  const ContainerComponent = isModal ? View : LinearGradient;
  const containerProps = isModal 
    ? { style: styles.modalContainer } 
    : { 
        colors: ['#1a1a2e', '#16213e', '#0f3460'], 
        style: styles.container 
      };

  const WrapperComponent = isModal ? View : SafeAreaView;
  const wrapperStyle = isModal ? styles.modalWrapper : styles.safeArea;

  return (
    <ContainerComponent {...containerProps}>
      <WrapperComponent style={wrapperStyle}>
        <KeyboardAvoidingView 
          style={isModal ? styles.modalKeyboardAvoidingView : styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          {/* Regular Header for non-modal */}
          {!isModal && (
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                {currentStep > 0 && (
                  <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={20} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
              
              <View style={styles.headerCenter}>
                <Text style={styles.headerTitle}>Update Preferences</Text>
              </View>
              
              <View style={styles.headerRight}>
                {onSkip && (
                  <TouchableOpacity onPress={onSkip} style={styles.skipButton}>
                    <Text style={styles.skipText}>Skip</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Modal-optimized header */}
          {isModal && (
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderContent}>
                {currentStep > 0 && (
                  <TouchableOpacity onPress={handleBack} style={styles.modalBackButton}>
                    <Ionicons name="chevron-back" size={18} color="#fff" />
                  </TouchableOpacity>
                )}
                <View style={styles.modalProgressContainer}>
                  {steps.map((_, index) => (
                    <Animated.View
                      key={index}
                      style={[
                        styles.modalProgressDot,
                        {
                          backgroundColor: index <= currentStep ? '#00d4ff' : 'rgba(255,255,255,0.2)',
                          transform: [
                            {
                              scale: index === currentStep ? 1.1 : 1,
                            },
                          ],
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text style={styles.modalStepCounter}>
                  {currentStep + 1}/{steps.length}
                </Text>
              </View>
            </View>
          )}

          {/* Regular Progress Indicators for non-modal */}
          {!isModal && (
            <View style={styles.progressContainer}>
              {steps.map((_, index) => (
                <Animated.View
                  key={index}
                  style={[
                    styles.progressDot,
                    {
                      backgroundColor: index <= currentStep ? '#00d4ff' : 'rgba(255,255,255,0.3)',
                      transform: [
                        {
                          scale: index === currentStep ? 1.2 : 1,
                        },
                      ],
                    },
                  ]}
                />
              ))}
            </View>
          )}

          {/* Scrollable Step Content */}
          <ScrollView 
            style={isModal ? styles.modalScrollContainer : styles.scrollContainer}
            contentContainerStyle={isModal ? styles.modalScrollContent : styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View
              style={[
                isModal ? styles.modalStepContainer : styles.stepContainer,
                {
                  opacity: fadeAnim,
                  transform: [{ translateX: slideAnim }],
                },
              ]}
            >
              {CurrentStepComponent && (
                <CurrentStepComponent
                  onComplete={handleStepComplete}
                  currentPreferences={preferences}
                  isExistingUser={isExistingUser}
                />
              )}
            </Animated.View>
          </ScrollView>

          {/* Compact Bottom Step Info */}
          <View style={isModal ? styles.modalStepInfo : styles.stepInfo}>
            <View style={isModal ? styles.modalStepIconContainer : styles.stepIconContainer}>
              <Ionicons 
                name={steps[currentStep]?.icon as any} 
                size={isModal ? 18 : (isTablet ? 28 : 24)} 
                color="#00d4ff" 
              />
            </View>
            <Text style={isModal ? styles.modalStepTitle : styles.stepTitle}>
              {steps[currentStep]?.title}
            </Text>
            {!isModal && (
              <Text style={styles.stepCounter}>
                {currentStep + 1} of {steps.length}
              </Text>
            )}
          </View>
        </KeyboardAvoidingView>
      </WrapperComponent>
    </ContainerComponent>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
    paddingHorizontal: isTablet ? 40 : 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: isSmallScreen ? 12 : 20,
    height: isSmallScreen ? 50 : 60,
    marginBottom: isSmallScreen ? 8 : 16,
  },
  headerLeft: {
    width: 60,
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerRight: {
    width: 60,
    alignItems: 'flex-end',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  skipButton: {
    padding: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  skipText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: isSmallScreen ? 12 : 20,
    gap: 12,
  },
  progressDot: {
    width: isTablet ? 10 : 8,
    height: isTablet ? 10 : 8,
    borderRadius: isTablet ? 5 : 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  scrollContainer: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
    minHeight: isSmallScreen ? screenHeight * 0.5 : screenHeight * 0.6,
  },
  stepContainer: {
    flex: 1,
    width: '100%',
    minHeight: isSmallScreen ? screenHeight * 0.4 : screenHeight * 0.5,
  },
  stepInfo: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingBottom: 40,
  },
  stepIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  stepCounter: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  // Modal-specific styles for optimized space usage
  modalContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  modalWrapper: {
    flex: 1,
  },
  modalKeyboardAvoidingView: {
    flex: 1,
    paddingHorizontal: isTablet ? 24 : 16,
  },
  modalHeader: {
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  modalHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalBackButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'center',
  },
  modalProgressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  modalStepCounter: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
    minWidth: 28,
    textAlign: 'right',
  },
  modalScrollContainer: {
    flex: 1,
    marginVertical: 8,
  },
  modalScrollContent: {
    flexGrow: 1,
    paddingBottom: 16,
    // Give most of the screen to content
    minHeight: screenHeight * 0.7,
  },
  modalStepContainer: {
    flex: 1,
    width: '100%',
    // Optimize for maximum content space
    minHeight: screenHeight * 0.65,
  },
  modalStepInfo: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingBottom: 20,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  modalStepIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 212, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  modalStepTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
  },
});

export default OnboardingFlow;
