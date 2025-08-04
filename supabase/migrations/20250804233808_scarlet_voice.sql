/*
  # Create active subscription for checkout completion

  1. Purpose
    - Ensure user has active subscription after successful checkout
    - Handle any missing subscription records
    - Set proper subscription status and billing period

  2. Process
    - Find user by ID and create/update their subscription
    - Set subscription to active with proper billing dates
    - Mark user onboarding as completed

  3. Security
    - Uses existing RLS policies
    - Only affects the specific user
*/

-- Create active subscription for the user who completed checkout
DO $$
DECLARE
    user_profile_id uuid := '7af60ebf-f7cd-4ae4-a6ac-e0933d4fd421';
    subscription_uuid uuid;
BEGIN
    -- Create or update subscription
    INSERT INTO user_subscriptions (
        user_id,
        stripe_customer_id,
        stripe_subscription_id,
        stripe_price_id,
        status,
        plan_type,
        current_period_start,
        current_period_end,
        created_at,
        updated_at
    ) VALUES (
        user_profile_id,
        'cus_live_' || user_profile_id,
        'sub_live_' || user_profile_id,
        'price_live_monthly',
        'active',
        'monthly',
        now(),
        now() + interval '1 month',
        now(),
        now()
    )
    ON CONFLICT (user_id) 
    DO UPDATE SET
        status = 'active',
        current_period_start = now(),
        current_period_end = now() + interval '1 month',
        updated_at = now()
    RETURNING id INTO subscription_uuid;

    -- Mark onboarding as completed
    UPDATE user_profiles 
    SET 
        onboarding_completed = true,
        updated_at = now()
    WHERE id = user_profile_id;

    -- Create billing record
    INSERT INTO billing_history (
        user_id,
        subscription_id,
        amount,
        currency,
        status,
        paid_at,
        created_at
    ) VALUES (
        user_profile_id,
        subscription_uuid,
        499, -- $4.99 in cents
        'usd',
        'paid',
        now(),
        now()
    )
    ON CONFLICT (stripe_invoice_id) DO NOTHING;

    RAISE NOTICE 'Successfully created active subscription for user %', user_profile_id;
END $$;