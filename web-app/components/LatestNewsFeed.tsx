'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { 
  AlertCircle,
  TrendingUp,
  Clock,
  ExternalLink,
  Activity,
  User,
  Zap,
  Calendar,
  Flame,
  Eye,
  ChevronRight,
  AlertTriangle,
  Trophy,
  BarChart3,
  Newspaper
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface NewsItem {
  id: string
  title: string
  content?: string
  url?: string
  source: string
  published_date?: string
  scraped_at: string
  teams?: string[]
  players?: string[]
  keywords?: string[]
  sentiment_score?: number
  relevance_score?: number
  category?: string
  metadata?: any
  is_active?: boolean
}

interface LatestNewsFeedProps {
  limit?: number
  sport?: string
  showHeader?: boolean
  onNewsClick?: (news: NewsItem) => void
}

export default function LatestNewsFeed({ 
  limit = 5, 
  sport, 
  showHeader = true, 
  onNewsClick 
}: LatestNewsFeedProps) {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
    fetchNews()
  }, [sport])

  const fetchNews = async () => {
    setLoading(true)
    try {
      setError(null)
      
      let query = supabase
        .from('scrapy_news')
        .select('*')
        .eq('is_active', true)
        .order('scraped_at', { ascending: false })
        .limit(limit)

      if (sport) {
        // Filter by sport if specified
        query = query.contains('keywords', [sport])
      }

      const { data, error: queryError } = await query

      if (queryError) {
        console.error('Error fetching news:', queryError)
        setError('Failed to load news')
        return
      }

      setNews(data || [])
    } catch (error) {
      console.error('Error:', error)
      setError('Failed to load news')
    } finally {
      setLoading(false)
    }
  }

  const getNewsIcon = (category?: string) => {
    switch (category) {
      case 'trade': return <TrendingUp className="w-4 h-4 text-blue-400" />
      case 'injury': return <AlertTriangle className="w-4 h-4 text-red-400" />
      case 'lineup': return <User className="w-4 h-4 text-green-400" />
      case 'breaking': return <Flame className="w-4 h-4 text-orange-400" />
      case 'analysis': return <BarChart3 className="w-4 h-4 text-purple-400" />
      default: return <Newspaper className="w-4 h-4 text-gray-400" />
    }
  }

  const getTimeAgo = (dateString: string | null) => {
    if (!dateString) return 'Unknown'
    
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) return 'Just now'
    if (diffInHours < 24) return `${diffInHours}h ago`
    
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return `${diffInDays}d ago`
    
    return date.toLocaleDateString()
  }

  const handleNewsClick = (newsItem: NewsItem) => {
    if (onNewsClick) {
      onNewsClick(newsItem)
    } else if (newsItem.url) {
      window.open(newsItem.url, '_blank')
    }
  }

  const getSentimentColor = (score?: number) => {
    if (!score) return 'text-gray-400'
    if (score > 0.1) return 'text-green-400'
    if (score < -0.1) return 'text-red-400'
    return 'text-yellow-400'
  }

  if (!mounted) {
    return null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Section Header */}
      {showHeader && (
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white">📰 Latest News</h3>
            <p className="text-gray-400">Breaking news and updates</p>
          </div>
          <button
            onClick={() => router.push('/news')}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all duration-200"
          >
            <Newspaper className="w-4 h-4" />
            <span>View All</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="space-y-4">
          {Array.from({ length: limit }).map((_, i) => (
            <div key={i} className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
              <div className="animate-pulse">
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 bg-gray-600 rounded-lg"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-600 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-700 rounded w-full mb-2"></div>
                    <div className="h-3 bg-gray-700 rounded w-2/3"></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center"
        >
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h4 className="text-white font-semibold mb-2">Unable to Load News</h4>
          <p className="text-gray-400 mb-4">{error}</p>
          <button
            onClick={fetchNews}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </motion.div>
      )}

      {/* News List */}
      {!loading && !error && news.length > 0 && (
        <div className="space-y-4">
          {news.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 hover:border-blue-500/50 transition-all duration-300 cursor-pointer group"
              onClick={() => handleNewsClick(item)}
            >
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-gray-800 rounded-lg group-hover:bg-gray-700 transition-colors">
                  {getNewsIcon(item.category)}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-white font-medium group-hover:text-blue-400 transition-colors line-clamp-2">
                      {item.title}
                    </h4>
                    <div className="flex items-center space-x-2 ml-3 flex-shrink-0">
                      {item.url && (
                        <ExternalLink className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                  </div>
                  
                  {item.content && (
                    <p className="text-gray-300 text-sm mb-3 line-clamp-2">
                      {item.content.substring(0, 150)}...
                    </p>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 text-xs text-gray-400">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{getTimeAgo(item.published_date || item.scraped_at)}</span>
                      </div>
                      <span>•</span>
                      <span>{item.source}</span>
                      {item.sentiment_score && (
                        <>
                          <span>•</span>
                          <span className={getSentimentColor(item.sentiment_score)}>
                            {item.sentiment_score > 0.1 ? 'Positive' : 
                             item.sentiment_score < -0.1 ? 'Negative' : 'Neutral'}
                          </span>
                        </>
                      )}
                    </div>
                    
                    {item.relevance_score && item.relevance_score > 0.7 && (
                      <div className="flex items-center space-x-1 px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs">
                        <Flame className="w-3 h-3" />
                        <span>Hot</span>
                      </div>
                    )}
                  </div>

                  {/* Tags */}
                  {(item.teams || item.players || item.keywords) && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {item.teams?.slice(0, 2).map((team, idx) => (
                        <span key={idx} className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full">
                          {team}
                        </span>
                      ))}
                      {item.players?.slice(0, 2).map((player, idx) => (
                        <span key={idx} className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded-full">
                          {player}
                        </span>
                      ))}
                      {item.keywords?.slice(0, 2).map((keyword, idx) => (
                        <span key={idx} className="text-xs px-2 py-1 bg-purple-500/20 text-purple-400 rounded-full">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && news.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10 text-center"
        >
          <Newspaper className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <h4 className="text-xl font-semibold text-white mb-2">
            No News Available
          </h4>
          <p className="text-gray-400 mb-4">
            Check back soon for the latest updates and breaking news
          </p>
          <button
            onClick={fetchNews}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Refresh News
          </button>
        </motion.div>
      )}

      {/* View All CTA */}
      {!loading && !error && news.length > 0 && showHeader && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <button
            onClick={() => router.push('/news')}
            className="inline-flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg font-semibold hover:from-gray-700 hover:to-gray-800 transition-all duration-200"
          >
            <Newspaper className="w-4 h-4" />
            <span>Read More News</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </motion.div>
  )
}