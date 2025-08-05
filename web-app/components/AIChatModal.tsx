'use client'
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, 
  Send, 
  MessageCircle, 
  Brain, 
  Sparkles,
  Crown,
  Lock
} from 'lucide-react'
import { useAIChat } from '@/shared/hooks/useAIChat'
import { useSubscription } from '@/contexts/SubscriptionContext'

interface AIChatModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function AIChatModal({ isOpen, onClose }: AIChatModalProps) {
  const [inputText, setInputText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  
  const { subscriptionTier } = useSubscription()
  const {
    messages,
    canSendMessage,
    freeUserMessageCount,
    sendMessage,
    resetChat
  } = useAIChat()

  const isPro = subscriptionTier !== 'free'

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const handleSend = async () => {
    if (!inputText.trim()) return
    if (!canSendMessage(isPro)) return

    const messageText = inputText.trim()
    setInputText('')
    setIsTyping(true)

    try {
      await sendMessage(messageText, isPro)
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setIsTyping(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
        
        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-2xl h-[600px] bg-gradient-to-br from-gray-900 via-blue-900/50 to-gray-900 rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/20">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white flex items-center">
                  Professor Lock
                  <Sparkles className="w-4 h-4 ml-2 text-yellow-400" />
                </h2>
                <p className="text-sm text-blue-200">
                  AI Sports Betting Expert
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Message count for free users */}
              {!isPro && (
                <div className="flex items-center space-x-2 px-3 py-1 bg-white/10 rounded-full">
                  <MessageCircle className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-white">
                    {3 - freeUserMessageCount} left
                  </span>
                </div>
              )}
              
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] p-3 rounded-lg ${
                  message.isUser 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white/5 text-gray-100 border border-white/10'
                }`}>
                  {!message.isUser && (
                    <div className="flex items-center space-x-2 mb-2">
                      <Brain className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-medium text-purple-400">Professor Lock</span>
                    </div>
                  )}
                  
                  {message.isSearching ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin"></div>
                      <span className="text-sm text-gray-300">{message.text}</span>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap text-sm">
                      {message.text}
                    </div>
                  )}
                  
                  <div className="text-xs text-gray-400 mt-2">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </motion.div>
            ))}
            
            {isTyping && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className="bg-white/5 border border-white/10 p-3 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Brain className="w-4 h-4 text-purple-400" />
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-white/10 bg-black/20">
            {/* Free user limit reached */}
            {!isPro && !canSendMessage(isPro) && (
              <div className="mb-4 p-3 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Lock className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm text-yellow-200">
                    Free message limit reached. Upgrade to continue chatting with Professor Lock!
                  </span>
                </div>
              </div>
            )}
            
            <div className="flex space-x-3">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={!canSendMessage(isPro) || isTyping}
                placeholder={
                  canSendMessage(isPro) 
                    ? "Ask Professor Lock about picks, analysis, or betting strategy..." 
                    : "Upgrade to continue chatting..."
                }
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              
              <button
                onClick={handleSend}
                disabled={!inputText.trim() || !canSendMessage(isPro) || isTyping}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <Send className="w-4 h-4" />
                <span>Send</span>
              </button>
            </div>
            
            {/* Subscription prompt */}
            {!isPro && (
              <div className="mt-3 text-center">
                <p className="text-xs text-gray-400">
                  Upgrade to <span className="text-blue-400">Pro</span> or <span className="text-purple-400">Elite</span> for unlimited AI chats
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}