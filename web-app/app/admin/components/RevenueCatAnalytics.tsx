'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { DollarSign, Users, TrendingUp, BarChart3, RefreshCw, AlertTriangle } from 'lucide-react'
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

// Define the new interface for the data from the /api/revenuecat/revenue endpoint
interface RevenueData {
  currency: string;
  data: {
    date: string;
    revenue: number;
  }[];
  end_date: string;
  start_date: string;
  project_id: string;
  metric: string;
  aggregation: string;
  interval: string;
}

// Keep a simplified stats structure for the UI
interface DisplayStats {
  totalRevenue: number;
  startDate: string;
  endDate: string;
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
  const [stats, setStats] = useState<DisplayStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Construct the request to the new endpoint
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const startDate = thirtyDaysAgo.toISOString().split('T')[0];
        const endDate = new Date().toISOString().split('T')[0];
        const projectId = 'appac744357a5'; // Hardcoded Project ID

        const response = await fetch(`/api/revenuecat/revenue?start_date=${startDate}&end_date=${endDate}&project_id=${projectId}&interval=day`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch RevenueCat revenue data');
        }
        
        const data: RevenueData = await response.json();

        // Transform the fetched data into the structure the component expects
        const totalRevenue = data.data.reduce((acc, item) => acc + item.revenue, 0);
        const labels = data.data.map(item => new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        const revenueValues = data.data.map(item => item.revenue);

        const displayData: DisplayStats = {
          totalRevenue,
          startDate: data.start_date,
          endDate: data.end_date,
          revenueHistory: {
            labels,
            datasets: [{
              label: 'Daily Revenue (USD)',
              data: revenueValues,
              borderColor: '#3b82f6',
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              fill: true,
            }],
          },
        };

        setStats(displayData);
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
        labels: { color: '#fff' }
      },
      title: {
        display: true,
        text: 'Revenue Trend (Last 30 Days)',
        color: '#fff'
      },
    },
    scales: {
      x: {
        ticks: { color: '#ddd' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      },
      y: {
        ticks: { color: '#ddd' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 mb-8">
        <StatCard icon={DollarSign} title="Total Revenue (Last 30 Days)" value={`$${stats.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} color="green" />
        <StatCard icon={TrendingUp} title="Date Range" value={`${new Date(stats.startDate).toLocaleDateString()} - ${new Date(stats.endDate).toLocaleDateString()}`} color="blue" />
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
                <div className={`text-sm font-medium`}>{title}</div>
                <div className="text-3xl font-bold text-white">{value}</div>
              </div>
              <Icon className="w-8 h-8" />
            </div>
          </motion.div>
    )
}
