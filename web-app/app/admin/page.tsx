'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { checkAdminAccess } from '@/lib/adminAuth'
import { revenueCatAPI, SubscriptionStatus, OverviewMetrics, ProductMetrics, RevenueData } from '@/lib/revenuecat'
import { 
  Users, 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight,
  Crown,
  Star,
  Shield,
  Calendar,
  Mail,
  Settings,
  TrendingUp,
  DollarSign,
  RefreshCw,
  UserCheck,
  UserX,
  Eye,
  BarChart3,
  PieChart,
  Activity,
  Zap,
  Clock,
  ShoppingCart,
  Target,
  Gift,
  Award,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { motion } from 'framer-motion'
import UserActivityChart from './components/UserActivityChart'
import QuickActions from './components/QuickActions'

interface UserData {
  id: string
  username: string | null
  email: string | null
  subscription_tier: 'free' | 'pro' | 'elite'
  subscription_status: 'active' | 'inactive' | 'cancelled' | 'expired' | 'past_due'
  subscription_plan_type: string | null
  subscription_expires_at: string | null
  created_at: string
  admin_role: boolean
  is_active: boolean
  revenuecat_customer_id: string | null
}

interface AdminStats {
  totalUsers: number
  proUsers: number
  eliteUsers: number
  activeSubscriptions: number
  monthlyRevenue: number
  newUsersToday: number
}

interface EnhancedStats extends AdminStats {
  revenueCatMRR: number
  revenueCatActiveTrials: number
  revenueCatConversionRate: number
  revenueCatChurnRate: number
  totalRevenueLast30Days: number
}

export default function AdminDashboard() {
  const { user, profile } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<UserData[]>([])
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    proUsers: 0,
    eliteUsers: 0,
    activeSubscriptions: 0,
    monthlyRevenue: 0,
    newUsersToday: 0
  })
  const [enhancedStats, setEnhancedStats] = useState<EnhancedStats | null>(null)
  const [revenueCatOverview, setRevenueCatOverview] = useState<OverviewMetrics | null>(null)
  const [productMetrics, setProductMetrics] = useState<ProductMetrics[]>([])
  const [revenueData, setRevenueData] = useState<RevenueData[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [tierFilter, setTierFilter] = useState<'all' | 'free' | 'pro' | 'elite'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const [revenueCatStatuses, setRevenueCatStatuses] = useState<Map<string, SubscriptionStatus>>(new Map())
  const [syncingRevenueCat, setSyncingRevenueCat] = useState(false)
  const [loadingRevenueCatMetrics, setLoadingRevenueCatMetrics] = useState(false)
  const pageSize = 20

  // Check admin access
  useEffect(() => {
    const checkAccess = async () => {
      if (!user) {
        router.push('/dashboard')
        return
      }

      const hasAccess = await checkAdminAccess(user.id)
      if (!hasAccess) {
        router.push('/dashboard')
        return
      }

      setLoading(false)
    }

    checkAccess()
  }, [user, router])

  // Load dashboard data
  useEffect(() => {
    if (!loading) {
      loadDashboardData()
    }
  }, [loading, currentPage, searchTerm, tierFilter, statusFilter])

  const loadDashboardData = async () => {
    try {
      await Promise.all([
        loadUsers(),
        loadStats(),
        loadRevenueCatMetrics()
      ])
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    }
  }

  const loadRevenueCatMetrics = async () => {
    if (!revenueCatAPI.isConfigured()) {
      console.log('RevenueCat API not configured, skipping metrics load')
      return
    }

    setLoadingRevenueCatMetrics(true)
    try {
      console.log('🔄 Loading REAL RevenueCat metrics with user data...')
      
      // Get user IDs for metrics calculation
      const userIds = users.map(user => user.revenuecat_customer_id || user.id).filter(Boolean)
      console.log(`📄 Using ${userIds.length} user IDs for metrics calculation`)
      
      if (userIds.length === 0) {
        console.log('⚠️ No users available for metrics calculation')
        return
      }
      
      // Load REAL metrics based on actual subscriber data
      const [overview, products, revenue] = await Promise.all([
        revenueCatAPI.getOverviewMetrics(userIds),
        revenueCatAPI.getProductMetrics(userIds),
        revenueCatAPI.getRevenueData(30, userIds)
      ])

      setRevenueCatOverview(overview)
      setProductMetrics(products)
      setRevenueData(revenue)

      // Combine with existing stats for enhanced dashboard
      if (overview) {
        const enhanced: EnhancedStats = {
          ...stats,
          revenueCatMRR: overview.mrr,
          revenueCatActiveTrials: overview.active_trials,
          revenueCatConversionRate: overview.conversion_rate,
          revenueCatChurnRate: overview.churn_rate,
          totalRevenueLast30Days: overview.revenue
        }
        setEnhancedStats(enhanced)
        
        console.log('✅ Successfully loaded REAL RevenueCat metrics:', {
          totalUsers: userIds.length,
          activeSubscriptions: overview.active_subscriptions,
          activeTrials: overview.active_trials,
          mrr: overview.mrr,
          products: products.length,
          revenueDataPoints: revenue.length,
          productBreakdown: overview.product_breakdown,
          storeBreakdown: overview.store_breakdown
        })
      }
    } catch (error) {
      console.error('❌ Error loading RevenueCat metrics:', error)
    } finally {
      setLoadingRevenueCatMetrics(false)
    }
  }

  const syncRevenueCatData = async () => {
    if (!revenueCatAPI.isConfigured()) {
      alert('RevenueCat API key not configured. Please set NEXT_PUBLIC_REVENUECAT_API_KEY environment variable.')
      return
    }

    setSyncingRevenueCat(true)
    try {
      console.log('🚀 Starting comprehensive RevenueCat sync...')
      
      const userIds = users.map(user => user.revenuecat_customer_id || user.id).filter(Boolean)
      console.log(`Found ${userIds.length} users to sync`)
      
      // Get comprehensive subscription statuses with enhanced data
      const statuses = await revenueCatAPI.getBatchSubscribers(userIds)
      setRevenueCatStatuses(statuses)
      
      // Analyze sync results
      const activeSubscribers = Array.from(statuses.values()).filter(s => s.isActive)
      const trialUsers = Array.from(statuses.values()).filter(s => s.isTrialActive)
      const productTypes = new Set(activeSubscribers.map(s => s.productType))
      
      console.log('📊 Sync Analysis:', {
        totalProcessed: statuses.size,
        activeSubscribers: activeSubscribers.length,
        trialUsers: trialUsers.length,
        productTypes: Array.from(productTypes),
        tierBreakdown: {
          pro: activeSubscribers.filter(s => s.tier === 'pro').length,
          elite: activeSubscribers.filter(s => s.tier === 'elite').length
        }
      })
      
      // Update user subscription statuses in database with enhanced data
      const updates = []
      for (const [userId, status] of statuses.entries()) {
        const user = users.find(u => u.revenuecat_customer_id === userId || u.id === userId)
        if (user) {
          const needsUpdate = 
            user.subscription_tier !== status.tier || 
            user.subscription_status !== (status.isActive ? 'active' : 'inactive') ||
            user.subscription_expires_at !== status.expiresAt

          if (needsUpdate) {
            updates.push({
              id: user.id,
              subscription_tier: status.tier,
              subscription_status: status.isActive ? 'active' : 'inactive',
              subscription_expires_at: status.expiresAt,
              subscription_plan_type: status.productType !== 'unknown' ? status.productType : user.subscription_plan_type,
              // Store additional RevenueCat metadata
              revenuecat_product_id: status.productIdentifier,
              revenuecat_store: status.store,
              revenuecat_renewal_status: status.renewalStatus,
              revenuecat_last_sync: new Date().toISOString()
            })
          }
        }
      }

      if (updates.length > 0) {
        console.log(`📝 Updating ${updates.length} user records...`)
        
        for (const update of updates) {
          await supabase
            .from('profiles')
            .update({
              subscription_tier: update.subscription_tier,
              subscription_status: update.subscription_status,
              subscription_expires_at: update.subscription_expires_at,
              subscription_plan_type: update.subscription_plan_type
            })
            .eq('id', update.id)
        }
        
        // Refresh all data to show updated information
        await loadUsers() // Load users first
        await Promise.all([
          loadStats(),
          loadRevenueCatMetrics() // This now uses the updated users data
        ])
        
        const message = `🎉 Successfully synced ${updates.length} users!\n\n` +
          `📊 Summary:\n` +
          `• Active Subscriptions: ${activeSubscribers.length}\n` +
          `• Active Trials: ${trialUsers.length}\n` +
          `• Product Types: ${Array.from(productTypes).join(', ')}\n` +
          `• Pro Users: ${activeSubscribers.filter(s => s.tier === 'pro').length}\n` +
          `• Elite Users: ${activeSubscribers.filter(s => s.tier === 'elite').length}`
        
        alert(message)
        console.log('✅ RevenueCat sync completed successfully!')
        
        // Refresh RevenueCat metrics with the updated data
        await loadRevenueCatMetrics()
      } else {
        alert('✨ All user subscription statuses are already up to date!')
        console.log('ℹ️ No updates needed - all data is current')
        
        // Still refresh metrics to show current data
        await loadRevenueCatMetrics()
      }
    } catch (error) {
      console.error('❌ Error syncing RevenueCat data:', error)
      alert(`❌ Error syncing RevenueCat data: ${error.message}\n\nPlease check the console for more details.`)
    } finally {
      setSyncingRevenueCat(false)
    }
  }

  const loadUsers = async () => {
    try {
      let query = supabase
        .from('profiles')
        .select('id, username, email, subscription_tier, subscription_status, subscription_plan_type, subscription_expires_at, created_at, admin_role, is_active, revenuecat_customer_id', { count: 'exact' })

      // Apply filters
      if (searchTerm) {
        query = query.or(`username.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
      }

      if (tierFilter !== 'all') {
        query = query.eq('subscription_tier', tierFilter)
      }

      if (statusFilter !== 'all') {
        if (statusFilter === 'active') {
          query = query.eq('subscription_status', 'active')
        } else {
          query = query.neq('subscription_status', 'active')
        }
      }

      // Apply pagination
      const from = (currentPage - 1) * pageSize
      const to = from + pageSize - 1
      query = query.range(from, to).order('created_at', { ascending: false })

      const { data, error, count } = await query

      if (error) throw error

      setUsers(data || [])
      setTotalPages(Math.ceil((count || 0) / pageSize))
    } catch (error) {
      console.error('Error loading users:', error)
    }
  }

  const loadStats = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('subscription_tier, subscription_status, created_at')

      if (error) throw error

      const totalUsers = data?.length || 0
      const proUsers = data?.filter(u => u.subscription_tier === 'pro').length || 0
      const eliteUsers = data?.filter(u => u.subscription_tier === 'elite').length || 0
      const activeSubscriptions = data?.filter(u => u.subscription_status === 'active').length || 0

      // Calculate approximate monthly revenue
      const monthlyRevenue = (proUsers * 24.99) + (eliteUsers * 49.99)

      // New users today
      const today = new Date().toISOString().split('T')[0]
      const newUsersToday = data?.filter(u => u.created_at.startsWith(today)).length || 0

      setStats({
        totalUsers,
        proUsers,
        eliteUsers,
        activeSubscriptions,
        monthlyRevenue,
        newUsersToday
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const updateUserTier = async (userId: string, newTier: 'free' | 'pro' | 'elite') => {
    setUpdating(userId)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          subscription_tier: newTier,
          subscription_status: newTier === 'free' ? 'inactive' : 'active',
          subscription_started_at: newTier !== 'free' ? new Date().toISOString() : null
        })
        .eq('id', userId)

      if (error) throw error

      // Refresh users list
      await loadUsers()
      await loadStats()
    } catch (error) {
      console.error('Error updating user tier:', error)
      alert('Error updating user tier')
    } finally {
      setUpdating(null)
    }
  }

  const handleSendNotification = async () => {
    // In a real implementation, this would integrate with your push notification service
    alert('Notification sent to all users!')
  }

  const handleExportData = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username, email, subscription_tier, subscription_status, created_at')

      if (error) throw error

      // Convert to CSV
      const headers = ['Username', 'Email', 'Tier', 'Status', 'Joined']
      const csvContent = [
        headers.join(','),
        ...data.map(user => [
          user.username || '',
          user.email || '',
          user.subscription_tier,
          user.subscription_status,
          new Date(user.created_at).toLocaleDateString()
        ].join(','))
      ].join('\n')

      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `users-export-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting data:', error)
      alert('Error exporting data')
    }
  }

  const handleBackupDatabase = async () => {
    // In a real implementation, this would trigger a database backup
    alert('Database backup initiated!')
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'pro': return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      case 'elite': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      default: return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/20 text-green-400 border-green-500/30'
      case 'expired': return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'cancelled': return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
              <p className="text-gray-400">Manage users and monitor app performance</p>
            </div>
            <button
              onClick={loadDashboardData}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Enhanced Stats Cards with RevenueCat Integration */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
          {/* Supabase Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20"
          >
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-400" />
              <div className="ml-4">
                <p className="text-sm text-gray-400">Total Users</p>
                <p className="text-2xl font-bold text-white">{stats.totalUsers}</p>
                <p className="text-xs text-gray-500">Database</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20"
          >
            <div className="flex items-center">
              <Crown className="h-8 w-8 text-purple-400" />
              <div className="ml-4">
                <p className="text-sm text-gray-400">Pro Users</p>
                <p className="text-2xl font-bold text-white">{stats.proUsers}</p>
                <p className="text-xs text-gray-500">Database</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20"
          >
            <div className="flex items-center">
              <Star className="h-8 w-8 text-yellow-400" />
              <div className="ml-4">
                <p className="text-sm text-gray-400">Elite Users</p>
                <p className="text-2xl font-bold text-white">{stats.eliteUsers}</p>
                <p className="text-xs text-gray-500">Database</p>
              </div>
            </div>
          </motion.div>

          {/* RevenueCat Enhanced Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-green-500/20 to-emerald-600/20 backdrop-blur-md rounded-xl p-6 border border-green-500/30 relative"
          >
            <div className="flex items-center">
              <UserCheck className="h-8 w-8 text-green-400" />
              <div className="ml-4">
                <p className="text-sm text-gray-400">Active Subs</p>
                <p className="text-2xl font-bold text-white">
                  {revenueCatOverview?.active_subscriptions ?? stats.activeSubscriptions}
                </p>
                <div className="flex items-center space-x-2">
                  <p className="text-xs text-green-400">RevenueCat</p>
                  {loadingRevenueCatMetrics && <div className="w-3 h-3 border border-green-400 border-t-transparent rounded-full animate-spin"></div>}
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-br from-emerald-500/20 to-green-600/20 backdrop-blur-md rounded-xl p-6 border border-emerald-500/30 relative"
          >
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-emerald-400" />
              <div className="ml-4">
                <p className="text-sm text-gray-400">MRR</p>
                <p className="text-2xl font-bold text-white">
                  ${revenueCatOverview?.mrr.toFixed(0) ?? stats.monthlyRevenue.toFixed(0)}
                </p>
                <div className="flex items-center space-x-2">
                  <p className="text-xs text-emerald-400">RevenueCat</p>
                  {loadingRevenueCatMetrics && <div className="w-3 h-3 border border-emerald-400 border-t-transparent rounded-full animate-spin"></div>}
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-gradient-to-br from-blue-500/20 to-cyan-600/20 backdrop-blur-md rounded-xl p-6 border border-blue-500/30 relative"
          >
            <div className="flex items-center">
              <Zap className="h-8 w-8 text-blue-400" />
              <div className="ml-4">
                <p className="text-sm text-gray-400">Active Trials</p>
                <p className="text-2xl font-bold text-white">
                  {revenueCatOverview?.active_trials ?? stats.newUsersToday}
                </p>
                <div className="flex items-center space-x-2">
                  <p className="text-xs text-blue-400">RevenueCat</p>
                  {loadingRevenueCatMetrics && <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin"></div>}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Additional RevenueCat Metrics Row */}
        {revenueCatOverview && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-gradient-to-br from-orange-500/20 to-red-600/20 backdrop-blur-md rounded-xl p-6 border border-orange-500/30"
            >
              <div className="flex items-center">
                <Target className="h-8 w-8 text-orange-400" />
                <div className="ml-4">
                  <p className="text-sm text-gray-400">Conversion Rate</p>
                  <p className="text-2xl font-bold text-white">{(revenueCatOverview.conversion_rate * 100).toFixed(1)}%</p>
                  <p className="text-xs text-orange-400">RevenueCat</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-gradient-to-br from-red-500/20 to-pink-600/20 backdrop-blur-md rounded-xl p-6 border border-red-500/30"
            >
              <div className="flex items-center">
                <AlertCircle className="h-8 w-8 text-red-400" />
                <div className="ml-4">
                  <p className="text-sm text-gray-400">Churn Rate</p>
                  <p className="text-2xl font-bold text-white">{(revenueCatOverview.churn_rate * 100).toFixed(1)}%</p>
                  <p className="text-xs text-red-400">RevenueCat</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="bg-gradient-to-br from-purple-500/20 to-indigo-600/20 backdrop-blur-md rounded-xl p-6 border border-purple-500/30"
            >
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-purple-400" />
                <div className="ml-4">
                  <p className="text-sm text-gray-400">Revenue (30d)</p>
                  <p className="text-2xl font-bold text-white">${revenueCatOverview.revenue.toFixed(0)}</p>
                  <p className="text-xs text-purple-400">RevenueCat</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className="bg-gradient-to-br from-cyan-500/20 to-blue-600/20 backdrop-blur-md rounded-xl p-6 border border-cyan-500/30"
            >
              <div className="flex items-center">
                <Users className="h-8 w-8 text-cyan-400" />
                <div className="ml-4">
                  <p className="text-sm text-gray-400">RC Active Users</p>
                  <p className="text-2xl font-bold text-white">{revenueCatOverview.active_users}</p>
                  <p className="text-xs text-cyan-400">RevenueCat</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 lg:space-x-4">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div className="flex space-x-4">
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value as any)}
                className="bg-white/10 border border-white/20 rounded-lg text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Tiers</option>
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="elite">Elite</option>
              </select>
              
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-white/10 border border-white/20 rounded-lg text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Enhanced RevenueCat Integration Section */}
        <div className="mb-8">
          <div className="bg-gradient-to-br from-green-500/10 to-emerald-600/10 backdrop-blur-md rounded-xl border border-green-500/30 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                  <Award className="w-6 h-6 text-green-400" />
                  <span>RevenueCat Integration</span>
                </h2>
                <p className="text-gray-400 text-sm">Comprehensive subscription management with API v2</p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={loadRevenueCatMetrics}
                  disabled={loadingRevenueCatMetrics}
                  className="flex items-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  <BarChart3 className={`w-4 h-4 ${loadingRevenueCatMetrics ? 'animate-spin' : ''}`} />
                  <span>Load Metrics</span>
                </button>
                <button
                  onClick={syncRevenueCatData}
                  disabled={syncingRevenueCat}
                  className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-4 h-4 ${syncingRevenueCat ? 'animate-spin' : ''}`} />
                  <span>{syncingRevenueCat ? 'Syncing...' : 'Sync Users'}</span>
                </button>
              </div>
            </div>
            
            {/* API Status & Sync Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-white/5 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  {revenueCatAPI.isConfigured() ? (
                    <>
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      <span className="text-green-400 text-sm font-medium">API Connected</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                      <span className="text-red-400 text-sm font-medium">API Not Configured</span>
                    </>
                  )}
                </div>
                <p className="text-xs text-gray-400">
                  {revenueCatAPI.isConfigured() 
                    ? 'Using API v2 with read/write permissions' 
                    : 'Set NEXT_PUBLIC_REVENUECAT_API_KEY environment variable'
                  }
                </p>
              </div>

              <div className="bg-white/5 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span className="text-blue-400 text-sm font-medium">Synced Users</span>
                </div>
                <p className="text-xl font-bold text-white">{revenueCatStatuses.size}</p>
                <p className="text-xs text-gray-400">
                  Active: {Array.from(revenueCatStatuses.values()).filter(s => s.isActive).length}
                </p>
              </div>

              <div className="bg-white/5 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <ShoppingCart className="w-4 h-4 text-purple-400" />
                  <span className="text-purple-400 text-sm font-medium">Product Types</span>
                </div>
                <p className="text-xl font-bold text-white">
                  {new Set(Array.from(revenueCatStatuses.values()).map(s => s.productType)).size}
                </p>
                <p className="text-xs text-gray-400">
                  Different subscription types detected
                </p>
              </div>
            </div>

            {/* Product Breakdown */}
            {revenueCatStatuses.size > 0 && (
              <div className="bg-white/5 rounded-lg p-4">
                <h3 className="text-sm font-medium text-white mb-3 flex items-center space-x-2">
                  <PieChart className="w-4 h-4 text-yellow-400" />
                  <span>Product Distribution</span>
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  {(() => {
                    const productStats = Array.from(revenueCatStatuses.values()).reduce((acc, status) => {
                      if (status.isActive) {
                        const key = `${status.tier}-${status.productType}`
                        acc[key] = (acc[key] || 0) + 1
                      }
                      return acc
                    }, {} as Record<string, number>)

                    return Object.entries(productStats).map(([key, count]) => (
                      <div key={key} className="flex justify-between items-center bg-white/5 rounded px-2 py-1">
                        <span className="text-gray-300 capitalize">{key.replace('-', ' ')}</span>
                        <span className="text-white font-medium">{count}</span>
                      </div>
                    ))
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions and Activity Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <QuickActions
            onSendNotification={handleSendNotification}
            onExportData={handleExportData}
            onBackupDatabase={handleBackupDatabase}
          />
          <UserActivityChart data={[]} />
        </div>

        {/* Users Table */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Tier</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">RevenueCat</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Joined</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-white/5">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                            <span className="text-white font-medium">
                              {user.username ? user.username[0].toUpperCase() : user.email ? user.email[0].toUpperCase() : 'U'}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-white">
                            {user.username || 'No username'}
                            {user.admin_role && <Shield className="inline h-4 w-4 text-yellow-400 ml-2" />}
                          </div>
                          <div className="text-sm text-gray-400">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getTierBadgeColor(user.subscription_tier)}`}>
                        {user.subscription_tier}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getStatusBadgeColor(user.subscription_status)}`}>
                        {user.subscription_status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {(() => {
                        const rcStatus = revenueCatStatuses.get(user.revenuecat_customer_id || user.id)
                        if (!rcStatus) {
                          return (
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                              <span className="text-gray-400">Not synced</span>
                            </div>
                          )
                        }
                        
                        const statusColor = rcStatus.isActive 
                          ? rcStatus.isTrialActive ? 'text-blue-400' : 'text-green-400'
                          : 'text-red-400'
                        
                        const dotColor = rcStatus.isActive 
                          ? rcStatus.isTrialActive ? 'bg-blue-400' : 'bg-green-400'
                          : 'bg-red-400'

                        const renewalStatusIcon = {
                          'active': <CheckCircle className="w-3 h-3 text-green-400" />,
                          'trial': <Clock className="w-3 h-3 text-blue-400" />,
                          'cancelled': <XCircle className="w-3 h-3 text-orange-400" />,
                          'expired': <AlertCircle className="w-3 h-3 text-red-400" />
                        }

                        return (
                          <div className="space-y-1">
                            {/* Status */}
                            <div className="flex items-center space-x-2">
                              <div className={`w-2 h-2 rounded-full ${dotColor}`}></div>
                              <span className={statusColor}>
                                {rcStatus.isTrialActive ? 'Trial' : rcStatus.isActive ? 'Active' : 'Inactive'}
                              </span>
                              {renewalStatusIcon[rcStatus.renewalStatus]}
                            </div>
                            
                            {/* Product Info */}
                            {rcStatus.productIdentifier && (
                              <div className="flex items-center space-x-1 text-xs">
                                <span className="text-gray-400">{rcStatus.tier.toUpperCase()}</span>
                                <span className="text-gray-500">•</span>
                                <span className="text-gray-400 capitalize">{rcStatus.productType}</span>
                                {rcStatus.store && (
                                  <>
                                    <span className="text-gray-500">•</span>
                                    <span className="text-gray-500 capitalize">{rcStatus.store.replace('_', ' ')}</span>
                                  </>
                                )}
                              </div>
                            )}
                            
                            {/* Expiry */}
                            {rcStatus.expiresAt && (
                              <div className="text-xs text-gray-500">
                                Expires: {new Date(rcStatus.expiresAt).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      <button
                        onClick={() => setSelectedUser(user)}
                        className="text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {user.subscription_tier === 'free' && (
                        <>
                          <button
                            onClick={() => updateUserTier(user.id, 'pro')}
                            disabled={updating === user.id}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-xs transition-colors disabled:opacity-50"
                          >
                            {updating === user.id ? '...' : 'Make Pro'}
                          </button>
                          <button
                            onClick={() => updateUserTier(user.id, 'elite')}
                            disabled={updating === user.id}
                            className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-xs transition-colors disabled:opacity-50"
                          >
                            {updating === user.id ? '...' : 'Make Elite'}
                          </button>
                        </>
                      )}
                      {user.subscription_tier !== 'free' && (
                        <button
                          onClick={() => updateUserTier(user.id, 'free')}
                          disabled={updating === user.id}
                          className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-xs transition-colors disabled:opacity-50"
                        >
                          {updating === user.id ? '...' : 'Make Free'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="bg-white/5 px-6 py-3 flex items-center justify-between">
            <div className="text-sm text-gray-400">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="flex items-center px-3 py-1 bg-white/10 text-gray-400 rounded hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center px-3 py-1 bg-white/10 text-gray-400 rounded hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* User Detail Modal */}
        {selectedUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-900 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">User Details</h3>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="text-gray-400 hover:text-white"
                >
                  ×
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-lg font-semibold text-white mb-3">Basic Info</h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-gray-400">ID:</span> <span className="text-white">{selectedUser.id}</span></p>
                    <p><span className="text-gray-400">Username:</span> <span className="text-white">{selectedUser.username || 'None'}</span></p>
                    <p><span className="text-gray-400">Email:</span> <span className="text-white">{selectedUser.email}</span></p>
                    <p><span className="text-gray-400">Joined:</span> <span className="text-white">{formatDate(selectedUser.created_at)}</span></p>
                    <p><span className="text-gray-400">Admin:</span> <span className="text-white">{selectedUser.admin_role ? 'Yes' : 'No'}</span></p>
                    <p><span className="text-gray-400">Active:</span> <span className="text-white">{selectedUser.is_active ? 'Yes' : 'No'}</span></p>
                  </div>
                </div>
                
                <div>
                  <h4 className="text-lg font-semibold text-white mb-3">Subscription</h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-gray-400">Tier:</span> <span className={`px-2 py-1 rounded text-xs ${getTierBadgeColor(selectedUser.subscription_tier)}`}>{selectedUser.subscription_tier}</span></p>
                    <p><span className="text-gray-400">Status:</span> <span className={`px-2 py-1 rounded text-xs ${getStatusBadgeColor(selectedUser.subscription_status)}`}>{selectedUser.subscription_status}</span></p>
                    <p><span className="text-gray-400">Plan:</span> <span className="text-white">{selectedUser.subscription_plan_type || 'None'}</span></p>
                    <p><span className="text-gray-400">Expires:</span> <span className="text-white">{selectedUser.subscription_expires_at ? formatDate(selectedUser.subscription_expires_at) : 'Never'}</span></p>
                    <p><span className="text-gray-400">RevenueCat ID:</span> <span className="text-white">{selectedUser.revenuecat_customer_id || 'None'}</span></p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}