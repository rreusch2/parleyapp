import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Film, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { normalize } from '../services/device';
import { useUITheme } from '../services/uiThemeContext';

interface VideoCompletionToastProps {
  visible: boolean;
  onClose: () => void;
  onViewVideo: () => void;
}

export default function VideoCompletionToast({ visible, onClose, onViewVideo }: VideoCompletionToastProps) {
  const { theme } = useUITheme();
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: Platform.OS === 'ios' ? 60 : 40,
          useNativeDriver: true,
          friction: 8,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-dismiss after 5 seconds
      const timer = setTimeout(() => {
        hideToast();
      }, 5000);

      return () => clearTimeout(timer);
    } else {
      hideToast();
    }
  }, [visible]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: fadeAnim,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={onViewVideo}
        style={styles.touchableContainer}
      >
        <LinearGradient
          colors={['#10B981', '#059669']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
        >
          <Film size={24} color="#FFFFFF" />
          
          <View style={styles.textContainer}>
            <Text style={styles.title}>Video Ready! 🎉</Text>
            <Text style={styles.subtitle}>Tap to view your epic bet hype video</Text>
          </View>

          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              hideToast();
            }}
            style={styles.closeButton}
          >
            <X size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: normalize(16),
    right: normalize(16),
    zIndex: 9999,
  },
  touchableContainer: {
    borderRadius: normalize(16),
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: normalize(16),
  },
  textContainer: {
    flex: 1,
    marginLeft: normalize(12),
  },
  title: {
    fontSize: normalize(15),
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: normalize(2),
  },
  subtitle: {
    fontSize: normalize(12),
    color: 'rgba(255, 255, 255, 0.9)',
  },
  closeButton: {
    width: normalize(28),
    height: normalize(28),
    borderRadius: normalize(14),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: normalize(8),
  },
});

