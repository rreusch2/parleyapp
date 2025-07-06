const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// config.resolver.extraNodeModules = {
//   'react-native-vector-icons': require.resolve('react-native-vector-icons'),
// };

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

// Production optimizations
if (process.env.NODE_ENV === 'production') {
  // Remove console.log statements in production builds
  config.transformer = {
    ...config.transformer,
    minifierConfig: {
      ...config.transformer.minifierConfig,
      keep_console: false, // Remove all console statements
      drop_console: true, // Drop console statements
    },
    // Add babel plugin to remove console.logs
    babelTransformerPath: require.resolve('metro-react-native-babel-transformer'),
  };

  // Add babel plugin configuration
  config.transformer.babelTransformerPath = require.resolve('metro-react-native-babel-transformer');
}

module.exports = config; 