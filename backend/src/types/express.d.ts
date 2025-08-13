import type { User } from '@supabase/supabase-js'

// Augment Express Request type without shadowing the 'express' module
declare module 'express-serve-static-core' {
  interface Request {
    user?: User
  }
}

export {}
