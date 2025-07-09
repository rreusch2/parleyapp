const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add resolution for deprecated prop types
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'deprecated-react-native-prop-types') {
    return {
      filePath: require.resolve('deprecated-react-native-prop-types'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;