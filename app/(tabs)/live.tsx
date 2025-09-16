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
  Alert,
  Modal,
  Dimensions,
  TextInput
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { normalize, isTablet } from '../services/device';
import { 
  ChevronRight, 
  Clock, 
  RefreshCw, 
  Calendar, 
  TrendingUp, 
  Target, 
  BarChart3, 
  DollarSign, 
  Eye, 
  Search, 
  Zap, 
  Brain, 
  Award,
  Crown,
  Lock,
  AlertCircle,
  Building2
} from 'lucide-react-native';
import { sportsApi } from '../services/api/sportsApi';
import type { SportsEvent } from '../services/api/sportsApi';
import { useRouter } from 'expo-router';
import { supabase } from '../services/api/supabaseClient';
import { aiService, AIPrediction } from '../services/api/aiService';
import { useSubscription } from '../services/subscriptionContext';

import { useAIChat } from '../services/aiChatContext';
import { useUITheme } from '../services/uiThemeContext';

const { width: screenWidth } = Dimensions.get('window');

// Enhanced interfaces for odds and predictions
interface BookOdds {
  bookName: string;
  moneyline: { home: string; away: string };
  spread: { home: string; away: string; line: string };
  total: { over: string; under: string; line: string };
  lastUpdated: Date;
}

interface OddsData {
  moneyline: { home: string; away: string };
  spread: { home: string; away: string; line: string };
  total: { over: string; under: string; line: string };
  books?: BookOdds[]; // Multi-book odds for Pro users
  bestOdds?: {
    moneylineHome: { book: string; odds: string };
    moneylineAway: { book: string; odds: string };
    spreadHome: { book: string; odds: string; line: string };
    spreadAway: { book: string; odds: string; line: string };
    totalOver: { book: string; odds: string; line: string };
    totalUnder: { book: string; odds: string; line: string };
  };
}

interface EnhancedSportsEvent extends SportsEvent {
  odds?: OddsData;
  aiPick?: AIPrediction;
  hasAiPick?: boolean;
  lineMovement?: {
    direction: 'up' | 'down' | 'stable';
    percentage: number;
  };
  publicBettingPercentage?: {
    home: number;
    away: number;
  };
  // Ensure all required properties from API response are available
  id: string;
  league: string;
  home_team: string;
  away_team: string;
  start_time: string;
  stats?: any;
}

