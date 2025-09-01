import type { User } from '@supabase/supabase-js'

// Augment Express Request type without shadowing the 'express' module
declare global {
  namespace Express {
    interface Request {
      user?: User
    }
  }
}
