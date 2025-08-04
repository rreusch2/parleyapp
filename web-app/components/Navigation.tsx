'use client'
import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { 
  LayoutDashboard, 
  Brain, 
  LogOut, 
  Menu, 
  X, 
  Crown,
  Sparkles,
  User,
  Settings
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useSubscription } from '@/contexts/SubscriptionContext'
import TieredSubscriptionModal from './TieredSubscriptionModal'

export default function Navigation() {
  const { user, signOut } = useAuth()
  const { isPro, isElite, subscriptionTier } = useSubscription()
  const router = useRouter()
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false)

  const handleSignOut = async () => {
    try {
      await signOut()
      router.push('/')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const navItems = [
    {
      label: 'Dashboard',
      icon: LayoutDashboard,
      path: '/dashboard',
      active: pathname === '/dashboard'
    },
    {
      label: 'Predictions',
      icon: Brain,
      path: '/predictions',
      active: pathname === '/predictions'
    }
  ]

  const getTierInfo = () => {
    if (isElite) {
      return {
        label: 'ELITE',
        icon: Crown,
        bgColor: 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20',
        borderColor: 'border-yellow-500/30',
        textColor: 'text-yellow-400',
        accentColor: '#FFD700'
      }
    }
    if (isPro) {
      return {
        label: 'PRO',
        icon: Crown,
        bgColor: 'bg-gradient-to-r from-blue-500/20 to-purple-500/20',
        borderColor: 'border-blue-500/30',
        textColor: 'text-blue-400',
        accentColor: '#00E5FF'
      }
    }
    return {
      label: 'FREE',
      icon: User,
      bgColor: 'bg-gray-600/20',
      borderColor: 'border-gray-600/30',
      textColor: 'text-gray-400',
      accentColor: '#6B7280'
    }
  }

  const tierInfo = getTierInfo()

  return (
    <motion.div
      initial={{ x: -280 }}
      animate={{ x: 0 }}
      className={`fixed left-0 top-0 h-full ${isCollapsed ? 'w-16' : 'w-64'} bg-gray-900/95 backdrop-blur-xl border-r border-gray-700/50 z-50 transition-all duration-300`}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-700/50">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-2 rounded-lg">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-white font-bold text-lg">Predictive Play</h1>
                <p className="text-gray-400 text-xs">AI Sports Betting</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            {isCollapsed ? (
              <Menu className="w-4 h-4 text-gray-400" />
            ) : (
              <X className="w-4 h-4 text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* User Info */}
      <div className="p-4 border-b border-gray-700/50">
        <div className={`${tierInfo.bgColor} ${tierInfo.borderColor} border rounded-xl p-3`}>
          {!isCollapsed ? (
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-gray-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm truncate">
                    {user?.email?.split('@')[0] || 'User'}
                  </p>
                  <p className="text-gray-400 text-xs">
                    {user?.email}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <tierInfo.icon className={`w-4 h-4 ${tierInfo.textColor}`} />
                  <span className={`${tierInfo.textColor} font-bold text-sm tracking-wider`}>
                    {tierInfo.label}
                  </span>
                  {isElite && <Sparkles className="w-4 h-4 text-yellow-400" />}
                </div>
                
                {!isPro && !isElite && (
                  <button 
                    onClick={() => setSubscriptionModalOpen(true)}
                    className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                  >
                    Upgrade
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <tierInfo.icon className={`w-6 h-6 ${tierInfo.textColor}`} />
            </div>
          )}
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.path}>
                <button
                  onClick={() => router.push(item.path)}
                  className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-start'} space-x-3 px-3 py-3 rounded-xl transition-all duration-200 ${
                    item.active
                      ? isElite
                        ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 text-yellow-400'
                        : 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 text-blue-400'
                      : 'text-gray-300 hover:bg-gray-800/50 hover:text-white'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${item.active ? (isElite ? 'text-yellow-400' : 'text-blue-400') : ''}`} />
                  {!isCollapsed && (
                    <span className="font-medium">{item.label}</span>
                  )}
                  {item.active && !isCollapsed && (
                    <motion.div
                      layoutId="activeIndicator"
                      className={`w-2 h-2 rounded-full ${isElite ? 'bg-yellow-400' : 'bg-blue-400'} ml-auto`}
                    />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-gray-700/50 space-y-2">
        {/* Settings placeholder for future */}
        <button className={`${isCollapsed ? 'w-full justify-center' : 'w-full justify-start'} flex items-center space-x-3 px-3 py-3 rounded-xl text-gray-300 hover:bg-gray-800/50 hover:text-white transition-colors`}>
          <Settings className="w-5 h-5" />
          {!isCollapsed && <span className="font-medium">Settings</span>}
        </button>

        {/* Logout */}
        <button
          onClick={handleSignOut}
          className={`${isCollapsed ? 'w-full justify-center' : 'w-full justify-start'} flex items-center space-x-3 px-3 py-3 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors`}
        >
          <LogOut className="w-5 h-5" />
          {!isCollapsed && <span className="font-medium">Sign Out</span>}
        </button>
      </div>

      {/* Subscription Modal */}
      <TieredSubscriptionModal
        isOpen={subscriptionModalOpen}
        onClose={() => setSubscriptionModalOpen(false)}
      />
    </motion.div>
  )
}
