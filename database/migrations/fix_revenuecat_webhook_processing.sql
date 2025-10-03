-- Migration to fix RevenueCat webhook processing for immediate subscription updates
-- This ensures INITIAL_PURCHASE webhooks immediately update user subscription tiers

-- Create a function to immediately process INITIAL_PURCHASE webhooks
CREATE OR REPLACE FUNCTION process_revenuecat_initial_purchase()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
  v_rc_customer_id text;
  v_tier text;
  v_entitlements jsonb;
  v_aliases jsonb;
  v_alias text;
BEGIN
  -- Only process INITIAL_PURCHASE events
  IF NEW.event_type != 'INITIAL_PURCHASE' THEN
    RETURN NEW;
  END IF;

  -- Extract data from event
  v_aliases := NEW.event_data->'aliases';
  v_entitlements := NEW.event_data->'entitlement_ids';
  
  -- Determine tier from entitlements
  IF v_entitlements ? 'elite' THEN
    v_tier := 'elite';
  ELSIF v_entitlements ? 'predictiveplaypro' THEN
    v_tier := 'pro';
  ELSE
    -- Log error and return
    UPDATE revenuecat_webhook_events
    SET processing_error = 'Unknown entitlement',
        retries = COALESCE(retries, 0) + 1
    WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  -- Extract RC customer ID (usually starts with $RCAnonymousID)
  v_rc_customer_id := NEW.event_data->>'original_app_user_id';
  
  -- Try to find user ID from aliases (the non-RC ID is usually the Supabase user ID)
  FOR v_alias IN SELECT jsonb_array_elements_text(v_aliases)
  LOOP
    -- Skip RevenueCat anonymous IDs
    IF v_alias NOT LIKE '$RCAnonymousID:%' THEN
      -- Try to parse as UUID (Supabase user ID)
      BEGIN
        v_user_id := v_alias::uuid;
        EXIT; -- Found valid UUID, exit loop
      EXCEPTION WHEN OTHERS THEN
        CONTINUE; -- Not a valid UUID, try next alias
      END;
    END IF;
  END LOOP;

  -- If we found a user ID, update their subscription
  IF v_user_id IS NOT NULL THEN
    -- Check if user exists
    IF EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id) THEN
      -- Build entitlements JSON
      v_entitlements := jsonb_build_object(
        'elite', (v_tier = 'elite'),
        'predictiveplaypro', (v_tier = 'pro')
      );
      
      -- Allow subscription_tier update within THIS transaction only
      PERFORM set_config('parley.allow_subscription_update','true', true);
      
      -- Update the profiles table directly for immediate effect
      UPDATE profiles
      SET 
        subscription_tier = v_tier,
        revenuecat_customer_id = v_rc_customer_id,
        revenuecat_entitlements = v_entitlements,
        subscription_status = 'active',
        subscription_source = 'revenuecat',
        updated_at = NOW()
      WHERE id = v_user_id;
      
      -- Update the webhook event as processed
      UPDATE revenuecat_webhook_events
      SET processed_at = NOW(),
          user_id = v_user_id,
          revenuecat_customer_id = v_rc_customer_id,
          processing_error = NULL
      WHERE id = NEW.id;
      
      RAISE NOTICE 'Successfully updated user % to tier %', v_user_id, v_tier;
    ELSE
      -- User not found
      UPDATE revenuecat_webhook_events
      SET processing_error = 'User not found in profiles table',
          retries = COALESCE(retries, 0) + 1
      WHERE id = NEW.id;
    END IF;
  ELSE
    -- No valid user ID found in aliases
    UPDATE revenuecat_webhook_events
    SET processing_error = 'No valid user ID in aliases',
        retries = COALESCE(retries, 0) + 1
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically process INITIAL_PURCHASE webhooks
DROP TRIGGER IF EXISTS process_initial_purchase_trigger ON revenuecat_webhook_events;
CREATE TRIGGER process_initial_purchase_trigger
AFTER INSERT ON revenuecat_webhook_events
FOR EACH ROW
WHEN (NEW.event_type = 'INITIAL_PURCHASE')
EXECUTE FUNCTION process_revenuecat_initial_purchase();

-- Also create a function to handle other webhook types (RENEWAL, CANCELLATION, etc.)
CREATE OR REPLACE FUNCTION process_revenuecat_subscription_events()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
  v_tier text;
  v_status text;
  v_entitlements jsonb;
  v_alias text;
