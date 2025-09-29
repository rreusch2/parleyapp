import { Dimensions, PixelRatio, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Based on iPhone 8's scale, but handle web properly
const getScale = () => {
  if (Platform.OS === 'web') {
    // On web, cap the width at mobile size to prevent huge scaling
    const webWidth = Math.min(SCREEN_WIDTH, 428); // iPhone 14 Pro Max width
    return webWidth / 375;
  }
  return SCREEN_WIDTH / 375;
};

const scale = getScale();

export function normalize(size: number) {
  const newSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
}

export const isSmallDevice = SCREEN_WIDTH < 375;

export const isLargeDevice = SCREEN_WIDTH > 768;

export const isTablet = Platform.OS === 'web' ? false : (SCREEN_HEIGHT / SCREEN_WIDTH < 1.6);
