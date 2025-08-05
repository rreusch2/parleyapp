'use client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts'

interface ChartDataPoint {
  date: string
  rbis?: number
  hits?: number
  home_runs?: number
  runs?: number
  [key: string]: any
}

interface TrendChartProps {
  chartData: {
    recent_games: ChartDataPoint[]
    y_axis_max?: number
    y_axis_intervals?: number[]
    trend_direction?: string
    success_rate?: number
  }
  visualData: {
    chart_type: string
    x_axis: string
    y_axis: string
    trend_color?: string
    bar_color?: string
  }
  propType?: string
}

export default function TrendChart({ chartData, visualData, propType }: TrendChartProps) {
  if (!chartData?.recent_games || chartData.recent_games.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 h-64 flex items-center justify-center">
        <p className="text-gray-400">No chart data available</p>
      </div>
    )
  }

  // Determine which stat to display based on prop type or available data
  const getStatKey = () => {
    if (propType) {
      const propKey = propType.toLowerCase().replace(' ', '_')
      if (propKey.includes('rbi')) return 'rbis'
      if (propKey.includes('hit')) return 'hits'
      if (propKey.includes('home_run') || propKey.includes('hr')) return 'home_runs'
      if (propKey.includes('run')) return 'runs'
    }
    
    // Fallback: find the first numeric stat in the data
    const firstGame = chartData.recent_games[0]
    for (const key of ['rbis', 'hits', 'home_runs', 'runs']) {
      if (firstGame[key] !== undefined) return key
    }
    
    return 'rbis' // ultimate fallback
  }

  const statKey = getStatKey()
  const barColor = visualData.bar_color || visualData.trend_color || '#3b82f6'

  // Calculate proper Y-axis domain
  const values = chartData.recent_games.map(game => game[statKey] || 0)
  const maxValue = Math.max(...values)
  const yAxisMax = chartData.y_axis_max || Math.max(maxValue + 1, 4)

  // Format data for recharts
  const formattedData = chartData.recent_games.map((game, index) => ({
    game: game.date || `Game ${index + 1}`,
    value: game[statKey] || 0,
    rawDate: game.date
  }))

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white mb-1">
          {visualData.y_axis} - {visualData.x_axis}
        </h3>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span>Trend: {chartData.trend_direction === 'up' ? '📈 Rising' : chartData.trend_direction === 'down' ? '📉 Falling' : '➡️ Stable'}</span>
          {chartData.success_rate && (
            <span>Success Rate: {chartData.success_rate}%</span>
          )}
        </div>
      </div>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={formattedData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="game" 
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              axisLine={{ stroke: '#6B7280' }}
            />
            <YAxis 
              domain={[0, yAxisMax]}
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              axisLine={{ stroke: '#6B7280' }}
              tickCount={Math.min(yAxisMax + 1, 6)}
            />
            <Bar 
              dataKey="value" 
              fill={barColor}
              radius={[4, 4, 0, 0]}
              stroke={barColor}
              strokeWidth={1}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-2 text-xs text-gray-500 text-center">
        {visualData.x_axis} • {visualData.y_axis}
      </div>
    </div>
  )
}