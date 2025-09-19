import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Modal,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  Keyboard,
  Vibration,
  Pressable,
  Image
} from 'react-native';
import EventSource from 'react-native-sse';
import { LinearGradient } from 'expo-linear-gradient';
import {
  MessageCircle,
  Send,
  X,
  Brain,
  Sparkles,
  ChevronDown,
  Zap,
  Target,
  TrendingUp,
  Shield,
  Clock,
  Globe,
  Search,
  Lightbulb,
  Trophy,
  DollarSign,
  BarChart,
  AlertCircle,
  Crown
} from 'lucide-react-native';
import Markdown from 'react-native-markdown-display';
import { useSubscription } from '../services/subscriptionContext';
import { AIPrediction } from '../services/api/aiService';
import { useAIChat } from '../services/aiChatContext';
import { supabase } from '../services/api/supabaseClient';
import { useReview } from '../hooks/useReview';
import facebookAnalyticsService from '../services/facebookAnalyticsService';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Enhanced Markdown styles for Professor Lock's responses
const markdownStyles = StyleSheet.create({
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: '#E2E8F0',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontWeight: '400',
  },
  strong: {
    fontWeight: '700',
    color: '#00E5FF', // Bright blue for picks
    fontSize: 17,
  },
  em: {
    fontStyle: 'normal',
    color: '#FBBF24', // Gold for emphasis
    fontWeight: '600',
  },
  code_inline: {
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    color: '#00E5FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 15,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '500',
  },
  code_block: {
    backgroundColor: 'rgba(0, 229, 255, 0.05)',
    color: '#E2E8F0',
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '400',
    marginVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
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
    alignItems: 'flex-start',
  },
  bullet_list_icon: {
    color: '#00E5FF',
    fontSize: 16,
    marginRight: 12,
    marginTop: 4,
    fontWeight: '700',
  },
  ordered_list_icon: {
    color: '#00E5FF',
    fontSize: 15,
    fontWeight: '600',
    marginRight: 12,
    marginTop: 3,
    minWidth: 24,
  },
  bullet_list_content: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    color: '#E2E8F0',
  },
  ordered_list_content: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    color: '#E2E8F0',
  },
  heading1: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginVertical: 12,
    letterSpacing: -0.5,
  },
  heading2: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginVertical: 10,
    letterSpacing: -0.3,
  },
  paragraph: {
    marginVertical: 4,
    fontSize: 16,
    lineHeight: 24,
  },
  link: {
    color: '#00E5FF',
    textDecorationLine: 'underline',
    fontWeight: '500',
  },
  hr: {
    backgroundColor: '#334155',
    height: 1,
    marginVertical: 16,
  },
  blockquote: {
    borderLeftWidth: 4,
    borderLeftColor: '#00E5FF',
    paddingLeft: 16,
    marginVertical: 12,
    backgroundColor: 'rgba(0, 229, 255, 0.05)',
    borderRadius: 8,
    paddingVertical: 12,
    paddingRight: 12,
  },
});

interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  toolsUsed?: string[];
  isSearching?: boolean;
  searchQuery?: string;
  searchType?: string;
  isTyping?: boolean;
}

interface ProAIChatProps {
  placeholder?: string;
}

