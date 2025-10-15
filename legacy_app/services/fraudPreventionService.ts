import { supabase } from './api/supabaseClient';
import * as Device from 'expo-device';
import { Platform, Dimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface DeviceFingerprint {
  deviceId: string;
  deviceName: string;
  deviceType: string;
  osName: string;
  osVersion: string;
  ipAddress: string;
  networkType: string;
  userAgent: string;
  screenDimensions: string;
  timezone: string;
}

interface FraudCheckResult {
  isValid: boolean;
  riskScore: number;
  reasons: string[];
  blocked: boolean;
}

class FraudPreventionService {
  private static instance: FraudPreventionService;

  public static getInstance(): FraudPreventionService {
    if (!FraudPreventionService.instance) {
      FraudPreventionService.instance = new FraudPreventionService();
    }
    return FraudPreventionService.instance;
  }

  /**
   * Generate comprehensive device fingerprint
   */
  async generateDeviceFingerprint(): Promise<DeviceFingerprint> {
    try {
      const { width, height } = Dimensions.get('screen');
      
      return {
        deviceId: Device.osBuildId || Device.osInternalBuildId || `${Platform.OS}-${Date.now()}`,
        deviceName: Device.deviceName || 'unknown',
        deviceType: Device.deviceType?.toString() || 'unknown',
        osName: Device.osName || Platform.OS,
        osVersion: Device.osVersion || 'unknown',
        ipAddress: 'client-side', // Will be determined server-side
        networkType: 'mobile',
        userAgent: Platform.select({
          web: typeof navigator !== 'undefined' ? navigator.userAgent : 'web-unknown',
          default: `${Platform.OS}/${Device.osVersion || 'unknown'}`
        }) || 'unknown',
        screenDimensions: `${width}x${height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown'
      };
    } catch (error) {
      console.error('Error generating device fingerprint:', error);
      return {
        deviceId: `${Platform.OS}-fallback-${Date.now()}`,
        deviceName: 'error',
        deviceType: 'error',
        osName: Platform.OS,
        osVersion: 'unknown',
        ipAddress: 'unknown',
        networkType: 'unknown',
        userAgent: 'unknown',
        screenDimensions: 'unknown',
        timezone: 'unknown'
      };
    }
  }

  /**
   * Check if device already has an account
   */
  async checkDeviceLimit(fingerprint: DeviceFingerprint): Promise<FraudCheckResult> {
    try {
      const { data: existingAccounts, error } = await supabase
        .from('device_fingerprints')
        .select('user_id, created_at')
        .or(`device_id.eq.${fingerprint.deviceId},ip_address.eq.${fingerprint.ipAddress}`)
        .neq('status', 'deleted');

      if (error) throw error;

      const riskFactors: string[] = [];
      let riskScore = 0;

      // Check for multiple accounts on same device
      if (existingAccounts && existingAccounts.length > 0) {
        riskScore += 50;
        riskFactors.push(`Device already has ${existingAccounts.length} account(s)`);
      }

      // Check for suspicious IP patterns
      const recentAccounts = existingAccounts?.filter(account => {
        const accountAge = Date.now() - new Date(account.created_at).getTime();
        return accountAge < 24 * 60 * 60 * 1000; // 24 hours
      });

      if (recentAccounts && recentAccounts.length > 0) {
        riskScore += 30;
        riskFactors.push('Recent account creation from same IP/device');
      }

      const isBlocked = riskScore >= 50;

      return {
        isValid: !isBlocked,
        riskScore,
        reasons: riskFactors,
        blocked: isBlocked
      };
    } catch (error) {
      console.error('Error checking device limit:', error);
      return {
        isValid: false,
        riskScore: 100,
        reasons: ['System error during fraud check'],
        blocked: true
      };
    }
  }

  /**
   * Store device fingerprint for new user
   */
  async storeDeviceFingerprint(userId: string, fingerprint: DeviceFingerprint): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('device_fingerprints')
        .insert({
          user_id: userId,
          device_id: fingerprint.deviceId,
          device_name: fingerprint.deviceName,
          device_type: fingerprint.deviceType,
          os_name: fingerprint.osName,
          os_version: fingerprint.osVersion,
          ip_address: fingerprint.ipAddress,
          network_type: fingerprint.networkType,
          user_agent: fingerprint.userAgent,
          screen_dimensions: fingerprint.screenDimensions,
          timezone: fingerprint.timezone,
          status: 'active',
          created_at: new Date().toISOString()
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error storing device fingerprint:', error);
      return false;
    }
  }

  /**
   * Check if phone number is already verified by another user
   */
  async checkPhoneNumberUnique(phoneNumber: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone_number', phoneNumber)
        .eq('phone_verified', true);

      if (error) throw error;
      return !data || data.length === 0;
    } catch (error) {
      console.error('Error checking phone number uniqueness:', error);
      return false;
    }
  }

  /**
   * Validate referral for fraud prevention
   */
  async validateReferral(referrerUserId: string, referredUserId: string, referralCode: string): Promise<FraudCheckResult> {
    try {
      const riskFactors: string[] = [];
      let riskScore = 0;

      // Get both users' device fingerprints
      const { data: referrerDevices, error: referrerError } = await supabase
        .from('device_fingerprints')
        .select('*')
        .eq('user_id', referrerUserId);

      const { data: referredDevices, error: referredError } = await supabase
        .from('device_fingerprints')
        .select('*')
        .eq('user_id', referredUserId);

      if (referrerError || referredError) {
        throw new Error('Error fetching device data');
      }

      // Check for same device usage
      if (referrerDevices && referredDevices) {
        for (const referrerDevice of referrerDevices) {
          for (const referredDevice of referredDevices) {
            if (referrerDevice.device_id === referredDevice.device_id) {
              riskScore += 80;
              riskFactors.push('Same device used for both accounts');
            }
            if (referrerDevice.ip_address === referredDevice.ip_address) {
              riskScore += 40;
              riskFactors.push('Same IP address used for both accounts');
            }
          }
        }
      }

      // Check for rapid account creation patterns
      const { data: recentReferrals, error: recentError } = await supabase
        .from('referrals')
        .select('created_at')
        .eq('referrer_id', referrerUserId)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (!recentError && recentReferrals && recentReferrals.length > 3) {
        riskScore += 60;
        riskFactors.push(`${recentReferrals.length} referrals in 24 hours`);
      }

      // Check phone verification status
      const { data: referredProfile, error: profileError } = await supabase
        .from('profiles')
        .select('phone_verified')
        .eq('id', referredUserId)
        .single();

      if (profileError || !referredProfile?.phone_verified) {
        riskScore += 30;
        riskFactors.push('Referred user phone not verified');
      }

      const isBlocked = riskScore >= 70;

      return {
        isValid: !isBlocked,
        riskScore,
        reasons: riskFactors,
        blocked: isBlocked
      };
    } catch (error) {
      console.error('Error validating referral:', error);
      return {
        isValid: false,
        riskScore: 100,
        reasons: ['System error during referral validation'],
        blocked: true
      };
    }
  }

  /**
   * Check if referred user subscribed to Elite Weekly within 24 hours
   */
  async validateSubscriptionTiming(referredUserId: string, signupTime: string): Promise<boolean> {
    try {
      const signupDate = new Date(signupTime);
      const deadline = new Date(signupDate.getTime() + 24 * 60 * 60 * 1000); // 24 hours
      const now = new Date();

      // Check if deadline has passed
      if (now > deadline) {
        return false;
      }

      // Check if user has Elite Weekly subscription
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('subscription_tier, subscription_plan, subscription_started_at')
        .eq('id', referredUserId)
        .single();

      if (error || !profile) {
        return false;
      }

      // Must be Elite tier with weekly plan
      if (profile.subscription_tier !== 'elite' || !profile.subscription_plan?.includes('weekly')) {
        return false;
      }

      // Subscription must have started within 24 hours of signup
      if (profile.subscription_started_at) {
        const subscriptionDate = new Date(profile.subscription_started_at);
        return subscriptionDate <= deadline;
      }

      return false;
    } catch (error) {
      console.error('Error validating subscription timing:', error);
      return false;
    }
  }

  /**
   * Mark device as suspicious for monitoring
   */
  async flagSuspiciousDevice(userId: string, reason: string): Promise<void> {
    try {
      await supabase
        .from('device_fingerprints')
        .update({
          status: 'suspicious',
          flagged_reason: reason,
          flagged_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      // Log the suspicious activity
      await supabase
        .from('fraud_logs')
        .insert({
          user_id: userId,
          event_type: 'suspicious_device',
          details: reason,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error flagging suspicious device:', error);
    }
  }

  /**
   * Get stored device fingerprint for comparison
   */
  async getStoredFingerprint(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('device_fingerprint');
    } catch (error) {
      console.error('Error getting stored fingerprint:', error);
      return null;
    }
  }

  /**
   * Store device fingerprint locally
   */
  async storeLocalFingerprint(fingerprint: string): Promise<void> {
    try {
      await AsyncStorage.setItem('device_fingerprint', fingerprint);
    } catch (error) {
      console.error('Error storing local fingerprint:', error);
    }
  }
}

export default FraudPreventionService;
export { DeviceFingerprint, FraudCheckResult };
