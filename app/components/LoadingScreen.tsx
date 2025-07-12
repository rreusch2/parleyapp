import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function LoadingScreen() {
  return (
    <LinearGradient
      colors={['#0F0F23', '#1A1A2E', '#16213E']}
      style={styles.container}
    >
      <View style={styles.content}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.text}>Loading ParleyApp...</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 16,
    fontWeight: '500',
  },
});
