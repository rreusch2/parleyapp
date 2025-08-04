module.exports = {
  expo: {
    name: "Predictive Play",
    slug: "parleyapp",
    version: "1.2.0",
    orientation: "portrait",
    scheme: "predictiveplay",
    userInterfaceStyle: "automatic",
    icon: "./assets/images/icon.png", // ← ADDED THIS
    updates: {
      fallbackToCacheTimeout: 0
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.app.predictiveplay",
      buildNumber: "29",
      jsEngine: "hermes",
      // REMOVED: useIconsFromAssetCatalog: true,
      // Permission explanations refined based on app features
      infoPlist: {
        // Only include permissions that your app actually uses
        "ITSAppUsesNonExemptEncryption": false
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
      [
        "expo-ads-admob",
        {
          androidAppId: "ca-app-pub-9584826565591456~1910888945",
          iosAppId: "ca-app-pub-9584826565591456~1910888945"
        }
      ]
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
      admobAppId: "ca-app-pub-9584826565591456~1910888945",
      admobRewardAdUnitId: "ca-app-pub-9584826565591456/9182858395",
      eas: {
        projectId: "67fd3514-eb27-473d-937c-2ff842ec5fad"
      }
    },
    newArchEnabled: false
  }
};
