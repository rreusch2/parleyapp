import dotenv from 'dotenv';
import path from 'path';
import { fetchAllGameData } from './fetchTheOddsGames';
import { aggregatePlayerPropsV2 } from './aggregatePlayerPropsV2';

// Load env from backend/.env so THEODDS_API_KEY and Supabase keys are available
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function main() {
  const args = process.argv.slice(2);
  
  // Parse command-line arguments
  const extendedNflWeek = args.includes('--nfl-week');
  const gamesOnly = args.includes('--games-only');
  const propsOnly = args.includes('--props-only');
  
  // Parse NFL ahead days
  let nflAheadDaysArg: number | undefined;
  const nflDaysArg = args.find((a) => a.startsWith('--nfl-days='));
  if (nflDaysArg) {
    const val = Number(nflDaysArg.split('=')[1]);
    if (!Number.isNaN(val) && val > 0) nflAheadDaysArg = val;
  }

  // Parse sport filters (e.g., --sports=cfb,nhl)
  let sportFilters: string[] | undefined;
  const sportsArg = args.find((a) => a.startsWith('--sports='));
  if (sportsArg) {
    const sports = sportsArg.split('=')[1];
    sportFilters = sports.split(',').map(s => s.trim().toUpperCase());
    console.log(`🎯 Filtering to sports: ${sportFilters.join(', ')}`);
  }

  console.log('🚀 Running odds v2 pipeline...');
  if (gamesOnly && propsOnly) {
    console.error('❌ Cannot use both --games-only and --props-only');
    process.exit(1);
  }

  // Determine what to fetch
  const fetchGames = !propsOnly;
  const fetchProps = !gamesOnly;

  if (fetchGames) {
    console.log('📊 Fetching game odds (h2h/spreads/totals)...');
    const gameCount = await fetchAllGameData(extendedNflWeek, sportFilters);
    console.log(`✅ Games fetch complete: ${gameCount} games.`);
  } else {
    console.log('⏭️  Skipping game odds fetch');
  }

  if (fetchProps) {
    console.log('🎲 Fetching player props...');
    await aggregatePlayerPropsV2(extendedNflWeek, nflAheadDaysArg, sportFilters);
    console.log('✅ Player props v2 aggregation complete.');
  } else {
    console.log('⏭️  Skipping player props fetch');
  }
}

if (require.main === module) {
  main()
    .then(() => console.log('🎉 runOddsV2 complete'))
    .catch((err) => {
      console.error('❌ runOddsV2 failed:', (err as Error).message);
      process.exit(1);
    });
}
