import { supabaseAdmin } from '../services/supabase/client';
import { updateProfileFromRevenueCat } from '../services/revenuecatProcessor';

/**
 * Processes unprocessed RevenueCat webhook events stored in `webhook_events`.
 * Idempotent: updates are based on current entitlements; safe to re-run.
 */
export async function processRevenueCatWebhooks(batchSize = 100): Promise<{ processed: number; failed: number; remaining: number; }>
{
  const { data: events, error } = await supabaseAdmin
    .from('webhook_events')
    .select('id, notification_data')
    .eq('source', 'revenuecat')
    .eq('processed', false)
    .order('created_at', { ascending: true })
    .limit(batchSize);

  if (error) {
    console.error('❌ Failed to fetch RC webhook events:', error);
    throw error;
  }

  if (!events || events.length === 0) {
    return { processed: 0, failed: 0, remaining: 0 };
  }

  let ok = 0, fail = 0;

  for (const evt of events) {
    try {
      const payload = (evt as any).notification_data;
      const result = await updateProfileFromRevenueCat(payload);

      await supabaseAdmin
        .from('webhook_events')
        .update({
          processed: result.updated,
          processed_at: result.updated ? new Date().toISOString() : null,
          error_message: result.updated ? null : (result.reason || 'Update failed'),
          retry_count: result.updated ? null : ((evt as any).retry_count || 0) + 1,
        })
        .eq('id', (evt as any).id);

      if (result.updated) ok++; else fail++;
    } catch (e: any) {
      fail++;
      await supabaseAdmin
        .from('webhook_events')
        .update({
          processed: false,
          error_message: e?.message || 'exception during processing',
          retry_count: ((evt as any).retry_count || 0) + 1,
        })
        .eq('id', (evt as any).id);
    }
  }

  const { data: remainingRows } = await supabaseAdmin
    .from('webhook_events')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'revenuecat')
    .eq('processed', false);

  const remaining = (remainingRows as any)?.length ?? 0; // count via head may be null; compute later if needed

  return { processed: ok, failed: fail, remaining };
}
