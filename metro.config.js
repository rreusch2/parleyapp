const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add resolution for deprecated prop types and native modules on web
const { resolve } = require('path');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Handle deprecated prop types
  if (moduleName === 'deprecated-react-native-prop-types') {
    return {
      filePath: require.resolve('deprecated-react-native-prop-types'),
      type: 'sourceFile',
    };
  }

  // Handle native modules that shouldn't be imported on web
  if (platform === 'web') {
    const nativeOnlyModules = [
      'react-native/Libraries/Utilities/codegenNativeCommands',
      'react-native/Libraries/Utilities/codegenNativeComponent',
      'react-native-google-mobile-ads',
      'react-native-purchases',
      'expo-apple-authentication',
      'react-native-sse'
    ];

    if (nativeOnlyModules.some(module => moduleName.includes(module))) {
      // Return a mock module for web
      return {
        filePath: resolve(__dirname, 'web-mocks/empty-module.js'),
        type: 'sourceFile',
      };
    }
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;