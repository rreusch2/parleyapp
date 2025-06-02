import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TrendingUp, ChevronRight, Zap } from 'lucide-react-native';

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [topPicks, setTopPicks] = useState([]);
  
  useEffect(() => {
    // Simulate data loading
    const timer = setTimeout(() => {
      setTopPicks([
        {
          id: '1',
          title: 'NBA - Lakers vs Warriors',
          prediction: 'Warriors -3.5',
          confidence: 87,
          time: '7:30 PM ET',
          odds: '-110',
          sport: 'basketball'
        },
        {
          id: '2',
          title: 'NFL - Chiefs vs Ravens',
          prediction: 'Over 51.5 Points',
          confidence: 93,
          time: '4:25 PM ET',
          odds: '-105',
          sport: 'football'
        },
        {
          id: '3',
          title: 'MLB - Yankees vs Red Sox',
          prediction: 'Yankees ML',
          confidence: 78,
          time: '1:05 PM ET',
          odds: '-120',
          sport: 'baseball'
        }
      ]);
      setLoading(false);
    }, 1500);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <LinearGradient
        colors={['rgba(0, 229, 255, 0.1)', 'rgba(0, 0, 0, 0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <Text style={styles.greeting}>Welcome back</Text>
          <Text style={styles.headingLarge}>BetGenius AI</Text>
          <Text style={styles.subheading}>AI-Powered Sports Predictions</Text>
        </View>
      </LinearGradient>

      {/* AI Insight Card */}
      <TouchableOpacity style={styles.insightCard}>
        <LinearGradient
          colors={['#1E40AF', '#1E3A8A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientCard}
        >
          <View style={styles.insightCardContent}>
            <Zap size={24} color="#00E5FF" style={styles.insightIcon} />
            <Text style={styles.insightTitle}>AI Insight of the Day</Text>
            <Text style={styles.insightText}>
              Our AI models have detected value in NFL player props for receiving yards
              today, with a 23% edge over the market.
            </Text>
            <TouchableOpacity style={styles.insightButton}>
              <Text style={styles.insightButtonText}>View Analysis</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Top AI Picks Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Today's Top AI Picks</Text>
        <TouchableOpacity style={styles.seeAllButton}>
          <Text style={styles.seeAllText}>See All</Text>
          <ChevronRight size={16} color="#00E5FF" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00E5FF" />
          <Text style={styles.loadingText}>Analyzing data...</Text>
        </View>
      ) : (
        <View style={styles.picksContainer}>
          {topPicks.map((pick) => (
            <TouchableOpacity key={pick.id} style={styles.pickCard}>
              <View style={styles.pickCardHeader}>
                <Text style={styles.pickSport}>{pick.sport.toUpperCase()}</Text>
                <View style={[
                  styles.confidenceBadge,
                  pick.confidence > 90 ? styles.highConfidence :
                  pick.confidence > 80 ? styles.mediumConfidence :
                  styles.lowConfidence
                ]}>
                  <Text style={styles.confidenceText}>{pick.confidence}% Confidence</Text>
                </View>
              </View>
              <Text style={styles.pickTitle}>{pick.title}</Text>
              <View style={styles.predictionContainer}>
                <Text style={styles.predictionLabel}>AI Prediction:</Text>
                <Text style={styles.predictionValue}>{pick.prediction}</Text>
              </View>
              <View style={styles.pickDetails}>
                <Text style={styles.pickTime}>{pick.time}</Text>
                <Text style={styles.pickOdds}>Odds: {pick.odds}</Text>
              </View>
              <LinearGradient
                colors={['rgba(0, 229, 255, 0.1)', 'rgba(0, 229, 255, 0.02)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.pickGradient}
              />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Trending Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Trending Markets</Text>
        <TouchableOpacity style={styles.seeAllButton}>
          <Text style={styles.seeAllText}>See All</Text>
          <ChevronRight size={16} color="#00E5FF" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.trendingScrollView}
        contentContainerStyle={styles.trendingContent}
      >
        {[1, 2, 3, 4].map((item) => (
          <TouchableOpacity key={item} style={styles.trendingCard}>
            <View style={styles.trendingIconContainer}>
              <TrendingUp size={20} color="#00E5FF" />
            </View>
            <Text style={styles.trendingTitle}>NFL Player Props</Text>
            <Text style={styles.trendingSubtitle}>20+ New Models</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </ScrollView>
  );
}

const { width } = Dimensions.get('window');
const cardWidth = width > 500 ? width / 2 - 24 : width - 32;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  contentContainer: {
    paddingBottom: 30,
  },
  headerGradient: {
    paddingTop: 20,
    paddingBottom: 30,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  header: {
    marginTop: 10,
  },
  greeting: {
    fontSize: 16,
    color: '#94A3B8',
    marginBottom: 5,
  },
  headingLarge: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subheading: {
    fontSize: 16,
    color: '#00E5FF',
    fontWeight: '500',
  },
  insightCard: {
    marginHorizontal: 16,
    marginTop: -20,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#00E5FF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 4px 12px rgba(0, 229, 255, 0.2)',
      },
    }),
  },
  gradientCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  insightCardContent: {
    padding: 20,
  },
  insightIcon: {
    marginBottom: 10,
  },
  insightTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  insightText: {
    fontSize: 14,
    color: '#E2E8F0',
    lineHeight: 20,
    marginBottom: 16,
  },
  insightButton: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  insightButtonText: {
    color: '#00E5FF',
    fontWeight: '600',
    fontSize: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 32,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAllText: {
    color: '#00E5FF',
    marginRight: 4,
    fontSize: 14,
    fontWeight: '500',
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
  picksContainer: {
    paddingHorizontal: 16,
    flexDirection: width > 500 ? 'row' : 'column',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  pickCard: {
    width: cardWidth,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    position: 'relative',
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
  pickCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  pickSport: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  highConfidence: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  mediumConfidence: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  lowConfidence: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  pickTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  predictionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  predictionLabel: {
    color: '#94A3B8',
    fontSize: 14,
    marginRight: 6,
  },
  predictionValue: {
    color: '#00E5FF',
    fontSize: 14,
    fontWeight: '700',
  },
  pickDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pickTime: {
    color: '#CBD5E1',
    fontSize: 13,
  },
  pickOdds: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
  },
  pickGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 5,
  },
  trendingScrollView: {
    marginTop: 8,
  },
  trendingContent: {
    paddingLeft: 16,
    paddingRight: 8,
  },
  trendingCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    width: 150,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  trendingIconContainer: {
    height: 40,
    width: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  trendingTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  trendingSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
  },
});