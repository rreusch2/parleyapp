// Optimized image component using Expo Image for better performance
import React, { useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import { Image } from 'expo-image';

interface OptimizedImageProps {
  source: { uri: string } | number;
  style?: any;
  resizeMode?: 'contain' | 'cover' | 'fill' | 'scale-down' | 'none';
  priority?: 'low' | 'normal' | 'high';
  fallbackColor?: string;
  showLoader?: boolean;
}

const { width: screenWidth } = Dimensions.get('window');

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  source,
  style,
  resizeMode = 'cover',
  priority = 'normal',
  fallbackColor = '#1E293B',
  showLoader = true
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const handleLoadStart = () => {
    setLoading(true);
    setError(false);
  };

  const handleLoadEnd = () => {
    setLoading(false);
  };

  const handleError = () => {
    setLoading(false);
    setError(true);
  };

  return (
    <View style={[styles.container, style]}>
      {!error && (
        <Image
          source={source}
          style={[styles.image, style]}
          contentFit={resizeMode}
          priority={priority}
          cachePolicy="memory-disk"
          onLoadStart={handleLoadStart}
          onLoadEnd={handleLoadEnd}
          onError={handleError}
        />
      )}
      
      {loading && showLoader && (
        <View style={[styles.loader, { backgroundColor: fallbackColor }]}>
          <ActivityIndicator size="small" color="#00E5FF" />
        </View>
      )}
      
      {error && (
        <View style={[styles.fallback, { backgroundColor: fallbackColor }, style]} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  fallback: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
});

export default OptimizedImage;
