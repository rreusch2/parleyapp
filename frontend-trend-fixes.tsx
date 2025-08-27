// Frontend fixes for TrendModal prop button states and dynamic chart titles
// These changes should be applied to your TrendModal.tsx and related components

// 1. Fix for prop button active state - add to your prop selection component:
interface PropSelectorProps {
  selectedPropType: string;
  onPropTypeChange: (propType: string) => void;
  availableProps: string[];
}

const PropSelector: React.FC<PropSelectorProps> = ({ 
  selectedPropType, 
  onPropTypeChange, 
  availableProps 
}) => {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.propButtonContainer}>
        {availableProps.map((propType) => (
          <TouchableOpacity
            key={propType}
            style={[
              styles.propButton,
              selectedPropType === propType && styles.propButtonActive // Fix: Dynamic active state
            ]}
            onPress={() => onPropTypeChange(propType)}
          >
            <Text style={[
              styles.propButtonText,
              selectedPropType === propType && styles.propButtonTextActive // Fix: Dynamic text color
            ]}>
              {propType}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

// 2. Fix for dynamic chart title - update your chart rendering function:
const renderDynamicChart = (selectedPropType: string, playerName: string, recentGames: any[]) => {
  // Fix: Dynamic chart title based on selected prop type
  const getChartTitle = (propType: string) => {
    const titleMap: { [key: string]: string } = {
      'hits': 'Hits',
      'home_runs': 'Home Runs', 
      'rbis': 'RBIs',
      'runs_scored': 'Runs Scored',
      'total_bases': 'Total Bases',
      'strikeouts': 'Strikeouts',
      'passing_yards': 'Passing Yards',
      'rushing_yards': 'Rushing Yards',
      'receiving_yards': 'Receiving Yards',
      'receptions': 'Receptions',
      'points': 'Points',
      'rebounds': 'Rebounds',
      'assists': 'Assists',
      'steals': 'Steals',
      'blocks': 'Blocks',
      'three_pointers': '3-Pointers'
    };
    return titleMap[propType] || propType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const chartTitle = `Last 10 Games - ${getChartTitle(selectedPropType)}`; // Fix: Dynamic title

  return (
    <View>
      <Text style={styles.chartTitle}>{chartTitle}</Text>
      <Text style={styles.chartSubtitle}>
        {playerName} • Last {recentGames.length} Games
      </Text>
      {/* Your chart component here */}
    </View>
  );
};

// 3. Main TrendModal state management - add these to your component:
export default function TrendModal({ visible, trend, onClose }: TrendModalProps) {
  const [selectedPropType, setSelectedPropType] = useState<string>('hits'); // Add state
  const [chartData, setChartData] = useState<any[]>([]);

  // Fix: Update chart data when prop type changes
  useEffect(() => {
    if (trend && selectedPropType) {
      fetchChartDataForProp(selectedPropType);
    }
  }, [selectedPropType, trend?.player_id]);

  const fetchChartDataForProp = async (propType: string) => {
    // Query player_recent_stats for the selected prop type
    const { data, error } = await supabase
      .from('player_recent_stats')
      .select('*')
      .eq('player_id', trend.player_id)
      .eq('sport', trend.sport)
      .order('game_date', { ascending: false })
      .limit(10);

    if (data) {
      const propValues = data.map(game => ({
        date: game.game_date,
        opponent: game.opponent,
        value: game[propType] || 0, // Dynamic prop value
        isHome: game.is_home
      }));
      setChartData(propValues);
    }
  };

  // Available props based on sport
  const getAvailableProps = (sport: string): string[] => {
    const sportProps: { [key: string]: string[] } = {
      'MLB': ['hits', 'home_runs', 'rbis', 'runs_scored', 'total_bases', 'strikeouts', 'walks'],
      'NFL': ['passing_yards', 'rushing_yards', 'receiving_yards', 'receptions', 'passing_tds', 'rushing_tds'],
      'NBA': ['points', 'rebounds', 'assists', 'steals', 'blocks', 'three_pointers'],
      'WNBA': ['points', 'rebounds', 'assists', 'steals', 'blocks', 'three_pointers']
    };
    return sportProps[sport] || ['points'];
  };

  return (
    <Modal visible={visible} onRequestClose={onClose}>
      {/* Your existing header */}
      
      {/* Add prop selector */}
      <PropSelector 
        selectedPropType={selectedPropType}
        onPropTypeChange={setSelectedPropType}
        availableProps={getAvailableProps(trend?.sport || 'MLB')}
      />
      
      {/* Render chart with dynamic data */}
      {renderDynamicChart(selectedPropType, trend?.full_player_name || 'Player', chartData)}
      
      {/* Rest of your modal content */}
    </Modal>
  );
}

// Styles for the fixes:
const styles = StyleSheet.create({
  propButtonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 8,
  },
  propButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  propButtonActive: {
    backgroundColor: '#3B82F6', // Fix: Blue background when active
    borderColor: '#3B82F6',
  },
  propButtonText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '500',
  },
  propButtonTextActive: {
    color: '#FFFFFF', // Fix: White text when active
    fontWeight: '600',
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  chartSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 16,
  },
});
