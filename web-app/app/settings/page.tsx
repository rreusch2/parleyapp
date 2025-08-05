'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useSubscription } from '@/contexts/SubscriptionContext'
import TieredSubscriptionModal from '@/components/TieredSubscriptionModal'
import { motion } from 'framer-motion'
import { 
  User,
  Bell,
  Shield,
  CreditCard,
  Settings as SettingsIcon,
  Crown,
  ChevronRight,
  Mail,
  Phone,
  Star,
  LogOut,
  Trash2,
  Download,
  Eye,
  EyeOff
} from 'lucide-react'

interface SettingSection {
  title: string
  icon: any
  iconColor: string
  items: SettingItem[]
}

interface SettingItem {
  id: string
  title: string
  subtitle?: string
  type: 'link' | 'toggle' | 'text'
  value?: any
  badge?: string
  badgeColor?: string
  action?: () => void
  onToggle?: (value: boolean) => void
}

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const { subscriptionTier } = useSubscription()
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [pushNotifications, setPushNotifications] = useState(true)
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [biometricAuth, setBiometricAuth] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (!user) {
      router.push('/')
      return
    }
    setMounted(true)
  }, [user, router])

  const handleManageSubscription = () => {
    if (subscriptionTier === 'free') {
      setSubscriptionModalOpen(true)
    } else {
      // Handle subscription management for paid users
      console.log('Manage subscription')
    }
  }

  const handleDeleteAccount = () => {
    setShowDeleteConfirm(true)
  }

  const confirmDeleteAccount = async () => {
    // Handle account deletion
    console.log('Delete account confirmed')
    setShowDeleteConfirm(false)
  }

  const handleExportData = () => {
    // Handle data export
    console.log('Export user data')
  }

  const settingsSections: SettingSection[] = [
    {
      title: 'Account',
      icon: User,
      iconColor: '#00E5FF',
      items: [
        {
          id: 'subscription',
          title: 'Subscription',
          subtitle: 'Manage your plan and billing',
          type: 'link',
          badge: subscriptionTier === 'elite' ? 'ELITE' : subscriptionTier === 'pro' ? 'PRO' : 'FREE',
          badgeColor: subscriptionTier === 'elite' ? '#FFD700' : subscriptionTier === 'pro' ? '#F59E0B' : '#6B7280',
          action: handleManageSubscription
        },
        {
          id: 'profile',
          title: 'Profile Information',
          subtitle: 'Update your personal details',
          type: 'link',
          action: () => console.log('Edit profile')
        },
        {
          id: 'preferences',
          title: 'Betting Preferences',
          subtitle: 'Sports, betting style & pick distribution',
          type: 'link',
          action: () => console.log('Edit preferences')
        },
        {
          id: 'export',
          title: 'Export Data',
          subtitle: 'Download your account data',
          type: 'link',
          action: handleExportData
        }
      ]
    },
    {
      title: 'Notifications',
      icon: Bell,
      iconColor: '#F59E0B',
      items: [
        {
          id: 'push_notifications',
          title: 'Push Notifications',
          subtitle: 'Receive alerts for picks and insights',
          type: 'toggle',
          value: pushNotifications,
          onToggle: setPushNotifications
        },
        {
          id: 'email_notifications',
          title: 'Email Notifications',
          subtitle: 'Get updates via email',
          type: 'toggle',
          value: emailNotifications,
          onToggle: setEmailNotifications
        }
      ]
    },
    {
      title: 'Security',
      icon: Shield,
      iconColor: '#10B981',
      items: [
        {
          id: 'biometric',
          title: 'Biometric Authentication',
          subtitle: 'Use fingerprint or face ID',
          type: 'toggle',
          value: biometricAuth,
          onToggle: setBiometricAuth
        },
        {
          id: 'password',
          title: 'Change Password',
          subtitle: 'Update your account password',
          type: 'link',
          action: () => console.log('Change password')
        },
        {
          id: 'sessions',
          title: 'Active Sessions',
          subtitle: 'Manage logged in devices',
          type: 'link',
          action: () => console.log('Manage sessions')
        }
      ]
    },
    {
      title: 'Support',
      icon: Mail,
      iconColor: '#8B5CF6',
      items: [
        {
          id: 'help',
          title: 'Help & Support',
          subtitle: 'Get help with your account',
          type: 'link',
          action: () => console.log('Open support')
        },
        {
          id: 'feedback',
          title: 'Send Feedback',
          subtitle: 'Help us improve the app',
          type: 'link',
          action: () => console.log('Send feedback')
        },
        {
          id: 'privacy',
          title: 'Privacy Policy',
          subtitle: 'Review our privacy practices',
          type: 'link',
          action: () => router.push('/privacy')
        },
        {
          id: 'terms',
          title: 'Terms of Service',
          subtitle: 'Review our terms and conditions',
          type: 'link',
          action: () => router.push('/terms')
        }
      ]
    }
  ]

  if (!user || !mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold text-white mb-2">Settings</h1>
        <p className="text-xl text-gray-300">
          Manage your account and preferences
        </p>
      </motion.div>

      {/* User Info Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 mb-8"
      >
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white">
              {user.email?.split('@')[0] || 'User'}
            </h2>
            <p className="text-gray-400">{user.email}</p>
            <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium mt-2 ${
              subscriptionTier === 'elite' 
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                : subscriptionTier === 'pro'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-600 text-white'
            }`}>
              {subscriptionTier === 'elite' && <Crown className="w-3 h-3" />}
              <span>{subscriptionTier.charAt(0).toUpperCase() + subscriptionTier.slice(1)} Member</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Settings Sections */}
      <div className="space-y-6">
        {settingsSections.map((section, sectionIndex) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 20 }}
            animate={mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.6, delay: 0.2 + sectionIndex * 0.1 }}
            className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-white/10">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: `${section.iconColor}20` }}>
                  <section.icon className="w-5 h-5" style={{ color: section.iconColor }} />
                </div>
                <h3 className="text-lg font-semibold text-white">{section.title}</h3>
              </div>
            </div>
            
            <div className="divide-y divide-white/10">
              {section.items.map((item) => (
                <div key={item.id} className="px-6 py-4 hover:bg-white/5 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <div>
                          <h4 className="text-white font-medium">{item.title}</h4>
                          {item.subtitle && (
                            <p className="text-gray-400 text-sm">{item.subtitle}</p>
                          )}
                        </div>
                        {item.badge && (
                          <div
                            className="px-2 py-1 rounded-full text-xs font-semibold"
                            style={{ backgroundColor: `${item.badgeColor}20`, color: item.badgeColor }}
                          >
                            {item.badge}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      {item.type === 'toggle' && (
                        <button
                          onClick={() => item.onToggle?.(!item.value)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            item.value ? 'bg-blue-600' : 'bg-gray-600'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              item.value ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      )}
                      
                      {item.type === 'link' && (
                        <button
                          onClick={item.action}
                          className="text-gray-400 hover:text-white transition-colors"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Danger Zone */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={mounted ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        transition={{ duration: 0.6, delay: 0.6 }}
        className="mt-8 bg-red-500/10 backdrop-blur-sm rounded-xl border border-red-500/30 overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-red-500/30">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-red-500/20">
              <Trash2 className="w-5 h-5 text-red-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Danger Zone</h3>
          </div>
        </div>
        
        <div className="px-6 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-white font-medium">Sign Out</h4>
              <p className="text-gray-400 text-sm">Sign out of your account</p>
            </div>
            <button
              onClick={signOut}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-red-400 font-medium">Delete Account</h4>
              <p className="text-gray-400 text-sm">Permanently delete your account and all data</p>
            </div>
            <button
              onClick={handleDeleteAccount}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-xl p-6 max-w-md w-full border border-red-500/30">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 bg-red-500/20 rounded-full mb-4">
                <Trash2 className="h-6 w-6 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Delete Account</h3>
              <p className="text-gray-400 mb-6">
                Are you sure you want to delete your account? This action cannot be undone and will permanently remove all your data.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteAccount}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Modal */}
      <TieredSubscriptionModal
        isOpen={subscriptionModalOpen}
        onClose={() => setSubscriptionModalOpen(false)}
        onContinueFree={() => setSubscriptionModalOpen(false)}
      />
    </div>
  )
}