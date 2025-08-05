'use client'
import { useState, useEffect } from 'react'
import apiClient from '@/lib/apiClient'
import { HelpCircle, User, Calendar, ChevronLeft, ChevronRight, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react'
import { motion } from 'framer-motion'

interface SupportRequestData {
  id: string
  user_id: string | null
  email: string
  subject: string
  message: string
  category: string
  status: string
  created_at: string
  updated_at: string
}

export default function SupportRequestsSection() {
  const [requests, setRequests] = useState<SupportRequestData[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [updating, setUpdating] = useState<string | null>(null)
  const pageSize = 10

  useEffect(() => {
    loadSupportRequests()
  }, [currentPage, statusFilter, categoryFilter])

  const loadSupportRequests = async () => {
    try {
      const params = {
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
        statusFilter: statusFilter,
        categoryFilter: categoryFilter
      }

      const { data } = await apiClient.get('/admin/support-requests', { params })

      console.log('Support requests data loaded:', data.data?.length)
      setRequests(data.data || [])
      setTotalPages(data.totalPages || 1)
    } catch (error) {
      console.error('Error loading support requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateRequestStatus = async (requestId: string, newStatus: string) => {
    if (updating) return
    
    setUpdating(requestId)
    try {
      await apiClient.patch('/admin/support-requests', {
        id: requestId,
        status: newStatus
      })

      await loadSupportRequests()
      alert(`✅ Support request status updated to ${newStatus}!`)
    } catch (error) {
      console.error('Error updating support request:', error)
      alert('❌ Error updating support request status')
    } finally {
      setUpdating(null)
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'technical': return 'bg-red-500'
      case 'billing': return 'bg-green-500'
      case 'account': return 'bg-blue-500'
      case 'feature_request': return 'bg-purple-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-yellow-500'
      case 'in_progress': return 'bg-blue-500'
      case 'resolved': return 'bg-green-500'
      case 'closed': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <AlertCircle className="w-4 h-4" />
      case 'in_progress': return <Clock className="w-4 h-4" />
      case 'resolved': return <CheckCircle className="w-4 h-4" />
      case 'closed': return <XCircle className="w-4 h-4" />
      default: return <HelpCircle className="w-4 h-4" />
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value)
            setCurrentPage(1)
          }}
          className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value)
            setCurrentPage(1)
          }}
          className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="all">All Categories</option>
          <option value="technical">Technical</option>
          <option value="billing">Billing</option>
          <option value="account">Account</option>
          <option value="feature_request">Feature Request</option>
          <option value="other">Other</option>
        </select>
      </div>

      {/* Support Requests List */}
      <div className="space-y-4">
        {requests.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <HelpCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No support requests found</p>
          </div>
        ) : (
          requests.map((request, index) => (
            <motion.div
              key={request.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white/5 rounded-lg p-4 border border-white/10 hover:border-white/20 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-500 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-medium">{request.email}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium text-white ${getCategoryColor(request.category)}`}>
                        {request.category.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium text-white flex items-center space-x-1 ${getStatusColor(request.status)}`}>
                        {getStatusIcon(request.status)}
                        <span>{request.status.replace('_', ' ').toUpperCase()}</span>
                      </span>
                      <span className="text-gray-400 text-sm flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        {formatDate(request.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Status Update Actions */}
                <div className="flex space-x-2">
                  {request.status === 'open' && (
                    <button
                      onClick={() => updateRequestStatus(request.id, 'in_progress')}
                      disabled={updating === request.id}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-xs rounded transition-colors"
                    >
                      Start Work
                    </button>
                  )}
                  {request.status === 'in_progress' && (
                    <button
                      onClick={() => updateRequestStatus(request.id, 'resolved')}
                      disabled={updating === request.id}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-xs rounded transition-colors"
                    >
                      Resolve
                    </button>
                  )}
                  {request.status === 'resolved' && (
                    <button
                      onClick={() => updateRequestStatus(request.id, 'closed')}
                      disabled={updating === request.id}
                      className="px-3 py-1 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-600 text-white text-xs rounded transition-colors"
                    >
                      Close
                    </button>
                  )}
                </div>
              </div>
              
              <div className="mb-3">
                <h3 className="text-white font-medium text-lg">{request.subject}</h3>
              </div>
              
              <div className="bg-white/5 rounded-md p-3 border border-white/10">
                <p className="text-gray-300 text-sm leading-relaxed">{request.message}</p>
              </div>
              
              {request.updated_at !== request.created_at && (
                <div className="mt-2 text-xs text-gray-400">
                  Last updated: {formatDate(request.updated_at)}
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-gray-400 text-sm">
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, requests.length)} of {requests.length} items
          </p>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:text-gray-500 text-white rounded transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 bg-green-600 text-white rounded">
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