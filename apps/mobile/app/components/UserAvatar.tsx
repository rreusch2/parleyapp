import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, Platform } from 'react-native';
import { SvgXml } from 'react-native-svg';
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
  const [webFallbackSrc, setWebFallbackSrc] = useState<string | null>(null);
  const [svgXml, setSvgXml] = useState<string | null>(null);

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

  // Fetch SVG for Multiavatar so we can render reliably across platforms
  useEffect(() => {
    (async () => {
      try {
        if (avatarUrl && avatarUrl.includes('api.multiavatar.com')) {
          const svgUrl = avatarUrl.endsWith('.svg') ? avatarUrl : avatarUrl.replace('.png', '.svg');
          const res = await fetch(svgUrl);
          const xml = await res.text();
          setSvgXml(xml);
          setImageError(false);
        } else {
          setSvgXml(null);
        }
      } catch {
        // Ignore; will fallback to Image/initials
      }
    })();
  }, [avatarUrl]);

  const initials = avatarService.getUserInitials(username, email);
  const isEmojiAvatar = !!avatarUrl && avatarUrl.startsWith('emoji:');
  const emojiChar = isEmojiAvatar ? avatarUrl!.replace('emoji:', '') : '';
  const shouldShowImage = !!avatarUrl && !imageError && !isEmojiAvatar;

  const AvatarContent = () => {
    // Emoji avatar: render emoji centered on gradient
    if (isEmojiAvatar) {
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
              fontSize: size * 0.55,
              textAlign: 'center',
            }}
          >
            {emojiChar}
          </Text>
        </LinearGradient>
      );
    }

    // Prefer SVG render for Multiavatar if available
    if (svgXml) {
      return (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            overflow: 'hidden',
            backgroundColor: '#0A0A0A'
          }}
        >
          <SvgXml xml={svgXml} width={size} height={size} />
        </View>
      );
    }

    if (shouldShowImage) {
      const src = webFallbackSrc || avatarUrl!;
      return (
        <Image
          source={{ uri: src }}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
          }}
          onError={() => {
            // On web, try SVG fallback for Multiavatar if PNG fails
            if (
              Platform.OS === 'web' &&
              avatarUrl &&
              avatarUrl.includes('api.multiavatar.com') &&
              avatarUrl.endsWith('.png') &&
              !webFallbackSrc
            ) {
              setWebFallbackSrc(avatarUrl.replace('.png', '.svg'));
              return;
            }
            setImageError(true);
          }}
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
