const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add resolver to handle platform-specific modules
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Create platform-specific resolver to exclude problematic packages on web
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Exclude react-native-google-mobile-ads completely on web
  if (platform === 'web' && moduleName === 'react-native-google-mobile-ads') {
    // Return a path to an empty module
    return {
      filePath: path.resolve(__dirname, 'app/services/admob/index.web.ts'),
      type: 'sourceFile',
    };
  }

  // Use default resolver
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;