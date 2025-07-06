import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './api/supabaseClient'; // Assuming you have a supabase client setup

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotificationsAsync() {
  let token;
  
  // Allow notifications on web and physical devices
  if (Device.isDevice || Platform.OS === 'web') {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      alert('Failed to get push token for push notification!');
      return;
    }
    
    try {
      token = (await Notifications.getExpoPushTokenAsync()).data;
      console.log('Push token obtained:', token);
    } catch (error) {
      console.error('Error getting push token:', error);
      if (Platform.OS === 'web') {
        console.log('Web push notifications may not be fully supported in development mode');
      }
    }
  } else {
    alert('Must use physical device for Push Notifications');
  }

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  return token;
}

export async function savePushToken(userId: string, token: string) {
  if (!userId || !token) {
    return;
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ push_token: token })
    .eq('id', userId);

  if (error) {
    console.error('Error saving push token:', error);
  }
}