// Shared AI Chat hook (adapted from mobile aiChatContext.tsx)
'use client'
import { useState, useEffect, useCallback } from 'react'
import { AIPrediction } from '../services/aiService'

export interface ChatMessage {
  id: string
  text: string
  isUser: boolean
  timestamp: Date
  toolsUsed?: string[]
  isSearching?: boolean
  searchQuery?: string
}

export interface ChatContext {
  screen?: string
  selectedPick?: any
  selectedPrediction?: AIPrediction
  userPreferences?: any
  customPrompt?: string
}

// Web storage helper (replaces AsyncStorage)
const getStorageItem = (key: string): string | null => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(key)
}

const setStorageItem = (key: string, value: string): void => {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, value)
}

const removeStorageItem = (key: string): void => {
  if (typeof window === 'undefined') return
  localStorage.removeItem(key)
}

export function useAIChat() {
  const [showAIChat, setShowAIChat] = useState(false)
  const [selectedPick, setSelectedPick] = useState<AIPrediction | null>(null)
  const [chatContext, setChatContext] = useState<ChatContext>({})
  const [freeUserMessageCount, setFreeUserMessageCount] = useState(0)
  const [isLoadingMessageCount, setIsLoadingMessageCount] = useState(true)

  // Initialize with Professor Lock welcome message
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      text: `🎯 **What's good, legend!** Professor Lock here with the inside intel:\n\n• **Fire parlays** built with expert analysis 🎲\n• **Live web search** for breaking news and line moves 🌐\n• **Sharp money tracking** and **value hunts** 🔍\n• Today's **highest confidence locks** 🔒\n\nWhat play we making today? 🔥`,
      isUser: false,
      timestamp: new Date()
    }
  ])

  // Load saved message count on mount
  useEffect(() => {
    const loadMessageCount = async () => {
      try {
        setIsLoadingMessageCount(true)
        
        // Get existing count or start fresh
        const savedCount = getStorageItem('freeUserMessageCount')
        const count = savedCount ? parseInt(savedCount, 10) : 0
        
        console.log('📱 Loading message count:', count)
        setFreeUserMessageCount(count)
        
      } catch (error) {
        console.warn('Failed to load free user message count:', error)
        setFreeUserMessageCount(0)
      } finally {
        setIsLoadingMessageCount(false)
      }
    }
    loadMessageCount()
  }, [])

  const openChatWithContext = useCallback((context: ChatContext, pick?: AIPrediction) => {
    setChatContext(context)
    if (pick) {
      setSelectedPick(pick)
    }
    setShowAIChat(true)
  }, [])

  const incrementFreeUserMessages = useCallback(async () => {
    const newCount = freeUserMessageCount + 1
    console.log(`📈 Incrementing free user message count: ${freeUserMessageCount} -> ${newCount}`)
    setFreeUserMessageCount(newCount)
    try {
      setStorageItem('freeUserMessageCount', newCount.toString())
      console.log('💾 Saved new message count to storage')
    } catch (error) {
      console.warn('Failed to save free user message count:', error)
    }
  }, [freeUserMessageCount])

  const canSendMessage = useCallback((isPro: boolean) => {
    if (isPro) return true
    
    // Don't restrict while loading to prevent confusion
    if (isLoadingMessageCount) return true
    
    // Free users can send 3 messages (when count is 0, 1, or 2)
    // After 3rd message, count becomes 3 and they're blocked
    const canSend = freeUserMessageCount < 3
    
    console.log(`🔍 canSendMessage check: isPro=${isPro}, messageCount=${freeUserMessageCount}, canSend=${canSend}, isLoading=${isLoadingMessageCount}`)
    
    return canSend
  }, [freeUserMessageCount, isLoadingMessageCount])

  const resetChat = useCallback(() => {
    setMessages([
      {
        id: '1',
        text: `🎯 **What's good, legend!** Professor Lock here with the inside intel:\n\n• **Fire parlays** built with expert analysis 🎲\n• **Live web search** for breaking news and line moves 🌐\n• **Sharp money tracking** and **value hunts** 🔍\n• Today's **highest confidence locks** 🔒\n\nWhat play we making today? 🔥`,
        isUser: false,
        timestamp: new Date()
      }
    ])
    setSelectedPick(null)
  }, [])

  const addMessage = useCallback((message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date()
    }
    setMessages(prev => [...prev, newMessage])
  }, [])

  const sendMessage = useCallback(async (text: string, isPro: boolean) => {
    if (!canSendMessage(isPro)) {
      console.log('Message limit reached for free user')
      return false
    }

    // Add user message
    addMessage({
      text,
      isUser: true
    })

    // Increment count for free users
    if (!isPro) {
      await incrementFreeUserMessages()
    }

    // Add loading message
    const loadingId = Date.now().toString()
    addMessage({
      text: 'Analyzing your request...',
      isUser: false,
      isSearching: true
    })

    try {
      // Here you would call your AI chat API
      // For now, we'll simulate a response
      setTimeout(() => {
        setMessages(prev => 
          prev.filter(m => m.id !== loadingId).concat({
            id: (Date.now() + 1).toString(),
            text: `🔥 Great question! Based on the current data and market analysis, here's what I'm seeing:\n\n• **Market Movement**: Sharp money is coming in\n• **Value Assessment**: This looks promising\n• **Risk Level**: Moderate\n\nWant me to dive deeper into any specific aspect?`,
            isUser: false,
            timestamp: new Date()
          })
        )
      }, 2000)

      return true
    } catch (error) {
      console.error('Error sending message:', error)
      return false
    }
  }, [canSendMessage, addMessage, incrementFreeUserMessages])

  return {
    // Chat state
    showAIChat,
    setShowAIChat,
    messages,
    setMessages,
    
    // Context state
    chatContext,
    setChatContext,
    
    // Selected prediction/pick for context
    selectedPick,
    setSelectedPick,
    
    // Free user tracking
    freeUserMessageCount,
    incrementFreeUserMessages,
    canSendMessage,
    isLoadingMessageCount,
    
    // Helper functions
    openChatWithContext,
    resetChat,
    addMessage,
    sendMessage
  }
}