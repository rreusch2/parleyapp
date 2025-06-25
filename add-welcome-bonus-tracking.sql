-- Add welcome bonus tracking to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS welcome_bonus_claimed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS welcome_bonus_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_welcome_bonus 
ON public.profiles(welcome_bonus_claimed, welcome_bonus_expires_at) 
WHERE welcome_bonus_claimed = true;

-- Add helpful comment
COMMENT ON COLUMN public.profiles.welcome_bonus_claimed IS 'Whether user has claimed their welcome bonus from spinning wheel';
COMMENT ON COLUMN public.profiles.welcome_bonus_expires_at IS 'When the welcome bonus expires (midnight of signup day)';

-- Update existing users to have welcome bonus already expired (they've been using the app)
UPDATE public.profiles 
SET welcome_bonus_claimed = true, 
    welcome_bonus_expires_at = created_at + INTERVAL '1 day'
WHERE welcome_bonus_claimed IS NULL OR welcome_bonus_claimed = false; 