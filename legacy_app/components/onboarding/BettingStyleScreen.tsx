import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isSmallScreen = screenHeight < 700;

interface BettingStyleScreenProps {
  onComplete: (data: { bettingStyle: 'conservative' | 'balanced' | 'aggressive' }) => void;
  currentPreferences: any;
  isExistingUser?: boolean;
}

interface BettingStyleOption {
  key: 'conservative' | 'balanced' | 'aggressive';
  title: string;
  description: string;
  characteristics: string[];
  icon: string;
  gradient: string[];
  confidenceRange: string;
  riskLevel: string;
}

const bettingStyleOptions: BettingStyleOption[] = [
  {
    key: 'conservative',
    title: 'Conservative',
    description: 'Play it safe with high-confidence picks',
    characteristics: [
      'Higher confidence picks (65%+)',
      'Lower risk, steady returns',
      'Fewer but safer bets',
      'Focus on favorites and unders'
    ],
    icon: 'shield-checkmark-outline',
    gradient: ['#2ecc71', '#27ae60'],
    confidenceRange: '65-85%',
    riskLevel: 'Low Risk',
  },
  {
    key: 'balanced',
    title: 'Balanced',
    description: 'Mix of safe picks and value opportunities',
    characteristics: [
      'Moderate confidence range (55-75%)',
      'Balanced risk/reward ratio',
      'Diverse bet types',
      'Strategic value hunting'
    ],
    icon: 'analytics-outline',
    gradient: ['#3498db', '#2980b9'],
    confidenceRange: '55-75%',
    riskLevel: 'Medium Risk',
  },
  {
    key: 'aggressive',
    title: 'Aggressive',
    description: 'Chase higher payouts with calculated risks',
    characteristics: [
      'Wide confidence range (50-80%)',
      'Higher risk, higher reward',
      'Value-focused picks',
      'Underdog opportunities'
    ],
    icon: 'trending-up-outline',
    gradient: ['#e74c3c', '#c0392b'],
    confidenceRange: '50-80%',
    riskLevel: 'High Risk',
  },
];

