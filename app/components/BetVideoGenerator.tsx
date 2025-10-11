import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Video, Film, Sparkles, Crown, X, Check, Loader } from 'lucide-react-native';
import { normalize } from '../services/device';
import { useSubscription } from '../services/subscriptionContext';
import { useUITheme } from '../services/uiThemeContext';
import { supabase } from '../services/api/supabaseClient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface BetVideoGeneratorProps {
  pickIds?: string[]; // Optional: specific picks to include
  onVideoGenerated?: (videoUrl: string) => void;
}

export default function BetVideoGenerator({ pickIds, onVideoGenerated }: BetVideoGeneratorProps) {
  const { isPro, isElite, openSubscriptionModal } = useSubscription();
  const { theme } = useUITheme();
  
  const [modalVisible, setModalVisible] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [usage, setUsage] = useState({ used: 0, remaining: 0, limit: 0 });
  
  // Animations
  const [pulseAnim] = useState(new Animated.Value(1));
  const [rotateAnim] = useState(new Animated.Value(0));
  const [particleAnims] = useState(
    Array.from({ length: 20 }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
    }))
  );

  useEffect(() => {
    fetchUsage();
  }, []);

  useEffect(() => {
    if (generating) {
      startLoadingAnimations();
    } else {
      stopLoadingAnimations();
    }
  }, [generating]);

  const fetchUsage = async () => {
    try {
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) return;

      const response = await fetch(`${baseUrl}/api/sora/video-usage`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUsage({
          used: data.used,
          remaining: data.remaining,
          limit: data.dailyLimit,
        });
      }
    } catch (error) {
      console.error('Failed to fetch video usage:', error);
    }
  };

  const startLoadingAnimations = () => {
    // Pulsing logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Rotating loader
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();

    // Particle effects
    particleAnims.forEach((anim, index) => {
      const delay = index * 100;
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(anim.x, {
              toValue: (Math.random() - 0.5) * 200,
              duration: 3000,
              useNativeDriver: true,
            }),
            Animated.timing(anim.y, {
              toValue: -SCREEN_HEIGHT * 0.5,
              duration: 3000,
              useNativeDriver: true,
            }),
            Animated.sequence([
              Animated.timing(anim.opacity, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
              }),
              Animated.delay(2000),
              Animated.timing(anim.opacity, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
              }),
            ]),
          ]),
        ])
      ).start();
    });
  };

  const stopLoadingAnimations = () => {
    pulseAnim.setValue(1);
    rotateAnim.setValue(0);
    particleAnims.forEach(anim => {
      anim.x.setValue(0);
      anim.y.setValue(0);
      anim.opacity.setValue(0);
    });
  };

  const handleGenerateVideo = async () => {
    // Check limits
    if (usage.remaining <= 0) {
      if (!isPro && !isElite) {
        Alert.alert(
          '🎬 Daily Limit Reached',
          `You've used your ${usage.limit} free video${usage.limit === 1 ? '' : 's'} for today! Upgrade to Pro for 5 videos per day, or Elite for unlimited videos.`,
          [
            { text: 'Maybe Later', style: 'cancel' },
            { text: 'Upgrade Now', onPress: openSubscriptionModal },
          ]
        );
      } else {
        Alert.alert('Daily Limit Reached', `You've generated ${usage.limit} videos today. Come back tomorrow for more!`);
      }
      return;
    }

    setGenerating(true);
    setGenerationProgress(0);
    setModalVisible(true);

    try {
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      // Start generation
      const response = await fetch(`${baseUrl}/api/sora/generate-bet-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          promptType: 'bet_slip_hype',
          pickIds: pickIds || [],
          duration: 5,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Generation failed');
      }

      setVideoId(data.videoId);

      // Start polling for completion
      pollVideoStatus(data.videoId);

    } catch (error: any) {
      console.error('Video generation failed:', error);
      Alert.alert('Generation Failed', error.message || 'Something went wrong. Please try again.');
      setGenerating(false);
      setModalVisible(false);
    }
  };

  const pollVideoStatus = async (vId: string) => {
    const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) return;

    let attempts = 0;
    const maxAttempts = 60; // 2 minutes max

    const poll = async () => {
      try {
        const response = await fetch(`${baseUrl}/api/sora/video-status/${vId}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        const data = await response.json();

        if (data.status === 'completed' && data.videoUrl) {
          setVideoUrl(data.videoUrl);
          setGenerating(false);
          setGenerationProgress(100);
          await fetchUsage(); // Refresh usage
          
          if (onVideoGenerated) {
            onVideoGenerated(data.videoUrl);
          }

          // Show success for 2 seconds then close
          setTimeout(() => {
            setModalVisible(false);
            setVideoUrl(null);
            setVideoId(null);
            setGenerationProgress(0);
          }, 2000);

        } else if (data.status === 'failed') {
          throw new Error(data.error || 'Generation failed');
          
        } else if (attempts < maxAttempts) {
          // Still processing, update progress
          setGenerationProgress(Math.min(90, (attempts / maxAttempts) * 100));
          attempts++;
          setTimeout(poll, 2000); // Poll every 2 seconds
        } else {
          throw new Error('Generation timed out');
        }

      } catch (error: any) {
        console.error('Polling error:', error);
        setGenerating(false);
        setModalVisible(false);
        Alert.alert('Generation Failed', error.message);
      }
    };

    poll();
  };

  const rotateInterpolation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <>
      {/* Main CTA Card */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handleGenerateVideo}
        disabled={generating}
      >
        <LinearGradient
          colors={isElite ? theme.ctaGradient as any : (isPro ? ['#00E5FF', '#0EA5E9'] : ['#1a1a2e', '#16213e'])}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.mainCard}
        >
          {/* Animated border effect */}
          <View style={[styles.borderGlow, isElite && { borderColor: theme.accentPrimary }]} />

          <View style={styles.cardContent}>
            <View style={styles.iconContainer}>
              <Film size={32} color={isElite ? theme.headerTextPrimary : '#FFFFFF'} />
              <View style={styles.sparkleIcon}>
                <Sparkles size={16} color={isElite ? theme.accentPrimary : '#00E5FF'} />
              </View>
            </View>

            <View style={styles.textContainer}>
              <Text style={[styles.title, isElite && { color: theme.headerTextPrimary }]}>
                🎬 AI Video Generator
              </Text>
              <Text style={[styles.subtitle, isElite && { color: theme.headerTextSecondary }]}>
                Transform your picks into epic hype videos
              </Text>
              
              {/* Usage indicator */}
              <View style={styles.usageContainer}>
                <View style={styles.usageDots}>
                  {Array.from({ length: usage.limit }).map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.usageDot,
                        i < usage.used && styles.usageDotUsed,
                        isElite && i >= usage.used && { borderColor: theme.accentPrimary },
                        isElite && i < usage.used && { backgroundColor: theme.accentPrimary },
                      ]}
                    />
                  ))}
                </View>
                <Text style={[styles.usageText, isElite && { color: theme.headerTextSecondary }]}>
                  {usage.remaining} of {usage.limit} left today
                </Text>
                {!isPro && !isElite && (
                  <Crown size={12} color="#F59E0B" style={{ marginLeft: 6 }} />
                )}
              </View>
            </View>

            <View style={styles.actionIcon}>
              <Video size={24} color={isElite ? theme.accentPrimary : '#00E5FF'} />
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Generation Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !generating && setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient
              colors={isElite ? theme.headerGradient as any : ['#1E293B', '#334155', '#0F172A']}
              style={styles.modalGradient}
            >
              {/* Close button - only when not generating */}
              {!generating && (
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setModalVisible(false)}
                >
                  <X size={24} color="#FFFFFF" />
                </TouchableOpacity>
              )}

              {/* Particle effects */}
              {generating && particleAnims.map((anim, index) => (
                <Animated.View
                  key={index}
                  style={[
                    styles.particle,
                    {
                      transform: [
                        { translateX: anim.x },
                        { translateY: anim.y },
                      ],
                      opacity: anim.opacity,
                    },
                  ]}
                />
              ))}

              {/* Main content */}
              <View style={styles.modalBody}>
                {generating || generationProgress < 100 ? (
                  <>
                    {/* Animated logo */}
                    <Animated.View
                      style={[
                        styles.loadingLogoContainer,
                        {
                          transform: [
                            { scale: pulseAnim },
                            { rotate: rotateInterpolation },
                          ],
                        },
                      ]}
                    >
                      <Film size={64} color={isElite ? theme.accentPrimary : '#00E5FF'} />
                    </Animated.View>

                    <Text style={[styles.loadingTitle, isElite && { color: theme.headerTextPrimary }]}>
                      {generationProgress < 10
                        ? '🎬 Initializing Sora 2...'
                        : generationProgress < 30
                        ? '🎨 Creating cinematic scenes...'
                        : generationProgress < 60
                        ? '⚡ Rendering sports footage...'
                        : generationProgress < 90
                        ? '🎵 Adding epic soundtrack...'
                        : '✨ Final touches...'}
                    </Text>

                    <Text style={[styles.loadingSubtitle, isElite && { color: theme.headerTextSecondary }]}>
                      Generating your epic bet hype video
                    </Text>

                    {/* Progress bar */}
                    <View style={styles.progressBarContainer}>
                      <View style={[styles.progressBarBg, isElite && { backgroundColor: `${theme.accentPrimary}20` }]}>
                        <Animated.View
                          style={[
                            styles.progressBarFill,
                            {
                              width: `${generationProgress}%`,
                              backgroundColor: isElite ? theme.accentPrimary : '#00E5FF',
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.progressText, isElite && { color: theme.headerTextSecondary }]}>
                        {Math.round(generationProgress)}%
                      </Text>
                    </View>

                    <Text style={[styles.funFact, isElite && { color: theme.headerTextSecondary }]}>
                      💡 Did you know? Sora 2 can generate videos in{' '}
                      <Text style={[styles.funFactHighlight, isElite && { color: theme.accentPrimary }]}>
                        cinematic quality
                      </Text>{' '}
                      with synced audio!
                    </Text>
                  </>
                ) : (
                  <>
                    {/* Success state */}
                    <View style={[styles.successIconContainer, isElite && { backgroundColor: `${theme.accentPrimary}20` }]}>
                      <Check size={48} color={isElite ? theme.accentPrimary : '#10B981'} />
                    </View>

                    <Text style={[styles.successTitle, isElite && { color: theme.headerTextPrimary }]}>
                      🎉 Video Ready!
                    </Text>

                    <Text style={[styles.successSubtitle, isElite && { color: theme.headerTextSecondary }]}>
                      Your bet hype video has been generated
                    </Text>

                    {/* Video preview would go here */}
                    {videoUrl && (
                      <TouchableOpacity
                        style={styles.viewVideoButton}
                        onPress={() => {
                          // Navigate to video player or open in gallery
                          setModalVisible(false);
                        }}
                      >
                        <LinearGradient
                          colors={isElite ? theme.ctaGradient as any : ['#00E5FF', '#0EA5E9']}
                          style={styles.viewVideoGradient}
                        >
                          <Video size={20} color="#000000" />
                          <Text style={styles.viewVideoText}>View Video</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  mainCard: {
    borderRadius: normalize(16),
    overflow: 'hidden',
    marginHorizontal: normalize(16),
    marginVertical: normalize(12),
  },
  borderGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: '#00E5FF',
    borderRadius: normalize(16),
    opacity: 0.3,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: normalize(20),
  },
  iconContainer: {
    width: normalize(56),
    height: normalize(56),
    borderRadius: normalize(28),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  sparkleIcon: {
    position: 'absolute',
    top: -4,
    right: -4,
  },
  textContainer: {
    flex: 1,
    marginLeft: normalize(16),
  },
  title: {
    fontSize: normalize(18),
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: normalize(4),
  },
  subtitle: {
    fontSize: normalize(13),
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: normalize(8),
  },
  usageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  usageDots: {
    flexDirection: 'row',
    marginRight: normalize(8),
  },
  usageDot: {
    width: normalize(6),
    height: normalize(6),
    borderRadius: normalize(3),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginRight: normalize(4),
  },
  usageDotUsed: {
    backgroundColor: '#00E5FF',
    borderColor: '#00E5FF',
  },
  usageText: {
    fontSize: normalize(11),
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '600',
  },
  actionIcon: {
    marginLeft: normalize(8),
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: SCREEN_WIDTH * 0.9,
    maxWidth: 400,
    borderRadius: normalize(24),
    overflow: 'hidden',
  },
  modalGradient: {
    padding: normalize(32),
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: normalize(16),
    right: normalize(16),
    width: normalize(36),
    height: normalize(36),
    borderRadius: normalize(18),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  particle: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#00E5FF',
    top: '50%',
    left: '50%',
  },
  modalBody: {
    alignItems: 'center',
    paddingTop: normalize(20),
  },
  loadingLogoContainer: {
    width: normalize(120),
    height: normalize(120),
    borderRadius: normalize(60),
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: normalize(24),
  },
  loadingTitle: {
    fontSize: normalize(20),
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: normalize(8),
    textAlign: 'center',
  },
  loadingSubtitle: {
    fontSize: normalize(14),
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: normalize(24),
    textAlign: 'center',
  },
  progressBarContainer: {
    width: '100%',
    marginBottom: normalize(20),
  },
  progressBarBg: {
    width: '100%',
    height: normalize(8),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: normalize(4),
    overflow: 'hidden',
    marginBottom: normalize(8),
  },
  progressBarFill: {
    height: '100%',
    borderRadius: normalize(4),
  },
  progressText: {
    fontSize: normalize(12),
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
  },
  funFact: {
    fontSize: normalize(12),
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    fontStyle: 'italic',
    paddingHorizontal: normalize(16),
  },
  funFactHighlight: {
    color: '#00E5FF',
    fontWeight: '600',
  },
  successIconContainer: {
    width: normalize(96),
    height: normalize(96),
    borderRadius: normalize(48),
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: normalize(24),
  },
  successTitle: {
    fontSize: normalize(24),
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: normalize(8),
  },
  successSubtitle: {
    fontSize: normalize(14),
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: normalize(24),
    textAlign: 'center',
  },
  viewVideoButton: {
    width: '100%',
    borderRadius: normalize(12),
    overflow: 'hidden',
  },
  viewVideoGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: normalize(14),
    paddingHorizontal: normalize(24),
  },
  viewVideoText: {
    fontSize: normalize(16),
    fontWeight: '700',
    color: '#000000',
    marginLeft: normalize(8),
  },
});

