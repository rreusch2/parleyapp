'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Target, ChevronLeft, ChevronRight, Edit3, Check, X, TrendingUp, CheckCircle, XCircle, Clock, Trophy } from 'lucide-react'
import { motion } from 'framer-motion'

interface AIPrediction {
  id: string
  user_id: string
  match_teams: string
  pick: string
  odds: string
  confidence: number | null
  sport: string
  event_time: string
  reasoning: string | null
  status: string
  created_at: string
  bet_type: string | null
  roi_estimate: string | null
  value_percentage: string | null
}

export default function AIPredictionsSection() {
  const [predictions, setPredictions] = useState<AIPrediction[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sportFilter, setSportFilter] = useState<string>('all')
  const [editingPick, setEditingPick] = useState<string | null>(null)
  const [editingReasoning, setEditingReasoning] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<{[key: string]: string}>({})
  const [updating, setUpdating] = useState<string | null>(null)
  const pageSize = 10

  useEffect(() => {
    loadPredictions()
  }, [currentPage, statusFilter, sportFilter])

  const loadPredictions = async () => {
    try {
      let query = supabase
        .from('ai_predictions')
        .select('*', { count: 'exact' })
        .gte('created_at', new Date().toISOString().split('T')[0]) // Today's predictions
        .order('created_at', { ascending: false })

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      if (sportFilter !== 'all') {
        query = query.eq('sport', sportFilter)
      }

      const from = (currentPage - 1) * pageSize
      const to = from + pageSize - 1
      query = query.range(from, to)

      const { data, error, count } = await query

      if (error) throw error

      setPredictions(data || [])
      setTotalPages(Math.ceil((count || 0) / pageSize))
    } catch (error) {
      console.error('Error loading predictions:', error)
    } finally {
      setLoading(false)
    }
  }

  const updatePredictionStatus = async (predictionId: string, newStatus: string) => {
    if (updating) return
    
    setUpdating(predictionId)
    try {
      const { error } = await supabase
        .from('ai_predictions')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', predictionId)

      if (error) throw error

      await loadPredictions()
      alert(`✅ Prediction marked as ${newStatus}!`)
    } catch (error) {
      console.error('Error updating prediction status:', error)
      alert('❌ Error updating prediction status')
    } finally {
      setUpdating(null)
    }
  }

  const updatePredictionField = async (predictionId: string, field: string, value: string) => {
    if (updating) return
    
    setUpdating(predictionId)
    try {
      const { error } = await supabase
        .from('ai_predictions')
        .update({ 
          [field]: value,
          updated_at: new Date().toISOString()
        })
        .eq('id', predictionId)

      if (error) throw error

      await loadPredictions()
      alert(`✅ ${field} updated successfully!`)
    } catch (error) {
      console.error(`Error updating ${field}:`, error)
      alert(`❌ Error updating ${field}`)
    } finally {
      setUpdating(null)
      if (field === 'pick') setEditingPick(null)
      if (field === 'reasoning') setEditingReasoning(null)
      setEditValues({})
    }
  }

  const startEdit = (predictionId: string, field: string, currentValue: string) => {
    if (field === 'pick') {
      setEditingPick(predictionId)
      setEditingReasoning(null)
    } else if (field === 'reasoning') {
      setEditingReasoning(predictionId)
      setEditingPick(null)
    }
    setEditValues({ ...editValues, [predictionId]: currentValue })
  }

  const cancelEdit = (predictionId: string) => {
    setEditingPick(null)
    setEditingReasoning(null)
    const newEditValues = { ...editValues }
    delete newEditValues[predictionId]
    setEditValues(newEditValues)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500'
      case 'won': return 'bg-green-500'
      case 'lost': return 'bg-red-500'
      case 'cancelled': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />
      case 'won': return <Trophy className="w-4 h-4" />
      case 'lost': return <XCircle className="w-4 h-4" />
      case 'cancelled': return <X className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  const getSportColor = (sport: string) => {
    switch (sport.toLowerCase()) {
      case 'mlb': return 'bg-blue-600'
      case 'nfl': return 'bg-purple-600'
      case 'nba': return 'bg-orange-600'
      case 'nhl': return 'bg-indigo-600'
      default: return 'bg-gray-600'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
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
          className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
          <option value="cancelled">Cancelled</option>
        </select>
        
        <select
          value={sportFilter}
          onChange={(e) => {
            setSportFilter(e.target.value)
            setCurrentPage(1)
          }}
          className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="all">All Sports</option>
          <option value="MLB">MLB</option>
          <option value="NFL">NFL</option>
          <option value="NBA">NBA</option>
          <option value="NHL">NHL</option>
        </select>
      </div>

      {/* Predictions Table */}
      <div className="overflow-x-auto">
        {predictions.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No predictions found for today</p>
          </div>
        ) : (
          <div className="space-y-4">
            {predictions.map((prediction, index) => (
              <motion.div
                key={prediction.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white/5 rounded-lg p-4 border border-white/10 hover:border-white/20 transition-colors"
              >
                {/* Header Row */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium text-white ${getSportColor(prediction.sport)}`}>
                      {prediction.sport}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium text-white flex items-center space-x-1 ${getStatusColor(prediction.status)}`}>
                      {getStatusIcon(prediction.status)}
                      <span>{prediction.status.toUpperCase()}</span>
                    </span>
                    <span className="text-gray-400 text-sm">
                      {formatDate(prediction.created_at)}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {prediction.confidence && (
                      <div className="flex items-center space-x-1 text-sm">
                        <TrendingUp className="w-4 h-4 text-blue-400" />
                        <span className="text-gray-300">{prediction.confidence}%</span>
                      </div>
                    )}
                    <span className="text-green-400 font-mono text-sm">
                      {prediction.odds > '0' ? '+' : ''}{prediction.odds}
                    </span>
                  </div>
                </div>

                {/* Match Teams */}
                <div className="mb-3">
                  <h3 className="text-white font-medium text-lg">{prediction.match_teams}</h3>
                </div>

                {/* Pick Section */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-gray-300 text-sm font-medium">Pick:</label>
                    <button
                      onClick={() => startEdit(prediction.id, 'pick', prediction.pick)}
                      disabled={editingPick === prediction.id || updating === prediction.id}
                      className="text-blue-400 hover:text-blue-300 disabled:text-gray-500"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {editingPick === prediction.id ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={editValues[prediction.id] || ''}
                        onChange={(e) => setEditValues({ ...editValues, [prediction.id]: e.target.value })}
                        className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        autoFocus
                      />
                      <button
                        onClick={() => updatePredictionField(prediction.id, 'pick', editValues[prediction.id])}
                        disabled={updating === prediction.id}
                        className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded transition-colors"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => cancelEdit(prediction.id)}
                        className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="bg-white/5 rounded-md p-3 border border-white/10">
                      <p className="text-white font-medium">{prediction.pick}</p>
                    </div>
                  )}
                </div>

                {/* Reasoning Section */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-gray-300 text-sm font-medium">Reasoning:</label>
                    <button
                      onClick={() => startEdit(prediction.id, 'reasoning', prediction.reasoning || '')}
                      disabled={editingReasoning === prediction.id || updating === prediction.id}
                      className="text-blue-400 hover:text-blue-300 disabled:text-gray-500"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {editingReasoning === prediction.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editValues[prediction.id] || ''}
                        onChange={(e) => setEditValues({ ...editValues, [prediction.id]: e.target.value })}
                        rows={4}
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                        autoFocus
                      />
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => updatePredictionField(prediction.id, 'reasoning', editValues[prediction.id])}
                          disabled={updating === prediction.id}
                          className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded transition-colors"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => cancelEdit(prediction.id)}
                          className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white/5 rounded-md p-3 border border-white/10">
                      <p className="text-gray-300 text-sm leading-relaxed">
                        {prediction.reasoning || 'No reasoning provided'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                {prediction.status === 'pending' && (
                  <div className="flex items-center space-x-2 pt-3 border-t border-white/10">
                    <button
                      onClick={() => updatePredictionStatus(prediction.id, 'won')}
                      disabled={updating === prediction.id}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-sm rounded transition-colors flex items-center space-x-2"
                    >
                      <Trophy className="w-4 h-4" />
                      <span>Mark as Won</span>
                    </button>
                    <button
                      onClick={() => updatePredictionStatus(prediction.id, 'lost')}
                      disabled={updating === prediction.id}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white text-sm rounded transition-colors flex items-center space-x-2"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Mark as Lost</span>
                    </button>
                    <button
                      onClick={() => updatePredictionStatus(prediction.id, 'cancelled')}
                      disabled={updating === prediction.id}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-600 text-white text-sm rounded transition-colors flex items-center space-x-2"
                    >
                      <X className="w-4 h-4" />
                      <span>Cancel</span>
                    </button>
                  </div>
                )}

                {/* Additional Info */}
                <div className="flex items-center justify-between pt-3 border-t border-white/10 text-xs text-gray-400">
                  <div className="flex items-center space-x-4">
                    {prediction.roi_estimate && (
                      <span>ROI: {prediction.roi_estimate}%</span>
                    )}
                    {prediction.value_percentage && (
                      <span>Value: {prediction.value_percentage}%</span>
                    )}
                    {prediction.bet_type && (
                      <span>Type: {prediction.bet_type}</span>
                    )}
                  </div>
                  <span>Event: {formatDate(prediction.event_time)}</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-gray-400 text-sm">
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, predictions.length)} of {predictions.length} predictions
          </p>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:text-gray-500 text-white rounded transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 bg-purple-600 text-white rounded">
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