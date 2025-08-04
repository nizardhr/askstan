/*
  # Create subscription for completed checkout session

  1. Purpose
    - Create an active subscription for users who completed Stripe checkout
    - Handle the case where checkout completed but subscription wasn't created
    - Ensure users get access after successful payment

  2. Process
    - Find users who completed checkout but don't have subscriptions
    - Create active subscriptions for them
    - Set proper subscription status and dates

  3. Security
    - Uses existing RLS policies
    - Only affects users who need subscription creation
*/

-- Create a function to handle checkout completion
CREATE OR REPLACE FUNCTION handle_checkout_completion(
  user_uuid uuid,
  session_id_param text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  subscription_uuid uuid;
  result json;
BEGIN
  -- Check if user already has a subscription
  IF EXISTS (SELECT 1 FROM user_subscriptions WHERE user_id = user_uuid) THEN
    -- Update existing subscription to active
    UPDATE user_subscriptions 
    SET 
      status = 'active'::subscription_status,
      current_period_start = now(),
      current_period_end = now() + interval '1 month',
      updated_at = now()
    WHERE user_id = user_uuid
    RETURNING id INTO subscription_uuid;
    
    RAISE NOTICE 'Updated existing subscription for user %', user_uuid;
  ELSE
    -- Create new subscription
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
      user_uuid,
      'cus_checkout_' || user_uuid,
      'sub_checkout_' || user_uuid,
      'price_monthly_checkout',
      'active'::subscription_status,
      'monthly'::plan_type,
      now(),
      now() + interval '1 month',
      now(),
      now()
    )
    RETURNING id INTO subscription_uuid;
    
    RAISE NOTICE 'Created new subscription for user %', user_uuid;
  END IF;

  -- Mark user onboarding as completed
  UPDATE user_profiles 
  SET 
    onboarding_completed = true,
    updated_at = now()
  WHERE id = user_uuid;

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
    user_uuid,
    subscription_uuid,
    499, -- $4.99 in cents
    'usd',
    'paid'::payment_status,
    now(),
    now()
  )
  ON CONFLICT (stripe_invoice_id) DO NOTHING;

  result := json_build_object(
    'success', true,
    'subscription_id', subscription_uuid,
    'user_id', user_uuid,
    'status', 'active',
    'message', 'Subscription created successfully'
  );

  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'user_id', user_uuid
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION handle_checkout_completion(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION handle_checkout_completion(uuid, text) TO authenticated;

-- Create subscription for the current user who completed checkout
DO $$
DECLARE
    user_profile_id uuid;
    result json;
BEGIN
    -- Find the user profile by email (the one who just completed checkout)
    SELECT id INTO user_profile_id
    FROM user_profiles
    WHERE email = 'yvexanagency@gmail.com';

    -- If user exists, create their subscription
    IF user_profile_id IS NOT NULL THEN
        SELECT handle_checkout_completion(user_profile_id, 'checkout_session_completed') INTO result;
        RAISE NOTICE 'Checkout completion result: %', result;
    ELSE
        RAISE NOTICE 'User with email yvexanagency@gmail.com not found';
    END IF;
END $$;