BEGIN
  -- Skip INITIAL_PURCHASE (handled by separate trigger)
  IF NEW.event_type = 'INITIAL_PURCHASE' THEN
    RETURN NEW;
  END IF;

  -- Find user ID from aliases
  FOR v_alias IN SELECT jsonb_array_elements_text(NEW.event_data->'aliases')
  LOOP
    IF v_alias NOT LIKE '$RCAnonymousID:%' THEN
      BEGIN
        v_user_id := v_alias::uuid;
        EXIT;
      EXCEPTION WHEN OTHERS THEN
        CONTINUE;
      END;
    END IF;
  END LOOP;

  IF v_user_id IS NULL THEN
    UPDATE revenuecat_webhook_events
    SET processing_error = 'No valid user ID in aliases',
        retries = COALESCE(retries, 0) + 1
    WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  -- Determine action based on event type
  CASE NEW.event_type
    WHEN 'RENEWAL' THEN
      -- Renewal - keep existing tier, update status
      v_status := 'active';
    WHEN 'CANCELLATION' THEN
      -- Cancellation - mark as cancelled but keep tier until expiration
      v_status := 'cancelled';
    WHEN 'EXPIRATION' THEN
      -- Expiration - downgrade to free
      v_tier := 'free';
      v_status := 'expired';
    WHEN 'BILLING_ISSUE' THEN
      -- Billing issue - mark as past_due
      v_status := 'past_due';
    WHEN 'PRODUCT_CHANGE' THEN
      -- Product change - update tier based on new entitlements
      IF NEW.event_data->'entitlement_ids' ? 'elite' THEN
        v_tier := 'elite';
      ELSIF NEW.event_data->'entitlement_ids' ? 'predictiveplaypro' THEN
        v_tier := 'pro';
      ELSE
        v_tier := 'free';
      END IF;
      v_status := 'active';
  END CASE;

  -- Update user if found
  IF EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id) THEN
    -- Allow subscription_tier update
    PERFORM set_config('parley.allow_subscription_update','true', true);
    
    -- Update based on event type
    IF v_tier IS NOT NULL THEN
      -- Update tier (for EXPIRATION or PRODUCT_CHANGE)
      UPDATE profiles
      SET 
        subscription_tier = v_tier,
        subscription_status = v_status,
        updated_at = NOW()
      WHERE id = v_user_id;
    ELSIF v_status IS NOT NULL THEN
      -- Update status only (for RENEWAL, CANCELLATION, BILLING_ISSUE)
      UPDATE profiles
      SET 
        subscription_status = v_status,
        updated_at = NOW()
      WHERE id = v_user_id;
    END IF;
    
    -- Mark webhook as processed
    UPDATE revenuecat_webhook_events
    SET processed_at = NOW(),
        user_id = v_user_id,
        processing_error = NULL
    WHERE id = NEW.id;
  ELSE
    UPDATE revenuecat_webhook_events
    SET processing_error = 'User not found',
        retries = COALESCE(retries, 0) + 1
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for other subscription events
DROP TRIGGER IF EXISTS process_subscription_events_trigger ON revenuecat_webhook_events;
CREATE TRIGGER process_subscription_events_trigger
AFTER INSERT ON revenuecat_webhook_events
FOR EACH ROW
WHEN (NEW.event_type IN ('RENEWAL', 'CANCELLATION', 'EXPIRATION', 'BILLING_ISSUE', 'PRODUCT_CHANGE'))
EXECUTE FUNCTION process_revenuecat_subscription_events();

-- Process any unprocessed webhooks from the last 7 days
DO $$
DECLARE
  webhook_record RECORD;
  v_user_id uuid;
  v_tier text;
  v_entitlements jsonb;
  v_alias text;
BEGIN
  -- Process unprocessed INITIAL_PURCHASE webhooks
  FOR webhook_record IN 
    SELECT * FROM revenuecat_webhook_events 
    WHERE event_type = 'INITIAL_PURCHASE'
      AND (processed_at IS NULL OR user_id IS NULL)
      AND created_at > NOW() - INTERVAL '7 days'
  LOOP
    -- Determine tier
    IF webhook_record.event_data->'entitlement_ids' ? 'elite' THEN
      v_tier := 'elite';
    ELSIF webhook_record.event_data->'entitlement_ids' ? 'predictiveplaypro' THEN
      v_tier := 'pro';
    ELSE
      CONTINUE; -- Skip unknown entitlements
    END IF;
    
    -- Find user ID from aliases
    v_user_id := NULL;
    FOR v_alias IN SELECT jsonb_array_elements_text(webhook_record.event_data->'aliases')
    LOOP
      IF v_alias NOT LIKE '$RCAnonymousID:%' THEN
        BEGIN
          v_user_id := v_alias::uuid;
          EXIT;
        EXCEPTION WHEN OTHERS THEN
          CONTINUE;
        END;
      END IF;
    END LOOP;
    
    -- Update if user found
    IF v_user_id IS NOT NULL AND EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id) THEN
      v_entitlements := jsonb_build_object(
        'elite', (v_tier = 'elite'),
        'predictiveplaypro', (v_tier = 'pro')
      );
      
      -- Allow subscription_tier update
      PERFORM set_config('parley.allow_subscription_update','true', true);
      
      UPDATE profiles
      SET 
        subscription_tier = v_tier,
        revenuecat_customer_id = webhook_record.event_data->>'original_app_user_id',
        revenuecat_entitlements = v_entitlements,
        subscription_status = 'active',
        subscription_source = 'revenuecat',
        updated_at = NOW()
      WHERE id = v_user_id;
      
      UPDATE revenuecat_webhook_events
      SET 
        processed_at = NOW(),
        user_id = v_user_id,
        processing_error = NULL
      WHERE id = webhook_record.id;
      
      RAISE NOTICE 'Retroactively processed webhook % for user %', webhook_record.id, v_user_id;
    END IF;
  END LOOP;
END $$;

-- Create an index for faster webhook processing
CREATE INDEX IF NOT EXISTS idx_revenuecat_webhook_events_unprocessed 
ON revenuecat_webhook_events(event_type, processed_at) 
WHERE processed_at IS NULL;

-- Add a comment explaining the webhook processing
COMMENT ON FUNCTION process_revenuecat_initial_purchase IS 
'Automatically processes INITIAL_PURCHASE webhooks from RevenueCat to immediately update user subscription tiers to pro or elite based on entitlement_ids';
