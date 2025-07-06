import { Request, Response } from 'express';
import { sportsDataService } from '../../services/sportsData/sportsDataService';

export const triggerSportsDataUpdate = async (req: Request, res: Response) => {
  try {
    const { sport: targetSport } = req.query; // Renamed to avoid conflict with service sport
    
    if (targetSport && typeof targetSport === 'string') {
      const sportMapping: {[key: string]: { id: number, name: string }} = {
        'football': { id: 1, name: 'football' }, 
        'basketball': { id: 12, name: 'basketball' },
        'baseball': { id: 1, name: 'baseball' }, 
        'hockey': { id: 57, name: 'hockey' },
        'soccer': {id: 39, name: 'soccer'} // Example: English Premier League for soccer
      };
      
      if (!sportMapping[targetSport]) {
        return res.status(400).json({ 
          error: `Unsupported sport: ${targetSport}. Supported sports are: ${Object.keys(sportMapping).join(', ')}` 
        });
      }
      
      console.log(`Manually triggering update for ${targetSport}`);
      // Use the name from sportMapping for the service call, which matches sport API categories
      await sportsDataService.fetchAndStoreUpcomingGames(
        sportMapping[targetSport].id,
        sportMapping[targetSport].name,
        14
      );
      
      return res.json({ message: `Sports data update for ${targetSport} completed successfully` });
    } else {
      console.log('Manually triggering full sports data update');
      await sportsDataService.runFullUpdate();
      return res.json({ message: 'Full sports data update completed successfully' });
    }
  } catch (error: any) {
    console.error('Error triggering sports data update:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: error.message || 'Failed to update sports data' });
  }
};

export const getLeaguesAdmin = async (req: Request, res: Response) => {
  try {
    const { country, sport = 'soccer' } = req.query; 
    
    console.log('Fetching leagues (admin)', sport ? `for sport: ${sport}`: '', country ? `for country: ${country}` : 'for all countries');
    const sportString = typeof sport === 'string' ? sport : 'soccer';
    const countryString = typeof country === 'string' ? country : undefined;

    const leaguesData = await sportsDataService.fetchLeagues(sportString, countryString);
    
    // The sportsDataService.fetchLeagues now returns the raw API response which includes `response.data` or just `response` array.
    // Let's ensure we send back the actual list of leagues.
    // Based on apiSportsClient, it should be leaguesData.response or just leaguesData if it's already the array.
    if (leaguesData && leaguesData.response) {
      res.json(leaguesData.response);
    } else if (Array.isArray(leaguesData)) {
      res.json(leaguesData);
    } else {
      res.json(leaguesData); // Send as is, might contain errors or be empty
    }

  } catch (error: any) {
    console.error('Error fetching leagues (admin):', error.response ? error.response.data : error.message);
    res.status(500).json({ error: error.message || 'Failed to fetch leagues' });
  }
};

export const updateGameStatuses = async (req: Request, res: Response) => {
  try {
    console.log('Manually triggering game status updates');
    await sportsDataService.updateGameStatuses();
    res.json({ message: 'Game status updates completed successfully' });
  } catch (error: any) {
    console.error('Error updating game statuses:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: error.message || 'Failed to update game statuses' });
  }
}; 