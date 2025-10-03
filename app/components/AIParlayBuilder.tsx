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
  Flame
} from 'lucide-react-native';
import EventSource from 'react-native-sse';
import Markdown from 'react-native-markdown-display';
import { useSubscription } from '../services/subscriptionContext';
import { supabase } from '../services/api/supabaseClient';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface ParlayConfig {
  legs: number;
  riskLevel: 'safe' | 'balanced' | 'risky';
  betType: 'player' | 'team' | 'mixed';
  bankrollPercentage: number;
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
    bankrollPercentage: 1
  });
  
  const [modalVisible, setModalVisible] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [parlayResult, setParlayResult] = useState<any>(null);
  const [toolEvents, setToolEvents] = useState<ToolEvent[]>([]);
  const [currentTool, setCurrentTool] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

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
          Vibration.vibrate(50);
        } else if (data.type === 'tool_end') {
          setCurrentTool(null);
        } else if (data.type === 'search_results') {
          setSearchResults(data.results || []);
        } else if (data.type === 'complete') {
          setParlayResult(data.parlay);
          setGenerating(false);
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
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#1E293B', '#0F172A']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.titleContainer}>
            <LinearGradient
              colors={['#00E5FF', '#8B5CF6']}
              style={styles.iconGradient}
            >
              <Sparkles size={24} color="#FFFFFF" />
            </LinearGradient>
            <View style={styles.titleText}>
              <Text style={styles.title}>AI Parlay Builder</Text>
              <Text style={styles.subtitle}>Intelligent parlay generation powered by Grok</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

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

        {/* Bankroll Percentage */}
        <View style={styles.configGroup}>
          <Text style={styles.configLabel}>Bankroll Allocation</Text>
          <View style={styles.bankrollOptions}>
            {[0.5, 1, 2, 3].map((value) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.bankrollOption,
                  config.bankrollPercentage === value && styles.bankrollOptionActive
                ]}
                onPress={() => {
                  setConfig({ ...config, bankrollPercentage: value });
                  Vibration.vibrate(10);
                }}
              >
                <Text style={[
                  styles.bankrollText,
                  config.bankrollPercentage === value && styles.bankrollTextActive
                ]}>
                  {value}%
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Generate Button */}
      <TouchableOpacity onPress={generateParlay} disabled={generating}>
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

      {/* Parlay Generation Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => !generating && setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <Animated.View 
            style={[
              styles.modalContent,
              { opacity: fadeAnim }
            ]}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <Sparkles size={24} color="#00E5FF" />
                <Text style={styles.modalTitle}>Generating Your Parlay</Text>
              </View>
              {!generating && (
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  style={styles.closeButton}
                >
                  <X size={24} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            {/* Content Area */}
            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
              {generating ? (
                <>
                  {/* Intro Message */}
                  <View style={styles.introMessage}>
                    <Text style={styles.introText}>
                      🎯 Building your {config.legs}-leg {config.riskLevel} {config.betType === 'mixed' ? '' : config.betType} parlay...
                    </Text>
                  </View>

                  {/* Tool Events */}
                  {toolEvents.map((event, index) => (
                    <Animated.View
                      key={index}
                      style={[styles.toolEvent]}
                    >
                      <View style={styles.toolEventHeader}>
                        {getToolIcon(event.type)}
                        <Text style={styles.toolEventText}>{event.message}</Text>
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
                <View style={styles.resultContainer}>
                  <Markdown style={markdownStyles}>
                    {parlayResult}
                  </Markdown>
                </View>
              ) : null}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </View>
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
    backgroundColor: '#0F172A',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  header: {
    padding: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    margin: 16,
    marginTop: 0,
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
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: screenHeight * 0.85,
    minHeight: screenHeight * 0.5,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 4,
  },
  modalScrollView: {
    flex: 1,
    padding: 20,
  },
  introMessage: {
    backgroundColor: '#1E293B',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  introText: {
    fontSize: 15,
    color: '#CBD5E1',
    lineHeight: 22,
  },
  toolEvent: {
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#00E5FF',
  },
  toolEventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toolEventText: {
    fontSize: 14,
    color: '#CBD5E1',
    flex: 1,
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
    padding: 16,
    backgroundColor: '#1E293B',
    borderRadius: 12,
  },
});
