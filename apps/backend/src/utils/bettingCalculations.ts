/**
 * Calculate implied probability from American odds
 * @param americanOdds - American odds format (e.g. -110, +240)
 * @returns Implied probability as a decimal (0-1)
 */
export const calculateImpliedProbability = (americanOdds: number): number => {
  if (americanOdds === 0) return 0.5; // Edge case
  
  if (americanOdds > 0) {
    // Positive odds (underdog)
    return 100 / (americanOdds + 100);
  } else {
    // Negative odds (favorite)
    return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
  }
};

/**
 * Calculate potential payout from a bet
 * @param stake - Amount wagered
 * @param americanOdds - American odds format
 * @returns Potential payout (stake + profit)
 */
export const calculatePotentialPayout = (stake: number, americanOdds: number): number => {
  if (americanOdds > 0) {
    // Positive odds (underdog)
    return stake + (stake * (americanOdds / 100));
  } else {
    // Negative odds (favorite)
    return stake + (stake * (100 / Math.abs(americanOdds)));
  }
};

/**
 * Convert American odds to decimal odds
 * @param americanOdds - American odds format
 * @returns Decimal odds
 */
export const americanToDecimalOdds = (americanOdds: number): number => {
  if (americanOdds > 0) {
    return (americanOdds / 100) + 1;
  } else {
    return (100 / Math.abs(americanOdds)) + 1;
  }
};

/**
 * Convert decimal odds to American odds
 * @param decimalOdds - Decimal odds format
 * @returns American odds
 */
export const decimalToAmericanOdds = (decimalOdds: number): number => {
  if (decimalOdds >= 2) {
    return Math.round((decimalOdds - 1) * 100);
  } else {
    return Math.round(-100 / (decimalOdds - 1));
  }
};

/**
 * Calculate the expected value of a bet
 * @param stake - Amount wagered
 * @param winProbability - Actual probability of winning (0-1)
 * @param americanOdds - American odds format
 * @returns Expected value of the bet
 */
export const calculateExpectedValue = (
  stake: number, 
  winProbability: number, 
  americanOdds: number
): number => {
  const potentialProfit = calculatePotentialPayout(stake, americanOdds) - stake;
  const lossProbability = 1 - winProbability;
  
  return (winProbability * potentialProfit) - (lossProbability * stake);
};

/**
 * Determine if a bet has positive expected value
 * @param actualProbability - Your calculated probability of the outcome (0-1)
 * @param impliedProbability - The implied probability from the odds (0-1)
 * @returns True if the bet has positive expected value
 */
export const hasPositiveEV = (actualProbability: number, impliedProbability: number): boolean => {
  return actualProbability > impliedProbability;
};

/**
 * Calculate the Kelly Criterion bet size
 * @param bankroll - Total bankroll available
 * @param winProbability - Probability of winning (0-1)
 * @param americanOdds - American odds format
 * @returns Recommended bet size as a percentage of bankroll
 */
export const calculateKellyCriterion = (
  bankroll: number, 
  winProbability: number, 
  americanOdds: number
): number => {
  const decimalOdds = americanToDecimalOdds(americanOdds);
  const lossProbability = 1 - winProbability;
  
  // Kelly formula: (bp - q) / b
  // where b = decimal odds - 1, p = win probability, q = loss probability
  const b = decimalOdds - 1;
  const kellyPercentage = ((b * winProbability) - lossProbability) / b;
  
  // Cap at 0 (no negative bets) and typically limit to half Kelly for safety
  return Math.max(0, kellyPercentage) / 2;
};

/**
 * Calculate the no-vig fair odds
 * @param homeOdds - American odds for home team
 * @param awayOdds - American odds for away team
 * @returns Array of [fairHomeOdds, fairAwayOdds] in American format
 */
export const calculateNoVigOdds = (homeOdds: number, awayOdds: number): [number, number] => {
  const homeImpliedProb = calculateImpliedProbability(homeOdds);
  const awayImpliedProb = calculateImpliedProbability(awayOdds);
  
  // Calculate the vig (overround)
  const overround = homeImpliedProb + awayImpliedProb;
  
  // Calculate fair probabilities
  const fairHomeProb = homeImpliedProb / overround;
  const fairAwayProb = awayImpliedProb / overround;
  
  // Convert back to American odds
  const fairHomeOdds = probToAmericanOdds(fairHomeProb);
  const fairAwayOdds = probToAmericanOdds(fairAwayProb);
  
  return [fairHomeOdds, fairAwayOdds];
};

/**
 * Convert probability to American odds
 * @param probability - Probability as decimal (0-1)
 * @returns American odds
 */
export const probToAmericanOdds = (probability: number): number => {
  if (probability <= 0 || probability >= 1) {
    throw new Error('Probability must be between 0 and 1 exclusive');
  }
  
  if (probability > 0.5) {
    // Favorite
    return Math.round(-100 * probability / (1 - probability));
  } else {
    // Underdog
    return Math.round(100 * (1 - probability) / probability);
  }
}; 