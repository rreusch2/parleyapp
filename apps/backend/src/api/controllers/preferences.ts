import { Request, Response } from 'express';
import { supabaseAdmin } from '../../services/supabase/client';

interface UserPreferencesUpdate {
  sport_preferences?: {
    mlb?: boolean;
    nhl?: boolean;
    nfl?: boolean;
    cfb?: boolean;
    wnba?: boolean;
    ufc?: boolean;
  };
  betting_style?: 'conservative' | 'balanced' | 'aggressive';
  pick_distribution?: {
    auto: boolean;
    custom?: {
      mlb_team?: number;
      mlb_props?: number;
      wnba_team?: number;
      wnba_props?: number;
      ufc?: number;
    };
  };
  preferred_sports?: string[];
  preferred_bet_types?: string[];
  risk_tolerance?: string;
  max_daily_picks?: number;
  preferred_confidence_range?: {
    min: number;
    max: number;
  };
  phone_number?: string;
}

export const getUserPreferences = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select(`
        sport_preferences,
        betting_style,
        pick_distribution,
        preferred_sports,
        preferred_bet_types,
        risk_tolerance,
        max_daily_picks,
        preferred_confidence_range,
        phone_number,
        subscription_tier
      `)
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user preferences:', error);
      return res.status(500).json({ error: 'Failed to fetch user preferences' });
    }

    // Return preferences with defaults if not set
    const preferences = {
      sport_preferences: data?.sport_preferences || { mlb: true, nhl: true, nfl: true, cfb: false, wnba: false, ufc: false },
      betting_style: data?.betting_style || 'balanced',
      pick_distribution: data?.pick_distribution || { auto: true },
      preferred_sports: data?.preferred_sports || ['MLB', 'NHL', 'NFL'],
      preferred_bet_types: data?.preferred_bet_types || ['moneyline', 'spread', 'total'],
      risk_tolerance: data?.risk_tolerance || 'medium',
      max_daily_picks: data?.max_daily_picks || 20,
      preferred_confidence_range: data?.preferred_confidence_range || { min: 55, max: 100 },
      phone_number: data?.phone_number || null,
      subscription_tier: data?.subscription_tier || 'free'
    };

    res.json(preferences);
  } catch (error) {
    console.error('Error fetching user preferences:', error);
    res.status(500).json({ error: 'Failed to fetch user preferences' });
  }
};

export const createUserPreferences = async (req: Request, res: Response) => {
  // For new users, preferences are created during signup
  // This endpoint updates existing preferences
  return updateUserPreferences(req, res);
};

export const updateUserPreferences = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const updates: UserPreferencesUpdate = req.body;

    // Validate and sanitize the updates
    const validUpdates: any = {};

    if (updates.sport_preferences) {
      validUpdates.sport_preferences = updates.sport_preferences;
      // Update preferred_sports array based on sport_preferences
      validUpdates.preferred_sports = Object.keys(updates.sport_preferences)
        .filter(sport => updates.sport_preferences![sport as keyof typeof updates.sport_preferences])
        .map(sport => sport.toUpperCase());
    }

    if (updates.betting_style && ['conservative', 'balanced', 'aggressive'].includes(updates.betting_style)) {
      validUpdates.betting_style = updates.betting_style;
    }

    if (updates.pick_distribution) {
      validUpdates.pick_distribution = updates.pick_distribution;
    }

    if (updates.preferred_bet_types) {
      validUpdates.preferred_bet_types = updates.preferred_bet_types;
    }

    if (updates.risk_tolerance && ['low', 'medium', 'high'].includes(updates.risk_tolerance)) {
      validUpdates.risk_tolerance = updates.risk_tolerance;
    }

    if (updates.max_daily_picks && typeof updates.max_daily_picks === 'number') {
      validUpdates.max_daily_picks = Math.max(1, Math.min(50, updates.max_daily_picks));
    }

    if (updates.preferred_confidence_range) {
      validUpdates.preferred_confidence_range = {
        min: Math.max(0, Math.min(100, updates.preferred_confidence_range.min)),
        max: Math.max(0, Math.min(100, updates.preferred_confidence_range.max))
      };
    }

    if (updates.phone_number) {
      validUpdates.phone_number = updates.phone_number;
    }

    // Add updated_at timestamp
    validUpdates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(validUpdates)
      .eq('id', userId)
      .select(`
        sport_preferences,
        betting_style,
        pick_distribution,
        preferred_sports,
        preferred_bet_types,
        risk_tolerance,
        max_daily_picks,
        preferred_confidence_range,
        phone_number,
        subscription_tier
      `)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ error: 'User preferences not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error updating user preferences:', error);
    res.status(500).json({ error: 'Failed to update user preferences' });
  }
}; 