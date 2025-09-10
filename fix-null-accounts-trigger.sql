-- Fix NULL account creation by adding email validation to signup trigger
-- This prevents profiles from being created when email is NULL

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- CRITICAL FIX: Only create profile if email is valid
    IF NEW.email IS NULL OR NEW.email = '' THEN
        RAISE LOG 'Skipping profile creation for user % - email is NULL or empty', NEW.id;
        RETURN NEW;
    END IF;
    
    -- Additional validation: ensure email looks valid
    IF NEW.email !~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$' THEN
        RAISE LOG 'Skipping profile creation for user % - invalid email format: %', NEW.id, NEW.email;
        RETURN NEW;
    END IF;
    
    -- Insert into profiles table with all required fields (only for valid users)
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
        admin_role,
        sport_preferences,
        betting_style,
        pick_distribution,
        max_daily_picks,
        preferred_confidence_range,
        trial_used,
        phone_verified,
        daily_chat_messages,
        last_chat_reset,
        chat_timezone,
        base_subscription_tier,
        temporary_tier_active,
        auto_renew_enabled
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)), -- Use email prefix if no username
        NEW.email, -- Now guaranteed to be valid
        NULL, -- avatar_url
        NOW(), -- created_at
        NOW(), -- updated_at
        'medium', -- risk_tolerance default
        '{}', -- favorite_teams empty array
        '{}', -- favorite_players empty array
        '{moneyline,spread,total}', -- preferred_bet_types default
        '{MLB}', -- preferred_sports default to MLB
        '{}', -- preferred_bookmakers empty array
        'free', -- subscription_tier default
        true, -- is_active default
        false, -- welcome_bonus_claimed default
        NOW() + INTERVAL '30 days', -- welcome_bonus_expires_at (30 days from now)
        NULL, -- push_token
        false, -- admin_role default
        '{"mlb": true, "wnba": false, "ufc": false}', -- sport_preferences default
        'balanced', -- betting_style default
        '{"auto": true}', -- pick_distribution default
        20, -- max_daily_picks default
        '{"min": 55, "max": 100}', -- preferred_confidence_range default
        false, -- trial_used default
        false, -- phone_verified default
        0, -- daily_chat_messages default
        NOW(), -- last_chat_reset
        'America/New_York', -- chat_timezone default
        'free', -- base_subscription_tier default
        false, -- temporary_tier_active default
        true -- auto_renew_enabled default
    );
    
    RAISE LOG 'Profile created successfully for user % with email %', NEW.id, NEW.email;
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail the user creation
        RAISE LOG 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
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
