import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import PlayerTrendsModal from '../components/PlayerTrendsModal';

interface Player {
  id: string;
  name: string;
  team: string;
  sport: string;
  position?: string;
}

interface PlayerSearchResult extends Player {
  recent_games_count: number;
  last_game_date: string;
}

export default function TrendsScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSport, setSelectedSport] = useState<string>('all');
  const [recentSearches, setRecentSearches] = useState<Player[]>([]);

  const sports = [
    { key: 'all', name: 'All Sports', icon: '🏆' },
    { key: 'MLB', name: 'MLB', icon: '⚾' },
    { key: 'WNBA', name: 'WNBA', icon: '🏀' },
    { key: 'NBA', name: 'NBA', icon: '🏀' },
    { key: 'NFL', name: 'NFL', icon: '🏈' },
    { key: 'UFC', name: 'UFC', icon: '🥊' }
  ];

  useEffect(() => {
    loadRecentSearches();
  }, []);

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (searchQuery.length >= 2) {
        console.log('Triggering search for:', searchQuery); // Debug log
        searchPlayers(searchQuery);
      } else if (searchQuery.length === 0) {
        setSearchResults([]);
      }
    }, 300); // Debounce search

    return () => clearTimeout(delayedSearch);
  }, [searchQuery, selectedSport]);

  const loadRecentSearches = async () => {
    // Load from AsyncStorage or recent database queries
    // For now, we'll implement basic recent searches
  };

  const searchPlayers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      console.log('Searching players with backend API:', query, selectedSport); // Debug log
      
      // Use backend API instead of direct Supabase queries for better mobile compatibility
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://zooming-rebirth-production-a305.up.railway.app';
      
      const sportFilter = selectedSport === 'all' ? '' : `&sport=${selectedSport}`;
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

        setSearchResults(sortedData);
      } else {
        console.warn('No players array in response:', data);
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Search Error', `Failed to search players: ${error instanceof Error ? error.message : 'Network error'}`);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const selectPlayer = (player: PlayerSearchResult) => {
    setSelectedPlayer(player);
    setModalVisible(true);
    
    // Add to recent searches
    setRecentSearches(prev => {
      const filtered = prev.filter(p => p.id !== player.id);
      return [player, ...filtered].slice(0, 5);
    });
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
      <View style={{ padding: 20, paddingTop: 10 }}>
        {/* Header */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ 
            fontSize: 28, 
            fontWeight: 'bold', 
            color: '#FFFFFF', 
            marginBottom: 8 
          }}>
            Player Trends
          </Text>
          <Text style={{ 
            fontSize: 16, 
            color: '#9CA3AF',
            lineHeight: 22
          }}>
            Search any player to see their last 10 games performance with prop line analysis
          </Text>
        </View>

        {/* Sport Filter Tabs */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 20 }}
          contentContainerStyle={{ paddingHorizontal: 4 }}
        >
          {sports.map((sport) => (
            <TouchableOpacity
              key={sport.key}
              onPress={() => setSelectedSport(sport.key)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                marginRight: 12,
                borderRadius: 20,
                backgroundColor: selectedSport === sport.key ? '#3B82F6' : '#1F2937',
                borderWidth: 1,
                borderColor: selectedSport === sport.key ? '#3B82F6' : '#374151'
              }}
            >
              <Text style={{
                color: selectedSport === sport.key ? '#FFFFFF' : '#9CA3AF',
                fontWeight: selectedSport === sport.key ? '600' : 'normal',
                fontSize: 14
              }}>
                {sport.icon} {sport.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Search Bar */}
        <View style={{
          backgroundColor: '#1F2937',
          borderRadius: 12,
          marginBottom: 20,
          borderWidth: 1,
          borderColor: '#374151'
        }}>
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingVertical: 12
          }}>
            <Ionicons name="search" size={20} color="#9CA3AF" style={{ marginRight: 12 }} />
            <TextInput
              style={{
                flex: 1,
                color: '#FFFFFF',
                fontSize: 16,
                fontWeight: '500'
              }}
              placeholder="Search for any player..."
              placeholderTextColor="#6B7280"
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                console.log('Search query changed:', text); // Debug log
              }}
              returnKeyType="search"
              onSubmitEditing={() => {
                if (searchQuery.length >= 2) {
                  searchPlayers(searchQuery);
                }
              }}
              autoCapitalize="words"
              autoCorrect={false}
            />
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

        {/* Search Results */}
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {searchQuery.length >= 2 && searchResults.length > 0 && !isSearching && (
            <View style={{ marginBottom: 24 }}>
              <Text style={{
                fontSize: 18,
                fontWeight: '600',
                color: '#FFFFFF',
                marginBottom: 12
              }}>
                Search Results ({searchResults.length})
              </Text>
              {searchResults.map((player) => (
                <TouchableOpacity
                  key={player.id}
                  onPress={() => selectPlayer(player)}
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
                    <View style={{ flex: 1 }}>
                      <Text style={{
                        fontSize: 16,
                        fontWeight: '600',
                        color: '#FFFFFF',
                        marginBottom: 4
                      }}>
                        {player.name}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{
                          backgroundColor: getSportColor(player.sport),
                          paddingHorizontal: 8,
                          paddingVertical: 2,
                          borderRadius: 6,
                          marginRight: 8
                        }}>
                          <Text style={{
                            color: '#FFFFFF',
                            fontSize: 12,
                            fontWeight: '600'
                          }}>
                            {player.sport}
                          </Text>
                        </View>
                        <Text style={{
                          color: '#9CA3AF',
                          fontSize: 14
                        }}>
                          {player.team} • {player.position || 'Player'}
                        </Text>
                      </View>
                      {player.recent_games_count > 0 && (
                        <Text style={{
                          color: '#10B981',
                          fontSize: 12,
                          marginTop: 4
                        }}>
                          {player.recent_games_count} recent games available
                        </Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#6B7280" />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* No Results */}
          {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
            <View style={{
              backgroundColor: '#1F2937',
              borderRadius: 12,
              padding: 20,
              marginBottom: 20,
              borderWidth: 1,
              borderColor: '#374151',
              alignItems: 'center'
            }}>
              <Ionicons name="search-outline" size={48} color="#6B7280" />
              <Text style={{
                color: '#FFFFFF',
                fontSize: 16,
                fontWeight: '600',
                marginTop: 12,
                textAlign: 'center'
              }}>
                No players found
              </Text>
              <Text style={{
                color: '#9CA3AF',
                fontSize: 14,
                marginTop: 4,
                textAlign: 'center'
              }}>
                Try searching for a different player name
              </Text>
            </View>
          )}

          {/* Recent Searches */}
          {recentSearches.length > 0 && searchQuery.length < 2 && (
            <View style={{ marginBottom: 24 }}>
              <Text style={{
                fontSize: 18,
                fontWeight: '600',
                color: '#FFFFFF',
                marginBottom: 12
              }}>
                Recent Searches
              </Text>
              {recentSearches.map((player) => (
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
            </View>
          )}

          {/* Empty State */}
          {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
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
                No Players Found
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
          {searchQuery.length < 2 && recentSearches.length === 0 && (
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
                Discover Player Trends
              </Text>
              <Text style={{
                fontSize: 16,
                color: '#9CA3AF',
                textAlign: 'center',
                lineHeight: 22,
                marginBottom: 20
              }}>
                Search for any player to see their last 10 games performance with detailed prop analysis and visual charts
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

      {/* Player Trends Modal */}
      <PlayerTrendsModal
        visible={modalVisible}
        player={selectedPlayer}
        onClose={() => setModalVisible(false)}
      />
    </SafeAreaView>
  );
}
