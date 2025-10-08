import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Animated,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Trophy,
  Target,
  Brain,
  MessageCircle,
  Crown,
  Sparkles,
  TrendingUp,
  Shield,
  Zap,
  Settings,
  Palette,
  Star,
  Gift,
  Users,
  DollarSign,
} from 'lucide-react-native';
import { useUITheme } from '../services/uiThemeContext';
import { supabase } from '../services/api/supabaseClient';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface OnboardingSlide {
  icon: React.ReactNode;
  title: string;
  description: string;
  highlight?: string;
  image?: string;
}

interface OnboardingTutorialProps {
  visible: boolean;
  onClose: () => void;
  tier: 'free' | 'pro' | 'elite';
  userId?: string;
}

export default function OnboardingTutorial({
  visible,
  onClose,
  tier,
  userId,
}: OnboardingTutorialProps) {
  const { theme } = useUITheme();
  const [currentSlide, setCurrentSlide] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Tier-specific slides
  const getSlides = (): OnboardingSlide[] => {
    if (tier === 'elite') {
      return [
        {
          icon: <Crown size={60} color={theme.accentPrimary} />,
          title: 'Welcome to Elite! 🏆',
          description: 'Thank you for subscribing to our most advanced tier! You now have access to premium features designed to maximize your winning potential.',
          highlight: 'Elite members average 67% win rate!',
        },
        {
          icon: <Palette size={56} color={theme.accentPrimary} />,
          title: 'Custom App Themes',
          description: 'Tap the Theme button at the top of the Home tab to choose from stunning app themes. Make the app truly yours!',
          highlight: 'More themes coming soon! 🎨',
        },
        {
          icon: <Target size={56} color={theme.accentPrimary} />,
          title: '30 Daily AI Predictions',
          description: 'Get 30 premium, data-backed AI predictions daily - a perfect mix of player props and team picks across all major sports.',
          highlight: 'Updated every morning!',
        },
        {
          icon: <Star size={56} color="#FFD700" />,
          title: 'Lock of the Day 🔐',
          description: 'Every day we analyze thousands of bets to find THE best pick. Find it in the Lock of the Day section on your Home tab.',
          highlight: '85%+ confidence picks only',
        },
        {
          icon: <Brain size={56} color={theme.accentPrimary} />,
          title: 'Enhanced Professor Lock',
          description: 'Your personal AI sports betting assistant with advanced tools: parlay builder, web search, real-time odds, injury reports, and more!',
          highlight: 'Drag the bubble to any corner you like',
        },
        {
          icon: <Settings size={56} color={theme.accentPrimary} />,
          title: 'Customize Your Experience',
          description: 'Go to Settings → Chat Bubble to customize Professor Lock\'s appearance and animations. Make it bounce, pulse, or stay subtle!',
        },
        {
          icon: <Trophy size={56} color={theme.accentPrimary} />,
          title: "You're All Set! 🎯",
          description: 'Join thousands of Elite winners who trust our AI predictions daily. Check the Picks tab for today\'s premium selections!',
          highlight: 'Let\'s win together! 💰',
        },
      ];
    } else if (tier === 'pro') {
      return [
        {
          icon: <Crown size={60} color="#00E5FF" />,
          title: 'Welcome to Pro! 💎',
          description: 'You\'ve unlocked powerful AI predictions and advanced tools. Let\'s help you beat the sportsbooks!',
          highlight: 'Thousands of daily Pro winners!',
        },
        {
          icon: <Target size={56} color="#00E5FF" />,
          title: '20 Daily AI Predictions',
          description: 'Get 20 data-backed AI predictions every day - a strategic mix of player props and team picks analyzed by our advanced algorithms.',
          highlight: 'Fresh picks every morning!',
        },
        {
          icon: <Brain size={56} color="#00E5FF" />,
          title: 'Meet Professor Lock 🎓',
          description: 'Tap the floating chat bubble to meet your personal AI sports betting assistant! Ask anything - parlay advice, injury updates, odds comparisons, and more.',
          highlight: 'Smart, personalized, and always available',
        },
        {
          icon: <MessageCircle size={56} color="#00E5FF" />,
          title: 'Customize the Chat Bubble',
          description: 'Drag Professor Lock to any corner of your screen. Go to Settings → Chat Bubble to change its look and animations!',
          highlight: 'Make it your own! ✨',
        },
        {
          icon: <Zap size={56} color="#FFD700" />,
          title: 'Advanced AI Tools',
          description: 'Professor Lock has parlay building tools, web search, real-time odds & games fetching, and a "Capper" personality to help you find value.',
        },
        {
          icon: <Trophy size={56} color="#00E5FF" />,
          title: "You're Ready to Win! 🎯",
          description: 'Check the Picks tab for today\'s 20 AI predictions. Your journey to consistent wins starts now!',
          highlight: 'Good luck! 💰',
        },
      ];
    } else {
      // Free tier
      return [
        {
          icon: <Sparkles size={60} color="#8B5CF6" />,
          title: 'Welcome to ParleyApp! 👋',
          description: 'We\'re excited to have you here! Let\'s show you around and help you get started with AI-powered sports betting.',
          highlight: 'You\'re in the right place! 🎉',
        },
        {
          icon: <Gift size={56} color="#10B981" />,
          title: 'Your Welcome Bonus 🎁',
          description: 'As a new user, you\'ll get 5 AI predictions to try out! After your bonus expires, you\'ll receive 2 daily AI picks.',
          highlight: 'Test our AI predictions risk-free!',
        },
        {
          icon: <Target size={56} color="#8B5CF6" />,
          title: 'Where to Find Your Picks',
          description: 'Your 2 daily AI predictions will show up on the Home tab (Preview section) and the Picks tab at the bottom. Fresh picks every morning!',
        },
        {
          icon: <Brain size={56} color="#8B5CF6" />,
          title: 'AI-Powered Predictions',
          description: 'Our advanced AI analyzes thousands of data points - player stats, trends, injuries, weather, and more - to find the best betting opportunities.',
          highlight: 'Smart picks, better wins!',
        },
        {
          icon: <Crown size={56} color="#FFD700" />,
          title: 'Want More? Upgrade! 🚀',
          description: 'Join thousands of Pro & Elite winners! Get up to 30 daily predictions, advanced AI assistant (Professor Lock), custom themes, and more.',
          highlight: 'Pro members see 3-5x more winning picks!',
        },
        {
          icon: <Users size={56} color="#10B981" />,
          title: 'Join Our Community 💪',
          description: 'Thousands of users win daily with our AI predictions. Upgrade anytime to unlock the full power of ParleyApp!',
          highlight: 'We help you beat the sportsbooks! 📈',
        },
        {
          icon: <Trophy size={56} color="#8B5CF6" />,
          title: "Let's Get Started! 🎯",
          description: 'Head to the Picks tab to see your welcome picks, or explore the app to discover more features!',
          highlight: 'Good luck! 🍀',
        },
      ];
    }
  };

  const slides = getSlides();

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
      setCurrentSlide(currentSlide + 1);
    } else {
      handleClose();
    }
  };

  const handlePrevious = () => {
    if (currentSlide > 0) {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
      setCurrentSlide(currentSlide - 1);
    }
  };

  const handleClose = async () => {
    // Mark onboarding as completed in the user's profile
    if (userId) {
      try {
        await supabase
          .from('profiles')
          .update({ 
            onboarding_completed: true,
            onboarding_completed_at: new Date().toISOString()
          })
          .eq('id', userId);
      } catch (error) {
        console.error('Error marking onboarding complete:', error);
      }
    }
    onClose();
  };

  const getTierColor = () => {
    if (tier === 'elite') return theme.accentPrimary;
    if (tier === 'pro') return '#00E5FF';
    return '#8B5CF6';
  };

  const currentSlideData = slides[currentSlide];
  const isLastSlide = currentSlide === slides.length - 1;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { backgroundColor: theme.cardSurface }]}>
          {/* Header with Skip Button */}
          <View style={styles.header}>
            <View style={styles.progressContainer}>
              {slides.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.progressDot,
                    index === currentSlide && [
                      styles.progressDotActive,
                      { backgroundColor: getTierColor() },
                    ],
                    index < currentSlide && [
                      styles.progressDotCompleted,
                      { backgroundColor: getTierColor() + '60' },
                    ],
                  ]}
                />
              ))}
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.skipButton}>
              <Text style={[styles.skipText, { color: theme.surfaceSecondaryText }]}>
                Skip
              </Text>
              <X size={20} color={theme.surfaceSecondaryText} />
            </TouchableOpacity>
          </View>

          {/* Slide Content */}
          <Animated.View style={[styles.slideContent, { opacity: fadeAnim }]}>
            <View style={styles.iconContainer}>
              <LinearGradient
                colors={[getTierColor() + '20', getTierColor() + '05']}
                style={styles.iconGradient}
              >
                {currentSlideData.icon}
              </LinearGradient>
            </View>

            <Text style={[styles.slideTitle, { color: theme.cardTextPrimary }]}>
              {currentSlideData.title}
            </Text>

            <Text style={[styles.slideDescription, { color: theme.surfaceSecondaryText }]}>
              {currentSlideData.description}
            </Text>

            {currentSlideData.highlight && (
              <View style={[styles.highlightBox, { backgroundColor: getTierColor() + '15' }]}>
                <Sparkles size={16} color={getTierColor()} />
                <Text style={[styles.highlightText, { color: getTierColor() }]}>
                  {currentSlideData.highlight}
                </Text>
              </View>
            )}
          </Animated.View>

          {/* Navigation Buttons */}
          <View style={styles.navigationContainer}>
            <TouchableOpacity
              onPress={handlePrevious}
              style={[
                styles.navButton,
                styles.prevButton,
                currentSlide === 0 && styles.navButtonDisabled,
              ]}
              disabled={currentSlide === 0}
            >
              <ChevronLeft
                size={24}
                color={currentSlide === 0 ? '#64748B' : theme.cardTextPrimary}
              />
              <Text
                style={[
                  styles.navButtonText,
                  { color: currentSlide === 0 ? '#64748B' : theme.cardTextPrimary },
                ]}
              >
                Back
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleNext}
              style={[styles.navButton, styles.nextButton]}
            >
              <LinearGradient
                colors={[getTierColor(), getTierColor() + 'CC']}
                style={styles.nextButtonGradient}
              >
                <Text style={styles.nextButtonText}>
                  {isLastSlide ? "Let's Go!" : 'Next'}
                </Text>
                {isLastSlide ? (
                  <Trophy size={20} color="#FFFFFF" />
                ) : (
                  <ChevronRight size={20} color="#FFFFFF" />
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 24,
    padding: 24,
    maxHeight: screenHeight * 0.8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
  },
  progressDot: {
    height: 4,
    flex: 1,
    borderRadius: 2,
    backgroundColor: '#334155',
  },
  progressDotActive: {
    height: 6,
  },
  progressDotCompleted: {},
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 16,
    padding: 8,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  slideContent: {
    alignItems: 'center',
    paddingVertical: 20,
    flex: 1,
  },
  iconContainer: {
    marginBottom: 24,
  },
  iconGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideTitle: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  slideDescription: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  highlightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 8,
  },
  highlightText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  navigationContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  navButton: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  prevButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
    backgroundColor: '#1E293B',
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  nextButton: {},
  nextButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

