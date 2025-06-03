import { sportsDataService } from '../services/sportsData/sportsDataService';

async function main() {
  try {
    console.log('Starting sports data update...');
    await sportsDataService.runFullUpdate();
    console.log('Sports data update completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error updating sports data:', error);
    process.exit(1);
  }
}

main(); 