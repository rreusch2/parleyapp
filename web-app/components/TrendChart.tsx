
'use client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts';
import { useEffect, useState } from 'react';

interface ChartDataPoint {
  date: string;
  opponent?: string;
  rbis?: number;
  hits?: number;
  home_runs?: number;
  runs?: number;
  [key: string]: any;
}

interface TrendChartProps {
  trendId: string;
}

export default function TrendChart({ trendId }: TrendChartProps) {
  const [chartData, setChartData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/trends?trendId=${trendId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch trend data');
        }
        const data = await response.json();
        setChartData(data);
      } catch (err) {
        setError(err.message);
      }
    };

    fetchData();
  }, [trendId]);

  if (error) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 h-64 flex items-center justify-center">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!chartData) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 h-64 flex items-center justify-center">
        <p className="text-gray-400">Loading chart data...</p>
      </div>
    );
  }

  const { recent_games, prop_line, visualData, propType, event_details, headline, trend_direction, success_rate } = chartData;

  const getStatKey = () => {
    if (propType) {
      const propKey = propType.toLowerCase().replace(' ', '_');
      if (propKey.includes('rbi')) return 'rbis';
      if (propKey.includes('hit')) return 'hits';
      if (propKey.includes('home_run') || propKey.includes('hr')) return 'home_runs';
      if (propKey.includes('run')) return 'runs';
    }
    const firstGame = recent_games[0];
    for (const key of ['rbis', 'hits', 'home_runs', 'runs']) {
      if (firstGame[key] !== undefined) return key;
    }
    return 'rbis';
  };

  const statKey = getStatKey();
  const values = recent_games.map((game: ChartDataPoint) => game[statKey] || 0);
  const maxValue = Math.max(...values, prop_line || 0);
  const yAxisMax = Math.max(Math.ceil(maxValue) + 1, 5);
  
  const formattedData = recent_games.map((game: ChartDataPoint) => {
    const opponentAbbreviation = game.opponent?.substring(0, 3) || 'N/A';
    const gameDate = game.date ? new Date(game.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' }) : opponentAbbreviation;
    
    return {
      name: gameDate,
      value: game[statKey] || 0,
      fill: prop_line !== undefined && (game[statKey] || 0) > prop_line ? '#10B981' : '#EF4444',
    };
  });

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white mb-1">{headline}</h3>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span>Trend: {trend_direction === 'up' ? '📈 Rising' : trend_direction === 'down' ? '📉 Falling' : '➡️ Stable'}</span>
          {success_rate && <span>Success Rate: {success_rate}%</span>}
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={formattedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={{ stroke: '#6B7280' }} />
            <YAxis
              domain={[0, yAxisMax]}
              allowDecimals={false}
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              axisLine={{ stroke: '#6B7280' }}
              tickCount={yAxisMax + 1}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '0.5rem' }}
              labelStyle={{ color: '#F9FAFB' }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} />
            {prop_line !== undefined && (
              <ReferenceLine y={prop_line} label={{ value: `Line: ${prop_line}`, position: 'insideTopLeft', fill: '#A5B4FC' }} stroke="#A5B4FC" strokeDasharray="3 3" />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 text-xs text-gray-500 text-center">
        {visualData?.x_axis} • {visualData?.y_axis}
      </div>
    </div>
  );
}
