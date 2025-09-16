const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Performance optimizations for Metro bundler
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Enable Hermes for better performance
config.transformer.hermesCommand = 'hermes';

// Bundle splitting for better performance
config.transformer.enableBabelRCLookup = false;
config.transformer.enableBabelRuntime = false;

// Asset optimization
config.transformer.assetPlugins = ['expo-asset/tools/hashAssetFiles'];

// Tree shaking configuration
config.transformer.minifierConfig = {
  keep_fnames: false,
  mangle: {
    keep_fnames: false,
  },
  output: {
    ascii_only: true,
    quote_style: 3,
    wrap_iife: true,
  },
  sourceMap: {
    includeSources: false,
  },
  toplevel: false,
  warnings: false,
};

// Enable Fast Refresh for development
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
