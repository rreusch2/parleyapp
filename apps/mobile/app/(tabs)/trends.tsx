import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  ActivityIndicator,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import EnhancedTrendsList from '../components/EnhancedTrendsList';
import PlayerTrendsModal from '../components/PlayerTrendsModal';
import AIReportModal from '../components/AIReportModal';
import { useSubscription } from '../services/subscriptionContext';
import { useUITheme } from '../services/uiThemeContext';
import { trendsService, TrendData } from '../services/trendsService';

interface Player {
  id: string;
  name: string;
  team: string;
  sport: string;
  position?: string;
  headshot_url?: string;
  has_headshot?: boolean;
}

export default function TrendsScreen() {
  const { isElite, isPro } = useSubscription();
  const { theme } = useUITheme();
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [playerModalVisible, setPlayerModalVisible] = useState(false);
  const [aiReportModalVisible, setAiReportModalVisible] = useState(false);
  const [picksSlip, setPicksSlip] = useState<TrendData[]>([]);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const handleAddToPicks = async (trend: TrendData) => {
    try {
      // Check if already in picks
      const existingPick = picksSlip.find(pick => pick.id === trend.id);
      if (existingPick) {
        Alert.alert('Already Added', 'This trend is already in your picks slip.');
        return;
      }

      // Add to picks slip
      setPicksSlip(prev => [...prev, trend]);
      
      Alert.alert(
        'Added to Picks!',
        `${trend.player.name} ${trend.market_display_name} has been added to your picks slip.`,
        [
          { text: 'Continue', style: 'default' },
          { 
            text: 'View Picks', 
            style: 'default',
            onPress: () => {
              // Navigate to picks screen or show picks modal
              console.log('Navigate to picks screen');
            }
          }
        ]
      );

    } catch (error) {
      console.error('Error adding to picks:', error);
      Alert.alert('Error', 'Failed to add trend to picks. Please try again.');
    }
  };

  const handleViewDetails = (trend: TrendData) => {
    // Convert trend to player format for modal
    const player: Player = {
      id: trend.player.id,
      name: trend.player.name,
      team: trend.player.team,
      sport: trend.player.sport,
      position: trend.player.position,
      headshot_url: trend.player.headshot_url,
      has_headshot: !!trend.player.headshot_url
    };

    setSelectedPlayer(player);
    setPlayerModalVisible(true);
  };

  const showAIReport = () => {
    if (!isPro && !isElite) {
      Alert.alert(
        'Premium Feature',
        'AI Sports Report is available for Pro and Elite subscribers only.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => console.log('Navigate to subscription') }
        ]
      );
      return;
    }

    setAiReportModalVisible(true);
  };

  const handlePlayerSearch = async (query: string) => {
    setSearchQuery(query);
    
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      const results = await trendsService.searchPlayersWithTrends(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching players:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectPlayer = (player: any) => {
    setSearchModalVisible(false);
    setSearchQuery('');
    setSearchResults([]);
    
    const playerData: Player = {
      id: player.id,
      name: player.name,
      team: player.team,
      sport: player.sport,
      position: player.position,
      headshot_url: player.headshot_url,
      has_headshot: !!player.headshot_url
    };
    
    setSelectedPlayer(playerData);
    setPlayerModalVisible(true);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0B' }}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: '#374151'
        }}>
          <View>
            <Text style={{
              color: '#FFFFFF',
              fontSize: 28,
              fontWeight: '800'
            }}>
              Trends
            </Text>
            <Text style={{
              color: '#9CA3AF',
              fontSize: 14,
              marginTop: 2
            }}>
              AI-powered betting insights
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            {/* Search Button */}
            <TouchableOpacity
              onPress={() => setSearchModalVisible(true)}
              style={{
                backgroundColor: '#374151',
                borderWidth: 1,
                borderColor: '#4B5563',
                borderRadius: 12,
                padding: 12
              }}
            >
              <Ionicons 
                name="search" 
                size={20} 
                color="#9CA3AF" 
              />
            </TouchableOpacity>

            {/* AI Report Button */}
            <TouchableOpacity
              onPress={showAIReport}
              style={{
                backgroundColor: isElite ? `${theme.accentPrimary}1A` : 'rgba(59, 130, 246, 0.2)',
                borderWidth: 1,
                borderColor: isElite ? `${theme.accentPrimary}33` : '#3B82F6',
                borderRadius: 12,
                padding: 12
              }}
            >
              <Ionicons 
                name="sparkles" 
                size={20} 
                color={isElite ? theme.accentPrimary : '#3B82F6'} 
              />
            </TouchableOpacity>

            {/* Picks Slip Indicator */}
            {picksSlip.length > 0 && (
              <TouchableOpacity
                style={{
                  backgroundColor: '#10B981',
                  borderRadius: 12,
                  padding: 12,
                  position: 'relative'
                }}
              >
                <Ionicons name="bookmark" size={20} color="#FFFFFF" />
                <View style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  backgroundColor: '#EF4444',
                  borderRadius: 10,
                  minWidth: 20,
                  height: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 4
                }}>
                  <Text style={{
                    color: '#FFFFFF',
                    fontSize: 11,
                    fontWeight: '700'
                  }}>
                    {picksSlip.length}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Enhanced Trends List */}
        <EnhancedTrendsList
          onAddToPicks={handleAddToPicks}
          onViewDetails={handleViewDetails}
        />

        {/* Modals */}
        <PlayerTrendsModal
          visible={playerModalVisible}
          player={selectedPlayer}
          onClose={() => {
            setPlayerModalVisible(false);
            setSelectedPlayer(null);
          }}
        />

        <AIReportModal
          visible={aiReportModalVisible}
          onClose={() => setAiReportModalVisible(false)}
        />

        {/* Player Search Modal */}
        <Modal
          visible={searchModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setSearchModalVisible(false)}
        >
          <View style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            paddingTop: Platform.OS === 'ios' ? 60 : 40
          }}>
            <View style={{
              flex: 1,
              backgroundColor: '#1F2937',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24
            }}>
              {/* Search Header */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 20,
                paddingVertical: 16,
                borderBottomWidth: 1,
                borderBottomColor: '#374151'
              }}>
                <TouchableOpacity
                  onPress={() => {
                    setSearchModalVisible(false);
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  style={{ marginRight: 16 }}
                >
                  <Ionicons name="close" size={28} color="#9CA3AF" />
                </TouchableOpacity>
                <Text style={{
                  color: '#FFFFFF',
                  fontSize: 20,
                  fontWeight: '700'
                }}>
                  Search Players
                </Text>
              </View>

              {/* Search Input */}
              <View style={{
                paddingHorizontal: 20,
                paddingVertical: 16
              }}>
                <View style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#374151',
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 12
                }}>
                  <Ionicons name="search" size={20} color="#9CA3AF" style={{ marginRight: 12 }} />
                  <TextInput
                    value={searchQuery}
                    onChangeText={handlePlayerSearch}
                    placeholder="Search by player name..."
                    placeholderTextColor="#6B7280"
                    style={{
                      flex: 1,
                      color: '#FFFFFF',
                      fontSize: 16
                    }}
                    autoFocus
                    autoCapitalize="words"
                  />
                  {searchLoading && (
                    <ActivityIndicator size="small" color={isElite ? theme.accentPrimary : '#3B82F6'} />
                  )}
                </View>
              </View>

              {/* Search Results */}
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingBottom: 20 }}
                ListEmptyComponent={
                  searchQuery.length >= 2 && !searchLoading ? (
                    <View style={{
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingVertical: 60
                    }}>
                      <Ionicons name="search-outline" size={64} color="#374151" />
                      <Text style={{
                        color: '#9CA3AF',
                        fontSize: 16,
                        marginTop: 16,
                        textAlign: 'center'
                      }}>
                        No players found
                      </Text>
                      <Text style={{
                        color: '#6B7280',
                        fontSize: 14,
                        marginTop: 8,
                        textAlign: 'center',
                        paddingHorizontal: 40
                      }}>
                        Try searching for a different player name
                      </Text>
                    </View>
                  ) : searchQuery.length < 2 ? (
                    <View style={{
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingVertical: 60
                    }}>
                      <Ionicons name="analytics" size={64} color="#374151" />
                      <Text style={{
                        color: '#9CA3AF',
                        fontSize: 16,
                        marginTop: 16,
                        textAlign: 'center'
                      }}>
                        Start typing to search
                      </Text>
                      <Text style={{
                        color: '#6B7280',
                        fontSize: 14,
                        marginTop: 8,
                        textAlign: 'center',
                        paddingHorizontal: 40
                      }}>
                        Find any player with trend data
                      </Text>
                    </View>
                  ) : null
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => handleSelectPlayer(item)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 20,
                      paddingVertical: 16,
                      borderBottomWidth: 1,
                      borderBottomColor: '#374151'
                    }}
                  >
                    {item.headshot_url ? (
                      <Image
                        source={{ uri: item.headshot_url }}
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 24,
                          marginRight: 16,
                          backgroundColor: '#374151'
                        }}
                      />
                    ) : (
                      <View style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        backgroundColor: '#374151',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 16
                      }}>
                        <Ionicons name="person" size={24} color="#9CA3AF" />
                      </View>
                    )}

                    <View style={{ flex: 1 }}>
                      <Text style={{
                        color: '#FFFFFF',
                        fontSize: 16,
                        fontWeight: '600',
                        marginBottom: 4
                      }}>
                        {item.name}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{
                          color: '#3B82F6',
                          fontSize: 12,
                          fontWeight: '600'
                        }}>
                          {item.sport}
                        </Text>
                        <Text style={{ color: '#6B7280', fontSize: 12 }}>•</Text>
                        <Text style={{
                          color: '#9CA3AF',
                          fontSize: 12
                        }}>
                          {item.team}
                        </Text>
                        {item.position && (
                          <>
                            <Text style={{ color: '#6B7280', fontSize: 12 }}>•</Text>
                            <Text style={{
                              color: '#9CA3AF',
                              fontSize: 12
                            }}>
                              {item.position}
                            </Text>
                          </>
                        )}
                      </View>
                    </View>

                    <Ionicons name="chevron-forward" size={20} color="#6B7280" />
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
