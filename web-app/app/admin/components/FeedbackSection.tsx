'use client'
import { useState, useEffect } from 'react'
import apiClient from '@/lib/apiClient'
import { MessageSquare, Star, Calendar, User, ChevronLeft, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'

interface FeedbackData {
  id: string
  user_id: string | null
  email: string
  feedback_type: string
  message: string
  rating: number | null
  created_at: string
}

export default function FeedbackSection() {
  const [feedback, setFeedback] = useState<FeedbackData[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const pageSize = 10

  useEffect(() => {
    loadFeedback()
  }, [currentPage, typeFilter])

  const loadFeedback = async () => {
    try {
      const params = {
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
        typeFilter: typeFilter
      }

      const { data } = await apiClient.get('/admin/feedback', { params })
      
      console.log('Feedback data loaded:', data.data?.length)
      setFeedback(data.data || [])
      setTotalPages(data.totalPages || 1)
    } catch (error) {
      console.error('Error loading feedback:', error)
    } finally {
      setLoading(false)
    }
  }

  const getFeedbackTypeColor = (type: string) => {
    switch (type) {
      case 'feature_request': return 'bg-blue-500'
      case 'bug_report': return 'bg-red-500'
      case 'ai_suggestion': return 'bg-purple-500'
      case 'ui_improvement': return 'bg-orange-500'
      default: return 'bg-gray-500'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const renderStars = (rating: number | null) => {
    if (!rating) return <span className="text-gray-400">No rating</span>
    
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating ? 'text-yellow-400 fill-current' : 'text-gray-400'
            }`}
          />
        ))}
        <span className="text-sm text-gray-300 ml-2">({rating}/5)</span>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Filter */}
      <div className="mb-6">
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value)
            setCurrentPage(1)
          }}
          className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Types</option>
          <option value="general">General</option>
          <option value="feature_request">Feature Request</option>
          <option value="bug_report">Bug Report</option>
          <option value="ai_suggestion">AI Suggestion</option>
          <option value="ui_improvement">UI Improvement</option>
        </select>
      </div>

      {/* Feedback List */}
      <div className="space-y-4">
        {feedback.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No feedback found</p>
          </div>
        ) : (
          feedback.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white/5 rounded-lg p-4 border border-white/10 hover:border-white/20 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{item.email}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium text-white ${getFeedbackTypeColor(item.feedback_type)}`}>
                        {item.feedback_type.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className="text-gray-400 text-sm flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        {formatDate(item.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
                {renderStars(item.rating)}
              </div>
              
              <div className="bg-white/5 rounded-md p-3 border border-white/10">
                <p className="text-gray-300 text-sm leading-relaxed">{item.message}</p>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-gray-400 text-sm">
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, feedback.length)} of {feedback.length} items
          </p>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:text-gray-500 text-white rounded transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 bg-blue-600 text-white rounded">
              {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:text-gray-500 text-white rounded transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}