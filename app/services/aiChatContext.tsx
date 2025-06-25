import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AIPrediction } from '@/app/services/api/aiService';

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
  incrementFreeUserMessages: () => void;
  canSendMessage: (isPro: boolean) => boolean;
  isLoadingMessageCount: boolean;
  
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

  // Load saved message count on mount
  useEffect(() => {
    const loadMessageCount = async () => {
      try {
        setIsLoadingMessageCount(true);
        const saved = await AsyncStorage.getItem('freeUserMessageCount');
        if (saved !== null) {
          const count = parseInt(saved, 10);
          console.log('📱 Loaded free user message count:', count);
          setFreeUserMessageCount(count);
        } else {
          console.log('📱 No saved message count found, starting fresh');
        }
      } catch (error) {
        console.warn('Failed to load free user message count:', error);
      } finally {
        setIsLoadingMessageCount(false);
      }
    };
    loadMessageCount();
  }, []);
  
  // Initialize with welcome message
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      text: `🎯 **What's good, brother!** Professor Lock here with the inside intel:\n\n• **Fire parlays** built with expert analysis 🎲\n• **Live web search** for breaking news and line moves 🌐\n• **Sharp money tracking** and **value hunts** 🔍\n• Today's **highest confidence locks** 🔒\n\nWhat play we making today? 🔥`,
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
    const newCount = freeUserMessageCount + 1;
    console.log(`📈 Incrementing free user message count: ${freeUserMessageCount} -> ${newCount}`);
    setFreeUserMessageCount(newCount);
    try {
      await AsyncStorage.setItem('freeUserMessageCount', newCount.toString());
      console.log('💾 Saved new message count to storage');
    } catch (error) {
      console.warn('Failed to save free user message count:', error);
    }
  };

  const canSendMessage = (isPro: boolean) => {
    if (isPro) return true;
    // Don't restrict while loading to prevent confusion
    if (isLoadingMessageCount) return true;
    const canSend = freeUserMessageCount < 1;
    console.log(`🔍 canSendMessage check: isPro=${isPro}, messageCount=${freeUserMessageCount}, canSend=${canSend}`);
    return canSend;
  };

  const resetChat = () => {
    setMessages([
      {
        id: '1',
        text: `🎯 **What's good, brother!** Professor Lock here with the inside intel:\n\n• **Fire parlays** built with expert analysis 🎲\n• **Live web search** for breaking news and line moves 🌐\n• **Sharp money tracking** and **value hunts** 🔍\n• Today's **highest confidence locks** 🔒\n\nWhat play we making today? 🔥`,
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