const BettingStyleScreen: React.FC<BettingStyleScreenProps> = ({
  onComplete,
  currentPreferences,
  isExistingUser,
}) => {
  const [selectedStyle, setSelectedStyle] = useState<'conservative' | 'balanced' | 'aggressive'>(
    currentPreferences?.bettingStyle || 'balanced'
  );
  const [animatedValues] = useState(
    bettingStyleOptions.reduce((acc, style) => {
      acc[style.key] = new Animated.Value(selectedStyle === style.key ? 1 : 0);
      return acc;
    }, {} as Record<string, Animated.Value>)
  );

  const selectStyle = (styleKey: 'conservative' | 'balanced' | 'aggressive') => {
    if (selectedStyle === styleKey) return;

    // Animate out previous selection
    if (selectedStyle) {
      Animated.spring(animatedValues[selectedStyle], {
        toValue: 0,
        useNativeDriver: false,
        tension: 100,
        friction: 8,
      }).start();
    }

    // Animate in new selection
    Animated.spring(animatedValues[styleKey], {
      toValue: 1,
      useNativeDriver: false,
      tension: 100,
      friction: 8,
    }).start();

    setSelectedStyle(styleKey);
  };

  const handleContinue = () => {
    onComplete({ bettingStyle: selectedStyle });
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.content}>
          <Text style={styles.title}>What's your betting approach?</Text>
          <Text style={styles.subtitle}>
            Choose your style to get personalized picks that match your risk tolerance and goals.
          </Text>

          <View style={styles.stylesContainer}>
          {bettingStyleOptions.map((style) => {
            const isSelected = selectedStyle === style.key;
            const animatedValue = animatedValues[style.key];

            return (
              <TouchableOpacity
                key={style.key}
                onPress={() => selectStyle(style.key)}
                style={styles.styleCard}
                activeOpacity={0.8}
              >
                <Animated.View
                  style={[
                    styles.styleCardInner,
                    {
                      borderColor: animatedValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['rgba(255,255,255,0.1)', '#00d4ff'],
                      }),
                      borderWidth: animatedValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 2],
                      }),
                      transform: [
                        {
                          scale: animatedValue.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 1.02],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <LinearGradient
                    colors={isSelected ? style.gradient as [string, string] : ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.1)'] as [string, string]}
                    style={styles.styleGradient}
                  >
                    <View style={styles.styleHeader}>
                      <View style={styles.iconContainer}>
                        <Ionicons 
                          name={style.icon as any} 
                          size={24} 
                          color={isSelected ? '#fff' : '#00d4ff'} 
                        />
                      </View>
                      <Animated.View
                        style={[
                          styles.checkmark,
                          {
                            opacity: animatedValue,
                            transform: [
                              {
                                scale: animatedValue.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0.5, 1],
                                }),
                              },
                            ],
                          },
                        ]}
                      >
                        <Ionicons name="checkmark-circle" size={24} color="#00d4ff" />
                      </Animated.View>
                    </View>
                    
                    <Text style={styles.styleTitle}>{style.title}</Text>
                    <Text style={styles.styleDescription}>{style.description}</Text>
                    
                    <View style={styles.characteristicsContainer}>
                      {style.characteristics.map((characteristic, index) => (
                        <View key={index} style={styles.characteristicRow}>
                          <View style={styles.bullet} />
                          <Text style={styles.characteristicText}>{characteristic}</Text>
                        </View>
                      ))}
                    </View>

                    <View style={styles.styleFooter}>
                      <View style={styles.statContainer}>
                        <Text style={styles.statLabel}>Confidence</Text>
                        <Text style={styles.statValue}>{style.confidenceRange}</Text>
                      </View>
                      <View style={styles.statContainer}>
                        <Text style={styles.statLabel}>Risk Level</Text>
                        <Text style={styles.statValue}>{style.riskLevel}</Text>
                      </View>
                    </View>
                  </LinearGradient>
                </Animated.View>
              </TouchableOpacity>
            );
          })}
        </View>
        </View>
      </ScrollView>

      <TouchableOpacity
        onPress={handleContinue}
        style={styles.continueButton}
      >
        <LinearGradient
          colors={['#00d4ff', '#0099cc']}
          style={styles.continueGradient}
        >
          <Text style={styles.continueText}>Continue</Text>
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContentContainer: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: isTablet ? 40 : 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  stylesContainer: {
    gap: isTablet ? 14 : 10,
    paddingHorizontal: isTablet ? 8 : 4,
    marginBottom: 16,
  },
  styleCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  styleCardInner: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  styleGradient: {
    padding: isTablet ? 18 : 12,
    minHeight: isTablet ? 140 : 120,
  },
  styleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    borderRadius: 12,
    padding: 2,
  },
  styleTitle: {
    fontSize: isTablet ? 20 : 17,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: isTablet ? 6 : 4,
  },
  styleDescription: {
    fontSize: isTablet ? 14 : 12,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: isTablet ? 10 : 8,
    lineHeight: isTablet ? 20 : 18,
  },
  characteristicsContainer: {
    marginBottom: isTablet ? 12 : 8,
  },
  characteristicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: isTablet ? 6 : 4,
  },
  bullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#00d4ff',
    marginRight: 12,
  },
  characteristicText: {
    fontSize: isTablet ? 13 : 11,
    color: 'rgba(255,255,255,0.8)',
    flex: 1,
    lineHeight: isTablet ? 18 : 16,
  },
  styleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: isTablet ? 12 : 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  statContainer: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: isTablet ? 12 : 10,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 3,
  },
  statValue: {
    fontSize: isTablet ? 14 : 12,
    fontWeight: '600',
    color: '#00d4ff',
  },
  continueButton: {
    marginHorizontal: isTablet ? 40 : 20,
    marginVertical: isTablet ? 30 : 20,
    marginBottom: isSmallScreen ? 10 : 20,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  continueGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  continueText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default BettingStyleScreen;
