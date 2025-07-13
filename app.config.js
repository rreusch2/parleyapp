module.exports = {
  expo: {
    name: "Predictive Play",
    slug: "parleyapp",
    version: "1.0.0",
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
      supportsTablet: false,
      bundleIdentifier: "com.app.predictiveplay",
      buildNumber: "77",
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
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#111827"
      },
      package: "com.parleyapp.mobile",
      versionCode: 1,
      // Only include permissions that your app actually uses
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
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
      "expo-apple-authentication"
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_BACKEND_URL, // ← Changed from EXPO_PUBLIC_API_URL
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      revenueCatApiKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
      eas: {
        projectId: "67fd3514-eb27-473d-937c-2ff842ec5fad"
      }
    },
    newArchEnabled: false
  }
};