export default function GamesScreen() {
  const router = useRouter();
  const { isPro, isElite, proFeatures, openSubscriptionModal } = useSubscription();
  const { theme } = useUITheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [liveGames, setLiveGames] = useState<EnhancedSportsEvent[]>([]);
  const [upcomingGames, setUpcomingGames] = useState<EnhancedSportsEvent[]>([]);
  const [completedGames, setCompletedGames] = useState<EnhancedSportsEvent[]>([]);
  const [selectedSport, setSelectedSport] = useState('all');
  const [viewMode, setViewMode] = useState<'list' | 'featured'>('list');
  const [selectedGame, setSelectedGame] = useState<EnhancedSportsEvent | null>(null);
  const [showGameModal, setShowGameModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [gameStats, setGameStats] = useState({ total: 0, withAI: 0, live: 0 });

  const { openChatWithContext } = useAIChat();
  const [selectedBooks, setSelectedBooks] = useState<Record<string, string>>({});


  const sportFilters = [
    { id: 'all', name: 'All' },
    { id: 'CFB', name: 'CFB' },
    { id: 'NFL', name: 'NFL' },
    { id: 'MLB', name: 'MLB' },
    { id: 'WNBA', name: 'WNBA' },
    { id: 'UFC', name: 'UFC' },
    { id: 'MMA', name: 'MMA' },
    { id: 'NBA', name: 'NBA' },
    { id: 'NHL', name: 'NHL' }
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
      
      // Map frontend sport filters to backend league values
      let leagueFilter = undefined;
      if (selectedSport !== 'all') {
        if (selectedSport === 'UFC') {
          leagueFilter = 'MMA'; // UFC fights are stored as MMA in backend
        } else if (selectedSport === 'CFB') {
          leagueFilter = 'NCAAF'; // College Football is stored as NCAAF in backend
        } else {
          leagueFilter = selectedSport.toUpperCase();
        }
      }
      
      const response = await sportsApi.getGames(
        leagueFilter ? { league: leagueFilter, limit: 50 } : { limit: 50 }
      );

      // Extract games from the paginated response
      const games = response.data.data || [];
      console.log('Fetched games:', games.length);

      // Filter for upcoming games (scheduled status for next 7 days to include NFL preseason)
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      
      const now = new Date();
      
      const upcomingGamesList = games.filter(game => {
        const gameDate = new Date(game.start_time);
        const gameStartTime = gameDate.getTime();
        const currentTime = now.getTime();
        const timeDifference = gameStartTime - currentTime;
        const thirtyMinutesInMs = 30 * 60 * 1000;
        
        // Game must be scheduled AND either:
        // 1. Game is in the future (hasn't started yet)
        // 2. Game is within 30 minutes of start time (buffer for live games)
        // 3. Game is within the next 7 days (to show NFL preseason Aug 7-8)
        return game.status === 'scheduled' && 
               gameStartTime <= nextWeek.getTime() && 
               timeDifference > -thirtyMinutesInMs; // Allow 30 min buffer for recently started games
      });
      
      // Enhance games with real odds and AI picks
      console.log(`🎯 Processing ${upcomingGamesList.length} upcoming games for enhancement`);
      const enhancedGames = await Promise.all(
        upcomingGamesList.map(async (game) => {
          const extractedOdds = extractRealOdds(game);
          const enhancedGame: EnhancedSportsEvent = {
            ...game,
            odds: extractedOdds,
            aiPick: await fetchGameAIPick(game.id),
            hasAiPick: false,
            lineMovement: isPro ? await fetchLineMovement(game.id) : undefined,
            // Remove fake public betting data
            // publicBettingPercentage: isPro ? await fetchPublicBetting(game.id) : undefined
          };
          enhancedGame.hasAiPick = !!enhancedGame.aiPick;
          console.log(`✅ Enhanced game: ${game.away_team} @ ${game.home_team}`, {
            hasOdds: !!extractedOdds,
            oddsBooks: extractedOdds?.books?.length || 0,
            hasAiPick: enhancedGame.hasAiPick
          });
          return enhancedGame;
        })
      );
      
      console.log('Total upcoming games (next 7 days):', enhancedGames.length);

      setUpcomingGames(enhancedGames);
      setLiveGames([]); // Clear live games
      setCompletedGames([]); // Clear completed games
      
      // Update stats
      const aiPickCount = enhancedGames.filter(g => g.hasAiPick).length;
      setGameStats({
        total: enhancedGames.length,
        withAI: aiPickCount,
        live: 0 // Would be calculated from live games
      });
      
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

  // Helper function to extract real odds from TheOdds API metadata
  const extractRealOdds = (game: SportsEvent): OddsData | undefined => {
    try {
      console.log(`🔍 Processing odds for ${game.away_team} @ ${game.home_team}`);
      console.log(`📊 Game metadata:`, JSON.stringify(game.metadata, null, 2));
      
      // Check if metadata contains TheOdds API data
      if (!game.metadata || !game.metadata.full_data || !game.metadata.full_data.bookmakers) {
        console.log(`❌ No odds metadata found for ${game.away_team} @ ${game.home_team}`);
        return undefined;
      }

      const bookmakers = game.metadata.full_data.bookmakers;
      if (!bookmakers || bookmakers.length === 0) {
        console.log(`No bookmakers found for ${game.away_team} @ ${game.home_team}`);
        return undefined;
      }

      console.log(`Found ${bookmakers.length} bookmakers for ${game.away_team} @ ${game.home_team}`);

      // Find the first bookmaker with complete data for basic odds
      const primaryBook = bookmakers.find((book: any) => 
        book.markets && book.markets.length >= 3
      ) || bookmakers[0];

      if (!primaryBook || !primaryBook.markets) {
        console.log(`No valid primary book found for ${game.away_team} @ ${game.home_team}`);
        return undefined;
      }

      // Extract basic odds from the primary bookmaker
      const h2hMarket = primaryBook.markets.find((m: any) => m.key === 'h2h');
      const spreadMarket = primaryBook.markets.find((m: any) => m.key === 'spreads');
      const totalMarket = primaryBook.markets.find((m: any) => m.key === 'totals');

      const basicOdds: OddsData = {
        moneyline: { 
          home: h2hMarket?.outcomes?.find((o: any) => o.name === game.home_team)?.price?.toString(),
          away: h2hMarket?.outcomes?.find((o: any) => o.name === game.away_team)?.price?.toString()
        },
        spread: { 
          home: spreadMarket?.outcomes?.find((o: any) => o.name === game.home_team)?.point?.toString(),
          away: spreadMarket?.outcomes?.find((o: any) => o.name === game.away_team)?.point?.toString(),
          line: spreadMarket?.outcomes?.find((o: any) => o.name === game.home_team)?.price?.toString()
        },
        total: { 
          over: totalMarket?.outcomes?.find((o: any) => o.name === 'Over')?.point?.toString(),
          under: totalMarket?.outcomes?.find((o: any) => o.name === 'Under')?.point?.toString(),
          line: totalMarket?.outcomes?.find((o: any) => o.name === 'Over')?.price?.toString()
        }
      };

      // Process all bookmakers for sportsbook comparison (always available)
      if (bookmakers.length > 1) {
        const books: BookOdds[] = bookmakers.map((book: any) => {
          const h2h = book.markets?.find((m: any) => m.key === 'h2h');
          const spread = book.markets?.find((m: any) => m.key === 'spreads');
          const total = book.markets?.find((m: any) => m.key === 'totals');

          return {
            bookName: book.title,
            moneyline: {
              home: h2h?.outcomes?.find((o: any) => o.name === game.home_team)?.price?.toString(),
              away: h2h?.outcomes?.find((o: any) => o.name === game.away_team)?.price?.toString()
            },
            spread: {
              home: spread?.outcomes?.find((o: any) => o.name === game.home_team)?.point?.toString(),
              away: spread?.outcomes?.find((o: any) => o.name === game.away_team)?.point?.toString(),
              line: spread?.outcomes?.find((o: any) => o.name === game.home_team)?.price?.toString()
            },
            total: {
              over: total?.outcomes?.find((o: any) => o.name === 'Over')?.point?.toString(),
              under: total?.outcomes?.find((o: any) => o.name === 'Under')?.point?.toString(),
              line: total?.outcomes?.find((o: any) => o.name === 'Over')?.price?.toString()
            },
            lastUpdated: new Date(book.last_update || Date.now())
          };
        });

        basicOdds.books = books;

        // For Pro users, find best odds across all books
        if (isPro) {
          let bestMoneylineHome = { book: primaryBook.title, odds: basicOdds.moneyline.home };
          let bestMoneylineAway = { book: primaryBook.title, odds: basicOdds.moneyline.away };

          books.forEach(book => {
            const homeOdds = parseFloat(book.moneyline.home);
            const awayOdds = parseFloat(book.moneyline.away);
            
            if (homeOdds > parseFloat(bestMoneylineHome.odds)) {
              bestMoneylineHome = { book: book.bookName, odds: book.moneyline.home };
            }
            if (awayOdds > parseFloat(bestMoneylineAway.odds)) {
              bestMoneylineAway = { book: book.bookName, odds: book.moneyline.away };
            }
          });

          basicOdds.bestOdds = {
            moneylineHome: bestMoneylineHome,
            moneylineAway: bestMoneylineAway,
            spreadHome: { book: primaryBook.title, odds: basicOdds.spread.home, line: basicOdds.spread.home },
            spreadAway: { book: primaryBook.title, odds: basicOdds.spread.away, line: basicOdds.spread.away },
            totalOver: { book: primaryBook.title, odds: basicOdds.total.over, line: basicOdds.total.over },
            totalUnder: { book: primaryBook.title, odds: basicOdds.total.under, line: basicOdds.total.under }
          };
        }
      }

      console.log(`Successfully extracted odds for ${game.away_team} @ ${game.home_team}:`, basicOdds);
      return basicOdds;
    } catch (error) {
      console.error(`Error extracting real odds for ${game.away_team} @ ${game.home_team}:`, error);
      return undefined;
    }
  };

  // Helper function to fetch AI picks for a game
  const fetchGameAIPick = async (gameId: string): Promise<AIPrediction | undefined> => {
    try {
      const predictions = await aiService.getPredictionsForGame(gameId);
      return predictions.length > 0 ? predictions[0] : undefined;
    } catch (error) {
      console.error('Error fetching AI pick for game:', gameId, error);
      return undefined;
    }
  };

  // Pro feature: Fetch line movement data
  const fetchLineMovement = async (gameId: string) => {
    // Mock data for line movement - TODO: Replace with real data
    const movements = [
      { direction: 'up' as const, percentage: 2.5 },
      { direction: 'down' as const, percentage: 1.8 },
      { direction: 'stable' as const, percentage: 0 }
    ];
    return movements[Math.floor(Math.random() * movements.length)];
  };

  // Removed fake public betting function - was placeholder data

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchGames();
    setRefreshing(false);
  };

  const fetchTomorrowGames = async () => {
    if (!isPro) {
      Alert.alert(
        'Pro Feature 🌟',
        'Fetch tomorrow\'s games and get early AI predictions with Pro!',
        [
          { text: 'Maybe Later', style: 'cancel' },
          { 
            text: 'Upgrade to Pro', 
            onPress: () => openSubscriptionModal(),
            style: 'default'
          }
        ]
      );
      return;
    }

    try {
      setLoading(true);
      console.log('🔄 Fetching tomorrow\'s games...');
      
      const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://zooming-rebirth-production-a305.up.railway.app';
      const response = await fetch(`${baseUrl}/api/fetch-tomorrow-games`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        console.log('✅ Tomorrow\'s games fetched successfully');
        // Refresh the games list
        await fetchGames();
      } else {
        console.error('❌ Failed to fetch tomorrow\'s games');
      }
    } catch (error) {
      console.error('❌ Error fetching tomorrow\'s games:', error);
    } finally {
      setLoading(false);
    }
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

  const getFilteredGames = () => {
    let filtered = upcomingGames;

    if (selectedSport !== 'all') {
      // Map frontend sport filters to backend league values (same as fetchGames)
      let leagueToMatch = selectedSport.toLowerCase();
      
      if (selectedSport === 'UFC') {
        // UFC tab should show MMA games (since UFC fights are stored as MMA)
        leagueToMatch = 'mma';
      } else if (selectedSport === 'MMA') {
        // MMA tab should show MMA games
        leagueToMatch = 'mma';
      } else if (selectedSport === 'CFB') {
        // CFB tab should show NCAAF games (since College Football is stored as NCAAF)
        leagueToMatch = 'ncaaf';
      }
      
      filtered = filtered.filter(game => game.league.toLowerCase() === leagueToMatch);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(game => 
        game.home_team.toLowerCase().includes(query) ||
        game.away_team.toLowerCase().includes(query) ||
        game.league.toLowerCase().includes(query)
      );
    }

    console.log(`🔍 Filtered games for sport '${selectedSport}':`, filtered.length);
    console.log('Games by league:', filtered.reduce((acc, game) => {
      acc[game.league] = (acc[game.league] || 0) + 1;
      return acc;
    }, {} as Record<string, number>));

    return filtered;
  };

  // Helper function to get best odds for a market
  const getBestOdds = (game: EnhancedSportsEvent, marketType: 'moneyline' | 'spread' | 'total') => {
    if (!game.odds || !game.odds.books || game.odds.books.length === 0) {
      return null;
    }

    const books = game.odds.books;
    let bestAwayOdds = { book: '', odds: '', line: '', price: -Infinity };
    let bestHomeOdds = { book: '', odds: '', line: '', price: -Infinity };

    books.forEach(book => {
      let awayOdds, homeOdds;
      
      switch (marketType) {
        case 'moneyline':
          awayOdds = parseFloat(book.moneyline.away);
          homeOdds = parseFloat(book.moneyline.home);
          if (awayOdds > bestAwayOdds.price) {
            bestAwayOdds = { book: book.bookName, odds: book.moneyline.away, line: '', price: awayOdds };
          }
          if (homeOdds > bestHomeOdds.price) {
            bestHomeOdds = { book: book.bookName, odds: book.moneyline.home, line: '', price: homeOdds };
          }
          break;
        case 'spread':
          awayOdds = parseFloat(book.spread.line);
          homeOdds = parseFloat(book.spread.line);
          if (awayOdds > bestAwayOdds.price) {
            bestAwayOdds = { book: book.bookName, odds: book.spread.line, line: book.spread.away, price: awayOdds };
          }
          if (homeOdds > bestHomeOdds.price) {
            bestHomeOdds = { book: book.bookName, odds: book.spread.line, line: book.spread.home, price: homeOdds };
          }
          break;
        case 'total':
          const overOdds = parseFloat(book.total.line);
          const underOdds = parseFloat(book.total.line);
          bestAwayOdds = { book: book.bookName, odds: book.total.line, line: `O${book.total.over}`, price: overOdds };
          bestHomeOdds = { book: book.bookName, odds: book.total.line, line: `U${book.total.under}`, price: underOdds };
          break;
      }
    });

    return { away: bestAwayOdds, home: bestHomeOdds };
  };

  const getSelectedBookOdds = (game: EnhancedSportsEvent) => {
    const selectedBook = selectedBooks[game.id];
    console.log(`📚 Getting odds for ${game.away_team} @ ${game.home_team}:`, {
      selectedBook,
      hasOdds: !!game.odds,
      booksCount: game.odds?.books?.length || 0,
      firstBookName: game.odds?.books?.[0]?.bookName
    });
    
    if (!game.odds?.books || game.odds.books.length === 0) {
      // Return primary odds if no books available
      console.log(`📋 Using primary odds:`, game.odds ? 'Found' : 'None');
      return game.odds || null;
    }

    // For Free users: Always prioritize FanDuel if available
    if (!isPro) {
      const fanduelBook = game.odds.books.find(book => 
        book.bookName.toLowerCase().includes('fanduel') || 
        book.bookName.toLowerCase().includes('fan duel')
      );
      if (fanduelBook) {
        console.log(`📋 Free user: Using FanDuel odds`);
        return fanduelBook;
      }
      // Fallback to first book if FanDuel not available
      console.log(`📋 Free user: FanDuel not found, using first book`);
      return game.odds.books[0];
    }

    // For Pro users: Use selected book or first available
    if (!selectedBook) {
      const result = game.odds.books[0];
      console.log(`📋 Pro user: Using default first book`);
      return result;
    }
    
    const result = game.odds.books.find(book => book.bookName === selectedBook) || game.odds.books[0];
    console.log(`📚 Pro user: Selected book result:`, result?.bookName || 'None');
    return result;
  };

  const renderEnhancedGameCard = (game: EnhancedSportsEvent) => {
    const selectedBookData = getSelectedBookOdds(game);
    const availableBooks = game.odds?.books || [];

    return (
      <TouchableOpacity 
        key={game.id} 
        style={styles.modernGameCard}
        onPress={() => {
          setSelectedGame(game);
          setShowGameModal(true);
        }}
      >
        <LinearGradient
          colors={['#1E293B', '#0F172A']}
          style={styles.modernCardGradient}
        >
          {/* Header */}
          <View style={styles.modernHeader}>
            <View style={styles.gameTimeContainer}>
              <Text style={styles.gameTime}>{formatGameTime(game.start_time)}</Text>
              <Text style={styles.gameDate}>{formatGameDate(game.start_time)}</Text>
            </View>
            
            <View style={styles.headerBadges}>
              <View style={styles.leagueBadge}>
                <Text style={styles.leagueText}>{game.league}</Text>
              </View>
              {game.hasAiPick && (
                <View style={styles.aiIndicator}>
                  <Brain size={12} color="#00E5FF" />
                </View>
              )}
            </View>
          </View>

          {/* Teams and Odds Grid - Conditional layout for MMA vs other sports */}
          <View style={styles.teamsOddsContainer}>
            {/* Column Headers - Different for MMA */}
            <View style={styles.oddsHeaders}>
              <View style={styles.teamColumn} />
              {game.league.toLowerCase() !== 'mma' && (
                <>
                  <Text style={styles.oddsHeader}>Spread</Text>
                  <Text style={styles.oddsHeader}>Total</Text>
                </>
              )}
              <Text style={styles.oddsHeader}>Money</Text>
            </View>

            {/* Away Team Row */}
            <View style={styles.teamOddsRow}>
              <View style={styles.teamInfo}>
                <Text style={styles.modernTeamName}>{game.away_team}</Text>
                <Text style={styles.teamRecord}>
                  {game.stats?.away_score !== null ? game.stats.away_score : ''}
                </Text>
              </View>
              
              {/* Only show spread and total for non-MMA sports */}
              {game.league.toLowerCase() !== 'mma' && (
                <>
                  {/* Spread */}
                  <TouchableOpacity style={styles.oddsButton}>
                    <Text style={styles.spreadLine} numberOfLines={1} adjustsFontSizeToFit>
                      {selectedBookData?.spread.away?.startsWith('-') ? selectedBookData.spread.away : `+${selectedBookData?.spread.away || '1.5'}`}
                    </Text>
                    <Text style={styles.oddsPrice} numberOfLines={1} adjustsFontSizeToFit>
                      {selectedBookData?.spread.line?.startsWith('-') ? selectedBookData.spread.line : `+${selectedBookData?.spread.line || '110'}`}
                    </Text>
                  </TouchableOpacity>

                  {/* Total */}
                  <TouchableOpacity style={styles.oddsButton}>
                    <Text style={styles.totalLine} numberOfLines={1} adjustsFontSizeToFit>
                      O{selectedBookData?.total.over || '8.5'}
                    </Text>
                    <Text style={styles.oddsPrice} numberOfLines={1} adjustsFontSizeToFit>
                      {selectedBookData?.total.line?.startsWith('-') ? selectedBookData.total.line : `+${selectedBookData?.total.line || '110'}`}
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Moneyline - Always show */}
              <TouchableOpacity style={[styles.oddsButton, game.league.toLowerCase() === 'mma' && styles.mmaMoneylineButton]}>
                <Text style={[styles.moneylineOdds, game.league.toLowerCase() === 'mma' && styles.mmaMoneylineOdds]} numberOfLines={1} adjustsFontSizeToFit>
                  {selectedBookData?.moneyline.away?.startsWith('-') ? selectedBookData.moneyline.away : `+${selectedBookData?.moneyline.away || '150'}`}
                </Text>
                <Text style={styles.oddsPrice}> </Text>
              </TouchableOpacity>
            </View>

            {/* Home Team Row */}
            <View style={styles.teamOddsRow}>
              <View style={styles.teamInfo}>
                <Text style={styles.modernTeamName}>{game.home_team}</Text>
                <Text style={styles.teamRecord}>
                  {game.stats?.home_score !== null ? game.stats.home_score : ''}
                </Text>
              </View>
              
              {/* Only show spread and total for non-MMA sports */}
              {game.league.toLowerCase() !== 'mma' && (
                <>
                  {/* Spread */}
                  <TouchableOpacity style={styles.oddsButton}>
                    <Text style={styles.spreadLine} numberOfLines={1} adjustsFontSizeToFit>
                      {selectedBookData?.spread.home?.startsWith('-') ? selectedBookData.spread.home : `+${selectedBookData?.spread.home || '1.5'}`}
                    </Text>
                    <Text style={styles.oddsPrice} numberOfLines={1} adjustsFontSizeToFit>
                      {selectedBookData?.spread.line?.startsWith('-') ? selectedBookData.spread.line : `+${selectedBookData?.spread.line || '110'}`}
                    </Text>
                  </TouchableOpacity>

                  {/* Total */}
                  <TouchableOpacity style={styles.oddsButton}>
                    <Text style={styles.totalLine} numberOfLines={1} adjustsFontSizeToFit>
                      U{selectedBookData?.total.under || '8.5'}
                    </Text>
                    <Text style={styles.oddsPrice} numberOfLines={1} adjustsFontSizeToFit>
                      {selectedBookData?.total.line?.startsWith('-') ? selectedBookData.total.line : `+${selectedBookData?.total.line || '110'}`}
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Moneyline - Always show */}
              <TouchableOpacity style={[styles.oddsButton, game.league.toLowerCase() === 'mma' && styles.mmaMoneylineButton]}>
                <Text style={[styles.moneylineOdds, game.league.toLowerCase() === 'mma' && styles.mmaMoneylineOdds]} numberOfLines={1} adjustsFontSizeToFit>
                  {selectedBookData?.moneyline.home?.startsWith('-') ? selectedBookData.moneyline.home : `+${selectedBookData?.moneyline.home || '150'}`}
                </Text>
                <Text style={styles.oddsPrice}> </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Sportsbook Selector */}
          {availableBooks.length > 1 && (
            <View style={styles.sportsbookSelector}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bookScrollView}>
                {/* For Free users: only show FanDuel. For Pro users: show all books */}
                {(isPro ? availableBooks : availableBooks.filter(book => 
                  book.bookName.toLowerCase().includes('fanduel') || 
                  book.bookName.toLowerCase().includes('fan duel')
                )).map((book, index) => (
                  <TouchableOpacity
                    key={book.bookName}
                    style={[
                      styles.bookOption,
                      (selectedBooks[game.id] === book.bookName || (!selectedBooks[game.id] && index === 0)) && styles.selectedBook
                    ]}
                    onPress={() => {
                      // Free users can't change sportsbook - only Pro users can
                      if (isPro) {
                        setSelectedBooks(prev => ({ ...prev, [game.id]: book.bookName }));
                      }
                    }}
                  >
                    <Text style={[
                      styles.modernBookName,
                      (selectedBooks[game.id] === book.bookName || (!selectedBooks[game.id] && index === 0)) && styles.selectedBookName
                    ]}>
                      {book.bookName}
                    </Text>
                    {(selectedBooks[game.id] === book.bookName || (!selectedBooks[game.id] && index === 0)) && (
                      <View style={styles.bestOddsIndicator}>
                        <Text style={styles.bestOddsText}>Best</Text>
                      </View>
                    )}
                    {/* Show lock icon for Free users on non-FanDuel books */}
                    {!isPro && !book.bookName.toLowerCase().includes('fanduel') && !book.bookName.toLowerCase().includes('fan duel') && (
                      <Lock size={12} color="#64748B" style={{ marginLeft: 4 }} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
              
              {/* Show upgrade hint for Free users */}
              {!isPro && availableBooks.length > 1 && (
                <TouchableOpacity 
                  style={styles.upgradeHint}
                  onPress={() => openSubscriptionModal()}
                >
                  <Lock size={14} color="#F59E0B" />
                  <Text style={styles.upgradeHintText}>
                    Upgrade to Pro to compare odds across all sportsbooks
                  </Text>
                  <Crown size={14} color="#F59E0B" />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* AI Pick Preview */}
          {game.aiPick && (
            <View style={styles.modernAiPick}>
              <View style={styles.modernAiPickHeader}>
                <Zap size={16} color="#00E5FF" />
                <Text style={styles.modernAiPickTitle}>AI Pick</Text>
                <View style={styles.modernConfidenceBadge}>
                  <Text style={styles.modernConfidenceText}>{game.aiPick.confidence}%</Text>
                </View>
              </View>
              <Text style={styles.aiPickContent} numberOfLines={2}>
                {game.aiPick.pick}
              </Text>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const filteredGames = getFilteredGames();

  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00E5FF"
            colors={['#00E5FF']}
          />
        }
      >
        {/* Header Stats */}
        <LinearGradient
          colors={isElite ? theme.headerGradient : (isPro ? ['#7C3AED', '#1E40AF'] as const : ['#1E293B', '#334155'] as const)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerStats}
        >
          {isElite && (
            <View style={[styles.proBadge, { backgroundColor: `${theme.accentPrimary}33`, borderColor: theme.accentPrimary }]}> 
              <Crown size={16} color={theme.accentPrimary} />
              <Text style={[styles.proBadgeText, { color: theme.accentPrimary }]}>✨ ELITE MEMBER ✨</Text>
            </View>
          )}
          {isPro && !isElite && (
            <View style={styles.proBadge}>
              <Crown size={16} color="#F59E0B" />
              <Text style={styles.proBadgeText}>PRO MEMBER</Text>
            </View>
          )}

          <View style={styles.statsRow}>
            <View style={styles.dualStatCard}>
              <Calendar size={22} color={isElite ? theme.accentPrimary : '#00E5FF'} />
              <Text style={styles.dualStatValue}>{gameStats.total}</Text>
              <Text style={styles.dualStatLabel}>Games Available{'\n'}Today & Tomorrow</Text>
            </View>
            
            <View style={styles.dualStatCardSecondary}>
              <Clock size={22} color={isElite ? theme.accentPrimary : '#8B5CF6'} />
              <Text style={styles.dualStatValueSecondary}>
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </Text>
              <Text style={styles.dualStatLabel}>
                {new Date().toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                })}
              </Text>
            </View>
          </View>

          <View style={styles.actionButtons}>
            {/* Removed the Fetch Tomorrow and Pro Filters buttons */}
          </View>
        </LinearGradient>

        {/* Pro Filters Section removed */}

        {/* Search Bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <Search size={20} color="#717171" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search games, teams..."
              placeholderTextColor="#717171"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {/* View Mode Toggle */}
        <View style={styles.viewModeContainer}>
          <View style={styles.viewModeToggle}>
            <TouchableOpacity
              style={[styles.toggleButton, styles.toggleButtonActive]}
              onPress={() => setViewMode('list')}
            >
              <BarChart3 size={16} color="#FFF" />
              <Text style={[
                styles.toggleButtonText,
                styles.toggleButtonTextActive
              ]}>
                All Games
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sport Filters */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.filterContainer}
          contentContainerStyle={styles.filterContent}
        >
          {sportFilters.map(sport => (
            <TouchableOpacity
              key={sport.id}
              style={[
                styles.filterChip,
                selectedSport === sport.id && styles.filterChipActive
              ]}
              onPress={() => setSelectedSport(sport.id)}
            >
              <Text style={[
                styles.filterChipText,
                selectedSport === sport.id && styles.filterChipTextActive
              ]}>
                {sport.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Games List */}
        <View style={styles.gamesContainer}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#00E5FF" />
              <Text style={styles.loadingText}>Loading games...</Text>
            </View>
          ) : filteredGames.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Calendar size={48} color="#64748B" />
              <Text style={styles.emptyTitle}>No games found</Text>
              <Text style={styles.emptyText}>
                Try adjusting your filters or search.
              </Text>
            </View>
          ) : (
            filteredGames.map(game => renderEnhancedGameCard(game))
          )}
        </View>

        {!isPro && (
          <TouchableOpacity 
            style={styles.upgradeCard}
            onPress={() => openSubscriptionModal()}
          >
            <LinearGradient
              colors={['#F59E0B', '#D97706']}
              style={styles.upgradeGradient}
            >
              <Crown size={20} color="#FFFFFF" />
              <View style={styles.upgradeContent}>
                <Text style={styles.upgradeTitle}>Unlock Pro Features</Text>
                <Text style={styles.upgradeFeatures}>
                  • Multi-book odds comparison
                  • Line movement tracking
                  • Public betting percentages
                  • Advanced AI filters
                </Text>
              </View>
              <ChevronRight size={20} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
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
  contentContainer: {
    paddingBottom: normalize(80),
  },
  headerStats: {
    paddingTop: Platform.OS === 'ios' ? normalize(60) : normalize(40),
    paddingBottom: normalize(20),
    paddingHorizontal: normalize(16),
    position: 'relative',
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    top: Platform.OS === 'ios' ? normalize(60) : normalize(40),
    right: normalize(20),
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: normalize(12),
    paddingVertical: normalize(6),
    borderRadius: normalize(20),
  },
  proBadgeText: {
    fontSize: normalize(11),
    fontWeight: '700',
    color: '#F59E0B',
    marginLeft: normalize(6),
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: normalize(20),
    marginTop: normalize(30),
    paddingHorizontal: normalize(8),
    gap: normalize(12),
  },
  statCard: {
    alignItems: 'center',
    flex: 1,
  },
  dualStatCard: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: normalize(120),
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    paddingHorizontal: normalize(16),
    paddingVertical: normalize(18),
    borderRadius: normalize(14),
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
  },
  dualStatCardSecondary: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    height: normalize(120),
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    paddingHorizontal: normalize(16),
    paddingVertical: normalize(18),
    borderRadius: normalize(14),
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  centeredStatCard: {
    alignItems: 'center',
    alignSelf: 'stretch',
    marginHorizontal: normalize(32),
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    paddingHorizontal: normalize(24),
    paddingVertical: normalize(20),
    borderRadius: normalize(16),
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
  },
  statValue: {
    fontSize: normalize(24),
    fontWeight: '700',
    color: '#FFFFFF',
    marginVertical: normalize(4),
  },
  dualStatValue: {
    fontSize: normalize(28),
    fontWeight: '800',
    color: '#00E5FF',
    marginVertical: normalize(8),
    textAlign: 'center',
  },
  dualStatValueSecondary: {
    fontSize: normalize(24),
    fontWeight: '800',
    color: '#8B5CF6',
    marginVertical: normalize(8),
    textAlign: 'center',
  },
  dualStatLabel: {
    fontSize: normalize(12),
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: normalize(16),
  },
  centeredStatValue: {
    fontSize: normalize(28),
    fontWeight: '800',
    color: '#00E5FF',
    marginVertical: normalize(8),
  },
  statLabel: {
    fontSize: normalize(12),
    color: '#CBD5E1',
  },
  centeredStatLabel: {
    fontSize: normalize(14),
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: normalize(8),
    gap: normalize(12),
  },
  dateText: {
    fontSize: normalize(16),
    fontWeight: '600',
    color: '#CBD5E1',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: normalize(12),
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: normalize(16),
    paddingVertical: normalize(8),
    borderRadius: normalize(20),
    gap: normalize(6),
  },
  actionButtonDisabled: {
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: normalize(14),
    fontWeight: '600',
  },
  actionButtonTextDisabled: {
    color: '#64748B',
  },
  proFiltersContainer: {
    backgroundColor: '#1E293B',
    padding: normalize(16),
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  proFiltersTitle: {
    fontSize: normalize(16),
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: normalize(12),
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: normalize(16),
    paddingVertical: normalize(10),
    borderRadius: normalize(8),
    marginBottom: normalize(8),
    gap: normalize(8),
  },
  filterOptionActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderWidth: 1,
    borderColor: '#00E5FF',
  },
  filterOptionText: {
    color: '#94A3B8',
    fontSize: normalize(14),
    fontWeight: '500',
  },
  filterOptionTextActive: {
    color: '#00E5FF',
  },
  valueThresholdContainer: {
    marginTop: normalize(8),
  },
  valueButtons: {
    flexDirection: 'row',
    gap: normalize(8),
    marginTop: normalize(8),
  },
  valueButton: {
    backgroundColor: '#0F172A',
    paddingHorizontal: normalize(16),
    paddingVertical: normalize(8),
    borderRadius: normalize(16),
    borderWidth: 1,
    borderColor: '#334155',
  },
  valueButtonText: {
    color: '#94A3B8',
    fontSize: normalize(12),
    fontWeight: '600',
  },
  searchSection: {
    paddingHorizontal: normalize(16),
    paddingVertical: normalize(12),
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: normalize(12),
    paddingHorizontal: normalize(16),
    paddingVertical: normalize(12),
  },
  searchInput: {
    flex: 1,
    marginLeft: normalize(12),
    fontSize: normalize(16),
    color: '#FFFFFF',
  },
  viewModeContainer: {
    paddingHorizontal: normalize(16),
    marginBottom: normalize(12),
  },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: normalize(12),
    padding: normalize(4),
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: normalize(8),
    borderRadius: normalize(8),
    gap: normalize(6),
  },
  toggleButtonActive: {
    backgroundColor: '#334155',
  },
  toggleButtonText: {
    color: '#717171',
    fontSize: normalize(14),
    fontWeight: '600',
  },
  toggleButtonTextActive: {
    color: '#FFFFFF',
  },
  filterContainer: {
    maxHeight: normalize(50),
    paddingVertical: normalize(8),
  },
  filterContent: {
    paddingHorizontal: normalize(16),
    gap: normalize(8),
  },
  filterChip: {
    backgroundColor: '#1E293B',
    paddingHorizontal: normalize(16),
    paddingVertical: normalize(8),
    borderRadius: normalize(20),
    marginRight: normalize(8),
  },
  filterChipActive: {
    backgroundColor: '#1E40AF',
  },
  filterChipText: {
    color: '#94A3B8',
    fontSize: normalize(14),
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  gamesContainer: {
    paddingHorizontal: normalize(16),
  },
  loadingContainer: {
    paddingVertical: normalize(60),
    alignItems: 'center',
  },
  loadingText: {
    marginTop: normalize(12),
    fontSize: normalize(16),
    color: '#94A3B8',
  },
  emptyContainer: {
    paddingVertical: normalize(60),
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: normalize(18),
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: normalize(16),
    marginBottom: normalize(8),
  },
  emptyText: {
    fontSize: normalize(14),
    color: '#94A3B8',
    textAlign: 'center',
    paddingHorizontal: normalize(32),
  },
  enhancedGameCard: {
    marginBottom: normalize(16),
    borderRadius: normalize(16),
    overflow: 'hidden',
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
    }),
  },
  cardGradient: {
    padding: normalize(16),
    position: 'relative',
  },
  enhancedGameHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: normalize(12),
  },
  sportTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: normalize(8),
  },
  sportBadge: {
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
    paddingHorizontal: normalize(10),
    paddingVertical: normalize(4),
    borderRadius: normalize(12),
  },
  sportText: {
    color: '#00E5FF',
    fontSize: normalize(12),
    fontWeight: '700',
  },
  timeText: {
    color: '#94A3B8',
    fontSize: normalize(14),
  },
  indicatorContainer: {
    flexDirection: 'row',
    gap: normalize(8),
  },
  aiPickBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    paddingHorizontal: normalize(10),
    paddingVertical: normalize(4),
    borderRadius: normalize(12),
    gap: normalize(4),
  },
  aiPickText: {
    color: '#FFFFFF',
    fontSize: normalize(11),
    fontWeight: '600',
  },
  lineMovementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: normalize(10),
    paddingVertical: normalize(4),
    borderRadius: normalize(12),
    gap: normalize(4),
  },
  lineMovementText: {
    fontSize: normalize(11),
    fontWeight: '700',
  },
  matchupContainer: {
    marginBottom: normalize(16),
  },
  teamRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: normalize(8),
  },
  score: {
    fontSize: normalize(18),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  vsContainer: {
    alignItems: 'center',
    marginVertical: normalize(4),
  },
  vsText: {
    color: '#64748B',
    fontSize: normalize(12),
  },
  publicBettingContainer: {
    marginBottom: normalize(16),
  },
  publicBettingLabel: {
    fontSize: normalize(12),
    color: '#94A3B8',
    marginBottom: normalize(6),
  },
  publicBettingBar: {
    flexDirection: 'row',
    height: normalize(24),
    borderRadius: normalize(12),
    overflow: 'hidden',
    backgroundColor: '#0F172A',
  },
  publicBettingFill: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  publicBettingText: {
    fontSize: normalize(11),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  oddsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: normalize(16),
  },
  oddsSection: {
    flex: 1,
    alignItems: 'center',
  },
  oddsLabel: {
    fontSize: normalize(12),
    color: '#94A3B8',
    marginBottom: normalize(4),
  },
  oddsValues: {
    alignItems: 'center',
  },
  oddsText: {
    fontSize: normalize(14),
    fontWeight: '600',
    color: '#FFFFFF',
    marginVertical: normalize(2),
  },
  bestOddsValue: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    paddingHorizontal: normalize(8),
    paddingVertical: normalize(4),
    borderRadius: normalize(8),
    marginVertical: normalize(2),
  },
  aiPickPreview: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
    borderRadius: normalize(12),
    padding: normalize(12),
    marginBottom: normalize(12),
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: normalize(16),
    overflow: 'hidden',
  },
  lockGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockText: {
    fontSize: normalize(14),
    color: '#94A3B8',
    marginTop: normalize(8),
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: normalize(12),
    borderTopWidth: 1,
    borderTopColor: 'rgba(100, 116, 139, 0.3)',
  },
  venueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: normalize(6),
  },
  venueText: {
    fontSize: normalize(12),
    color: '#64748B',
  },
  actionContainer: {
    flexDirection: 'row',
    gap: normalize(8),
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    paddingHorizontal: normalize(12),
    paddingVertical: normalize(6),
    borderRadius: normalize(16),
    gap: normalize(4),
  },
  viewDetailsText: {
    fontSize: normalize(12),
    color: '#00E5FF',
    fontWeight: '600',
  },
  upgradeCard: {
    margin: normalize(16),
    borderRadius: normalize(16),
    overflow: 'hidden',
  },
  upgradeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: normalize(20),
  },
  upgradeContent: {
    flex: 1,
    marginHorizontal: normalize(16),
  },
  upgradeTitle: {
    fontSize: normalize(18),
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: normalize(8),
  },
  upgradeFeatures: {
    fontSize: normalize(14),
    color: '#FFFFFF',
    lineHeight: normalize(20),
    opacity: 0.9,
  },
  
  // Modern Card Styles
  modernGameCard: {
    marginBottom: normalize(16),
    borderRadius: normalize(16),
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  modernCardGradient: {
    padding: normalize(16),
  },
  modernHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: normalize(16),
  },
  gameTimeContainer: {
    alignItems: 'flex-start',
  },
  gameTime: {
    fontSize: normalize(16),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  gameDate: {
    fontSize: normalize(12),
    color: '#94A3B8',
    marginTop: normalize(2),
  },
  headerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: normalize(8),
  },
  leagueBadge: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    paddingHorizontal: normalize(8),
    paddingVertical: normalize(4),
    borderRadius: normalize(6),
  },
  leagueText: {
    color: '#00E5FF',
    fontSize: normalize(11),
    fontWeight: '700',
  },
  aiIndicator: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    padding: normalize(6),
    borderRadius: normalize(6),
  },
  teamsOddsContainer: {
    marginBottom: normalize(16),
  },
  oddsHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: normalize(12),
    paddingBottom: normalize(8),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(100, 116, 139, 0.2)',
  },
  teamColumn: {
    flex: 2.5,
  },
  oddsHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: normalize(12),
    fontWeight: '600',
    color: '#94A3B8',
  },
  teamOddsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: normalize(8),
  },
  teamInfo: {
    flex: 2.5,
    paddingRight: normalize(12),
  },
  modernTeamName: {
    fontSize: normalize(14),
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: normalize(2),
  },
  teamRecord: {
    fontSize: normalize(11),
    color: '#64748B',
  },
  oddsButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    paddingVertical: normalize(8),
    paddingHorizontal: normalize(4),
    borderRadius: normalize(8),
    marginHorizontal: normalize(2),
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.2)',
  },
  spreadLine: {
    fontSize: normalize(13),
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: normalize(2),
  },
  totalLine: {
    fontSize: normalize(13),
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: normalize(2),
  },
  moneylineOdds: {
    fontSize: normalize(13),
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    flex: 1,
    textAlignVertical: 'center',
  },
  mmaMoneylineButton: {
    flex: 2, // Make MMA moneyline buttons wider since they're the only odds shown
    minWidth: normalize(80),
  },
  mmaMoneylineOdds: {
    fontSize: normalize(14), // Slightly larger for MMA since it's the primary focus
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  oddsPrice: {
    fontSize: normalize(11),
    fontWeight: '600',
    color: '#94A3B8',
  },
  sportsbookSelector: {
    marginBottom: normalize(12),
  },
  bookScrollView: {
    flexGrow: 0,
  },
  bookOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    paddingHorizontal: normalize(12),
    paddingVertical: normalize(6),
    borderRadius: normalize(16),
    marginRight: normalize(8),
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.2)',
  },
  selectedBook: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderColor: '#00E5FF',
  },
  modernBookName: {
    fontSize: normalize(11),
    fontWeight: '600',
    color: '#94A3B8',
  },
  selectedBookName: {
    color: '#00E5FF',
  },
  bestOddsIndicator: {
    backgroundColor: '#10B981',
    paddingHorizontal: normalize(6),
    paddingVertical: normalize(2),
    borderRadius: normalize(8),
    marginLeft: normalize(6),
  },
  bestOddsText: {
    fontSize: normalize(9),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modernAiPick: {
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderRadius: normalize(12),
    padding: normalize(12),
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
  },
  modernAiPickHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: normalize(8),
  },
  modernAiPickTitle: {
    flex: 1,
    marginLeft: normalize(8),
    fontSize: normalize(13),
    fontWeight: '700',
    color: '#00E5FF',
  },
  modernConfidenceBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: normalize(8),
    paddingVertical: normalize(3),
    borderRadius: normalize(12),
  },
  modernConfidenceText: {
    fontSize: normalize(11),
    fontWeight: '700',
    color: '#10B981',
  },
  aiPickContent: {
    fontSize: normalize(12),
    color: '#E2E8F0',
    fontWeight: '500',
    lineHeight: normalize(16),
  },
  upgradeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: normalize(12),
    paddingVertical: normalize(8),
    borderRadius: normalize(8),
    marginTop: normalize(8),
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  upgradeHintText: {
    flex: 1,
    fontSize: normalize(11),
    color: '#F59E0B',
    fontWeight: '600',
    marginHorizontal: normalize(8),
    textAlign: 'center',
  },
});