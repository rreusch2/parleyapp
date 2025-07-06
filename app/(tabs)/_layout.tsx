import { Tabs } from 'expo-router';
import { useEffect } from 'react';
import { supabase } from '@/app/services/api/supabaseClient';
import { registerForPushNotificationsAsync, savePushToken } from '@/app/services/notificationService';
import { View, useColorScheme } from 'react-native';
import { Settings, Calendar, Zap, Home } from 'lucide-react-native';
import { AIChatProvider } from '@/app/services/aiChatContext';
import FloatingAIChatButton from '@/app/components/FloatingAIChatButton';
import ProAIChat from '@/app/components/ProAIChat';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    const setupNotifications = async () => {
      const token = await registerForPushNotificationsAsync();
      if (token) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await savePushToken(user.id, token);
        }
      }
    };

    setupNotifications();
  }, []);

  return (
    <AIChatProvider>
      <View style={{ flex: 1 }}>
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
              fontWeight: '700',
              fontSize: 20,
            },
            headerTintColor: '#00E5FF',
          }}
        >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <Home size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: 'Games',
          headerTitle: 'Live Games & Odds',
          tabBarIcon: ({ color, size }) => (
            <Calendar size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="predictions"
        options={{
          title: 'Predictions',
          headerTitle: 'AI Predictions',
          tabBarIcon: ({ color, size }) => (
            <Zap size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerTitle: 'Settings & Profile',
          tabBarIcon: ({ color, size }) => (
            <Settings size={size} color={color} />
          ),
        }}
      />
    </Tabs>
    
    {/* Global Floating AI Chat Button - positioned closer to tabs */}
    <FloatingAIChatButton 
      bottom={95} // Moved closer to navigation tabs (was 110)
    />
    
    {/* Global AI Chat Modal */}
    <ProAIChat />
  </View>
</AIChatProvider>
  );
}