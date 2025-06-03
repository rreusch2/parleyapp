import { Request, Response, NextFunction } from 'express';

export const validatePreferences = (req: Request, res: Response, next: NextFunction) => {
  const { risk_tolerance, sports, bet_types, max_bet_size } = req.body;

  const errors: string[] = [];

  // Validate risk_tolerance
  if (risk_tolerance && !['low', 'moderate', 'high'].includes(risk_tolerance)) {
    errors.push('risk_tolerance must be one of: low, moderate, high');
  }

  // Validate sports (should be an array of strings)
  if (sports && (!Array.isArray(sports) || !sports.every(sport => typeof sport === 'string'))) {
    errors.push('sports must be an array of strings');
  }

  // Validate bet_types (should be an array of strings)
  if (bet_types && (!Array.isArray(bet_types) || !bet_types.every(type => typeof type === 'string'))) {
    errors.push('bet_types must be an array of strings');
  }

  // Validate max_bet_size (should be a positive number)
  if (max_bet_size && (typeof max_bet_size !== 'number' || max_bet_size <= 0)) {
    errors.push('max_bet_size must be a positive number');
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  next();
}; 