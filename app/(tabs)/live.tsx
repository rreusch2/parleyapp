import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Clock, TrendingUp, TrendingDown } from 'lucide-react-native';
import { mockLiveGames } from '@/data/mockData';

export default function LiveGamesScreen() {
  const [loading, setLoading] = useState(true);
  const [liveGames, setLiveGames] = useState([]);
  const [selectedSport, setSelectedSport] = useState('all');

  const sportFilters = [
    { id: 'all', name: 'All' },
    { id: 'nba', name: 'NBA' },
    { id: 'nfl', name: 'NFL' },
    { id: 'mlb', name: 'MLB' },
    { id: 'soccer', name: 'Soccer' }
  ];

  useEffect(() => {
    // Simulate loading data
    const timer = setTimeout(() => {
      setLiveGames(mockLiveGames);
      setLoading(false);
    }, 1200);
    
    return () => clearTimeout(timer);
  }, []);

  const filterGames = (sportId) => {
    setSelectedSport(sportId);
    setLoading(true);
    
    setTimeout(() => {
      if (sportId === 'all') {
        setLiveGames(mockLiveGames);
      } else {
        setLiveGames(mockLiveGames.filter(game => game.sport === sportId));
      }
      setLoading(false);
    }, 500);
  };

  const renderOddsMovement = (movement) => {
    const isUp = movement.direction === 'up';
    return (
      <View style={styles.oddsMovement}>
        {isUp ? (
          <TrendingUp size={14} color="#10B981" />
        ) : (
          <TrendingDown size={14} color="#EF4444" />
        )}
        <Text 
          style={[
            styles.oddsMovementText, 
            { color: isUp ? '#10B981' : '#EF4444' }
          ]}
        >
          {movement.value}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Live Games</Text>
        <View style={styles.liveIndicator}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      {/* Sport Filters */}
      <View style={styles.filtersContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContent}
        >
          {sportFilters.map(sport => (
            <TouchableOpacity
              key={sport.id}
              style={[
                styles.filterButton,
                selectedSport === sport.id && styles.activeFilterButton
              ]}
              onPress={() => filterGames(sport.id)}
            >
              <Text 
                style={[
                  styles.filterText,
                  selectedSport === sport.id && styles.activeFilterText
                ]}
              >
                {sport.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Live Games List */}
      <ScrollView 
        style={styles.gamesContainer}
        contentContainerStyle={styles.gamesContent}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00E5FF" />
            <Text style={styles.loadingText}>Loading live games...</Text>
          </View>
        ) : liveGames.length === 0 ? (
          <View style={styles.noGamesContainer}>
            <Clock size={48} color="#64748B" />
            <Text style={styles.noGamesText}>No live games</Text>
            <Text style={styles.noGamesSubtext}>
              Check back later for live game updates
            </Text>
          </View>
        ) : (
          liveGames.map(game => (
            <TouchableOpacity key={game.id} style={styles.gameCard}>
              <View style={styles.gameHeader}>
                <View style={styles.gameInfo}>
                  <Text style={styles.sportName}>{game.sportName}</Text>
                  <View style={styles.statusContainer}>
                    <View style={styles.statusDot} />
                    <Text style={styles.statusText}>{game.status}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.detailsButton}>
                  <Text style={styles.detailsText}>Details</Text>
                  <ChevronRight size={16} color="#00E5FF" />
                </TouchableOpacity>
              </View>

              <View style={styles.teamsContainer}>
                <View style={styles.teamInfo}>
                  <Text style={styles.teamName}>{game.homeTeam.name}</Text>
                  <Text style={styles.teamScore}>{game.homeTeam.score}</Text>
                </View>
                <View style={styles.vsContainer}>
                  <Text style={styles.vsText}>VS</Text>
                </View>
                <View style={styles.teamInfo}>
                  <Text style={styles.teamName}>{game.awayTeam.name}</Text>
                  <Text style={styles.teamScore}>{game.awayTeam.score}</Text>
                </View>
              </View>

              <LinearGradient
                colors={['rgba(0, 229, 255, 0.1)', 'rgba(0, 0, 0, 0)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gameCardGradient}
              />

              <View style={styles.oddsContainer}>
                <View style={styles.marketContainer}>
                  <Text style={styles.marketTitle}>Spread</Text>
                  <View style={styles.marketRow}>
                    <Text style={styles.marketTeam}>{game.homeTeam.shortName}</Text>
                    <View style={styles.oddsWrapper}>
                      <Text style={styles.oddsValue}>{game.odds.spread.home}</Text>
                      {game.odds.spread.homeMovement && 
                        renderOddsMovement(game.odds.spread.homeMovement)
                      }
                    </View>
                  </View>
                  <View style={styles.marketRow}>
                    <Text style={styles.marketTeam}>{game.awayTeam.shortName}</Text>
                    <View style={styles.oddsWrapper}>
                      <Text style={styles.oddsValue}>{game.odds.spread.away}</Text>
                      {game.odds.spread.awayMovement && 
                        renderOddsMovement(game.odds.spread.awayMovement)
                      }
                    </View>
                  </View>
                </View>

                <View style={styles.marketDivider} />

                <View style={styles.marketContainer}>
                  <Text style={styles.marketTitle}>Total</Text>
                  <View style={styles.marketRow}>
                    <Text style={styles.marketTeam}>Over</Text>
                    <View style={styles.oddsWrapper}>
                      <Text style={styles.oddsValue}>{game.odds.total.over}</Text>
                      {game.odds.total.overMovement && 
                        renderOddsMovement(game.odds.total.overMovement)
                      }
                    </View>
                  </View>
                  <View style={styles.marketRow}>
                    <Text style={styles.marketTeam}>Under</Text>
                    <View style={styles.oddsWrapper}>
                      <Text style={styles.oddsValue}>{game.odds.total.under}</Text>
                      {game.odds.total.underMovement && 
                        renderOddsMovement(game.odds.total.underMovement)
                      }
                    </View>
                  </View>
                </View>

                <View style={styles.marketDivider} />

                <View style={styles.marketContainer}>
                  <Text style={styles.marketTitle}>ML</Text>
                  <View style={styles.marketRow}>
                    <Text style={styles.marketTeam}>{game.homeTeam.shortName}</Text>
                    <View style={styles.oddsWrapper}>
                      <Text style={styles.oddsValue}>{game.odds.moneyline.home}</Text>
                      {game.odds.moneyline.homeMovement && 
                        renderOddsMovement(game.odds.moneyline.homeMovement)
                      }
                    </View>
                  </View>
                  <View style={styles.marketRow}>
                    <Text style={styles.marketTeam}>{game.awayTeam.shortName}</Text>
                    <View style={styles.oddsWrapper}>
                      <Text style={styles.oddsValue}>{game.odds.moneyline.away}</Text>
                      {game.odds.moneyline.awayMovement && 
                        renderOddsMovement(game.odds.moneyline.awayMovement)
                      }
                    </View>
                  </View>
                </View>
              </View>

              {game.aiPrediction && (
                <View style={styles.aiPredictionContainer}>
                  <Text style={styles.aiPredictionLabel}>AI Prediction</Text>
                  <View style={styles.aiPredictionContent}>
                    <Text style={styles.aiPredictionText}>{game.aiPrediction.text}</Text>
                    <Text style={styles.aiConfidenceText}>{game.aiPrediction.confidence}% confidence</Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

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
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    marginRight: 6,
  },
  liveText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
  },
  filtersContainer: {
    marginVertical: 16,
  },
  filtersContent: {
    paddingHorizontal: 16,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  activeFilterButton: {
    backgroundColor: '#00E5FF',
  },
  filterText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  activeFilterText: {
    color: '#0F172A',
  },
  gamesContainer: {
    flex: 1,
  },
  gamesContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
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
  noGamesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  noGamesText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  noGamesSubtext: {
    color: '#94A3B8',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  gameCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    position: 'relative',
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
  gameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  gameInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sportName: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
    marginRight: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#10B981',
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailsText: {
    fontSize: 14,
    color: '#00E5FF',
    marginRight: 2,
  },
  teamsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  teamInfo: {
    flex: 2,
    alignItems: 'center',
  },
  teamName: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  teamScore: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  vsContainer: {
    flex: 1,
    alignItems: 'center',
  },
  vsText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  gameCardGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 5,
    height: '100%',
  },
  oddsContainer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  marketContainer: {
    flex: 1,
  },
  marketTitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 8,
    textAlign: 'center',
  },
  marketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  marketTeam: {
    fontSize: 14,
    color: '#E2E8F0',
  },
  oddsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  oddsValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
    marginRight: 4,
  },
  oddsMovement: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  oddsMovementText: {
    fontSize: 12,
    marginLeft: 2,
  },
  marketDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginHorizontal: 8,
  },
  aiPredictionContainer: {
    padding: 16,
    backgroundColor: 'rgba(0, 229, 255, 0.05)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  aiPredictionLabel: {
    fontSize: 12,
    color: '#00E5FF',
    fontWeight: '600',
    marginBottom: 6,
  },
  aiPredictionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aiPredictionText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
    flex: 1,
  },
  aiConfidenceText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
});