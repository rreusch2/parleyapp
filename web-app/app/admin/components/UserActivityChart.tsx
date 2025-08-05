'use client'
import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

interface UserActivityData {
  date: string
  newUsers: number
  activeUsers: number
}

interface UserActivityChartProps {
  data?: UserActivityData[]
}

export default function UserActivityChart({ data = [] }: UserActivityChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current || data.length === 0) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * window.devicePixelRatio
    canvas.height = rect.height * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height)

    // Chart dimensions
    const padding = 40
    const chartWidth = rect.width - padding * 2
    const chartHeight = rect.height - padding * 2

    // Find max values
    const maxNewUsers = Math.max(...data.map(d => d.newUsers))
    const maxActiveUsers = Math.max(...data.map(d => d.activeUsers))
    const maxValue = Math.max(maxNewUsers, maxActiveUsers)

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.lineWidth = 1
    for (let i = 0; i <= 5; i++) {
      const y = padding + (chartHeight / 5) * i
      ctx.beginPath()
      ctx.moveTo(padding, y)
      ctx.lineTo(padding + chartWidth, y)
      ctx.stroke()
    }

    // Draw new users line (blue)
    ctx.strokeStyle = '#3B82F6'
    ctx.lineWidth = 2
    ctx.beginPath()
    data.forEach((point, index) => {
      const x = padding + (chartWidth / (data.length - 1)) * index
      const y = padding + chartHeight - (point.newUsers / maxValue) * chartHeight
      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    ctx.stroke()

    // Draw active users line (purple)
    ctx.strokeStyle = '#8B5CF6'
    ctx.lineWidth = 2
    ctx.beginPath()
    data.forEach((point, index) => {
      const x = padding + (chartWidth / (data.length - 1)) * index
      const y = padding + chartHeight - (point.activeUsers / maxValue) * chartHeight
      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    ctx.stroke()

    // Draw data points
    data.forEach((point, index) => {
      const x = padding + (chartWidth / (data.length - 1)) * index
      
      // New users point
      const newUsersY = padding + chartHeight - (point.newUsers / maxValue) * chartHeight
      ctx.fillStyle = '#3B82F6'
      ctx.beginPath()
      ctx.arc(x, newUsersY, 4, 0, 2 * Math.PI)
      ctx.fill()

      // Active users point
      const activeUsersY = padding + chartHeight - (point.activeUsers / maxValue) * chartHeight
      ctx.fillStyle = '#8B5CF6'
      ctx.beginPath()
      ctx.arc(x, activeUsersY, 4, 0, 2 * Math.PI)
      ctx.fill()
    })

  }, [data])

  // Generate sample data if none provided
  const sampleData: UserActivityData[] = data.length > 0 ? data : Array.from({ length: 7 }, (_, i) => ({
    date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    newUsers: Math.floor(Math.random() * 50) + 10,
    activeUsers: Math.floor(Math.random() * 200) + 100
  }))

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">User Activity (Last 7 Days)</h3>
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-gray-300">New Users</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
            <span className="text-gray-300">Active Users</span>
          </div>
        </div>
      </div>
      
      <div className="relative h-64">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      <div className="mt-4 grid grid-cols-7 gap-2 text-xs text-gray-400">
        {sampleData.map((point, index) => (
          <div key={index} className="text-center">
            {new Date(point.date).toLocaleDateString('en-US', { weekday: 'short' })}
          </div>
        ))}
      </div>
    </motion.div>
  )
}