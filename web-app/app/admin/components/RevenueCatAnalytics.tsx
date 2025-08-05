'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { DollarSign, Users, TrendingDown, BarChart3, RefreshCw, AlertTriangle } from 'lucide-react'
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface RevenueStats {
  totalRevenue: number;
  mrr: number;
  activeSubscriptions: number;
  churnRate: number;
  revenueHistory: {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      borderColor: string;
      backgroundColor: string;
      fill: boolean;
    }[];
  };
}

export default function RevenueCatAnalytics() {
  const [stats, setStats] = useState<RevenueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/revenuecat/stats');
        if (!response.ok) {
          throw new Error('Failed to fetch RevenueCat stats');
        }
        const data = await response.json();
        setStats(data);
      } catch (err: any) {
        setError(err.message);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
            color: '#fff'
        }
      },
      title: {
        display: true,
        text: 'Monthly Revenue Trend',
        color: '#fff'
      },
    },
    scales: {
        x: {
            ticks: {
                color: '#ddd'
            },
            grid: {
                color: 'rgba(255, 255, 255, 0.1)'
            }
        },
        y: {
            ticks: {
                color: '#ddd'
            },
            grid: {
                color: 'rgba(255, 255, 255, 0.1)'
            }
        }
    }
  };
  
  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 p-6 flex items-center justify-center min-h-[200px]">
        <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
        <p className="ml-4 text-white">Loading RevenueCat Analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/20 backdrop-blur-md rounded-xl border border-red-500/30 p-6 flex items-center justify-center min-h-[200px]">
        <AlertTriangle className="w-8 h-8 text-red-400" />
        <p className="ml-4 text-white">Error: {error}</p>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-white/5 backdrop-blur-md rounded-xl border border-white/10 p-6"
    >
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center space-x-3">
            <BarChart3 className="w-6 h-6 text-green-400" />
            <span>RevenueCat Analytics</span>
        </h2>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard icon={DollarSign} title="Total Revenue" value={`$${stats.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} color="green" />
            <StatCard icon={Users} title="Active Subscriptions" value={stats.activeSubscriptions.toLocaleString()} color="blue" />
            <StatCard icon={TrendingDown} title="Churn Rate" value={`${(stats.churnRate * 100).toFixed(2)}%`} color="red" />
            <StatCard icon={DollarSign} title="MRR" value={`$${stats.mrr.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} color="purple" />
        </div>

        {/* Revenue Chart */}
        <div className="mt-8">
            <Line options={chartOptions} data={stats.revenueHistory} />
        </div>
    </motion.div>
  );
}

// A helper component for the stat cards
function StatCard({ icon: Icon, title, value, color }: { icon: React.ElementType, title: string, value: string, color: string }) {
    const colors = {
        green: 'from-green-500/20 to-green-600/20 border-green-500/30 text-green-400',
        blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30 text-blue-400',
        red: 'from-red-500/20 to-red-600/20 border-red-500/30 text-red-400',
        purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30 text-purple-400'
    }
    const colorClasses = colors[color as keyof typeof colors] || colors.blue;

    return (
         <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`bg-gradient-to-br ${colorClasses} backdrop-blur-md rounded-xl p-6 border`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium`}>{title}</p>
                <p className="text-3xl font-bold text-white">{value}</p>
              </div>
              <Icon className="w-8 h-8" />
            </div>
          </motion.div>
    )
}
