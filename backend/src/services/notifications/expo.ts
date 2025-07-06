
import { Expo } from 'expo-server-sdk';
import { supabase } from '../../config/supabaseClient'; // Assuming you have a supabase client setup

const expo = new Expo();

async function getPushTokens(proUsers: boolean) {
  const { data, error } = await supabase
    .from('profiles')
    .select('push_token, subscription_tier')
    .eq('subscription_tier', proUsers ? 'pro' : 'free')
    .not('push_token', 'is', null);

  if (error) {
    console.error('Error fetching push tokens:', error);
    return [];
  }

  return data.map(profile => profile.push_token);
}

export async function sendNewPicksNotification(totalPicks: number = 10) {
  const proTokens = await getPushTokens(true);
  const freeTokens = await getPushTokens(false);

  const proMessages = proTokens.map(token => ({
    to: token,
    sound: 'default',
    title: '🏆 New Pro Picks Available!',
    body: `${totalPicks} new AI-powered predictions are ready for you. Tap to see them now!`,
  }));

  const freeMessages = freeTokens.map(token => ({
    to: token,
    sound: 'default',
    title: '🔥 New Picks Are In!',
    body: `${Math.min(totalPicks, 5)} new picks are available. Check them out before the games start!`,
  }));

  const messages = [...proMessages, ...freeMessages];
  const chunks = expo.chunkPushNotifications(messages);

  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (error) {
      console.error('Error sending push notifications:', error);
    }
  }
}
