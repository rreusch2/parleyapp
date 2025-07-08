
import cron from 'node-cron';
import { supabase } from '../../config/supabaseClient';
import { Expo } from 'expo-server-sdk';

const expo = new Expo();

// [REMOVED] Game start notifications logic has been removed as per user request.
  const { data, error } = await supabase
    .from('profiles')
    .select('id, push_token, notification_settings')
    .not('push_token', 'is', null)
    .eq('notification_settings->>game_start', 'true');

  if (error) {
    console.error('Error fetching subscribed users for game start:', error);
    return [];
  }

  return data;
}


  const users = await getSubscribedUsersForGameStart();
  if (users.length === 0) {
    return;
  }

  const now = new Date();
  const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000);

  const { data: games, error } = await supabase
    .from('sports_events')
    .select('home_team, away_team, start_time')
    .gte('start_time', now.toISOString())
    .lte('start_time', fifteenMinutesFromNow.toISOString());

  if (error) {
    console.error('Error fetching upcoming games:', error);
    return;
  }

  if (games.length === 0) {
    return;
  }

  const messages = [];
  for (const user of users) {
    for (const game of games) {
      messages.push({
        to: user.push_token,
        sound: 'default',
        title: '🏀 Game Starting Soon!',
        body: `${game.away_team} @ ${game.home_team} is about to start.`,
      });
    }
  }

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (error) {
      console.error('Error sending game start notifications:', error);
    }
  }
}


  // Run every minute
  cron.schedule('* * * * *', () => {
    console.log('Running game start notification scheduler...');
    sendGameStartNotifications();
  });
}
