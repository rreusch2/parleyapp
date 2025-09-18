import { supabase } from './api/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { revenueCatService } from './revenueCatService';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://zooming-rebirth-production-a305.up.railway.app';

export interface DayPassResult {
  success: boolean;
  tier?: 'pro' | 'elite';
  expiresAt?: string;
  error?: string;
}

class DayPassService {
  /**
   * Purchase and activate a day pass (Pro or Elite)
   */
  async purchaseDayPass(userId: string, productId: string, tier: 'pro' | 'elite'): Promise<DayPassResult> {
    try {
      console.log(`🎯 Starting ${tier} day pass purchase for user:`, userId);
      
      // Initialize RevenueCat
      await revenueCatService.initialize();
      
      // Purchase through RevenueCat
      const purchaseResult = await revenueCatService.purchasePackage(productId as any);
      
      if (!purchaseResult.success) {
        console.log('❌ Purchase failed or cancelled');
        return {
          success: false,
          error: purchaseResult.error || 'Purchase cancelled'
        };
      }
      
      console.log('✅ Purchase successful, activating day pass on backend...');
      
      // Get the receipt data
      const receiptData = purchaseResult.receipt;
      const transactionId = purchaseResult.transactionId;
      
      // Activate on backend
      const activationResult = await this.activateDayPass(userId, productId, tier, receiptData, transactionId);
      
      if (activationResult.success) {
        // Store in AsyncStorage for quick access
        await AsyncStorage.setItem('dayPassActive', 'true');
        await AsyncStorage.setItem('dayPassTier', tier);
        await AsyncStorage.setItem('dayPassExpiresAt', activationResult.expiresAt || '');
        
        // Clear welcome bonus since they paid
        await AsyncStorage.removeItem('welcomeBonusActive');
        await AsyncStorage.removeItem('welcomeBonusExpiresAt');
      }
      
      return activationResult;
      
    } catch (error) {
      console.error('❌ Day pass purchase error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Purchase failed'
      };
    }
  }
  
  /**
   * Activate day pass on backend (updates database)
   */
  async activateDayPass(
    userId: string, 
    productId: string, 
    tier: 'pro' | 'elite',
    receiptData?: string,
    transactionId?: string
  ): Promise<DayPassResult> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/daypass/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          productId,
          tier,
          receiptData,
          transactionId
        })
      });
      
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to activate day pass');
      }
      
      console.log('✅ Day pass activated on backend:', data);
      
      return {
        success: true,
        tier: data.tier,
        expiresAt: data.expiresAt
      };
      
    } catch (error) {
      console.error('❌ Backend activation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Activation failed'
      };
    }
  }
  
  /**
   * Check if user has an active day pass
   */
  async checkDayPassStatus(userId: string): Promise<{
    isActive: boolean;
    tier?: 'pro' | 'elite';
    expiresAt?: string;
  }> {
    try {
      const response = await fetch(`${BACKEND_URL}/api/daypass/status/${userId}`);
      const data = await response.json();
      
      if (!response.ok || !data.success) {
        return { isActive: false };
      }
      
      return {
        isActive: data.isDayPassActive,
        tier: data.dayPassTier || data.currentTier,
        expiresAt: data.expiresAt
      };
      
    } catch (error) {
      console.error('❌ Day pass status check error:', error);
      return { isActive: false };
    }
  }
  
  /**
   * Clear day pass from local storage
   */
  async clearDayPass(): Promise<void> {
    await AsyncStorage.multiRemove([
      'dayPassActive',
      'dayPassTier', 
      'dayPassExpiresAt'
    ]);
  }
  
  /**
   * Check if day pass is expired locally (quick check)
   */
  async isExpiredLocally(): Promise<boolean> {
    try {
      const expiresAt = await AsyncStorage.getItem('dayPassExpiresAt');
      if (!expiresAt) return true;
      
      return new Date(expiresAt) <= new Date();
    } catch {
      return true;
    }
  }
}

export const dayPassService = new DayPassService();
