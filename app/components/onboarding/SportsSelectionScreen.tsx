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

interface SportsSelectionScreenProps {
  onComplete: (data: { sportPreferences: any }) => void;
  currentPreferences: any;
  isExistingUser?: boolean;
}

interface SportOption {
  key: 'nfl' | 'cfb' | 'mlb' | 'wnba' | 'ufc';
  name: string;
  fullName: string;
  icon: string;
  description: string;
  gradient: string[];
  season: string;
}

const sportOptions: SportOption[] = [
  {
    key: 'nfl',
    name: 'NFL',
    fullName: 'National Football League',
    icon: '🏈',
    description: 'America\'s most popular sport with thrilling matchups',
    gradient: ['#2c5aa0', '#1e3a8a'],
    season: 'Sep - Feb',
  },
  {
    key: 'cfb',
    name: 'CFB',
    fullName: 'College Football',
    icon: '🎓',
    description: 'College football with passionate fanbases and upsets',
    gradient: ['#dc2626', '#b91c1c'],
    season: 'Sep - Jan',
  },
  {
    key: 'mlb',
    name: 'MLB',
    fullName: 'Major League Baseball',
    icon: '⚾',
    description: 'America\'s pastime with daily games and player props',
    gradient: ['#059669', '#047857'],
    season: 'Apr - Oct',
  },
  {
    key: 'wnba',
    name: 'WNBA',
    fullName: 'Women\'s National Basketball Association',
    icon: '🏀',
    description: 'Elite women\'s basketball with exciting matchups',
    gradient: ['#7c3aed', '#6d28d9'],
    season: 'May - Sep',
  },
  {
    key: 'ufc',
    name: 'UFC',
    fullName: 'Ultimate Fighting Championship',
    icon: '🥊',
    description: 'Premier mixed martial arts fights every weekend',
    gradient: ['#ea580c', '#c2410c'],
    season: 'Year Round',
  },
];

const SportsSelectionScreen: React.FC<SportsSelectionScreenProps> = ({
  onComplete,
  currentPreferences,
  isExistingUser,
}) => {
  const [selectedSports, setSelectedSports] = useState(
    currentPreferences?.sportPreferences || { nfl: true, cfb: true, mlb: true, wnba: false, ufc: false }
  );
  const [animatedValues] = useState(
    sportOptions.reduce((acc, sport) => {
      acc[sport.key] = new Animated.Value(selectedSports[sport.key] ? 1 : 0);
      return acc;
    }, {} as Record<string, Animated.Value>)
  );

  const toggleSport = (sportKey: 'nfl' | 'cfb' | 'mlb' | 'wnba' | 'ufc') => {
    const newSelected = { ...selectedSports, [sportKey]: !selectedSports[sportKey] };
    setSelectedSports(newSelected);

    // Animate the selection
    Animated.spring(animatedValues[sportKey], {
      toValue: newSelected[sportKey] ? 1 : 0,
      useNativeDriver: false,
      tension: 100,
      friction: 8,
    }).start();
  };

  const handleContinue = () => {
    const hasAtLeastOneSport = Object.values(selectedSports).some(Boolean);
    
    if (!hasAtLeastOneSport) {
      // Could show an alert here, but for now just ensure NFL is selected
      const defaultSelection = { ...selectedSports, nfl: true };
      setSelectedSports(defaultSelection);
      onComplete({ sportPreferences: defaultSelection });
    } else {
      onComplete({ sportPreferences: selectedSports });
    }
  };

  const selectedCount = Object.values(selectedSports).filter(Boolean).length;

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.content}>
          <Text style={styles.title}>Which sports interest you?</Text>
          <Text style={styles.subtitle}>
            Select the sports you'd like to receive AI predictions for. You can change this anytime in settings.
          </Text>

          <View style={styles.sportsContainer}>
          {sportOptions.map((sport) => {
            const isSelected = selectedSports[sport.key];
            const animatedValue = animatedValues[sport.key];

            return (
              <TouchableOpacity
                key={sport.key}
                onPress={() => toggleSport(sport.key)}
                style={styles.sportCard}
                activeOpacity={0.7}
              >
                <Animated.View
                  style={[
                    styles.sportCardInner,
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
                    colors={isSelected ? (sport.gradient as any) : ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.1)']}
                    style={styles.sportGradient}
                  >
                    <View style={styles.sportHeader}>
                      <Text style={styles.sportIcon}>{sport.icon}</Text>
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
                    
                    <Text style={styles.sportName}>{sport.name}</Text>
                    <Text style={styles.sportFullName}>{sport.fullName}</Text>
                    <Text style={styles.sportDescription}>{sport.description}</Text>
                    
                    <View style={styles.sportFooter}>
                      <Text style={styles.sportSeason}>{sport.season}</Text>
                    </View>
                  </LinearGradient>
                </Animated.View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.selectionInfo}>
          <Text style={styles.selectionText}>
            {selectedCount === 0 
              ? 'Select at least one sport to continue'
              : `${selectedCount} sport${selectedCount > 1 ? 's' : ''} selected`
            }
          </Text>
        </View>
      </View>
      </ScrollView>

      <TouchableOpacity
        onPress={handleContinue}
        style={[
          styles.continueButton,
          { opacity: selectedCount > 0 ? 1 : 0.6 }
        ]}
        disabled={selectedCount === 0}
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
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  sportsContainer: {
    gap: isTablet ? 14 : 10,
    paddingHorizontal: 4,
  },
  sportCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  sportCardInner: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  sportGradient: {
    padding: isTablet ? 18 : 14,
    minHeight: isTablet ? 110 : 95,
  },
  sportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sportIcon: {
    fontSize: isTablet ? 28 : 24,
  },
  checkmark: {
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    borderRadius: 12,
    padding: 2,
  },
  sportName: {
    fontSize: isTablet ? 22 : 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 3,
  },
  sportFullName: {
    fontSize: isTablet ? 13 : 11,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: isTablet ? 6 : 4,
  },
  sportDescription: {
    fontSize: isTablet ? 13 : 11,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: isTablet ? 18 : 16,
    marginBottom: isTablet ? 10 : 6,
  },
  sportFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sportSeason: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  selectionInfo: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
  selectionText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
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

export default SportsSelectionScreen;
