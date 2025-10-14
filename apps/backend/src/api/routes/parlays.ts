import express from 'express';
import { supabase } from '../../services/supabase/client';
import { createLogger } from '../../utils/logger';

const router = express.Router();
const logger = createLogger('parlayRoutes');

/**
 * @route GET /api/parlays
 * @desc Get user's parlays
 * @access Private
 */
router.get('/', async (req, res) => {
  try {
    const { user_id, status, limit = 50 } = req.query;
    
    if (!user_id) {
      return res.status(400).json({ success: false, error: 'user_id is required' });
    }
    
    let query = supabase
      .from('parlays')
      .select(`
        *,
        parlay_legs (
          *,
          players (
            name,
            team,
            sport,
            position
          )
        )
      `)
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(Number(limit));
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data: parlays, error } = await query;
    
    if (error) {
      logger.error('Error fetching parlays:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch parlays' });
    }
    
    return res.status(200).json({ success: true, parlays });
  } catch (error) {
    logger.error(`Error in GET /parlays: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @route POST /api/parlays
 * @desc Create a new parlay
 * @access Private
 */
router.post('/', async (req, res) => {
  try {
    const { 
      user_id, 
      parlay_name, 
      legs, 
      stake_amount,
      is_same_game_parlay = false 
    } = req.body;
    
    if (!user_id || !legs || !Array.isArray(legs) || legs.length < 2) {
      return res.status(400).json({ 
        success: false, 
        error: 'user_id and at least 2 legs are required' 
      });
    }
    
    if (legs.length > 12) {
      return res.status(400).json({ 
        success: false, 
        error: 'Maximum 12 legs allowed in a parlay' 
      });
    }
    
    // Calculate combined odds
    const combinedDecimalOdds = legs.reduce((total, leg) => {
      const decimalOdds = convertAmericanToDecimal(leg.odds);
      return total * decimalOdds;
    }, 1);
    
    const combinedAmericanOdds = convertDecimalToAmerican(combinedDecimalOdds);
    const potentialPayout = stake_amount ? stake_amount * combinedDecimalOdds : null;
    
    // Create the parlay
    const { data: parlay, error: parlayError } = await supabase
      .from('parlays')
      .insert({
        user_id,
        parlay_name: parlay_name || `${legs.length}-Leg Parlay`,
        total_legs: legs.length,
        combined_odds: combinedAmericanOdds,
        decimal_odds: combinedDecimalOdds,
        stake_amount,
        potential_payout: potentialPayout,
        legs_pending: legs.length,
        is_same_game_parlay
      })
      .select()
      .single();
    
    if (parlayError) {
      logger.error('Error creating parlay:', parlayError);
      return res.status(500).json({ success: false, error: 'Failed to create parlay' });
    }
    
    // Create parlay legs
    const parlayLegs = legs.map((leg, index) => ({
      parlay_id: parlay.id,
      leg_number: index + 1,
      bet_type: leg.bet_type,
      market_reference_id: leg.market_reference_id || null,
      selection: leg.selection,
      odds: leg.odds,
      decimal_odds: convertAmericanToDecimal(leg.odds),
      game_info: leg.game_info || {},
      player_info: leg.player_info || {}
    }));
    
    const { data: createdLegs, error: legsError } = await supabase
      .from('parlay_legs')
      .insert(parlayLegs)
      .select();
    
    if (legsError) {
      logger.error('Error creating parlay legs:', legsError);
      // Clean up the parlay if legs creation failed
      await supabase.from('parlays').delete().eq('id', parlay.id);
      return res.status(500).json({ success: false, error: 'Failed to create parlay legs' });
    }
    
    return res.status(201).json({ 
      success: true, 
      parlay: {
        ...parlay,
        parlay_legs: createdLegs
      }
    });
  } catch (error) {
    logger.error(`Error in POST /parlays: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @route GET /api/parlays/:parlayId
 * @desc Get a specific parlay with all details
 * @access Private
 */
router.get('/:parlayId', async (req, res) => {
  try {
    const { parlayId } = req.params;
    const { user_id } = req.query;
    
    const { data: parlay, error } = await supabase
      .from('parlays')
      .select(`
        *,
        parlay_legs (
          *,
          players (
            name,
            team,
            sport,
            position,
            jersey_number
          )
        )
      `)
      .eq('id', parlayId)
      .eq('user_id', user_id)
      .single();
    
    if (error) {
      logger.error('Error fetching parlay:', error);
      return res.status(404).json({ success: false, error: 'Parlay not found' });
    }
    
    return res.status(200).json({ success: true, parlay });
  } catch (error) {
    logger.error(`Error in GET /parlays/:parlayId: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @route PUT /api/parlays/:parlayId/leg/:legId/status
 * @desc Update the status of a parlay leg (used when games settle)
 * @access Private
 */
router.put('/:parlayId/leg/:legId/status', async (req, res) => {
  try {
    const { parlayId, legId } = req.params;
    const { status, result_value } = req.body;
    
    if (!['won', 'lost', 'pushed'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Status must be won, lost, or pushed' 
      });
    }
    
    // Update the leg status
    const { data: updatedLeg, error: legError } = await supabase
      .from('parlay_legs')
      .update({ 
        status, 
        result_value,
        updated_at: new Date().toISOString()
      })
      .eq('id', legId)
      .eq('parlay_id', parlayId)
      .select()
      .single();
    
    if (legError) {
      logger.error('Error updating parlay leg:', legError);
      return res.status(500).json({ success: false, error: 'Failed to update parlay leg' });
    }
    
    // The trigger will automatically update the parlay status
    // Fetch the updated parlay
    const { data: updatedParlay, error: parlayError } = await supabase
      .from('parlays')
      .select(`
        *,
        parlay_legs (*)
      `)
      .eq('id', parlayId)
      .single();
    
    if (parlayError) {
      logger.error('Error fetching updated parlay:', parlayError);
    }
    
    return res.status(200).json({ 
      success: true, 
      leg: updatedLeg,
      parlay: updatedParlay
    });
  } catch (error) {
    logger.error(`Error in PUT /parlays/:parlayId/leg/:legId/status: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @route DELETE /api/parlays/:parlayId
 * @desc Cancel/delete a parlay (only if all legs are still pending)
 * @access Private
 */
router.delete('/:parlayId', async (req, res) => {
  try {
    const { parlayId } = req.params;
    const { user_id } = req.query;
    
    // Check if parlay exists and belongs to user
    const { data: parlay, error: fetchError } = await supabase
      .from('parlays')
      .select('*, parlay_legs(*)')
      .eq('id', parlayId)
      .eq('user_id', user_id)
      .single();
    
    if (fetchError || !parlay) {
      return res.status(404).json({ success: false, error: 'Parlay not found' });
    }
    
    // Check if any legs have already settled
    const settledLegs = parlay.parlay_legs.filter((leg: any) => leg.status !== 'pending');
    if (settledLegs.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot cancel parlay with settled legs' 
      });
    }
    
    // Update status to cancelled instead of deleting
    const { error: updateError } = await supabase
      .from('parlays')
      .update({ status: 'cancelled' })
      .eq('id', parlayId);
    
    if (updateError) {
      logger.error('Error cancelling parlay:', updateError);
      return res.status(500).json({ success: false, error: 'Failed to cancel parlay' });
    }
    
    return res.status(200).json({ success: true, message: 'Parlay cancelled successfully' });
  } catch (error) {
    logger.error(`Error in DELETE /parlays/:parlayId: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * @route POST /api/parlays/quick-build
 * @desc Build a parlay from AI recommendations
 * @access Private
 */
router.post('/quick-build', async (req, res) => {
  try {
    const { user_id, criteria, max_legs = 6 } = req.body;
    
    if (!user_id) {
      return res.status(400).json({ success: false, error: 'user_id is required' });
    }
    
    // Get high-confidence AI predictions
    let query = supabase
      .from('ai_predictions')
      .select(`
        *,
        players (
          name,
          team,
          sport,
          position
        )
      `)
      .eq('status', 'pending')
      .gte('confidence', criteria?.min_confidence || 70)
      .order('confidence', { ascending: false })
      .limit(max_legs);
    
    if (criteria?.sport) {
      query = query.eq('sport', criteria.sport);
    }
    
    if (criteria?.bet_types) {
      query = query.in('bet_type', criteria.bet_types);
    }
    
    const { data: predictions, error } = await query;
    
    if (error) {
      logger.error('Error fetching predictions for parlay:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch predictions' });
    }
    
    if (!predictions || predictions.length < 2) {
      return res.status(400).json({ 
        success: false, 
        error: 'Not enough high-confidence predictions available for parlay' 
      });
    }
    
    // Convert predictions to parlay legs
    const legs = predictions.map(pred => ({
      bet_type: pred.bet_type,
      selection: pred.pick,
      odds: pred.odds,
      game_info: {
        teams: pred.match_teams,
        sport: pred.sport,
        event_time: pred.event_time
      },
      player_info: pred.players ? {
        name: pred.players.name,
        team: pred.players.team,
        position: pred.players.position
      } : null,
      confidence: pred.confidence,
      reasoning: pred.reasoning
    }));
    
    // Calculate combined odds and suggest stake
    const combinedDecimalOdds = legs.reduce((total, leg) => {
      return total * convertAmericanToDecimal(leg.odds);
    }, 1);
    
    const suggestedStake = calculateSuggestedStake(combinedDecimalOdds, legs.length);
    
    return res.status(200).json({ 
      success: true, 
      suggested_parlay: {
        legs,
        combined_odds: convertDecimalToAmerican(combinedDecimalOdds),
        decimal_odds: combinedDecimalOdds,
        suggested_stake: suggestedStake,
        potential_payout: suggestedStake * combinedDecimalOdds,
        total_legs: legs.length,
        avg_confidence: legs.reduce((sum, leg) => sum + leg.confidence, 0) / legs.length
      }
    });
  } catch (error) {
    logger.error(`Error in POST /parlays/quick-build: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Helper functions
function convertAmericanToDecimal(americanOdds: string): number {
  const odds = parseInt(americanOdds.replace(/[+\-]/g, ''));
  
  if (americanOdds.startsWith('+')) {
    return (odds / 100) + 1;
  } else {
    return (100 / odds) + 1;
  }
}

function convertDecimalToAmerican(decimalOdds: number): string {
  if (decimalOdds >= 2) {
    return `+${Math.round((decimalOdds - 1) * 100)}`;
  } else {
    return `-${Math.round(100 / (decimalOdds - 1))}`;
  }
}

function calculateSuggestedStake(combinedOdds: number, numLegs: number): number {
  // Conservative stake calculation based on Kelly Criterion principles
  const baseStake = 25; // Base $25
  const oddsMultiplier = Math.min(combinedOdds / 10, 2); // Cap multiplier at 2x
  const legsPenalty = Math.max(1 - (numLegs - 2) * 0.1, 0.5); // Reduce stake for more legs
  
  return Math.round(baseStake * oddsMultiplier * legsPenalty);
}

export default router; 