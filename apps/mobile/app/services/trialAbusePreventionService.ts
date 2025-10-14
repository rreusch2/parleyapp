import { supabase } from './api/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Application from 'expo-application';

interface TrialEligibilityResult {
  isEligible: boolean;
  reason?: 'already_used' | 'phone_required' | 'device_flagged' | 'suspicious_activity';
  message?: string;
}

interface DeviceFingerprint {
  deviceId: string;
  deviceName: string;
  deviceBrand: string;
  deviceModel: string;
  osVersion: string;
  appVersion: string;
  installationId: string;
}

class TrialAbusePreventionService {
  private static instance: TrialAbusePreventionService;
  private readonly STORAGE_KEY = 'parley_device_fingerprint';

  public static getInstance(): TrialAbusePreventionService {
    if (!TrialAbusePreventionService.instance) {
      TrialAbusePreventionService.instance = new TrialAbusePreventionService();
    }
    return TrialAbusePreventionService.instance;
  }

  /**
   * Check if user is eligible for free trial
   */
  async checkTrialEligibility(userId: string, phoneNumber?: string): Promise<TrialEligibilityResult> {
    try {
      // 1. Check if user already used trial
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('trial_used, phone_number')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      if (userProfile.trial_used) {
        return {
          isEligible: false,
          reason: 'already_used',
          message: 'You have already used your free trial. Upgrade to Pro to access premium features.'
        };
      }

      // 2. Require phone number for trial eligibility
      if (!phoneNumber && !userProfile.phone_number) {
        return {
          isEligible: false,
          reason: 'phone_required',
          message: 'Phone number verification is required to start your free trial.'
        };
      }

      // 3. Check if phone number was already used for trial
      if (phoneNumber || userProfile.phone_number) {
        const phoneToCheck = phoneNumber || userProfile.phone_number;
        const { data: phoneUsers, error: phoneError } = await supabase
          .from('profiles')
          .select('id, trial_used')
          .eq('phone_number', phoneToCheck)
          .neq('id', userId);

        if (phoneError) throw phoneError;

        const hasUsedTrial = phoneUsers?.some(user => user.trial_used);
        if (hasUsedTrial) {
          return {
            isEligible: false,
            reason: 'already_used',
            message: 'This phone number has already been used for a free trial.'
          };
        }
      }

      // 4. Check device fingerprint for suspicious activity
      const deviceFingerprint = await this.getDeviceFingerprint();
      const suspiciousActivity = await this.checkDeviceFingerprint(deviceFingerprint, userId);
      
      if (suspiciousActivity) {
        return {
          isEligible: false,
          reason: 'device_flagged',
          message: 'Unable to start trial. Contact support if you believe this is an error.'
        };
      }

      return { isEligible: true };
    } catch (error) {
      console.error('Error checking trial eligibility:', error);
      return {
        isEligible: false,
        reason: 'suspicious_activity',
        message: 'Unable to verify trial eligibility. Please try again.'
      };
    }
  }

  /**
   * Mark trial as used for user and device
   */
  async markTrialAsUsed(userId: string, phoneNumber?: string): Promise<void> {
    try {
      // Update user profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          trial_used: true,
          phone_number: phoneNumber || undefined
        })
        .eq('id', userId);

      if (updateError) throw updateError;

      // Record device fingerprint
      const deviceFingerprint = await this.getDeviceFingerprint();
      await this.recordDeviceFingerprint(deviceFingerprint, userId);

