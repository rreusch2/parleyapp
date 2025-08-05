'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Send, 
  Download, 
  Upload, 
  Database,
  MessageSquare,
  FileText,
  Users,
  Settings,
  Target,
  BarChart3
} from 'lucide-react'

interface QuickActionsProps {
  onSendNotification: () => void
  onExportData: () => void
  onBackupDatabase: () => void
  onOpenTodaysPicks: () => void
  onOpenReports: () => void
}

export default function QuickActions({ 
  onSendNotification, 
  onExportData, 
  onBackupDatabase,
  onOpenTodaysPicks,
  onOpenReports
}: QuickActionsProps) {
  const [loading, setLoading] = useState<string | null>(null)

  const handleAction = async (actionId: string, action: () => void) => {
    setLoading(actionId)
    try {
      await action()
      // Simulate async operation
      await new Promise(resolve => setTimeout(resolve, 1000))
    } finally {
      setLoading(null)
    }
  }

  const actions = [
    {
      id: 'notification',
      title: 'Send Notification',
      description: 'Send push notification to all users',
      icon: Send,
      color: 'from-blue-500 to-blue-600',
      action: onSendNotification
    },
    {
      id: 'export',
      title: 'Export Data',
      description: 'Download user data as CSV',
      icon: Download,
      color: 'from-green-500 to-green-600',
      action: onExportData
    },
    {
      id: 'backup',
      title: 'Backup Database',
      description: 'Create database backup',
      icon: Database,
      color: 'from-purple-500 to-purple-600',
      action: onBackupDatabase
    },
    {
      id: 'todays-picks',
      title: "Today's Picks",
      description: 'View and manage AI predictions',
      icon: Target,
      color: 'from-purple-500 to-pink-600',
      action: onOpenTodaysPicks
    },
    {
        id: 'reports',
        title: "Reports",
        description: 'View business intelligence reports',
        icon: BarChart3,
        color: 'from-indigo-500 to-violet-600',
        action: onOpenReports
      }
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20"
    >
      <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {actions.map((action, index) => {
          const Icon = action.icon
          const isLoading = loading === action.id
          
          return (
            <motion.button
              key={action.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              onClick={() => handleAction(action.id, action.action)}
              disabled={isLoading}
              className={`p-4 rounded-lg bg-gradient-to-r ${action.color} text-white hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
                <div className="text-left">
                  <div className="font-semibold">{action.title}</div>
                  <div className="text-sm opacity-90">{action.description}</div>
                </div>
              </div>
            </motion.button>
          )
        })}
      </div>
    </motion.div>
  )
}
