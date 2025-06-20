-- Simple profiles table (no RLS for now)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT,
    email TEXT,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disable RLS temporarily for testing
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Add your default user if it doesn't exist
INSERT INTO public.profiles (id, username, email, subscription_tier, is_active) 
VALUES (
    'f08b56d3-d4ec-4815-b502-6647d723d2a6'::uuid,
    'reid_default',
    'reid@parleyapp.com',
    'pro',
    true
) ON CONFLICT (id) DO UPDATE SET
    subscription_tier = EXCLUDED.subscription_tier,
    is_active = EXCLUDED.is_active,
    updated_at = NOW(); 