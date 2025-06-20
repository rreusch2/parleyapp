import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
  Linking,
  Vibration
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Settings,
  Bell,
  Shield,
  CreditCard,
  HelpCircle,
  ChevronRight,
  User,
  Target,
  TrendingUp,
  DollarSign,
  Calendar,
  Star,
  LogOut,
  ChevronDown,
  ChevronUp,
  Trophy,
  BarChart3,
  Zap,
  History,
  ExternalLink,
  Award,
  Users,
  Wallet
} from 'lucide-react-native';
import { Picker } from '@react-native-picker/picker';
import MultiSelect from 'react-native-multiple-select';
import { supabase } from '@/app/services/api/supabaseClient';
import { aiService } from '@/app/services/api/aiService';
import { router } from 'expo-router';
import Slider from '@react-native-community/slider';

export default function SettingsScreen() {
  const [settings, setSettings] = useState({
    notifications: true,
    darkMode: true,
    aiAlerts: true,
    oddsFormat: 'American',
    biometricLogin: false,
    dataUsage: 'Optimized',
  });

  // Profile section state
  const [showProfileDetails, setShowProfileDetails] = useState(false);

  // Profile and preference states
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
  ]);
  const [selectedSports, setSelectedSports] = useState<number[]>([]);

  // User stats (normally would come from API)
  const [userStats] = useState({
    winRate: '67%',
    roi: '+22.4%',
    totalBets: 86,
    profitLoss: '+$2,456',
    streak: 5
  });

  const [recentBets] = useState([
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

  const toggleSwitch = (setting) => {
    setSettings({ ...settings, [setting]: !settings[setting] });
  };

  const handleSavePreferences = async () => {
    try {
      // Convert selectedSports IDs to sport names
      const sportNames = selectedSports.map(id => 
        availableSports.find(sport => sport.id === id)?.name || ''
      ).filter(name => name !== '');
      
      // Prepare data for API
      const preferences = {
        risk_tolerance: riskTolerance,
        sports: sportNames,
        bet_types: ['moneyline', 'spread', 'total'],
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
        method: 'PUT',
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
      
      console.log('Preferences saved successfully');
    } catch (error: any) {
      console.error('Error saving preferences:', error);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🚪 Logging out user...');
              
              // Sign out from Supabase
              const { error } = await supabase.auth.signOut();
              
              if (error) {
                console.error('Logout error:', error);
                Alert.alert('Error', 'Failed to log out. Please try again.');
                return;
              }
              
              console.log('✅ Successfully logged out');
              
              // Navigate to login screen
              router.replace('/(auth)/login');
              
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to log out. Please try again.');
            }
          },
        },
      ]
    );
  };

  const settingsSections = [
    {
      title: 'Account',
      icon: User,
      iconColor: '#00E5FF',
      items: [
        { id: 'subscription', title: 'Subscription', type: 'link', badge: 'Premium' },
        { id: 'payment', title: 'Payment Methods', type: 'link' },
      ]
    },
    {
      title: 'Preferences',
      icon: Zap,
      iconColor: '#F59E0B',
      items: [
        { id: 'notifications', title: 'Notifications', type: 'toggle', value: settings.notifications },
        { id: 'darkMode', title: 'Dark Mode', type: 'toggle', value: settings.darkMode },
        { id: 'aiAlerts', title: 'AI Value Alerts', type: 'toggle', value: settings.aiAlerts },
        { id: 'oddsFormat', title: 'Odds Format', type: 'select', value: settings.oddsFormat },
        { id: 'dataUsage', title: 'Data Usage', type: 'select', value: settings.dataUsage },
      ]
    },
    {
      title: 'Security',
      icon: Shield,
      iconColor: '#10B981',
      items: [
        { id: 'password', title: 'Change Password', type: 'link' },
        { id: 'biometricLogin', title: 'Biometric Login', type: 'toggle', value: settings.biometricLogin },
        { id: 'twoFactor', title: 'Two-Factor Authentication', type: 'link' },
      ]
    },
    {
      title: 'Support',
      icon: HelpCircle,
      iconColor: '#8B5CF6',
      items: [
        { id: 'help', title: 'Help Center', type: 'link' },
        { id: 'feedback', title: 'Send Feedback', type: 'link' },
        { id: 'about', title: 'About Predictive Picks', type: 'link' },
      ]
    }
  ];

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

  const renderSettingItem = (item: any) => {
    return (
      <TouchableOpacity 
        key={item.id}
        style={styles.settingItem}
        onPress={() => {
          if (item.type === 'toggle') {
            toggleSwitch(item.id);
          }
        }}
      >
        <View style={styles.settingLeft}>
          <Text style={styles.settingTitle}>{item.title}</Text>
          {item.badge && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.badge}</Text>
            </View>
          )}
        </View>
        <View style={styles.settingRight}>
          {item.type === 'toggle' && (
            <Switch
              value={item.value}
              onValueChange={() => toggleSwitch(item.id)}
              trackColor={{ false: '#374151', true: '#00E5FF' }}
              thumbColor={item.value ? '#FFFFFF' : '#9CA3AF'}
            />
          )}
          {item.type === 'select' && (
            <View style={styles.selectContainer}>
              <Text style={styles.selectValue}>{item.value}</Text>
              <ChevronRight size={16} color="#6B7280" />
            </View>
          )}
          {item.type === 'link' && (
            <ChevronRight size={16} color="#6B7280" />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Profile & Stats Section */}
      <View style={styles.profileSection}>
        <TouchableOpacity 
          style={styles.profileToggleButton}
          onPress={() => setShowProfileDetails(!showProfileDetails)}
        >
          <View style={styles.profileToggleContent}>
            <View style={styles.profileBasicInfo}>
              <View style={styles.profileImagePlaceholder}>
                <Text style={styles.profileInitials}>JD</Text>
              </View>
              <View style={styles.profileDetails}>
                <Text style={styles.profileName}>John Doe</Text>
                <Text style={styles.profileStatus}>Pro Bettor • Elite Member</Text>
              </View>
            </View>
            {showProfileDetails ? (
              <ChevronDown size={20} color="#00E5FF" />
            ) : (
              <ChevronRight size={20} color="#00E5FF" />
            )}
          </View>
        </TouchableOpacity>

        {showProfileDetails && (
          <View style={styles.profileDetailsSection}>
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
                {recentBets.slice(0, 3).map(bet => (
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
                        { color: bet.status === 'win' ? '#10B981' : '#EF4444' }
                      ]}>{bet.return}</Text>
                      <View style={[
                        styles.betStatus,
                        { backgroundColor: bet.status === 'win' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }
                      ]}>
                        <Text style={[
                          styles.betStatusText,
                          { color: bet.status === 'win' ? '#10B981' : '#EF4444' }
                        ]}>{bet.status.toUpperCase()}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Profile Action Items */}
            <View style={styles.profileActionsCard}>
              <Text style={styles.profileActionsTitle}>Quick Actions</Text>
              <View style={styles.profileActionsList}>
                {menuItems.map(item => (
                  <TouchableOpacity key={item.id} style={styles.profileActionItem}>
                    <View style={styles.profileActionLeft}>
                      <View style={[styles.profileActionIcon, { backgroundColor: `${item.color}20` }]}>
                        <item.icon size={18} color={item.color} />
                      </View>
                      <Text style={styles.profileActionTitle}>{item.title}</Text>
                    </View>
                    <ChevronRight size={16} color="#6B7280" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Settings Sections */}
      {settingsSections.map((section, index) => (
        <View key={index} style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: `${section.iconColor}20` }]}>
              <section.icon size={20} color={section.iconColor} />
            </View>
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
          <View style={styles.sectionContent}>
            {section.items.map((item) => renderSettingItem(item))}
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <LogOut size={18} color="#EF4444" />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      <View style={styles.versionInfo}>
        <Text style={styles.versionText}>Predictive Picks v1.0.0</Text>
        <Text style={styles.copyrightText}>© 2025 Predictive Picks Technologies Inc.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  contentContainer: {
    paddingBottom: 30,
  },
  // Profile styles
  profileSection: {
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
  profileToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  profileToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileBasicInfo: {
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
  profileDetailsSection: {
    padding: 16,
  },
  statsCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
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
    marginBottom: 16,
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
  betStatus: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  betStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileActionsCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  profileActionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  profileActionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  profileActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    width: '50%',
  },
  profileActionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
      profileActionTitle: {
      fontSize: 16,
      color: '#FFFFFF',
      fontWeight: '500',
    },
    settingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    },
    settingLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    settingTitle: {
      fontSize: 16,
      color: '#FFFFFF',
      fontWeight: '500',
    },
    settingRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    badge: {
      backgroundColor: '#00E5FF',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 12,
      marginLeft: 8,
    },
    badgeText: {
      color: '#0F172A',
      fontSize: 10,
      fontWeight: '600',
    },
    section: {
      marginVertical: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sectionContent: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    marginHorizontal: 16,
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
      web: {
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  selectContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectValue: {
    fontSize: 14,
    color: '#94A3B8',
    marginRight: 6,
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeContainer: {
    backgroundColor: 'rgba(0, 229, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 10,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#00E5FF',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    marginHorizontal: 16,
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
    marginLeft: 8,
  },
  versionInfo: {
    alignItems: 'center',
    marginTop: 30,
  },
  versionText: {
    color: '#64748B',
    fontSize: 12,
    marginBottom: 4,
  },
  copyrightText: {
    color: '#64748B',
    fontSize: 12,
  },
});