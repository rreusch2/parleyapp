-- Add welcome bonus tracking to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS welcome_bonus_claimed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS welcome_bonus_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_welcome_bonus 
ON public.profiles(welcome_bonus_claimed, welcome_bonus_expires_at) 
WHERE welcome_bonus_claimed = true;

-- Add helpful comments
COMMENT ON COLUMN public.profiles.welcome_bonus_claimed IS 'Whether user has claimed their welcome bonus from spinning wheel';
COMMENT ON COLUMN public.profiles.welcome_bonus_expires_at IS 'When the welcome bonus expires (24 hours from signup for fair trial period)';

-- Update existing users to have welcome bonus already expired (they've been using the app)
UPDATE public.profiles 
SET welcome_bonus_claimed = true, 
    welcome_bonus_expires_at = created_at + INTERVAL '1 day'
WHERE created_at < NOW() - INTERVAL '1 hour'; -- Only existing users from more than 1 hour ago

-- Verify the changes
SELECT 
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE welcome_bonus_claimed = true) as users_with_bonus_claimed,
    COUNT(*) FILTER (WHERE welcome_bonus_expires_at IS NOT NULL) as users_with_expiry
FROM public.profiles; 