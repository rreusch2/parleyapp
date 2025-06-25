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
  ActivityIndicator
} from 'react-native';
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
  Search
} from 'lucide-react-native';
import Markdown from 'react-native-markdown-display';
import { useSubscription } from '@/app/services/subscriptionContext';
import { AIPrediction } from '@/app/services/api/aiService';
import { useAIChat } from '@/app/services/aiChatContext';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Markdown styles for Professor Lock's responses
const markdownStyles = StyleSheet.create({
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: '#E2E8F0',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontWeight: '400',
  },
  strong: {
    fontWeight: '600',
    color: '#00E5FF', // Same blue as Professor Lock header
  },
  em: {
    fontStyle: 'normal', // Remove italic style
    color: '#00E5FF', // Blue for emphasis
    fontWeight: '600', // Make it bold instead
  },
  code_inline: {
    backgroundColor: 'transparent',
    color: '#E2E8F0', // Same as body text - no special styling
    paddingHorizontal: 0,
    paddingVertical: 0,
    borderRadius: 0,
    fontSize: 15,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontWeight: '400',
  },
  code_block: {
    backgroundColor: 'transparent',
    color: '#E2E8F0', // Same as body text - no special styling
    padding: 0,
    borderRadius: 0,
    fontSize: 15,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontWeight: '400',
    marginVertical: 2,
  },
  bullet_list: {
    marginVertical: 6,
  },
  ordered_list: {
    marginVertical: 6,
  },
  list_item: {
    flexDirection: 'row',
    marginVertical: 3,
    alignItems: 'flex-start',
  },
  bullet_list_icon: {
    color: '#00E5FF',
    fontSize: 12,
    marginRight: 12,
    marginTop: 5,
    fontWeight: '400',
  },
  ordered_list_icon: {
    color: '#00E5FF',
    fontSize: 14,
    fontWeight: '500',
    marginRight: 10,
    marginTop: 2,
    minWidth: 22,
  },
  bullet_list_content: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: '#E2E8F0',
  },
  ordered_list_content: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: '#E2E8F0',
  },
  heading1: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
    marginVertical: 8,
  },
  heading2: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    marginVertical: 6,
  },
  paragraph: {
    marginVertical: 3,
    fontSize: 15,
    lineHeight: 22,
  },
  link: {
    color: '#00E5FF',
    textDecorationLine: 'none', // Remove underline for cleaner look
    fontWeight: '500',
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
}

interface ProAIChatProps {
  placeholder?: string;
}

