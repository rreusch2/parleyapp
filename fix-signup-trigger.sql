-- Fix the signup trigger to match current profiles table schema
-- This will replace the existing handle_new_user function

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert into profiles table with all required fields
    INSERT INTO public.profiles (
        id, 
        username, 
        email,
        avatar_url,
        created_at,
        updated_at,
        risk_tolerance,
        favorite_teams,
        favorite_players,
        preferred_bet_types,
        preferred_sports,
        preferred_bookmakers,
        subscription_tier,
        is_active,
        welcome_bonus_claimed,
        welcome_bonus_expires_at,
        push_token,
        admin_role
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)), -- Use email prefix if no username
        NEW.email,
        NULL, -- avatar_url
        NOW(), -- created_at
        NOW(), -- updated_at
        'medium', -- risk_tolerance default
        '{}', -- favorite_teams empty array
        '{}', -- favorite_players empty array
        '{moneyline,spread,total}', -- preferred_bet_types default
        '{MLB}', -- preferred_sports default to MLB since that's your focus
        '{}', -- preferred_bookmakers empty array
        'free', -- subscription_tier default
        true, -- is_active default
        false, -- welcome_bonus_claimed default
        NOW() + INTERVAL '30 days', -- welcome_bonus_expires_at (30 days from now)
        NULL, -- push_token
        false -- admin_role default
    );
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail the user creation
        RAISE LOG 'Error in handle_new_user: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON public.profiles TO anon, authenticated;
