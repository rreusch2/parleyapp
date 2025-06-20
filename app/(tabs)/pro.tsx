import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Platform,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  FlatList,
  Dimensions,
  ImageBackground,
  RefreshControl
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Lock, 
  Unlock, 
  Crown, 
  Zap, 
  TrendingUp, 
  Target, 
  BarChart3, 
  Star,
  CheckCircle,
  Sparkles,
  Brain,
  Shield,
  Award,
  Infinity,
  Calendar,
  Users,
  Bell,
  Settings,
  MessageCircle,
  Send,
  Mic,
  MoreHorizontal,
  DollarSign,
  Eye,
  Rocket,
  Globe,
  ArrowRight,
  Play,
  TrendingDown,
  Clock,
  ChevronRight,
  Calculator,
  RefreshCw
} from 'lucide-react-native';
import { aiService, AIPrediction } from '../services/api/aiService';
import { applePaymentService, SubscriptionPlan } from '../services/paymentService';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  isStreaming?: boolean;
}

export default function ProScreen() {
  const [isSubscribed, setIsSubscribed] = useState(__DEV__ ? false : false); // Set to false for landing page view
  const [lockAnimation] = useState(new Animated.Value(0));
  const [glowAnimation] = useState(new Animated.Value(0));
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('yearly');
  
  // Enhanced animations
  const [floatingAnimation] = useState(new Animated.Value(0));
  const [pulseAnimation] = useState(new Animated.Value(0));
  const [slideInAnimation] = useState(new Animated.Value(-50));
  const [fadeInAnimation] = useState(new Animated.Value(0));
  const [rotateAnimation] = useState(new Animated.Value(0));
  
  // Real AI Picks State
  const [todaysPicks, setTodaysPicks] = useState<AIPrediction[]>([]);
  const [isLoadingPicks, setIsLoadingPicks] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pickStats, setPickStats] = useState({
    totalPicks: 0,
    avgConfidence: 0,
    avgEdge: 0,
    sportsBreakdown: {} as Record<string, number>,
    betTypeBreakdown: {} as Record<string, number>
  });
  
  // AI Chat State
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      text: `🤖 Hey! I'm your Enhanced DeepSeek AI betting analyst. I have access to:\n\n🎯 Today's AI picks and analysis\n📊 Real-time odds and edge detection\n🧠 ML predictions (66.9% accuracy)\n💰 Value opportunities across multiple sports\n\nAsk me anything about today's games, betting strategies, or use the quick actions below! 🚀`,
      isUser: false,
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  // Chat scroll reference
  const flatListRef = useRef<FlatList>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  
  // Demo chat for landing page
  const [showDemoChat, setShowDemoChat] = useState(false);

  useEffect(() => {
    startAnimations();
    if (isSubscribed) {
      loadTodaysPicks();
    }
  }, [isSubscribed]);

  const loadTodaysPicks = async () => {
    try {
      setIsLoadingPicks(true);
      console.log('🔄 Loading today\'s picks...');
      const picks = await aiService.getTodaysPicks();
      console.log(`📊 Loaded ${picks.length} picks from database`);
      setTodaysPicks(picks);
      calculatePickStats(picks);
    } catch (error) {
      console.error('❌ Error loading today\'s picks:', error);
    } finally {
      setIsLoadingPicks(false);
    }
  };

  const calculatePickStats = (picks: AIPrediction[]) => {
    if (picks.length === 0) {
      setPickStats({
        totalPicks: 0,
        avgConfidence: 0,
        avgEdge: 0,
        sportsBreakdown: {},
        betTypeBreakdown: {}
      });
      return;
    }

    const totalPicks = picks.length;
    const avgConfidence = picks.reduce((sum, pick) => sum + pick.confidence, 0) / totalPicks;
    const avgEdge = picks.reduce((sum, pick) => sum + (pick.value || 0), 0) / totalPicks;
    
    const sportsBreakdown: Record<string, number> = {};
    const betTypeBreakdown: Record<string, number> = {};
    
    picks.forEach(pick => {
      sportsBreakdown[pick.sport] = (sportsBreakdown[pick.sport] || 0) + 1;
      
      // Extract bet type from pick string
      if (pick.pick.includes('ML') || pick.pick.includes('Moneyline')) {
        betTypeBreakdown['Moneyline'] = (betTypeBreakdown['Moneyline'] || 0) + 1;
      } else if (pick.pick.includes('OVER') || pick.pick.includes('UNDER')) {
        betTypeBreakdown['Total'] = (betTypeBreakdown['Total'] || 0) + 1;
      } else if (pick.pick.includes('+') || pick.pick.includes('-')) {
        betTypeBreakdown['Spread'] = (betTypeBreakdown['Spread'] || 0) + 1;
      } else {
        betTypeBreakdown['Other'] = (betTypeBreakdown['Other'] || 0) + 1;
      }
    });

    setPickStats({
      totalPicks,
      avgConfidence,
      avgEdge,
      sportsBreakdown,
      betTypeBreakdown
    });
  };

  const onRefreshPicks = async () => {
    setRefreshing(true);
    await loadTodaysPicks();
    setRefreshing(false);
  };



  useEffect(() => {
    if (isSubscribed) {
      loadTodaysPicks();
    }
    startAnimations();
  }, [isSubscribed]);

  const startAnimations = () => {
    // Floating animation for hero elements
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatingAnimation, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(floatingAnimation, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Pulse animation for CTA button
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

    // Slide in animation for content
    Animated.timing(slideInAnimation, {
      toValue: 0,
      duration: 1000,
      useNativeDriver: true,
    }).start();

    // Fade in animation
    Animated.timing(fadeInAnimation, {
      toValue: 1,
      duration: 1200,
      useNativeDriver: true,
    }).start();

    // Rotation animation for accent elements
    Animated.loop(
      Animated.timing(rotateAnimation, {
        toValue: 1,
        duration: 20000,
        useNativeDriver: true,
      })
    ).start();

    // Glow animation for premium features
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnimation, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnimation, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: inputText,
      isUser: true,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    const messageText = inputText;
    setInputText('');
    setIsTyping(true);

    // Auto-scroll to bottom after user message
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      // Get AI response based on message context
      const aiResponse = await getAIResponse(messageText, todaysPicks);
      
      const response: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: aiResponse,
        isUser: false,
        timestamp: new Date()
      };
      
      setChatMessages(prev => [...prev, response]);
      
      // Auto-scroll to bottom after AI response
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error getting AI response:', error);
      const fallbackResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: "I'm having trouble analyzing the data right now. Please try again in a moment.",
        isUser: false,
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, fallbackResponse]);
      
      // Auto-scroll to bottom even for error messages
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } finally {
      setIsTyping(false);
    }
  };

  const handleScroll = (event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const isNearBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 100;
    setShowScrollToBottom(!isNearBottom);
  };

  const scrollToBottom = () => {
    flatListRef.current?.scrollToEnd({ animated: true });
    setShowScrollToBottom(false);
  };

  const getAIResponse = async (message: string, picks: AIPrediction[]): Promise<string> => {
    const lowerMessage = message.toLowerCase();
    
    // Handle specific queries about picks
    if (lowerMessage.includes('pick') || lowerMessage.includes('tonight') || lowerMessage.includes('today')) {
      if (picks.length === 0) {
        return "I don't see any AI picks generated for today yet. Our Enhanced DeepSeek Orchestrator runs daily to analyze games and find the best value opportunities. Try refreshing the page or ask me about upcoming games!";
      }
      
      const topPicks = picks.slice(0, 3);
      let response = `🎯 Here are my top ${topPicks.length} AI picks for today:\n\n`;
      
      topPicks.forEach((pick, index) => {
        response += `${index + 1}. **${pick.match}**\n`;
        response += `   📊 Pick: ${pick.pick}\n`;
        response += `   💰 Odds: ${pick.odds}\n`;
        response += `   🔥 Confidence: ${pick.confidence}%\n`;
        if (pick.value) {
          response += `   ⚡ Edge: ${pick.value.toFixed(1)}%\n`;
        }
        response += `   📝 ${pick.reasoning.substring(0, 100)}...\n\n`;
      });
      
      response += `These picks are generated by our Enhanced DeepSeek Orchestrator using ML predictions (66.9% accuracy) and real-time odds from The Odds API. Want analysis on a specific game?`;
      return response;
    }
    
         // Handle questions about strategy or analysis
     if (lowerMessage.includes('strategy') || lowerMessage.includes('analyze') || lowerMessage.includes('how')) {
       return `🧠 Our AI betting strategy focuses on:\n\n✅ **Value Detection**: Finding edges where our ML model disagrees with bookmaker odds\n✅ **Risk Management**: Only selecting picks with 55%+ win probability\n✅ **Real-Time Data**: Using live odds from FanDuel, DraftKings, BetMGM\n✅ **Multiple Markets**: Moneylines, totals, and spread analysis\n\nWe currently have ${picks.length} active picks with an average ${pickStats.avgConfidence.toFixed(1)}% confidence level. Ask me about specific games or teams!`;
     }

     // Handle value/edge questions
     if (lowerMessage.includes('value') || lowerMessage.includes('edge') || lowerMessage.includes('highest') || lowerMessage.includes('best')) {
       if (picks.length === 0) {
         return "No picks available right now. Our Enhanced DeepSeek Orchestrator analyzes games throughout the day to find value opportunities!";
       }
       
       const sortedByEdge = picks.filter(p => p.value).sort((a, b) => (b.value || 0) - (a.value || 0));
       const topValue = sortedByEdge.slice(0, 2);
       
       if (topValue.length === 0) {
         return "I don't see edge data for current picks. Check back soon as our system updates throughout the day!";
       }
       
       let response = `⚡ Here are the highest value opportunities:\n\n`;
       topValue.forEach((pick, index) => {
         response += `${index + 1}. **${pick.match}** - ${pick.value?.toFixed(1)}% edge\n`;
         response += `   📊 ${pick.pick} at ${pick.odds}\n`;
         response += `   🔥 ${pick.confidence}% confidence\n\n`;
       });
       
       response += `These represent the biggest discrepancies between our ML predictions and bookmaker odds. Higher edge = better value!`;
       return response;
     }

     // Handle sports-specific questions
     if (lowerMessage.includes('mlb') || lowerMessage.includes('baseball')) {
       const mlbPicks = picks.filter(p => p.sport.toLowerCase().includes('mlb') || p.sport.toLowerCase().includes('baseball'));
       if (mlbPicks.length === 0) {
         return "No MLB picks available right now. Our system analyzes baseball games daily during the season!";
       }
       return `⚾ Found ${mlbPicks.length} MLB picks:\n\n${mlbPicks.map(p => `• ${p.match}: ${p.pick} (${p.confidence}% confidence)`).join('\n')}\n\nMLB analysis focuses on pitcher matchups, recent form, and weather conditions.`;
     }

     if (lowerMessage.includes('nba') || lowerMessage.includes('basketball')) {
       const nbaPicks = picks.filter(p => p.sport.toLowerCase().includes('nba') || p.sport.toLowerCase().includes('basketball'));
       if (nbaPicks.length === 0) {
         return "No NBA picks available right now. Check back during basketball season for comprehensive NBA analysis!";
       }
       return `🏀 Found ${nbaPicks.length} NBA picks:\n\n${nbaPicks.map(p => `• ${p.match}: ${p.pick} (${p.confidence}% confidence)`).join('\n')}\n\nNBA analysis considers pace, defensive efficiency, and injury reports.`;
     }
    
    // Handle questions about specific teams or games
    const teamMentioned = picks.find(pick => 
      pick.match.toLowerCase().includes(lowerMessage) || 
      lowerMessage.includes(pick.match.toLowerCase().split(' ')[0]) ||
      lowerMessage.includes(pick.match.toLowerCase().split(' ').pop() || '')
    );
    
    if (teamMentioned) {
      return `🎯 Found analysis for **${teamMentioned.match}**:\n\n📊 **Our Pick**: ${teamMentioned.pick}\n💰 **Odds**: ${teamMentioned.odds}\n🔥 **Confidence**: ${teamMentioned.confidence}%\n${teamMentioned.value ? `⚡ **Edge**: ${teamMentioned.value.toFixed(1)}%\n` : ''}📝 **Analysis**: ${teamMentioned.reasoning}\n\nThis pick was selected by our Enhanced DeepSeek Orchestrator from ML predictions. Want details on another game?`;
    }
    
    // Default response with helpful suggestions
    return `🤖 I'm your AI betting analyst powered by the Enhanced DeepSeek Orchestrator! I can help you with:\n\n🎯 Today's AI picks and analysis\n📊 Game-specific insights and strategies  \n💰 Value opportunities and edge detection\n🏀 Team analysis and matchup breakdowns\n\nTry asking: "What are your picks?" or "Analyze [team name]" or "What's your strategy?"`;
  };

  const renderChatModal = () => (
    <Modal
      visible={showChat}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={() => setShowChat(false)}
    >
      <View style={styles.chatContainer}>
        <LinearGradient
          colors={['#0F172A', '#1E293B']}
          style={styles.chatGradient}
        >
          {/* Enhanced Chat Header */}
          <View style={styles.chatHeader}>
            <View style={styles.chatHeaderInfo}>
              <View style={styles.aiAvatarLarge}>
                <Brain size={24} color="#00E5FF" />
                <View style={styles.aiStatusDot} />
              </View>
              <View>
                <Text style={styles.chatHeaderTitle}>Enhanced DeepSeek AI</Text>
                <View style={styles.chatStatusContainer}>
                  <View style={styles.liveIndicator} />
                  <Text style={styles.chatHeaderSubtitle}>Live • {todaysPicks.length} picks analyzed</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity onPress={() => setShowChat(false)} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Action Buttons */}
          <View style={styles.quickActionsContainer}>
            <Text style={styles.quickActionsTitle}>Quick Actions</Text>
            <View style={styles.quickActionsGrid}>
              <TouchableOpacity 
                style={styles.quickActionButton}
                onPress={() => {
                  setInputText("What are your picks for tonight?");
                  sendMessage();
                }}
              >
                <Text style={styles.quickActionIcon}>🎯</Text>
                <Text style={styles.quickActionText}>Today's Picks</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.quickActionButton}
                onPress={() => {
                  setInputText("What's your betting strategy?");
                  sendMessage();
                }}
              >
                <Text style={styles.quickActionIcon}>🧠</Text>
                <Text style={styles.quickActionText}>AI Strategy</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.quickActionButton}
                onPress={() => {
                  setInputText("Show me the highest edge opportunities");
                  sendMessage();
                }}
              >
                <Text style={styles.quickActionIcon}>⚡</Text>
                <Text style={styles.quickActionText}>Best Value</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.quickActionButton}
                onPress={() => {
                  setInputText("Analyze upcoming games");
                  sendMessage();
                }}
              >
                <Text style={styles.quickActionIcon}>📊</Text>
                <Text style={styles.quickActionText}>Game Analysis</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Messages */}
          <View style={{ flex: 1 }}>
            <FlatList
              ref={flatListRef}
              data={chatMessages}
              keyExtractor={(item) => item.id}
              style={styles.messagesContainer}
              contentContainerStyle={styles.messagesContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              renderItem={({ item }) => (
                <View style={[styles.messageContainer, item.isUser ? styles.userMessage : styles.aiMessage]}>
                  <View style={[styles.messageBubble, item.isUser ? styles.userBubble : styles.aiBubble]}>
                    <Text style={[styles.messageText, item.isUser ? styles.userText : styles.aiText]}>
                      {item.text}
                    </Text>
                  </View>
                </View>
              )}
            />
          </View>

          {/* Scroll to Bottom Button */}
          {showScrollToBottom && (
            <TouchableOpacity style={styles.scrollToBottomButton} onPress={scrollToBottom}>
              <View style={styles.scrollToBottomCircle}>
                <ChevronRight size={20} color="#FFFFFF" style={{ transform: [{ rotate: '90deg' }] }} />
              </View>
            </TouchableOpacity>
          )}

          {isTyping && (
            <View style={styles.typingIndicator}>
              <Text style={styles.typingText}>AI is thinking...</Text>
            </View>
          )}

          {/* Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.messageInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask about any game or strategy..."
              placeholderTextColor="#64748B"
              multiline
            />
            <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
              <Send size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    </Modal>
  );

  const handleSubscription = async (planId: 'weekly' | 'monthly' | 'yearly' | 'lifetime') => {
    try {
      console.log(`🛒 Starting subscription for plan: ${planId}`);
      
      if (Platform.OS !== 'ios') {
        Alert.alert(
          'iOS Only',
          'Apple In-App Purchases are only available on iOS devices. Web and Android payments coming soon!',
          [{ text: 'OK' }]
        );
        return;
      }

      // Show loading state
      Alert.alert(
        'Processing Purchase',
        'Please wait while we process your subscription...',
        [{ text: 'OK' }]
      );

      // Attempt to purchase the subscription
      const result = await applePaymentService.purchaseSubscription(planId, 'user-id-here'); // You'll need to get the actual user ID
      
      if (result.success) {
        console.log('✅ Purchase successful!');
        setIsSubscribed(true);
        
        // The success alert is already shown in the payment service
        // Additional success handling can go here
      } else {
        console.error('❌ Purchase failed:', result.error);
        // Error alerts are already shown in the payment service
      }
    } catch (error) {
      console.error('❌ Subscription error:', error);
      Alert.alert(
        'Purchase Error',
        'Something went wrong. Please try again or contact support.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleRestorePurchases = async () => {
    try {
      console.log('🔄 Restoring purchases...');
      const success = await applePaymentService.restorePurchases('user-id-here'); // You'll need to get the actual user ID
      
      if (success) {
        // Check subscription status after restore
        const subscriptionStatus = await applePaymentService.validateSubscription('user-id-here');
        if (subscriptionStatus.isActive) {
          setIsSubscribed(true);
          Alert.alert(
            'Purchases Restored!',
            'Your subscription has been restored and is now active.',
            [{ text: 'Great!' }]
          );
        }
      }
    } catch (error) {
      console.error('❌ Restore failed:', error);
      Alert.alert(
        'Restore Failed',
        'Unable to restore purchases. Please contact support if you believe this is an error.',
        [{ text: 'OK' }]
      );
    }
  };

  // Use the subscription plans from the payment service
  const pricingPlans = applePaymentService.subscriptionPlans.map(plan => ({
    ...plan,
    popular: plan.id === 'monthly',
    badge: plan.id === 'lifetime' ? 'Best Value' : undefined,
    originalPrice: plan.id === 'yearly' ? '$299.88' : plan.id === 'lifetime' ? '$599.99' : undefined,
    savings: plan.id === 'yearly' ? 'Save 33%' : plan.id === 'lifetime' ? 'Save 42%' : undefined,
  }));

  // Fallback pricing plans if payment service isn't available
  const fallbackPricingPlans = [
    {
      id: 'weekly',
      title: 'Weekly Trial',
      price: '$8.99',
      period: '/week',
      features: [
        'AI Predictions (5 per day)',
        'Basic Chat Support', 
        'Standard Sports Coverage',
        'Mobile Access'
      ],
      popular: false,
      limits: {
        dailyPicks: 5,
        sports: ['MLB', 'NBA'],
        features: ['basic_chat', 'standard_odds']
      }
    },
    {
      id: 'monthly',
      title: 'Pro Monthly',
      price: '$24.99',
      period: '/month',
      features: [
        'Unlimited AI Predictions',
        'Enhanced DeepSeek Orchestrator', 
        'Priority Chat Support',
        'All Sports Coverage',
        'Real-time Odds Integration',
        'Edge Detection System'
      ],
      popular: true,
      limits: {
        dailyPicks: 'unlimited',
        sports: ['MLB', 'NBA', 'NFL', 'NHL', 'MLS'],
        features: ['enhanced_chat', 'real_time_odds', 'edge_detection']
      }
    },
    {
      id: 'yearly',
      title: 'Pro Annual',
      price: '$199.99',
      period: '/year',
      originalPrice: '$299.88',
      savings: 'Save 33%',
      features: [
        'Everything in Pro Monthly',
        'Python ML Server Access (66.9% accuracy)',
        'VIP Priority Support',
        'Exclusive Betting Strategies',
        'Portfolio Analytics',
        'Custom Risk Management'
      ],
      popular: false,
      limits: {
        dailyPicks: 'unlimited',
        sports: ['all'],
        features: ['all', 'ml_server', 'vip_support', 'portfolio_analytics']
      }
    },
    {
      id: 'lifetime',
      title: 'Lifetime Pro',
      price: '$349.99',
      period: 'one-time',
      originalPrice: '$599.99',
      savings: 'Save 42%',
      features: [
        'Everything in Pro Annual',
        'Lifetime Access - Never Pay Again',
        'Real-time Streaming Analysis',
        'Custom Model Training',
        'Priority Feature Requests',
        'Exclusive Beta Access'
      ],
      popular: false,
      badge: 'Best Value',
      limits: {
        dailyPicks: 'unlimited',
        sports: ['all'],
        features: ['all', 'lifetime', 'streaming', 'custom_models', 'beta_access']
      }
    }
  ];

  if (isSubscribed) {
      return (
    <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={styles.dashboardContainer} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefreshPicks}
            tintColor="#00E5FF"
            colors={['#00E5FF']}
          />
        }
      >
        
        {/* Stunning Dashboard Header */}
        <LinearGradient
          colors={['#1E293B', '#334155', '#7C3AED']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.dashboardHeader}
        >
          {/* Floating Orbs */}
          <Animated.View style={[styles.floatingOrb, styles.orb1, {
            transform: [{
              translateY: floatingAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -10]
              })
            }, {
              rotate: rotateAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '360deg']
              })
            }]
          }]}>
            <LinearGradient colors={['rgba(0,229,255,0.4)', 'rgba(124,58,237,0.2)']} style={styles.orbGradient} />
          </Animated.View>
          
          <Animated.View style={[styles.floatingOrb, styles.orb2, {
            transform: [{
              translateY: floatingAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 8]
              })
            }]
          }]}>
            <LinearGradient colors={['rgba(16,185,129,0.3)', 'rgba(0,229,255,0.2)']} style={styles.orbGradient} />
          </Animated.View>

          <View style={styles.headerContent}>
            {/* User Welcome */}
            <View style={styles.welcomeSection}>
              <Text style={styles.welcomeText}>Welcome back,</Text>
              <Text style={styles.usernameText}>Pro Bettor! 🔥</Text>
              <View style={styles.statusBadge}>
                <View style={styles.liveIndicator} />
                <Text style={styles.statusText}>AI ACTIVE</Text>
              </View>
            </View>

            {/* Real AI Performance */}
            <View style={styles.todayPerformance}>
              <Text style={styles.performanceLabel}>Today's Analysis</Text>
              <Text style={styles.performanceValue}>{pickStats.totalPicks} AI Picks</Text>
              <View style={styles.performanceIndicator}>
                <Target size={14} color="#10B981" />
                <Text style={styles.performanceChange}>
                  {pickStats.avgConfidence.toFixed(1)}% avg confidence
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* AI Chat Quick Access */}
        <TouchableOpacity style={styles.quickChatCard} onPress={() => setShowChat(true)}>
          <LinearGradient
            colors={['rgba(0,229,255,0.15)', 'rgba(124,58,237,0.1)']}
            style={styles.quickChatGradient}
          >
            <View style={styles.chatQuickHeader}>
              <View style={styles.aiAvatarLarge}>
                <Brain size={24} color="#00E5FF" />
                <View style={styles.pulseRing} />
              </View>
              <View style={styles.chatQuickInfo}>
                <Text style={styles.chatQuickTitle}>Ask Your AI Analyst</Text>
                <Text style={styles.chatQuickSubtitle}>Get instant betting advice • 24/7 available</Text>
              </View>
              <View style={styles.chatQuickAction}>
                <MessageCircle size={20} color="#00E5FF" />
              </View>
            </View>
            <View style={styles.quickSuggestions}>
              <Text style={styles.suggestionChip}>"What games are on tonight?"</Text>
              <Text style={styles.suggestionChip}>"Analyze [specific game]"</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Live Dashboard Stats */}
        <View style={styles.dashboardStatsContainer}>
          <Text style={styles.sectionTitle}>Enhanced DeepSeek Orchestrator</Text>
          <View style={styles.statsGrid}>
            {[
              { 
                title: 'Total Picks', 
                value: pickStats.totalPicks.toString(), 
                change: `${Object.keys(pickStats.sportsBreakdown).length} sports`, 
                color: '#10B981', 
                icon: Target 
              },
              { 
                title: 'Avg Confidence', 
                value: `${pickStats.avgConfidence.toFixed(1)}%`, 
                change: 'Real ML model', 
                color: '#00E5FF', 
                icon: TrendingUp 
              },
              { 
                title: 'Avg Edge', 
                value: `${pickStats.avgEdge.toFixed(1)}%`, 
                change: 'Live odds', 
                color: '#F59E0B', 
                icon: BarChart3 
              },
              { 
                title: 'DeepSeek AI', 
                value: 'Active', 
                change: 'Selecting best', 
                color: '#8B5CF6', 
                icon: Brain 
              }
            ].map((stat, index) => (
              <Animated.View key={index} style={[styles.statCard, {
                transform: [{
                  scale: pulseAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.02]
                  })
                }]
              }]}>
                <LinearGradient
                  colors={[`${stat.color}20`, `${stat.color}10`]}
                  style={styles.statCardGradient}
                >
                  <View style={styles.statHeader}>
                    <stat.icon size={20} color={stat.color} />
                    <Text style={styles.statTitle}>{stat.title}</Text>
                  </View>
                  <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
                  <Text style={styles.statChange}>{stat.change}</Text>
                </LinearGradient>
              </Animated.View>
            ))}
          </View>
        </View>

        {/* Today's Real AI Picks */}
        <View style={[styles.todayPicksSection, { marginBottom: 20 }]}>
          <View style={styles.sectionHeaderWithAction}>
            <Text style={styles.sectionTitle}>Today's AI Picks</Text>
            <TouchableOpacity 
              style={styles.refreshButton} 
              onPress={onRefreshPicks}
              disabled={isLoadingPicks}
            >
              <RefreshCw size={16} color="#00E5FF" />
              <Text style={styles.refreshText}>
                {isLoadingPicks ? 'Loading...' : 'Refresh'}
              </Text>
            </TouchableOpacity>
          </View>
          
          {isLoadingPicks ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading AI picks...</Text>
            </View>
          ) : todaysPicks.length === 0 ? (
            <View style={styles.emptyPicksContainer}>
              <Brain size={48} color="#64748B" />
              <Text style={styles.emptyPicksTitle}>No picks available</Text>
              <Text style={styles.emptyPicksSubtitle}>
                Pull down to refresh or wait for the Enhanced DeepSeek Orchestrator to generate today's picks
              </Text>
            </View>
          ) : (
                        todaysPicks.map((pick, index) => (
              <Animated.View key={pick.id} style={[styles.aiPickCard, {
                transform: [{
                  translateY: slideInAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0]
                  })
                }],
                opacity: fadeInAnimation
              }]}>  
                <LinearGradient
                  colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)']}
                  style={styles.aiPickGradient}
                >
                  <View style={styles.pickHeader}>
                    <View style={styles.pickInfo}>
                      <Text style={styles.pickGame}>{pick.match}</Text>
                      <Text style={styles.pickSelection}>{pick.pick}</Text>
                      <Text style={styles.pickOdds}>Odds: {pick.odds}</Text>
                    </View>
                    <View style={styles.pickMetrics}>
                      <View style={[styles.confidenceBadge, { 
                        backgroundColor: pick.confidence >= 70 ? '#10B98120' : 
                                         pick.confidence >= 60 ? '#F59E0B20' : '#EF444420' 
                      }]}>
                        <Text style={[styles.confidenceText, { 
                          color: pick.confidence >= 70 ? '#10B981' : 
                                 pick.confidence >= 60 ? '#F59E0B' : '#EF4444' 
                        }]}>
                          {pick.confidence}%
                        </Text>
                      </View>
                      {pick.value && (
                        <View style={styles.valueBadge}>
                          <Text style={styles.valueText}>
                            {pick.value.toFixed(1)}% edge
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  
                  <Text style={styles.pickReasoning}>{pick.reasoning}</Text>
                  
                  <View style={styles.pickFooter}>
                    <View style={styles.sportBadge}>
                      <Text style={styles.sportText}>{pick.sport}</Text>
                    </View>
                    <Text style={styles.pickTime}>
                      {new Date(pick.eventTime).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </Text>
                  </View>
                </LinearGradient>
              </Animated.View>
            ))
          )}
        </View>

        {/* Enhanced Analytics - Real Data */}
        {todaysPicks.length > 0 && (
          <View style={[styles.analyticsSection, { marginTop: 20 }]}>
            <Text style={styles.sectionTitle}>Today's Insights</Text>
            <View style={styles.insightsGrid}>
              <View style={styles.insightCard}>
                <Text style={styles.insightTitle}>Sports Coverage</Text>
                {Object.entries(pickStats.sportsBreakdown).map(([sport, count]) => (
                  <View key={sport} style={styles.insightRow}>
                    <Text style={styles.insightLabel}>{sport}</Text>
                    <Text style={styles.insightValue}>{count} picks</Text>
                  </View>
                ))}
              </View>
              
              <View style={styles.insightCard}>
                <Text style={styles.insightTitle}>Bet Types</Text>
                {Object.entries(pickStats.betTypeBreakdown).map(([type, count]) => (
                  <View key={type} style={styles.insightRow}>
                    <Text style={styles.insightLabel}>{type}</Text>
                    <Text style={styles.insightValue}>{count} picks</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Pro Tools Grid */}
        <View style={[styles.proToolsSection, { marginTop: 20 }]}>
          <Text style={styles.sectionTitle}>Pro Tools</Text>
          <View style={styles.toolsGrid}>
            {[
              { 
                title: 'DeepSeek AI', 
                subtitle: 'Best pick selection', 
                icon: Brain, 
                color: '#8B5CF6',
                badge: 'Active'
              },
              { 
                title: 'The Odds API', 
                subtitle: 'Real-time odds', 
                icon: Target, 
                color: '#10B981',
                badge: 'Live Data'
              },
              { 
                title: 'ML Predictions', 
                subtitle: 'Python server', 
                icon: Calculator, 
                color: '#00E5FF',
                badge: '66.9% Accuracy'
              },
              { 
                title: 'Edge Detection', 
                subtitle: 'Value analysis', 
                icon: BarChart3, 
                color: '#F59E0B',
                badge: `${pickStats.avgEdge.toFixed(1)}% Avg`
              }
            ].map((tool, index) => (
              <TouchableOpacity key={index} style={styles.toolCard}>
                <LinearGradient
                  colors={[`${tool.color}20`, `${tool.color}10`]}
                  style={styles.toolCardGradient}
                >
                  <View style={styles.toolHeader}>
                    <tool.icon size={24} color={tool.color} />
                    <View style={[styles.toolBadge, { backgroundColor: `${tool.color}30` }]}>
                      <Text style={[styles.toolBadgeText, { color: tool.color }]}>{tool.badge}</Text>
                    </View>
                  </View>
                  <Text style={styles.toolTitle}>{tool.title}</Text>
                  <Text style={styles.toolSubtitle}>{tool.subtitle}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Quick Actions Footer */}
        <View style={[styles.quickActionsFooter, { marginTop: 30, marginBottom: 20 }]}>
          <TouchableOpacity style={styles.footerAction}>
            <LinearGradient colors={['#00E5FF', '#0891B2']} style={styles.footerActionGradient}>
              <Settings size={20} color="#FFFFFF" />
              <Text style={styles.footerActionText}>Settings</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.footerAction}>
            <LinearGradient colors={['#8B5CF6', '#7C3AED']} style={styles.footerActionGradient}>
              <Award size={20} color="#FFFFFF" />
              <Text style={styles.footerActionText}>Achievements</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

      </ScrollView>
      {renderChatModal()}
    </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
      
      {/* Hero Section - Absolutely Stunning */}
      <LinearGradient
        colors={['#0F172A', '#1E293B', '#7C3AED', '#00E5FF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroSection}
      >
        {/* Floating Background Elements */}
        <Animated.View style={[styles.floatingElement, styles.floatingElement1, {
          transform: [{
            translateY: floatingAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -15]
            })
          }]
        }]}>
          <LinearGradient colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']} style={styles.floatingGradient} />
        </Animated.View>
        
        <Animated.View style={[styles.floatingElement, styles.floatingElement2, {
          transform: [{
            translateY: floatingAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 10]
            })
          }]
        }]}>
          <LinearGradient colors={['rgba(0,229,255,0.2)', 'rgba(124,58,237,0.1)']} style={styles.floatingGradient} />
        </Animated.View>

        <Animated.View style={[styles.heroContent, { opacity: fadeInAnimation, transform: [{ translateY: slideInAnimation }] }]}>
          {/* Premium Badge */}
          <Animated.View style={[styles.premiumBadge, { 
            transform: [{ scale: pulseAnimation.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }]
          }]}>
            <Crown size={16} color="#FFD700" />
            <Text style={styles.premiumBadgeText}>ENHANCED AI PLATFORM</Text>
            <Sparkles size={14} color="#FFD700" />
          </Animated.View>

          {/* Main Headline */}
          <Text style={styles.heroTitle}>
            Advanced AI Sports Betting{'\n'}
            <Text style={styles.heroTitleAccent}>With Real Edge Detection</Text>
          </Text>
          
          <Text style={styles.heroSubtitle}>
            Powered by Enhanced DeepSeek Orchestrator • Python ML Server • Real-time odds from The Odds API
          </Text>

          {/* Live Tech Stack */}
          <View style={styles.techStackContainer}>
            {[
              { title: 'DeepSeek AI', subtitle: 'Pick Selection', color: '#8B5CF6', icon: Brain },
              { title: 'ML Server', subtitle: '66.9% Accuracy', color: '#10B981', icon: Target },
              { title: 'Live Odds', subtitle: 'The Odds API', color: '#00E5FF', icon: Globe },
              { title: 'Edge Detection', subtitle: 'Value Analysis', color: '#F59E0B', icon: BarChart3 }
            ].map((tech, index) => (
              <Animated.View key={index} style={[styles.techItem, {
                transform: [{
                  scale: pulseAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.02]
                  })
                }]
              }]}>
                <View style={[styles.techIcon, { backgroundColor: `${tech.color}20` }]}>
                  <tech.icon size={16} color={tech.color} />
                </View>
                <Text style={[styles.techTitle, { color: tech.color }]}>{tech.title}</Text>
                <Text style={styles.techSubtitle}>{tech.subtitle}</Text>
              </Animated.View>
            ))}
          </View>

          {/* Hero CTA */}
          <Animated.View style={[styles.heroCTAContainer, {
            transform: [{ scale: pulseAnimation.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] }) }]
          }]}>
            <TouchableOpacity style={styles.heroButton} onPress={handleSubscription}>
              <LinearGradient
                colors={['#00E5FF', '#0891B2', '#7C3AED']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroButtonGradient}
              >
                <Rocket size={20} color="#FFFFFF" />
                <Text style={styles.heroButtonText}>ACCESS PRO DASHBOARD</Text>
                <ArrowRight size={20} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.trialText}>🚀 Click above to unlock the full Enhanced DeepSeek Orchestrator experience!</Text>
          </Animated.View>
        </Animated.View>
      </LinearGradient>

      {/* Live AI Picks Demo */}
      <View style={styles.livePicksSection}>
        <Animated.View style={[styles.sectionHeader, { opacity: fadeInAnimation }]}>
          <View style={styles.liveBadge}>
            <View style={styles.liveIndicator} />
            <Text style={styles.liveText}>LIVE AI ANALYSIS</Text>
          </View>
          <Text style={styles.sectionTitle}>See AI in Action Right Now</Text>
          <Text style={styles.sectionSubtitle}>
            These are real picks generated by our AI in the last 24 hours
          </Text>
        </Animated.View>

        <View style={styles.picksContainer}>
          <Animated.View style={[styles.pickCard, {
            transform: [{
              translateY: slideInAnimation.interpolate({
                inputRange: [0, 1],
                outputRange: [50, 0]
              })
            }],
            opacity: fadeInAnimation
          }]}>
            <LinearGradient
              colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']}
              style={styles.pickCardGradient}
            >
              <View style={styles.pickHeader}>
                <View>
                  <Text style={styles.pickGame}>Enhanced DeepSeek Orchestrator</Text>
                  <Text style={styles.pickSelection}>Real AI + Live Data = Smart Picks</Text>
                </View>
                <View style={[styles.confidenceBadge, { backgroundColor: '#8B5CF620' }]}>
                  <Text style={[styles.confidenceText, { color: '#8B5CF6' }]}>
                    Active
                  </Text>
                </View>
              </View>
              
              <Text style={styles.pickReasoning}>
                Our Enhanced DeepSeek Orchestrator combines Python ML predictions, real-time odds from The Odds API, 
                and advanced AI selection to generate high-value betting opportunities.
              </Text>
              
              <View style={styles.pickFooter}>
                <View style={styles.valueContainer}>
                  <Text style={[styles.valueText, { color: '#8B5CF6' }]}>
                    Real Technology Stack
                  </Text>
                </View>
                <View style={[styles.statusBadge, styles.activeBadge]}>
                  <Text style={[styles.statusText, styles.activeText]}>
                    LIVE
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>
        </View>
      </View>

      {/* AI Chat Demo Preview */}
      <View style={styles.chatDemoSection}>
        <Text style={styles.sectionTitle}>Chat With Your AI Analyst</Text>
        <Text style={styles.sectionSubtitle}>
          Get instant answers to any betting question, 24/7
        </Text>
        
        <TouchableOpacity style={styles.chatDemo} onPress={() => setShowDemoChat(true)}>
          <LinearGradient
            colors={['#1E293B', '#334155']}
            style={styles.chatDemoGradient}
          >
            <View style={styles.chatDemoHeader}>
              <View style={styles.aiAvatar}>
                <Brain size={20} color="#00E5FF" />
              </View>
              <View>
                <Text style={styles.chatDemoTitle}>AI Betting Analyst</Text>
                <Text style={styles.chatDemoSubtitle}>Online • Ready to help</Text>
              </View>
              <Play size={24} color="#00E5FF" />
            </View>
            
            <View style={styles.chatPreview}>
              <Text style={styles.chatPreviewText}>
                "Should I bet [specific game]?" → AI analyzes 40+ factors in 25 seconds
              </Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Premium Features Showcase */}
      <View style={styles.featuresShowcase}>
        <Text style={styles.sectionTitle}>Why Pro Bettors Choose ParleyAI</Text>
        <Text style={styles.sectionSubtitle}>
          The only platform that combines AI precision with real-world profitability
        </Text>
        
        <View style={styles.featuresGrid}>
          {[
            {
              icon: Brain,
              title: 'Enhanced DeepSeek AI',
              description: 'Advanced AI picking the best opportunities from all candidates',
              detail: 'Selects top picks from Python ML predictions with real edge analysis',
              color: '#8B5CF6',
              value: '10',
              metric: 'daily picks'
            },
            {
              icon: Target,
              title: 'Real-Time Odds API',
              description: 'Live odds from premium bookmakers for accurate edge detection',
              detail: 'The Odds API providing real FanDuel, DraftKings, BetMGM data',
              color: '#10B981',
              value: 'Live',
              metric: 'market data'
            },
            {
              icon: Calculator,
              title: 'Python ML Server',
              description: 'Advanced machine learning predictions with proven accuracy',
              detail: '66.9% accuracy rate on historical testing with continuous improvement',
              color: '#00E5FF',
              value: '66.9%',
              metric: 'accuracy'
            },
            {
              icon: BarChart3,
              title: 'Edge Detection System',
              description: 'Sophisticated value analysis comparing predictions to market odds',
              detail: 'Identifies profitable opportunities with mathematical precision',
              color: '#F59E0B',
              value: '3%+',
              metric: 'min edge'
            }
          ].map((feature, index) => (
            <Animated.View 
              key={index}
              style={[styles.premiumFeatureCard, {
                transform: [{
                  scale: pulseAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.02]
                  })
                }]
              }]}
            >
              <TouchableOpacity style={styles.featureCardTouchable}>
                <LinearGradient
                  colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)']}
                  style={styles.premiumFeatureGradient}
                >
                  {/* Feature Header */}
                  <View style={styles.featureHeader}>
                    <View style={[styles.premiumFeatureIcon, { backgroundColor: `${feature.color}15` }]}>
                      <feature.icon size={32} color={feature.color} />
                    </View>
                    <View style={styles.featureMetric}>
                      <Text style={[styles.metricValue, { color: feature.color }]}>
                        {feature.value}
                      </Text>
                      <Text style={styles.metricLabel}>{feature.metric}</Text>
                    </View>
                  </View>

                  {/* Feature Content */}
                  <View style={styles.featureContent}>
                    <Text style={styles.premiumFeatureTitle}>{feature.title}</Text>
                    <Text style={styles.premiumFeatureDescription}>
                      {feature.description}
                    </Text>
                    <Text style={styles.featureDetail}>{feature.detail}</Text>
                  </View>

                  {/* Feature CTA */}
                  <View style={styles.featureCTA}>
                    <View style={[styles.ctaButton, { borderColor: feature.color }]}>
                      <Text style={[styles.ctaText, { color: feature.color }]}>
                        Learn More
                      </Text>
                      <ChevronRight size={16} color={feature.color} />
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>
      </View>

      {/* Testimonials section temporarily removed for cleaner landing page */}

      {/* Pricing Plans */}
      <View style={styles.pricingSection}>
        <Text style={styles.sectionTitle}>Choose Your Plan</Text>
        <Text style={styles.sectionSubtitle}>
          Start your pro journey today and transform your betting strategy
        </Text>

        <View style={styles.plansContainer}>
          {pricingPlans.map((plan) => (
            <TouchableOpacity
              key={plan.id}
              style={[
                styles.planCard,
                selectedPlan === plan.id && styles.planCardSelected,
                plan.popular && styles.popularPlan
              ]}
              onPress={() => setSelectedPlan(plan.id as any)}
            >
              {plan.popular && (
                <View style={styles.popularBadge}>
                  <Star size={12} color="#FFFFFF" />
                  <Text style={styles.popularText}>Most Popular</Text>
                </View>
              )}
              
              <LinearGradient
                colors={plan.popular ? ['#8B5CF6', '#7C3AED'] : ['#1E293B', '#334155']}
                style={styles.planGradient}
              >
                <View style={styles.planHeader}>
                  <Text style={styles.planTitle}>{plan.title}</Text>
                  {plan.savings && (
                    <View style={styles.savingsBadge}>
                      <Text style={styles.savingsText}>{plan.savings}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.priceContainer}>
                  <Text style={styles.price}>{plan.price}</Text>
                  <Text style={styles.period}>{plan.period}</Text>
                </View>
                
                {plan.originalPrice && (
                  <Text style={styles.originalPrice}>Usually {plan.originalPrice}</Text>
                )}

                <View style={styles.featuresContainer}>
                  {plan.features.map((feature, index) => (
                    <View key={index} style={styles.featureRow}>
                      <CheckCircle size={16} color="#10B981" />
                      <Text style={styles.featureText}>{feature}</Text>
                    </View>
                  ))}
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity 
          style={styles.subscribeButton} 
          onPress={() => handleSubscription(selectedPlan)}
        >
          <LinearGradient
            colors={['#10B981', '#059669']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.subscribeGradient}
          >
            <Crown size={20} color="#FFFFFF" />
            <Text style={styles.subscribeText}>
              🍎 PAY WITH APPLE - {pricingPlans.find(p => p.id === selectedPlan)?.price || '$24.99'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.restoreButton} 
          onPress={handleRestorePurchases}
        >
          <Text style={styles.restoreText}>Restore Purchases</Text>
        </TouchableOpacity>

        <View style={styles.guaranteeContainer}>
          <Shield size={20} color="#10B981" />
          <Text style={styles.guaranteeText}>30-day money-back guarantee</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Join thousands of successful bettors who trust Predictive Picks Pro
        </Text>
      </View>
    </ScrollView>
    
    {renderChatModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  contentContainer: {
    paddingBottom: 30,
  },
  
  // Hero Section Styles
  heroSection: {
    minHeight: screenHeight * 0.85,
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  floatingElement: {
    position: 'absolute',
    borderRadius: 100,
  },
  floatingElement1: {
    width: 200,
    height: 200,
    top: 100,
    right: -50,
  },
  floatingElement2: {
    width: 150,
    height: 150,
    bottom: 150,
    left: -30,
  },
  floatingGradient: {
    flex: 1,
    borderRadius: 100,
  },
  heroContent: {
    alignItems: 'center',
    zIndex: 10,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    marginBottom: 24,
  },
  premiumBadgeText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '700',
    marginHorizontal: 8,
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 42,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 50,
  },
  heroTitleAccent: {
    background: 'linear-gradient(90deg, #00E5FF 0%, #8B5CF6 100%)',
    backgroundClip: 'text',
    color: '#00E5FF',
  },
  heroSubtitle: {
    fontSize: 18,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 26,
    paddingHorizontal: 20,
  },
  profitHighlight: {
    color: '#10B981',
    fontWeight: '700',
  },
  liveStatsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 40,
    gap: 20,
  },
  statItem: {
    alignItems: 'center',
    minWidth: 80,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    textAlign: 'center',
  },
  heroCTAContainer: {
    alignItems: 'center',
    width: '100%',
  },
  heroButton: {
    width: '100%',
    marginBottom: 12,
  },
  heroButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    gap: 12,
  },
  heroButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  trialText: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
  },

  // Live Picks Section
  livePicksSection: {
    padding: 20,
    backgroundColor: '#0F172A',
    paddingBottom: 60, // Increased spacing to prevent bleeding into next section
    marginBottom: 20, // Add margin for better section separation
  },
  sectionHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 8,
  },
  liveText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  picksContainer: {
    gap: 20, // Increased gap between pick cards for better spacing
    marginBottom: 20, // Add bottom margin to container
  },
  pickCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  pickCardGradient: {
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
  },
  pickHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  pickGame: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  pickSelection: {
    color: '#94A3B8',
    fontSize: 14,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pickReasoning: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  pickFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  valueContainer: {
    flex: 1,
  },
  valueText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  wonBadge: { backgroundColor: 'rgba(16, 185, 129, 0.2)' },
  activeBadge: { backgroundColor: 'rgba(0, 229, 255, 0.2)' },
  pendingBadge: { backgroundColor: 'rgba(245, 158, 11, 0.2)' },
  wonText: { color: '#10B981' },
  activeText: { color: '#00E5FF' },
  pendingText: { color: '#F59E0B' },

  // Chat Demo Section
  chatDemoSection: {
    padding: 20,
    paddingTop: 40, // Increased top padding to ensure separation from picks section
    backgroundColor: '#0F172A',
  },
  chatDemo: {
    marginTop: 16,
  },
  chatDemoGradient: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chatDemoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  aiAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  chatDemoTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  chatDemoSubtitle: {
    color: '#10B981',
    fontSize: 12,
  },
  chatPreview: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#00E5FF',
  },
  chatPreviewText: {
    color: '#94A3B8',
    fontSize: 14,
    fontStyle: 'italic',
  },

  // Features Showcase
  featuresShowcase: {
    padding: 20,
    paddingTop: 40,
    paddingBottom: 40,
    backgroundColor: '#0F172A',
  },
  premiumFeatureCard: {
    width: '48%',
    marginBottom: 20,
    minHeight: 280, // Ensure consistent card heights
  },
  featureCardTouchable: {
    borderRadius: 16,
    overflow: 'hidden',
    flex: 1,
  },
  premiumFeatureGradient: {
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    flex: 1,
    justifyContent: 'space-between',
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  featureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  premiumFeatureIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureMetric: {
    alignItems: 'flex-end',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 2,
  },
  metricLabel: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'right',
  },
  featureContent: {
    marginBottom: 20,
  },
  premiumFeatureTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  premiumFeatureDescription: {
    color: '#94A3B8',
    fontSize: 16,
    marginBottom: 8,
    lineHeight: 22,
  },
  featureDetail: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20,
  },
  featureCTA: {
    alignItems: 'flex-start',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },

  // Testimonials Section
  testimonialsSection: {
    padding: 20,
    backgroundColor: '#0F172A',
  },
  testimonialsScroll: {
    marginTop: 20,
  },
  testimonialCard: {
    width: 280,
    marginRight: 16,
  },
  testimonialGradient: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  profitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  profitAmount: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  profitTimeframe: {
    color: '#64748B',
    fontSize: 12,
    marginLeft: 4,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  userAvatar: {
    fontSize: 32,
    marginRight: 12,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  userRole: {
    color: '#64748B',
    fontSize: 14,
  },
  testimonialQuote: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 4,
  },

  // Common Section Styles
  sectionTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  
  header: {
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    position: 'relative',
  },
  successHeader: {
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  lockIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  unlockIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#E2E8F0',
    textAlign: 'center',
    marginBottom: 30,
  },
  successSubtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    opacity: 0.9,
  },
  crownContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  sparkleLeft: {
    position: 'absolute',
    top: -10,
    left: -20,
  },
  sparkleRight: {
    position: 'absolute',
    top: 10,
    right: -15,
  },
  featuresPreview: {
    padding: 20,
  },
  pricingSection: {
    padding: 20,
    paddingTop: 0, // Reduce top padding since testimonials section removed
    backgroundColor: '#0F172A',
  },
  plansContainer: {
    marginBottom: 30,
  },
  planCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  planCardSelected: {
    borderColor: '#10B981',
  },
  popularPlan: {
    borderColor: '#8B5CF6',
  },
  popularBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#8B5CF6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    zIndex: 1,
  },
  popularText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  planGradient: {
    padding: 24,
    paddingTop: 32,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  planTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  savingsBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  savingsText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  price: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  period: {
    fontSize: 16,
    color: '#94A3B8',
    marginLeft: 4,
  },
  originalPrice: {
    fontSize: 14,
    color: '#64748B',
    textDecorationLine: 'line-through',
    marginBottom: 20,
  },
  featuresContainer: {
    
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 14,
    color: '#E2E8F0',
    marginLeft: 8,
  },
  subscribeButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
  },
  subscribeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  subscribeText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  restoreButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  restoreText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  guaranteeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  guaranteeText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  quickActions: {
    padding: 20,
  },
  actionCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  actionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  actionContent: {
    marginLeft: 16,
    flex: 1,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.8,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  // Chat Modal Styles
  chatContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  chatGradient: {
    flex: 1,
  },
  chatHeader: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  chatHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiAvatarLarge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    position: 'relative',
  },
  aiStatusDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#0F172A',
  },
  chatStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickActionsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  quickActionsTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickActionButton: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
  },
  quickActionIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  quickActionText: {
    color: '#00E5FF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  chatHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  chatHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  chatHeaderSubtitle: {
    fontSize: 14,
    color: '#00E5FF',
  },
  closeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
    borderRadius: 20,
  },
  closeButtonText: {
    color: '#00E5FF',
    fontSize: 16,
    fontWeight: '600',
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  messagesContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  messagesContent: {
    paddingVertical: 10,
    flexGrow: 1,
  },
  scrollToBottomButton: {
    position: 'absolute',
    right: 20,
    bottom: 120,
    zIndex: 100,
  },
  scrollToBottomCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#00E5FF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  typingIndicator: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  typingText: {
    color: '#64748B',
    fontSize: 14,
    fontStyle: 'italic',
  },
  messageContainer: {
    marginBottom: 16,
  },
  userMessage: {
    alignItems: 'flex-end',
  },
  aiMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  userBubble: {
    backgroundColor: '#00E5FF',
    borderBottomRightRadius: 6,
  },
  aiBubble: {
    backgroundColor: '#1E293B',
    borderBottomLeftRadius: 6,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userText: {
    color: '#0F172A',
  },
  aiText: {
    color: '#FFFFFF',
  },
  userMessageText: {
    color: '#0F172A',
  },
  aiMessageText: {
    color: '#FFFFFF',
  },
  cursor: {
    color: '#00E5FF',
    fontSize: 16,
    fontWeight: '700',
  },
  inputContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 40,
  },
  inputGradient: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    minHeight: 48,
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    maxHeight: 100,
    lineHeight: 22,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  dashboardContainer: {
    paddingBottom: 30,
  },
  dashboardHeader: {
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  floatingOrb: {
    position: 'absolute',
    borderRadius: 100,
  },
  orb1: {
    width: 200,
    height: 200,
    top: 100,
    right: -50,
  },
  orb2: {
    width: 150,
    height: 150,
    bottom: 150,
    left: -30,
  },
  orbGradient: {
    flex: 1,
    borderRadius: 100,
  },
  headerContent: {
    alignItems: 'center',
    zIndex: 10,
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  usernameText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 8,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  todayPerformance: {
    alignItems: 'center',
  },
  performanceLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  performanceValue: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '900',
  },
  performanceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  performanceChange: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 4,
  },
     quickChatCard: {
     margin: 20,
     marginTop: 0,
     marginBottom: 0,
     borderRadius: 16,
     overflow: 'hidden',
   },
   quickChatGradient: {
     padding: 20,
     borderWidth: 1,
     borderColor: 'rgba(255,255,255,0.1)',
     borderRadius: 16,
   },
  chatQuickHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  aiAvatarLarge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  chatQuickInfo: {
    flex: 1,
  },
  chatQuickTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  chatQuickSubtitle: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  quickSuggestions: {
    flexDirection: 'row',
    gap: 8,
  },
  suggestionChip: {
    color: '#FFFFFF',
    fontSize: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
  },
  dashboardStatsContainer: {
    padding: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statCard: {
    width: '48%',
    marginBottom: 16,
  },
  statCardGradient: {
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
  },
     statHeader: {
     flexDirection: 'row',
     alignItems: 'center',
     marginBottom: 12,
   },
   statTitle: {
     color: '#FFFFFF',
     fontSize: 14,
     fontWeight: '600',
     marginLeft: 8,
   },
     statValue: {
     fontSize: 24,
     fontWeight: '900',
     marginBottom: 4,
   },
   statChange: {
     color: '#64748B',
     fontSize: 12,
     fontWeight: '500',
   },
  todayPicksSection: {
    padding: 20,
  },
  sectionHeaderWithAction: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00E5FF',
  },
  refreshText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 4,
  },
     aiPickCard: {
     borderRadius: 16,
     overflow: 'hidden',
     marginBottom: 16,
   },
  pickCardGradient: {
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
  },
  pickCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  pickGame: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  pickSelection: {
    color: '#94A3B8',
    fontSize: 14,
  },
  pickMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  confidenceCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confidenceText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  pickReasoning: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
  },
  pickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  valueDisplay: {
    flex: 1,
  },
  valueText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  portfolioSection: {
    padding: 20,
  },
     portfolioCard: {
     padding: 24,
     borderRadius: 16,
     borderWidth: 1,
     borderColor: 'rgba(255,255,255,0.1)',
   },
  portfolioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  portfolioTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  portfolioBalance: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '900',
  },
  portfolioChange: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  portfolioChangeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 4,
  },
  portfolioChart: {
    width: 100,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  chartBar: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  portfolioStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  portfolioStat: {
    alignItems: 'center',
  },
  portfolioStatLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  portfolioStatValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  proToolsSection: {
    padding: 20,
  },
  toolsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  toolCard: {
    width: '48%',
    marginBottom: 16,
  },
  toolCardGradient: {
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
  },
  toolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  toolBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  toolBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  toolTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  toolSubtitle: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  quickActionsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  footerAction: {
    padding: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  footerActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  footerActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  // Quick Actions Chat Styles
  quickActionsContainer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  quickActionsTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickActionButton: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
  },
  quickActionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  quickActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyPicksContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyPicksTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
  },
  emptyPicksSubtitle: {
    color: '#94A3B8',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  valueBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  valueText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  sportBadge: {
    backgroundColor: '#00E5FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  sportText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  pickTime: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  pickInfo: {
    flex: 1,
  },
  pickOdds: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '600',
  },
  pickMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  analyticsSection: {
    padding: 20,
    backgroundColor: '#0F172A',
  },
  insightsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  insightCard: {
    width: '48%',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  insightTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  insightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  insightLabel: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  insightValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  techStackContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  techItem: {
    alignItems: 'center',
    minWidth: 100,
  },
  techIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  techTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  techSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
  },
  typingIndicator: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  typingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  messageInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    maxHeight: 100,
    lineHeight: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
  },
     aiPickGradient: {
     padding: 20,
     borderWidth: 1,
     borderColor: 'rgba(255,255,255,0.1)',
     borderRadius: 16,
   },
   statusBadge: {
     paddingHorizontal: 8,
     paddingVertical: 4,
     borderRadius: 8,
   },
   activeBadge: {
     backgroundColor: '#10B981',
   },
   wonBadge: {
     backgroundColor: '#10B981',
   },
   pendingBadge: {
     backgroundColor: '#F59E0B',
   },
   statusText: {
     fontSize: 12,
     fontWeight: '700',
   },
   activeText: {
     color: '#FFFFFF',
   },
   wonText: {
     color: '#FFFFFF',
   },
   pendingText: {
     color: '#FFFFFF',
   },
   valueContainer: {
     flex: 1,
   },
   // Landing page styles
   livePicksSection: {
     padding: 20,
     backgroundColor: '#0F172A',
   },
   sectionHeader: {
     alignItems: 'center',
     marginBottom: 20,
   },
   liveBadge: {
     flexDirection: 'row',
     alignItems: 'center',
     backgroundColor: '#EF4444',
     paddingHorizontal: 12,
     paddingVertical: 6,
     borderRadius: 20,
     marginBottom: 16,
   },
   liveIndicator: {
     width: 8,
     height: 8,
     borderRadius: 4,
     backgroundColor: '#FFFFFF',
     marginRight: 8,
   },
   liveText: {
     color: '#FFFFFF',
     fontSize: 12,
     fontWeight: '700',
   },
   picksContainer: {
     gap: 16,
   },
   pickCard: {
     borderRadius: 16,
     overflow: 'hidden',
   },
   pickCardGradient: {
     padding: 20,
   },
   pickHeader: {
     flexDirection: 'row',
     justifyContent: 'space-between',
     alignItems: 'flex-start',
     marginBottom: 12,
   },
   pickGame: {
     color: '#FFFFFF',
     fontSize: 18,
     fontWeight: '700',
     marginBottom: 4,
   },
   pickSelection: {
     color: '#00E5FF',
     fontSize: 16,
     fontWeight: '600',
   },
   confidenceBadge: {
     paddingHorizontal: 12,
     paddingVertical: 6,
     borderRadius: 12,
   },
   confidenceText: {
     fontSize: 14,
     fontWeight: '700',
   },
   pickReasoning: {
     color: '#E2E8F0',
     fontSize: 14,
     lineHeight: 20,
     marginBottom: 16,
   },
   pickFooter: {
     flexDirection: 'row',
     justifyContent: 'space-between',
     alignItems: 'center',
   },
   chatDemoSection: {
     padding: 20,
     backgroundColor: '#0F172A',
   },
   chatDemo: {
     borderRadius: 16,
     overflow: 'hidden',
   },
   chatDemoGradient: {
     padding: 20,
   },
   chatDemoHeader: {
     flexDirection: 'row',
     alignItems: 'center',
     marginBottom: 16,
   },
   aiAvatar: {
     width: 40,
     height: 40,
     borderRadius: 20,
     backgroundColor: 'rgba(0,229,255,0.2)',
     alignItems: 'center',
     justifyContent: 'center',
     marginRight: 12,
   },
   chatDemoTitle: {
     color: '#FFFFFF',
     fontSize: 16,
     fontWeight: '700',
   },
   chatDemoSubtitle: {
     color: '#94A3B8',
     fontSize: 14,
   },
   chatPreview: {
     backgroundColor: 'rgba(0,229,255,0.1)',
     padding: 16,
     borderRadius: 12,
   },
   chatPreviewText: {
     color: '#E2E8F0',
     fontSize: 14,
     lineHeight: 20,
   },
   featuresShowcase: {
     padding: 20,
     backgroundColor: '#0F172A',
   },
   featuresGrid: {
     gap: 16,
   },
   premiumFeatureCard: {
     borderRadius: 16,
     overflow: 'hidden',
   },
   featureCardTouchable: {
     flex: 1,
   },
   premiumFeatureGradient: {
     padding: 20,
   },
   featureHeader: {
     flexDirection: 'row',
     justifyContent: 'space-between',
     alignItems: 'center',
     marginBottom: 16,
   },
   premiumFeatureIcon: {
     width: 60,
     height: 60,
     borderRadius: 30,
     alignItems: 'center',
     justifyContent: 'center',
   },
   featureMetric: {
     alignItems: 'flex-end',
   },
   metricValue: {
     fontSize: 24,
     fontWeight: '700',
   },
   metricLabel: {
     fontSize: 12,
     color: '#94A3B8',
     fontWeight: '600',
   },
   featureContent: {
     marginBottom: 16,
   },
   premiumFeatureTitle: {
     color: '#FFFFFF',
     fontSize: 20,
     fontWeight: '700',
     marginBottom: 8,
   },
   premiumFeatureDescription: {
     color: '#E2E8F0',
     fontSize: 14,
     lineHeight: 20,
     marginBottom: 8,
   },
   featureDetail: {
     color: '#94A3B8',
     fontSize: 12,
     lineHeight: 18,
   },
   featureCTA: {
     alignItems: 'flex-start',
   },
   ctaButton: {
     flexDirection: 'row',
     alignItems: 'center',
     paddingHorizontal: 16,
     paddingVertical: 8,
     borderWidth: 1,
     borderRadius: 8,
   },
      ctaText: {
     fontSize: 14,
     fontWeight: '600',
     marginRight: 8,
   },
   // Enhanced Chat Styles
   aiStatusDot: {
     position: 'absolute',
     top: -2,
     right: -2,
     width: 12,
     height: 12,
     borderRadius: 6,
     backgroundColor: '#10B981',
     borderWidth: 2,
     borderColor: '#0F172A',
   },
   chatStatusContainer: {
     flexDirection: 'row',
     alignItems: 'center',
   },
   quickActionsContainer: {
     padding: 20,
     borderBottomWidth: 1,
     borderBottomColor: 'rgba(255,255,255,0.1)',
   },
   quickActionsTitle: {
     color: '#FFFFFF',
     fontSize: 16,
     fontWeight: '700',
     marginBottom: 16,
     textAlign: 'center',
   },
   quickActionsGrid: {
     flexDirection: 'row',
     flexWrap: 'wrap',
     justifyContent: 'space-between',
   },
   quickActionButton: {
     width: '48%',
     backgroundColor: 'rgba(255,255,255,0.05)',
     borderWidth: 1,
     borderColor: 'rgba(255,255,255,0.1)',
     borderRadius: 12,
     padding: 16,
     marginBottom: 12,
     alignItems: 'center',
   },
   quickActionIcon: {
     fontSize: 24,
     marginBottom: 8,
   },
   quickActionText: {
     color: '#FFFFFF',
     fontSize: 12,
     fontWeight: '600',
     textAlign: 'center',
     lineHeight: 16,
   },
   // Scroll to Bottom Button
   scrollToBottomButton: {
     position: 'absolute',
     bottom: 120,
     right: 20,
     zIndex: 1000,
   },
   scrollToBottomCircle: {
     width: 40,
     height: 40,
     borderRadius: 20,
     backgroundColor: '#00E5FF',
     justifyContent: 'center',
     alignItems: 'center',
     shadowColor: '#00E5FF',
     shadowOffset: { width: 0, height: 2 },
     shadowOpacity: 0.3,
     shadowRadius: 4,
     elevation: 5,
   },
 
   });    