-- Simplify notification settings to just ai_picks
-- This script updates existing records and sets new default

BEGIN;

-- Update existing profiles to have just ai_picks
UPDATE public.profiles 
SET notification_settings = '{"ai_picks": true}'::jsonb
WHERE notification_settings IS NOT NULL;

-- Update profiles with null notification_settings
UPDATE public.profiles 
SET notification_settings = '{"ai_picks": true}'::jsonb
WHERE notification_settings IS NULL;

-- Update the column default for new users
ALTER TABLE public.profiles 
ALTER COLUMN notification_settings 
SET DEFAULT '{"ai_picks": true}'::jsonb;

COMMIT;

-- Verify the changes
SELECT 
  id,
  notification_settings,
  created_at
FROM public.profiles 
ORDER BY created_at DESC 
LIMIT 5;
