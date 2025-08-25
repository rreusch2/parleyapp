import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'fast-csv';

// Load environment variables
config();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface NFLPlayerStats {
  player_id: string;
  player_name: string;
  game_date: string;
  opponent: string;
  is_home: boolean;
  game_result: string;
  passing_yards: number;
  rushing_yards: number;
  receiving_yards: number;
  receptions: number;
  passing_tds: number;
  rushing_tds: number;
  receiving_tds: number;
}

interface NFLPlayerMap {
  [key: string]: string; // Maps external name to player_id
}

/**
 * Import NFL historical stats from CSV files
 */
async function importNFLHistoricalStats(csvDir: string): Promise<void> {
  try {
    console.log('🏈 Starting NFL historical stats import...');
    
    // Get all NFL players
    const { data: players, error } = await supabase
      .from('players')
      .select('id, name, player_name')
      .eq('sport', 'NFL')
      .eq('active', true);
    
    if (error) throw error;
    
    if (!players?.length) {
      console.log('No NFL players found in database');
      return;
    }
    
    console.log(`Found ${players.length} NFL players in database`);
    
    // Create player name to ID mapping
    const playerMap: NFLPlayerMap = {};
    players.forEach(player => {
      const name = (player.player_name || player.name || '').toLowerCase();
      if (name) {
        playerMap[name] = player.id;
      }
    });
    
    // Check if CSV directory exists
    if (!fs.existsSync(csvDir)) {
      console.error(`❌ CSV directory not found: ${csvDir}`);
      return;
    }
    
    // Get all CSV files in the directory
    const files = fs.readdirSync(csvDir).filter(file => file.endsWith('.csv'));
    
    if (files.length === 0) {
      console.log('No CSV files found in directory');
      return;
    }
    
    console.log(`Found ${files.length} CSV files to process`);
    
    let totalImported = 0;
    
    // Process each CSV file
    for (const file of files) {
      console.log(`Processing ${file}...`);
      
      const filePath = path.join(csvDir, file);
      const stats: NFLPlayerStats[] = [];
      
      // Parse CSV file
      await new Promise<void>((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv.parse({ headers: true }))
          .on('error', error => reject(error))
          .on('data', row => {
            try {
              // Extract player name from CSV
              const playerName = row.player_name?.toLowerCase();
              
              // Skip if player not in our database
              if (!playerName || !playerMap[playerName]) {
                return;
              }
              
              // Transform CSV data to our schema
              const stat: NFLPlayerStats = {
                player_id: playerMap[playerName],
                player_name: row.player_name,
                game_date: row.game_date,
                opponent: row.opponent || 'Unknown',
                is_home: row.is_home === 'true' || row.is_home === '1',
                game_result: row.game_result || '',
                passing_yards: parseInt(row.passing_yards || '0'),
                rushing_yards: parseInt(row.rushing_yards || '0'),
                receiving_yards: parseInt(row.receiving_yards || '0'),
                receptions: parseInt(row.receptions || '0'),
                passing_tds: parseInt(row.passing_tds || '0'),
                rushing_tds: parseInt(row.rushing_tds || '0'),
                receiving_tds: parseInt(row.receiving_tds || '0')
              };
              
              stats.push(stat);
            } catch (error) {
              console.error(`❌ Error processing row: ${JSON.stringify(row)}`, error);
            }
          })
          .on('end', () => resolve());
      });
      
      // Insert stats into database
      if (stats.length > 0) {
        const { error } = await supabase
          .from('player_recent_stats')
          .upsert(stats, {
            onConflict: 'player_id,game_date,opponent'
          });
        
        if (error) {
          console.error(`❌ Error inserting stats: ${error.message}`);
        } else {
          console.log(`✅ Imported ${stats.length} stats from ${file}`);
          totalImported += stats.length;
        }
      } else {
        console.log(`⚠️ No stats found in ${file}`);
      }
    }
    
    console.log(`✅ NFL historical stats import complete! Imported ${totalImported} stats`);
    
  } catch (error) {
    console.error('❌ Error importing NFL historical stats:', (error as any)?.message || error);
  }
}

/**
 * Generate sample CSV files with NFL historical data
 * This is a temporary solution until we have real data
 */
