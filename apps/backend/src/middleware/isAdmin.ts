import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabaseClient';

export const isAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const { userId } = req;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: User not authenticated' });
  }

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('admin_role')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    if (profile.admin_role !== true) {
      return res.status(403).json({ error: 'Forbidden: User is not an admin' });
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
};
