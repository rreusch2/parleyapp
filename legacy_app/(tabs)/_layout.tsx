import { Tabs } from 'expo-router';
import { View, useColorScheme, Text, Dimensions, Platform } from 'react-native';
import { Settings, Calendar, DollarSign, Home, TrendingUp } from 'lucide-react-native';
import { AIChatProvider } from '@/app/services/aiChatContext';
import FloatingAIChatButton from '@/app/components/FloatingAIChatButton';
import ProAIChat from '@/app/components/ProAIChat';

// Get device dimensions to adapt UI for iPad
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isTablet = screenWidth > 768; // Standard breakpoint for tablet devices

export default function TabLayout() {
  const colorScheme = useColorScheme();

  // Adjust tab bar height and padding for iPad
  const tabBarHeight = isTablet ? 90 : 80;
  const tabBarPaddingBottom = isTablet ? 20 : 15;
  const tabBarPaddingTop = isTablet ? 15 : 10;
  const iconSize = isTablet ? 26 : 24;
  const labelFontSize = isTablet ? 14 : 12;

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
              height: tabBarHeight,
              paddingBottom: tabBarPaddingBottom,
              paddingTop: tabBarPaddingTop,
            },
            tabBarLabelStyle: {
              fontSize: labelFontSize,
              fontWeight: '500',
            },
            headerStyle: {
              backgroundColor: '#111827',
            },
            headerTitleStyle: {
              color: '#FFFFFF',
              fontWeight: '700',
              fontSize: isTablet ? 24 : 20,
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
            <Home size={iconSize} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: 'Games',
          headerTitle: 'Live Games & Odds',
          tabBarIcon: ({ color, size }) => (
            <Calendar size={iconSize} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="predictions"
        options={{
          title: 'Picks',
          headerTitle: () => (
            <View>
              <Text style={{ 
                color: '#FFFFFF', 
                fontWeight: '700', 
                fontSize: isTablet ? 28 : 24, 
                textAlign: 'center' 
              }}>
                Picks
              </Text>
            </View>
          ),
          tabBarIcon: ({ color, size }) => (
            <DollarSign size={iconSize} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="trends"
        options={{
          title: 'Trends',
          headerTitle: 'Trends',
          tabBarIcon: ({ color, size }) => (
            <TrendingUp size={iconSize} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerTitle: 'Settings & Profile',
          tabBarIcon: ({ color, size }) => (
            <Settings size={iconSize} color={color} />
          ),
        }}
      />
    </Tabs>
    
    {/* Global Floating AI Chat Button - positioned closer to tabs */}
    <FloatingAIChatButton 
      bottom={isTablet ? 110 : 95} // Adjust position for iPad
    />
    
    {/* Global AI Chat Modal */}
    <ProAIChat />
  </View>
</AIChatProvider>
  );
}