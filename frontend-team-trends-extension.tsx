/**
 * Team Trends Search Extension
 * Extends the existing trends search to support both players and teams
 * Integrates with the new team_recent_stats table and TheOdds API data
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { supabase } from '../config/supabase';

interface TeamTrendData {
  team_id: string;
  team_name: string;
  team_abbreviation: string;
  city: string;
  sport_key: string;
  wins: number;
  losses: number;
  win_percentage: number;
  ats_percentage: number;
  avg_margin: number;
  trend_indicator: string;
}

interface TeamGameData {
  game_date: string;
  opponent: string;
  is_home: boolean;
  team_score: number;
  opponent_score: number;
  game_result: string;
  margin: number;
}

// Extended TrendsModal to support both players and teams
const EnhancedTrendsModal = ({ visible, onClose, searchType = 'players' }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [entityType, setEntityType] = useState('players'); // 'players' or 'teams'
  const [selectedSport, setSelectedSport] = useState('MLB');
  const [selectedTrendType, setSelectedTrendType] = useState('wins');

  // Team trend types
  const teamTrendTypes = [
    { key: 'wins', label: 'Wins', prop: 'game_result' },
    { key: 'ats_covers', label: 'ATS Covers', prop: 'spread_result' },
    { key: 'total_points', label: 'Points Scored', prop: 'team_score' },
    { key: 'over_under', label: 'Over/Under', prop: 'total_results' },
    { key: 'home_performance', label: 'Home Games', prop: 'is_home' },
    { key: 'road_performance', label: 'Road Games', prop: 'is_home' }
  ];

  const sports = ['MLB', 'NFL', 'NBA', 'WNBA', 'NHL'];

  useEffect(() => {
    if (searchQuery.length >= 2) {
      if (entityType === 'teams') {
        searchTeams(searchQuery);
      } else {
        searchPlayers(searchQuery);
      }
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, entityType, selectedSport]);

  const searchTeams = async (query: string) => {
    try {
      const { data, error } = await supabase
        .from('team_trends_data')
        .select('*')
        .eq('sport_key', selectedSport)
        .or(`team_name.ilike.%${query}%,city.ilike.%${query}%,team_abbreviation.ilike.%${query}%`)
        .order('win_percentage', { ascending: false })
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Error searching teams:', error);
      setSearchResults([]);
    }
  };

  const searchPlayers = async (query: string) => {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('id, name, team, sport, position')
        .eq('sport', selectedSport)
        .eq('active', true)
        .ilike('name', `%${query}%`)
        .order('name')
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (error) {
      console.error('Error searching players:', error);
      setSearchResults([]);
    }
  };

  const selectEntity = async (entity) => {
    setSelectedEntity(entity);
    
    if (entityType === 'teams') {
      await fetchTeamTrendData(entity.team_id);
    } else {
      await fetchPlayerTrendData(entity.id);
    }
  };

  const fetchTeamTrendData = async (teamId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_team_trend_data', {
        p_team_id: teamId,
        p_trend_type: selectedTrendType,
        p_limit: 10
      });

      if (error) throw error;
      
      // Format data for chart display
      const chartData = {
        recent_games: data?.map(game => ({
          date: game.game_date,
          opponent: game.opponent,
          value: game.trend_value,
          hit: game.hit_trend,
          home: game.is_home
        })) || []
      };

      setSelectedEntity(prev => ({
        ...prev,
        chart_data: chartData,
        trend_type: selectedTrendType
      }));

    } catch (error) {
      console.error('Error fetching team trend data:', error);
    }
  };

  const fetchPlayerTrendData = async (playerId: string) => {
    // Your existing player trend data fetching logic
    // (from your current TrendModal implementation)
  };

  const renderSearchResults = () => {
    return searchResults.map((result, index) => (
      <TouchableOpacity
        key={index}
        style={styles.searchResultItem}
        onPress={() => selectEntity(result)}
      >
        {entityType === 'teams' ? (
          <View style={styles.teamResult}>
            <Text style={styles.teamName}>
              {result.city} {result.team_name}
            </Text>
            <Text style={styles.teamStats}>
              {result.wins}W-{result.losses}L ({result.win_percentage}%)
            </Text>
            <Text style={styles.trendIndicator}>
              {result.trend_indicator.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        ) : (
          <View style={styles.playerResult}>
            <Text style={styles.playerName}>{result.name}</Text>
            <Text style={styles.playerTeam}>{result.team} - {result.position}</Text>
          </View>
        )}
      </TouchableOpacity>
    ));
  };

  const renderTrendChart = () => {
    if (!selectedEntity?.chart_data) return null;

    const chartData = selectedEntity.chart_data.recent_games;
    
    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>
          {entityType === 'teams' 
            ? `${selectedEntity.city} ${selectedEntity.team_name} - ${teamTrendTypes.find(t => t.key === selectedTrendType)?.label}`
            : `${selectedEntity.name} - Recent Performance`
          }
        </Text>
        
        {/* Trend Type Buttons for Teams */}
        {entityType === 'teams' && (
          <ScrollView horizontal style={styles.trendTypeButtons}>
            {teamTrendTypes.map((type) => (
              <TouchableOpacity
                key={type.key}
                style={[
                  styles.trendTypeButton,
                  selectedTrendType === type.key && styles.activeTrendType
                ]}
                onPress={() => {
                  setSelectedTrendType(type.key);
                  fetchTeamTrendData(selectedEntity.team_id);
                }}
              >
                <Text style={[
                  styles.trendTypeText,
                  selectedTrendType === type.key && styles.activeTrendTypeText
                ]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Chart Display */}
        <ScrollView horizontal style={styles.chartScroll}>
          <View style={styles.chartBars}>
            {chartData.map((game, index) => (
              <View key={index} style={styles.gameBar}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: Math.max(20, (game.value / Math.max(...chartData.map(g => g.value))) * 100),
                      backgroundColor: game.hit ? '#4CAF50' : '#FF5252'
                    }
                  ]}
                />
                <Text style={styles.gameDate}>
                  {new Date(game.date).getMonth() + 1}/{new Date(game.date).getDate()}
                </Text>
                <Text style={styles.gameOpponent}>
                  {game.home ? 'vs' : '@'} {game.opponent.slice(0, 3).toUpperCase()}
                </Text>
                <Text style={styles.gameValue}>{game.value}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Performance Summary */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Hit Rate</Text>
            <Text style={styles.summaryValue}>
              {chartData.length > 0 
                ? Math.round((chartData.filter(g => g.hit).length / chartData.length) * 100)
                : 0}%
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Recent Avg</Text>
            <Text style={styles.summaryValue}>
              {chartData.length > 0 
                ? (chartData.reduce((sum, g) => sum + g.value, 0) / chartData.length).toFixed(1)
                : '0.0'}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Last 5 Games</Text>
            <Text style={styles.summaryValue}>
              {chartData.slice(0, 5).filter(g => g.hit).length}/5
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Enhanced Trends Search</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>×</Text>
          </TouchableOpacity>
        </View>

        {/* Entity Type Toggle */}
        <View style={styles.entityTypeToggle}>
          <TouchableOpacity
            style={[styles.toggleButton, entityType === 'players' && styles.activeToggle]}
            onPress={() => setEntityType('players')}
          >
            <Text style={[styles.toggleText, entityType === 'players' && styles.activeToggleText]}>
              Players
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, entityType === 'teams' && styles.activeToggle]}
            onPress={() => setEntityType('teams')}
          >
            <Text style={[styles.toggleText, entityType === 'teams' && styles.activeToggleText]}>
              Teams
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sport Selection */}
        <ScrollView horizontal style={styles.sportSelection}>
          {sports.map(sport => (
            <TouchableOpacity
              key={sport}
              style={[styles.sportButton, selectedSport === sport && styles.activeSport]}
              onPress={() => setSelectedSport(sport)}
            >
              <Text style={[styles.sportText, selectedSport === sport && styles.activeSportText]}>
                {sport}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Search Input */}
        <TextInput
          style={styles.searchInput}
          placeholder={`Search ${entityType === 'teams' ? 'teams' : 'players'}...`}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="words"
        />

        {/* Search Results or Chart */}
        <ScrollView style={styles.content}>
          {selectedEntity ? (
            renderTrendChart()
          ) : (
            <View style={styles.searchResults}>
              {renderSearchResults()}
            </View>
          )}
        </ScrollView>

        {/* Back Button */}
        {selectedEntity && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setSelectedEntity(null)}
          >
            <Text style={styles.backButtonText}>← Back to Search</Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  entityTypeToggle: {
    flexDirection: 'row',
    margin: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeToggle: {
    backgroundColor: '#007AFF',
  },
  toggleText: {
    color: '#666',
    fontWeight: '500',
  },
  activeToggleText: {
    color: '#fff',
  },
  sportSelection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sportButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  activeSport: {
    backgroundColor: '#007AFF',
  },
  sportText: {
    color: '#666',
    fontWeight: '500',
  },
  activeSportText: {
    color: '#fff',
  },
  searchInput: {
    margin: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  searchResults: {
    padding: 16,
  },
  searchResultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  teamResult: {
    flexDirection: 'column',
  },
  teamName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  teamStats: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  trendIndicator: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  playerResult: {
    flexDirection: 'column',
  },
  playerName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  playerTeam: {
    fontSize: 14,
    color: '#666',
  },
  chartContainer: {
    padding: 16,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  trendTypeButtons: {
    marginBottom: 16,
  },
  trendTypeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
  },
  activeTrendType: {
    backgroundColor: '#007AFF',
  },
  trendTypeText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  activeTrendTypeText: {
    color: '#fff',
  },
  chartScroll: {
    marginBottom: 16,
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingVertical: 16,
  },
  gameBar: {
    alignItems: 'center',
    marginRight: 8,
    minWidth: 50,
  },
  bar: {
    width: 20,
    marginBottom: 8,
    borderRadius: 2,
  },
  gameDate: {
    fontSize: 10,
    color: '#666',
    marginBottom: 2,
  },
  gameOpponent: {
    fontSize: 8,
    color: '#999',
    marginBottom: 2,
  },
  gameValue: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  backButton: {
    margin: 16,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#007AFF',
    fontWeight: '500',
  },
});

export default EnhancedTrendsModal;
