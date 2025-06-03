import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
  TextInput
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Wallet, Calendar, TrendingUp, History, Bell, Award, Users } from 'lucide-react-native';
import MultiSelect from 'react-native-multiple-select';
import { supabase } from '@/app/services/api/supabaseClient';

export default function ProfileScreen() {
  const [userStats, setUserStats] = useState({
    winRate: '67%',
    roi: '+22.4%',
    totalBets: 86,
    profitLoss: '+$2,456',
    streak: 5
  });

  const [recentBets, setRecentBets] = useState([
    {
      id: '1',
      match: 'Lakers vs Warriors',
      pick: 'Warriors -3.5',
      status: 'win',
      amount: '$100',
      return: '+$90.91',
      date: 'Today'
    },
    {
      id: '2',
      match: 'Chiefs vs Ravens',
      pick: 'Over 51.5',
      status: 'win',
      amount: '$150',
      return: '+$136.36',
      date: 'Yesterday'
    },
    {
      id: '3',
      match: 'Yankees vs Red Sox',
      pick: 'Yankees ML',
      status: 'loss',
      amount: '$75',
      return: '-$75',
      date: '2 days ago'
    }
  ]);

  const menuItems = [
    { 
      id: 'betting-history', 
      title: 'Betting History', 
      icon: History,
      color: '#00E5FF' 
    },
    { 
      id: 'notifications', 
      title: 'Notifications', 
      icon: Bell,
      color: '#F59E0B' 
    },
    { 
      id: 'bankroll', 
      title: 'Bankroll Management', 
      icon: Wallet,
      color: '#10B981' 
    },
    { 
      id: 'leaderboard', 
      title: 'Leaderboard', 
      icon: Award,
      color: '#8B5CF6' 
    },
    { 
      id: 'friends', 
      title: 'Friends', 
      icon: Users,
      color: '#EC4899' 
    }
  ];

  const [riskTolerance, setRiskTolerance] = useState('medium');
  const [pickFrequency, setPickFrequency] = useState('daily');
  const [bankroll, setBankroll] = useState('');
  const [maxBetPercentage, setMaxBetPercentage] = useState(5);
  const [availableSports, setAvailableSports] = useState([
    { id: 1, name: 'Football' },
    { id: 2, name: 'Basketball' },
    { id: 3, name: 'Baseball' },
    { id: 4, name: 'Tennis' },
    { id: 5, name: 'Golf' },
    { id: 6, name: 'Cricket' },
    { id: 7, name: 'Hockey' },
    { id: 8, name: 'Volleyball' },
    { id: 9, name: 'Handball' },
    { id: 10, name: 'Basketball' }
  ]);
  const [selectedSports, setSelectedSports] = useState([]);

  const handleSavePreferences = () => {
    // Implementation of saving preferences
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <LinearGradient
        colors={['#1E3A8A', '#1E40AF']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.profileInfo}>
          <View style={styles.profileImagePlaceholder}>
            <Text style={styles.profileInitials}>JD</Text>
          </View>
          <View style={styles.profileDetails}>
            <Text style={styles.profileName}>John Doe</Text>
            <Text style={styles.profileStatus}>Pro Bettor</Text>
            <View style={styles.membershipBadge}>
              <Text style={styles.membershipText}>Elite Member</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Stats Overview */}
      <View style={styles.statsCard}>
        <View style={styles.statsHeader}>
          <Text style={styles.statsTitle}>Performance</Text>
          <TouchableOpacity style={styles.statsFilterButton}>
            <Text style={styles.statsFilterText}>Last 30 Days</Text>
            <ChevronRight size={16} color="#00E5FF" />
          </TouchableOpacity>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <View style={styles.statIconContainer}>
              <TrendingUp size={16} color="#00E5FF" />
            </View>
            <Text style={styles.statValue}>{userStats.winRate}</Text>
            <Text style={styles.statLabel}>Win Rate</Text>
          </View>

          <View style={styles.statItem}>
            <View style={[styles.statIconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
              <TrendingUp size={16} color="#10B981" />
            </View>
            <Text style={styles.statValue}>{userStats.roi}</Text>
            <Text style={styles.statLabel}>ROI</Text>
          </View>

          <View style={styles.statItem}>
            <View style={[styles.statIconContainer, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
              <Calendar size={16} color="#F59E0B" />
            </View>
            <Text style={styles.statValue}>{userStats.totalBets}</Text>
            <Text style={styles.statLabel}>Total Bets</Text>
          </View>

          <View style={styles.statItem}>
            <View style={[styles.statIconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
              <Wallet size={16} color="#10B981" />
            </View>
            <Text style={styles.statValue}>{userStats.profitLoss}</Text>
            <Text style={styles.statLabel}>Profit/Loss</Text>
          </View>
        </View>
      </View>

      {/* Recent Bets */}
      <View style={styles.recentBetsCard}>
        <View style={styles.recentBetsHeader}>
          <Text style={styles.recentBetsTitle}>Recent Bets</Text>
          <TouchableOpacity style={styles.viewAllButton}>
            <Text style={styles.viewAllText}>View All</Text>
            <ChevronRight size={16} color="#00E5FF" />
          </TouchableOpacity>
        </View>

        <View style={styles.betsList}>
          {recentBets.map(bet => (
            <TouchableOpacity key={bet.id} style={styles.betItem}>
              <View>
                <Text style={styles.betMatch}>{bet.match}</Text>
                <Text style={styles.betPick}>{bet.pick}</Text>
                <Text style={styles.betDate}>{bet.date}</Text>
              </View>
              <View style={styles.betDetails}>
                <Text style={styles.betAmount}>{bet.amount}</Text>
                <Text style={[
                  styles.betReturn,
                  bet.status === 'win' ? styles.winReturn : styles.lossReturn
                ]}>
                  {bet.return}
                </Text>
                <View style={[
                  styles.statusBadge,
                  bet.status === 'win' ? styles.winBadge : styles.lossBadge
                ]}>
                  <Text style={styles.statusText}>
                    {bet.status === 'win' ? 'WIN' : 'LOSS'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Menu Items */}
      <View style={styles.menuCard}>
        {menuItems.map((item, index) => (
          <TouchableOpacity 
            key={item.id} 
            style={[
              styles.menuItem,
              index < menuItems.length - 1 && styles.menuItemBorder
            ]}
          >
            <View style={[styles.menuIconContainer, { backgroundColor: `${item.color}20` }]}>
              <item.icon size={20} color={item.color} />
            </View>
            <Text style={styles.menuItemText}>{item.title}</Text>
            <ChevronRight size={20} color="#64748B" />
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.versionInfo}>
        <Text style={styles.versionText}>BetGenius AI v1.0.0</Text>
      </View>

      <AIPreferencesSection />
    </ScrollView>
  );
}

const { width } = Dimensions.get('window');
const isTablet = width > 768;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  contentContainer: {
    paddingBottom: 30,
  },
  header: {
    paddingTop: 30,
    paddingBottom: 30,
    paddingHorizontal: 16,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  profileInitials: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileDetails: {
    flex: 1,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  profileStatus: {
    fontSize: 16,
    color: '#E2E8F0',
    marginBottom: 8,
  },
  membershipBadge: {
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  membershipText: {
    color: '#00E5FF',
    fontSize: 12,
    fontWeight: '600',
  },
  statsCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginTop: -20,
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
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statsFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsFilterText: {
    color: '#00E5FF',
    fontSize: 14,
    marginRight: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
  recentBetsCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    margin: 16,
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
  recentBetsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  recentBetsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllText: {
    color: '#00E5FF',
    fontSize: 14,
    marginRight: 2,
  },
  betsList: {
    
  },
  betItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  betMatch: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  betPick: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 4,
  },
  betDate: {
    fontSize: 12,
    color: '#64748B',
  },
  betDetails: {
    alignItems: 'flex-end',
  },
  betAmount: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 4,
  },
  betReturn: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  winReturn: {
    color: '#10B981',
  },
  lossReturn: {
    color: '#EF4444',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  winBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  lossBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  menuCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    margin: 16,
    marginTop: 0,
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
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  versionInfo: {
    alignItems: 'center',
    marginVertical: 20,
  },
  versionText: {
    color: '#64748B',
    fontSize: 12,
  },
  preferenceItem: {
    marginBottom: 16,
  },
  preferenceLabel: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 8,
  },
  pickerContainer: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    backgroundColor: '#0F172A',
    color: '#FFFFFF',
    height: 50,
  },
  pickerItem: {
    color: '#FFFFFF',
  },
  input: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
    padding: 12,
    color: '#FFFFFF',
    fontSize: 16,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slider: {
    flex: 1,
    height: 40,
  },
  sliderValue: {
    color: '#FFFFFF',
    marginLeft: 8,
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#00E5FF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonText: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '600',
  },
  preferencesCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    margin: 16,
  },
  preferencesTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  multiSelectDropdown: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
  },
  multiSelectDropdownSubsection: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  multiSelectInputGroup: {
    backgroundColor: '#0F172A',
  },
  multiSelectItemsContainer: {
    backgroundColor: '#1E293B',
  },
  multiSelectListContainer: {
    backgroundColor: '#1E293B',
  },
  multiSelectSelectorContainer: {
    backgroundColor: '#0F172A',
    borderRadius: 8,
  },
  multiSelectTextDropdown: {
    color: '#94A3B8',
    fontSize: 16,
  },
  multiSelectTextDropdownSelected: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  errorText: {
    color: '#EF4444',
    marginTop: 10,
    textAlign: 'center',
  },
  successText: {
    color: '#10B981',
    marginTop: 10,
    textAlign: 'center',
  },
});

const AIPreferencesSection = () => {
  const [riskTolerance, setRiskTolerance] = useState('medium');
  const [bankroll, setBankroll] = useState('');
  const [maxBetPercentage, setMaxBetPercentage] = useState(5);
  const [availableSports] = useState([
    { id: 1, name: 'Football' },
    { id: 2, name: 'Basketball' },
    { id: 3, name: 'Baseball' },
    { id: 4, name: 'Tennis' },
    { id: 5, name: 'Golf' },
    { id: 6, name: 'Cricket' },
    { id: 7, name: 'Hockey' },
    { id: 8, name: 'Volleyball' },
    { id: 9, name: 'Handball' },
    { id: 10, name: 'Basketball' }
  ]);
  const [selectedSports, setSelectedSports] = useState<number[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSavePreferences = async () => {
    try {
      setIsSaving(true);
      setSaveError(null);
      setSaveSuccess(false);
      
      // Convert selectedSports IDs to sport names
      const sportNames = selectedSports.map(id => 
        availableSports.find(sport => sport.id === id)?.name || ''
      ).filter(name => name !== '');
      
      // Prepare data for API
      const preferences = {
        risk_tolerance: riskTolerance,
        sports: sportNames,
        bet_types: ['moneyline', 'spread', 'total'], // Default bet types
        max_bet_size: parseInt(bankroll) ? Math.floor(parseInt(bankroll) * (maxBetPercentage / 100)) : 0,
        notification_preferences: {
          frequency: 'daily',
          types: ['new_predictions', 'bet_results']
        }
      };
      
      // Get token from Supabase
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('You must be logged in to save preferences');
      }
      
      // Send to backend API
      const response = await fetch('http://localhost:3000/api/user-preferences', {
        method: 'PUT', // Update existing preferences
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(preferences)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save preferences');
      }
      
      setSaveSuccess(true);
      console.log('Preferences saved successfully');
    } catch (error: any) {
      console.error('Error saving preferences:', error);
      setSaveError(error.message || 'An error occurred while saving preferences');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.preferencesCard}>
      <Text style={styles.preferencesTitle}>AI Betting Preferences</Text>
      
      <View style={styles.preferenceItem}>
        <Text style={styles.preferenceLabel}>Risk Tolerance</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={riskTolerance}
            onValueChange={(value: string) => setRiskTolerance(value)}
            style={styles.picker}
            itemStyle={styles.pickerItem}
          >
            <Picker.Item label="Low" value="low" />
            <Picker.Item label="Medium" value="medium" />
            <Picker.Item label="High" value="high" />
          </Picker>
        </View>
      </View>

      <View style={styles.preferenceItem}>
        <Text style={styles.preferenceLabel}>Sports</Text>
        <MultiSelect
          items={availableSports}
          uniqueKey="id"
          onSelectedItemsChange={(items: number[]) => setSelectedSports(items)}
          selectedItems={selectedSports}
          selectText="Select Sports"
          searchInputPlaceholderText="Search Sports..."
          tagRemoveIconColor="#CCC"
          tagBorderColor="#CCC"
          tagTextColor="#CCC"
          selectedItemTextColor="#00E5FF"
          selectedItemIconColor="#00E5FF"
          itemTextColor="#FFFFFF"
          displayKey="name"
          searchInputStyle={{ color: '#FFFFFF' }}
          styleDropdownMenu={styles.multiSelectDropdown}
          styleDropdownMenuSubsection={styles.multiSelectDropdownSubsection}
          styleInputGroup={styles.multiSelectInputGroup}
          styleItemsContainer={styles.multiSelectItemsContainer}
          styleListContainer={styles.multiSelectListContainer}
          styleSelectorContainer={styles.multiSelectSelectorContainer}
          styleTextDropdown={styles.multiSelectTextDropdown}
          styleTextDropdownSelected={styles.multiSelectTextDropdownSelected}
        />
      </View>

      <View style={styles.preferenceItem}>
        <Text style={styles.preferenceLabel}>Bankroll</Text>
        <TextInput
          style={styles.input}
          value={bankroll}
          onChangeText={setBankroll}
          placeholder="Enter your bankroll"
          placeholderTextColor="#64748B"
          keyboardType="numeric"
        />
      </View>

      <View style={styles.preferenceItem}>
        <Text style={styles.preferenceLabel}>Max Bet Size (%)</Text>
        <View style={styles.sliderContainer}>
          <Slider
            style={styles.slider}
            value={maxBetPercentage}
            onValueChange={setMaxBetPercentage}
            minimumValue={1}
            maximumValue={10}
            step={1}
            minimumTrackTintColor="#00E5FF"
            maximumTrackTintColor="#1E293B"
            thumbTintColor="#00E5FF"
          />
          <Text style={styles.sliderValue}>{maxBetPercentage}%</Text>
        </View>
      </View>

      {saveError && (
        <Text style={styles.errorText}>{saveError}</Text>
      )}
      
      {saveSuccess && (
        <Text style={styles.successText}>Preferences saved successfully!</Text>
      )}

      <TouchableOpacity 
        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]} 
        onPress={handleSavePreferences}
        disabled={isSaving}
      >
        <Text style={styles.saveButtonText}>
          {isSaving ? 'Saving...' : 'Save Preferences'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};