async function generateSampleData(outputDir: string): Promise<void> {
  try {
    console.log('🏈 Generating sample NFL historical data...');
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Get all NFL players
    const { data: players, error } = await supabase
      .from('players')
      .select('id, name, player_name, position')
      .eq('sport', 'NFL')
      .eq('active', true);
    
    if (error) throw error;
    
    if (!players?.length) {
      console.log('No NFL players found in database');
      return;
    }
    
    // Sample teams
    const teams = ['KC', 'BUF', 'BAL', 'SF', 'DAL', 'PHI', 'CIN', 'MIA', 'DET', 'GB', 'LAR', 'TB'];
    
    // Generate 10 sample games for each player
    const sampleData: Record<string, any>[] = [];
    
    for (const player of players) {
      const playerName = player.player_name || player.name;
      const position = player.position?.toUpperCase() || '';
      
      // Generate 10 games
      for (let i = 0; i < 10; i++) {
        const gameDate = new Date(2024, 8 + Math.floor(i / 4), 1 + (i % 4) * 7); // Sept-Dec 2024
        const opponent = teams[Math.floor(Math.random() * teams.length)];
        const isHome = Math.random() > 0.5;
        const gameResult = Math.random() > 0.5 ? 'W' : 'L';
        
        // Stats based on position
        let stats: Record<string, any> = {
          player_name: playerName,
          game_date: gameDate.toISOString().split('T')[0],
          opponent,
          is_home: isHome ? '1' : '0',
          game_result: gameResult,
          passing_yards: '0',
          rushing_yards: '0',
          receiving_yards: '0',
          receptions: '0',
          passing_tds: '0',
          rushing_tds: '0',
          receiving_tds: '0'
        };
        
        if (position === 'QB') {
          stats.passing_yards = String(Math.floor(Math.random() * 300) + 150);
          stats.passing_tds = String(Math.floor(Math.random() * 4));
          stats.rushing_yards = String(Math.floor(Math.random() * 30));
          stats.rushing_tds = Math.random() > 0.8 ? '1' : '0';
        } else if (position === 'RB') {
          stats.rushing_yards = String(Math.floor(Math.random() * 100) + 30);
          stats.rushing_tds = Math.random() > 0.7 ? '1' : '0';
          stats.receptions = String(Math.floor(Math.random() * 5));
          stats.receiving_yards = String(Math.floor(Math.random() * 40));
          stats.receiving_tds = Math.random() > 0.9 ? '1' : '0';
        } else if (position === 'WR' || position === 'TE') {
          stats.receptions = String(Math.floor(Math.random() * 8) + 2);
          stats.receiving_yards = String(Math.floor(Math.random() * 80) + 20);
          stats.receiving_tds = Math.random() > 0.8 ? '1' : '0';
        }
        
        sampleData.push(stats);
      }
    }
    
    // Write to CSV
    const csvFilePath = path.join(outputDir, 'nfl_historical_stats.csv');
    const csvStream = fs.createWriteStream(csvFilePath);
    
    csv.write(sampleData, { headers: true })
      .pipe(csvStream)
      .on('finish', () => {
        console.log(`✅ Sample data written to ${csvFilePath}`);
      });
    
  } catch (error) {
    console.error('❌ Error generating sample data:', (error as any)?.message || error);
  }
}

/**
 * Update NFL player positions
 */
async function updatePlayerPositions(): Promise<void> {
  try {
    console.log('🏈 Updating NFL player positions...');
    
    // Sample positions for players without positions
    const { data: players, error } = await supabase
      .from('players')
      .select('id, name, position')
      .eq('sport', 'NFL')
      .eq('active', true)
      .is('position', null);
    
    if (error) throw error;
    
    if (!players?.length) {
      console.log('No NFL players without positions found');
      return;
    }
    
    console.log(`Found ${players.length} NFL players without positions`);
    
    // Assign random positions (QB, RB, WR, TE) for demonstration
    const positions = ['QB', 'RB', 'WR', 'TE'];
    
    for (const player of players) {
      const position = positions[Math.floor(Math.random() * positions.length)];
      
      const { error: updateError } = await supabase
        .from('players')
        .update({ position })
        .eq('id', player.id);
      
      if (updateError) {
        console.error(`❌ Error updating position for ${player.name}:`, updateError);
      }
    }
    
    console.log('✅ NFL player positions updated');
    
  } catch (error) {
    console.error('❌ Error updating player positions:', (error as any)?.message || error);
  }
}

// Main function
async function main() {
  try {
    // First update player positions if needed
    await updatePlayerPositions();
    
    // Generate sample data
    const csvDir = path.join(__dirname, '../../../data/nfl_historical_stats');
    await generateSampleData(csvDir);
    
    // Import historical stats
    await importNFLHistoricalStats(csvDir);
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
main().then(() => {
  console.log('🏁 NFL historical stats import script finished');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
