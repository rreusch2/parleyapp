import axios from 'axios'
import { AIPrediction, UserStats } from './supabase'

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  }
})

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    // Get auth token from Supabase session if available
    const session = typeof window !== 'undefined' ? 
      JSON.parse(localStorage.getItem('sb-' + process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0] + '-auth-token') || '{}') : null
    
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`
    }
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// AI Service - matches your React Native aiService
export const aiService = {
  // Check if user is new (for welcome bonus)
  isNewUser: async (): Promise<boolean> => {
    try {
      const response = await api.get('/api/user/is-new')
      return response.data.isNewUser
    } catch (error) {
      console.error('Error checking if user is new:', error)
      return false
    }
  },

  // Get today's AI predictions
  getTodaysPicks: async (userId: string): Promise<AIPrediction[]> => {
    try {
      const response = await api.get(`/api/predictions/today/${userId}`)
      return response.data.predictions || []
    } catch (error) {
      console.error('Error fetching today\'s picks:', error)
      return []
    }
  },

  // Get user stats
  getUserStats: async (userId: string): Promise<UserStats> => {
    try {
      const response = await api.get(`/api/user/stats/${userId}`)
      return response.data.stats || {
        todayPicks: 0,
        winRate: '0%',
        roi: '0%',
        streak: 0,
        totalBets: 0,
        profitLoss: '$0'
      }
    } catch (error) {
      console.error('Error fetching user stats:', error)
      return {
        todayPicks: 0,
        winRate: '0%',
        roi: '0%',
        streak: 0,
        totalBets: 0,
        profitLoss: '$0'
      }
    }
  },

  // Get Pro AI picks (for Pro/Elite users)
  getProPicks: async (userId: string): Promise<AIPrediction[]> => {
    try {
      const response = await api.get(`/api/predictions/pro/${userId}`)
      return response.data.picks || []
    } catch (error) {
      console.error('Error fetching Pro picks:', error)
      return []
    }
  },

  // Get Elite picks (for Elite users)
  getElitePicks: async (userId: string): Promise<AIPrediction[]> => {
    try {
      const response = await api.get(`/api/predictions/elite/${userId}`)
      return response.data.picks || []
    } catch (error) {
      console.error('Error fetching Elite picks:', error)
      return []
    }
  },

  // Chat with AI assistant
  chatWithAI: async (message: string, context?: any): Promise<string> => {
    try {
      const response = await api.post('/api/ai/chat', {
        message,
        context
      })
      return response.data.response || 'Sorry, I could not process your request.'
    } catch (error) {
      console.error('Error chatting with AI:', error)
      return 'Sorry, I could not process your request.'
    }
  },

  // Get daily insights
  getDailyInsights: async (userId: string): Promise<any[]> => {
    try {
      const response = await api.get(`/api/insights/daily/${userId}`)
      return response.data.insights || []
    } catch (error) {
      console.error('Error fetching daily insights:', error)
      return []
    }
  },

  // Get injury reports
  getInjuryReports: async (): Promise<any[]> => {
    try {
      const response = await api.get('/api/injuries/latest')
      return response.data.injuries || []
    } catch (error) {
      console.error('Error fetching injury reports:', error)
      return []
    }
  },

  // Get news feed
  getNewsFeed: async (): Promise<any[]> => {
    try {
      const response = await api.get('/api/news/latest')
      return response.data.news || []
    } catch (error) {
      console.error('Error fetching news feed:', error)
      return []
    }
  }
}

// Export default axios instance for custom calls
export default api
