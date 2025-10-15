import * as ImagePicker from 'expo-image-picker';
import { supabase } from './api/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PresetAvatar {
  id: string;
  name: string;
  url: string;
  category: string;
}

// Multiavatar preset options - 12 billion unique possibilities!
export const PRESET_AVATARS: PresetAvatar[] = [
  // Sports Legends - Using themed seed strings (URLs encoded)
  { id: 'multi_babe_ruth', name: 'The Babe', url: 'https://api.multiavatar.com/Babe%20Ruth.png', category: 'sports' },
  { id: 'multi_jordan', name: 'Air Jordan', url: 'https://api.multiavatar.com/Michael%20Jordan.png', category: 'sports' },
  { id: 'multi_brady', name: 'The GOAT', url: 'https://api.multiavatar.com/Tom%20Brady.png', category: 'sports' },
  { id: 'multi_champion', name: 'Champion', url: 'https://api.multiavatar.com/Sports%20Champion.png', category: 'sports' },
  
  // Professional Personas
  { id: 'multi_analyst', name: 'The Analyst', url: 'https://api.multiavatar.com/Data%20Analyst%20Pro.png', category: 'professional' },
  { id: 'multi_strategist', name: 'Strategist', url: 'https://api.multiavatar.com/Master%20Strategist.png', category: 'professional' },
  { id: 'multi_expert', name: 'Expert', url: 'https://api.multiavatar.com/Sports%20Expert.png', category: 'professional' },
  { id: 'multi_consultant', name: 'Consultant', url: 'https://api.multiavatar.com/Pro%20Consultant.png', category: 'professional' },
  
  // Gaming/Betting Theme
  { id: 'multi_shark', name: 'Card Shark', url: 'https://api.multiavatar.com/Card%20Shark%20Pro.png', category: 'gaming' },
  { id: 'multi_roller', name: 'High Roller', url: 'https://api.multiavatar.com/High%20Roller%20VIP.png', category: 'gaming' },
  { id: 'multi_ace', name: 'Lucky Ace', url: 'https://api.multiavatar.com/Lucky%20Ace%20Winner.png', category: 'gaming' },
  { id: 'multi_winner', name: 'Big Winner', url: 'https://api.multiavatar.com/Big%20Winner%20Pro.png', category: 'gaming' },
  
  // Unique Characters
  { id: 'multi_prophet', name: 'The Prophet', url: 'https://api.multiavatar.com/Sports%20Prophet.png', category: 'mystical' },
  { id: 'multi_oracle', name: 'Oracle', url: 'https://api.multiavatar.com/Betting%20Oracle.png', category: 'mystical' },
  { id: 'multi_legend', name: 'Legend', url: 'https://api.multiavatar.com/ParleyApp%20Legend.png', category: 'mystical' },
  { id: 'multi_sage', name: 'Sage', url: 'https://api.multiavatar.com/Wise%20Sage%20Pro.png', category: 'mystical' },
];

export class AvatarService {
  private static instance: AvatarService;
  
  public static getInstance(): AvatarService {
    if (!AvatarService.instance) {
      AvatarService.instance = new AvatarService();
    }
    return AvatarService.instance;
  }

  /**
   * Generate a personalized Multiavatar based on user data
   */
  public async generatePersonalizedAvatar(userId: string, username?: string, email?: string): Promise<string> {
    try {
      // Create unique seed from user data
      const seed = username || email?.split('@')[0] || userId;
      const personalizedSeed = `${seed} ParleyApp Pro Sports Betting`;
      
      // Generate personalized Multiavatar URL
      const personalizedUrl = `https://api.multiavatar.com/${encodeURIComponent(personalizedSeed)}.png`;
      
      // Cache the personalized avatar
      await AsyncStorage.setItem(`personalized_avatar_${userId}`, personalizedUrl);
      
      return personalizedUrl;
    } catch (error) {
      console.error('Error generating personalized avatar:', error);
      throw new Error('Failed to generate personalized avatar');
    }
  }

  /**
   * Get cached personalized avatar or generate new one
   */
  public async getOrCreatePersonalizedAvatar(userId: string, username?: string, email?: string): Promise<string> {
    try {
      const cached = await AsyncStorage.getItem(`personalized_avatar_${userId}`);
      if (cached) {
        return cached;
      }
      return await this.generatePersonalizedAvatar(userId, username, email);
    } catch (error) {
      console.error('Error getting personalized avatar:', error);
      // Fallback to a generic personalized avatar
      return `https://api.multiavatar.com/${encodeURIComponent(userId + ' ParleyApp')}.png`;
    }
  }

