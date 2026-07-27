import express from 'express';
import axios from 'axios';
import { logger } from '../../utils/logger';
import { normalizeSport, rankSports, StatMuseSport } from '../../utils/sportInference';

const router = express.Router();

// Base URL for the StatMuse service (Railway)
const STATMUSE_BASE_URL = process.env.STATMUSE_API_URL || 'https://web-production-f090e.up.railway.app';

// Upstream rejects any /query without a sport, so we may need several attempts.
const MAX_SPORT_ATTEMPTS = 6;
const UPSTREAM_TIMEOUT_MS = 12000;
const TOTAL_BUDGET_MS = 28000;

const UNAVAILABLE_MESSAGE = 'Instant Intel is temporarily unavailable. Please try again in a moment.';
const NO_ANSWER_MESSAGE =
  'No stats found for that question. Try including the league or team, e.g. "Aaron Judge home runs this season".';

// Helper to forward requests
async function forwardPost(path: string, body: any) {
  const url = `${STATMUSE_BASE_URL}${path}`;
  const response = await axios.post(url, body, {
    timeout: UPSTREAM_TIMEOUT_MS,
    headers: { 'Content-Type': 'application/json' },
    // Do NOT forward Authorization from mobile to StatMuse directly
  });
  return response.data;
}

async function forwardGet(path: string) {
  const url = `${STATMUSE_BASE_URL}${path}`;
  const response = await axios.get(url, { timeout: 10000 });
  return response.data;
}

interface QueryOutcome {
  data: any | null;
  reachedUpstream: boolean;
  triedSports: StatMuseSport[];
}

function compact(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// StatMuse renders the question itself as the page heading when it has no data,
// which the scraper happily returns as an "answer".
function isRealAnswer(answer: unknown, query: string): boolean {
  if (typeof answer !== 'string') return false;
  const cleaned = compact(answer);
  return cleaned.length > 0 && cleaned !== compact(query);
}

/**
 * Older mobile builds send `{ query }` with no sport, which the StatMuse service
 * now rejects outright. Infer the league here and walk the ranked list until one
 * of them produces an answer.
 */
async function queryWithSportFallback(query: string, requestedSport?: unknown): Promise<QueryOutcome> {
  const explicit = normalizeSport(requestedSport);
  const ranked = rankSports(query);
  const order = explicit ? [explicit, ...ranked.filter((sport) => sport !== explicit)] : ranked;
  const attempts = order.slice(0, MAX_SPORT_ATTEMPTS);

  const startedAt = Date.now();
  const triedSports: StatMuseSport[] = [];
  let reachedUpstream = false;

  for (const sport of attempts) {
    if (triedSports.length > 0 && Date.now() - startedAt > TOTAL_BUDGET_MS) break;
    triedSports.push(sport);

    try {
      const data = await forwardPost('/query', { query, sport });
      reachedUpstream = true;
      if (data?.success && isRealAnswer(data?.answer, query)) {
        return { data: { ...data, sport }, reachedUpstream, triedSports };
      }
    } catch (err: any) {
      if (err?.response) {
        // Upstream answered with a 4xx/5xx: bad sport guess or bad query, keep going.
        reachedUpstream = true;
        continue;
      }
      // Network level failure - further attempts will fail the same way.
      logger.error(`StatMuse proxy could not reach upstream: ${err?.message || String(err)}`);
      break;
    }
  }

  return { data: null, reachedUpstream, triedSports };
}

router.get('/health', async (req, res) => {
  try {
    const data = await forwardGet('/health');
    res.status(200).json(data);
  } catch (err: any) {
    res.status(502).json({ success: false, error: 'Upstream health check failed', details: err?.message || String(err) });
  }
});

router.get('/cache-stats', async (req, res) => {
  try {
    const data = await forwardGet('/cache-stats');
    res.status(200).json(data);
  } catch (err: any) {
    res.status(502).json({ success: false, error: 'Upstream cache stats failed', details: err?.message || String(err) });
  }
});

/**
 * Always responds 200 so shipped clients render the message instead of a raw
 * "HTTP 502" connection error.
 */
async function respondWithQuery(res: express.Response, phrasings: string[], requestedSport?: unknown) {
  const candidates = phrasings.map((phrasing) => (phrasing || '').trim()).filter(Boolean);
  if (candidates.length === 0) {
    res.status(200).json({ success: false, query: '', error: 'Please enter a question first.' });
    return;
  }

  let reachedUpstream = false;
  for (const candidate of candidates) {
    const outcome = await queryWithSportFallback(candidate, requestedSport);
    reachedUpstream = reachedUpstream || outcome.reachedUpstream;
    if (outcome.data) {
      res.status(200).json({ ...outcome.data, query: candidates[0] });
      return;
    }
    if (!outcome.reachedUpstream) break;
  }

  logger.warn(`StatMuse proxy found no answer for "${candidates[0]}"`);
  res.status(200).json({
    success: false,
    query: candidates[0],
    error: reachedUpstream ? NO_ANSWER_MESSAGE : UNAVAILABLE_MESSAGE,
  });
}

router.post('/query', async (req, res) => {
  try {
    await respondWithQuery(res, [req.body?.query], req.body?.sport);
  } catch (err: any) {
    logger.error(`StatMuse proxy query failure: ${err?.message || String(err)}`);
    res.status(200).json({ success: false, query: req.body?.query || '', error: UNAVAILABLE_MESSAGE });
  }
});

router.post('/head-to-head', async (req, res) => {
  try {
    const { team1, team2, games = 5 } = req.body || {};
    if (!team1 || !team2) {
      res.status(200).json({ success: false, query: '', error: 'Two teams are required for a head-to-head lookup.' });
      return;
    }
    await respondWithQuery(
      res,
      [
        `${team1} vs ${team2} last ${games} meetings`,
        `${team1} vs ${team2} record this season`,
        `${team1} vs ${team2} head to head record`,
      ],
      req.body?.sport
    );
  } catch (err: any) {
    logger.error(`StatMuse proxy head-to-head failure: ${err?.message || String(err)}`);
    res.status(200).json({ success: false, query: '', error: UNAVAILABLE_MESSAGE });
  }
});

router.post('/team-record', async (req, res) => {
  try {
    const { team, record_type = 'overall', season = new Date().getFullYear().toString() } = req.body || {};
    if (!team) {
      res.status(200).json({ success: false, query: '', error: 'A team name is required.' });
      return;
    }
    const qualifier = record_type === 'home' ? 'home record' : record_type === 'away' ? 'road record' : 'record';
    await respondWithQuery(res, [`${team} ${qualifier} ${season}`, `${team} ${qualifier} this season`], req.body?.sport);
  } catch (err: any) {
    logger.error(`StatMuse proxy team-record failure: ${err?.message || String(err)}`);
    res.status(200).json({ success: false, query: '', error: UNAVAILABLE_MESSAGE });
  }
});

router.post('/player-stats', async (req, res) => {
  try {
    const { player, stat_type = 'season', timeframe = new Date().getFullYear().toString() } = req.body || {};
    if (!player) {
      res.status(200).json({ success: false, query: '', error: 'A player name is required.' });
      return;
    }
    await respondWithQuery(res, [`${player} ${stat_type} stats ${timeframe}`, `${player} stats this season`], req.body?.sport);
  } catch (err: any) {
    logger.error(`StatMuse proxy player-stats failure: ${err?.message || String(err)}`);
    res.status(200).json({ success: false, query: '', error: UNAVAILABLE_MESSAGE });
  }
});

export default router;
