import { Request, Response, NextFunction } from 'express';
import logger from '../../utils/logger';

/**
 * Middleware to validate and sanitize user data to prevent null/undefined values
 * that could crash the frontend
 */
export const validateUserData = (req: Request, res: Response, next: NextFunction) => {
  try {
    // For any endpoint that returns user data, ensure no null values
    const originalJson = res.json;
    
    res.json = function(data: any) {
      // Sanitize common user-related fields
      if (data && data.profile) {
        data.profile = sanitizeProfile(data.profile);
      }
      
      if (data && data.user) {
        data.user = sanitizeProfile(data.user);
      }
      
      if (data && data.predictions && Array.isArray(data.predictions)) {
        data.predictions = data.predictions.map(sanitizePrediction);
      }
      
      if (data && data.picks && Array.isArray(data.picks)) {
        data.picks = data.picks.map(sanitizePrediction);
      }
      
      return originalJson.call(this, data);
    };
    
    next();
  } catch (error) {
    logger.error('Error in validateUserData middleware:', error);
    next();
  }
};

function sanitizeProfile(profile: any) {
  if (!profile) return profile;
  
  return {
    ...profile,
    id: profile.id || '',
    email: profile.email || '',
    subscription_tier: profile.subscription_tier || 'free',
    welcome_bonus_claimed: profile.welcome_bonus_claimed ?? false,
    welcome_bonus_expires_at: profile.welcome_bonus_expires_at || null,
    created_at: profile.created_at || new Date().toISOString(),
    updated_at: profile.updated_at || new Date().toISOString()
  };
}

function sanitizePrediction(prediction: any) {
  if (!prediction) return prediction;
  
  return {
    ...prediction,
    id: prediction.id || '',
    pick: prediction.pick || 'Pick unavailable',
    odds: prediction.odds || 'N/A',
    confidence: prediction.confidence || 0,
    match_teams: prediction.match_teams || prediction.match || 'Unknown Match',
    bet_type: prediction.bet_type || 'unknown',
    sport: prediction.sport || 'MLB',
    created_at: prediction.created_at || new Date().toISOString()
  };
}