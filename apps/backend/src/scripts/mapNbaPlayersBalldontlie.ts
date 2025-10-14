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
      const candidateFirst = p.first_name.toLowerCase();
      const candidateLast = p.last_name.toLowerCase();
      const playerFirst = first.toLowerCase();
      const playerLast = last.toLowerCase();

      return (
        candidateLast === playerLast &&
        candidateFirst.charAt(0) === playerFirst.charAt(0)
      );
    });

    return best ? best.id : null;
  } catch (error) {
    console.error(`Error finding player ID for ${fullName}:`, error);
    return null;
  }
}

async function mapNbaPlayers() {
  try {
    console.log('🏀 Starting NBA player mapping to balldontlie IDs...');
    
    // Get all active NBA players without external_player_id
    const { data: players, error } = await supabase
      .from('players')
      .select('id, name, player_name')
      .eq('sport', 'NBA')
      .eq('active', true)
      .is('external_player_id', null);
    
    if (error) throw error;
    
    console.log(`Found ${players?.length || 0} NBA players to map`);
    
    // Process in batches to avoid rate limiting
    const batchSize = 5;
    let updated = 0;
    
    for (let i = 0; i < (players?.length || 0); i += batchSize) {
      const batch = players!.slice(i, i + batchSize);
      const promises = batch.map(async (player) => {
        const playerName = player.player_name || player.name;
        if (!playerName) return null;
        
        console.log(`Processing ${playerName}...`);
        const externalId = await findBalldontliePlayerIdByName(playerName);
        
        if (externalId) {
          console.log(`✅ Found ID for ${playerName}: ${externalId}`);
          const { error: updateError } = await supabase
            .from('players')
            .update({ external_player_id: externalId.toString() })
            .eq('id', player.id);
          
          if (updateError) {
            console.error(`❌ Error updating ${playerName}:`, updateError);
            return null;
          }
          
          return externalId;
        } else {
          console.log(`❌ No match found for ${playerName}`);
          return null;
        }
      });
      
      const results = await Promise.all(promises);
      updated += results.filter(Boolean).length;
      
      // Sleep to avoid rate limiting
      if (i + batchSize < (players?.length || 0)) {
        console.log('Waiting 1s to avoid rate limiting...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`✅ Mapping complete! Updated ${updated} of ${players?.length || 0} players`);
    
  } catch (error) {
    console.error('❌ Error mapping NBA players:', error);
  }
}

// Run the mapping
mapNbaPlayers().then(() => {
  console.log('🏁 NBA player mapping script finished');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});