// Enhanced loading spinner with better performance and UX
import React from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Sparkles, Activity } from 'lucide-react-native';

interface OptimizedLoadingSpinnerProps {
  text?: string;
  showProgress?: boolean;
  progress?: number;
  variant?: 'default' | 'minimal' | 'detailed';
  color?: string;
}

export const OptimizedLoadingSpinner: React.FC<OptimizedLoadingSpinnerProps> = ({
  text = 'Loading your dashboard...',
  showProgress = false,
  progress = 0,
  variant = 'default',
  color = '#00E5FF'
}) => {
  const spinValue = new Animated.Value(0);

  React.useEffect(() => {
    const spinAnimation = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    );
    spinAnimation.start();

    return () => {
      spinAnimation.stop();
      spinValue.setValue(0);
    };
  }, []);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const opacity = spinValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.4, 1, 0.4],
  });

  if (variant === 'minimal') {
    return (
      <View style={styles.minimalContainer}>
        <Animated.View style={{ transform: [{ rotate: spin }], opacity }}>
          <Activity size={24} color={color} />
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.iconContainer, { opacity }]}>
        <Sparkles size={40} color={color} />
      </Animated.View>
      
      <Text style={[styles.loadingText, { color }]}>{text}</Text>
      
      {showProgress && progress > 0 && (
        <View style={styles.progressSection}>
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${progress}%`, backgroundColor: color }]} />
          </View>
          <Text style={styles.progressText}>{Math.round(progress)}%</Text>
        </View>
      )}
      
      {variant === 'detailed' && (
        <View style={styles.detailsContainer}>
          <View style={styles.stepIndicator}>
            <View style={[styles.step, progress > 20 && styles.stepComplete]} />
            <View style={[styles.step, progress > 40 && styles.stepComplete]} />
            <View style={[styles.step, progress > 60 && styles.stepComplete]} />
            <View style={[styles.step, progress > 80 && styles.stepComplete]} />
          </View>
          <Text style={styles.stepText}>
            {progress < 25 ? 'Initializing...' :
             progress < 50 ? 'Loading data...' :
             progress < 75 ? 'Preparing interface...' :
             'Almost ready...'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 20,
  },
  minimalContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  iconContainer: {
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 20,
    textAlign: 'center',
  },
  progressSection: {
    width: '100%',
    maxWidth: 280,
    alignItems: 'center',
  },
  progressContainer: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(100, 116, 139, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
    transition: 'width 300ms ease',
  },
  progressText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  detailsContainer: {
    marginTop: 30,
    alignItems: 'center',
  },
  stepIndicator: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  step: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(100, 116, 139, 0.3)',
    marginHorizontal: 4,
  },
  stepComplete: {
    backgroundColor: '#00E5FF',
  },
  stepText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '400',
  },
});

export default OptimizedLoadingSpinner;
