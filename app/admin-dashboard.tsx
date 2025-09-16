import React from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import AdminUsersManager from './components/AdminUsersManager';

export default function AdminDashboardScreen() {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f1419" />
      <AdminUsersManager />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1419',
  },
});
