import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, View, StyleSheet, Animated } from 'react-native';
import { Heart } from 'lucide-react-native';
import { supabase } from '../services/api/supabaseClient';

interface PickLikeButtonProps {
  predictionId: string;
  initialLikes?: number;
  onLikeChange?: (liked: boolean, newCount: number) => void;
  size?: 'small' | 'medium' | 'large';
  showCount?: boolean;
}

export default function PickLikeButton({
  predictionId,
  initialLikes = 0,
  onLikeChange,
  size = 'medium',
  showCount = true
}: PickLikeButtonProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(initialLikes);
  const [isLoading, setIsLoading] = useState(false);
  const [scaleAnim] = useState(new Animated.Value(1));

  const sizeConfig = {
    small: { iconSize: 16, fontSize: 12 },
    medium: { iconSize: 20, fontSize: 14 },
    large: { iconSize: 24, fontSize: 16 }
  };

  const config = sizeConfig[size];

  useEffect(() => {
    checkIfLiked();
    fetchLikeCount();
  }, [predictionId]);

  const checkIfLiked = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('pick_likes')
        .select('id')
        .eq('prediction_id', predictionId)
        .eq('user_id', user.id)
        .single();

      if (!error && data) {
        setIsLiked(true);
      }
    } catch (error) {
      // User hasn't liked this pick
      setIsLiked(false);
    }
  };

  const fetchLikeCount = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_predictions')
        .select('like_count')
        .eq('id', predictionId)
        .single();

      if (!error && data) {
        setLikeCount(data.like_count || 0);
      }
    } catch (error) {
      console.error('Error fetching like count:', error);
    }
  };

  const handleLike = async () => {
    if (isLoading) return;

    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // Prompt user to sign in
        alert('Please sign in to like picks');
        return;
      }

      // Animate button
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.3,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();

      if (isLiked) {
        // Unlike
        const { error } = await supabase
          .from('pick_likes')
          .delete()
          .eq('prediction_id', predictionId)
          .eq('user_id', user.id);

        if (!error) {
          setIsLiked(false);
          const newCount = Math.max(0, likeCount - 1);
          setLikeCount(newCount);
          onLikeChange?.(false, newCount);
        }
      } else {
        // Like
        const { error } = await supabase
          .from('pick_likes')
          .insert({
            prediction_id: predictionId,
            user_id: user.id
          });

        if (!error) {
          setIsLiked(true);
          const newCount = likeCount + 1;
          setLikeCount(newCount);
          onLikeChange?.(true, newCount);
        }
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TouchableOpacity
      onPress={handleLike}
      disabled={isLoading}
      style={[
        styles.container,
        isLiked && styles.likedContainer
      ]}
      activeOpacity={0.7}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Heart
          size={config.iconSize}
          color={isLiked ? "#EF4444" : "#64748B"}
          fill={isLiked ? "#EF4444" : "transparent"}
          strokeWidth={2}
        />
      </Animated.View>
      
      {showCount && likeCount > 0 && (
        <Text style={[
          styles.likeCount,
          { fontSize: config.fontSize },
          isLiked && styles.likedText
        ]}>
          {likeCount}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  likedContainer: {
    backgroundColor: '#1E1E2E',
    borderColor: '#EF444433',
  },
  likeCount: {
    marginLeft: 4,
    fontWeight: '600',
    color: '#94A3B8',
  },
  likedText: {
    color: '#EF4444',
  },
});
