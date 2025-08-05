'use client'
import { useState, useEffect } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { BarChart3, Activity } from 'lucide-react'

interface TrendChartProps {
  chartData?: {
    recent_games?: any[]
  }
  visualData?: {
    chart_type?: 'bar' | 'line'
    trend_color?: string
  }
  propType?: string
  playerName?: string
  trendType?: 'player_prop' | 'team'
}

interface ChartDataPoint {
  name: string
  value: number
  opponent?: string
  date?: string
}

export default function TrendChart({ 
  chartData, 
  visualData, 
  propType, 
  playerName,
  trendType = 'player_prop'
}: TrendChartProps) {
  const [processedData, setProcessedData] = useState<ChartDataPoint[]>([])
  const [chartTitle, setChartTitle] = useState('')
  const [yAxisLabel, setYAxisLabel] = useState('')
  const [isDecimalData, setIsDecimalData] = useState(false)

  useEffect(() => {
    if (!chartData?.recent_games || chartData.recent_games.length === 0) {
      return
    }

    try {
      // Prepare data for the chart - limit to last 8 games for readability
      const recentGames = chartData.recent_games.slice(-8)
      
      let values: number[] = []
      let labels: string[] = []
      let title = ''
      let yLabel = ''
      let isDecimal = false

      // Create meaningful labels
      labels = recentGames.map((game: any, index: number) => {
        if (game.opponent) {
          return `vs ${game.opponent}`
        } else if (game.date) {
          const date = new Date(game.date)
          return `${date.getMonth() + 1}/${date.getDate()}`
        } else {
          return `Game ${recentGames.length - index}`
        }
      })

      if (trendType === 'player_prop') {
        // Determine what stat to show based on available data
        if (recentGames[0]?.hits !== undefined) {
          values = recentGames.map((game: any) => game.hits || 0)
          yLabel = 'Hits'
          title = `${playerName || 'Player'} - Recent Hits`
        } else if (recentGames[0]?.rbis !== undefined) {
          values = recentGames.map((game: any) => game.rbis || 0)
          yLabel = 'RBIs'
          title = `${playerName || 'Player'} - Recent RBIs`
        } else if (recentGames[0]?.runs !== undefined) {
          values = recentGames.map((game: any) => game.runs || 0)
          yLabel = 'Runs'
          title = `${playerName || 'Player'} - Recent Runs`
        } else if (recentGames[0]?.ba !== undefined) {
          values = recentGames.map((game: any) => parseFloat(game.ba) || 0)
          yLabel = 'Batting Avg'
          title = `${playerName || 'Player'} - Batting Average`
          isDecimal = true
        } else {
          values = recentGames.map((game: any) => game.value || 0)
          yLabel = 'Performance'
          title = `${playerName || 'Player'} - Performance`
        }
      } else {
        // Team trends
        if (recentGames[0]?.runs !== undefined) {
          values = recentGames.map((game: any) => game.runs || 0)
          yLabel = 'Runs'
          title = 'Team Runs Per Game'
        } else if (recentGames[0]?.ba !== undefined) {
          values = recentGames.map((game: any) => parseFloat(game.ba) || 0)
          yLabel = 'Team BA'
          title = 'Team Batting Average'
          isDecimal = true
        } else if (recentGames[0]?.home_runs !== undefined) {
          values = recentGames.map((game: any) => game.home_runs || 0)
          yLabel = 'Home Runs'
          title = 'Team Home Runs'
        } else {
          values = recentGames.map((game: any) => game.value || 0)
          yLabel = 'Performance'
          title = 'Team Performance'
        }
      }

      // Create chart data points
      const chartPoints: ChartDataPoint[] = labels.map((label, index) => ({
        name: label,
        value: values[index] || 0,
        opponent: recentGames[index]?.opponent,
        date: recentGames[index]?.date
      }))

      setProcessedData(chartPoints)
      setChartTitle(title)
      setYAxisLabel(yLabel)
      setIsDecimalData(isDecimal)

    } catch (error) {
      console.error('Chart processing error:', error)
    }
  }, [chartData, playerName, trendType])

  if (!chartData?.recent_games || chartData.recent_games.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 text-center">
        <BarChart3 className="w-10 h-10 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-white mb-2">Performance Trend</h3>
        <p className="text-gray-400">No performance data available</p>
        <p className="text-sm text-gray-500">Check back after more games are played</p>
      </div>
    )
  }

  if (processedData.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 text-center">
        <BarChart3 className="w-10 h-10 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-white mb-2">Performance Trend</h3>
        <p className="text-gray-400">Unable to render chart</p>
        <p className="text-sm text-gray-500">Data format may be incompatible</p>
      </div>
    )
  }

  const trendColor = visualData?.trend_color || '#00E5FF'
  const chartType = visualData?.chart_type || 'bar'

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900 border border-gray-600 rounded-lg p-3 shadow-lg">
          <p className="text-white font-medium">{label}</p>
          <p className="text-blue-400">
            {yAxisLabel}: {isDecimalData ? payload[0].value.toFixed(3) : payload[0].value}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center space-x-3 mb-4">
        <BarChart3 className="w-5 h-5 text-blue-400" />
        <div>
          <h3 className="text-lg font-semibold text-white">{chartTitle}</h3>
          <p className="text-sm text-gray-400">Last {processedData.length} Games • {yAxisLabel}</p>
        </div>
      </div>
      
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'bar' ? (
            <BarChart data={processedData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis 
                dataKey="name" 
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
              />
              <YAxis 
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
                domain={isDecimalData ? ['dataMin - 0.050', 'dataMax + 0.050'] : ['dataMin - 1', 'dataMax + 1']}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="value" 
                fill={trendColor}
                radius={[4, 4, 0, 0]}
                opacity={0.8}
              />
            </BarChart>
          ) : (
            <LineChart data={processedData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis 
                dataKey="name" 
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
                interval={0}
              />
              <YAxis 
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
                domain={isDecimalData ? ['dataMin - 0.050', 'dataMax + 0.050'] : ['dataMin - 1', 'dataMax + 1']}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke={trendColor}
                strokeWidth={3}
                dot={{ fill: trendColor, strokeWidth: 2, r: 5 }}
                activeDot={{ r: 7, stroke: trendColor, strokeWidth: 2 }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}