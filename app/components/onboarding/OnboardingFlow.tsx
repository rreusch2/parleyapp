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
}

export interface UserPreferences {
  sportPreferences: {
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
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [preferences, setPreferences] = useState<UserPreferences>({
    sportPreferences: { mlb: true, wnba: false, ufc: false },
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

  return (
    <LinearGradient
      colors={['#1a1a2e', '#16213e', '#0f3460']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView 
          style={styles.keyboardAvoidingView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          {/* Header */}
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

          {/* Progress Indicators */}
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

          {/* Scrollable Step Content */}
          <ScrollView 
            style={styles.scrollContainer}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View
              style={[
                styles.stepContainer,
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

          {/* Bottom Step Info */}
          <View style={styles.stepInfo}>
            <View style={styles.stepIconContainer}>
              <Ionicons 
                name={steps[currentStep]?.icon as any} 
                size={isTablet ? 28 : 24} 
                color="#00d4ff" 
              />
            </View>
            <Text style={styles.stepTitle}>{steps[currentStep]?.title}</Text>
            <Text style={styles.stepCounter}>
              {currentStep + 1} of {steps.length}
            </Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
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
});

export default OnboardingFlow;
