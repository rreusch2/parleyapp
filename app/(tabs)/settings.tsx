import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Platform
} from 'react-native';
import { ChevronRight, User, Shield, Bell, Zap, CircleHelp as HelpCircle, LogOut } from 'lucide-react-native';

export default function SettingsScreen() {
  const [settings, setSettings] = useState({
    notifications: true,
    darkMode: true,
    aiAlerts: true,
    oddsFormat: 'American',
    biometricLogin: false,
    dataUsage: 'Optimized',
  });

  const toggleSwitch = (setting) => {
    setSettings({ ...settings, [setting]: !settings[setting] });
  };

  const settingsSections = [
    {
      title: 'Account',
      icon: User,
      iconColor: '#00E5FF',
      items: [
        { id: 'profile', title: 'Profile Information', type: 'link' },
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
        { id: 'about', title: 'About BetGenius AI', type: 'link' },
      ]
    }
  ];

  const renderSettingItem = (item) => {
    switch (item.type) {
      case 'toggle':
        return (
          <Switch
            trackColor={{ false: '#334155', true: '#0891B2' }}
            thumbColor={item.value ? '#00E5FF' : '#94A3B8'}
            ios_backgroundColor="#334155"
            onValueChange={() => toggleSwitch(item.id)}
            value={item.value}
          />
        );
      case 'select':
        return (
          <View style={styles.selectContainer}>
            <Text style={styles.selectValue}>{item.value}</Text>
            <ChevronRight size={18} color="#64748B" />
          </View>
        );
      case 'link':
        return (
          <View style={styles.linkContainer}>
            {item.badge && (
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>{item.badge}</Text>
              </View>
            )}
            <ChevronRight size={18} color="#64748B" />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      {settingsSections.map(section => (
        <View key={section.title} style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconContainer, { backgroundColor: `${section.iconColor}20` }]}>
              <section.icon size={18} color={section.iconColor} />
            </View>
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
          
          <View style={styles.sectionContent}>
            {section.items.map((item, index) => (
              <TouchableOpacity 
                key={item.id}
                style={[
                  styles.settingItem,
                  index < section.items.length - 1 && styles.settingItemBorder
                ]}
              >
                <Text style={styles.settingTitle}>{item.title}</Text>
                {renderSettingItem(item)}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.logoutButton}>
        <LogOut size={18} color="#EF4444" />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      <View style={styles.versionInfo}>
        <Text style={styles.versionText}>BetGenius AI v1.0.0</Text>
        <Text style={styles.copyrightText}>© 2025 BetGenius Technologies Inc.</Text>
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
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
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
  sectionIconContainer: {
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
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  settingItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  settingTitle: {
    fontSize: 16,
    color: '#FFFFFF',
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