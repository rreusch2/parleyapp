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
import { avatarService, PRESET_AVATARS, PresetAvatar } from '../services/avatarService';

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
  const [selectedCategory, setSelectedCategory] = useState<string>('sports');
  const [loading, setLoading] = useState<string | null>(null);

  const categories = [
    { id: 'sports', name: 'Sports', icon: 'basketball-outline' },
    { id: 'professional', name: 'Pro', icon: 'briefcase-outline' },
    { id: 'gaming', name: 'Gaming', icon: 'game-controller-outline' },
    { id: 'mystical', name: 'Mystical', icon: 'eye-outline' },
  ];

  const handlePresetSelection = async (preset: PresetAvatar) => {
    try {
      setLoading(preset.id);
      await avatarService.setPresetAvatar(userId, preset);
      onAvatarSelected(preset.url);
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to set avatar. Please try again.');
      console.error('Error setting preset avatar:', error);
    } finally {
      setLoading(null);
    }
  };

  const handleCustomUpload = async () => {
    try {
      setLoading('custom');
      const newAvatarUrl = await avatarService.setCustomAvatar(userId);
      onAvatarSelected(newAvatarUrl);
      onClose();
    } catch (error) {
      if (error instanceof Error && error.message === 'No image selected') {
        return; // User cancelled
      }
      Alert.alert('Error', 'Failed to upload custom avatar. Please try again.');
      console.error('Error uploading custom avatar:', error);
    } finally {
      setLoading(null);
    }
  };

  const handlePersonalizedAvatar = async () => {
    try {
      setLoading('personalized');
      const personalizedUrl = await avatarService.generatePersonalizedAvatar(userId, username, email);
      
      // Set as preset avatar (saves to database)
      const personalizedPreset: PresetAvatar = {
        id: 'personalized_' + userId,
        name: 'My Personal Avatar',
        url: personalizedUrl,
        category: 'personal'
      };
      
      await avatarService.setPresetAvatar(userId, personalizedPreset);
      onAvatarSelected(personalizedUrl);
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to create personalized avatar. Please try again.');
      console.error('Error creating personalized avatar:', error);
    } finally {
      setLoading(null);
    }
  };

  const filteredAvatars = PRESET_AVATARS.filter(avatar => avatar.category === selectedCategory);

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
          {/* Custom Upload Button */}
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

            <TouchableOpacity
              onPress={handleCustomUpload}
              disabled={loading === 'custom'}
              style={{
                backgroundColor: '#2E86AB',
                paddingVertical: 12,
                paddingHorizontal: 20,
                borderRadius: 8,
                alignItems: 'center',
                marginTop: 12,
              }}
            >
              {loading === 'custom' ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Ionicons name="camera-outline" size={20} color="#FFFFFF" style={{ marginBottom: 4 }} />
                  <Text style={{
                    color: '#FFFFFF',
                    fontSize: 16,
                    fontWeight: '600',
                  }}>
                    Upload Custom Photo
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
              Generate a unique avatar based on your username, choose from presets, or upload your own photo
            </Text>

            {/* Category Tabs */}
            <View style={{
              flexDirection: 'row',
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderRadius: 12,
              padding: 4,
              marginBottom: 20,
            }}>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  onPress={() => setSelectedCategory(category.id)}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 8,
                    backgroundColor: selectedCategory === category.id ? '#2E86AB' : 'transparent',
                    alignItems: 'center',
                  }}
                >
                  <Ionicons
                    name={category.icon as any}
                    size={20}
                    color={selectedCategory === category.id ? '#FFFFFF' : '#8E8E93'}
                  />
                  <Text style={{
                    color: selectedCategory === category.id ? '#FFFFFF' : '#8E8E93',
                    fontSize: 12,
                    fontWeight: '500',
                    marginTop: 4,
                  }}>
                    {category.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Avatar Grid */}
            <View style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
            }}>
              {filteredAvatars.map((avatar) => {
                const isSelected = currentAvatarUrl === avatar.url;
                const isLoading = loading === avatar.id;

                return (
                  <TouchableOpacity
                    key={avatar.id}
                    onPress={() => handlePresetSelection(avatar)}
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
                      <>
                        <Image
                          source={{ uri: avatar.url }}
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 24,
                          }}
                          resizeMode="contain"
                        />
                        {isSelected && (
                          <View style={{
                            position: 'absolute',
                            top: -2,
                            right: -2,
                            backgroundColor: '#2E86AB',
                            borderRadius: 10,
                            width: 20,
                            height: 20,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                          </View>
                        )}
                      </>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={{
              color: '#8E8E93',
              fontSize: 14,
              textAlign: 'center',
              marginTop: 20,
              lineHeight: 20,
            }}>
              Choose from our preset avatars or upload your own photo from your camera roll
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};
