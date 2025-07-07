import { Platform } from 'react-native';

// Workaround for potential web compatibility issues
if (Platform.OS === 'web') {
  // On web, make sure we don't have any global objects that might interfere with React rendering
  if (typeof window !== 'undefined') {
    // Clear any potentially problematic global variables or hooks
    window.frameworkReady = () => {
      console.log('Framework ready');
    };
  }
}

// Export the Expo Router entry point
export { default } from 'expo-router/entry';
