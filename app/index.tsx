import { useEffect } from 'react';
import { Redirect } from 'expo-router';

export default function Root() {
  // Redirect to the main tab navigation
  return <Redirect href="/(tabs)" />;
}