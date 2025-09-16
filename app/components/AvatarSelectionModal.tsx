import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { avatarService } from '../services/avatarService';

interface AvatarSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onAvatarSelected: (avatarUrl: string) => void;
  userId: string;
  currentAvatarUrl?: string | null;
  username?: string;
  email?: string;
}

export const AvatarSelectionModal: React.FC<AvatarSelectionModalProps> = ({
  visible,
  onClose,
  onAvatarSelected,
  userId,
  currentAvatarUrl,
  username,
  email,
}) => {
  const [loading, setLoading] = useState<string | null>(null);

  // Simple sports emoji options (lightweight selection)
  const EMOJI_AVATARS = ['⚾️', '🏀', '🏈', '⚽️', '🎯', '🎲', '🏆', '💰', '📈', '🧠'];

  // Category tabs removed per design update – using emoji options instead

  // Preset image grid removed – only personalized and emoji options remain

  // Custom upload removed for now per request

  const handleEmojiSelection = async (emoji: string) => {
    try {
      setLoading(`emoji_${emoji}`);
      const emojiValue = `emoji:${emoji}`;
      // Save to DB like a preset so it persists
      await avatarService.updateUserAvatar(userId, emojiValue);
      onAvatarSelected(emojiValue);
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to set emoji avatar. Please try again.');
      console.error('Error setting emoji avatar:', error);
    } finally {
      setLoading(null);
    }
  };

  const handlePersonalizedAvatar = async () => {
    try {
      setLoading('personalized');
      // Create a unique, encoded Multiavatar URL from user data
      const personalizedUrl = await avatarService.generatePersonalizedAvatar(userId, username, email);

      // Best-effort prefetch so the image appears instantly when modal closes
      try {
        // @ts-ignore - prefetch exists on RN Image
        await Image.prefetch?.(personalizedUrl);
      } catch {}

      // Persist to profile (DB) so it survives reloads
      await avatarService.updateUserAvatar(userId, personalizedUrl);

      // Update UI immediately and close modal
      onAvatarSelected(personalizedUrl);
      onClose();

      // Friendly confirmation
      Alert.alert('Avatar Updated', 'Your personal avatar has been set!');
    } catch (error) {
      Alert.alert('Error', 'Failed to create personalized avatar. Please try again.');
      console.error('Error creating personalized avatar:', error);
    } finally {
      setLoading(null);
    }
  };

  // We no longer filter by categories; emojis are now the primary quick-pick options

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
        {/* Header */}
        <LinearGradient
          colors={['#1A1A2E', '#16213E']}
          style={{
            paddingTop: 60,
            paddingHorizontal: 20,
            paddingBottom: 20,
          }}
        >
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <Text style={{
              fontSize: 24,
              fontWeight: 'bold',
              color: '#FFFFFF',
            }}>
              Choose Avatar
            </Text>
            <TouchableOpacity
              onPress={onClose}
              style={{
                padding: 8,
                borderRadius: 20,
                backgroundColor: 'rgba(255,255,255,0.1)',
              }}
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {/* Personalized + Emoji Avatar Options */}
          <View style={{ padding: 20 }}>
            {/* Personalized Avatar Button - COOL NEW FEATURE! */}
            <TouchableOpacity
              onPress={handlePersonalizedAvatar}
              disabled={loading === 'personalized'}
              style={{
                backgroundColor: '#8B5CF6',
                paddingVertical: 12,
                paddingHorizontal: 20,
                borderRadius: 8,
                alignItems: 'center',
                marginTop: 20,
                borderWidth: 2,
                borderColor: '#A78BFA',
              }}
            >
              {loading === 'personalized' ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="sparkles-outline" size={20} color="#FFFFFF" style={{ marginBottom: 4 }} />
                  <Text style={{
                    color: '#FFFFFF',
                    fontSize: 16,
                    fontWeight: '600',
                  }}>
                    🎨 Create My Personal Avatar
                  </Text>
                  <Text style={{
                    color: '#E0E7FF',
                    fontSize: 12,
                    marginTop: 2,
                  }}>
                    AI-generated just for you!
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={{
              color: '#8E8E93',
              fontSize: 14,
              textAlign: 'center',
              marginTop: 20,
              lineHeight: 20,
            }}>
              Generate a unique avatar based on your username or pick a sports emoji below
            </Text>

            {/* Emoji Grid */}
            <View style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              marginTop: 12,
            }}>
              {EMOJI_AVATARS.map((emoji) => {
                const isLoading = loading === `emoji_${emoji}`;
                const isSelected = currentAvatarUrl === `emoji:${emoji}`;
                return (
                  <TouchableOpacity
                    key={emoji}
                    onPress={() => handleEmojiSelection(emoji)}
                    disabled={isLoading}
                    style={{
                      width: '22%',
                      aspectRatio: 1,
                      marginBottom: 16,
                      borderRadius: 16,
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: isSelected ? 2 : 0,
                      borderColor: isSelected ? '#2E86AB' : 'transparent',
                      position: 'relative',
                    }}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#2E86AB" size="small" />
                    ) : (
                      <Text style={{ fontSize: 28 }}>{emoji}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Removed image-based preset grid for a cleaner, emoji-focused UI */}

            <Text style={{
              color: '#8E8E93',
              fontSize: 14,
              textAlign: 'center',
              marginTop: 20,
              lineHeight: 20,
            }}>
              Tip: You can change your avatar anytime.
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};
