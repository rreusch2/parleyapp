import express, { Request, Response, Router } from 'express';
import { geminiOrchestrator, GeneratePredictionParams } from '../ai/orchestrator/geminiOrchestrator';
// import { authenticateToken } from '../middleware/authMiddleware'; // Assuming you have auth middleware

const router: Router = express.Router();

/**
 * POST /api/predict
 * Endpoint to get an AI-generated sports prediction.
 * Requires authentication.
 * Request Body:
 * {
 *   "userId": "string", (Usually extracted from authenticated token, not passed in body)
 *   "gameId": "string",
 *   "userQuery": "string", (e.g., "Give me a pick for this game", "Suggest a player prop for LeBron James")
 *   "gameDetails": {
 *      "homeTeam": "string",
 *      "awayTeam": "string",
 *      "sport": "string" // e.g., NBA, NFL
 *   }
 * }
 */
router.post('/predict', /* authenticateToken, */ async (req: Request, res: Response) => {
  const { gameId, userQuery, gameDetails } = req.body;
  
  // In a real app, userId should be derived from the authenticated session (e.g., req.user.id)
  // For now, we might expect it in the body or use a placeholder if auth is not yet fully integrated here.
  const userId = req.body.userId || (req as any).user?.id || 'test-user-id'; 

  if (!gameId || !userQuery || !gameDetails) {
    return res.status(400).json({
      error: 'Missing required fields: gameId, userQuery, and gameDetails are required.',
    });
  }
  
  if (!gameDetails.homeTeam || !gameDetails.awayTeam || !gameDetails.sport) {
    return res.status(400).json({
        error: 'Missing required fields in gameDetails: homeTeam, awayTeam, and sport are required.',
      });
  }

  try {
    const predictionParams: GeneratePredictionParams = {
      userId,
      gameId,
      userQuery,
      gameDetails: {
        homeTeam: gameDetails.homeTeam,
        awayTeam: gameDetails.awayTeam,
        sport: gameDetails.sport,
      }
    };

    const prediction = await geminiOrchestrator.generatePrediction(predictionParams);

    if (prediction.error) {
      // Errors from the orchestrator might be user-facing (e.g., parse error) or internal
      console.error('[PredictionRoute] Error from orchestrator:', prediction.error, prediction.debug_info, prediction.raw_response);
      // Determine appropriate status code based on error type if possible
      return res.status(500).json(prediction); 
    }

    return res.status(200).json(prediction);
  } catch (error: any) {
    console.error('[PredictionRoute] Unexpected error in /predict endpoint:', error);
    return res.status(500).json({
      error: 'An unexpected error occurred while generating the prediction.',
      details: error.message,
    });
  }
});

export default router; 