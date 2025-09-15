
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { supabaseAdmin } from '../../services/supabaseClient';

const expo = new Expo();

type NotificationSettings = {
  push_alerts?: boolean;
  [key: string]: any;
} | null;

async function getOptedInPushTokens(): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('push_token, notification_settings')
    .not('push_token', 'is', null);

  if (error) {
    console.error('Error fetching push tokens:', error);
    return [];
  }

  const tokens: string[] = [];
  for (const row of data || []) {
    const settings = (row as any).notification_settings as NotificationSettings;
    // Treat missing settings as opted-in unless explicitly set to false
    const optedOut = settings && settings.push_alerts === false;
    if (!optedOut && (row as any).push_token) {
      tokens.push((row as any).push_token);
    }
  }
  return tokens;
}

export async function broadcastToOptedIn(title: string, body: string, data?: Record<string, any>) {
  const tokens = await getOptedInPushTokens();
  if (tokens.length === 0) {
    return { sent: 0 };
  }

  const messages: ExpoPushMessage[] = tokens.map((to) => ({
    to,
    sound: 'default',
    title,
    body,
    data,
  }));

  const chunks = expo.chunkPushNotifications(messages);
  let sent = 0;
  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      sent += tickets.length;
    } catch (error) {
      console.error('Error sending push notifications:', error);
    }
  }

  return { sent };
}
