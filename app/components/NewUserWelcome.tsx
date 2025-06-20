import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Animated,
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Sparkles, 
  Clock, 
  Crown, 
  Gift, 
  Zap,
  ArrowRight,
  X
} from 'lucide-react-native';
import { AIPrediction } from '@/app/services/api/aiService';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface NewUserWelcomeProps {
  visible: boolean;
  onClose: () => void;
  onGetStarterPicks: () => Promise<void>;
  onGeneratePersonalized: () => Promise<void>;
  isLoading: boolean;
}

export default function NewUserWelcome({ 
  visible, 
  onClose, 
  onGetStarterPicks, 
  onGeneratePersonalized,
  isLoading 
}: NewUserWelcomeProps) {
  const [sparkleAnimation] = useState(new Animated.Value(0));

  React.useEffect(() => {
    if (visible) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(sparkleAnimation, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(sparkleAnimation, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [visible]);

  const sparkleOpacity = sparkleAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <LinearGradient
            colors={['#1e1b4b', '#312e81', '#1e40af']}
            style={styles.gradient}
          >
            {/* Close Button */}
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={onClose}
            >
              <X size={24} color="#fff" />
            </TouchableOpacity>

            {/* Header */}
            <View style={styles.header}>
              <Animated.View style={[styles.sparkleContainer, { opacity: sparkleOpacity }]}>
                <Sparkles size={48} color="#fbbf24" />
              </Animated.View>
              <Text style={styles.title}>Welcome to ParleyApp!</Text>
              <Text style={styles.subtitle}>Your AI-powered sports betting companion</Text>
            </View>

            {/* Features */}
            <View style={styles.featuresContainer}>
              <View style={styles.feature}>
                <View style={styles.featureIcon}>
                  <Gift size={24} color="#10b981" />
                </View>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>Free Daily Picks</Text>
                  <Text style={styles.featureDescription}>Get 2 AI-analyzed picks every day at 8 AM</Text>
                </View>
              </View>

              <View style={styles.feature}>
                <View style={styles.featureIcon}>
                  <Clock size={24} color="#3b82f6" />
                </View>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>Daily Schedule</Text>
                  <Text style={styles.featureDescription}>Fresh predictions delivered automatically</Text>
                </View>
              </View>

              <View style={styles.feature}>
                <View style={styles.featureIcon}>
                  <Crown size={24} color="#f59e0b" />
                </View>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>Upgrade to Pro</Text>
                  <Text style={styles.featureDescription}>Unlimited picks + real-time AI chat</Text>
                </View>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
                onPress={onGetStarterPicks}
                disabled={isLoading}
              >
                <LinearGradient
                  colors={['#10b981', '#059669']}
                  style={styles.buttonGradient}
                >
                  <Gift size={20} color="#fff" />
                  <Text style={styles.primaryButtonText}>
                    {isLoading ? 'Getting your picks...' : 'Get My 2 Free Picks Today'}
                  </Text>
                  {!isLoading && <ArrowRight size={20} color="#fff" />}
                  {isLoading && (
                    <View style={styles.loadingSpinner}>
                      <Text style={styles.loadingText}>⚡</Text>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryButton, isLoading && styles.buttonDisabled]}
                onPress={onGeneratePersonalized}
                disabled={isLoading}
              >
                <View style={styles.secondaryButtonContent}>
                  <Zap size={18} color="#3b82f6" />
                  <Text style={styles.secondaryButtonText}>
                    {isLoading ? 'Generating picks...' : 'Generate Personalized Picks'}
                  </Text>
                </View>
                <Text style={styles.secondaryButtonSubtext}>
                  {isLoading ? 'Please wait 20-30 seconds...' : '(takes 20-30 seconds)'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <Text style={styles.footer}>
              Starting tomorrow, you'll receive 2 fresh picks every morning at 8 AM
            </Text>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: Math.min(screenWidth - 40, 420),
    maxHeight: screenHeight * 0.85,
    borderRadius: 20,
    overflow: 'hidden',
  },
  gradient: {
    padding: 30,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    paddingTop: 20,
  },
  sparkleContainer: {
    marginBottom: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  featuresContainer: {
    marginBottom: 30,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  actionsContainer: {
    marginBottom: 20,
  },
  primaryButton: {
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  secondaryButton: {
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  secondaryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#3b82f6',
  },
  secondaryButtonSubtext: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  footer: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    lineHeight: 18,
  },
  loadingSpinner: {
    marginLeft: 8,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
}); 