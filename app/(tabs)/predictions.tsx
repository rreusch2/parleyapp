import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Platform,
  RefreshControl
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Filter, ArrowUpRight, ChartBar as BarChart2, TrendingUp, AlertTriangle, CheckCircle, Clock } from 'lucide-react-native';
import { mockPredictionData } from '@/data/mockData';

interface Prediction {
  id: string;
  matchup: string;
  time: string;
  confidence: number;
  pick: string;
  odds: string;
  analysis: string;
  winRate: number;
  roi: number;
  value: string;
}

interface PredictionCardProps {
  prediction: Prediction;
}

export default function PredictionsScreen() {
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [sportFilters, setSportFilters] = useState([
    { id: 'all', name: 'All Sports', active: true },
    { id: 'nfl', name: 'NFL', active: false },
    { id: 'nba', name: 'NBA', active: false },
    { id: 'mlb', name: 'MLB', active: false },
    { id: 'nhl', name: 'NHL', active: false },
  ]);

  useEffect(() => {
    // Simulate loading data
    const timer = setTimeout(() => {
      setPredictions(mockPredictionData);
      setLoading(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  const handleSportFilter = (sportId) => {
    setActiveTab(sportId);
    
    // Update filter states
    setSportFilters(sportFilters.map(sport => ({
      ...sport,
      active: sport.id === sportId
    })));
    
    // Apply filtering logic here
    setLoading(true);
    setTimeout(() => {
      if (sportId === 'all') {
        setPredictions(mockPredictionData);
      } else {
        setPredictions(mockPredictionData.filter(
          prediction => prediction.sportId === sportId
        ));
      }
      setLoading(false);
    }, 500);
  };

  const renderConfidenceBar = (confidence) => {
    let barColor = '#EF4444'; // Low confidence
    
    if (confidence >= 90) {
      barColor = '#10B981'; // High confidence
    } else if (confidence >= 75) {
      barColor = '#F59E0B'; // Medium confidence
    }
    
    return (
      <View style={styles.confidenceBarContainer}>
        <View style={[styles.confidenceBar, { width: `${confidence}%`, backgroundColor: barColor }]} />
        <Text style={styles.confidenceText}>{confidence}%</Text>
      </View>
    );
  };

  const fetchPredictions = async () => {
    try {
      // TODO: Replace with actual API call
      const response = await fetch('YOUR_BACKEND_URL/api/predictions');
      const data = await response.json();
      setPredictions(data);
    } catch (error) {
      console.error('Error fetching predictions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchPredictions();
  }, []);

  const PredictionCard: React.FC<PredictionCardProps> = ({ prediction }) => (
    <View style={styles.card}>
      <LinearGradient
        colors={['#1a2a6c', '#b21f1f']}
        style={styles.gradientHeader}
      >
        <Text style={styles.matchupText}>{prediction.matchup}</Text>
        <Text style={styles.timeText}>{prediction.time}</Text>
      </LinearGradient>

      <View style={styles.predictionContent}>
        <View style={styles.confidenceIndicator}>
          <TrendingUp color="#007AFF" size={24} />
          <Text style={styles.confidenceText}>
            {prediction.confidence}% Confidence
          </Text>
        </View>

        <View style={styles.pickContainer}>
          <Text style={styles.pickLabel}>AI PICK:</Text>
          <Text style={styles.pickText}>{prediction.pick}</Text>
          <Text style={styles.oddsText}>{prediction.odds}</Text>
        </View>

        <View style={styles.analysisContainer}>
          <Text style={styles.analysisTitle}>Analysis:</Text>
          <Text style={styles.analysisText}>{prediction.analysis}</Text>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Win Rate</Text>
            <Text style={styles.statValue}>{prediction.winRate}%</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>ROI</Text>
            <Text style={styles.statValue}>{prediction.roi}%</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Value</Text>
            <Text style={styles.statValue}>{prediction.value}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.trackButton}>
          <Text style={styles.trackButtonText}>Track This Pick</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI Predictions</Text>
        <TouchableOpacity style={styles.filterButton}>
          <Filter size={18} color="#FFFFFF" />
          <Text style={styles.filterText}>Filter</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.statsCard}>
        <LinearGradient
          colors={['#1A365D', '#2D3748']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.statsGradient}
        >
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>72%</Text>
              <Text style={styles.statLabel}>Win Rate</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>+22.8%</Text>
              <Text style={styles.statLabel}>ROI</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>127</Text>
              <Text style={styles.statLabel}>Predictions</Text>
            </View>
          </View>
        </LinearGradient>
      </View>
      
      {/* Sport Filter Tabs */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
      >
        {sportFilters.map((sport) => (
          <TouchableOpacity
            key={sport.id}
            style={[
              styles.tabButton,
              activeTab === sport.id && styles.activeTabButton
            ]}
            onPress={() => handleSportFilter(sport.id)}
          >
            <Text 
              style={[
                styles.tabText,
                activeTab === sport.id && styles.activeTabText
              ]}
            >
              {sport.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      
      {/* Predictions List */}
      <ScrollView style={styles.predictionsContainer} refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00E5FF" />
            <Text style={styles.loadingText}>Analyzing data...</Text>
          </View>
        ) : predictions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <BarChart2 size={48} color="#64748B" />
            <Text style={styles.emptyText}>No predictions available</Text>
            <Text style={styles.emptySubtext}>
              Check back later for new AI predictions
            </Text>
          </View>
        ) : (
          predictions.map((prediction) => (
            <PredictionCard key={prediction.id} prediction={prediction} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const { width } = Dimensions.get('window');
const cardWidth = width > 500 ? width / 2 - 24 : width - 32;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  filterText: {
    color: '#FFFFFF',
    fontSize: 14,
    marginLeft: 6,
  },
  statsCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  statsGradient: {
    borderRadius: 16,
    padding: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  tabsContainer: {
    marginTop: 20,
  },
  tabsContent: {
    paddingHorizontal: 16,
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  activeTabButton: {
    backgroundColor: '#00E5FF',
  },
  tabText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#0F172A',
  },
  predictionsContainer: {
    flex: 1,
    marginTop: 20,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 12,
    fontSize: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  gradientHeader: {
    padding: 15,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },
  matchupText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  timeText: {
    color: '#fff',
    fontSize: 14,
    marginTop: 5,
  },
  predictionContent: {
    padding: 15,
  },
  confidenceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  confidenceText: {
    marginLeft: 10,
    fontSize: 16,
    fontWeight: '600',
  },
  pickContainer: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  pickLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  pickText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  oddsText: {
    fontSize: 16,
    color: '#007AFF',
  },
  analysisContainer: {
    marginBottom: 15,
  },
  analysisTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  analysisText: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  trackButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  trackButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});