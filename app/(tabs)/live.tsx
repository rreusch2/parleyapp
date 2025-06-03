import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  RefreshControl,
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Clock } from 'lucide-react-native';
import { sportsApi, type SportsEvent } from '@/app/services/api/sportsApi';
import { useRouter } from 'expo-router';
import { supabase } from '@/app/services/api/supabaseClient';

export default function GamesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [liveGames, setLiveGames] = useState<SportsEvent[]>([]);
  const [upcomingGames, setUpcomingGames] = useState<SportsEvent[]>([]);
  const [completedGames, setCompletedGames] = useState<SportsEvent[]>([]);
  const [selectedSport, setSelectedSport] = useState('all');

  const sportFilters = [
    { id: 'all', name: 'All' },
    { id: 'NBA', name: 'NBA' },
    { id: 'MLB', name: 'MLB' },
    { id: 'NHL', name: 'NHL' },
    { id: 'NFL', name: 'NFL' }
  ];

  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      Alert.alert(
        'Session Expired',
        'Please log in again to continue.',
        [
          { text: 'OK', onPress: () => router.replace('/(auth)/login') }
        ]
      );
      return false;
    }
    return true;
  };

  const fetchGames = async () => {
    try {
      setLoading(true);
      
      // Check if user is authenticated
      const isAuthenticated = await checkSession();
      if (!isAuthenticated) return;

      console.log('Fetching games for sport:', selectedSport);
      const response = await sportsApi.getGames(
        selectedSport !== 'all' ? { league: selectedSport.toUpperCase() } : undefined
      );

      // Extract games from the paginated response
      const games = response.data.data || [];
      console.log('Fetched games:', games.length);

      // Separate games into live, upcoming, and completed
      const live = games.filter(game => game.status === 'live');
      const upcoming = games.filter(game => game.status === 'scheduled');
      const completed = games.filter(game => game.status === 'completed');
      console.log('Live games:', live.length, 'Upcoming games:', upcoming.length, 'Completed games:', completed.length);

      setLiveGames(live);
      setUpcomingGames(upcoming);
      setCompletedGames(completed);
    } catch (error: any) {
      console.error('Error fetching games:', error);
      if (error?.response?.status === 401) {
        Alert.alert(
          'Authentication Error',
          'Please log in again to continue.',
          [
            { text: 'OK', onPress: () => router.replace('/(auth)/login') }
          ]
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchGames();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchGames();
  }, [selectedSport]);

  const formatGameTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatGameDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const renderGameCard = (game: SportsEvent) => (
    <TouchableOpacity key={game.id} style={styles.gameCard}>
      <LinearGradient
        colors={['#1F2937', '#111827']}
        style={styles.gradientBackground}
      >
        <View style={styles.gameHeader}>
          <View style={styles.sportBadge}>
            <Text style={styles.sportText}>{game.league}</Text>
          </View>
          <Text style={styles.timeText}>
            {game.status === 'live' ? 'LIVE' : formatGameTime(game.start_time)}
          </Text>
        </View>

        <View style={styles.teamsContainer}>
          <View style={styles.teamInfo}>
            <Text style={styles.teamName}>{game.home_team}</Text>
            {game.stats.home_score !== null && (
              <Text style={styles.score}>{game.stats.home_score}</Text>
            )}
          </View>

          <View style={styles.teamInfo}>
            <Text style={styles.teamName}>{game.away_team}</Text>
            {game.stats.away_score !== null && (
              <Text style={styles.score}>{game.stats.away_score}</Text>
            )}
          </View>
        </View>

        <View style={styles.venueContainer}>
          <Clock size={14} color="#717171" />
          <Text style={styles.venueText}>
            {formatGameDate(game.start_time)} • {game.stats.venue}
          </Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContainer}
      >
        {sportFilters.map((filter) => (
          <TouchableOpacity
            key={filter.id}
            style={[
              styles.filterButton,
              selectedSport === filter.id && styles.filterButtonActive,
            ]}
            onPress={() => setSelectedSport(filter.id)}
          >
            <Text
              style={[
                styles.filterText,
                selectedSport === filter.id && styles.filterTextActive,
              ]}
            >
              {filter.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.gamesContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color="#00E5FF" style={styles.loader} />
        ) : (
          <>
            {liveGames.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Live Games</Text>
                {liveGames.map(renderGameCard)}
              </View>
            )}

            {upcomingGames.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Upcoming Games</Text>
                {upcomingGames.map(renderGameCard)}
              </View>
            )}

            {completedGames.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Completed Games</Text>
                {completedGames.map(renderGameCard)}
              </View>
            )}

            {liveGames.length === 0 && upcomingGames.length === 0 && completedGames.length === 0 && (
              <View style={styles.noGamesContainer}>
                <Text style={styles.noGamesText}>No games available</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  filterScroll: {
    maxHeight: 50,
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1F2937',
  },
  filterButtonActive: {
    backgroundColor: '#00E5FF',
  },
  filterText: {
    color: '#717171',
    fontSize: 14,
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#111827',
  },
  gamesContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  gameCard: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  gradientBackground: {
    padding: 16,
  },
  gameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sportBadge: {
    backgroundColor: '#374151',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  sportText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  timeText: {
    color: '#00E5FF',
    fontSize: 12,
    fontWeight: '600',
  },
  teamsContainer: {
    marginBottom: 12,
  },
  teamInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  teamName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  score: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  venueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  venueText: {
    color: '#717171',
    fontSize: 12,
  },
  loader: {
    marginTop: 24,
  },
  noGamesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 48,
  },
  noGamesText: {
    color: '#717171',
    fontSize: 16,
    fontWeight: '500',
  },
});