import cron from 'node-cron';
import { broadcastToOptedIn } from '../services/notifications/expo';
import { supabaseAdmin } from '../services/supabaseClient';
import { logger } from '../utils/logger';
import { newsService } from '../services/newsService';

function isoTodayRange(tz: string = 'America/New_York') {
  // Create start and end of day in UTC for the given timezone by approximating with local server time
  // For simplicity we filter by created_at >= today 00:00Z
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
  return start.toISOString();
}

async function sendPickSnippet() {
  try {
    const todayIso = isoTodayRange();
    const { data, error } = await supabaseAdmin
      .from('ai_predictions')
      .select('id, match_teams, pick, confidence, created_at')
      .gte('created_at', todayIso)
      .order('confidence', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      logger.warn('[notificationsCron] No picks found for today');
      return;
    }

    const p = data[0];
    const title = '🔥 Today’s AI Pick';
    const body = `${p.match_teams} — ${p.pick} (${p.confidence || 0}% conf)`;
    const res = await broadcastToOptedIn(title, body, { type: 'pick', id: p.id, deeplink: 'predictions' });
    logger.info(`[notificationsCron] Sent pick notification to ${res.sent} devices`);
  } catch (err) {
    logger.error('[notificationsCron] sendPickSnippet error:', err);
  }
}

async function sendInsightOrNewsSnippet() {
  try {
    // 50/50 pick insight vs news
    const roll = Math.random();
    if (roll < 0.5) {
      const { data, error } = await supabaseAdmin
        .from('daily_professor_insights')
        .select('id, title, description, insight_order, created_at')
        .order('insight_order', { ascending: true })
        .limit(1);
      if (!error && data && data.length > 0) {
        const i = data[0];
        const snippet = (i.description || i.title || '').slice(0, 120);
        const title = '🧠 Professor Lock Insight';
        const body = i.title ? i.title : `${snippet}${snippet.length === 120 ? '…' : ''}`;
        const res = await broadcastToOptedIn(title, body, { type: 'insight', id: i.id, deeplink: 'insights' });
        logger.info(`[notificationsCron] Sent insight notification to ${res.sent} devices`);
        return;
      }
    }

    // Fallback to news
    try {
      const latest = await newsService.getLatestNews(undefined, 1);
      if (latest && latest.length > 0) {
        const n = latest[0];
        const title = '📣 Latest Sports Update';
        const snippetSrc = n.title || n.summary || n.content || 'Tap to see today’s most relevant news';
        const snippet = snippetSrc.slice(0, 120);
        const body = snippet;
        const res = await broadcastToOptedIn(title, body, { type: 'news', deeplink: 'news' });
        logger.info(`[notificationsCron] Sent news notification to ${res.sent} devices`);
        return;
      }
    } catch (e) {
      // Ignore and fall back
    }

    // Final fallback generic
    const res = await broadcastToOptedIn('📣 Latest Sports Update', 'Tap to see today’s most relevant news for your bets.', { type: 'news', deeplink: 'news' });
    logger.info(`[notificationsCron] Sent generic news notification to ${res.sent} devices`);
  } catch (err) {
    logger.error('[notificationsCron] sendInsightOrNewsSnippet error:', err);
  }
}

export function initNotificationsCron() {
  const tz = process.env.NOTIFICATIONS_TZ || 'America/New_York';
  const enabled = process.env.ENABLE_NOTIFICATIONS_CRON === 'true' || process.env.NODE_ENV === 'production';
  if (!enabled) {
    logger.info('[notificationsCron] Disabled');
    return;
  }

  // 11:30 AM and 5:30 PM Eastern daily
  cron.schedule('0 30 11 * * *', () => {
    logger.info('[notificationsCron] 11:30 AM job running');
    sendPickSnippet();
  }, { timezone: tz });

  cron.schedule('0 30 17 * * *', () => {
    logger.info('[notificationsCron] 5:30 PM job running');
    sendInsightOrNewsSnippet();
  }, { timezone: tz });

  logger.info('[notificationsCron] Scheduled daily jobs (11:30 AM, 5:30 PM)');
}
