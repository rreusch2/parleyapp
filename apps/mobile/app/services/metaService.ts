import { Platform } from 'react-native';

// Conditional import: the Facebook SDK only exists in native builds
let FBSDK: typeof import('react-native-fbsdk-next') | null = null;

if (Platform.OS === 'ios' || Platform.OS === 'android') {
  try {
    FBSDK = require('react-native-fbsdk-next');
  } catch (error) {
    console.warn('Facebook SDK not available on this platform:', error);
  }
}

type RegistrationMethod = 'email' | 'google' | 'apple';

class MetaService {
  private static instance: MetaService;

  static getInstance(): MetaService {
    if (!MetaService.instance) {
      MetaService.instance = new MetaService();
    }
    return MetaService.instance;
  }

  private isAvailable(): boolean {
    return FBSDK !== null;
  }

  /**
   * Pass the App Tracking Transparency result to the Facebook SDK.
   * The SDK itself is initialized natively at launch (plugins/withFacebookAppDelegate.js).
   * iOS 17+ reads ATT status directly; iOS 15.1-16 needs the flag set explicitly.
   */
  async setTrackingPermission(attStatus: string | null): Promise<void> {
    if (!this.isAvailable() || Platform.OS !== 'ios') return;

    try {
      const granted = attStatus === 'granted';
      await FBSDK!.Settings.setAdvertiserTrackingEnabled(granted);
      console.log(`✅ Meta advertiser tracking enabled: ${granted}`);
    } catch (error) {
      console.error('❌ Failed to set Meta advertiser tracking flag:', error);
    }
  }

  trackCompleteRegistration(method: RegistrationMethod): void {
    if (!this.isAvailable()) return;

    try {
      const { AppEventsLogger } = FBSDK!;
      AppEventsLogger.logEvent(AppEventsLogger.AppEvents.CompletedRegistration, {
        [AppEventsLogger.AppEventParams.RegistrationMethod]: method,
      });
    } catch (error) {
      console.error('❌ Failed to log Meta CompleteRegistration:', error);
    }
  }

  trackInitiateCheckout(planId: string, price: number, currency: string = 'USD'): void {
    if (!this.isAvailable()) return;

    try {
      const { AppEventsLogger } = FBSDK!;
      AppEventsLogger.logEvent(AppEventsLogger.AppEvents.InitiatedCheckout, price, {
        [AppEventsLogger.AppEventParams.ContentType]: 'subscription',
        [AppEventsLogger.AppEventParams.ContentID]: planId,
        [AppEventsLogger.AppEventParams.Currency]: currency,
        [AppEventsLogger.AppEventParams.NumItems]: 1,
      });
    } catch (error) {
      console.error('❌ Failed to log Meta InitiateCheckout:', error);
    }
  }

  trackPurchase(productId: string, price: number, currency: string): void {
    if (!this.isAvailable()) return;

    try {
      const { AppEventsLogger } = FBSDK!;
      AppEventsLogger.logPurchase(price, currency, {
        [AppEventsLogger.AppEventParams.ContentType]: 'subscription',
        [AppEventsLogger.AppEventParams.ContentID]: productId,
        [AppEventsLogger.AppEventParams.NumItems]: 1,
      });
    } catch (error) {
      console.error('❌ Failed to log Meta Purchase:', error);
    }
  }

  trackViewContent(contentType: string): void {
    if (!this.isAvailable()) return;

    try {
      const { AppEventsLogger } = FBSDK!;
      AppEventsLogger.logEvent(AppEventsLogger.AppEvents.ViewedContent, {
        [AppEventsLogger.AppEventParams.ContentType]: contentType,
      });
    } catch (error) {
      console.error('❌ Failed to log Meta ViewContent:', error);
    }
  }
}

export default MetaService.getInstance();
