import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Filter, ArrowUpRight, ChartBar as BarChart2 } from 'lucide-react-native';
import { mockPredictionData } from '@/data/mockData';

export default function PredictionsScreen() {
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [predictions, setPredictions] = useState([]);
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
      <ScrollView style={styles.predictionsContainer}>
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
            <TouchableOpacity key={prediction.id} style={styles.predictionCard}>
              <View style={styles.predictionHeader}>
                <View style={styles.eventInfo}>
                  <Text style={styles.sportTag}>{prediction.sport}</Text>
                  <Text style={styles.eventTime}>{prediction.time}</Text>
                </View>
                <TouchableOpacity style={styles.analyzeButton}>
                  <ArrowUpRight size={16} color="#00E5FF" />
                </TouchableOpacity>
              </View>
              
              <Text style={styles.matchupText}>{prediction.matchup}</Text>
              
              <View style={styles.predictionDetails}>
                <View style={styles.predictionType}>
                  <Text style={styles.predictionTypeLabel}>Prediction Type</Text>
                  <Text style={styles.predictionTypeValue}>{prediction.type}</Text>
                </View>
                <View style={styles.predictionPick}>
                  <Text style={styles.predictionPickLabel}>AI Pick</Text>
                  <Text style={styles.predictionPickValue}>{prediction.pick}</Text>
                </View>
              </View>
              
              <View style={styles.oddsContainer}>
                <Text style={styles.oddsLabel}>Odds</Text>
                <Text style={styles.oddsValue}>{prediction.odds}</Text>
              </View>
              
              <View style={styles.confidenceContainer}>
                <Text style={styles.confidenceLabel}>AI Confidence</Text>
                {renderConfidenceBar(prediction.confidence)}
              </View>
              
              <View style={styles.insightContainer}>
                <Text style={styles.insightLabel}>Key Insight</Text>
                <Text style={styles.insightText}>{prediction.insight}</Text>
              </View>
            </TouchableOpacity>
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
  predictionCard: {
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
  predictionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  eventInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sportTag: {
    fontSize: 12,
    color: '#00E5FF',
    fontWeight: '600',
    marginRight: 10,
  },
  eventTime: {
    fontSize: 12,
    color: '#94A3B8',
  },
  analyzeButton: {
    height: 30,
    width: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchupText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  predictionDetails: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  predictionType: {
    flex: 1,
  },
  predictionTypeLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 4,
  },
  predictionTypeValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  predictionPick: {
    flex: 1,
  },
  predictionPickLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 4,
  },
  predictionPickValue: {
    fontSize: 14,
    color: '#00E5FF',
    fontWeight: '700',
  },
  oddsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  oddsLabel: {
    fontSize: 14,
    color: '#94A3B8',
    marginRight: 8,
  },
  oddsValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  confidenceContainer: {
    marginBottom: 16,
  },
  confidenceLabel: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
  },
  confidenceBarContainer: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    position: 'relative',
  },
  confidenceBar: {
    height: 8,
    borderRadius: 4,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  confidenceText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    position: 'absolute',
    right: 0,
    top: -20,
  },
  insightContainer: {
    padding: 12,
    backgroundColor: 'rgba(0, 229, 255, 0.05)',
    borderRadius: 8,
  },
  insightLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 4,
  },
  insightText: {
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 20,
  },
});