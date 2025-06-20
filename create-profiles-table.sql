-- Create profiles table for user data
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE,
    email TEXT,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default user for testing
INSERT INTO public.profiles (id, username, email, subscription_tier, is_active) 
VALUES (
    'f08b56d3-d4ec-4815-b502-6647d723d2a6', 
    'default_user', 
    'default@parleyapp.com', 
    'free', 
    true
) ON CONFLICT (id) DO NOTHING;

-- Insert the current new user
INSERT INTO public.profiles (id, username, email, subscription_tier, is_active) 
VALUES (
    '052455e8-84fb-4860-8538-f491bc0bbcaa', 
    'new_user_052455', 
    'user052455@parleyapp.com', 
    'free', 
    true
) ON CONFLICT (id) DO NOTHING;

-- Enable RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policy for users to read their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

-- Create policy for users to update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Create policy for service role to read all profiles (for backend)
CREATE POLICY "Service role can read all profiles" ON public.profiles
    FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.profiles TO anon;
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Create function to update updated_at column
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER handle_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at(); 