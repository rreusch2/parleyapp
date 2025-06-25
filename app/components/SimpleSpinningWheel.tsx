import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Sparkles, 
  Gift, 
  Crown,
  X,
  Star,
  Zap
} from 'lucide-react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const WHEEL_SIZE = Math.min(screenWidth * 0.7, 260);

interface SimpleSpinningWheelProps {
  visible: boolean;
  onClose: () => void;
  onComplete: (picks: number) => void;
}

const SEGMENTS = [
  { picks: 1, label: '1 Pick', color: '#ef4444', emoji: '🎯', startAngle: 0, endAngle: 72 },
  { picks: 2, label: '2 Picks', color: '#f97316', emoji: '🎰', startAngle: 72, endAngle: 144 },
  { picks: 3, label: '3 Picks', color: '#eab308', emoji: '🎪', startAngle: 144, endAngle: 216 },
  { picks: 4, label: '4 Picks', color: '#22c55e', emoji: '🎊', startAngle: 216, endAngle: 288 },
  { picks: 5, label: '5 Picks!', color: '#8b5cf6', emoji: '👑', startAngle: 288, endAngle: 360 },
];

export default function SimpleSpinningWheel({ visible, onClose, onComplete }: SimpleSpinningWheelProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [hasSpun, setHasSpun] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [currentSegment, setCurrentSegment] = useState(0);
  
  const spinAnimation = useRef(new Animated.Value(0)).current;
  const scaleAnimation = useRef(new Animated.Value(1)).current;
  const confettiAnimation = useRef(new Animated.Value(0)).current;
  const glowAnimation = useRef(new Animated.Value(0)).current;
  const sparkleAnimation = useRef(new Animated.Value(0)).current;
  const pointerBounceAnimation = useRef(new Animated.Value(0)).current;

  // Reset animations when modal opens
  useEffect(() => {
    if (visible) {
      spinAnimation.setValue(0);
      scaleAnimation.setValue(1);
      confettiAnimation.setValue(0);
      pointerBounceAnimation.setValue(0);
      setIsSpinning(false);
      setHasSpun(false);
      setResult(null);
      setShowConfetti(false);
      setCurrentSegment(0);
    }
  }, [visible]);

  // Continuous effects
  useEffect(() => {
    if (visible) {
      // Glow effect
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnimation, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnimation, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Sparkle effect
      Animated.loop(
        Animated.sequence([
          Animated.timing(sparkleAnimation, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(sparkleAnimation, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [visible]);

  // Spinning ticker effect
  useEffect(() => {
    if (isSpinning) {
      const tickerInterval = setInterval(() => {
        setCurrentSegment(prev => (prev + 1) % SEGMENTS.length);
      }, 120);

      return () => clearInterval(tickerInterval);
    }
  }, [isSpinning]);

  const spinWheel = () => {
    if (isSpinning || hasSpun) return;
    
    setIsSpinning(true);
    setCurrentSegment(0);
    
    // Scale animation for excitement
    Animated.sequence([
      Animated.timing(scaleAnimation, {
        toValue: 0.95,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnimation, {
        toValue: 1.05,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    // Calculate the winning position
    // Based on testing pattern: 0°=4 Picks, 72°=3 Picks, 144°=2 Picks, 216°=1 Pick
    // Following this pattern: 288° should = 5 Picks
    const numberOfSpins = 5; // Number of full rotations for drama
    const finalAngle = 288; // Direct calculation based on observed pattern
    const totalRotation = numberOfSpins * 360 + finalAngle;

    // Smooth, realistic spinning animation
    Animated.timing(spinAnimation, {
      toValue: totalRotation,
      duration: 4000,
      easing: Easing.bezier(0.25, 0.46, 0.45, 0.94), // Smooth deceleration
      useNativeDriver: true,
    }).start(() => {
      // Animation complete
      setIsSpinning(false);
      setHasSpun(true);
      setResult(5); // Always lands on 5
      setCurrentSegment(4); // Index 4 = 5 picks
      setShowConfetti(true);
      
      // Pointer bounce effect
      Animated.sequence([
        Animated.timing(pointerBounceAnimation, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(pointerBounceAnimation, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      
      // Wheel celebration bounce
      Animated.sequence([
        Animated.timing(scaleAnimation, {
          toValue: 1.1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnimation, {
          toValue: 0.98,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnimation, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      
      // Confetti animation
      Animated.timing(confettiAnimation, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleComplete = () => {
    onComplete(5); // Always give 5 picks
    onClose();
  };

  const glowOpacity = glowAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.8],
  });

  const sparkleOpacity = sparkleAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

  const confettiTranslateY = confettiAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -150],
  });

  const confettiOpacity = confettiAnimation.interpolate({
    inputRange: [0, 0.2, 0.8, 1],
    outputRange: [0, 1, 1, 0],
  });

  const spinValue = spinAnimation.interpolate({
    inputRange: [0, 360 * 10], // Max possible rotation
    outputRange: ['0deg', '3600deg'],
  });

  const pointerBounceTranslate = pointerBounceAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 10],
  });

  const pointerBounceScale = pointerBounceAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.2],
  });

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <LinearGradient
          colors={['rgba(15,23,42,0.95)', 'rgba(30,27,75,0.95)', 'rgba(49,46,129,0.95)']}
          style={styles.modalGradient}
        >
          <View style={styles.container}>
            {/* Close Button */}
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={24} color="#fff" />
            </TouchableOpacity>

            {/* Header */}
            <View style={styles.header}>
              <Animated.View style={[styles.sparkleContainer, { opacity: sparkleOpacity }]}>
                <Sparkles size={36} color="#fbbf24" />
              </Animated.View>
              <Text style={styles.title}>🎉 Welcome Bonus!</Text>
              <Text style={styles.subtitle}>Spin the wheel to claim your free premium picks!</Text>
            </View>

            {/* Wheel Container */}
            <View style={styles.wheelContainer}>
              {/* Glow Effect */}
              <Animated.View 
                style={[
                  styles.wheelGlow, 
                  { 
                    opacity: glowOpacity,
                    transform: [{ scale: scaleAnimation }]
                  }
                ]} 
              />
              
              {/* Wheel Background Circle */}
              <View style={styles.wheelBackground} />
              
              {/* Wheel Segments */}
              <Animated.View
                style={[
                  styles.wheel,
                  {
                    transform: [
                      { rotate: spinValue },
                      { scale: scaleAnimation }
                    ],
                  },
                ]}
              >
                {SEGMENTS.map((segment, index) => {
                  const isActive = isSpinning ? currentSegment === index : (!isSpinning && hasSpun && index === 4);
                  const angle = index * 72; // 72 degrees per segment
                  
                  return (
                    <View
                      key={index}
                      style={[
                        styles.segment,
                        {
                          transform: [{ rotate: `${angle}deg` }],
                          backgroundColor: segment.color,
                        },
                        isActive && styles.activeSegment,
                      ]}
                    >
                      <View style={styles.segmentContent}>
                        <Text style={styles.segmentEmoji}>{segment.emoji}</Text>
                        <Text style={styles.segmentText}>{segment.label}</Text>
                      </View>
                    </View>
                  );
                })}
                
                {/* Center Circle */}
                <View style={styles.centerCircle}>
                  <LinearGradient
                    colors={['#1e293b', '#0f172a']}
                    style={styles.centerGradient}
                  >
                    {isSpinning ? (
                      <Animated.View style={{ transform: [{ rotate: spinValue }] }}>
                        <Zap size={28} color="#fbbf24" />
                      </Animated.View>
                    ) : hasSpun ? (
                      <Crown size={28} color="#fbbf24" />
                    ) : (
                      <Gift size={28} color="#fff" />
                    )}
                  </LinearGradient>
                </View>
              </Animated.View>

              {/* Pointer */}
              <Animated.View 
                style={[
                  styles.pointer,
                  {
                    transform: [
                      { translateY: pointerBounceTranslate },
                      { scale: pointerBounceScale }
                    ]
                  }
                ]}
              >
                <LinearGradient
                  colors={['#fbbf24', '#f59e0b']}
                  style={styles.pointerGradient}
                >
                  <View style={styles.pointerTriangle} />
                </LinearGradient>
              </Animated.View>

              {/* Confetti Effect */}
              {showConfetti && (
                <Animated.View
                  style={[
                    styles.confettiContainer,
                    {
                      opacity: confettiOpacity,
                      transform: [{ translateY: confettiTranslateY }],
                    },
                  ]}
                >
                  {[...Array(40)].map((_, i) => (
                    <Animated.View
                      key={i}
                      style={[
                        styles.confettiPiece,
                        {
                          left: Math.random() * WHEEL_SIZE,
                          top: Math.random() * WHEEL_SIZE,
                          backgroundColor: SEGMENTS[Math.floor(Math.random() * SEGMENTS.length)].color,
                          transform: [
                            { rotate: `${Math.random() * 360}deg` },
                            { scale: Math.random() * 0.8 + 0.4 }
                          ],
                        },
                      ]}
                    />
                  ))}
                </Animated.View>
              )}
            </View>

            {/* Current Highlight Display */}
            {isSpinning && (
              <View style={styles.currentDisplay}>
                <LinearGradient
                  colors={[SEGMENTS[currentSegment].color, SEGMENTS[currentSegment].color + '80']}
                  style={styles.currentDisplayGradient}
                >
                  <Text style={styles.currentEmoji}>{SEGMENTS[currentSegment].emoji}</Text>
                  <Text style={styles.currentText}>{SEGMENTS[currentSegment].label}</Text>
                </LinearGradient>
              </View>
            )}

            {/* Result Display */}
            {result && (
              <View style={styles.resultContainer}>
                <LinearGradient
                  colors={['#8b5cf6', '#7c3aed']}
                  style={styles.resultGradient}
                >
                  <Crown size={32} color="#fbbf24" />
                  <Text style={styles.resultTitle}>🎊 AMAZING! 🎊</Text>
                  <Text style={styles.resultSubtitle}>You won {result} Premium AI Picks!</Text>
                  <Text style={styles.resultDescription}>
                    These are our highest-quality predictions with advanced AI analysis!
                  </Text>
                </LinearGradient>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
              {!hasSpun ? (
                <TouchableOpacity
                  style={[styles.spinButton, isSpinning && styles.buttonDisabled]}
                  onPress={spinWheel}
                  disabled={isSpinning}
                >
                  <LinearGradient
                    colors={['#10b981', '#059669']}
                    style={styles.buttonGradient}
                  >
                    {isSpinning ? (
                      <>
                        <Animated.View style={{ transform: [{ rotate: spinValue }] }}>
                          <Zap size={24} color="#fff" />
                        </Animated.View>
                        <Text style={styles.buttonText}>Spinning...</Text>
                      </>
                    ) : (
                      <>
                        <Gift size={24} color="#fff" />
                        <Text style={styles.buttonText}>SPIN TO WIN!</Text>
                        <Sparkles size={20} color="#fff" />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.claimButton}
                  onPress={handleComplete}
                >
                  <LinearGradient
                    colors={['#8b5cf6', '#7c3aed']}
                    style={styles.buttonGradient}
                  >
                    <Star size={24} color="#fff" />
                    <Text style={styles.buttonText}>Claim My 5 Premium Picks!</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>

            {/* Footer */}
            <Text style={styles.footer}>
              🔥 Limited time welcome bonus - Premium picks usually cost $4.99 each!
            </Text>
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalGradient: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: Math.min(screenWidth - 40, 400),
    maxHeight: screenHeight * 0.9,
    backgroundColor: 'rgba(15,23,42,0.9)',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  sparkleContainer: {
    marginBottom: 12,
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
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
  },
  wheelContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  wheelGlow: {
    position: 'absolute',
    width: WHEEL_SIZE + 40,
    height: WHEEL_SIZE + 40,
    borderRadius: (WHEEL_SIZE + 40) / 2,
    backgroundColor: '#8b5cf6',
    opacity: 0.3,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 20,
  },
  wheelBackground: {
    position: 'absolute',
    width: WHEEL_SIZE + 8,
    height: WHEEL_SIZE + 8,
    borderRadius: (WHEEL_SIZE + 8) / 2,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
  },
  wheel: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    borderRadius: WHEEL_SIZE / 2,
    position: 'relative',
    overflow: 'hidden',
  },
  segment: {
    position: 'absolute',
    width: WHEEL_SIZE / 2,
    height: WHEEL_SIZE / 2,
    left: WHEEL_SIZE / 2,
    top: WHEEL_SIZE / 2,
    transformOrigin: '0 0',
    overflow: 'hidden',
  },
  activeSegment: {
    shadowColor: '#ffd700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 8,
  },
  segmentContent: {
    position: 'absolute',
    top: 25,
    left: 35,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '36deg' }], // Half of segment angle (72°/2)
    width: 60,
  },
  segmentEmoji: {
    fontSize: 18,
    marginBottom: 4,
  },
  segmentText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  centerCircle: {
    position: 'absolute',
    top: WHEEL_SIZE / 2 - 40,
    left: WHEEL_SIZE / 2 - 40,
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#fbbf24',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  centerGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pointer: {
    position: 'absolute',
    top: -20,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  pointerGradient: {
    borderRadius: 12,
    padding: 4,
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  pointerTriangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 15,
    borderRightWidth: 15,
    borderBottomWidth: 25,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#fff',
  },
  currentDisplay: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  currentDisplayGradient: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currentEmoji: {
    fontSize: 24,
  },
  currentText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  confettiContainer: {
    position: 'absolute',
    width: WHEEL_SIZE + 80,
    height: WHEEL_SIZE + 80,
    top: -40,
    left: -40,
    pointerEvents: 'none',
  },
  confettiPiece: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  resultContainer: {
    width: '100%',
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  resultGradient: {
    padding: 20,
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
    marginBottom: 4,
  },
  resultSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fbbf24',
    marginBottom: 8,
  },
  resultDescription: {
    fontSize: 14,
    color: '#e2e8f0',
    textAlign: 'center',
    lineHeight: 20,
  },
  actionsContainer: {
    width: '100%',
    marginBottom: 16,
  },
  spinButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  claimButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  footer: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 16,
  },
}); 