import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../services/supabase/client';
import { getActiveSportConfigs, SUPPORTED_SPORTS, BOOKMAKER_CONFIG } from './multiSportConfig';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from backend directory
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Interfaces mirroring The Odds API structure
interface PlayerPropOutcome {
  name: string;
  price: number;
  point?: number;
  description?: string;
}

interface PlayerPropMarket {
  key: string;
  outcomes: PlayerPropOutcome[];
}

interface PlayerPropBookmaker {
  key: string;
  title: string;
  markets: PlayerPropMarket[];
}

interface PlayerPropsData {
  id: string; // external event id
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: PlayerPropBookmaker[];
}

// Aggregation types for multi-bookmaker storage (v2 table)
type OddsByBook = Record<string, number>;
interface AggregatedPropBucket {
  playerName: string;
  statType: string; // base market key, e.g., 'player_points'
  mainLinesPerBook: Record<string, number | undefined>;
  altLines: Record<string, { over: OddsByBook; under: OddsByBook }>;
}

function convertDecimalToAmerican(decimalOdds: number): number {
  if (decimalOdds <= 1) return -1000;
  if (decimalOdds < 2) return Math.round(-100 / (decimalOdds - 1));
  return Math.round((decimalOdds - 1) * 100);
}

function mapPlayerSportKey(s: string): string {
  const key = s.toUpperCase();
  if (key === 'CFB') return 'College Football';
  if (key === 'NFL') return 'NFL';
  if (key === 'MLB') return 'MLB';
  if (key === 'WNBA') return 'WNBA';
  if (key === 'NBA') return 'NBA';
  if (key === 'NHL') return 'NHL';
  return s;
}

async function getAlternateMarketKeys(sportKey: string, baseMarkets: string[]): Promise<string[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('sport_prop_mappings_v2')
      .select('theodds_market_key, has_alternates, alternate_market_key')
      .eq('sport', sportKey)
      .eq('is_active', true);
    if (error || !data) return [];
    const alt: string[] = [];
    for (const row of data) {
      if (row.has_alternates && row.alternate_market_key && baseMarkets.includes(row.theodds_market_key)) {
        alt.push(row.alternate_market_key);
      }
    }
    return Array.from(new Set(alt));
  } catch {
    return [];
  }
}

async function fetchPropsForEventWithAlternates(sportKey: string, externalEventId: string, theoddsKey: string, markets: string[], bookmakers: string[]): Promise<PlayerPropsData | null> {
  const apiKey = process.env.THEODDS_API_KEY;
  if (!apiKey) {
    console.error('❌ THEODDS_API_KEY not found');
    return null;
  }

  const url = `https://api.the-odds-api.com/v4/sports/${theoddsKey}/events/${externalEventId}/odds`;
  // Build candidate parameter sets (use suffix _alternate keys from DB mapping when available)
  const altCandidates: string[] = await getAlternateMarketKeys(sportKey, markets);
  // Filter to bookmakers that The Odds API accepts for props in US: include Fanatics per request
  const safeBookmakers = bookmakers.filter(b => ['fanduel','draftkings','betmgm','caesars','fanatics'].includes(b.toLowerCase()));
  const basePlusAlt = Array.from(new Set([...(markets || []), ...altCandidates]));
  const trySets: Array<{ markets: string[]; includeBooks: boolean }> = [
    { markets: basePlusAlt, includeBooks: true },
    { markets: basePlusAlt, includeBooks: false },
  ];

  for (const set of trySets) {
    try {
      const params: any = {
        apiKey,
        regions: 'us',
        markets: Array.from(new Set(set.markets)).join(','),
        oddsFormat: 'american',
      };
      if (set.includeBooks && safeBookmakers.length > 0) {
        params.bookmakers = safeBookmakers.join(',');
      }
      const response = await axios.get(url, { params, timeout: 30000 });
      if (response.status === 200 && response.data) return response.data as PlayerPropsData;
    } catch (e) {
      if (axios.isAxiosError(e)) {
        const code = e.response?.status;
        const body = e.response?.data;
        console.log(`  ⚠️ Error fetching props (markets=${set.markets.length}, books=${set.includeBooks}): ${code} ${e.response?.statusText}. Body: ${JSON.stringify(body)}`);
        // Try next fallback
      } else {
        console.log(`  ⚠️ Error fetching props: ${(e as Error).message}`);
      }
    }
  }
  return null;
}

