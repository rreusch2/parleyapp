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
  screenDimensions: string;
  timezone: string;
  uniqueIdentifier: string;
}

interface FraudCheckResult {
  isValid: boolean;
  riskScore: number;
  reasons: string[];
  blocked: boolean;
  requiresPhoneVerification: boolean;
}

interface SubscriptionValidation {
  hasEliteWeekly: boolean;
  subscribedWithin24Hours: boolean;
  subscriptionStartTime: string | null;
  timeRemaining: number; // hours remaining in 24-hour window
}

class EnhancedFraudPreventionService {
  private static instance: EnhancedFraudPreventionService;

  public static getInstance(): EnhancedFraudPreventionService {
    if (!EnhancedFraudPreventionService.instance) {
      EnhancedFraudPreventionService.instance = new EnhancedFraudPreventionService();
    }
    return EnhancedFraudPreventionService.instance;
  }

  /**
   * CRITICAL: Generate unique device fingerprint to prevent self-referrals
   */
  async generateUniqueDeviceFingerprint(): Promise<DeviceFingerprint> {
    try {
      const { width, height } = Dimensions.get('screen');
      
      // Create unique identifier combining multiple device characteristics
      const deviceCharacteristics = [
        Device.osBuildId || Device.osInternalBuildId || 'unknown',
        Device.deviceName || 'unknown',
        Platform.OS,
        Device.osVersion || 'unknown',
        `${width}x${height}`,
        Device.modelName || 'unknown',
        Device.brand || 'unknown'
      ].join('|');

      // Generate hash-like unique identifier
      const uniqueIdentifier = this.generateHash(deviceCharacteristics);

      return {
        deviceId: Device.osBuildId || Device.osInternalBuildId || uniqueIdentifier,
        deviceName: Device.deviceName || 'unknown',
        deviceType: Device.deviceType?.toString() || 'unknown',
        osName: Device.osName || Platform.OS,
        osVersion: Device.osVersion || 'unknown',
        screenDimensions: `${width}x${height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
        uniqueIdentifier
      };
    } catch (error) {
      console.error('Error generating device fingerprint:', error);
      const fallbackId = `${Platform.OS}-${Date.now()}-${Math.random()}`;
      return {
        deviceId: fallbackId,
        deviceName: 'error',
        deviceType: 'error',
        osName: Platform.OS,
        osVersion: 'unknown',
        screenDimensions: 'unknown',
        timezone: 'unknown',
        uniqueIdentifier: fallbackId
      };
    }
  }

  /**
   * Simple hash function for device fingerprinting
   */
  private generateHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * CRITICAL: Check if device already has an account (1 account per device rule)
   */
  async enforceOneAccountPerDevice(fingerprint: DeviceFingerprint): Promise<FraudCheckResult> {
    try {
      const { data: existingAccounts, error } = await supabase
        .from('device_fingerprints')
        .select('user_id, created_at, profiles!inner(phone_verified)')
        .eq('unique_identifier', fingerprint.uniqueIdentifier)
        .neq('status', 'deleted');

      if (error) throw error;

      const riskFactors: string[] = [];
      let riskScore = 0;

      // STRICT: Only allow 1 account per device
      if (existingAccounts && existingAccounts.length > 0) {
        riskScore = 100; // Automatic block
        riskFactors.push(`Device already has ${existingAccounts.length} account(s) - BLOCKED`);
        
        // Log this attempt
        await this.logFraudAttempt('multiple_accounts_same_device', {
          deviceId: fingerprint.deviceId,
          uniqueIdentifier: fingerprint.uniqueIdentifier,
          existingAccounts: existingAccounts.length
        });

        return {
          isValid: false,
          riskScore: 100,
          reasons: riskFactors,
          blocked: true,
          requiresPhoneVerification: false
        };
      }

      return {
        isValid: true,
        riskScore: 0,
        reasons: [],
        blocked: false,
        requiresPhoneVerification: true // Always require phone verification
      };
    } catch (error) {
      console.error('Error checking device limit:', error);
      return {
        isValid: false,
        riskScore: 100,
        reasons: ['System error during device check'],
        blocked: true,
        requiresPhoneVerification: false
      };
    }
  }

  /**
   * CRITICAL: Validate phone number is unique and verified
   */
  async validatePhoneNumberUnique(phoneNumber: string, userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone_number', phoneNumber)
        .eq('phone_verified', true)
        .neq('id', userId);

      if (error) throw error;
      
      const isUnique = !data || data.length === 0;
      
      if (!isUnique) {
        await this.logFraudAttempt('duplicate_phone_number', {
          phoneNumber: phoneNumber.slice(-4), // Only log last 4 digits for privacy
          userId,
          existingAccounts: data?.length || 0
        });
      }

      return isUnique;
    } catch (error) {
      console.error('Error checking phone number uniqueness:', error);
      return false;
    }
  }

  /**
   * CRITICAL: AI-powered referral validation to prevent self-referrals
   */
  async validateReferralWithAI(referrerUserId: string, referredUserId: string): Promise<FraudCheckResult> {
    try {
      const riskFactors: string[] = [];
      let riskScore = 0;

      // Get device fingerprints for both users
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

      // CRITICAL: Check for same device (automatic block)
      if (referrerDevices && referredDevices) {
        for (const referrerDevice of referrerDevices) {
          for (const referredDevice of referredDevices) {
            if (referrerDevice.unique_identifier === referredDevice.unique_identifier) {
              riskScore = 100; // Automatic block
              riskFactors.push('SAME DEVICE DETECTED - Self-referral blocked');
              
              await this.logFraudAttempt('self_referral_same_device', {
                referrerUserId,
                referredUserId,
                deviceId: referrerDevice.device_id
              });
            }
          }
        }
      }

      // Check for rapid referral patterns (AI detection)
      const { data: recentReferrals, error: recentError } = await supabase
        .from('referrals')
        .select('created_at, referred_user_id')
        .eq('referrer_id', referrerUserId)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (!recentError && recentReferrals && recentReferrals.length > 2) {
        riskScore += 70;
        riskFactors.push(`Suspicious: ${recentReferrals.length} referrals in 24 hours`);
      }

      // Check account creation timing patterns
      const { data: referrerProfile, error: refProfileError } = await supabase
        .from('profiles')
        .select('created_at')
        .eq('id', referrerUserId)
        .single();

      const { data: referredProfile, error: refedProfileError } = await supabase
        .from('profiles')
        .select('created_at')
        .eq('id', referredUserId)
        .single();

      if (!refProfileError && !refedProfileError && referrerProfile && referredProfile) {
        const timeDiff = new Date(referredProfile.created_at).getTime() - new Date(referrerProfile.created_at).getTime();
        const minutesDiff = timeDiff / (1000 * 60);
        
        // Suspicious if accounts created very close together
        if (minutesDiff < 10) {
          riskScore += 60;
          riskFactors.push('Accounts created within 10 minutes - suspicious timing');
        }
      }

      const isBlocked = riskScore >= 70;

      if (isBlocked) {
        await this.logFraudAttempt('ai_referral_validation_failed', {
          referrerUserId,
          referredUserId,
          riskScore,
          reasons: riskFactors
        });
      }

      return {
        isValid: !isBlocked,
        riskScore,
        reasons: riskFactors,
        blocked: isBlocked,
        requiresPhoneVerification: true
      };
    } catch (error) {
      console.error('Error validating referral with AI:', error);
      return {
        isValid: false,
        riskScore: 100,
        reasons: ['System error during AI validation'],
        blocked: true,
        requiresPhoneVerification: false
      };
    }
  }

  /**
   * CRITICAL: Validate Elite Weekly subscription within 24 hours
   */
  async validateEliteWeeklySubscription(referredUserId: string, signupTime: string): Promise<SubscriptionValidation> {
    try {
      const signupDate = new Date(signupTime);
      const deadline = new Date(signupDate.getTime() + 24 * 60 * 60 * 1000); // 24 hours
      const now = new Date();
      const timeRemaining = Math.max(0, (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)); // hours

      // Get user's current subscription
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('subscription_tier, subscription_plan, subscription_started_at')
        .eq('id', referredUserId)
        .single();

      if (error || !profile) {
        return {
          hasEliteWeekly: false,
          subscribedWithin24Hours: false,
          subscriptionStartTime: null,
          timeRemaining
        };
      }

      // Check if user has Elite Weekly subscription
      const hasEliteWeekly = profile.subscription_tier === 'elite' && 
                            profile.subscription_plan?.includes('weekly');

      let subscribedWithin24Hours = false;
      if (hasEliteWeekly && profile.subscription_started_at) {
        const subscriptionDate = new Date(profile.subscription_started_at);
        subscribedWithin24Hours = subscriptionDate >= signupDate && subscriptionDate <= deadline;
      }

      return {
        hasEliteWeekly,
        subscribedWithin24Hours,
        subscriptionStartTime: profile.subscription_started_at,
        timeRemaining
      };
    } catch (error) {
      console.error('Error validating Elite Weekly subscription:', error);
      return {
        hasEliteWeekly: false,
        subscribedWithin24Hours: false,
        subscriptionStartTime: null,
        timeRemaining: 0
      };
    }
  }

  /**
   * CRITICAL: Process referral with all fraud prevention checks
   */
  async processSecureReferral(referrerUserId: string, referredUserId: string, referralCode: string): Promise<{
    success: boolean;
    pointsAwarded: number;
    message: string;
    requiresSubscription: boolean;
    subscriptionDeadline?: string;
  }> {
    try {
      // Step 1: AI validation to prevent self-referrals
      const aiValidation = await this.validateReferralWithAI(referrerUserId, referredUserId);
      if (!aiValidation.isValid) {
        return {
          success: false,
          pointsAwarded: 0,
          message: `Referral blocked: ${aiValidation.reasons.join(', ')}`,
          requiresSubscription: false
        };
      }

      // Step 2: Phone verification check
      const { data: referredProfile, error: profileError } = await supabase
        .from('profiles')
        .select('phone_verified, created_at')
        .eq('id', referredUserId)
        .single();

      if (profileError || !referredProfile?.phone_verified) {
        return {
          success: false,
          pointsAwarded: 0,
          message: 'Referral requires phone verification',
          requiresSubscription: false
        };
      }

      // Step 3: Award initial points to referred user (2,500 points = $25)
      const { error: pointsError } = await supabase
        .from('profiles')
        .update({ 
          referral_points: 2500,
          referral_points_lifetime: 2500
        })
        .eq('id', referredUserId);

      if (pointsError) throw pointsError;

      // Step 4: Create referral record with 24-hour subscription requirement
      const signupTime = referredProfile.created_at;
      const deadline = new Date(new Date(signupTime).getTime() + 24 * 60 * 60 * 1000);

      const { error: referralError } = await supabase
        .from('referrals')
        .insert({
          referrer_id: referrerUserId,
          referred_user_id: referredUserId,
          referral_code: referralCode,
          points_awarded_to_referred: 2500,
          subscription_deadline: deadline.toISOString(),
          status: 'pending_subscription',
          created_at: new Date().toISOString()
        });

      if (referralError) throw referralError;

      // Log successful referral
      await this.logFraudAttempt('successful_referral', {
        referrerUserId,
        referredUserId,
        pointsAwarded: 2500,
        subscriptionDeadline: deadline.toISOString()
      });

      return {
        success: true,
        pointsAwarded: 2500,
        message: 'Welcome! You received 2,500 points ($25). Get Elite Weekly within 24 hours to help your referrer earn 5,000 points!',
        requiresSubscription: true,
        subscriptionDeadline: deadline.toISOString()
      };
    } catch (error) {
      console.error('Error processing secure referral:', error);
      return {
        success: false,
        pointsAwarded: 0,
        message: 'Error processing referral',
        requiresSubscription: false
      };
    }
  }

  /**
   * Check and award referrer points when referred user subscribes to Elite Weekly
   */
  async checkAndAwardReferrerPoints(subscribedUserId: string): Promise<boolean> {
    try {
      // Find pending referral for this user
      const { data: referral, error: referralError } = await supabase
        .from('referrals')
        .select('*')
        .eq('referred_user_id', subscribedUserId)
        .eq('status', 'pending_subscription')
        .single();

      if (referralError || !referral) {
        return false;
      }

      // Validate Elite Weekly subscription timing
      const subscriptionValidation = await this.validateEliteWeeklySubscription(
        subscribedUserId, 
        referral.created_at
      );

      if (!subscriptionValidation.hasEliteWeekly || !subscriptionValidation.subscribedWithin24Hours) {
        // Mark referral as failed
        await supabase
          .from('referrals')
          .update({ status: 'failed_subscription_requirement' })
          .eq('id', referral.id);
        
        return false;
      }

      // Award 5,000 points to referrer
      const { data: referrerProfile, error: referrerError } = await supabase
        .from('profiles')
        .select('referral_points, referral_points_lifetime')
        .eq('id', referral.referrer_id)
        .single();

      if (referrerError || !referrerProfile) {
        return false;
      }

      const newPoints = (referrerProfile.referral_points || 0) + 5000;
      const newLifetimePoints = (referrerProfile.referral_points_lifetime || 0) + 5000;

      await supabase
        .from('profiles')
        .update({
          referral_points: newPoints,
          referral_points_lifetime: newLifetimePoints
        })
        .eq('id', referral.referrer_id);

      // Mark referral as completed
      await supabase
        .from('referrals')
        .update({ 
          status: 'completed',
          points_awarded_to_referrer: 5000,
          points_awarded_at: new Date().toISOString()
        })
        .eq('id', referral.id);

      return true;
    } catch (error) {
      console.error('Error awarding referrer points:', error);
      return false;
    }
  }

  /**
   * Log fraud attempts for monitoring
   */
  private async logFraudAttempt(eventType: string, details: any): Promise<void> {
    try {
      await supabase
        .from('fraud_logs')
        .insert({
          event_type: eventType,
          details: JSON.stringify(details),
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error logging fraud attempt:', error);
    }
  }
}

export default EnhancedFraudPreventionService;
export { DeviceFingerprint, FraudCheckResult, SubscriptionValidation };
