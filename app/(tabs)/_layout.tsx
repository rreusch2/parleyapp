import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Landmark, ChartBar as BarChart3, User, Settings, Trophy } from 'lucide-react-native';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#00E5FF',
        tabBarInactiveTintColor: '#717171',
        tabBarStyle: {
          backgroundColor: '#111827',
          borderTopColor: '#1F2937',
          height: 80,
          paddingBottom: 15,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerStyle: {
          backgroundColor: '#111827',
        },
        headerTitleStyle: {
          color: '#FFFFFF',
          fontWeight: '600',
        },
        headerTintColor: '#00E5FF',
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Landmark size={size} color={color} />,
          headerTitle: 'BetGenius AI',
        }}
      />
      <Tabs.Screen
        name="predictions"
        options={{
          title: 'Predictions',
          tabBarIcon: ({ color, size }) => <BarChart3 size={size} color={color} />,
          headerTitle: 'AI Predictions',
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: 'Live Games',
          tabBarIcon: ({ color, size }) => <Trophy size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}