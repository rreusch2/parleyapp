/**
 * 🎥 Main Sora Video Generator Component
 *
 * Features:
 * - Video type selection
 * - Prompt input
 * - Generation progress
 * - User tier-based features
 * - Beautiful UI
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  Dimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Video,
  Camera,
  Target,
  Trophy,
  Sparkles,
  Crown,
  Play,
  X,
  CheckCircle,
  AlertCircle,
  Zap
} from 'lucide-react-native';
import { useSubscription } from '../services/subscriptionContext';
import { useUITheme } from '../services/uiThemeContext';
import { normalize } from '../services/device';
import VideoGenerationLoader from './VideoGenerationLoader';

const { width: screenWidth } = Dimensions.get('window');

interface VideoType {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  gradient: string[];
  premium?: boolean;
  example: string;
}

const VIDEO_TYPES: VideoType[] = [
  {
    id: 'highlight_reel',
    name: 'Game Highlights',
    description: 'Create cinematic highlight reels',
    icon: Video,
    color: '#00E5FF',
    gradient: ['#1E40AF', '#7C3AED', '#EC4899'],
    example: 'MLB game highlights with dramatic slow motion'
  },
  {
    id: 'player_analysis',
    name: 'Player Deep Dive',
    description: 'Analyze player performance',
    icon: Target,
    color: '#10B981',
    gradient: ['#059669', '#10B981', '#34D399'],
    example: 'Aaron Judge season performance breakdown'
  },
  {
    id: 'strategy_explanation',
    name: 'Betting Strategy',
    description: 'Visual strategy guides',
    icon: Trophy,
    color: '#F59E0B',
    gradient: ['#D97706', '#F59E0B', '#FBBF24'],
    example: 'How to use Kelly Criterion effectively'
  },
  {
    id: 'trend_analysis',
    name: 'Trend Visualizer',
    description: 'Data trend animations',
    icon: Sparkles,
    color: '#8B5CF6',
    gradient: ['#7C3AED', '#8B5CF6', '#A78BFA'],
    example: 'MLB betting trends over the last month'
  },
  {
    id: 'custom_content',
    name: 'Custom Creation',
    description: 'Your own sports content',
    icon: Camera,
    color: '#EC4899',
    gradient: ['#BE185D', '#EC4899', '#F472B6'],
    premium: true,
    example: 'Any sports content you can imagine'
  }
];

interface SoraVideoGeneratorProps {
  visible: boolean;
  onClose: () => void;
  initialVideoType?: string;
  gameContext?: {
    gameId?: string;
    homeTeam?: string;
    awayTeam?: string;
    sport?: string;
  };
}

export default function SoraVideoGenerator({
  visible,
  onClose,
  initialVideoType = 'highlight_reel',
  gameContext
}: SoraVideoGeneratorProps) {
  const { isPro, isElite, openSubscriptionModal } = useSubscription();
  const { theme } = useUITheme();

  const [selectedType, setSelectedType] = useState(initialVideoType);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [generationComplete, setGenerationComplete] = useState(false);
  const [generatedVideo, setGeneratedVideo] = useState<any>(null);

  useEffect(() => {
    if (gameContext && gameContext.homeTeam && gameContext.awayTeam) {
      const defaultPrompt = `Create an exciting video about the ${gameContext.homeTeam} vs ${gameContext.awayTeam} ${gameContext.sport} game`;
      setPrompt(defaultPrompt);
    }
  }, [gameContext]);

  const getAuthToken = async (): Promise<string | null> => {
    try {
      const token = await AsyncStorage.getItem('supabase_auth_token');
      return token;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      Alert.alert('Missing Prompt', 'Please enter a description for your video');
      return;
    }

    try {
      setIsGenerating(true);
      setProgress(0);

      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/videos/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({
          videoType: selectedType,
          contentPrompt: prompt,
          sport: gameContext?.sport,
          gameId: gameContext?.gameId,
          duration: isElite ? 90 : (isPro ? 60 : 30)
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to start video generation');
      }

      setVideoId(result.videoId);

      // Start progress simulation
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 95) {
            clearInterval(progressInterval);
            return 95;
          }
          return prev + Math.random() * 15;
        });
      }, 1000);

      // Poll for completion
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(
            `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/videos/status/${result.videoId}`,
            {
              headers: {
                'Authorization': `Bearer ${await getAuthToken()}`
              }
            }
          );

          const statusResult = await statusResponse.json();

          if (statusResult.status === 'completed') {
            clearInterval(progressInterval);
            clearInterval(pollInterval);
            setProgress(100);
            setGenerationComplete(true);
            setGeneratedVideo(statusResult);
            setIsGenerating(false);
          } else if (statusResult.status === 'failed') {
            clearInterval(progressInterval);
            clearInterval(pollInterval);
            setIsGenerating(false);
            Alert.alert('Generation Failed', statusResult.error || 'Video generation failed');
          }
        } catch (error) {
          console.error('Error polling video status:', error);
        }
      }, 2000);

    } catch (error: any) {
      setIsGenerating(false);
      Alert.alert('Generation Failed', error.message || 'Failed to start video generation');
    }
  };

  const handleClose = () => {
    setIsGenerating(false);
    setProgress(0);
    setVideoId(null);
    setGenerationComplete(false);
    setGeneratedVideo(null);
    setPrompt('');
    onClose();
  };

  const selectedVideoType = VIDEO_TYPES.find(type => type.id === selectedType);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <VideoGenerationLoader
          videoType={selectedType as any}
          isGenerating={isGenerating}
          progress={progress}
          estimatedTime={isElite ? 60 : (isPro ? 45 : 30)}
          onCancel={isGenerating ? handleClose : undefined}
          userTier={isElite ? 'elite' : (isPro ? 'pro' : 'free')}
        />

        {!isGenerating && (
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
              >
                <X size={24} color="#FFFFFF" />
              </TouchableOpacity>

              <View style={styles.headerContent}>
                <Text style={styles.headerTitle}>🎥 AI Video Studio</Text>
                <Text style={styles.headerSubtitle}>Powered by Sora 2</Text>
              </View>

              {/* User Tier Badge */}
              <View style={styles.tierContainer}>
                {isElite && (
                  <View style={styles.eliteTier}>
                    <Crown size={16} color="#FFD700" />
                    <Text style={styles.tierText}>Elite</Text>
                  </View>
                )}
                {isPro && !isElite && (
                  <View style={styles.proTier}>
                    <Crown size={16} color="#00E5FF" />
                    <Text style={styles.tierText}>Pro</Text>
                  </View>
                )}
                {!isPro && !isElite && (
                  <View style={styles.freeTier}>
                    <Text style={styles.tierText}>Free</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Video Type Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Choose Video Type</Text>
              <View style={styles.videoTypesGrid}>
                {VIDEO_TYPES.map((type) => {
                  const IconComponent = type.icon;
                  const isSelected = selectedType === type.id;
                  const isLocked = type.premium && !isPro && !isElite;

                  return (
                    <TouchableOpacity
                      key={type.id}
                      style={[
                        styles.videoTypeCard,
                        isSelected && styles.selectedCard,
                        isLocked && styles.lockedCard
                      ]}
                      onPress={() => !isLocked && setSelectedType(type.id)}
                      disabled={isLocked}
                    >
                      <LinearGradient
                        colors={isSelected ? type.gradient : ['#1E293B', '#334155']}
                        style={styles.cardGradient}
                      >
                        <View style={styles.cardContent}>
                          <IconComponent
                            size={32}
                            color={isSelected ? '#FFFFFF' : type.color}
                          />
                          <Text style={[
                            styles.cardTitle,
                            isSelected && styles.selectedCardTitle
                          ]}>
                            {type.name}
                          </Text>
                          <Text style={[
                            styles.cardDescription,
                            isSelected && styles.selectedCardDescription
                          ]}>
                            {type.description}
                          </Text>

                          {isLocked && (
                            <View style={styles.lockOverlay}>
                              <Crown size={20} color="#FFD700" />
                              <Text style={styles.lockText}>Pro+</Text>
                            </View>
                          )}
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Prompt Input */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Describe Your Video</Text>

              {selectedVideoType && (
                <View style={styles.exampleContainer}>
                  <Text style={styles.exampleLabel}>Example:</Text>
                  <Text style={styles.exampleText}>{selectedVideoType.example}</Text>
                </View>
              )}

              <TextInput
                style={styles.promptInput}
                placeholder="Describe what you want in your video..."
                placeholderTextColor="#64748B"
                value={prompt}
                onChangeText={setPrompt}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Generation Limits */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Generation Limits</Text>
              <View style={styles.limitsContainer}>
                <View style={styles.limitItem}>
                  <Zap size={16} color="#00E5FF" />
                  <Text style={styles.limitText}>
                    Duration: {isElite ? '90s' : (isPro ? '60s' : '30s')}
                  </Text>
                </View>
                <View style={styles.limitItem}>
                  <Video size={16} color="#00E5FF" />
                  <Text style={styles.limitText}>
                    Daily: {isElite ? 'Unlimited' : (isPro ? '10 videos' : '2 videos')}
                  </Text>
                </View>
                <View style={styles.limitItem}>
                  <Crown size={16} color={isElite ? "#FFD700" : "#00E5FF"} />
                  <Text style={styles.limitText}>
                    Quality: {isElite ? '4K Elite' : (isPro ? 'HD Pro' : 'Standard')}
                  </Text>
                </View>
              </View>
            </View>

            {/* Generate Button */}
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.generateButton}
                onPress={handleGenerate}
                disabled={!prompt.trim()}
              >
                <LinearGradient
                  colors={selectedVideoType?.gradient || ['#00E5FF', '#0891B2']}
                  style={styles.generateGradient}
                >
                  <Play size={20} color="#FFFFFF" />
                  <Text style={styles.generateText}>
                    Generate Video
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

              {/* Upgrade Prompt for Free Users */}
              {!isPro && !isElite && (
                <View style={styles.section}>
                  <TouchableOpacity
                    style={styles.upgradePrompt}
                    onPress={openSubscriptionModal}
                  >
                    <LinearGradient
                      colors={['#8B5CF6', '#EC4899', '#F59E0B']}
                      style={styles.upgradeGradient}
                    >
                      <View style={styles.upgradeIconContainer}>
                        <Text style={styles.upgradeEmoji}>🎬</Text>
                      </View>
                      <View style={styles.upgradeTextContainer}>
                        <Text style={styles.upgradeTitle}>Unlock AI Video Creation</Text>
                        <Text style={styles.upgradeSubtitle}>Pro: 60s • Elite: 90s + Premium Effects</Text>
                        <Text style={styles.upgradeDescription}>
                          Create cinematic highlight reels, player analysis videos, and custom sports content with OpenAI's revolutionary Sora 2 technology.
                        </Text>
                      </View>
                      <View style={styles.upgradeActionContainer}>
                        <Crown size={20} color="#FFFFFF" />
                        <Text style={styles.upgradeActionText}>Upgrade</Text>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>

                  {/* Free User Limitations */}
                  <View style={styles.freeLimitations}>
                    <Text style={styles.limitationsTitle}>Free Plan Limits:</Text>
                    <View style={styles.limitationsList}>
                      <Text style={styles.limitationItem}>• 30-second videos only</Text>
                      <Text style={styles.limitationItem}>• 2 videos per day</Text>
                      <Text style={styles.limitationItem}>• Watermarked content</Text>
                      <Text style={styles.limitationItem}>• Standard quality only</Text>
                    </View>
                  </View>
                </View>
              )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    flex: 1,
    paddingHorizontal: normalize(20),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: normalize(20),
    paddingHorizontal: normalize(20),
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  closeButton: {
    padding: normalize(8),
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: normalize(24),
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: normalize(14),
    color: '#94A3B8',
    marginTop: normalize(4),
    textAlign: 'center',
  },
  tierContainer: {
    alignItems: 'center',
  },
  eliteTier: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: normalize(12),
    paddingVertical: normalize(6),
    borderRadius: normalize(16),
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  proTier: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
    paddingHorizontal: normalize(12),
    paddingVertical: normalize(6),
    borderRadius: normalize(16),
  },
  freeTier: {
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
    paddingHorizontal: normalize(12),
    paddingVertical: normalize(6),
    borderRadius: normalize(16),
  },
  tierText: {
    fontSize: normalize(12),
    fontWeight: '700',
    color: isElite ? '#FFD700' : (isPro ? '#00E5FF' : '#64748B'),
    marginLeft: normalize(4),
  },
  section: {
    marginTop: normalize(24),
  },
  sectionTitle: {
    fontSize: normalize(18),
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: normalize(16),
  },
  videoTypesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  videoTypeCard: {
    width: (screenWidth - 40) / 2 - normalize(8),
    marginBottom: normalize(16),
    borderRadius: normalize(16),
    overflow: 'hidden',
  },
  selectedCard: {
    borderWidth: 2,
    borderColor: '#00E5FF',
  },
  lockedCard: {
    opacity: 0.6,
  },
  cardGradient: {
    padding: normalize(16),
    alignItems: 'center',
    minHeight: normalize(120),
  },
  cardContent: {
    alignItems: 'center',
    flex: 1,
  },
  cardTitle: {
    fontSize: normalize(14),
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: normalize(8),
    textAlign: 'center',
  },
  selectedCardTitle: {
    color: '#00E5FF',
  },
  cardDescription: {
    fontSize: normalize(12),
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: normalize(4),
    lineHeight: normalize(16),
  },
  selectedCardDescription: {
    color: '#CBD5E1',
  },
  lockOverlay: {
    position: 'absolute',
    top: normalize(8),
    right: normalize(8),
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderRadius: normalize(12),
    paddingHorizontal: normalize(6),
    paddingVertical: normalize(2),
    flexDirection: 'row',
    alignItems: 'center',
  },
  lockText: {
    fontSize: normalize(10),
    color: '#FFD700',
    fontWeight: '700',
    marginLeft: normalize(2),
  },
  exampleContainer: {
    backgroundColor: 'rgba(0, 229, 255, 0.05)',
    borderRadius: normalize(12),
    padding: normalize(12),
    marginBottom: normalize(16),
    borderLeftWidth: 3,
    borderLeftColor: '#00E5FF',
  },
  exampleLabel: {
    fontSize: normalize(12),
    fontWeight: '600',
    color: '#00E5FF',
    marginBottom: normalize(4),
  },
  exampleText: {
    fontSize: normalize(14),
    color: '#CBD5E1',
    lineHeight: normalize(18),
  },
  promptInput: {
    backgroundColor: '#1E293B',
    borderRadius: normalize(12),
    padding: normalize(16),
    color: '#FFFFFF',
    fontSize: normalize(16),
    textAlignVertical: 'top',
    minHeight: normalize(100),
    borderWidth: 1,
    borderColor: '#334155',
  },
  limitsContainer: {
    backgroundColor: '#1E293B',
    borderRadius: normalize(12),
    padding: normalize(16),
  },
  limitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: normalize(12),
  },
  limitText: {
    fontSize: normalize(14),
    color: '#CBD5E1',
    marginLeft: normalize(8),
  },
  generateButton: {
    borderRadius: normalize(16),
    overflow: 'hidden',
  },
  generateGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: normalize(16),
    paddingHorizontal: normalize(24),
  },
  generateText: {
    fontSize: normalize(18),
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: normalize(8),
  },
  upgradePrompt: {
    borderRadius: normalize(16),
    overflow: 'hidden',
  },
  upgradeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: normalize(16),
    paddingHorizontal: normalize(20),
  },
  upgradeTextContainer: {
    flex: 1,
    marginHorizontal: normalize(12),
  },
  upgradeTitle: {
    fontSize: normalize(16),
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: normalize(2),
  },
  upgradeSubtitle: {
    fontSize: normalize(12),
    color: '#FFFFFF',
    opacity: 0.8,
  },
  upgradeIconContainer: {
    width: normalize(40),
    height: normalize(40),
    borderRadius: normalize(20),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: normalize(12),
  },
  upgradeEmoji: {
    fontSize: normalize(20),
  },
  upgradeActionContainer: {
    alignItems: 'center',
    marginTop: normalize(8),
  },
  upgradeActionText: {
    fontSize: normalize(14),
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: normalize(4),
  },
  freeLimitations: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: normalize(12),
    padding: normalize(16),
    marginTop: normalize(16),
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  limitationsTitle: {
    fontSize: normalize(14),
    fontWeight: '600',
    color: '#EF4444',
    marginBottom: normalize(8),
  },
  limitationsList: {
    gap: normalize(4),
  },
  limitationItem: {
    fontSize: normalize(12),
    color: '#94A3B8',
    lineHeight: normalize(16),
  },
});
