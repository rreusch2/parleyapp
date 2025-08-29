import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { AIPrediction } from './api/aiService';
import { chatService, ChatValidationResponse } from './api/chatService';

interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  toolsUsed?: string[];
  isSearching?: boolean;
  searchQuery?: string;
}

interface ChatContext {
  screen?: string;
  selectedPick?: any;
  selectedPrediction?: AIPrediction;
  userPreferences?: any;
  customPrompt?: string;
}

interface AIChatContextType {
  // Chat state
  showAIChat: boolean;
  setShowAIChat: (show: boolean) => void;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  
  // Context state
  chatContext: ChatContext;
  setChatContext: (context: ChatContext) => void;
  
  // Selected prediction/pick for context
  selectedPick: AIPrediction | null;
  setSelectedPick: (pick: AIPrediction | null) => void;
  
  // Free user tracking
  freeUserMessageCount: number;
  incrementFreeUserMessages: () => Promise<void>;
  canSendMessage: (isPro: boolean) => boolean;
  isLoadingMessageCount: boolean;
  chatStatus: ChatValidationResponse | null;
  refreshChatStatus: () => Promise<void>;
  
  // Helper functions
  openChatWithContext: (context: ChatContext, pick?: AIPrediction) => void;
  resetChat: () => void;
}

const AIChatContext = createContext<AIChatContextType | undefined>(undefined);

interface AIChatProviderProps {
  children: ReactNode;
}

export function AIChatProvider({ children }: AIChatProviderProps) {
  const [showAIChat, setShowAIChat] = useState(false);
  const [selectedPick, setSelectedPick] = useState<AIPrediction | null>(null);
  const [chatContext, setChatContext] = useState<ChatContext>({});
  const [freeUserMessageCount, setFreeUserMessageCount] = useState(0);
  const [isLoadingMessageCount, setIsLoadingMessageCount] = useState(true);
  const [chatStatus, setChatStatus] = useState<ChatValidationResponse | null>(null);

  // Load chat status from server on mount
  useEffect(() => {
    const loadChatStatus = async () => {
      try {
        setIsLoadingMessageCount(true);
        console.log('🔄 Loading chat status from server...');
        
        const status = await chatService.validateMessage();
        setChatStatus(status);
        setFreeUserMessageCount(status.currentMessages);
        
        console.log(`✅ Chat status loaded: ${status.remainingMessages} messages remaining`);
      } catch (error) {
        console.warn('Failed to load chat status:', error);
        // Graceful fallback - assume user can send messages
        const fallbackStatus: ChatValidationResponse = {
          canSendMessage: true,
          remainingMessages: 3,
          dailyLimit: 3,
          currentMessages: 0,
          isProUser: false,
          nextResetHours: 24
        };
        setChatStatus(fallbackStatus);
        setFreeUserMessageCount(0);
      } finally {
        setIsLoadingMessageCount(false);
      }
    };
    loadChatStatus();
  }, []);
  
  // Initialize with welcome message
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      text: `🎯 **What's good, legend!** Professor Lock here with the inside intel:\n\n• **Fire parlays** built with expert analysis 🎲\n• **Live web search** for breaking news and line moves 🌐\n• **Sharp money tracking** and **value hunts** 🔍\n• Today's **highest confidence locks** 🔒\n\nWhat play we making today? 🔥`,
      isUser: false,
      timestamp: new Date()
    }
  ]);

  const openChatWithContext = (context: ChatContext, pick?: AIPrediction) => {
    setChatContext(context);
    if (pick) {
      setSelectedPick(pick);
    }
    setShowAIChat(true);
  };

  const incrementFreeUserMessages = async () => {
    try {
      console.log(`📈 Incrementing server-side message count...`);
      
      const result = await chatService.incrementMessage();
      if (result.success) {
        setFreeUserMessageCount(result.newCount);
        
        // Update chat status to reflect new count
        if (chatStatus) {
          setChatStatus({
            ...chatStatus,
            currentMessages: result.newCount,
            remainingMessages: result.remainingMessages,
            canSendMessage: result.remainingMessages > 0
          });
        }
        
        console.log(`✅ Message count incremented: ${result.newCount}/3`);
      }
    } catch (error) {
      console.warn('Failed to increment message count:', error);
      // Don't throw - graceful degradation
    }
  };

  const refreshChatStatus = async () => {
    try {
      console.log('🔄 Refreshing chat status...');
      const status = await chatService.validateMessage();
      setChatStatus(status);
      setFreeUserMessageCount(status.currentMessages);
      console.log(`✅ Chat status refreshed: ${status.remainingMessages} messages remaining`);
    } catch (error) {
      console.warn('Failed to refresh chat status:', error);
    }
  };

  const canSendMessage = (isPro: boolean) => {
    if (isPro) return true;
    
    // Don't restrict while loading to prevent confusion
    if (isLoadingMessageCount) return true;
    
    // Use server-side validation if available
    if (chatStatus) {
      return chatStatus.canSendMessage;
    }
    
    // Fallback to local count (should rarely be used)
    const canSend = freeUserMessageCount < 3;
    
    console.log(`🔍 canSendMessage check: isPro=${isPro}, serverStatus=${chatStatus?.canSendMessage}, localCount=${freeUserMessageCount}, canSend=${canSend}`);
    
    return canSend;
  };

  const resetChat = () => {
    setMessages([
      {
        id: '1',
        text: `🎯 **What's good, legend!** Professor Lock here with the inside intel:\n\n• **Fire parlays** built with expert analysis 🎲\n• **Live web search** for breaking news and line moves 🌐\n• **Sharp money tracking** and **value hunts** 🔍\n• Today's **highest confidence locks** 🔒\n\nWhat play we making today? 🔥`,
        isUser: false,
        timestamp: new Date()
      }
    ]);
    setSelectedPick(null);
  };

  const value: AIChatContextType = {
    showAIChat,
    setShowAIChat,
    messages,
    setMessages,
    chatContext,
    setChatContext,
    selectedPick,
    setSelectedPick,
    freeUserMessageCount,
    incrementFreeUserMessages,
    canSendMessage,
    isLoadingMessageCount,
    chatStatus,
    refreshChatStatus,
    openChatWithContext,
    resetChat
  };

  return (
    <AIChatContext.Provider value={value}>
      {children}
    </AIChatContext.Provider>
  );
}

export function useAIChat() {
  const context = useContext(AIChatContext);
  if (context === undefined) {
    throw new Error('useAIChat must be used within an AIChatProvider');
  }
  return context;
}