export default function ProAIChat({ 
  placeholder = "Ask about picks, parlays, odds, insights, or betting strategies..."
}: ProAIChatProps) {
  const { isPro, isElite, subscriptionTier, openSubscriptionModal } = useSubscription();
  const { 
    showAIChat, 
    setShowAIChat, 
    messages, 
    setMessages, 
    chatContext, 
    selectedPick,
    canSendMessage,
    incrementFreeUserMessages,
    isLoadingMessageCount,
    freeUserMessageCount
  } = useAIChat();
  
  const { trackPositiveInteraction } = useReview();

  // Get the current user ID for API requests
  const getCurrentUserId = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id || 'anonymous';
    } catch (error) {
      console.error('Error getting user ID:', error);
      return 'anonymous';
    }
  };

  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [pulseAnimation] = useState(new Animated.Value(0));
  const [searchAnimation] = useState(new Animated.Value(0));
  const [dotAnimation1] = useState(new Animated.Value(0));
  const [dotAnimation2] = useState(new Animated.Value(0));
  const [dotAnimation3] = useState(new Animated.Value(0));
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [messageAnimation] = useState(new Animated.Value(0));
  const [welcomeAnimation] = useState(new Animated.Value(0));
  const [buttonScaleAnimation] = useState(new Animated.Value(1));
  const [showQuickPrompts, setShowQuickPrompts] = useState(false);
  const [quickPromptAnim] = useState(new Animated.Value(0));

  // Browsing overlay state
  const [isBrowsing, setIsBrowsing] = useState(false);
  const [browseSteps, setBrowseSteps] = useState<string[]>([]);
  const [browseFrames, setBrowseFrames] = useState<string[]>([]);
  const [activeBrowseJobId, setActiveBrowseJobId] = useState<string | null>(null);

  // Add keyboard listeners with height detection
  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      'keyboardWillShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setKeyboardVisible(true);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );
    
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (e) => {
        if (Platform.OS !== 'ios') {
          setKeyboardHeight(e.endCoordinates.height);
          setKeyboardVisible(true);
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      }
    );
    
    const keyboardWillHideListener = Keyboard.addListener(
      'keyboardWillHide',
      () => {
        setKeyboardVisible(false);
        setKeyboardHeight(0);
      }
    );
    
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        if (Platform.OS !== 'ios') {
          setKeyboardVisible(false);
          setKeyboardHeight(0);
        }
      }
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardDidShowListener.remove();
      keyboardWillHideListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Enhanced animations
  useEffect(() => {
    if (showAIChat && isPro) {
      // Start pulse animation for chat bubble
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Welcome animation
      if (messages.length === 0) {
        Animated.spring(welcomeAnimation, {
          toValue: 1,
          tension: 40,
          friction: 7,
          useNativeDriver: true,
        }).start();
      }
    }
  }, [showAIChat, isPro, messages.length]);

  // Animate quick prompts open/close and auto-close on keyboard
  useEffect(() => {
    Animated.timing(quickPromptAnim, {
      toValue: showQuickPrompts && !keyboardVisible ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start();
  }, [showQuickPrompts, keyboardVisible]);

  useEffect(() => {
    if (keyboardVisible && showQuickPrompts) {
      setShowQuickPrompts(false);
    }
  }, [keyboardVisible]);

  // Pre-fill input with custom prompt when chat opens
  useEffect(() => {
    if (showAIChat && chatContext?.customPrompt) {
      setInputText(chatContext.customPrompt);
    } else if (!showAIChat) {
      setInputText('');
    }
  }, [showAIChat, chatContext?.customPrompt]);

  // Enhanced search animations
  useEffect(() => {
    if (isSearching) {
      // Smooth search loading animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(searchAnimation, {
            toValue: 1,
            duration: 1800,
            useNativeDriver: true,
          }),
          Animated.timing(searchAnimation, {
            toValue: 0,
            duration: 1800,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Enhanced dot animations
      const animateDots = () => {
        Animated.loop(
          Animated.stagger(250, [
            Animated.sequence([
              Animated.spring(dotAnimation1, { toValue: 1, tension: 120, friction: 5, useNativeDriver: true }),
              Animated.timing(dotAnimation1, { toValue: 0.3, duration: 400, useNativeDriver: true }),
            ]),
            Animated.sequence([
              Animated.spring(dotAnimation2, { toValue: 1, tension: 120, friction: 5, useNativeDriver: true }),
              Animated.timing(dotAnimation2, { toValue: 0.3, duration: 400, useNativeDriver: true }),
            ]),
            Animated.sequence([
              Animated.spring(dotAnimation3, { toValue: 1, tension: 120, friction: 5, useNativeDriver: true }),
              Animated.timing(dotAnimation3, { toValue: 0.3, duration: 400, useNativeDriver: true }),
            ]),
          ])
        ).start();
      };
      animateDots();
    } else {
      searchAnimation.stopAnimation();
      dotAnimation1.stopAnimation();
      dotAnimation2.stopAnimation();
      dotAnimation3.stopAnimation();
      searchAnimation.setValue(0);
      dotAnimation1.setValue(0.3);
      dotAnimation2.setValue(0.3);
      dotAnimation3.setValue(0.3);
    }
  }, [isSearching]);

  const sendMessage = async () => {
    if (!inputText.trim() || isTyping) return;

    // Dismiss keyboard when sending message
    Keyboard.dismiss();
    
    // No vibration for send button - removed per user request

    // Button press animation
    Animated.sequence([
      Animated.timing(buttonScaleAnimation, {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScaleAnimation, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    // Check if user can send message (free users limited to 3 messages)
    if (!canSendMessage(isPro)) {
      console.log('🔒 Free user reached message limit, opening subscription modal');
      setInputText('');
      setShowAIChat(false);
      setTimeout(() => {
        openSubscriptionModal();
      }, 300);
      return;
    }

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: inputText,
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const messageText = inputText;
    setInputText('');
    setIsTyping(true);
    setIsSearching(false);

    // Increment free user message count after sending
    if (!isPro) {
      incrementFreeUserMessages();
    }
    
    // Track chat usage with Facebook Analytics
    try {
      facebookAnalyticsService.trackChatUsage(messages.length + 1, isPro ? 'pro' : 'free');
    } catch (error) {
      console.error('Failed to track chat usage with Facebook Analytics:', error);
    }

    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      // Create placeholder for streaming AI response
      const aiMessageId = (Date.now() + 1).toString();
      const aiMessage: ChatMessage = {
        id: aiMessageId,
        text: '',
        isUser: false,
        timestamp: new Date(),
        toolsUsed: [],
        isTyping: true
      };

      setMessages(prev => [...prev, aiMessage]);

      // Call the streaming Grok chatbot API using SSE
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://zooming-rebirth-production-a305.up.railway.app';
      
      try {
        // Use react-native-sse for real-time streaming
        const userId = await getCurrentUserId();
        const requestBody = JSON.stringify({
          message: messageText,
          userId: userId,
          context: {
            screen: chatContext?.screen || 'chat',
            selectedPick: selectedPick,
            userTier: isElite ? 'elite' : (isPro ? 'pro' : 'free'),
            maxPicks: isElite ? 30 : (isPro ? 20 : 2),
            isEliteMode: isElite
          },
          conversationHistory: messages.map(msg => ({
            role: msg.isUser ? 'user' : 'assistant',
            content: msg.text,
            timestamp: msg.timestamp.toISOString()
          }))
        });

        console.log('🌊 Starting SSE connection for chat streaming');
        
        // Create a new EventSource connection
        const eventSource = new EventSource(`${baseUrl}/api/ai/chat/stream`, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
          },
          method: 'POST',
          body: requestBody
        });

        let searchMessage: ChatMessage | null = null;

        // Handle incoming messages
        eventSource.addEventListener('message', (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('📩 SSE message received:', data.type);
            
            if (data.type === 'start') {
              setIsTyping(true);
              setIsSearching(false);
              // Auto-dismiss keyboard when AI starts responding
              Keyboard.dismiss();
            } else if (data.type === 'web_search' || data.type === 'news_search' || data.type === 'team_analysis' || data.type === 'odds_lookup' || data.type === 'insights_analysis') {
              // Enhanced search bubble with proper titles
              const searchMessageId = `search_${Date.now()}`;
              searchMessage = {
                id: searchMessageId,
                text: '',
                isUser: false,
                timestamp: new Date(),
                isSearching: true,
                searchQuery: data.message || 'Analyzing data...',
                searchType: data.type
              };
              
              setMessages(prev => [...prev.slice(0, -1), searchMessage, prev[prev.length - 1]]);
              setIsSearching(true);
              setIsTyping(false);
              
              // No vibration for search actions - too frequent
              
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              }, 100);
            } else if (data.type === 'browser_started') {
              console.log('🌐 Browser started event received:', data);
              setIsBrowsing(true);
              setBrowseSteps([]);
              setBrowseFrames([]);
              setActiveBrowseJobId(data.jobId || null);
            } else if (data.type === 'browser_action') {
              console.log('🌐 Browser action event received:', data);
              if (data.text) {
                setBrowseSteps(prev => [...prev, String(data.text)].slice(-10));
              }
            } else if (data.type === 'browser_frame') {
              console.log('🌐 Browser frame event received:', data);
              if (data.url) {
                setBrowseFrames(prev => [...prev, String(data.url)].slice(-10));
              }
            } else if (data.type === 'browser_error') {
              console.log('🌐 Browser error event received:', data);
              if (data.message) {
                setBrowseSteps(prev => [...prev, `Error: ${String(data.message)}`].slice(-10));
              }
            } else if (data.type === 'browser_done') {
              console.log('🌐 Browser done event received:', data);
              setIsBrowsing(false);
              setActiveBrowseJobId(null);
            } else if (data.type === 'chunk') {
              // Remove search bubble if it exists (only once)
              if (searchMessage) {
                setMessages(prev => prev.filter(msg => !msg.isSearching));
                searchMessage = null;
                setIsSearching(false);
              }
              
              // Batch content updates for smoother streaming
              if (data.content) {
                setMessages(prev => prev.map(msg => 
                  msg.id === aiMessageId 
                    ? { ...msg, text: msg.text + data.content, isTyping: false }
                    : msg
                ));
                
                // Throttled scrolling for better performance
                if (!scrollTimeoutRef.current) {
                  scrollTimeoutRef.current = setTimeout(() => {
                    flatListRef.current?.scrollToEnd({ animated: false });
                    scrollTimeoutRef.current = null;
                  }, 100);
                }
              }
            } else if (data.type === 'complete') {
              // Final message with metadata
              setMessages(prev => prev.map(msg => 
                msg.id === aiMessageId 
                  ? { ...msg, toolsUsed: data.toolsUsed || [], isTyping: false }
                  : msg
              ));
              setIsTyping(false);
              setIsSearching(false);
              
              // No vibration for message completion - too frequent
              
              // Close the connection
              eventSource.close();
              console.log('✅ SSE connection closed - message complete');
            } else if (data.type === 'error') {
              // Error occurred
              setMessages(prev => prev.map(msg => 
                msg.id === aiMessageId 
                  ? { ...msg, text: data.content || "Hit a snag there, champ! Give it another shot in a moment. 🔧", isTyping: false }
                  : msg
              ));
              setIsTyping(false);
              setIsSearching(false);
              
              // No vibration for errors - already disruptive enough
              
              eventSource.close();
              console.log('❌ SSE connection closed - error occurred');
            }
          } catch (parseError) {
            console.warn('Failed to parse SSE data:', event.data);
          }
        });

        // Handle connection open
        eventSource.addEventListener('open', () => {
          console.log('🟢 SSE connection opened');
        });

        // Handle errors
        eventSource.addEventListener('error', (error) => {
          console.error('SSE error:', error);
          
          // Update the message with error information
          setMessages(prev => prev.map(msg => 
            msg.id === aiMessageId 
              ? { ...msg, text: "Technical timeout, friend! Let's try that again in a sec. 🔧", isTyping: false }
              : msg
          ));
          
          setIsTyping(false);
          setIsSearching(false);
          
          eventSource.close();
          console.log('❌ SSE connection closed due to error');
        });
      } catch (error) {
        console.error('Streaming error:', error);
        
        // Add error message
        const errorMessage: ChatMessage = {
          id: (Date.now() + 2).toString(),
          text: "Connection fumbled! Give me another shot in a moment, ace. 🔧",
          isUser: false,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, errorMessage]);
        setIsTyping(false);
        setIsSearching(false);
      }
    } catch (error) {
      console.error('Chat error:', error);
      
      // Add error message
      const errorMessage: ChatMessage = {
        id: (Date.now() + 2).toString(),
        text: "Oops, technical difficulties! Try again in a sec, champion. 🔧",
        isUser: false,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
      setIsSearching(false);
    }
  };

  // Enhanced quick actions with better variety
  const quickActions = [
    { icon: <Trophy size={16} color="#FBBF24" />, text: "Today's Best", action: "What are your top confidence picks today?" },
    { icon: <Zap size={16} color="#00E5FF" />, text: "Smart Parlay", action: "Build me a balanced 3-leg parlay with good value" },
    { icon: <Globe size={16} color="#10B981" />, text: "Breaking News", action: "Any breaking news that could affect today's games?" },
    { icon: <Lightbulb size={16} color="#F59E0B" />, text: "Pro Insights", action: "Show me today's most important betting insights" }
  ];

  // Elite-exclusive quick actions showcasing premium tools
  const eliteQuickActions = [
    { icon: <TrendingUp size={16} color="#FFD700" />, text: "Sharp Money", action: "Show me sharp money movement and line analysis" },
    { icon: <DollarSign size={16} color="#00E5FF" />, text: "Kelly Optimizer", action: "Help me calculate optimal bet sizes for my bankroll" },
    { icon: <BarChart size={16} color="#10B981" />, text: "Market Intel", action: "Find market inefficiencies and soft lines for me" },
    { icon: <Crown size={16} color="#FFD700" />, text: "Elite Parlay", action: "Build an advanced parlay with correlation analysis" }
  ];

  const parlayOptions = [
    { icon: <Shield size={16} color="#10B981" />, text: "Safe 2-Leg", action: "Give me your safest 2-leg parlay for today" },
    { icon: <Target size={16} color="#00E5FF" />, text: "Balanced 3-Leg", action: "Build a balanced 3-leg parlay mixing teams and props" },
    { icon: <DollarSign size={16} color="#FBBF24" />, text: "Value 4-Leg", action: "Create a 4-leg parlay with good odds and value" },
    { icon: <BarChart size={16} color="#EF4444" />, text: "Lottery Ticket", action: "Give me a risky 5-leg parlay for a big payout" }
  ];

  // Elite parlay options with advanced capabilities
  const eliteParlayOptions = [
    { icon: <Crown size={16} color="#FFD700" />, text: "Correlation Analysis", action: "Build a parlay with advanced correlation analysis to avoid conflicts" },
    { icon: <TrendingUp size={16} color="#00E5FF" />, text: "Market Value", action: "Create a parlay targeting market inefficiencies and soft lines" },
    { icon: <Shield size={16} color="#10B981" />, text: "Kelly Optimized", action: "Build a parlay with optimal Kelly Criterion bet sizing" },
    { icon: <Search size={16} color="#F59E0B" />, text: "Live Opportunities", action: "Find live betting parlay opportunities with line movement analysis" }
  ];

  const pulseOpacity = pulseAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1],
  });

  const searchOpacity = searchAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 1],
  });

  const searchScale = searchAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1.05],
  });

  const welcomeScale = welcomeAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1],
  });

  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    // OLD SEARCH BUBBLE REMOVED - Browser overlay handles this now
    if (item.isSearching) {
      return null; // Don't show anything for old search bubbles
    }

    // Enhanced regular message rendering with animations
    const isNewMessage = index === messages.length - 1 && !item.isUser;
    const response = item.text;
    const positiveIndicators = [
      '🔥', '💰', '⭐', '🎯', '💎', '🚀', '🏆', '🎊',
      'perfect', 'excellent', 'amazing', 'outstanding', 'fantastic', 'brilliant',
      'love it', 'great picks', 'solid analysis', 'strong play', 'hot streak',
      'winner', 'crushing it', 'on fire', 'money maker', 'bank it'
    ];
    
    const hasPositiveContent = positiveIndicators.some(indicator => 
      response.toLowerCase().includes(indicator.toLowerCase())
    );
    
    if (hasPositiveContent || response.length > 200) { // Long detailed responses are also positive
      console.log('🎉 Detected very positive AI chat interaction');
      trackPositiveInteraction({ 
        eventType: 'ai_chat_positive', 
        metadata: { chatSatisfaction: 'very_positive' } 
      });
    }

    return (
      <Animated.View 
        style={[
          styles.messageContainer,
          item.isUser ? styles.userMessage : styles.aiMessage,
          isNewMessage && {
            opacity: messageAnimation,
            transform: [{
              translateY: messageAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [10, 0]
              })
            }]
          }
        ]}
      >
        {!item.isUser && (
          <View style={[styles.aiIcon, item.isTyping && styles.aiIconTyping]}>
            <Brain size={18} color="#00E5FF" />
          </View>
        )}
        <View style={[
          styles.messageBubble,
          item.isUser ? styles.userBubble : styles.aiBubble,
          item.isTyping && styles.typingBubble
        ]}>
          {item.isTyping ? (
            <View style={styles.typingIndicator}>
              <Animated.View style={[styles.typingDot, { opacity: dotAnimation1 }]} />
              <Animated.View style={[styles.typingDot, { opacity: dotAnimation2 }]} />
              <Animated.View style={[styles.typingDot, { opacity: dotAnimation3 }]} />
            </View>
          ) : item.isUser ? (
            <Text style={[
              styles.messageText,
              styles.userText
            ]}>
              {item.text}
            </Text>
          ) : (
            <Markdown style={markdownStyles}>
              {item.text || ' '}
            </Markdown>
          )}
          {!item.isTyping && item.toolsUsed && item.toolsUsed.length > 0 && (
            <View style={styles.toolsUsedContainer}>
              {item.toolsUsed.includes('web_search') && (
                <View style={styles.toolBadge}>
                  <Globe size={12} color="#00E5FF" />
                  <Text style={styles.toolBadgeText}>Web</Text>
                </View>
              )}
              {item.toolsUsed.includes('browser_browse') && (
                <View style={styles.toolBadge}>
                  <Globe size={12} color="#00E5FF" />
                  <Text style={styles.toolBadgeText}>Browse</Text>
                </View>
              )}
              {item.toolsUsed.includes('daily_insights') && (
                <View style={styles.toolBadge}>
                  <Lightbulb size={12} color="#FBBF24" />
                  <Text style={styles.toolBadgeText}>Insights</Text>
                </View>
              )}
              {item.toolsUsed.includes('live_odds') && (
                <View style={styles.toolBadge}>
                  <BarChart size={12} color="#10B981" />
                  <Text style={styles.toolBadgeText}>Odds</Text>
                </View>
              )}
            </View>
          )}
          {!item.isTyping && (
            <Text style={styles.timestamp}>
              {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
        </View>
      </Animated.View>
    );
  };

  // Enhanced welcome message
  const renderWelcomeMessage = () => {
    if (messages.length === 0) {
      return (
        <Animated.View style={[
          styles.welcomeContainer,
          {
            opacity: welcomeAnimation,
            transform: [{ scale: welcomeScale }]
          }
        ]}>
          <LinearGradient
            colors={['rgba(0, 229, 255, 0.1)', 'rgba(0, 229, 255, 0.05)']}
            style={styles.welcomeGradient}
          >
            <View style={styles.welcomeIconContainer}>
              <Animated.View style={{ opacity: pulseOpacity }}>
                <Brain size={40} color="#00E5FF" />
              </Animated.View>
              <View style={styles.welcomeSparkles}>
                <Sparkles size={20} color="#FBBF24" />
              </View>
            </View>
            <Text style={styles.welcomeTitle}>{isElite ? 'Professor Lock Elite' : 'Professor Lock'}</Text>
            <Text style={styles.welcomeSubtitle}>{isElite ? '🏆 Elite AI Betting Expert' : 'Your AI Betting Expert'}</Text>
            <Text style={styles.welcomeText}>
              {isElite 
                ? 'I provide elite market intelligence, advanced analytics, and professional-grade betting insights with 8 premium tools at your disposal!'
                : 'I analyze picks, build parlays, track odds, and deliver real-time insights. Let\'s find some value!'
              }
            </Text>
            <View style={styles.welcomeFeatures}>
              {isElite ? (
                <>
                  <View style={styles.welcomeFeature}>
                    <Crown size={16} color="#FFD700" />
                    <Text style={styles.welcomeFeatureText}>Elite Tools</Text>
                  </View>
                  <View style={styles.welcomeFeature}>
                    <TrendingUp size={16} color="#00E5FF" />
                    <Text style={styles.welcomeFeatureText}>Market Intel</Text>
                  </View>
                  <View style={styles.welcomeFeature}>
                    <Shield size={16} color="#10B981" />
                    <Text style={styles.welcomeFeatureText}>Pro Analysis</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.welcomeFeature}>
                    <Trophy size={16} color="#FBBF24" />
                    <Text style={styles.welcomeFeatureText}>Daily Picks</Text>
                  </View>
                  <View style={styles.welcomeFeature}>
                    <Zap size={16} color="#00E5FF" />
                    <Text style={styles.welcomeFeatureText}>Smart Parlays</Text>
                  </View>
                  <View style={styles.welcomeFeature}>
                    <Globe size={16} color="#10B981" />
                    <Text style={styles.welcomeFeatureText}>Live Updates</Text>
                  </View>
                </>
              )}
            </View>
          </LinearGradient>
        </Animated.View>
      );
    }
    return null;
  };

  useEffect(() => {
    // Animate new messages
    if (messages.length > 0) {
      messageAnimation.setValue(0);
      Animated.timing(messageAnimation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [messages.length]);

  // Cleanup scroll timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
    };
  }, []);

  return (
    <Modal visible={showAIChat} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        {/* Enhanced Header */}
        <LinearGradient
          colors={['#1E40AF', '#7C3AED', '#1E40AF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <TouchableOpacity 
            onPress={() => {
              // No vibration for close button - removed per user request
              setShowAIChat(false);
            }} 
            style={styles.closeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <View style={styles.headerTitleContainer}>
              <Animated.View style={{ opacity: pulseOpacity }}>
                <Brain size={26} color="#FFFFFF" />
              </Animated.View>
              <Text style={styles.headerTitle}>{isElite ? 'Professor Lock Elite' : 'Professor Lock'}</Text>
              {!isElite && (
                <View style={styles.proBadge}>
                  <Sparkles size={12} color="#0F172A" />
                  <Text style={styles.proBadgeText}>AI</Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.statusIndicator}>
            <Animated.View style={[styles.onlineIndicator, { opacity: pulseOpacity }]} />
            <Text style={styles.statusText}>Online</Text>
          </View>
        </LinearGradient>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          style={styles.messagesList}
          contentContainerStyle={[
            styles.messagesContainer,
            keyboardVisible && Platform.OS === 'ios' && { paddingBottom: 20 },
            messages.length === 0 && { flexGrow: 1, justifyContent: 'center' }
          ]}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            if (messages.length > 0) {
              flatListRef.current?.scrollToEnd({ animated: true });
            }
          }}
          ListEmptyComponent={renderWelcomeMessage}
        />

        {/* Enhanced Free User Indicator */}
        {!isPro && (
          <LinearGradient
            colors={['rgba(0, 229, 255, 0.1)', 'rgba(0, 229, 255, 0.05)']}
            style={styles.freeUserIndicator}
          >
            <View style={styles.freeUserContent}>
              <View style={styles.freeUserTextContainer}>
                <AlertCircle size={16} color="#00E5FF" />
                <Text style={styles.freeUserText}>
                  {isLoadingMessageCount 
                    ? 'Loading...' 
                    : canSendMessage(isPro) 
                      ? `${3 - freeUserMessageCount} message${(3 - freeUserMessageCount) === 1 ? '' : 's'} left` 
                      : 'Upgrade for unlimited AI access'
                  }
                </Text>
              </View>
              {canSendMessage(isPro) && (
                <View style={styles.chatCounterDots}>
                  {[1, 2, 3].map((dot) => (
                    <View 
                      key={dot} 
                      style={[
                        styles.counterDot, 
                        freeUserMessageCount >= dot ? styles.counterDotUsed : styles.counterDotRemaining
                      ]} 
                    />
                  ))}
                </View>
              )}
            </View>
          </LinearGradient>
        )}

        {/* Enhanced Quick Actions (toggleable) */}
        {showQuickPrompts && !keyboardVisible && (
          <Animated.View
            style={[
              styles.quickActionsContainer,
              { opacity: quickPromptAnim, transform: [{ scaleY: quickPromptAnim }] }
            ]}
          >
            <Text style={styles.quickActionsTitle}>{isElite ? 'Elite Tools' : 'Quick Actions'}</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              style={styles.quickActionsScroll}
            >
              {(isElite ? eliteQuickActions : quickActions).map((action, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.quickActionButton, isElite && styles.eliteQuickActionButton]}
                  onPress={() => {
                    Vibration.vibrate(Platform.OS === 'ios' ? 1 : 10);
                    setInputText(action.action);
                  }}
                >
                  {action.icon}
                  <Text style={[styles.quickActionText, isElite && styles.eliteQuickActionText]}>{action.text}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            {/* Parlay Builder Section */}
            <Text style={styles.quickActionsTitle}>{isElite ? 'Elite Parlay Builder' : 'Parlay Builder'}</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.quickActionsScroll}
            >
              {(isElite ? eliteParlayOptions : parlayOptions).map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.quickActionButton, styles.parlayButton, isElite && styles.eliteQuickActionButton]}
                  onPress={() => {
                    Vibration.vibrate(Platform.OS === 'ios' ? 1 : 10);
                    setInputText(option.action);
                  }}
                >
                  {option.icon}
                  <Text style={[styles.quickActionText, isElite && styles.eliteQuickActionText]}>{option.text}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* Disclaimer removed per UX request */}

        {/* Enhanced Input */}
        <Pressable onPress={() => Keyboard.dismiss()}>
          <View style={[
            styles.inputContainer, 
            keyboardVisible && Platform.OS === 'ios' && { paddingBottom: 0 }
          ]}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder={placeholder}
              placeholderTextColor="#64748B"
              multiline
              maxLength={500}
              blurOnSubmit={false}
              onSubmitEditing={sendMessage}
            />
            {/* Quick Prompts Toggle */}
            <TouchableOpacity
              style={[styles.promptsButton, showQuickPrompts && styles.promptsButtonActive]}
              onPress={() => setShowQuickPrompts(prev => !prev)}
              accessibilityLabel="Toggle quick prompts"
            >
              <Sparkles size={20} color={showQuickPrompts ? '#0F172A' : '#FBBF24'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.sendButton, 
                !inputText.trim() && styles.sendButtonDisabled
              ]}
              onPress={sendMessage}
              disabled={!inputText.trim() || isTyping}
            >
              <Animated.View style={{ transform: [{ scale: buttonScaleAnimation }] }}>
                <Send size={22} color={inputText.trim() ? "#0F172A" : "#64748B"} />
              </Animated.View>
            </TouchableOpacity>
          </View>
          {inputText.length > 400 && (
            <Text style={styles.charCount}>{500 - inputText.length}</Text>
          )}
          </View>
        </Pressable>
      </KeyboardAvoidingView>

      {/* Browsing Overlay */}
      <Modal visible={isBrowsing} transparent animationType="fade">
        <View style={styles.browsingOverlay}>
          <View style={styles.browsingCard}>
            <View style={styles.browsingHeader}>
              <View style={styles.browsingHeaderLeft}>
                <Globe size={18} color="#00E5FF" />
                <Text style={styles.browsingTitle}>Agent is browsing…</Text>
              </View>
              {activeBrowseJobId && !!process.env.EXPO_PUBLIC_BROWSER_AGENT_URL && (
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={async () => {
                    try {
                      const base = process.env.EXPO_PUBLIC_BROWSER_AGENT_URL as string;
                      await fetch(`${base}/jobs/${activeBrowseJobId}/cancel`, { method: 'POST' });
                    } catch {}
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>

            {browseFrames.length > 0 ? (
              <Image
                source={{ uri: browseFrames[browseFrames.length - 1] }}
                style={styles.browsingImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.browsingImagePlaceholder}>
                <ActivityIndicator color="#00E5FF" />
              </View>
            )}

            <View style={styles.browsingSteps}>
              <ScrollView>
                {browseSteps.slice(-5).map((step, idx) => (
                  <Text key={`${idx}_${step}`} style={styles.browsingStepText}>• {step}</Text>
                ))}
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

// Enhanced styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(51, 65, 85, 0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  closeButton: {
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 12,
    letterSpacing: -0.5,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00E5FF',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 6,
  },
  proBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
    marginLeft: 3,
  },

  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  messagesList: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  messagesContainer: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  messageContainer: {
    marginBottom: 20,
  },
  userMessage: {
    alignItems: 'flex-end',
  },
  aiMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  aiIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
  },
  aiIconTyping: {
    backgroundColor: 'rgba(0, 229, 255, 0.25)',
  },
  messageBubble: {
    maxWidth: screenWidth * 0.75,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userBubble: {
    backgroundColor: '#00E5FF',
    borderBottomRightRadius: 6,
  },
  aiBubble: {
    backgroundColor: '#1E293B',
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.5)',
  },
  typingBubble: {
    paddingVertical: 16,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userText: {
    color: '#0F172A',
    fontWeight: '500',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00E5FF',
    marginHorizontal: 3,
  },
  toolsUsedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(51, 65, 85, 0.5)',
    flexWrap: 'wrap',
    gap: 8,
  },
  toolBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
  },
  toolBadgeText: {
    fontSize: 11,
    color: '#E2E8F0',
    marginLeft: 5,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 8,
  },
  
  // Enhanced search bubble styles
  searchBubbleMessage: {
    maxWidth: screenWidth * 0.75,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
  },
  searchBubbleGradient: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  searchBubbleContent: {
    alignItems: 'flex-start',
  },
  searchBubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  searchBubbleTitle: {
    fontSize: 15,
    color: '#00E5FF',
    fontWeight: '700',
    marginLeft: 8,
    letterSpacing: -0.3,
  },
  searchBubbleQuery: {
    fontSize: 14,
    color: 'rgba(226, 232, 240, 0.9)',
    marginBottom: 10,
    lineHeight: 18,
  },
  searchBubbleDots: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchBubbleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00E5FF',
    marginRight: 6,
  },
  
  // Enhanced quick actions
  quickActionsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: 'rgba(51, 65, 85, 0.5)',
  },
  quickActionsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  quickActionsScroll: {
    marginBottom: 12,
  },
  quickActionButton: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.5)',
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  parlayButton: {
    borderColor: 'rgba(0, 229, 255, 0.3)',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
  },
  quickActionText: {
    fontSize: 14,
    color: '#E2E8F0',
    fontWeight: '600',
    marginLeft: 8,
  },
  // Elite quick action styles
  eliteQuickActionButton: {
    borderColor: 'rgba(255, 215, 0, 0.4)',
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    shadowColor: '#FFD700',
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  eliteQuickActionText: {
    color: '#F8FAFC',
    fontWeight: '700',
  },
  
  // Enhanced input styles
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: 'rgba(51, 65, 85, 0.5)',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#1E293B',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.5)',
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#E2E8F0',
    maxHeight: 120,
    paddingVertical: 10,
    paddingRight: 12,
    lineHeight: 24,
    fontWeight: '400',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00E5FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(51, 65, 85, 0.5)',
    shadowOpacity: 0,
  },
  promptsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(251, 191, 36, 0.15)', // amber
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
  },
  promptsButtonActive: {
    backgroundColor: '#FBBF24',
    borderColor: '#FBBF24',
    shadowColor: '#FBBF24',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  charCount: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'right',
    marginTop: 4,
    marginRight: 4,
  },
  
  // Enhanced disclaimer
  disclaimerContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#0F172A',
  },
  disclaimerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.2)',
  },
  disclaimerText: {
    fontSize: 12,
    color: '#64748B',
    marginLeft: 8,
    fontWeight: '500',
  },
  
  // Enhanced free user indicator
  freeUserIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: 'rgba(51, 65, 85, 0.5)',
  },
  freeUserContent: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    alignItems: 'center',
  },
  freeUserTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  freeUserText: {
    fontSize: 14,
    color: '#00E5FF',
    fontWeight: '600',
    marginLeft: 8,
  },
  chatCounterDots: {
    flexDirection: 'row',
    marginTop: 10,
    justifyContent: 'center',
  },
  counterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  counterDotUsed: {
    backgroundColor: '#EF4444',
    opacity: 0.8,
  },
  counterDotRemaining: {
    backgroundColor: '#10B981',
    opacity: 1,
  },
  
  // Enhanced welcome message
  welcomeContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeGradient: {
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
    width: '100%',
  },
  welcomeIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    position: 'relative',
  },
  welcomeSparkles: {
    position: 'absolute',
    top: -5,
    right: -5,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  welcomeSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#00E5FF',
    marginBottom: 16,
  },
  welcomeText: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  welcomeFeatures: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  welcomeFeature: {
    alignItems: 'center',
  },
  welcomeFeatureText: {
    fontSize: 13,
    color: '#E2E8F0',
    marginTop: 6,
    fontWeight: '600',
  },

  // Browsing overlay styles
  browsingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  browsingCard: {
    width: Math.min(screenWidth * 0.9, 420),
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.25)'
  },
  browsingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,229,255,0.2)'
  },
  browsingHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  browsingTitle: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8
  },
  cancelButton: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderColor: 'rgba(239,68,68,0.35)',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10
  },
  cancelButtonText: {
    color: '#FCA5A5',
    fontWeight: '700',
    fontSize: 12
  },
  browsingImage: {
    width: '100%',
    height: 180,
    backgroundColor: '#0B1220'
  },
  browsingImagePlaceholder: {
    width: '100%',
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B1220'
  },
  browsingSteps: {
    maxHeight: 140,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  browsingStepText: {
    color: '#94A3B8',
    fontSize: 13,
    marginBottom: 6
  }
}); 