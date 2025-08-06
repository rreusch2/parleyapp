import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './api/supabaseClient';

/**
 * Registers the device for Expo push notifications, requests permissions if needed,
 * and returns the Expo push token. Returns undefined if user declines.
 */
export async function registerForPushNotificationsAsync(): Promise<string | undefined> {
  try {
    // Skip notifications on web platform
    if (Platform.OS === 'web') {
      console.log('📵 Push notifications not supported on web');
      return undefined;
    }

    // Android channel (required for foreground notifications)
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('📵 Push notification permission not granted');
      return;
    }

    const projectId = (Constants as any).expoConfig?.extra?.eas?.projectId ||
                      (Constants as any).expoConfig?.extra?.expoProjectId;

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log('✅ Expo push token:', tokenData.data);
    return tokenData.data;
  } catch (error) {
    console.error('Error registering for push notifications', error);
  }
}

/**
 * Persists the Expo push token in the `profiles` table (column: push_token).
 */
export async function savePushTokenToProfile(token: string, userId: string) {
  try {
    if (!token || !userId) return;
    const { error } = await supabase
      .from('profiles')
      .update({ push_token: token })
      .eq('id', userId);

    if (error) console.error('Error saving push token', error);
    else console.log('📲 Push token saved to Supabase');

    // Automatic daily reminder at 9 AM local
    await scheduleDailyReminder(9, 0);
  } catch (err) {
    console.error('Error in savePushTokenToProfile', err);
  }
}

/**
 * Schedules a daily local reminder at the provided hour/minute (24-h clock).
 */
export async function scheduleDailyReminder(hour = 9, minute = 0) {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🚀 Today’s AI Picks Are Ready!',
        body: 'Open Predictive Play to see the best value bets.',
        sound: 'default',
      },
      trigger: {
        hour,
        minute,
        repeats: true,
      },
    });
    console.log('⏰ Daily reminder scheduled');
  } catch (error) {
    console.error('Error scheduling daily reminder', error);
  }
} 