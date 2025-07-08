import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import AdminAnalyticsDashboard from './components/AdminAnalyticsDashboard';

export default function AdminDashboardScreen() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f1419" />
      <AdminAnalyticsDashboard />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1419',
  },
});
