// Shared API client for web platform (adapted from mobile)
import axios from 'axios'
import { supabase } from '../../lib/supabase'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://zooming-rebirth-production-a305.up.railway.app/api'

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
  withCredentials: true
})

// Add auth token to requests (web version)
apiClient.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`
  }
  return config
})

// Handle response errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

export default apiClient