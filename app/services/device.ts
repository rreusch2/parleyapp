import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Based on iPhone 8's scale
const scale = SCREEN_WIDTH / 375;

export function normalize(size: number) {
  const newSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
}

export const isSmallDevice = SCREEN_WIDTH < 375;

export const isLargeDevice = SCREEN_WIDTH > 768;

export const isTablet = SCREEN_HEIGHT / SCREEN_WIDTH < 1.6;