function aggregateProps(data: PlayerPropsData, validPropMarkets: string[], allowedBooks: string[]): Map<string, AggregatedPropBucket> {
  const allowed = new Set(allowedBooks.map(b => b.toLowerCase()));
  const aggregated = new Map<string, AggregatedPropBucket>(); // key: `${playerName}::${statType}`

  for (const bm of data.bookmakers || []) {
    const bookKey = (bm.key || '').toLowerCase();
    if (!allowed.has(bookKey)) continue;
    for (const market of bm.markets || []) {
      const marketKey = market.key;
      const isAlternate = /_alternate$/.test(marketKey);
      const baseMarketKey = isAlternate ? marketKey.replace(/_alternate$/, '') : marketKey;
      if (!validPropMarkets.includes(baseMarketKey)) continue;

      for (const outcome of market.outcomes || []) {
        const fullPlayerName = outcome.description || 'Unknown Player';
        const line = outcome.point ?? 0;
        const aggKey = `${fullPlayerName}::${baseMarketKey}`;
        if (!aggregated.has(aggKey)) {
          aggregated.set(aggKey, {
            playerName: fullPlayerName,
            statType: baseMarketKey,
            mainLinesPerBook: {},
            altLines: {},
          });
        }
        const bucket = aggregated.get(aggKey)!;

        // Normalize decimal odds (if API ever returns decimal)
        let oddsValue = outcome.price;
        if (oddsValue > 1 && oddsValue < 10 && !Number.isInteger(oddsValue)) {
          oddsValue = convertDecimalToAmerican(oddsValue);
        }
        const outcomeName = (outcome.name || '').toLowerCase();
        let isOver = outcomeName.includes('over') || outcomeName.includes('+') || outcomeName.includes('more');
        let isUnder = outcomeName.includes('under') || outcomeName.includes('-') || outcomeName.includes('fewer') || outcomeName.includes('less');
        // Map yes/no style props to over/under semantics when applicable
        const yesNoMarkets = new Set(['player_anytime_td','player_double_double','player_triple_double','fight_to_go_distance']);
        if (!isOver && !isUnder && yesNoMarkets.has(baseMarketKey)) {
          if (outcomeName.includes('yes')) isOver = true;
          else if (outcomeName.includes('no')) isUnder = true;
        }

        const lineKey = String(line);
        // Record base (main) line for this book
        if (!isAlternate) {
          bucket.mainLinesPerBook[bookKey] = line;
        }
        if (!bucket.altLines[lineKey]) bucket.altLines[lineKey] = { over: {}, under: {} };
        if (isOver) bucket.altLines[lineKey].over[bookKey] = oddsValue;
        else if (isUnder) bucket.altLines[lineKey].under[bookKey] = oddsValue;
      }
    }
  }

  return aggregated;
}

function chooseConsensusLine(altLines: AggregatedPropBucket['altLines']): number | null {
  let best: number | null = null;
  let bestCount = -1;
  for (const [lineStr, odds] of Object.entries(altLines)) {
    const books = new Set<string>([...Object.keys(odds.over || {}), ...Object.keys(odds.under || {})]);
    const count = books.size;
    if (count > bestCount) {
      best = Number(lineStr);
      bestCount = count;
    }
  }
  return best;
}

async function matchOrCreatePlayer(playerName: string, sportKey: string, gameData?: { home_team: string; away_team: string }): Promise<{ id: string; team: string | null } | null> {
  const sportName = mapPlayerSportKey(sportKey);
  // Exact match first
  const { data: exact, error: exactErr } = await supabaseAdmin
    .from('players')
    .select('id, name, team')
    .eq('name', playerName)
    .eq('sport', sportName)
    .maybeSingle();
  if (exact && !exactErr) return { id: exact.id, team: exact.team ?? null };

  // Fuzzy match
  const { data: all } = await supabaseAdmin
    .from('players')
    .select('id, name, team')
    .eq('sport', sportName);
  const matched = (all || []).find(p => p.name === playerName || playerName.includes(p.name) || p.name.includes(playerName));
  if (matched) return { id: matched.id, team: matched.team ?? null };

  // Auto-create for leagues we manage rosters for
  if (['WNBA', 'NBA', 'NHL'].includes(sportKey.toUpperCase())) {
    const newId = uuidv4();
    const playerKey = `${sportKey.toLowerCase()}_${playerName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${newId.slice(0, 8)}`;
    const homeAbbr = (gameData?.home_team || '').split(' ').pop() || null;
    const { data: created, error } = await supabaseAdmin
      .from('players')
      .insert({ id: newId, external_player_id: newId, name: playerName, player_name: playerName, player_key: playerKey, team: homeAbbr, sport: sportKey.toUpperCase(), active: true })
      .select('id, team')
      .single();
    if (!error && created) return { id: created.id, team: created.team ?? null };
  }
  return null;
}

