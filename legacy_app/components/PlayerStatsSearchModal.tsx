import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';

interface Player {
  id: string;
  name: string;
  team: string;
  sport: string;
  position?: string;
}

interface PlayerStatsSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onPlayerSelect: (player: Player) => void;
}

export const PlayerStatsSearchModal: React.FC<PlayerStatsSearchModalProps> = ({
  visible,
  onClose,
  onPlayerSelect,
}) => {
  const { colors } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSport, setSelectedSport] = useState<'all' | 'MLB' | 'WNBA'>('all');

  const searchPlayers = async (query: string) => {
    if (query.length < 2) {
      setPlayers([]);
      return;
    }

    setLoading(true);
    try {
      const sportFilter = selectedSport === 'all' ? '' : `&sport=${selectedSport}`;
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/players/search?query=${encodeURIComponent(query)}${sportFilter}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setPlayers(data.players || []);
      } else {
        Alert.alert('Error', 'Failed to search players');
      }
    } catch (error) {
      console.error('Player search error:', error);
      Alert.alert('Error', 'Network error while searching');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      searchPlayers(searchQuery);
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, selectedSport]);

  const handlePlayerSelect = (player: Player) => {
    onPlayerSelect(player);
    onClose();
    setSearchQuery('');
    setPlayers([]);
  };

  const renderPlayer = ({ item }: { item: Player }) => (
    <TouchableOpacity
      style={[styles.playerItem, { borderBottomColor: colors.border }]}
      onPress={() => handlePlayerSelect(item)}
    >
      <View style={styles.playerInfo}>
        <Text style={[styles.playerName, { color: colors.text }]}>
          {item.name}
        </Text>
        <View style={styles.playerMeta}>
          <Text style={[styles.playerTeam, { color: colors.text }]}>
            {item.team}
          </Text>
          <View style={[
            styles.sportBadge, 
            { backgroundColor: item.sport === 'MLB' ? '#1B4332' : '#6F2DA8' }
          ]}>
            <Text style={styles.sportText}>{item.sport}</Text>
          </View>
          {item.position && (
            <Text style={[styles.playerPosition, { color: colors.text }]}>
              {item.position}
            </Text>
          )}
        </View>
      </View>
      <Ionicons 
        name="chevron-forward" 
        size={20} 
        color={colors.text} 
        style={{ opacity: 0.6 }}
      />
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity 
            style={styles.closeButton}
            onPress={onClose}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Search Players
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Sport Filter */}
        <View style={styles.sportFilter}>
          {(['all', 'MLB', 'WNBA'] as const).map((sport) => (
            <TouchableOpacity
              key={sport}
              style={[
                styles.sportButton,
                selectedSport === sport && styles.sportButtonActive,
                { borderColor: colors.border }
              ]}
              onPress={() => setSelectedSport(sport)}
            >
              <Text style={[
                styles.sportButtonText,
                { color: selectedSport === sport ? '#FFFFFF' : colors.text }
              ]}>
                {sport === 'all' ? 'All Sports' : sport}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Search Input */}
        <View style={[styles.searchContainer, { borderColor: colors.border }]}>
          <Ionicons 
            name="search" 
            size={20} 
            color={colors.text} 
            style={{ opacity: 0.6 }}
          />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search for any player..."
            placeholderTextColor={colors.text + '60'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {loading && <ActivityIndicator size="small" color="#4CAF50" />}
        </View>

        {/* Results */}
        <FlatList
          data={players}
          renderItem={renderPlayer}
          keyExtractor={(item) => item.id}
          style={styles.resultsList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            searchQuery.length >= 2 && !loading ? (
              <View style={styles.emptyState}>
                <Ionicons 
                  name="search" 
                  size={48} 
                  color={colors.text} 
                  style={{ opacity: 0.3 }}
                />
                <Text style={[styles.emptyText, { color: colors.text }]}>
                  No players found for "{searchQuery}"
                </Text>
                <Text style={[styles.emptySubtext, { color: colors.text }]}>
                  Try a different name or check spelling
                </Text>
              </View>
            ) : searchQuery.length < 2 ? (
              <View style={styles.emptyState}>
                <Ionicons 
                  name="people" 
                  size={48} 
                  color={colors.text} 
                  style={{ opacity: 0.3 }}
                />
                <Text style={[styles.emptyText, { color: colors.text }]}>
                  Search for Players
                </Text>
                <Text style={[styles.emptySubtext, { color: colors.text }]}>
                  Enter at least 2 characters to start searching
                </Text>
              </View>
            ) : null
          }
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  sportFilter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    gap: 10,
  },
  sportButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  sportButtonActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  sportButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 20,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  resultsList: {
    flex: 1,
  },
  playerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  playerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playerTeam: {
    fontSize: 14,
    fontWeight: '500',
  },
  sportBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sportText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  playerPosition: {
    fontSize: 12,
    opacity: 0.7,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    opacity: 0.7,
  },
});
