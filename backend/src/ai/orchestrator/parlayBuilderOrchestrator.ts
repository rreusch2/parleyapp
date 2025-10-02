import OpenAI from 'openai';
import * as dotenv from 'dotenv';
import { createLogger } from '../../utils/logger';
import { supabaseAdmin } from '../../services/supabase/client';

dotenv.config();

const logger = createLogger('parlayBuilder');
const XAI_API_KEY = process.env.XAI_API_KEY;

export interface ParlayOptions {
  legs: number; // 2-6
  riskLevel: 'safe' | 'balanced' | 'risky';
  includeTeams: boolean;
  includeProps: boolean;
  sports?: string[]; // e.g., ['Major League Baseball','Women's National Basketball Association','Ultimate Fighting Championship']
}

export default class ParlayBuilderOrchestrator {
  private openai: OpenAI;

  constructor() {
    if (!XAI_API_KEY) {
      logger.error('XAI_API_KEY not set');
      throw new Error('XAI_API_KEY not set');
    }
    this.openai = new OpenAI({ apiKey: XAI_API_KEY, baseURL: 'https://api.x.ai/v1' });
  }

  private getTodayIsoRange() {
    const start = new Date(); start.setHours(0,0,0,0);
    const end = new Date(); end.setHours(23,59,59,999);
    return { startISO: start.toISOString(), endISO: end.toISOString() };
  }

  private extractJsonFromMarkdown(md: string): any | null {
    try {
      const m = md.match(/```json\s*([\s\S]*?)```/i);
      if (m && m[1]) return JSON.parse(m[1]);
      const first = md.indexOf('{'); const last = md.lastIndexOf('}');
      if (first >= 0 && last > first) {
        const maybe = md.substring(first, last + 1);
        try { return JSON.parse(maybe); } catch {}
      }
      return null;
    } catch { return null; }
  }

