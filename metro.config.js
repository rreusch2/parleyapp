const { getDefaultConfig } = require('expo/metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');
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

// Prevent Metro from watching heavy non-app directories that trigger ENOSPC
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|\[\]\\]/g, '\\$&');
}

const projectRoot = __dirname;
const ignoredDirs = [
  // User-requested folders
  'agent',
  'web-app',
  'website',
  'adagent',
  'data',
  'database',
  'email-automation',
  'enhancementreport',
  'enhancements',
  'logs',
  'n8n-evaluation-system',
  'parley_scrapy',
  'pplayweb',
  'professor-lock-service',
  'python-scripts-service',
  'pwa-version',
  'simulator_build',
  'statmuse-api-service',
  'python-services',
  'web-mocks',
  // Common heavy subtrees
  'backend/node_modules',
  'web-app/node_modules',
  'web-app/.next',
  'web-app/out',
  '.git',
];

const venvDirs = [
  '.venv',
  'venv',
  'agent/.venv',
  'python-scripts-service/.venv',
];

const blockListRegexes = [
  ...ignoredDirs.map((d) => new RegExp('^' + escapeRegExp(path.resolve(projectRoot, d)) + '/.*')),
  ...venvDirs.map((d) => new RegExp('^' + escapeRegExp(path.resolve(projectRoot, d)) + '/.*')),
  // Python caches anywhere under project
  new RegExp('/__pycache__/'),
];

config.resolver.blockList = exclusionList(blockListRegexes);

module.exports = config;