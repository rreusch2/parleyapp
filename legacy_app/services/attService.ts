import { Platform } from 'react-native';
import * as Device from 'expo-device';

export class ATTService {
  private static instance: ATTService;
  private hasRequestedPermission = false;
  
  static getInstance(): ATTService {
    if (!ATTService.instance) {
      ATTService.instance = new ATTService();
    }
    return ATTService.instance;
  }

  /**
   * Check and request ATT permission with iPad-specific handling
   * @returns The final ATT status
   */
  async checkAndRequestPermission(): Promise<string | null> {
    if (Platform.OS !== 'ios') {
      console.log('📱 Not iOS, skipping ATT');
      return null;
    }

    try {
      const { getTrackingPermissionsAsync, requestTrackingPermissionsAsync } = await import('expo-tracking-transparency');
      
      // Get current status
      const currentPermission = await getTrackingPermissionsAsync();
      console.log(`📱 ATT Current Status: ${currentPermission.status}`);
      console.log(`📱 Device Type: ${Device.deviceType === Device.DeviceType.TABLET ? 'iPad' : 'iPhone'}`);
      
      // Check if we should request permission
      const shouldRequest = (
        currentPermission.status === 'undetermined' ||
        (!this.hasRequestedPermission && currentPermission.status === 'denied')
      );
      
      if (shouldRequest) {
        console.log('📱 Requesting ATT permission...');
        
        // iPad-specific: Ensure app is in active state
        if (Device.deviceType === Device.DeviceType.TABLET) {
          console.log('📱 iPad detected - adding extra delay for stability');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        try {
          const { status } = await requestTrackingPermissionsAsync();
          this.hasRequestedPermission = true;
          console.log(`📱 ATT Permission Result: ${status}`);
          return status;
        } catch (error) {
          console.error('📱 ATT Request Error:', error);
          // Even if there's an error, mark as requested to avoid loops
          this.hasRequestedPermission = true;
          return currentPermission.status;
        }
      }
      
      return currentPermission.status;
    } catch (error) {
      console.error('📱 ATT Service Error:', error);
      return null;
    }
  }

  /**
   * Force request ATT permission (for manual trigger)
   */
  async forceRequestPermission(): Promise<string | null> {
    if (Platform.OS !== 'ios') return null;
    
    try {
      const { requestTrackingPermissionsAsync } = await import('expo-tracking-transparency');
      const { status } = await requestTrackingPermissionsAsync();
      this.hasRequestedPermission = true;
      console.log(`📱 ATT Force Request Result: ${status}`);
      return status;
    } catch (error) {
      console.error('📱 ATT Force Request Error:', error);
      return null;
    }
  }

  /**
   * Get current ATT status without requesting
   */
  async getCurrentStatus(): Promise<string | null> {
    if (Platform.OS !== 'ios') return null;
    
    try {
      const { getTrackingPermissionsAsync } = await import('expo-tracking-transparency');
      const { status } = await getTrackingPermissionsAsync();
      return status;
    } catch (error) {
      console.error('📱 ATT Get Status Error:', error);
      return null;
    }
  }

  /**
   * Check if device is iPad
   */
  isIPad(): boolean {
    return Platform.OS === 'ios' && Device.deviceType === Device.DeviceType.TABLET;
  }
}

export const attService = ATTService.getInstance();
