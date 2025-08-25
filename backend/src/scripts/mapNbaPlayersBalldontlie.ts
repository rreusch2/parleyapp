import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findBalldontliePlayerIdByName(fullName: string): Promise<number | null> {
  try {
    const [first, ...rest] = fullName.split(' ');
    const last = rest.join(' ');
    const q = encodeURIComponent(`${first} ${last}`);
    const resp = await axios.get(`https://www.balldontlie.io/api/v1/players?search=${q}&per_page=25`);
    const matches = resp.data?.data || [];
    if (!matches.length) return null;

    // naive matching: exact last-name contains and first initial
    const best = matches.find((p: any) => {
      const candidate = `${p.first_name} ${p.last_name}`.toLowerCase();
      return candidate.includes(fullName.toLowerCase());
    }) || matches[0];
    return best?.id ?? null;
  } catch (e) {
    console.error('Lookup error:', (e as any).message || e);
    return null;
  }
}

export async function mapNbaPlayers() {
  console.log('🔎 Mapping NBA players to balldontlie IDs...');
  const { data: players, error } = await supabase
    .from('players')
    .select('id, player_name, name, sport, external_player_id')
    .eq('sport', 'NBA')
    .is('external_player_id', null)
    .limit(200);

  if (error) {
    console.error('Supabase error:', error.message);
    process.exit(1);
  }

  if (!players || players.length === 0) {
    console.log('No unmapped NBA players found.');
    return;
  }

  let updated = 0;
  for (const p of players) {
    const displayName = p.player_name || p.name;
    if (!displayName) continue;

    const id = await findBalldontliePlayerIdByName(displayName);
    if (id) {
      const { error: upErr } = await supabase
        .from('players')
        .update({ external_player_id: String(id) })
        .eq('id', p.id);
      if (!upErr) {
        updated += 1;
        console.log(`✅ ${displayName} -> ${id}`);
      } else {
        console.error(`❌ Failed to update ${displayName}: ${upErr.message}`);
      }
      // rate limit courtesy
      await new Promise(r => setTimeout(r, 150));
    }
  }

  console.log(`✅ Completed mapping. Updated ${updated} players.`);
}

if (require.main === module) {
  mapNbaPlayers().catch((e) => { console.error(e); process.exit(1); });
}


