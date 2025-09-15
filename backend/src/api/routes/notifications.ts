
import { Router } from 'express';
import { broadcastToOptedIn } from '../../services/notifications/expo';
import { supabaseAdmin } from '../../services/supabaseClient';
import { authenticateUser } from '../middleware/auth';

const router = Router();

// Simple admin guard using profiles.admin_role
async function assertAdmin(userId?: string) {
  if (!userId) throw new Error('Unauthorized');
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('admin_role')
    .eq('id', userId)
    .single();
  if (error || !data?.admin_role) throw new Error('Unauthorized');
}

// POST /api/notifications/send
// body: { type: 'pick' | 'insight' | 'news' | 'custom', entityId?, title?, message? }
router.post('/send', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    await assertAdmin(userId);

    const { type, entityId, title, message } = req.body as {
      type: 'pick' | 'insight' | 'news' | 'custom';
      entityId?: string;
      title?: string;
      message?: string;
    };

    if (!type) {
      return res.status(400).json({ error: 'type is required' });
    }

    let payloadTitle = title;
    let payloadBody = message;
    let data: Record<string, any> = { type };

    if (type === 'pick') {
      // Fetch a pick from ai_predictions
      let query = supabaseAdmin
        .from('ai_predictions')
        .select('id, match_teams, pick, confidence, created_at')
        .order('confidence', { ascending: false })
        .limit(1);
      if (entityId) {
        query = supabaseAdmin
          .from('ai_predictions')
          .select('id, match_teams, pick, confidence, created_at')
          .eq('id', entityId)
          .limit(1);
      }
      const { data: picks, error } = await query;
      if (error || !picks || picks.length === 0) {
        return res.status(404).json({ error: 'Pick not found' });
      }
      const p = picks[0];
      payloadTitle = payloadTitle || '🔥 Today’s AI Pick';
      payloadBody = payloadBody || `${p.match_teams} — ${p.pick} (${p.confidence || 0}% conf)`;
      data = { ...data, id: p.id, deeplink: 'predictions' };
    } else if (type === 'insight') {
      // Fetch an insight from daily_professor_insights
      let query = supabaseAdmin
        .from('daily_professor_insights')
        .select('id, title, description, category, insight_order, created_at')
        .order('insight_order', { ascending: true })
        .limit(1);
      if (entityId) {
        query = supabaseAdmin
          .from('daily_professor_insights')
          .select('id, title, description, category, insight_order, created_at')
          .eq('id', entityId)
          .limit(1);
      }
      const { data: insights, error } = await query;
      if (error || !insights || insights.length === 0) {
        return res.status(404).json({ error: 'Insight not found' });
      }
      const i = insights[0];
      const snippet = (i.description || i.title || '').slice(0, 120);
      payloadTitle = payloadTitle || '🧠 Professor Lock Insight';
      payloadBody = payloadBody || (i.title ? `${i.title}` : `${snippet}${snippet.length === 120 ? '…' : ''}`);
      data = { ...data, id: i.id, deeplink: 'insights' };
    } else if (type === 'news') {
      // Optionally fetch from newsService or skip if custom not provided
      if (!payloadTitle || !payloadBody) {
        // fall back to a generic prompt
        payloadTitle = '📣 Latest Sports Update';
        payloadBody = 'Tap to see today’s most relevant news for your bets.';
      }
      data = { ...data, deeplink: 'news' };
    } else if (type === 'custom') {
      if (!payloadTitle || !payloadBody) {
        return res.status(400).json({ error: 'custom type requires title and message' });
      }
      data = { ...data, deeplink: 'home' };
    }

    const result = await broadcastToOptedIn(payloadTitle!, payloadBody!, data);
    return res.json({ success: true, sent: result.sent, title: payloadTitle, body: payloadBody });
  } catch (err: any) {
    const msg = err?.message || 'Failed to send notifications';
    console.error('[notifications.send] error:', err);
    return res.status(msg === 'Unauthorized' ? 401 : 500).json({ error: msg });
  }
});

export default router;
