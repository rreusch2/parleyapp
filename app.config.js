module.exports = {
  expo: {
    name: "Predictive Play",
    slug: "parleyapp",
    version: "1.4.1",
    orientation: "portrait",
    scheme: "predictiveplay",
    userInterfaceStyle: "automatic",
    icon: "./assets/images/icon.png",
    updates: {
      fallbackToCacheTimeout: 0
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.app.predictiveplay",
      buildNumber: "146",
      jsEngine: "hermes",
      // REMOVED: useIconsFromAssetCatalog: true,
      // Permission explanations refined based on app features
      infoPlist: {
        // Only include permissions that your app actually uses
        "ITSAppUsesNonExemptEncryption": false,
        // App Tracking Transparency prompt text (required for IDFA on iOS 14.5+)
        "NSUserTrackingUsageDescription": "We use your data to deliver more relevant ads and to measure campaign performance.",
        // Camera permission (required by third-party SDKs even if not used)
        "NSCameraUsageDescription": "This app does not use the camera, but this permission is required by third-party SDKs.",
        // Meta SKAdNetwork IDs (helps install attribution & optimization). The FBSDK plugin also injects these.
        "SKAdNetworkItems": [
          { "SKAdNetworkIdentifier": "v9wttpbfk9.skadnetwork" }, // Meta Primary
          { "SKAdNetworkIdentifier": "n38lu8286q.skadnetwork" }, // Meta Secondary
          { "SKAdNetworkIdentifier": "cstr6suwn9.skadnetwork" }, // Meta Additional
          { "SKAdNetworkIdentifier": "424m5254lk.skadnetwork" }, // Meta Additional
          { "SKAdNetworkIdentifier": "wzmmz9fp6w.skadnetwork" }, // Meta Extended
          { "SKAdNetworkIdentifier": "hs6bdukanm.skadnetwork" }, // Meta Extended
          { "SKAdNetworkIdentifier": "c6k4g5qg8m.skadnetwork" }, // Meta Extended
          { "SKAdNetworkIdentifier": "9rd848q2bz.skadnetwork" }, // Meta Extended
          { "SKAdNetworkIdentifier": "4fzdc2evr5.skadnetwork" }, // Meta Extended
          { "SKAdNetworkIdentifier": "t38b2kh725.skadnetwork" }, // Meta Extended
        ],
        // App Transport Security - CRITICAL for Railway API access
        "NSAppTransportSecurity": {
          "NSExceptionDomains": {
            "web-production-f090e.up.railway.app": {
              "NSExceptionAllowsInsecureHTTPLoads": false,
              "NSExceptionMinimumTLSVersion": "1.0",
              "NSExceptionRequiresForwardSecrecy": false,
              "NSIncludesSubdomains": false
            },
            "up.railway.app": {
              "NSIncludesSubdomains": true,
              "NSExceptionAllowsInsecureHTTPLoads": false,
              "NSExceptionMinimumTLSVersion": "1.0",
              "NSExceptionRequiresForwardSecrecy": false
            }
          }
        }
      },
      usesAppleSignIn: true

    },
    android: {
      icon: "./assets/images/icon.png",
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#111827",
        monochromeImage: "./assets/images/adaptive-icon.png"
      },
      package: "com.parleyapp.mobile",
      versionCode: 1,
      jsEngine: "hermes",
      // Permissions for sports betting app
      permissions: [
        "INTERNET",
        "ACCESS_NETWORK_STATE",
        "BILLING"
      ]
    },
    web: {
      bundler: "metro",
      output: "single",
      favicon: "./assets/images/favicon.png"
    },
    notification: {
      icon: "./assets/images/icon.png",
      color: "#ffffff",
      iosDisplayInForeground: true,
      androidMode: "default",
      androidCollapsedTitle: "#{unread_notifications} new predictions",
    },
    plugins: [
      "expo-router",
      "expo-font",
      "expo-notifications",
      "expo-web-browser",
      "expo-apple-authentication",
      "expo-asset",
      [
        "react-native-google-mobile-ads",
        {
          iosAppId: process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID || "ca-app-pub-3940256099942544~1458002511", // Test ID fallback
          androidAppId: process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID || "ca-app-pub-3940256099942544~3347511713" // Test ID fallback
        }
      ],
      [
        "react-native-appsflyer",
        {
          "devKey": "NgBrVqoMhaRVeeaekgT9xX",
          "appId": "id6748275790",
          "isDebug": false
        }
      ],
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_BACKEND_URL, // ← Changed from EXPO_PUBLIC_API_URL
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      revenueCatIosApiKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
      revenueCatAndroidApiKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
      admobAndroidAppId: process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID,
      admobIosAppId: process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID,
      admobRewardedUnitId: process.env.EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID,
      // Optional Elite preview video URL used in tiered subscription modals
      elitePreviewVideoUrl: process.env.EXPO_PUBLIC_ELITE_PREVIEW_VIDEO_URL,
      // Google OAuth client IDs for Expo AuthSession (used for Google sign-in)
      googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      googleAndroidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
      googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,

      eas: {
        projectId: "67fd3514-eb27-473d-937c-2ff842ec5fad"
      }
    },
    newArchEnabled: false
  }
};
