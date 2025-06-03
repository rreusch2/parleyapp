import { Request, Response, NextFunction } from 'express';

export const validatePreferences = (req: Request, res: Response, next: NextFunction) => {
  const { risk_tolerance, sports, bet_types, max_bet_size } = req.body;

  const errors: string[] = [];

  // Validate risk_tolerance
  if (risk_tolerance && !['low', 'medium', 'high'].includes(risk_tolerance)) {
    errors.push('risk_tolerance must be one of: low, medium, high');
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

export const validatePrediction = (req: Request, res: Response, next: NextFunction) => {
  const { event_id, sport, pick, odds } = req.body;

  const errors: string[] = [];

  // Required fields
  if (!event_id) {
    errors.push('event_id is required');
  }

  if (!sport) {
    errors.push('sport is required');
  }

  if (!pick) {
    errors.push('pick is required');
  }

  if (!odds) {
    errors.push('odds is required');
  }

  // Validate confidence if provided
  if (req.body.confidence !== undefined) {
    const confidence = Number(req.body.confidence);
    if (isNaN(confidence) || confidence < 0 || confidence > 100) {
      errors.push('confidence must be a number between 0 and 100');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  next();
};

export const validateBet = (req: Request, res: Response, next: NextFunction) => {
  const { prediction_id, amount, odds } = req.body;
  
  const errors: string[] = [];
  
  // Required fields
  if (!prediction_id) {
    errors.push('prediction_id is required');
  }
  
  if (!amount) {
    errors.push('amount is required');
  } else {
    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      errors.push('amount must be a positive number');
    }
  }
  
  if (!odds) {
    errors.push('odds is required');
  } else {
    // Validate odds format (e.g., +150, -110)
    const oddsPattern = /^[+-]\d+$/;
    if (!oddsPattern.test(odds)) {
      errors.push('odds must be in American format (e.g., +150, -110)');
    }
  }
  
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }
  
  next();
}; 