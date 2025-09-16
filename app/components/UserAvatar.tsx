import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { avatarService } from '../services/avatarService';

interface UserAvatarProps {
  userId?: string;
  username?: string;
  email?: string;
  avatarUrl?: string | null;
  size?: number;
  onPress?: () => void;
  showBorder?: boolean;
  borderColor?: string;
  gradientColors?: readonly [string, string, ...string[]];
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  userId,
  username,
  email,
  avatarUrl: propAvatarUrl,
  size = 40,
  onPress,
  showBorder = false,
  borderColor = '#2E86AB',
  gradientColors = ['#2E86AB', '#A23B72'],
}) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(propAvatarUrl || null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    // If no avatar URL provided but we have userId, fetch it
    if (!propAvatarUrl && userId) {
      avatarService.getUserAvatar(userId).then(url => {
        if (url) {
          setAvatarUrl(url);
        }
      });
    } else {
      setAvatarUrl(propAvatarUrl || null);
      setImageError(false);
    }
  }, [propAvatarUrl, userId]);

  const initials = avatarService.getUserInitials(username, email);
  const shouldShowImage = avatarUrl && !imageError;

  const AvatarContent = () => {
    if (shouldShowImage) {
      return (
        <Image
          source={{ uri: avatarUrl }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
          }}
          onError={() => setImageError(true)}
          resizeMode="cover"
        />
      );
    }

    // Fallback to initials with gradient background
    return (
      <LinearGradient
        colors={gradientColors}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: size * 0.4,
            fontWeight: 'bold',
            textAlign: 'center',
          }}
        >
          {initials}
        </Text>
      </LinearGradient>
    );
  };

  const avatar = (
    <View
      style={{
        width: size + (showBorder ? 4 : 0),
        height: size + (showBorder ? 4 : 0),
        borderRadius: (size + (showBorder ? 4 : 0)) / 2,
        borderWidth: showBorder ? 2 : 0,
        borderColor: showBorder ? borderColor : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <AvatarContent />
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {avatar}
      </TouchableOpacity>
    );
  }

  return avatar;
};
