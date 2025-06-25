import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Animated,
  Platform,
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
import Svg, { Circle, Path, G, Text as SvgText } from 'react-native-svg';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const WHEEL_SIZE = Math.min(screenWidth * 0.8, 300);
const WHEEL_RADIUS = WHEEL_SIZE / 2;

interface WelcomeSpinningWheelProps {
  visible: boolean;
  onClose: () => void;
  onComplete: (picks: number) => void;
}

interface WheelSegment {
  picks: number;
  label: string;
  color: string;
  startAngle: number;
  endAngle: number;
}

const WHEEL_SEGMENTS: WheelSegment[] = [
  { picks: 1, label: '1 Pick', color: '#ef4444', startAngle: 0, endAngle: 72 },
  { picks: 2, label: '2 Picks', color: '#f97316', startAngle: 72, endAngle: 144 },
  { picks: 3, label: '3 Picks', color: '#eab308', startAngle: 144, endAngle: 216 },
  { picks: 4, label: '4 Picks', color: '#22c55e', startAngle: 216, endAngle: 288 },
  { picks: 5, label: '5 Picks!', color: '#8b5cf6', startAngle: 288, endAngle: 360 },
];

// Helper function to create SVG path for pie segment
const createPieSlice = (centerX: number, centerY: number, radius: number, startAngle: number, endAngle: number) => {
  const start = polarToCartesian(centerX, centerY, radius, endAngle);
  const end = polarToCartesian(centerX, centerY, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  
  return [
    "M", centerX, centerY,
    "L", start.x, start.y,
    "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y,
    "Z"
  ].join(" ");
};

const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  };
};

export default function WelcomeSpinningWheel({ visible, onClose, onComplete }: WelcomeSpinningWheelProps) {
  const [isSpinning, setIsSpinning] = useState(false);
  const [hasSpun, setHasSpun] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  
  const spinAnimation = useRef(new Animated.Value(0)).current;
  const scaleAnimation = useRef(new Animated.Value(1)).current;
  const confettiAnimation = useRef(new Animated.Value(0)).current;
  const glowAnimation = useRef(new Animated.Value(0)).current;
  const sparkleAnimation = useRef(new Animated.Value(0)).current;

  // Continuous glow effect
  useEffect(() => {
    if (visible) {
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

  const spinWheel = () => {
    if (isSpinning || hasSpun) return;
    
    setIsSpinning(true);
    
    // Calculate final rotation to always land on 5 picks (segment 5: 288-360 degrees)
    // We want to land in the middle of that segment: 324 degrees
    const targetAngle = 324;
    const spins = 5; // Number of full rotations
    const finalRotation = spins * 360 + targetAngle;
    
    // Scale animation for excitement
    Animated.sequence([
      Animated.timing(scaleAnimation, {
        toValue: 0.9,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnimation, {
        toValue: 1.1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
    
    // Main spin animation
    Animated.timing(spinAnimation, {
      toValue: finalRotation,
      duration: 4000,
      useNativeDriver: true,
    }).start(() => {
      // Animation complete
      setIsSpinning(false);
      setHasSpun(true);
      setResult(5); // Always lands on 5
      setShowConfetti(true);
      
      // Confetti animation
      Animated.timing(confettiAnimation, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }).start();
      
      // Scale back to normal
      Animated.timing(scaleAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleComplete = () => {
    onComplete(5); // Always give 5 picks
    onClose();
  };

  const resetWheel = () => {
    setIsSpinning(false);
    setHasSpun(false);
    setResult(null);
    setShowConfetti(false);
    spinAnimation.setValue(0);
    scaleAnimation.setValue(1);
    confettiAnimation.setValue(0);
  };

  const spinValue = spinAnimation.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  const glowOpacity = glowAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  const sparkleOpacity = sparkleAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1],
  });

  const confettiTranslateY = confettiAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -100],
  });

  const confettiOpacity = confettiAnimation.interpolate({
    inputRange: [0, 0.8, 1],
    outputRange: [0, 1, 0],
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
              
              {/* Spinning Wheel */}
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
                <Svg width={WHEEL_SIZE} height={WHEEL_SIZE}>
                  {WHEEL_SEGMENTS.map((segment, index) => (
                    <G key={index}>
                      <Path
                        d={createPieSlice(WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_RADIUS - 10, segment.startAngle, segment.endAngle)}
                        fill={segment.color}
                        stroke="#fff"
                        strokeWidth="3"
                      />
                      <SvgText
                        x={WHEEL_RADIUS + (WHEEL_RADIUS - 40) * Math.cos((segment.startAngle + segment.endAngle) / 2 * Math.PI / 180)}
                        y={WHEEL_RADIUS + (WHEEL_RADIUS - 40) * Math.sin((segment.startAngle + segment.endAngle) / 2 * Math.PI / 180)}
                        fontSize="16"
                        fontWeight="bold"
                        fill="white"
                        textAnchor="middle"
                        alignmentBaseline="middle"
                      >
                        {segment.label}
                      </SvgText>
                    </G>
                  ))}
                </Svg>
              </Animated.View>

              {/* Pointer */}
              <View style={styles.pointer}>
                <View style={styles.pointerTriangle} />
              </View>

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
                  {[...Array(20)].map((_, i) => (
                    <Animated.View
                      key={i}
                      style={[
                        styles.confettiPiece,
                        {
                          left: Math.random() * WHEEL_SIZE,
                          backgroundColor: ['#fbbf24', '#f59e0b', '#ef4444', '#22c55e', '#8b5cf6'][Math.floor(Math.random() * 5)],
                          transform: [
                            { rotate: `${Math.random() * 360}deg` },
                            { scale: Math.random() * 0.5 + 0.5 }
                          ],
                        },
                      ]}
                    />
                  ))}
                </Animated.View>
              )}
            </View>

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
                        <Zap size={24} color="#fff" />
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
  wheel: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    borderRadius: WHEEL_SIZE / 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
  },
  pointer: {
    position: 'absolute',
    top: -5,
    alignItems: 'center',
    zIndex: 10,
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
    borderBottomColor: '#fbbf24',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  confettiContainer: {
    position: 'absolute',
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    top: 0,
  },
  confettiPiece: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  resultContainer: {
    width: '100%',
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
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