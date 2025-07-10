import { Request, Response } from 'express';
import { supabase } from '../../services/supabase/client';

export const getUserPreferences = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', (req as any).user.id)
      .single();

    if (error) throw error;

    res.json(data || {});
  } catch (error) {
    console.error('Error fetching user preferences:', error);
    res.status(500).json({ error: 'Failed to fetch user preferences' });
  }
};

export const createUserPreferences = async (req: Request, res: Response) => {
  try {
    const preferences = {
      user_id: (req as any).user.id,
      ...req.body
    };

    const { data, error } = await supabase
      .from('user_preferences')
      .insert(preferences)
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error) {
    console.error('Error creating user preferences:', error);
    res.status(500).json({ error: 'Failed to create user preferences' });
  }
};

export const updateUserPreferences = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('user_preferences')
      .update(req.body)
      .eq('user_id', (req as any).user.id)
      .select()
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