  private async fetchLatestPredictions(limit = 30) {
    const { startISO } = this.getTodayIsoRange();
    const { data, error } = await supabaseAdmin
      .from('ai_predictions')
      .select('*')
      .gte('created_at', startISO)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) { logger.warn(`ai_predictions fetch error: ${error.message}`); return []; }
    return data || [];
  }

  private async fetchTeamMarkets(sports?: string[]) {
    const { startISO, endISO } = this.getTodayIsoRange();
    let q = supabaseAdmin
      .from('sports_events')
      .select('*')
      .eq('status', 'scheduled')
      .gte('start_time', startISO)
      .lte('start_time', endISO)
      .order('start_time', { ascending: true })
      .limit(40);
    if (sports && sports.length) q = q.in('sport', sports);
    const { data: games, error } = await q;
    if (error || !games?.length) return [] as any[];
    const eventIds = games.map(g => g.id);
    const { data: odds } = await supabaseAdmin
      .from('odds_data')
      .select('*, market_type:market_types(market_name), bookmaker:bookmakers(bookmaker_name)')
      .in('event_id', eventIds)
      .eq('is_best_odds', true);
    return games.map(g => ({ ...g, odds: (odds || []).filter((o: any) => o.event_id === g.id) }));
  }

  private async fetchPlayerProps(sports?: string[]) {
    const { startISO, endISO } = this.getTodayIsoRange();
    let q = supabaseAdmin
      .from('player_props_odds')
      .select(`
        id, event_id, player_id, line, over_odds, under_odds, created_at,
        players(name, team, sport, headshot_url),
        player_prop_types(prop_key, prop_name),
        sports_events(start_time, sport, home_team, away_team)
      `)
      .gte('sports_events.start_time', startISO)
      .lte('sports_events.start_time', endISO)
      .limit(100);
    if (sports && sports.length) q = q.in('sports_events.sport', sports);
    const { data, error } = await q;
    if (error) { logger.warn(`player_props_odds fetch error: ${error.message}`); return []; }
    return data || [];
  }

  private buildParlayPrompt(options: ParlayOptions, predictions: any[], games: any[], props: any[]) {
    const legHint = `${options.legs} legs • ${options.riskLevel.toUpperCase()} • ${options.includeTeams ? 'Teams' : ''}${options.includeTeams && options.includeProps ? ' + ' : ''}${options.includeProps ? 'Props' : ''}`;
    const sportsHint = options.sports?.length ? options.sports.join(', ') : 'All active';
    const predsLines = predictions.slice(0, 20).map((p, i) => `${i+1}. ${p.match_teams || p.match} · ${p.pick} · conf ${p.confidence}% · ${p.odds || ''}`).join('\n');
    const gameLine = (g: any) => `${g.away_team?.name || g.away_team} @ ${g.home_team?.name || g.home_team} · ${g.sport} · ${g.start_time}`;
    const gamesLines = games.slice(0, 20).map((g: any, i: number) => `${i+1}. ${gameLine(g)}`).join('\n');
    const propLine = (p: any) => {
      const pl = p.players || {}; const ev = p.sports_events || {}; const t = p.player_prop_types || {};
      const oddsPair = [p.over_odds, p.under_odds].filter((x: any) => x !== null).join('/');
      return `${pl.name} (${pl.team}) · ${t.prop_name || t.prop_key || 'prop'} ${p.line} · odds ${oddsPair} · ${ev.sport} · ${ev.start_time}`;
    };
    const propsLines = props.slice(0, 30).map((p: any, i: number) => `${i+1}. ${propLine(p)}`).join('\n');

    return `You are Professor Lock. Build an optimized parlay for TODAY.
Constraints:
- EXACTLY ${options.legs} legs
- Risk: ${options.riskLevel}
- Allowed leg types: ${options.includeTeams ? 'team markets' : ''}${options.includeTeams && options.includeProps ? ' + ' : ''}${options.includeProps ? 'player props' : ''}
- Preferred sports: ${sportsHint}

DATA YOU MAY USE (embedded below):
- latestPredictions (AI picks)\n${predsLines || 'None'}
${options.includeTeams ? `\n- upcomingGames (team markets)\n${gamesLines || 'None'}` : ''}
${options.includeProps ? `\n- availablePlayerProps\n${propsLines || 'None'}` : ''}

RESPONSE FORMAT:
1) BEAUTIFUL Markdown with:
   - Title: "Elite ${options.legs}-Leg Parlay — ${legHint}"
   - Each leg: bold pick, odds, confidence (if available), one concise reason
   - Short bankroll note (suggest 1–2% total)
2) Then append a fenced JSON code block (label: json) with this shape:
   {"legs":[{"type":"team|prop","match":"...","pick":"...","odds":-110,"confidence":70,"sport":"MLB|WNBA|MMA|...","player_name":"opt","team":"opt","prop_type":"opt","line":1.5,"side":"over|under","headshot_url":"opt"}],"risk_level":"${options.riskLevel}","legs_requested":${options.legs}}

RULES:
- Do not invent teams/players/games. Use ONLY provided data.
- SAFE = prioritize highest confidence; BALANCED = mix; RISKY = include some underdogs/value.
- Avoid heavy same-game correlation unless explicit synergy.`;
  }

  private async enrichHeadshots(legs: any[]) {
    const out: any[] = [];
    for (const leg of (legs || [])) {
      if (leg.player_name && !leg.headshot_url) {
        const name = String(leg.player_name);
        const team = leg.team ? String(leg.team) : undefined;
        const sport = leg.sport ? String(leg.sport) : undefined;
        try {
          let q = supabaseAdmin
            .from('players_with_headshots')
            .select('name, team, sport, headshot_url')
            .ilike('name', name)
            .limit(1);
          if (sport) q = q.eq('sport', sport);
          if (team) q = q.ilike('team', `%${team}%`);
          const { data } = await q;
          if (data && data.length && data[0].headshot_url) leg.headshot_url = data[0].headshot_url;
        } catch (e) { /* ignore */ }
      }
      out.push(leg);
    }
    return out;
  }

  public async generateParlayForOptions(options: ParlayOptions, userId: string) {
    const safeLegs = Math.max(2, Math.min(6, options.legs || 3));
    const opts: ParlayOptions = {
      legs: safeLegs,
      riskLevel: (['safe','balanced','risky'] as const).includes(options.riskLevel) ? options.riskLevel : 'balanced',
      includeTeams: !!options.includeTeams,
      includeProps: !!options.includeProps,
      sports: options.sports && options.sports.length ? options.sports : undefined,
    };

    const [preds, games, props] = await Promise.all([
      this.fetchLatestPredictions(30),
      opts.includeTeams ? this.fetchTeamMarkets(opts.sports) : Promise.resolve([]),
      opts.includeProps ? this.fetchPlayerProps(opts.sports) : Promise.resolve([]),
    ]);

    const system = this.buildParlayPrompt(opts, preds, games, props);
    const messages: any[] = [ { role: 'system', content: system } ];
    const resp = await this.openai.chat.completions.create({ model: 'grok-3', max_tokens: 1400, temperature: 0.7, messages });

    const markdown = resp.choices?.[0]?.message?.content || 'No result';
    const structured = this.extractJsonFromMarkdown(markdown) || {};
    const legs = await this.enrichHeadshots(structured.legs || []);

    return { markdown, legs, metadata: { usedPredictions: preds.length, usedGames: games.length, usedProps: props.length, options: opts } };
  }
}