      console.log('✅ Trial marked as used for user:', userId);
    } catch (error) {
      console.error('Error marking trial as used:', error);
      throw error;
    }
  }

  /**
   * Verify phone number with SMS (placeholder for future implementation)
   */
  async verifyPhoneNumber(phoneNumber: string): Promise<{ success: boolean; verificationId?: string }> {
    try {
      // TODO: Implement SMS verification with service like Twilio
      // For now, return success for valid phone format
      const phoneRegex = /^\+?[1-9]\d{1,14}$/;
      const isValid = phoneRegex.test(phoneNumber.replace(/\s+/g, ''));
      
      if (!isValid) {
        return { success: false };
      }

      // Mock verification ID
      const verificationId = Math.random().toString(36).substring(2, 15);
      
      return { success: true, verificationId };
    } catch (error) {
      console.error('Error verifying phone number:', error);
      return { success: false };
    }
  }

  /**
   * Get device fingerprint for tracking
   */
  private async getDeviceFingerprint(): Promise<DeviceFingerprint> {
    try {
      const deviceId = Device.osInternalBuildId || Device.deviceYearClass?.toString() || 'unknown';
      const installationId = await Application.getInstallationIdAsync();
      
      return {
        deviceId,
        deviceName: Device.deviceName || 'unknown',
        deviceBrand: Device.brand || 'unknown',
        deviceModel: Device.modelName || 'unknown',
        osVersion: Device.osVersion || 'unknown',
        appVersion: Application.nativeApplicationVersion || '1.0.0',
        installationId: installationId || 'unknown'
      };
    } catch (error) {
      console.error('Error getting device fingerprint:', error);
      return {
        deviceId: 'unknown',
        deviceName: 'unknown',
        deviceBrand: 'unknown',
        deviceModel: 'unknown',
        osVersion: 'unknown',
        appVersion: '1.0.0',
        installationId: 'unknown'
      };
    }
  }

  /**
   * Check if device fingerprint indicates suspicious activity
   */
  private async checkDeviceFingerprint(fingerprint: DeviceFingerprint, userId: string): Promise<boolean> {
    try {
      // Check if this device was used by multiple users for trials
      const { data: deviceUsers, error } = await supabase
        .from('device_fingerprints')
        .select('user_id, created_at')
        .eq('device_id', fingerprint.deviceId)
        .eq('installation_id', fingerprint.installationId)
        .neq('user_id', userId);

      if (error) throw error;

      // Flag as suspicious if more than 2 different users used this device for trials
      if (deviceUsers && deviceUsers.length >= 2) {
        console.log('🚨 Suspicious device activity detected:', fingerprint.deviceId);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking device fingerprint:', error);
      return false; // Don't block users on error
    }
  }

  /**
   * Record device fingerprint in database
   */
  private async recordDeviceFingerprint(fingerprint: DeviceFingerprint, userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('device_fingerprints')
        .insert({
          user_id: userId,
          device_id: fingerprint.deviceId,
          device_name: fingerprint.deviceName,
          device_brand: fingerprint.deviceBrand,
          device_model: fingerprint.deviceModel,
          os_version: fingerprint.osVersion,
          app_version: fingerprint.appVersion,
          installation_id: fingerprint.installationId,
          fingerprint_data: fingerprint
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error recording device fingerprint:', error);
      // Don't throw - this is for tracking only
    }
  }

  /**
   * Get trial abuse statistics (for admin)
   */
  async getTrialAbuseStats(): Promise<{
    totalTrialsUsed: number;
    uniqueDevices: number;
    suspiciousDevices: number;
    phoneNumberReuse: number;
  }> {
    try {
      // Total trials used
      const { count: totalTrials } = await supabase
        .from('profiles')
        .select('id', { count: 'exact' })
        .eq('trial_used', true);

      // Unique devices
      const { data: devices } = await supabase
        .from('device_fingerprints')
        .select('device_id')
        .order('device_id');

      const uniqueDevices = new Set(devices?.map(d => d.device_id)).size;

      // Suspicious devices (used by multiple users)
      const deviceCounts = devices?.reduce((acc: Record<string, number>, device) => {
        acc[device.device_id] = (acc[device.device_id] || 0) + 1;
        return acc;
      }, {});

      const suspiciousDevices = Object.values(deviceCounts || {}).filter(count => count > 1).length;

      // Phone number reuse
      const { data: phoneNumbers } = await supabase
        .from('profiles')
        .select('phone_number')
        .not('phone_number', 'is', null);

      const phoneNumberCounts = phoneNumbers?.reduce((acc: Record<string, number>, profile) => {
        if (profile.phone_number) {
          acc[profile.phone_number] = (acc[profile.phone_number] || 0) + 1;
        }
        return acc;
      }, {});

      const phoneNumberReuse = Object.values(phoneNumberCounts || {}).filter(count => count > 1).length;

      return {
        totalTrialsUsed: totalTrials || 0,
        uniqueDevices,
        suspiciousDevices,
        phoneNumberReuse
      };
    } catch (error) {
      console.error('Error getting trial abuse stats:', error);
      return {
        totalTrialsUsed: 0,
        uniqueDevices: 0,
        suspiciousDevices: 0,
        phoneNumberReuse: 0
      };
    }
  }
}

export default TrialAbusePreventionService;
export type { TrialEligibilityResult, DeviceFingerprint };