export default function ProAIChat({ 
  placeholder = "Ask me anything about betting strategies, picks, or analysis..."
}: ProAIChatProps) {
  const { isPro, openSubscriptionModal } = useSubscription();
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
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const [pulseAnimation] = useState(new Animated.Value(0));
  const [searchAnimation] = useState(new Animated.Value(0));
  const [dotAnimation1] = useState(new Animated.Value(0));
  const [dotAnimation2] = useState(new Animated.Value(0));
  const [dotAnimation3] = useState(new Animated.Value(0));

  useEffect(() => {
    if (showAIChat && isPro) {
      // Start pulse animation for chat bubble
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [showAIChat, isPro]);

  // Pre-fill input with custom prompt when chat opens
  useEffect(() => {
    if (showAIChat && chatContext?.customPrompt) {
      setInputText(chatContext.customPrompt);
    } else if (!showAIChat) {
      // Clear input when chat is closed
      setInputText('');
    }
  }, [showAIChat, chatContext?.customPrompt]);

  // Debug logging for free user state
  useEffect(() => {
    if (!isPro && showAIChat) {
      console.log(`🐛 Free user chat state: messageCount=${freeUserMessageCount}, canSend=${canSendMessage(isPro)}, isLoading=${isLoadingMessageCount}`);
    }
  }, [isPro, showAIChat, freeUserMessageCount, isLoadingMessageCount]);

  useEffect(() => {
    if (isSearching) {
      // Gentle search loading animation (less bouncy)
      Animated.loop(
        Animated.sequence([
          Animated.timing(searchAnimation, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(searchAnimation, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Subtle staggered dot animations
      const animateDots = () => {
        Animated.loop(
          Animated.stagger(300, [
            Animated.sequence([
              Animated.timing(dotAnimation1, { toValue: 1, duration: 600, useNativeDriver: true }),
              Animated.timing(dotAnimation1, { toValue: 0.4, duration: 600, useNativeDriver: true }),
            ]),
            Animated.sequence([
              Animated.timing(dotAnimation2, { toValue: 1, duration: 600, useNativeDriver: true }),
              Animated.timing(dotAnimation2, { toValue: 0.4, duration: 600, useNativeDriver: true }),
            ]),
            Animated.sequence([
              Animated.timing(dotAnimation3, { toValue: 1, duration: 600, useNativeDriver: true }),
              Animated.timing(dotAnimation3, { toValue: 0.4, duration: 600, useNativeDriver: true }),
            ]),
          ])
        ).start();
      };
      animateDots();
    } else {
      // Stop all animations
      searchAnimation.stopAnimation();
      dotAnimation1.stopAnimation();
      dotAnimation2.stopAnimation();
      dotAnimation3.stopAnimation();
      searchAnimation.setValue(0);
      dotAnimation1.setValue(0.4);
      dotAnimation2.setValue(0.4);
      dotAnimation3.setValue(0.4);
    }
  }, [isSearching]);

  const sendMessage = async () => {
    if (!inputText.trim() || isTyping) return;

    // Check if user can send message (free users limited to 1 message)
    if (!canSendMessage(isPro)) {
      console.log('🔒 Free user reached message limit, opening subscription modal');
      // Clear input to prevent confusion
      setInputText('');
      // Close AI chat modal first, then open subscription modal
      setShowAIChat(false);
      // Small delay to ensure AI chat closes before opening subscription modal
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
        toolsUsed: []
      };

      setMessages(prev => [...prev, aiMessage]);

      // Call the streaming Grok chatbot API
      const response = await fetch('http://localhost:3001/api/ai/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageText,
          userId: 'f08b56d3-d4ec-4815-b502-6647d723d2a6', // TODO: Use real user ID
          context: {
            screen: chatContext?.screen || 'chat',
            selectedPick: selectedPick,
            userTier: isPro ? 'pro' : 'free',
            maxPicks: isPro ? 10 : 2 // Pro gets 10 picks, Free gets 2
          },
          conversationHistory: messages.map(msg => ({
            role: msg.isUser ? 'user' : 'assistant',
            content: msg.text,
            timestamp: msg.timestamp.toISOString()
          }))
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response from Grok');
      }

      if (!response.body) {
        throw new Error('No response body for streaming');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'start') {
                // Initial status - keep typing indicator
                setIsTyping(true);
                setIsSearching(false);
              } else if (data.type === 'web_search') {
                // Web search started - add search bubble as a message
                const searchMessageId = `search_${Date.now()}`;
                const searchMessage: ChatMessage = {
                  id: searchMessageId,
                  text: '',
                  isUser: false,
                  timestamp: new Date(),
                  isSearching: true,
                  searchQuery: data.message || 'Searching for latest sports news...'
                };
                
                setMessages(prev => [...prev.slice(0, -1), searchMessage, prev[prev.length - 1]]);
                setIsSearching(true);
                setIsTyping(false);
                
                setTimeout(() => {
                  flatListRef.current?.scrollToEnd({ animated: true });
                }, 100);
              } else if (data.type === 'chunk') {
                // Remove search bubble and start streaming
                setMessages(prev => prev.filter(msg => !msg.isSearching));
                setIsSearching(false);
                setIsTyping(false);
                
                // Append chunk to AI message
                setMessages(prev => prev.map(msg => 
                  msg.id === aiMessageId 
                    ? { ...msg, text: msg.text + data.content }
                    : msg
                ));
                
                // Auto-scroll as content comes in
                setTimeout(() => {
                  flatListRef.current?.scrollToEnd({ animated: false });
                }, 10);
              } else if (data.type === 'complete') {
                // Final message with metadata
                setMessages(prev => prev.map(msg => 
                  msg.id === aiMessageId 
                    ? { ...msg, toolsUsed: data.toolsUsed || [] }
                    : msg
                ));
                setIsTyping(false);
                setIsSearching(false);
              } else if (data.type === 'error') {
                // Error occurred
                setMessages(prev => prev.map(msg => 
                  msg.id === aiMessageId 
                    ? { ...msg, text: data.content || "An error occurred" }
                    : msg
                ));
                setIsTyping(false);
                setIsSearching(false);
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE data:', line);
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      
      // Add error message
      const errorMessage: ChatMessage = {
        id: (Date.now() + 2).toString(),
        text: "Sorry, hit a technical issue. Try again in a sec! 🔧",
        isUser: false,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
      setIsSearching(false);
    }
  };

  const quickActions = [
    { icon: '🔒', text: "Today's Locks", action: "Show me today's locks, Professor" },
    { icon: '🎲', text: "Build Parlay", action: "Build me a 3-leg parlay with your best picks" },
    { icon: '🌐', text: "Latest Sports News", action: "What's the latest news in sports?" },
    { icon: '🎯', text: "Bankroll Tips", action: "Give me your top bankroll management tips" }
  ];

  const pulseOpacity = pulseAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 1],
  });

  const searchOpacity = searchAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1],
  });

  const searchScale = searchAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.98, 1.02],
  });



  const renderMessage = ({ item }: { item: ChatMessage }) => {
    // Special rendering for search bubble messages
    if (item.isSearching) {
      return (
        <View style={[styles.messageContainer, styles.aiMessage]}>
          <View style={styles.aiIcon}>
            <Animated.View style={{ opacity: searchOpacity }}>
              <Search size={16} color="#00E5FF" />
            </Animated.View>
          </View>
          <Animated.View 
            style={[
              styles.searchBubbleMessage,
              {
                opacity: searchOpacity,
                transform: [
                  { scale: searchScale },
                  { translateY: searchAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [2, -1]
                  })}
                ]
              }
            ]}
          >
            <LinearGradient
              colors={['#00E5FF', '#0EA5E9']}
              style={styles.searchBubbleGradient}
            >
              <View style={styles.searchBubbleContent}>
                <View style={styles.searchBubbleHeader}>
                  <Animated.View style={{ opacity: searchOpacity }}>
                    <Globe size={14} color="#FFFFFF" />
                  </Animated.View>
                  <Text style={styles.searchBubbleTitle}>Searching the web</Text>
                </View>
                <Text style={styles.searchBubbleQuery}>
                  {item.searchQuery || 'Looking for latest sports news...'}
                </Text>
                <View style={styles.searchBubbleDots}>
                  <Animated.View style={[styles.searchBubbleDot, { opacity: dotAnimation1 }]} />
                  <Animated.View style={[styles.searchBubbleDot, { opacity: dotAnimation2 }]} />
                  <Animated.View style={[styles.searchBubbleDot, { opacity: dotAnimation3 }]} />
                </View>
              </View>
            </LinearGradient>
          </Animated.View>
        </View>
      );
    }

    // Regular message rendering
    return (
      <View style={[
        styles.messageContainer,
        item.isUser ? styles.userMessage : styles.aiMessage
      ]}>
        {!item.isUser && (
          <View style={styles.aiIcon}>
            <Brain size={16} color="#00E5FF" />
          </View>
        )}
        <View style={[
          styles.messageBubble,
          item.isUser ? styles.userBubble : styles.aiBubble
        ]}>
          {item.isUser ? (
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
          {item.toolsUsed && item.toolsUsed.length > 0 && (
            <View style={styles.toolsUsedContainer}>
              <Zap size={12} color="#00E5FF" />
              <Text style={styles.toolsUsedText}>
                Tools: {item.toolsUsed.join(', ')}
              </Text>
            </View>
          )}
          <Text style={styles.timestamp}>
            {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={showAIChat} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <LinearGradient
          colors={['#1E40AF', '#7C3AED']}
          style={styles.header}
        >
          <TouchableOpacity onPress={() => setShowAIChat(false)} style={styles.closeButton}>
            <X size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <View style={styles.headerTitleContainer}>
              <Animated.View style={{ opacity: pulseOpacity }}>
                <Brain size={24} color="#FFFFFF" />
              </Animated.View>
              <Text style={styles.headerTitle}>Professor Lock</Text>
            </View>
            <Text style={styles.headerSubtitle}>Powered by Grok-3</Text>
          </View>
          <View style={styles.statusIndicator}>
            <View style={styles.onlineIndicator} />
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
          contentContainerStyle={styles.messagesContainer}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />



        {/* Free User Message Limit Indicator */}
        {!isPro && (
          <View style={styles.freeUserIndicator}>
            <View style={styles.freeUserContent}>
              <Text style={styles.freeUserText}>
                {isLoadingMessageCount 
                  ? '⏳ Loading...' 
                  : canSendMessage(isPro) 
                    ? '🎯 1 free message remaining' 
                    : '🔒 Upgrade for unlimited AI chat'
                }
              </Text>
            </View>
          </View>
        )}

        {/* Quick Actions */}
        {messages.length <= 1 && (
          <View style={styles.quickActionsContainer}>
            <Text style={styles.quickActionsTitle}>Quick Plays:</Text>
            <View style={styles.quickActions}>
              {quickActions.map((action, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.quickActionButton}
                  onPress={() => {
                    // Quick actions should always populate input field - restriction only applies when sending
                    setInputText(action.action);
                  }}
                >
                  <Text style={styles.quickActionIcon}>{action.icon}</Text>
                  <Text style={styles.quickActionText}>{action.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Parlay Quick Options */}
            <Text style={[styles.quickActionsTitle, { marginTop: 16, marginBottom: 8 }]}>Parlay Builder:</Text>
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={styles.quickActionButton}
                onPress={() => {
                  // Quick actions should always populate input field - restriction only applies when sending
                  setInputText("Build me a safe 2-leg parlay");
                }}
              >
                <Text style={styles.quickActionIcon}>🎯</Text>
                <Text style={styles.quickActionText}>2-Leg Safe</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickActionButton}
                onPress={() => {
                  // Quick actions should always populate input field - restriction only applies when sending
                  setInputText("Give me a 4-leg parlay for bigger payout");
                }}
              >
                <Text style={styles.quickActionIcon}>🔥</Text>
                <Text style={styles.quickActionText}>4-Leg Risky</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* AI Disclaimer */}
        <View style={styles.disclaimerContainer}>
          <View style={styles.disclaimerContent}>
            <Shield size={12} color="#64748B" />
            <Text style={styles.disclaimerText}>
              AI can make mistakes. Verify important info and bet responsibly.
            </Text>
          </View>
        </View>

        {/* Input */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder={placeholder}
              placeholderTextColor="#64748B"
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
              onPress={() => {
                console.log(`🔘 Send button clicked: isPro=${isPro}, canSend=${canSendMessage(isPro)}, inputText="${inputText.trim()}", isTyping=${isTyping}`);
                sendMessage();
              }}
              disabled={!inputText.trim() || isTyping}
            >
              <Send size={20} color={inputText.trim() ? "#FFFFFF" : "#64748B"} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  closeButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 12,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
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
    fontSize: 11,
    color: '#10B981',
    fontWeight: '600',
  },
  upgradeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 32,
  },
  upgradeContent: {
    alignItems: 'center',
  },
  upgradeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 12,
  },
  upgradeText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  upgradeButton: {
    backgroundColor: '#00E5FF',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
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
    marginBottom: 18,
  },
  userMessage: {
    alignItems: 'flex-end',
  },
  aiMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  aiIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 4,
  },
  messageBubble: {
    maxWidth: screenWidth * 0.75,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userBubble: {
    backgroundColor: '#00E5FF',
    borderBottomRightRadius: 6,
  },
  aiBubble: {
    backgroundColor: '#1E293B',
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  userText: {
    color: '#0F172A',
    fontWeight: '500',
  },
  toolsUsedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  toolsUsedText: {
    fontSize: 11,
    color: '#00E5FF',
    marginLeft: 4,
    fontWeight: '500',
  },
  timestamp: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 6,
  },

  quickActionsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  quickActionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickActionButton: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 8,
    width: '48%',
  },
  quickActionIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  quickActionText: {
    fontSize: 12,
    color: '#E2E8F0',
    fontWeight: '500',
    flex: 1,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#1E293B',
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#E2E8F0',
    maxHeight: 120,
    paddingVertical: 10,
    paddingRight: 12,
    lineHeight: 22,
    fontWeight: '400',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#00E5FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#334155',
  },
  
  // Search Bubble Message Styles (in conversation flow)
  searchBubbleMessage: {
    maxWidth: screenWidth * 0.75,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    overflow: 'hidden',
  },
  searchBubbleGradient: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchBubbleContent: {
    alignItems: 'flex-start',
  },
  searchBubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  searchBubbleTitle: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
    marginLeft: 8,
  },
  searchBubbleQuery: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    fontStyle: 'italic',
    marginBottom: 8,
    lineHeight: 16,
  },
  searchBubbleDots: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchBubbleDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFFFFF',
    marginRight: 4,
  },
  
  // AI Disclaimer Styles
  disclaimerContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: '#0F172A',
  },
  disclaimerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(100, 116, 139, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.2)',
  },
  disclaimerText: {
    fontSize: 11,
    color: '#64748B',
    marginLeft: 6,
    fontWeight: '400',
    textAlign: 'center',
  },
  
  // Free User Indicator Styles
  freeUserIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  freeUserContent: {
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    alignItems: 'center',
  },
  freeUserText: {
    fontSize: 12,
    color: '#00E5FF',
    fontWeight: '600',
    textAlign: 'center',
  },
}); 