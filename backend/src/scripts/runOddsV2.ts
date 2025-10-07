import dotenv from 'dotenv';
import path from 'path';
import { fetchAllGameData } from './fetchTheOddsGames';
import { aggregatePlayerPropsV2 } from './aggregatePlayerPropsV2';

// Load env from backend/.env so THEODDS_API_KEY and Supabase keys are available
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function main() {
  console.log('🚀 Running full odds + props v2 pipeline...');
  const args = process.argv.slice(2);
  const extendedNflWeek = args.includes('--nfl-week');
  let nflAheadDaysArg: number | undefined;
  const nflDaysArg = args.find((a) => a.startsWith('--nfl-days='));
  if (nflDaysArg) {
    const val = Number(nflDaysArg.split('=')[1]);
    if (!Number.isNaN(val) && val > 0) nflAheadDaysArg = val;
  }

  // 1) Fetch games and standard odds (h2h/spreads/totals)
  const gameCount = await fetchAllGameData(extendedNflWeek);
  console.log(`✅ Games fetch complete: ${gameCount} games.`);

  // 2) Fetch and aggregate player props across multiple bookmakers (main + alternates)
  await aggregatePlayerPropsV2(extendedNflWeek, nflAheadDaysArg);
  console.log('✅ Player props v2 aggregation complete.');
}

if (require.main === module) {
  main()
    .then(() => console.log('🎉 runOddsV2 complete'))
    .catch((err) => {
      console.error('❌ runOddsV2 failed:', (err as Error).message);
      process.exit(1);
    });
}
