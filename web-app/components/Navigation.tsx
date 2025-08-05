'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useSubscription } from '@/contexts/SubscriptionContext'
import { useAIChat } from '@/shared/hooks/useAIChat'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { 
  Home, 
  Calendar, 
  Zap, 
  TrendingUp, 
  Settings,
  MessageCircle,
  Crown,
  Bell,
  LogOut,
  RefreshCw,
  Shield,
  User,
  ChevronDown
} from 'lucide-react'

const navigation = [
  { name: 'Home', href: '/dashboard', icon: Home },
  { name: 'Games', href: '/games', icon: Calendar },
  { name: 'Predictions', href: '/predictions', icon: Zap },
  { name: 'Trends', href: '/trends', icon: TrendingUp },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export default function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut, profile } = useAuth()
  const { subscriptionTier } = useSubscription()
  const { setShowAIChat, freeUserMessageCount } = useAIChat()
  const [refreshing, setRefreshing] = useState(false)

  const [showUserMenu, setShowUserMenu] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      // Refresh functionality can be implemented here
      await new Promise(resolve => setTimeout(resolve, 1000)) // Placeholder
    } finally {
      setRefreshing(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      router.push('/') // Redirect to landing page
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return (
    <nav className="bg-black/20 backdrop-blur-md border-b border-white/10 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Brand */}
          <Link href="/dashboard" className="flex items-center space-x-3 group">
            <div className="relative w-8 h-8 rounded-lg overflow-hidden ring-2 ring-white/10 group-hover:ring-blue-500/50 transition-all duration-200">
              <Image
                src="/icon.png"
                alt="Predictive Play"
                width={32}
                height={32}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <span className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
                Predictive Play
              </span>
              <div className="text-xs text-blue-200">AI Sports Betting</div>
            </div>
          </Link>

          {/* Main Navigation */}
          <div className="hidden md:flex items-center space-x-1">
                            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`relative px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    isActive
                      ? 'text-blue-400 bg-blue-500/10'
                      : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <item.icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </div>
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-blue-500/10 border border-blue-500/20 rounded-lg"
                      initial={false}
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </Link>
              )
            })}
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center space-x-3">
            {/* Professor Lock Chat Button */}
            <button 
              onClick={() => setShowAIChat(true)}
              className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 text-white hover:from-purple-600 hover:to-blue-600 transition-all duration-200 shadow-lg"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline text-sm font-medium">Professor Lock</span>
              {subscriptionTier === 'free' && (
                <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
                  {3 - freeUserMessageCount}
                </span>
              )}
            </button>
            
            {/* Refresh Button */}
            <button 
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-all duration-200 disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            {/* Subscription Badge */}
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
              subscriptionTier === 'elite' 
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                : subscriptionTier === 'pro'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-600 text-white'
            }`}>
              {subscriptionTier === 'elite' && <Crown className="w-3 h-3 inline mr-1" />}
              {subscriptionTier.charAt(0).toUpperCase() + subscriptionTier.slice(1)}
            </div>

            {/* Notifications */}
            <button className="p-2 rounded-lg bg-white/10 text-gray-300 hover:text-white hover:bg-white/20 transition-all duration-200">
              <Bell className="w-4 h-4" />
            </button>

            {/* User Menu */}
            <div className="relative" ref={userMenuRef}>
              <button 
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-2 p-2 rounded-lg bg-white/10 text-gray-300 hover:text-white hover:bg-white/20 transition-all duration-200"
                title="User Menu"
              >
                <User className="w-4 h-4" />
                <ChevronDown className={`w-3 h-3 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {showUserMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 mt-2 w-48 bg-slate-800/95 backdrop-blur-md border border-white/20 rounded-lg shadow-xl z-50"
                >
                  <div className="py-2">
                    {/* User Info */}
                    <div className="px-4 py-2 border-b border-white/10">
                      <p className="text-sm text-white font-medium">{user?.email}</p>
                      <p className="text-xs text-gray-400 capitalize">{subscriptionTier} User</p>
                    </div>

                    {/* Admin Link - Only show for admin users */}
                    {profile?.admin_role && (
                      <Link
                        href="/admin"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center space-x-3 px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors"
                      >
                        <Shield className="w-4 h-4" />
                        <span>Admin Dashboard</span>
                      </Link>
                    )}

                    {/* Logout */}
                    <button
                      onClick={() => {
                        setShowUserMenu(false)
                        handleSignOut()
                      }}
                      className="flex items-center space-x-3 px-4 py-2 text-sm text-gray-300 hover:text-red-400 hover:bg-red-500/10 transition-colors w-full text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* Mobile Menu Button (for smaller screens) */}
          <div className="md:hidden">
            {/* You can add a mobile menu button here if needed */}
          </div>
        </div>
      </div>
    </nav>
  )
}