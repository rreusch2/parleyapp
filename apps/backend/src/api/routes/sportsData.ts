import express from 'express';
import sportRadarService from '../../services/sportsData/sportRadarService';

const router = express.Router();

/**
 * GET /api/sports-data/sports
 * Get list of available sports
 */
router.get('/sports', async (req, res) => {
  try {
    const data = await sportRadarService.getAvailableSports();
    res.json(data);
  } catch (error) {
    console.error('Error fetching sports:', error);
    res.status(500).json({ error: 'Failed to fetch sports data' });
  }
});

/**
 * GET /api/sports-data/prematch
 * Get prematch sports data
 */
router.get('/prematch', async (req, res) => {
  try {
    const data = await sportRadarService.getPrematchSports();
    res.json(data);
  } catch (error) {
    console.error('Error fetching prematch sports:', error);
    res.status(500).json({ error: 'Failed to fetch prematch sports data' });
  }
});

/**
 * GET /api/sports-data/nba/hierarchy
 * Get NBA league hierarchy
 */
router.get('/nba/hierarchy', async (req, res) => {
  try {
    const data = await sportRadarService.getNbaHierarchy();
    res.json(data);
  } catch (error) {
    console.error('Error fetching NBA hierarchy:', error);
    res.status(500).json({ error: 'Failed to fetch NBA hierarchy data' });
  }
});

/**
 * GET /api/sports-data/mlb/hierarchy
 * Get MLB league hierarchy
 */
router.get('/mlb/hierarchy', async (req, res) => {
  try {
    const data = await sportRadarService.getMlbHierarchy();
    res.json(data);
  } catch (error) {
    console.error('Error fetching MLB hierarchy:', error);
    res.status(500).json({ error: 'Failed to fetch MLB hierarchy data' });
  }
});

/**
 * GET /api/sports-data/nhl/hierarchy
 * Get NHL league hierarchy
 */
router.get('/nhl/hierarchy', async (req, res) => {
  try {
    const data = await sportRadarService.getNhlHierarchy();
    res.json(data);
  } catch (error) {
    console.error('Error fetching NHL hierarchy:', error);
    res.status(500).json({ error: 'Failed to fetch NHL hierarchy data' });
  }
});

/**
 * GET /api/sports-data/nba/schedule/:year/:month/:day
 * Get NBA daily schedule
 */
router.get('/nba/schedule/:year/:month/:day', async (req, res) => {
  try {
    const { year, month, day } = req.params;
    const data = await sportRadarService.getNbaDailySchedule(year, month, day);
    res.json(data);
  } catch (error) {
    console.error('Error fetching NBA schedule:', error);
    res.status(500).json({ error: 'Failed to fetch NBA schedule data' });
  }
});

/**
 * GET /api/sports-data/nba/boxscore/:gameId
 * Get NBA game boxscore
 */
router.get('/nba/boxscore/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    const data = await sportRadarService.getNbaGameBoxscore(gameId);
    res.json(data);
  } catch (error) {
    console.error('Error fetching NBA boxscore:', error);
    res.status(500).json({ error: 'Failed to fetch NBA boxscore data' });
  }
});

/**
 * GET /api/sports-data/markets/player-props
 * Get player props markets
 */
router.get('/markets/player-props', async (req, res) => {
  try {
    const data = await sportRadarService.getPlayerPropsMarkets();
    res.json(data);
  } catch (error) {
    console.error('Error fetching player props markets:', error);
    res.status(500).json({ error: 'Failed to fetch player props markets data' });
  }
});

export default router; 