  /**
   * Request camera roll permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    }
  }

  /**
   * Pick image from camera roll
   */
  async pickImageFromCameraRoll(): Promise<string | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Camera roll permission denied');
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1], // Square aspect ratio
        quality: 0.8,
        base64: false,
      });

      if (result.canceled) {
        return null;
      }

      return result.assets[0].uri;
    } catch (error) {
      console.error('Error picking image:', error);
      throw error;
    }
  }

  /**
   * Upload image to Supabase Storage
   */
  async uploadAvatar(userId: string, imageUri: string): Promise<string> {
    try {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      
      const fileExt = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `avatar-${userId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { data, error } = await supabase.storage
        .from('user-avatars')
        .upload(filePath, blob, {
          cacheControl: '3600',
          upsert: true,
        });

      if (error) {
        console.error('Upload error:', error);
        throw error;
      }

      // Get public URL
      const { data: publicUrl } = supabase.storage
        .from('user-avatars')
        .getPublicUrl(filePath);

      return publicUrl.publicUrl;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      throw error;
    }
  }

  /**
   * Update user's avatar URL in database
   */
  async updateUserAvatar(userId: string, avatarUrl: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        console.error('Database update error:', error);
        throw error;
      }

      // Cache the new avatar URL locally
      await AsyncStorage.setItem(`avatar_${userId}`, avatarUrl);
    } catch (error) {
      console.error('Error updating user avatar:', error);
      throw error;
    }
  }

  /**
   * Get user's current avatar URL
   */
  async getUserAvatar(userId: string): Promise<string | null> {
    try {
      // Try cache first
      const cached = await AsyncStorage.getItem(`avatar_${userId}`);
      if (cached) {
        return cached;
      }

      // Fetch from database
      const { data, error } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching avatar:', error);
        return null;
      }

      const avatarUrl = data?.avatar_url;
      if (avatarUrl) {
        // Cache it
        await AsyncStorage.setItem(`avatar_${userId}`, avatarUrl);
      }

      return avatarUrl;
    } catch (error) {
      console.error('Error getting user avatar:', error);
      return null;
    }
  }

  /**
   * Delete old avatar from storage when updating
   */
  async deleteOldAvatar(avatarUrl: string): Promise<void> {
    try {
      if (!avatarUrl.includes('user-avatars/avatars/')) {
        return; // Skip preset avatars or external URLs
      }

      const path = avatarUrl.split('/user-avatars/')[1];
      if (path) {
        await supabase.storage
          .from('user-avatars')
          .remove([path]);
      }
    } catch (error) {
      console.error('Error deleting old avatar:', error);
      // Don't throw - this is cleanup
    }
  }

  /**
   * Set preset avatar
   */
  async setPresetAvatar(userId: string, presetAvatar: PresetAvatar): Promise<void> {
    try {
      await this.updateUserAvatar(userId, presetAvatar.url);
    } catch (error) {
      console.error('Error setting preset avatar:', error);
      throw error;
    }
  }

  /**
   * Upload custom avatar from camera roll
   */
  async setCustomAvatar(userId: string): Promise<string> {
    try {
      const imageUri = await this.pickImageFromCameraRoll();
      if (!imageUri) {
        throw new Error('No image selected');
      }

      // Get current avatar to delete old one
      const currentAvatar = await this.getUserAvatar(userId);
      
      // Upload new avatar
      const newAvatarUrl = await this.uploadAvatar(userId, imageUri);
      
      // Update database
      await this.updateUserAvatar(userId, newAvatarUrl);
      
      // Delete old avatar if it was custom uploaded
      if (currentAvatar) {
        await this.deleteOldAvatar(currentAvatar);
      }

      return newAvatarUrl;
    } catch (error) {
      console.error('Error setting custom avatar:', error);
      throw error;
    }
  }

  /**
   * Get user initials fallback
   */
  getUserInitials(username?: string, email?: string): string {
    if (username && username.length >= 2) {
      return username.substring(0, 2).toUpperCase();
    }
    if (email && email.length >= 2) {
      return email.substring(0, 2).toUpperCase();
    }
    return 'PP'; // Predictive Play fallback
  }
}

export const avatarService = AvatarService.getInstance();
