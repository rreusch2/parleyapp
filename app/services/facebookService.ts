import { Platform } from 'react-native';

// Safely initialize Facebook SDK to prevent crashes
class FacebookService {
  private static isInitialized = false;
  private static initializationPromise: Promise<boolean> | null = null;

  static async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization();
    return this.initializationPromise;
  }

  private static async performInitialization(): Promise<boolean> {
    try {
      // Only attempt to initialize on native platforms
      if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
        console.log('ℹ️ Facebook SDK: Skipping initialization on web platform');
        return false;
      }

      // Dynamically import Facebook SDK to prevent crashes if not configured
      const { Settings } = await import('react-native-fbsdk-next');
      
      // Check if Facebook SDK is properly configured
      if (!Settings) {
        console.log('⚠️ Facebook SDK: Settings not available, skipping initialization');
        return false;
      }

      // Initialize with minimal configuration
      await Settings.initializeSDK();
      
      this.isInitialized = true;
      console.log('✅ Facebook SDK initialized successfully');
      return true;
      
    } catch (error) {
      console.log('⚠️ Facebook SDK initialization failed (non-fatal):', error.message);
      // Don't throw error - this should be non-fatal
      return false;
    }
  }

  static async logEvent(eventName: string, parameters?: Record<string, any>): Promise<void> {
    try {
      const initialized = await this.initialize();
      if (!initialized) {
        console.log('⚠️ Facebook SDK not available for event logging');
        return;
      }

      const { AppEventsLogger } = await import('react-native-fbsdk-next');
      AppEventsLogger.logEvent(eventName, parameters);
      
    } catch (error) {
      console.log('⚠️ Facebook event logging failed (non-fatal):', error.message);
      // Don't throw error - this should be non-fatal
    }
  }

  static async logPurchase(amount: number, currency: string, parameters?: Record<string, any>): Promise<void> {
    try {
      const initialized = await this.initialize();
      if (!initialized) {
        console.log('⚠️ Facebook SDK not available for purchase logging');
        return;
      }

      const { AppEventsLogger } = await import('react-native-fbsdk-next');
      AppEventsLogger.logPurchase(amount, currency, parameters);
      
    } catch (error) {
      console.log('⚠️ Facebook purchase logging failed (non-fatal):', error.message);
      // Don't throw error - this should be non-fatal
    }
  }
}

export default FacebookService;