-- Add missing columns to existing profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro')),
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add your default user if it doesn't exist
INSERT INTO public.profiles (id, username, email, subscription_tier, is_active) 
VALUES (
    'f08b56d3-d4ec-4815-b502-6647d723d2a6'::uuid,
    'reid_default',
    'reid@Predictive Play.com',
    'pro',
    true
) ON CONFLICT (id) DO UPDATE SET
    subscription_tier = EXCLUDED.subscription_tier,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

-- Show the updated table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND table_schema = 'public'
ORDER BY ordinal_position; 