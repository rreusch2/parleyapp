import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Animated,
  RefreshControl,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import PlayerTrendsModal from '../components/PlayerTrendsModal';
import TeamTrendsModal from '../components/TeamTrendsModal';
import AIReportModal from '../components/AIReportModal';

interface Player {
  id: string;
  name: string;
  team: string;
  sport: string;
  position?: string;
  headshot_url?: string;
  has_headshot?: boolean;
}

interface PlayerSearchResult extends Player {
  recent_games_count: number;
  last_game_date: string;
}

interface Team {
  id: string;
  name: string;
  abbreviation: string;
  city: string;
  sport: string;
  logo_url?: string;
}

interface TeamSearchResult extends Team {
  recent_games_count: number;
  last_game_date: string;
}

type SearchMode = 'players' | 'teams';

export default function TrendsScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('players');
  const [playerResults, setPlayerResults] = useState<PlayerSearchResult[]>([]);
  const [teamResults, setTeamResults] = useState<TeamSearchResult[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [playerModalVisible, setPlayerModalVisible] = useState(false);
  const [teamModalVisible, setTeamModalVisible] = useState(false);
  const [selectedSport, setSelectedSport] = useState<string>('all');
  const [recentPlayerSearches, setRecentPlayerSearches] = useState<Player[]>([]);
  const [recentTeamSearches, setRecentTeamSearches] = useState<Team[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [aiReportModalVisible, setAiReportModalVisible] = useState(false);
  const searchRef = useRef<TextInput>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const sports = [
    { key: 'all', name: 'All', icon: '🏆' },
    { key: 'MLB', name: 'MLB', icon: '⚾' },
    { key: 'WNBA', name: 'WNBA', icon: '🏀' },
    { key: 'NBA', name: 'NBA', icon: '🏀' },
    { key: 'NFL', name: 'NFL', icon: '🏈' },
    { key: 'College Football', name: 'CFB', icon: '🏈' },
    { key: 'UFC', name: 'UFC', icon: '🥊' }
  ];

  useEffect(() => {
    loadRecentSearches();
    
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
      // Fade out sport filters when keyboard appears
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
    
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
      // Fade in sport filters when keyboard hides
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      const q = searchQuery.trim();
      if (q.length >= 2) {
        console.log('Triggering search for:', q, 'mode:', searchMode); // Debug log
        if (searchMode === 'players') {
          searchPlayers(q);
        } else {
          searchTeams(q);
        }
      } else if (q.length === 0) {
        setPlayerResults([]);
        setTeamResults([]);
      }
    }, 300); // Debounce search

    return () => clearTimeout(delayedSearch);
  }, [searchQuery, selectedSport, searchMode]);

  const loadRecentSearches = async () => {
    // Load from AsyncStorage or recent database queries
    // For now, we'll implement basic recent searches
  };

  const searchPlayers = async (query: string) => {
    if (query.length < 2) {
      setPlayerResults([]);
      return;
    }

    setIsSearching(true);
    try {
      console.log('Searching players with backend API:', query, selectedSport); // Debug log
      
      // Use backend API instead of direct Supabase queries for better mobile compatibility
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://zooming-rebirth-production-a305.up.railway.app';
      
      const sportFilter = selectedSport === 'all' ? '' : `&sport=${encodeURIComponent(selectedSport)}`;
      const apiUrl = `${backendUrl}/api/players/search?query=${encodeURIComponent(query)}${sportFilter}&limit=20`;
      console.log('API URL:', apiUrl); // Debug log
      
      // Create AbortController for mobile compatibility
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 10000); // 10 second timeout
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: abortController.signal,
      });
      
      clearTimeout(timeoutId); // Clear timeout if request completes
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Backend API response:', data); // Debug log
      
      if (data.players) {
        // Sort results to prioritize prefix matches (players whose names start with the query)
        const sortedData = data.players.sort((a: any, b: any) => {
          const queryLower = query.toLowerCase();
          const aStartsWith = a.name.toLowerCase().startsWith(queryLower);
          const bStartsWith = b.name.toLowerCase().startsWith(queryLower);
          
          // Prioritize exact prefix matches first
          if (aStartsWith && !bStartsWith) return -1;
          if (!aStartsWith && bStartsWith) return 1;
          
          // Then sort alphabetically within each group
          return a.name.localeCompare(b.name);
        });

        setPlayerResults(sortedData);
      } else {
        console.warn('No players array in response:', data);
        setPlayerResults([]);
      }
    } catch (error) {
      console.error('Player search error:', error);
      Alert.alert('Search Error', `Failed to search players: ${error instanceof Error ? error.message : 'Network error'}`);
      setPlayerResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const searchTeams = async (query: string) => {
    if (query.length < 2) {
      setTeamResults([]);
      return;
    }

    setIsSearching(true);
    try {
      console.log('Searching teams with backend API:', query, selectedSport); // Debug log
      
      // Use backend API for team search
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://zooming-rebirth-production-a305.up.railway.app';
      
      const sportFilter = selectedSport === 'all' ? '' : `&sport=${encodeURIComponent(selectedSport)}`;
      const apiUrl = `${backendUrl}/api/teams/search?query=${encodeURIComponent(query)}${sportFilter}&limit=20`;
      console.log('Team API URL:', apiUrl); // Debug log
      
      // Create AbortController for mobile compatibility
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 10000); // 10 second timeout
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: abortController.signal,
      });
      
      clearTimeout(timeoutId); // Clear timeout if request completes
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Backend team API response:', data); // Debug log
      
      if (data.teams) {
        // Sort results to prioritize prefix matches (with null safety)
        const sortedData = data.teams.sort((a: any, b: any) => {
          const queryLower = query.toLowerCase();
          
          // Safe lowercase with null checks
          const aName = (a.name || '').toLowerCase();
          const aCity = (a.city || '').toLowerCase();
          const bName = (b.name || '').toLowerCase();
          const bCity = (b.city || '').toLowerCase();
          
          const aStartsWith = aName.startsWith(queryLower) || aCity.startsWith(queryLower);
          const bStartsWith = bName.startsWith(queryLower) || bCity.startsWith(queryLower);
          
          // Prioritize exact prefix matches first
          if (aStartsWith && !bStartsWith) return -1;
          if (!aStartsWith && bStartsWith) return 1;
          
          // Then sort alphabetically within each group (with null safety)
          return (a.name || '').localeCompare(b.name || '');
        });

        setTeamResults(sortedData);
      } else {
        console.warn('No teams array in response:', data);
        setTeamResults([]);
      }
    } catch (error) {
      console.error('Team search error:', error);
      Alert.alert('Search Error', `Failed to search teams: ${error instanceof Error ? error.message : 'Network error'}`);
      setTeamResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const selectPlayer = (player: PlayerSearchResult) => {
    Keyboard.dismiss();
    setSelectedPlayer(player);
    setPlayerModalVisible(true);
    
    // Add to recent searches
    setRecentPlayerSearches(prev => {
      const filtered = prev.filter(p => p.id !== player.id);
      return [player, ...filtered].slice(0, 5);
    });
  };

  const selectTeam = (team: TeamSearchResult) => {
    Keyboard.dismiss();
    setSelectedTeam(team);
    setTeamModalVisible(true);
    
    // Add to recent searches
    setRecentTeamSearches(prev => {
      const filtered = prev.filter(t => t.id !== team.id);
      return [team, ...filtered].slice(0, 5);
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (searchQuery.trim().length >= 2) {
      if (searchMode === 'players') {
        await searchPlayers(searchQuery.trim());
      } else {
        await searchTeams(searchQuery.trim());
      }
    }
    setRefreshing(false);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setPlayerResults([]);
    setTeamResults([]);
    searchRef.current?.blur();
  };

  const getCurrentResults = () => {
    return searchMode === 'players' ? playerResults : teamResults;
  };

  const getCurrentRecentSearches = () => {
    return searchMode === 'players' ? recentPlayerSearches : recentTeamSearches;
  };

  const getSportColor = (sport: string) => {
    const colors = {
      'MLB': '#1E40AF',
      'WNBA': '#DC2626', 
      'NBA': '#DC2626',
      'NFL': '#16A34A',
      'UFC': '#EA580C'
    };
    return colors[sport as keyof typeof colors] || '#6B7280';
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0B' }}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
      <View style={{ flex: 1, padding: 20, paddingTop: 10 }}>
        {/* Header */}
        <Text style={{ 
          fontSize: 28, 
          fontWeight: 'bold', 
          color: '#FFFFFF',
          marginBottom: 32
        }}>
          Trends Analysis
        </Text>

        <TouchableOpacity
          onPress={() => setAiReportModalVisible(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            borderWidth: 1,
            borderColor: '#3B82F6',
            paddingHorizontal: 20,
            paddingVertical: 14,
            borderRadius: 16,
            marginBottom: 20,
            shadowColor: '#3B82F6',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            elevation: 3
          }}
        >
          <Ionicons name="sparkles" size={20} color="#3B82F6" style={{ marginRight: 8 }} />
          <Text style={{
            color: '#3B82F6',
            fontSize: 16,
            fontWeight: '600'
          }}>
            Daily AI Sports Report
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#3B82F6" style={{ marginLeft: 8 }} />
        </TouchableOpacity>

        {/* Search Mode Toggle */}
        <View style={{
          flexDirection: 'row',
          backgroundColor: '#1F2937',
          borderRadius: 12,
          padding: 4,
          marginBottom: 20,
          borderWidth: 1,
          borderColor: '#374151'
        }}>
          <TouchableOpacity
            onPress={() => {
              setSearchMode('players');
              setSearchQuery('');
            }}
            style={{
              flex: 1,
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: 8,
              backgroundColor: searchMode === 'players' ? '#3B82F6' : 'transparent',
              alignItems: 'center'
            }}
          >
            <Text style={{
              color: searchMode === 'players' ? '#FFFFFF' : '#9CA3AF',
              fontWeight: searchMode === 'players' ? '600' : '500',
              fontSize: 15
            }}>
              👤 Players
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setSearchMode('teams');
              setSearchQuery('');
            }}
            style={{
              flex: 1,
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: 8,
              backgroundColor: searchMode === 'teams' ? '#3B82F6' : 'transparent',
              alignItems: 'center'
            }}
          >
            <Text style={{
              color: searchMode === 'teams' ? '#FFFFFF' : '#9CA3AF',
              fontWeight: searchMode === 'teams' ? '600' : '500',
              fontSize: 15
            }}>
              🏟️ Teams
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sport Filter Chips - Animated and Compact */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <View style={{ 
            flexDirection: 'row', 
            flexWrap: 'wrap',
            marginBottom: 20,
            gap: 8
          }}>
            {sports.map((sport) => (
              <TouchableOpacity
                key={sport.key}
                onPress={() => setSelectedSport(sport.key)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 16,
                  backgroundColor: selectedSport === sport.key ? '#3B82F6' : '#1F2937',
                  borderWidth: 1,
                  borderColor: selectedSport === sport.key ? '#60A5FA' : '#374151',
                  shadowColor: selectedSport === sport.key ? '#3B82F6' : 'transparent',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: selectedSport === sport.key ? 0.3 : 0,
                  shadowRadius: 4,
                  elevation: selectedSport === sport.key ? 4 : 0
                }}
              >
                <Text style={{
                  color: selectedSport === sport.key ? '#FFFFFF' : '#9CA3AF',
                  fontWeight: selectedSport === sport.key ? '600' : '500',
                  fontSize: 13
                }}>
                  {sport.icon} {sport.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* Enhanced Search Bar */}
        <View style={{
          backgroundColor: '#1F2937',
          borderRadius: 16,
          marginBottom: keyboardVisible ? 12 : 20,
          borderWidth: 1.5,
          borderColor: searchQuery.length > 0 ? '#3B82F6' : '#374151',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 4
        }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 14
          }}>
            <Ionicons 
              name="search" 
              size={20} 
              color={searchQuery.length > 0 ? '#3B82F6' : '#9CA3AF'} 
              style={{ marginRight: 12 }} 
            />
            <TextInput
              ref={searchRef}
              style={{
                flex: 1,
                color: '#FFFFFF',
                fontSize: 16,
                fontWeight: '500'
              }}
              placeholder={searchMode === 'players' 
                ? "Search any player (Aaron Judge, Caitlin Clark...)" 
                : "Search any team (Yankees, Lakers, Chiefs...)"
              }
              placeholderTextColor="#6B7280"
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                console.log('Search query changed:', text);
              }}
              returnKeyType="search"
              onSubmitEditing={() => {
                const q = searchQuery.trim();
                if (q.length >= 2) {
                  if (searchMode === 'players') {
                    searchPlayers(q);
                  } else {
                    searchTeams(q);
                  }
                }
              }}
              autoCapitalize="words"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={clearSearch} style={{ marginLeft: 8 }}>
                <Ionicons name="close-circle" size={20} color="#6B7280" />
              </TouchableOpacity>
            )}
            {isSearching && (
              <ActivityIndicator size="small" color="#3B82F6" style={{ marginLeft: 8 }} />
            )}
          </View>
        </View>

        {/* Search Loading */}
        {isSearching && searchQuery.length >= 2 && (
          <View style={{
            backgroundColor: '#1F2937',
            borderRadius: 12,
            padding: 20,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: '#374151',
            alignItems: 'center'
          }}>
            <ActivityIndicator size="small" color="#3B82F6" />
            <Text style={{
              color: '#9CA3AF',
              marginTop: 8,
              fontSize: 14
            }}>
              Searching for "{searchQuery}"...
            </Text>
          </View>
        )}

        {/* Search Results with Pull to Refresh */}
        <ScrollView 
          style={{ flex: 1 }} 
          showsVerticalScrollIndicator={false} 
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#3B82F6"
              colors={['#3B82F6']}
            />
          }
          contentInsetAdjustmentBehavior="automatic"
        >
          {searchQuery.length >= 2 && getCurrentResults().length > 0 && !isSearching && (
            <View style={{ marginBottom: 24 }}>
              <Text style={{
                fontSize: 18,
                fontWeight: '600',
                color: '#FFFFFF',
                marginBottom: 12
              }}>
                Search Results ({getCurrentResults().length})
              </Text>
              {searchMode === 'players' && playerResults.map((player, index) => (
                <TouchableOpacity
                  key={player.id}
                  onPress={() => selectPlayer(player)}
                  style={{
                    backgroundColor: '#1F2937',
                    borderRadius: 16,
                    padding: 18,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: '#374151',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 2
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {/* Player Headshot */}
                    <View style={{
                      position: 'relative',
                      marginRight: 14
                    }}>
                      {player.has_headshot && player.headshot_url ? (
                        <View style={{
                          width: 56,
                          height: 56,
                          borderRadius: 28,
                          borderWidth: 2,
                          borderColor: getSportColor(player.sport),
                          shadowColor: getSportColor(player.sport),
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.3,
                          shadowRadius: 4,
                          elevation: 4
                        }}>
                          <Image
                            source={{ uri: player.headshot_url }}
                            style={{
                              width: 52,
                              height: 52,
                              borderRadius: 26,
                              backgroundColor: '#374151'
                            }}
                            onError={() => {
                              console.log('Failed to load headshot for', player.name);
                            }}
                          />
                          {/* Sport indicator */}
                          <View style={{
                            position: 'absolute',
                            bottom: -1,
                            right: -1,
                            width: 18,
                            height: 18,
                            borderRadius: 9,
                            backgroundColor: getSportColor(player.sport),
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 2,
                            borderColor: '#1F2937'
                          }}>
                            <Text style={{
                              color: '#FFFFFF',
                              fontSize: 8,
                              fontWeight: 'bold'
                            }}>
                              {player.sport === 'MLB' ? '⚾' : player.sport === 'WNBA' ? '🏀' : '🏈'}
                            </Text>
                          </View>
                        </View>
                      ) : (
                        /* Fallback for players without headshots */
                        <View style={{
                          width: 56,
                          height: 56,
                          borderRadius: 28,
                          borderWidth: 2,
                          borderColor: getSportColor(player.sport),
                          backgroundColor: '#374151',
                          alignItems: 'center',
                          justifyContent: 'center',
                          shadowColor: getSportColor(player.sport),
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.3,
                          shadowRadius: 4,
                          elevation: 4
                        }}>
                          <Ionicons 
                            name="person" 
                            size={24} 
                            color="#9CA3AF" 
                          />
                          {/* Sport indicator */}
                          <View style={{
                            position: 'absolute',
                            bottom: -1,
                            right: -1,
                            width: 18,
                            height: 18,
                            borderRadius: 9,
                            backgroundColor: getSportColor(player.sport),
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 2,
                            borderColor: '#1F2937'
                          }}>
                            <Text style={{
                              color: '#FFFFFF',
                              fontSize: 8,
                              fontWeight: 'bold'
                            }}>
                              {player.sport === 'MLB' ? '⚾' : player.sport === 'WNBA' ? '🏀' : '🏈'}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>

                    {/* Player Info */}
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                        <Text style={{
                          fontSize: 17,
                          fontWeight: '700',
                          color: '#FFFFFF'
                        }}>
                          {player.name}
                        </Text>
                        {index === 0 && playerResults.length > 1 && (
                          <View style={{
                            backgroundColor: '#059669',
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 8,
                            marginLeft: 8
                          }}>
                            <Text style={{
                              color: '#FFFFFF',
                              fontSize: 10,
                              fontWeight: '600'
                            }}>
                              TOP MATCH
                            </Text>
                          </View>
                        )}
                      </View>
                      
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                        <View style={{
                          backgroundColor: getSportColor(player.sport),
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 6,
                          marginRight: 10
                        }}>
                          <Text style={{
                            color: '#FFFFFF',
                            fontSize: 11,
                            fontWeight: '700'
                          }}>
                            {player.sport}
                          </Text>
                        </View>
                        <Text style={{
                          color: '#D1D5DB',
                          fontSize: 15,
                          fontWeight: '600'
                        }}>
                          {player.team}
                        </Text>
                        {player.position && (
                          <Text style={{
                            color: '#9CA3AF',
                            fontSize: 14,
                            marginLeft: 8
                          }}>
                            • {player.position}
                          </Text>
                        )}
                      </View>
                      
                      {player.recent_games_count > 0 ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="stats-chart" size={14} color="#10B981" />
                          <Text style={{
                            color: '#10B981',
                            fontSize: 13,
                            marginLeft: 4,
                            fontWeight: '600'
                          }}>
                            {player.recent_games_count} recent games with stats
                          </Text>
                        </View>
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="information-circle" size={14} color="#F59E0B" />
                          <Text style={{
                            color: '#F59E0B',
                            fontSize: 13,
                            marginLeft: 4,
                            fontWeight: '500'
                          }}>
                            Limited recent data available
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Chevron */}
                    <TouchableOpacity 
                      style={{
                        backgroundColor: '#374151',
                        borderRadius: 12,
                        padding: 8,
                        marginLeft: 12
                      }}
                      onPress={() => selectPlayer(player)}
                    >
                      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
              {searchMode === 'teams' && teamResults.map((team, index) => (
                <TouchableOpacity
                  key={team.id}
                  onPress={() => selectTeam(team)}
                  style={{
                    backgroundColor: '#1F2937',
                    borderRadius: 16,
                    padding: 18,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: '#374151',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 2
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {/* Team Logo */}
                    <View style={{
                      position: 'relative',
                      marginRight: 14
                    }}>
                      {team.logo_url ? (
                        <View style={{
                          width: 56,
                          height: 56,
                          borderRadius: 28,
                          borderWidth: 2,
                          borderColor: getSportColor(team.sport),
                          shadowColor: getSportColor(team.sport),
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.3,
                          shadowRadius: 4,
                          elevation: 4,
                          backgroundColor: '#FFFFFF'
                        }}>
                          <Image
                            source={{ uri: team.logo_url }}
                            style={{
                              width: 52,
                              height: 52,
                              borderRadius: 26,
                              backgroundColor: '#FFFFFF'
                            }}
                            onError={() => {
                              console.log('Failed to load logo for', team.name);
                            }}
                          />
                          {/* Sport indicator */}
                          <View style={{
                            position: 'absolute',
                            bottom: -1,
                            right: -1,
                            width: 18,
                            height: 18,
                            borderRadius: 9,
                            backgroundColor: getSportColor(team.sport),
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 2,
                            borderColor: '#1F2937'
                          }}>
                            <Text style={{
                              color: '#FFFFFF',
                              fontSize: 8,
                              fontWeight: 'bold'
                            }}>
                              {team.sport === 'MLB' ? '⚾' : team.sport === 'WNBA' || team.sport === 'NBA' ? '🏀' : '🏈'}
                            </Text>
                          </View>
                        </View>
                      ) : (
                        /* Fallback for teams without logos */
                        <View style={{
                          width: 56,
                          height: 56,
                          borderRadius: 28,
                          borderWidth: 2,
                          borderColor: getSportColor(team.sport),
                          backgroundColor: '#374151',
                          alignItems: 'center',
                          justifyContent: 'center',
                          shadowColor: getSportColor(team.sport),
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.3,
                          shadowRadius: 4,
                          elevation: 4
                        }}>
                          <Text style={{
                            color: '#FFFFFF',
                            fontSize: 16,
                            fontWeight: 'bold'
                          }}>
                            {team.abbreviation}
                          </Text>
                          {/* Sport indicator */}
                          <View style={{
                            position: 'absolute',
                            bottom: -1,
                            right: -1,
                            width: 18,
                            height: 18,
                            borderRadius: 9,
                            backgroundColor: getSportColor(team.sport),
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 2,
                            borderColor: '#1F2937'
                          }}>
                            <Text style={{
                              color: '#FFFFFF',
                              fontSize: 8,
                              fontWeight: 'bold'
                            }}>
                              {team.sport === 'MLB' ? '⚾' : team.sport === 'WNBA' || team.sport === 'NBA' ? '🏀' : '🏈'}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>

                    {/* Team Info */}
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                        <Text style={{
                          fontSize: 17,
                          fontWeight: '700',
                          color: '#FFFFFF'
                        }}>
                          {team.name}
                        </Text>
                        {index === 0 && teamResults.length > 1 && (
                          <View style={{
                            backgroundColor: '#059669',
                            paddingHorizontal: 6,
                            paddingVertical: 2,
                            borderRadius: 8,
                            marginLeft: 8
                          }}>
                            <Text style={{
                              color: '#FFFFFF',
                              fontSize: 10,
                              fontWeight: '600'
                            }}>
                              TOP MATCH
                            </Text>
                          </View>
                        )}
                      </View>
                      
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                        <View style={{
                          backgroundColor: getSportColor(team.sport),
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 6,
                          marginRight: 10
                        }}>
                          <Text style={{
                            color: '#FFFFFF',
                            fontSize: 11,
                            fontWeight: '700'
                          }}>
                            {team.sport}
                          </Text>
                        </View>
                        <Text style={{
                          color: '#D1D5DB',
                          fontSize: 15,
                          fontWeight: '600'
                        }}>
                          {team.city}
                        </Text>
                      </View>
                      
                      {team.recent_games_count > 0 ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="stats-chart" size={14} color="#10B981" />
                          <Text style={{
                            color: '#10B981',
                            fontSize: 13,
                            marginLeft: 4,
                            fontWeight: '600'
                          }}>
                            {team.recent_games_count} recent games with stats
                          </Text>
                        </View>
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="information-circle" size={14} color="#F59E0B" />
                          <Text style={{
                            color: '#F59E0B',
                            fontSize: 13,
                            marginLeft: 4,
                            fontWeight: '500'
                          }}>
                            Limited recent data available
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Chevron */}
                    <TouchableOpacity 
                      style={{
                        backgroundColor: '#374151',
                        borderRadius: 12,
                        padding: 8,
                        marginLeft: 12
                      }}
                      onPress={() => selectTeam(team)}
                    >
                      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Recent Searches */}
          {getCurrentRecentSearches().length > 0 && searchQuery.length < 2 && (
            <View style={{ marginBottom: 24 }}>
              <Text style={{
                fontSize: 18,
                fontWeight: '600',
                color: '#FFFFFF',
                marginBottom: 12
              }}>
                Recent Searches
              </Text>
              {searchMode === 'players' && recentPlayerSearches.map((player) => (
                <TouchableOpacity
                  key={player.id}
                  onPress={() => selectPlayer(player as PlayerSearchResult)}
                  style={{
                    backgroundColor: '#1F2937',
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: '#374151'
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                      <Text style={{
                        fontSize: 16,
                        fontWeight: '600',
                        color: '#FFFFFF',
                        marginBottom: 4
                      }}>
                        {player.name}
                      </Text>
                      <Text style={{
                        color: '#9CA3AF',
                        fontSize: 14
                      }}>
                        {player.team} • {player.sport}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#6B7280" />
                  </View>
                </TouchableOpacity>
              ))}
              {searchMode === 'teams' && recentTeamSearches.map((team) => (
                <TouchableOpacity
                  key={team.id}
                  onPress={() => selectTeam(team as TeamSearchResult)}
                  style={{
                    backgroundColor: '#1F2937',
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: '#374151'
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                      <Text style={{
                        fontSize: 16,
                        fontWeight: '600',
                        color: '#FFFFFF',
                        marginBottom: 4
                      }}>
                        {team.name}
                      </Text>
                      <Text style={{
                        color: '#9CA3AF',
                        fontSize: 14
                      }}>
                        {team.city} • {team.sport}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#6B7280" />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Empty State */}
          {searchQuery.length >= 2 && getCurrentResults().length === 0 && !isSearching && (
            <View style={{
              backgroundColor: '#1F2937',
              borderRadius: 12,
              padding: 24,
              alignItems: 'center',
              marginBottom: 20
            }}>
              <Ionicons name="search" size={48} color="#6B7280" style={{ marginBottom: 12 }} />
              <Text style={{
                fontSize: 18,
                fontWeight: '600',
                color: '#FFFFFF',
                marginBottom: 8,
                textAlign: 'center'
              }}>
                No {searchMode === 'players' ? 'Players' : 'Teams'} Found
              </Text>
              <Text style={{
                fontSize: 14,
                color: '#9CA3AF',
                textAlign: 'center',
                lineHeight: 20
              }}>
                Try adjusting your search terms or check a different sport filter
              </Text>
            </View>
          )}

          {/* Instructions */}
          {searchQuery.length < 2 && getCurrentRecentSearches().length === 0 && (
            <View style={{
              backgroundColor: '#1F2937',
              borderRadius: 12,
              padding: 24,
              alignItems: 'center'
            }}>
              <LinearGradient
                colors={['#3B82F6', '#1D4ED8']}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16
                }}
              >
                <Ionicons name="trending-up" size={32} color="#FFFFFF" />
              </LinearGradient>
              <Text style={{
                fontSize: 20,
                fontWeight: 'bold',
                color: '#FFFFFF',
                marginBottom: 8,
                textAlign: 'center'
              }}>
                Discover {searchMode === 'players' ? 'Player' : 'Team'} Trends
              </Text>
              <Text style={{
                fontSize: 16,
                color: '#9CA3AF',
                textAlign: 'center',
                lineHeight: 22,
                marginBottom: 20
              }}>
                Search for any {searchMode === 'players' ? 'player' : 'team'} to see their last 10 games performance with detailed analytics and visual charts
              </Text>
              <View style={{
                backgroundColor: '#111827',
                borderRadius: 8,
                padding: 16,
                width: '100%'
              }}>
                <Text style={{
                  fontSize: 14,
                  color: '#F59E0B',
                  fontWeight: '600',
                  marginBottom: 8
                }}>
                  Features:
                </Text>
                <Text style={{ color: '#D1D5DB', fontSize: 14, marginBottom: 4 }}>
                  • Visual charts for last 10 games
                </Text>
                <Text style={{ color: '#D1D5DB', fontSize: 14, marginBottom: 4 }}>
                  • Prop line analysis with over/under
                </Text>
                <Text style={{ color: '#D1D5DB', fontSize: 14, marginBottom: 4 }}>
                  • Multi-sport support (MLB, WNBA, NFL, UFC)
                </Text>
                <Text style={{ color: '#D1D5DB', fontSize: 14 }}>
                  • Performance trends and insights
                </Text>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
      </KeyboardAvoidingView>

      {/* Player Trends Modal */}
      <PlayerTrendsModal
        visible={playerModalVisible}
        player={selectedPlayer}
        onClose={() => setPlayerModalVisible(false)}
      />
      
      {/* Team Trends Modal */}
      <TeamTrendsModal
        visible={teamModalVisible}
        team={selectedTeam}
        onClose={() => setTeamModalVisible(false)}
      />
      
      {/* AI Report Modal */}
      <AIReportModal
        visible={aiReportModalVisible}
        onClose={() => setAiReportModalVisible(false)}
        onUpgrade={() => {
          setAiReportModalVisible(false);
          // Open subscription modal here if you have one in trends
          Alert.alert('Upgrade to Pro', 'Get access to full AI reports and advanced features!', [
            { text: 'Maybe Later', style: 'cancel' },
            { text: 'Upgrade Now', onPress: () => {
              // Navigate to subscription page or open subscription modal
              console.log('Opening subscription modal...');
            }}
          ]);
        }}
      />
    </SafeAreaView>
  );
}
