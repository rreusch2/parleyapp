import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Switch,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isSmallScreen = screenHeight < 700;

interface PickDistributionScreenProps {
  onComplete: (data: { pickDistribution: any }) => void;
  currentPreferences: any;
  isExistingUser?: boolean;
}

const PickDistributionScreen: React.FC<PickDistributionScreenProps> = ({
  onComplete,
  currentPreferences,
  isExistingUser,
}) => {
  const [isAutoMode, setIsAutoMode] = useState(
    currentPreferences?.pickDistribution?.auto ?? true
  );
  const [customDistribution, setCustomDistribution] = useState({
    mlb_team: 5,
    mlb_props: 5,
    wnba_team: 3,
    wnba_props: 3,
    ufc: 4,
  });

  const sportPreferences = currentPreferences?.sportPreferences || { mlb: true, wnba: false, ufc: false };
  const activeSports = Object.keys(sportPreferences).filter(sport => sportPreferences[sport]);
  const totalPicks = 20; // Default for Pro tier

  // Calculate auto distribution based on selected sports
  const getAutoDistribution = () => {
    if (activeSports.length === 0) return { mlb_team: 10, mlb_props: 10 };
    
    const sportsCount = activeSports.length;
    const picksPerSport = Math.floor(totalPicks / sportsCount);
    const remainder = totalPicks % sportsCount;
    
    const distribution: any = {};
    
    activeSports.forEach((sport, index) => {
      const basePicks = picksPerSport + (index < remainder ? 1 : 0);
      if (sport === 'ufc') {
        distribution[`${sport}`] = basePicks;
      } else {
        const teamPicks = Math.ceil(basePicks / 2);
        const propPicks = Math.floor(basePicks / 2);
        distribution[`${sport}_team`] = teamPicks;
        distribution[`${sport}_props`] = propPicks;
      }
    });
    
    return distribution;
  };

  const autoDistribution = getAutoDistribution();

  const updateCustomValue = (key: string, value: number) => {
    setCustomDistribution(prev => ({ ...prev, [key]: value }));
  };

  const getTotalCustomPicks = () => {
    return Object.entries(customDistribution)
      .filter(([key]) => {
        const sport = key.split('_')[0];
        return activeSports.includes(sport);
      })
      .reduce((sum, [, value]) => sum + value, 0);
  };

  const handleContinue = () => {
    const pickDistribution = isAutoMode 
      ? { auto: true }
      : { auto: false, custom: customDistribution };
    
    onComplete({ pickDistribution });
  };

  const renderCustomSlider = (label: string, key: string, max: number = 15) => {
    const sport = key.split('_')[0];
    if (!activeSports.includes(sport)) return null;

    return (
      <View key={key} style={styles.sliderContainer}>
        <View style={styles.sliderHeader}>
          <Text style={styles.sliderLabel}>{label}</Text>
          <Text style={styles.sliderValue}>{customDistribution[key as keyof typeof customDistribution]}</Text>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={max}
          step={1}
          value={customDistribution[key as keyof typeof customDistribution]}
          onValueChange={(value) => updateCustomValue(key, value)}
          minimumTrackTintColor="#00d4ff"
          maximumTrackTintColor="rgba(255,255,255,0.3)"
          // Custom thumb styling should be handled through theme or thumbTintColor
        />
      </View>
    );
  };

  const totalCustomPicks = getTotalCustomPicks();
  const isValidDistribution = totalCustomPicks <= totalPicks && totalCustomPicks > 0;

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.content}>
          <Text style={styles.title}>How would you like your daily picks?</Text>
          <Text style={styles.subtitle}>
            Choose between auto-balanced picks or customize your own distribution across sports.
          </Text>

          {/* Auto vs Custom Toggle */}
          <View style={styles.modeContainer}>
          <TouchableOpacity
            onPress={() => setIsAutoMode(true)}
            style={[styles.modeButton, isAutoMode && styles.modeButtonActive]}
          >
            <LinearGradient
              colors={isAutoMode ? ['#00d4ff', '#0099cc'] : ['transparent', 'transparent']}
              style={styles.modeGradient}
            >
              <Ionicons 
                name="analytics-outline" 
                size={24} 
                color={isAutoMode ? '#fff' : 'rgba(255,255,255,0.6)'} 
              />
              <Text style={[styles.modeText, isAutoMode && styles.modeTextActive]}>
                Auto-Balanced
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setIsAutoMode(false)}
            style={[styles.modeButton, !isAutoMode && styles.modeButtonActive]}
          >
            <LinearGradient
              colors={!isAutoMode ? ['#00d4ff', '#0099cc'] : ['transparent', 'transparent']}
              style={styles.modeGradient}
            >
              <Ionicons 
                name="options-outline" 
                size={24} 
                color={!isAutoMode ? '#fff' : 'rgba(255,255,255,0.6)'} 
              />
              <Text style={[styles.modeText, !isAutoMode && styles.modeTextActive]}>
                Custom
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

          {/* Distribution Preview */}
          <View style={styles.previewContainer}>
          <Text style={styles.previewTitle}>
            {isAutoMode ? 'Auto Distribution Preview' : 'Custom Distribution'}
          </Text>
          
          {isAutoMode ? (
            <View style={styles.autoPreview}>
              {Object.entries(autoDistribution).map(([key, value]) => {
                const sport = key.includes('_') ? key.split('_')[0].toUpperCase() : key.toUpperCase();
                const type = key.includes('_') ? key.split('_')[1] : '';
                const label = type ? `${sport} ${type.charAt(0).toUpperCase() + type.slice(1)}` : sport;
                
                return (
                  <View key={key} style={styles.previewItem}>
                    <Text style={styles.previewLabel}>{label}</Text>
                    <Text style={styles.previewValue}>{value as number}</Text>
                  </View>
                );
              })}
              <View style={styles.previewTotal}>
                <Text style={styles.previewTotalText}>Total: {Object.values(autoDistribution).reduce((sum: number, val: any) => sum + (typeof val === 'number' ? val : 0), 0).toString()} picks</Text>
              </View>
            </View>
          ) : (
            <View style={styles.customContainer}>
              {activeSports.includes('mlb') && (
                <>
                  {renderCustomSlider('MLB Team Picks', 'mlb_team')}
                  {renderCustomSlider('MLB Player Props', 'mlb_props')}
                </>
              )}
              {activeSports.includes('wnba') && (
                <>
                  {renderCustomSlider('WNBA Team Picks', 'wnba_team')}
                  {renderCustomSlider('WNBA Player Props', 'wnba_props')}
                </>
              )}
              {activeSports.includes('ufc') && (
                renderCustomSlider('UFC Fight Picks', 'ufc')
              )}
              
              <View style={[styles.totalContainer, !isValidDistribution && styles.totalContainerError]}>
                <Text style={[styles.totalText, !isValidDistribution && styles.totalTextError]}>
                  Total: {totalCustomPicks} / {totalPicks} picks
                </Text>
                {!isValidDistribution && (
                  <Text style={styles.errorText}>
                    {totalCustomPicks > totalPicks 
                      ? `Reduce by ${totalCustomPicks - totalPicks} picks`
                      : 'Add at least 1 pick'
                    }
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>

          <View style={styles.infoContainer}>
            <Ionicons name="information-circle-outline" size={20} color="#00d4ff" />
            <Text style={styles.infoText}>
              {isAutoMode 
                ? 'Picks are automatically balanced across your selected sports'
                : 'You can adjust this anytime in settings'
              }
            </Text>
          </View>
        </View>
      </ScrollView>

      <TouchableOpacity
        onPress={handleContinue}
        style={[
          styles.continueButton,
          { opacity: (!isAutoMode && !isValidDistribution) ? 0.6 : 1 }
        ]}
        disabled={!isAutoMode && !isValidDistribution}
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
  modeContainer: {
    flexDirection: 'row',
    marginBottom: isTablet ? 32 : 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: isTablet ? 16 : 12,
    padding: isTablet ? 6 : 4,
    marginHorizontal: isTablet ? 16 : 0,
  },
  modeButton: {
    flex: 1,
    borderRadius: isTablet ? 12 : 8,
    overflow: 'hidden',
    margin: isTablet ? 2 : 0,
  },
  modeButtonActive: {
    // Styling handled by gradient
  },
  modeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: isTablet ? 16 : 12,
    gap: isTablet ? 12 : 8,
  },
  modeText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
  },
  modeTextActive: {
    color: '#fff',
  },
  previewContainer: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
    textAlign: 'center',
  },
  autoPreview: {
    gap: 12,
  },
  previewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
  },
  previewLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  previewValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00d4ff',
  },
  previewTotal: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  previewTotalText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  customContainer: {
    gap: 16,
  },
  sliderContainer: {
    marginBottom: isTablet ? 24 : 16,
    paddingHorizontal: isTablet ? 16 : 0,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sliderLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  sliderValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00d4ff',
    minWidth: 30,
    textAlign: 'right',
  },
  slider: {
    height: isTablet ? 50 : 40,
  },
  sliderThumb: {
    backgroundColor: '#00d4ff',
    width: 20,
    height: 20,
  },
  totalContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.3)',
  },
  totalContainerError: {
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
    borderColor: 'rgba(231, 76, 60, 0.3)',
  },
  totalText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00d4ff',
    textAlign: 'center',
  },
  totalTextError: {
    color: '#e74c3c',
  },
  errorText: {
    fontSize: 12,
    color: '#e74c3c',
    textAlign: 'center',
    marginTop: 4,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    flex: 1,
    lineHeight: 20,
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

export default PickDistributionScreen;
