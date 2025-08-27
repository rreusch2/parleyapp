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
  RefreshControl
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
  const [refreshing, setRefreshing] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const searchRef = useRef<TextInput>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const sports = [
    { key: 'all', name: 'All', icon: '🏆' },
    { key: 'Major League Baseball', name: 'MLB', icon: '⚾' },
    { key: "Women's National Basketball Association", name: 'WNBA', icon: '🏀' },
    { key: 'National Basketball Association', name: 'NBA', icon: '🏀' },
    { key: 'National Football League', name: 'NFL', icon: '🏈' },
    { key: 'Ultimate Fighting Championship', name: 'UFC', icon: '🥊' }
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
        console.log('Triggering search for:', q); // Debug log
        searchPlayers(q);
      } else if (q.length === 0) {
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
    Keyboard.dismiss();
    setSelectedPlayer(player);
    setModalVisible(true);
    
    // Add to recent searches
    setRecentSearches(prev => {
      const filtered = prev.filter(p => p.id !== player.id);
      return [player, ...filtered].slice(0, 5);
    });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (searchQuery.trim().length >= 2) {
      await searchPlayers(searchQuery.trim());
    }
    setRefreshing(false);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    searchRef.current?.blur();
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
              placeholder="Search any player (Aaron Judge, Caitlin Clark...)"
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
                  searchPlayers(q);
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
              {searchResults.map((player, index) => (
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
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                        <Text style={{
                          fontSize: 17,
                          fontWeight: '700',
                          color: '#FFFFFF'
                        }}>
                          {player.name}
                        </Text>
                        {index === 0 && searchResults.length > 1 && (
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
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 8,
                          marginRight: 12
                        }}>
                          <Text style={{
                            color: '#FFFFFF',
                            fontSize: 12,
                            fontWeight: '700'
                          }}>
                            {player.sport}
                          </Text>
                        </View>
                        <Text style={{
                          color: '#D1D5DB',
                          fontSize: 15,
                          fontWeight: '500'
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
      </KeyboardAvoidingView>

      {/* Player Trends Modal */}
      <PlayerTrendsModal
        visible={modalVisible}
        player={selectedPlayer}
        onClose={() => setModalVisible(false)}
      />
    </SafeAreaView>
  );
}
