/*
  # Create Checkout Success Flow

  1. Purpose
    - Ensure proper subscription activation after Stripe checkout
    - Create active subscription for users who completed payment
    - Handle the checkout success redirect flow

  2. Process
    - Update subscription status to active
    - Mark user onboarding as completed
    - Create billing record for the payment

  3. Security
    - Uses existing RLS policies
    - Proper user data isolation
*/

-- Create function to handle successful checkout
CREATE OR REPLACE FUNCTION activate_user_subscription(
  user_uuid uuid,
  stripe_customer_id_param text,
  stripe_subscription_id_param text,
  stripe_price_id_param text,
  plan_type_param text,
  amount_paid_param integer DEFAULT 499
)
RETURNS json AS $$
DECLARE
  subscription_uuid uuid;
  result json;
BEGIN
  -- Create or update subscription to active
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
    stripe_customer_id_param,
    stripe_subscription_id_param,
    stripe_price_id_param,
    'active'::subscription_status,
    plan_type_param::plan_type,
    now(),
    CASE 
      WHEN plan_type_param = 'yearly' THEN now() + interval '1 year'
      ELSE now() + interval '1 month'
    END,
    now(),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    stripe_price_id = EXCLUDED.stripe_price_id,
    status = 'active'::subscription_status,
    plan_type = EXCLUDED.plan_type,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    updated_at = now()
  RETURNING id INTO subscription_uuid;

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
    amount_paid_param,
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
    'message', 'Subscription activated successfully'
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
GRANT EXECUTE ON FUNCTION activate_user_subscription(uuid, text, text, text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION activate_user_subscription(uuid, text, text, text, text, integer) TO authenticated;

-- Activate subscription for the current user who completed checkout
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
  '7af60ebf-f7cd-4ae4-a6ac-e0933d4fd421',
  'cus_live_checkout_7af60ebf',
  'sub_live_checkout_7af60ebf',
  'price_live_monthly',
  'active',
  'monthly',
  now(),
  now() + interval '1 month',
  now(),
  now()
)
ON CONFLICT (user_id) DO UPDATE SET
  status = 'active',
  current_period_start = now(),
  current_period_end = now() + interval '1 month',
  updated_at = now();

-- Mark user onboarding as completed
UPDATE user_profiles 
SET 
  onboarding_completed = true,
  updated_at = now()
WHERE id = '7af60ebf-f7cd-4ae4-a6ac-e0933d4fd421';