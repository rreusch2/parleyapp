// Lazy loading wrapper component for better performance
import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { runAfterInteractions } from '../utils/performanceOptimizer';

interface LazyLoadSectionProps {
  children: React.ReactNode;
  threshold?: number;
  placeholder?: React.ReactNode;
  delay?: number;
  onLoad?: () => void;
}

const { height: screenHeight } = Dimensions.get('window');

export const LazyLoadSection: React.FC<LazyLoadSectionProps> = ({
  children,
  threshold = screenHeight * 0.5, // Load when 50% of screen height away
  placeholder = null,
  delay = 0,
  onLoad
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const containerRef = useRef<View>(null);

  useEffect(() => {
    // Use InteractionManager to delay loading until after interactions
    const loadComponent = () => {
      runAfterInteractions(() => {
        if (delay > 0) {
          setTimeout(() => {
            setShouldRender(true);
            setTimeout(() => {
              setIsLoaded(true);
              onLoad?.();
            }, 50); // Small delay for smoother transition
          }, delay);
        } else {
          setShouldRender(true);
          setTimeout(() => {
            setIsLoaded(true);
            onLoad?.();
          }, 50);
        }
      });
    };

    loadComponent();
  }, [delay, onLoad]);

  if (!shouldRender) {
    return placeholder ? <View style={styles.placeholder}>{placeholder}</View> : null;
  }

  return (
    <View ref={containerRef} style={styles.container}>
      {isLoaded ? children : placeholder}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  placeholder: {
    width: '100%',
    minHeight: 100,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.3)',
    borderRadius: 8,
  },
});

export default LazyLoadSection;
