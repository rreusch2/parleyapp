/**
 * Temporary mock for @callstack/liquid-glass until library is fixed
 * This provides basic fallback components that work without the broken library
 */

import { View } from 'react-native';

// Mock the isLiquidGlassSupported function to always return false
export const isLiquidGlassSupported = () => false;

// Export View as replacements for LiquidGlass components
export const LiquidGlassView = View;
export const LiquidGlassContainerView = View;
