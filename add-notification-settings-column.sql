
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{"ai_picks": true}';
