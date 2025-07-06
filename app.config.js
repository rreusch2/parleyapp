module.exports = {
  expo: {
    name: "Parley App",
    slug: "parleyapp",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "parleyapp",
    userInterfaceStyle: "automatic",
    updates: {
      fallbackToCacheTimeout: 0
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.parleyapp.mobile",
      infoPlist: {
        NSCameraUsageDescription: "Parley App needs camera access to scan betting slips and QR codes for enhanced features.",
        NSPhotoLibraryUsageDescription: "Parley App needs photo library access to save and share your winning picks and analysis.",
        NSLocationWhenInUseUsageDescription: "Parley App uses your location to provide region-specific odds and legal sports betting information.",
        NSUserTrackingUsageDescription: "Parley App uses tracking to provide personalized sports betting recommendations and improve your experience.",

      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#111827"
      },
      package: "com.parleyapp.mobile",
      permissions: [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
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
      androidCollapsedTitle: "#{unread_notifications} new interactions",
      // VAPID keys for web push notifications
      vapidPublicKey: "BECJqbsZfUznpo_xM6Rqz34r6gfXgNkDpTc8OQ7ovWO1KdSRKHn5NsrPWOFzEJy4WZq6vn039fpAnAz0uWWdS4s"
    },
    plugins: ["expo-router", "expo-font", "expo-web-browser", "expo-notifications", "react-native-iap"],
    experiments: {
      typedRoutes: true
    },
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL,
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      eas: {
        projectId: "your-eas-project-id"
      }
    },
    newArchEnabled: true
  }
}; 