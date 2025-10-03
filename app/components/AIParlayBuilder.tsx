import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Dimensions,
  ActivityIndicator,
  Animated,
  Vibration,
  Image,
  Platform,
  TextInput,
  Share,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Sparkles,
  TrendingUp,
  Shield,
  Zap,
  Target,
  DollarSign,
  Trophy,
  Users,
  ChevronRight,
  X,
  Search,
  Globe,
  Database,
  Activity,
  AlertTriangle,
  CheckCircle,
  Info,
  BarChart,
  Brain,
  Flame,
  Share2,
  Calculator,
  Copy
} from 'lucide-react-native';
import EventSource from 'react-native-sse';
import Markdown from 'react-native-markdown-display';
import { useSubscription } from '../services/subscriptionContext';
import { supabase } from '../services/api/supabaseClient';
import * as Clipboard from 'expo-clipboard';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface ParlayConfig {
  legs: number;
  riskLevel: 'safe' | 'balanced' | 'risky';
  betType: 'player' | 'team' | 'mixed';
}

interface ToolEvent {
  type: string;
  message: string;
  data?: any;
}

interface SearchResult {
  title: string;
  snippet: string;
  source: string;
}

export default function AIParlayBuilder() {
  const { isPro, isElite, openSubscriptionModal } = useSubscription();
  const [config, setConfig] = useState<ParlayConfig>({
    legs: 3,
    riskLevel: 'balanced',
    betType: 'mixed',
  });
  
  const [modalVisible, setModalVisible] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [parlayResult, setParlayResult] = useState<any>(null);
  const [toolEvents, setToolEvents] = useState<ToolEvent[]>([]);
  const [currentTool, setCurrentTool] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [betAmount, setBetAmount] = useState('10');
  const [totalOdds, setTotalOdds] = useState<number>(0);
  const [parlayLegs, setParlayLegs] = useState<any[]>([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  // Pulse animation for the generate button
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const getLegOptions = () => [
    { value: 2, label: '2-Leg', icon: '🎯' },
    { value: 3, label: '3-Leg', icon: '🔥' },
    { value: 4, label: '4-Leg', icon: '⚡' },
    { value: 5, label: '5-Leg', icon: '🚀' },
    { value: 6, label: '6-Leg', icon: '💎' },
  ];

  const getRiskOptions = () => [
    { value: 'safe', label: 'Safe', icon: Shield, color: '#10B981', description: 'High confidence, lower odds' },
    { value: 'balanced', label: 'Balanced', icon: Target, color: '#00E5FF', description: 'Mix of safety and value' },
    { value: 'risky', label: 'Risky', icon: Flame, color: '#F59E0B', description: 'High risk, high reward' },
  ];

  const getBetTypeOptions = () => [
    { value: 'player', label: 'Player Props', icon: Users, color: '#8B5CF6' },
    { value: 'team', label: 'Team Bets', icon: Trophy, color: '#00E5FF' },
    { value: 'mixed', label: 'Mixed', icon: Sparkles, color: '#F59E0B' },
  ];

  const generateParlay = async () => {
    if (!isPro && !isElite) {
      openSubscriptionModal();
      return;
    }

    setModalVisible(true);
    setGenerating(true);
    setStreamingText('');
    setParlayResult(null);
    setToolEvents([]);
    setCurrentTool(null);
    setSearchResults([]);

    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    try {
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://zooming-rebirth-production-a305.up.railway.app';
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Create SSE connection for streaming
      const es = new EventSource(`${backendUrl}/api/ai/parlay/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.id}`,
        },
        body: JSON.stringify({
          config,
          userId: user.id,
        }),
      });

      es.addEventListener('open', () => {
        console.log('SSE connection opened');
      });

      es.addEventListener('message', (event: any) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'text') {
          setStreamingText(prev => prev + data.content);
        } else if (data.type === 'tool_start') {
          setCurrentTool(data.tool);
          const toolEvent: ToolEvent = {
            type: data.tool,
            message: data.message || getToolMessage(data.tool),
          };
          setToolEvents(prev => [...prev, toolEvent]);
          // Remove vibration to prevent excessive haptic feedback
        } else if (data.type === 'tool_end') {
          setCurrentTool(null);
        } else if (data.type === 'search_results') {
          setSearchResults(data.results || []);
        } else if (data.type === 'complete') {
          setParlayResult(data.parlay);
          setTotalOdds(data.totalOdds || 0);
          setParlayLegs(data.legs || []);
          setGenerating(false);
          // Prevent automatic scrolling
          if (scrollViewRef.current) {
            scrollViewRef.current.scrollTo({ y: 0, animated: false });
          }
        }
      });

      es.addEventListener('error', (error: any) => {
        console.error('SSE error:', error);
        setGenerating(false);
        es.close();
      });

      // Cleanup on unmount
      return () => {
        es.close();
      };
    } catch (error) {
      console.error('Error generating parlay:', error);
      setGenerating(false);
    }
  };

  const getToolMessage = (tool: string): string => {
    const messages: { [key: string]: string } = {
      database: 'Analyzing today\'s games and odds...',
      statmuse: 'Gathering player statistics...',
      web_search: 'Searching for latest insights...',
      ai_predictions: 'Reviewing AI predictions...',
      player_props: 'Evaluating player prop bets...',
      team_analysis: 'Analyzing team matchups...',
    };
    return messages[tool] || 'Processing...';
  };

  const getToolIcon = (tool: string) => {
    switch (tool) {
      case 'database':
        return <Database size={20} color="#00E5FF" />;
      case 'statmuse':
        return <Activity size={20} color="#10B981" />;
      case 'web_search':
        return <Globe size={20} color="#F59E0B" />;
      case 'ai_predictions':
        return <Brain size={20} color="#8B5CF6" />;
      case 'player_props':
        return <Users size={20} color="#EC4899" />;
      case 'team_analysis':
        return <Trophy size={20} color="#00E5FF" />;
      default:
        return <Activity size={20} color="#64748B" />;
    }
  };

  return (
    <LinearGradient
      colors={['#1E293B', '#0F172A']}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <LinearGradient
            colors={['#00E5FF', '#8B5CF6']}
            style={styles.iconGradient}
          >
            <Sparkles size={24} color="#FFFFFF" />
          </LinearGradient>
          <View style={styles.titleText}>
            <Text style={styles.title}>AI Parlay Builder</Text>
            <Text style={styles.subtitle}>Powered by Grok intelligence</Text>
          </View>
        </View>
      </View>

      {/* Configuration Section */}
      <View style={styles.configSection}>
        {/* Legs Selection */}
        <View style={styles.configGroup}>
          <Text style={styles.configLabel}>Select Legs</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionScroll}>
            {getLegOptions().map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.legOption,
                  config.legs === option.value && styles.legOptionActive
                ]}
                onPress={() => {
                  setConfig({ ...config, legs: option.value });
                  Vibration.vibrate(10);
                }}
              >
                <Text style={styles.legEmoji}>{option.icon}</Text>
                <Text style={[
                  styles.legText,
                  config.legs === option.value && styles.legTextActive
                ]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Risk Level */}
        <View style={styles.configGroup}>
          <Text style={styles.configLabel}>Risk Level</Text>
          <View style={styles.riskOptions}>
            {getRiskOptions().map((option) => {
              const Icon = option.icon;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.riskOption,
                    config.riskLevel === option.value && styles.riskOptionActive,
                    config.riskLevel === option.value && { borderColor: option.color }
                  ]}
                  onPress={() => {
                    setConfig({ ...config, riskLevel: option.value as any });
                    Vibration.vibrate(10);
                  }}
                >
                  <Icon size={24} color={config.riskLevel === option.value ? option.color : '#64748B'} />
                  <Text style={[
                    styles.riskLabel,
                    config.riskLevel === option.value && { color: option.color }
                  ]}>
                    {option.label}
                  </Text>
                  <Text style={styles.riskDescription}>{option.description}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Bet Type */}
        <View style={styles.configGroup}>
          <Text style={styles.configLabel}>Bet Type</Text>
          <View style={styles.betTypeOptions}>
            {getBetTypeOptions().map((option) => {
              const Icon = option.icon;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.betTypeOption,
                    config.betType === option.value && styles.betTypeOptionActive,
                    config.betType === option.value && { borderColor: option.color }
                  ]}
                  onPress={() => {
                    setConfig({ ...config, betType: option.value as any });
                    Vibration.vibrate(10);
                  }}
                >
                  <Icon size={20} color={config.betType === option.value ? option.color : '#64748B'} />
                  <Text style={[
                    styles.betTypeLabel,
                    config.betType === option.value && { color: option.color }
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Generate Button */}
        <TouchableOpacity onPress={generateParlay} disabled={generating} style={styles.generateButtonWrapper}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <LinearGradient
              colors={isPro || isElite ? ['#00E5FF', '#8B5CF6', '#F59E0B'] : ['#64748B', '#475569']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.generateButton}
            >
              {generating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Sparkles size={24} color="#FFFFFF" />
                  <Text style={styles.generateButtonText}>
                    {isPro || isElite ? 'Generate Parlay' : 'Pro Feature'}
                  </Text>
                  <ChevronRight size={20} color="#FFFFFF" />
                </>
              )}
            </LinearGradient>
          </Animated.View>
        </TouchableOpacity>
      </View>

      {/* Parlay Generation Modal - Full Screen */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={false}
        presentationStyle="fullScreen"
        onRequestClose={() => !generating && setModalVisible(false)}
      >
        <LinearGradient
          colors={['#0F172A', '#1E293B', '#0F172A']}
          style={styles.modalContainer}
        >
          <Animated.View 
            style={[
              styles.modalContent,
              { opacity: fadeAnim }
            ]}
          >
            {/* Modal Header with Safe Area */}
            <View style={styles.modalHeaderWrapper}>
              <LinearGradient
                colors={['#1E293B', '#0F172A']}
                style={styles.modalHeader}
              >
                <View style={styles.modalTitleContainer}>
                  <LinearGradient
                    colors={['#00E5FF', '#8B5CF6']}
                    style={styles.modalIconGradient}
                  >
                    <Sparkles size={28} color="#FFFFFF" />
                  </LinearGradient>
                  <View style={styles.modalTitleText}>
                    <Text style={styles.modalTitle}>AI Parlay Generator</Text>
                    <Text style={styles.modalSubtitle}>
                      {generating ? 'Building your intelligent parlay...' : 'Your parlay is ready!'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  style={styles.closeButton}
                  disabled={generating}
                >
                  <LinearGradient
                    colors={generating ? ['#334155', '#1E293B'] : ['#EF4444', '#DC2626']}
                    style={styles.closeButtonGradient}
                  >
                    <X size={22} color="#FFFFFF" />
                  </LinearGradient>
                </TouchableOpacity>
              </LinearGradient>
            </View>

            {/* Content Area */}
            <ScrollView 
              ref={scrollViewRef}
              style={styles.modalScrollView} 
              showsVerticalScrollIndicator={false}
              scrollEnabled={!generating} // Disable scrolling while generating to prevent jumps
            >
              {generating ? (
                <>
                  {/* Intro Message with Animation */}
                  <LinearGradient
                    colors={['rgba(0, 229, 255, 0.1)', 'rgba(139, 92, 246, 0.05)', 'rgba(0, 229, 255, 0.1)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.introMessage}
                  >
                    <View style={styles.introMessageContent}>
                      <View style={styles.introIcon}>
                        <Sparkles size={32} color="#00E5FF" />
                      </View>
                      <View style={styles.introTextContainer}>
                        <Text style={styles.introTitle}>Generating AI Parlay</Text>
                        <Text style={styles.introText}>
                          {config.legs}-leg {config.riskLevel} {config.betType === 'mixed' ? 'mixed' : config.betType} parlay
                        </Text>
                      </View>
                      <ActivityIndicator size="large" color="#00E5FF" />
                    </View>
                  </LinearGradient>

                  {/* Tool Events with Enhanced Cards */}
                  {toolEvents.map((event, index) => (
                    <Animated.View
                      key={index}
                      style={[
                        styles.toolEvent,
                        index === toolEvents.length - 1 && currentTool === event.type && styles.toolEventActive
                      ]}
                    >
                      <LinearGradient
                        colors={
                          index === toolEvents.length - 1 && currentTool === event.type 
                            ? ['rgba(0, 229, 255, 0.15)', 'rgba(139, 92, 246, 0.08)']
                            : ['rgba(30, 41, 59, 0.9)', 'rgba(15, 23, 42, 0.9)']
                        }
                        style={styles.toolEventGradient}
                      >
                        <View style={styles.toolEventHeader}>
                          <View style={styles.toolIconWrapper}>
                            {getToolIcon(event.type)}
                          </View>
                          <Text style={styles.toolEventText}>{event.message}</Text>
                          {index === toolEvents.length - 1 && currentTool === event.type && (
                            <ActivityIndicator size="small" color="#00E5FF" />
                          )}
                          </View>
                        
                        {/* Show search results if available */}
                        {event.type === 'web_search' && searchResults.length > 0 && (
                          <View style={styles.searchResultsContainer}>
                            {searchResults.slice(0, 3).map((result, idx) => (
                              <View key={idx} style={styles.searchResult}>
                                <View style={styles.searchResultHeader}>
                                  <Globe size={14} color="#00E5FF" />
                                  <Text style={styles.searchResultSource}>{result.source}</Text>
                                </View>
                                <Text style={styles.searchResultTitle}>{result.title}</Text>
                                <Text style={styles.searchResultSnippet} numberOfLines={2}>
                                  {result.snippet}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </LinearGradient>
                    </Animated.View>
                  ))}

                  {/* Current Tool Indicator */}
                  {currentTool && (
                    <View style={styles.currentToolContainer}>
                      <ActivityIndicator size="small" color="#00E5FF" />
                      <Text style={styles.currentToolText}>
                        {getToolMessage(currentTool)}
                      </Text>
                    </View>
                  )}

                  {/* Streaming Text */}
                  {streamingText && (
                    <View style={styles.streamingContainer}>
                      <Markdown style={markdownStyles}>
                        {streamingText}
                      </Markdown>
                    </View>
                  )}
                </>
              ) : parlayResult ? (
                <Animated.View 
                  style={[
                    styles.resultContainer,
                    { opacity: fadeAnim }
                  ]}
                >
                  {/* Success Header */}
                  <LinearGradient
                    colors={['rgba(16, 185, 129, 0.1)', 'rgba(0, 229, 255, 0.05)']}
                    style={styles.successHeader}
                  >
                    <View style={styles.successContent}>
                      <CheckCircle size={28} color="#10B981" />
                      <View style={styles.successTextContainer}>
                        <Text style={styles.successTitle}>Parlay Generated Successfully!</Text>
                        <Text style={styles.successSubtitle}>
                          Your {config.legs}-leg {config.riskLevel} parlay is ready
                        </Text>
                      </View>
                    </View>
                  </LinearGradient>

                  {/* Parlay Content */}
                  <View style={styles.parlayContent}>
                    <Markdown style={markdownStyles}>
                      {parlayResult}
                    </Markdown>
                  </View>

                  {/* Payout Calculator */}
                  {totalOdds > 0 && (
                    <View style={styles.payoutCalculator}>
                      <View style={styles.payoutHeader}>
                        <Calculator size={20} color="#00E5FF" />
                        <Text style={styles.payoutTitle}>Quick Payout Calculator</Text>
                      </View>
                      <View style={styles.payoutInputRow}>
                        <Text style={styles.payoutLabel}>Bet Amount:</Text>
                        <View style={styles.payoutInputWrapper}>
                          <Text style={styles.dollarSign}>$</Text>
                          <TextInput
                            style={styles.payoutInput}
                            value={betAmount}
                            onChangeText={setBetAmount}
                            keyboardType="numeric"
                            placeholder="10"
                            placeholderTextColor="#64748B"
                          />
                        </View>
                        <View style={styles.payoutResult}>
                          <Text style={styles.payoutResultLabel}>To Win:</Text>
                          <Text style={styles.payoutResultAmount}>
                            ${((parseFloat(betAmount) || 0) * totalOdds).toFixed(2)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Action Buttons */}
                  <View style={styles.actionButtons}>
                    <TouchableOpacity 
                      style={styles.copyButton}
                      onPress={async () => {
                        await Clipboard.setStringAsync(parlayResult);
                        // Optional: Add a toast notification here
                      }}
                    >
                      <LinearGradient
                        colors={['#8B5CF6', '#7C3AED']}
                        style={styles.actionButtonGradient}
                      >
                        <Copy size={18} color="#FFFFFF" />
                        <Text style={styles.actionButtonText}>Copy Parlay</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={styles.shareButton}
                      onPress={async () => {
                        const shareMessage = `🎯 Check out my AI-generated parlay:\n\n${parlayResult}\n\n📱 Download Predictive Play for AI parlay building tools, daily picks and insights:\nhttps://apps.apple.com/us/app/predictive-play-ai-betting/id6748275790`;
                        
                        try {
                          await Share.share({
                            message: shareMessage,
                            title: 'My AI Parlay'
                          });
                        } catch (error) {
                          console.error('Error sharing:', error);
                        }
                      }}
                    >
                      <LinearGradient
                        colors={['#00E5FF', '#0891B2']}
                        style={styles.actionButtonGradient}
                      >
                        <Share2 size={18} color="#FFFFFF" />
                        <Text style={styles.actionButtonText}>Share</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              ) : null}
            </ScrollView>
          </Animated.View>
        </LinearGradient>
      </Modal>
    </LinearGradient>
  );
}

const markdownStyles = StyleSheet.create({
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: '#E2E8F0',
  },
  heading1: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginVertical: 12,
  },
  heading2: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginVertical: 10,
  },
  heading3: {
    fontSize: 18,
    fontWeight: '600',
    color: '#00E5FF',
    marginVertical: 8,
  },
  strong: {
    fontWeight: '700',
    color: '#00E5FF',
  },
  em: {
    fontStyle: 'italic',
    color: '#FBBF24',
  },
  bullet_list: {
    marginVertical: 8,
  },
  ordered_list: {
    marginVertical: 8,
  },
  list_item: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  bullet_list_icon: {
    color: '#00E5FF',
    marginRight: 8,
  },
  code_inline: {
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    color: '#00E5FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  code_block: {
    backgroundColor: 'rgba(0, 229, 255, 0.05)',
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  blockquote: {
    borderLeftWidth: 4,
    borderLeftColor: '#00E5FF',
    paddingLeft: 16,
    marginVertical: 8,
  },
  hr: {
    backgroundColor: '#334155',
    height: 1,
    marginVertical: 16,
  },
});

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    padding: 16,
    paddingBottom: 0,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconGradient: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    marginLeft: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  configSection: {
    padding: 16,
  },
  configGroup: {
    marginBottom: 20,
  },
  configLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#CBD5E1',
    marginBottom: 10,
  },
  optionScroll: {
    flexDirection: 'row',
  },
  legOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    marginRight: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  legOptionActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderColor: '#00E5FF',
  },
  legEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  legText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  legTextActive: {
    color: '#00E5FF',
  },
  riskOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  riskOption: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  riskOptionActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
  },
  riskLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 4,
  },
  riskDescription: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },
  betTypeOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  betTypeOption: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  betTypeOptionActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
  },
  betTypeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 4,
  },
  bankrollOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  bankrollOption: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  bankrollOptionActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderColor: '#00E5FF',
  },
  bankrollText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  bankrollTextActive: {
    color: '#00E5FF',
  },
  generateButtonWrapper: {
    marginTop: 16,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalContainer: {
    flex: 1,
  },
  modalContent: {
    flex: 1,
  },
  modalHeaderWrapper: {
    paddingTop: Platform.OS === 'ios' ? 50 : 20, // Safe area for iOS
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 229, 255, 0.1)',
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  modalIconGradient: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  modalTitleText: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  closeButton: {
    padding: 0,
  },
  closeButtonGradient: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  modalScrollView: {
    flex: 1,
    padding: 20,
    paddingBottom: 40,
  },
  introMessage: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
  },
  introMessageContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  introIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  introTextContainer: {
    flex: 1,
  },
  introTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  introText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  toolEvent: {
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  toolEventActive: {
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
  },
  toolEventGradient: {
    padding: 16,
  },
  toolEventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toolIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolEventText: {
    fontSize: 14,
    color: '#CBD5E1',
    flex: 1,
    fontWeight: '600',
  },
  searchResultsContainer: {
    marginTop: 12,
    gap: 8,
  },
  searchResult: {
    backgroundColor: 'rgba(0, 229, 255, 0.05)',
    padding: 10,
    borderRadius: 8,
  },
  searchResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  searchResultSource: {
    fontSize: 11,
    color: '#00E5FF',
    fontWeight: '600',
  },
  searchResultTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E2E8F0',
    marginBottom: 4,
  },
  searchResultSnippet: {
    fontSize: 12,
    color: '#94A3B8',
    lineHeight: 18,
  },
  currentToolContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderRadius: 12,
    marginTop: 8,
  },
  currentToolText: {
    fontSize: 14,
    color: '#00E5FF',
    flex: 1,
  },
  streamingContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#1E293B',
    borderRadius: 12,
  },
  resultContainer: {
    flex: 1,
  },
  successHeader: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  successContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  successTextContainer: {
    flex: 1,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10B981',
  },
  successSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },
  parlayContent: {
    backgroundColor: '#1E293B',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    minHeight: 200,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 40, // Extra padding to avoid cutoff
  },
  copyButton: {
    flex: 1,
  },
  shareButton: {
    flex: 1,
  },
  actionButtonGradient: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  payoutCalculator: {
    backgroundColor: 'rgba(0, 229, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.1)',
  },
  payoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  payoutTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00E5FF',
  },
  payoutInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  payoutLabel: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '600',
  },
  payoutInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 12,
    flex: 1,
    borderWidth: 1,
    borderColor: '#334155',
  },
  dollarSign: {
    fontSize: 16,
    color: '#10B981',
    fontWeight: '600',
    marginRight: 4,
  },
  payoutInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  payoutResult: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    minWidth: 100,
  },
  payoutResultLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 2,
  },
  payoutResultAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10B981',
  },
});
