const { withAppDelegate } = require('expo/config-plugins');

// Wires the Facebook iOS SDK into AppDelegate.swift as required for Aggregated Event Measurement:
// initialize at launch, and hand every opened URL / universal link to the SDK (including cold starts).
// https://developers.facebook.com/docs/app-events/guides/aggregated-event-measurement/

const MARKER = '// @generated withFacebookAppDelegate';

function replaceOrThrow(contents, search, replacement, description) {
  if (!contents.includes(search)) {
    throw new Error(
      `[withFacebookAppDelegate] Could not find ${description} in AppDelegate.swift. ` +
        'The Expo AppDelegate template changed; update plugins/withFacebookAppDelegate.js.'
    );
  }
  return contents.replace(search, replacement);
}

function addFacebookToAppDelegate(contents) {
  if (contents.includes(MARKER)) {
    return contents;
  }

  contents = replaceOrThrow(
    contents,
    'import Expo\n',
    `import Expo\nimport FBSDKCoreKit ${MARKER}\n`,
    'the `import Expo` line'
  );

  contents = replaceOrThrow(
    contents,
    '    return super.application(application, didFinishLaunchingWithOptions: launchOptions)',
    '    _ = FBSDKCoreKit.ApplicationDelegate.shared.application(application, didFinishLaunchingWithOptions: launchOptions)\n' +
      '    return super.application(application, didFinishLaunchingWithOptions: launchOptions)',
    'the didFinishLaunchingWithOptions return statement'
  );

  contents = replaceOrThrow(
    contents,
    '    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)',
    '    let handledByFacebook = FBSDKCoreKit.ApplicationDelegate.shared.application(app, open: url, options: options)\n' +
      '    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options) || handledByFacebook',
    'the open url handler'
  );

  contents = replaceOrThrow(
    contents,
    '    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)',
    '    _ = FBSDKCoreKit.ApplicationDelegate.shared.application(application, continue: userActivity)\n' +
      '    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)',
    'the universal links handler'
  );

  return contents;
}

module.exports = function withFacebookAppDelegate(config) {
  return withAppDelegate(config, (config) => {
    if (config.modResults.language !== 'swift') {
      throw new Error('[withFacebookAppDelegate] Expected a Swift AppDelegate (Expo SDK 53+).');
    }
    config.modResults.contents = addFacebookToAppDelegate(config.modResults.contents);
    return config;
  });
};

module.exports.addFacebookToAppDelegate = addFacebookToAppDelegate;