export async function aggregatePlayerPropsV2(extendedNflWeek = false, nflAheadDaysArg?: number): Promise<void> {
  console.log('\n🎯 Aggregating multi-bookmaker player props into player_props_v2...');
  const activeSports = getActiveSportConfigs();
  if (activeSports.length === 0) {
    console.log('⚠️ No active sports configured');
    return;
  }

  const allowedBooks = Array.isArray(BOOKMAKER_CONFIG.playerProps)
    ? BOOKMAKER_CONFIG.playerProps
    : [BOOKMAKER_CONFIG.playerProps];

  // Determine NFL window if enabled
  const nflAheadDays = typeof nflAheadDaysArg === 'number' && !Number.isNaN(nflAheadDaysArg)
    ? nflAheadDaysArg
    : Number(process.env.NFL_AHEAD_DAYS || 7);

  let totalProps = 0;

  for (const sportConfig of activeSports) {
    if (sportConfig.propMarkets.length === 0) {
      console.log(`⚠️ Skipping ${sportConfig.sportName} - no prop markets configured`);
      continue;
    }

    console.log(`\n📊 ${sportConfig.sportName}: fetching games...`);

    const now = new Date();
    let windowEnd = new Date(now);
    let windowLabel = 'today and tomorrow';
    if (extendedNflWeek && sportConfig.sportKey === 'NFL') {
      windowEnd.setUTCDate(now.getUTCDate() + nflAheadDays);
      windowEnd.setUTCHours(23, 59, 59, 999);
      windowLabel = `next ${nflAheadDays} days`;
    } else {
      windowEnd.setUTCDate(now.getUTCDate() + 1);
      windowEnd.setUTCHours(23, 59, 59, 999);
    }

    // Query upcoming games from sports_events
    const { data: games, error: gamesError } = await supabaseAdmin
      .from('sports_events')
      .select('id, external_event_id, sport, home_team, away_team, start_time')
      .eq('sport', sportConfig.sportName)
      .gte('start_time', now.toISOString())
      .lt('start_time', windowEnd.toISOString())
      .limit((extendedNflWeek && sportConfig.sportKey === 'NFL') ? Number(process.env.NFL_PROPS_LIMIT || 50) : 12);

    if (gamesError) {
      console.error(`❌ Error fetching ${sportConfig.sportName} games:`, gamesError.message);
      continue;
    }
    if (!games || games.length === 0) {
      console.log(`⚠️ No upcoming ${sportConfig.sportName} games found (${windowLabel})`);
      continue;
    }

    // Fetch base markets for this sport from DB mapping (fallback to config if none)
    const baseMarketsFromDb = await (async () => {
      try {
        const { data } = await supabaseAdmin
          .from('sport_prop_mappings_v2')
          .select('theodds_market_key')
          .eq('sport', sportConfig.sportKey)
          .eq('is_active', true);
        return (data || []).map((r: any) => r.theodds_market_key);
      } catch { return []; }
    })();
    const baseMarkets = (baseMarketsFromDb && baseMarketsFromDb.length > 0) ? baseMarketsFromDb : sportConfig.propMarkets;

    console.log(`📊 Found ${games.length} ${sportConfig.sportName} games (${windowLabel}). Fetching props for ${baseMarkets.length} markets from ${allowedBooks.join(', ')}...`);

    let propsForSport = 0;
    for (const game of games) {
      const propsData = await fetchPropsForEventWithAlternates(sportConfig.sportKey, game.external_event_id, sportConfig.theoddsKey, baseMarkets, allowedBooks);
      if (!propsData) continue;

      const aggregated = aggregateProps(propsData, baseMarkets, allowedBooks);
      const gameDateStr = game.start_time ? new Date(game.start_time).toISOString().slice(0, 10) : (propsData.commence_time ? new Date(propsData.commence_time).toISOString().slice(0, 10) : null);

      for (const agg of aggregated.values()) {
        // Keep a convenience consensus main_line (not used for per-book odds)
        const chosenMain = chooseConsensusLine(agg.altLines);
        if (chosenMain === null) continue;

        // Build per-book main odds using each book's own base/main line
        const mainOver: Record<string, number> = {};
        const mainUnder: Record<string, number> = {};
        for (const [bk, lineVal] of Object.entries(agg.mainLinesPerBook || {})) {
          if (lineVal === undefined || lineVal === null) continue;
          const bucketForLine = agg.altLines[String(lineVal)];
          if (!bucketForLine) continue;
          if (bucketForLine.over && Object.prototype.hasOwnProperty.call(bucketForLine.over, bk)) {
            mainOver[bk] = bucketForLine.over[bk]!;
          }
          if (bucketForLine.under && Object.prototype.hasOwnProperty.call(bucketForLine.under, bk)) {
            mainUnder[bk] = bucketForLine.under[bk]!;
          }
        }

        // Compute best odds across books (maximize numeric American odds value)
        let bestOverOdds: number | null = null; let bestOverBook: string | null = null;
        for (const [bk, val] of Object.entries(mainOver)) {
          if (bestOverOdds === null || val > bestOverOdds) { bestOverOdds = val; bestOverBook = bk; }
        }
        let bestUnderOdds: number | null = null; let bestUnderBook: string | null = null;
        for (const [bk, val] of Object.entries(mainUnder)) {
          if (bestUnderOdds === null || val > bestUnderOdds) { bestUnderOdds = val; bestUnderBook = bk; }
        }

        // Build alt_lines JSON
        const altLinesArr: { line: number; over_odds: Record<string, number>; under_odds: Record<string, number> }[] = [];
        for (const [lineStr, odds] of Object.entries(agg.altLines)) {
          const ln = Number(lineStr);
          altLinesArr.push({ line: ln, over_odds: odds.over, under_odds: odds.under });
        }
        const altLinesJson = altLinesArr.length > 0 ? { lines: altLinesArr } : null;

        // Match or create player
        const matched = await matchOrCreatePlayer(agg.playerName, sportConfig.sportKey, { home_team: game.home_team, away_team: game.away_team });
        if (!matched) continue;

        // Determine opponent / home flag (best-effort heuristic)
        let opponentTeam: string | null = null;
        let isHome: boolean | null = null;
        if (matched.team && game.home_team && game.away_team) {
          if (game.home_team.includes(matched.team)) { isHome = true; opponentTeam = game.away_team; }
          else if (game.away_team.includes(matched.team)) { isHome = false; opponentTeam = game.home_team; }
        }

        const payload: any = {
          event_id: game.id,
          player_id: matched.id,
          sport: sportConfig.sportKey.toUpperCase(),
          game_date: gameDateStr,
          opponent_team: opponentTeam,
          is_home: isHome,
          stat_type: agg.statType,
          main_line: chosenMain,
          main_line_by_book: Object.keys(agg.mainLinesPerBook || {}).length ? agg.mainLinesPerBook : null,
          main_over_odds: Object.keys(mainOver).length ? mainOver : null,
          main_under_odds: Object.keys(mainUnder).length ? mainUnder : null,
          best_over_odds: bestOverOdds,
          best_over_book: bestOverBook,
          best_under_odds: bestUnderOdds,
          best_under_book: bestUnderBook,
          alt_lines: altLinesJson,
          num_bookmakers: new Set([
            ...Object.keys(mainOver || {}),
            ...Object.keys(mainUnder || {}),
            ...Object.keys(agg.mainLinesPerBook || {})
          ]).size,
          last_updated: new Date().toISOString(),
        };

        // Upsert by unique (event_id, player_id, stat_type, main_line)
        const { data: existing } = await supabaseAdmin
          .from('player_props_v2')
          .select('id')
          .eq('event_id', game.id)
          .eq('player_id', matched.id)
          .eq('stat_type', agg.statType)
          .eq('main_line', chosenMain)
          .maybeSingle();

        if (existing?.id) {
          await supabaseAdmin.from('player_props_v2').update(payload).eq('id', existing.id);
        } else {
          await supabaseAdmin.from('player_props_v2').insert(payload);
        }

        propsForSport++;
      }

      // Rate limit friendliness
      await new Promise(res => setTimeout(res, 1000));
    }

    console.log(`✅ ${sportConfig.sportName}: wrote ${propsForSport} props to player_props_v2`);
    totalProps += propsForSport;
  }

  console.log(`\n✅ All done. Total props stored in player_props_v2: ${totalProps}`);
}

// Allow running as a standalone script
if (require.main === module) {
  const args = process.argv.slice(2);
  const extendedNflWeek = args.includes('--nfl-week');
  let nflAheadDaysArg: number | undefined;
  const nflDaysArg = args.find(a => a.startsWith('--nfl-days='));
  if (nflDaysArg) {
    const val = Number(nflDaysArg.split('=')[1]);
    if (!Number.isNaN(val) && val > 0) nflAheadDaysArg = val;
  }

  aggregatePlayerPropsV2(extendedNflWeek, nflAheadDaysArg)
    .then(() => console.log('\n🎉 aggregatePlayerPropsV2 completed'))
    .catch(err => {
      console.error('❌ aggregatePlayerPropsV2 failed:', (err as Error).message);
      process.exit(1);
    });
}
