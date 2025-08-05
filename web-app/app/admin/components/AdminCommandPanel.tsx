'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Terminal, Play, Calendar, BarChart3, TrendingUp, Database, RefreshCw, Zap } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useAuth } from '@/contexts/AuthContext'

interface AdminCommandPanelProps {
  // No props needed for now
}

export default function AdminCommandPanel({}: AdminCommandPanelProps) {
  const [isRunning, setIsRunning] = useState<string | null>(null)
  const { session } = useAuth()

  const runCommand = async (command: string, label: string, id: string) => {
    if (isRunning) return
    if (!session?.access_token) {
      toast.error('Authentication error: Not logged in')
      return
    }

    setIsRunning(command)
    try {
      const endpoint = id === 'setup-odds' ? '/api/admin/generate-odds' : '/api/admin/run-command'
      const body = id === 'setup-odds' ? {} : { command }


      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      })
      
      const data = await response.json()
      if (data.success) {
        toast.success(`${label} command executed successfully!`)
      } else {
        toast.error(`Failed to run ${label}: ${data.error}`)
      }
    } catch (error) {
      console.error('Error running command:', error)
      toast.error(`Failed to run ${label}`)
    } finally {
      setIsRunning(null)
    }
  }

  const commands = [
    { 
      id: 'props-today',
      label: 'Props for Today', 
      command: 'python props_enhanced.py',
      icon: Play,
      color: 'bg-blue-600 hover:bg-blue-700 border-blue-500/30'
    },
    { 
      id: 'props-tomorrow',
      label: 'Props for Tomorrow', 
      command: 'python props_enhanced.py --tomorrow',
      icon: Calendar,
      color: 'bg-purple-600 hover:bg-purple-700 border-purple-500/30'
    },
    { 
      id: 'teams-today',
      label: 'Teams for Today', 
      command: 'python teams_enhanced.py',
      icon: Play,
      color: 'bg-green-600 hover:bg-green-700 border-green-500/30'
    },
    { 
      id: 'teams-tomorrow',
      label: 'Teams for Tomorrow', 
      command: 'python teams_enhanced.py --tomorrow',
      icon: Calendar,
      color: 'bg-emerald-600 hover:bg-emerald-700 border-emerald-500/30'
    },
    { 
      id: 'setup-odds',
      label: 'Generate Odds', 
      command: 'npm run odds',
      icon: Database,
      color: 'bg-amber-600 hover:bg-amber-700 border-amber-500/30'
    },
    { 
      id: 'insights',
      label: 'Run Insights', 
      command: 'python insights_personalized_enhanced.py',
      icon: BarChart3,
      color: 'bg-indigo-600 hover:bg-indigo-700 border-indigo-500/30'
    },
    { 
      id: 'trends',
      label: 'Generate Trends', 
      command: 'python trendsnew.py',
      icon: TrendingUp,
      color: 'bg-pink-600 hover:bg-pink-700 border-pink-500/30'
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-slate-800/70 to-slate-900/70 backdrop-blur-md rounded-xl p-6 border border-white/10"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <Terminal className="w-5 h-5 mr-2 text-green-400" />
          Admin Commands
        </h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 mt-4">
        {commands.map((cmd) => (
          <button
            key={cmd.id}
            onClick={() => runCommand(cmd.command, cmd.label, cmd.id)}
            disabled={isRunning !== null}
            className={`flex items-center p-3 rounded-lg text-white transition-all ${cmd.color} ${
              isRunning === cmd.command 
                ? 'opacity-75 cursor-not-allowed' 
                : isRunning !== null 
                  ? 'opacity-50 cursor-not-allowed' 
                  : ''
            }`}
          >
            {isRunning === cmd.command ? (
              <RefreshCw className="w-5 h-5 mr-3 animate-spin" />
            ) : (
              <cmd.icon className="w-5 h-5 mr-3" />
            )}
            <span className="font-medium">{cmd.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-5 text-xs text-gray-500">
        <p>Note: Commands run on the backend server. Ensure proper environment variables and dependencies are set up.</p>
      </div>
    </motion.div>
  )
}