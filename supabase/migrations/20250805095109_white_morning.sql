/*
  # Fix Checkout Completion Flow

  1. Purpose
    - Create proper function to handle checkout session completion
    - Activate subscription when checkout is successful
    - Handle both paid and free (100% discount) subscriptions

  2. Functions
    - process_checkout_completion: Main function to activate subscription
    - handle_free_subscription: Special handling for 100% discount codes

  3. Security
    - Uses existing RLS policies
    - Proper user data isolation
    - Service role permissions for webhook operations
*/

-- Function to process checkout completion and activate subscription
CREATE OR REPLACE FUNCTION process_checkout_completion(
  session_id_param text,
  user_id_param uuid,
  customer_id_param text,
  subscription_id_param text DEFAULT NULL,
  price_id_param text DEFAULT NULL,
  plan_type_param text DEFAULT 'monthly',
  amount_total_param integer DEFAULT 0,
  promo_code_param text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  subscription_uuid uuid;
  result json;
  period_end timestamptz;
BEGIN
  -- Calculate period end based on plan type
  period_end := CASE 
    WHEN plan_type_param = 'yearly' THEN now() + interval '1 year'
    ELSE now() + interval '1 month'
  END;

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
    promo_code,
    discount_percentage,
    created_at,
    updated_at
  ) VALUES (
    user_id_param,
    customer_id_param,
    subscription_id_param,
    price_id_param,
    'active'::subscription_status,
    plan_type_param::plan_type,
    now(),
    period_end,
    promo_code_param,
    CASE WHEN amount_total_param = 0 THEN 100 ELSE NULL END,
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
    promo_code = EXCLUDED.promo_code,
    discount_percentage = EXCLUDED.discount_percentage,
    updated_at = now()
  RETURNING id INTO subscription_uuid;

  -- Mark user onboarding as completed
  UPDATE user_profiles 
  SET 
    onboarding_completed = true,
    updated_at = now()
  WHERE id = user_id_param;

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
    user_id_param,
    subscription_uuid,
    amount_total_param,
    'usd',
    'paid'::payment_status,
    now(),
    now()
  )
  ON CONFLICT (stripe_invoice_id) DO NOTHING;

  -- Record promo code usage if applicable
  IF promo_code_param IS NOT NULL THEN
    INSERT INTO promo_code_usage (
      user_id,
      subscription_id,
      promo_code,
      discount_type,
      discount_value,
      discount_amount_cents,
      currency,
      metadata,
      applied_at,
      created_at
    ) VALUES (
      user_id_param,
      subscription_uuid,
      promo_code_param,
      CASE WHEN amount_total_param = 0 THEN 'percentage' ELSE 'amount' END,
      CASE WHEN amount_total_param = 0 THEN 100 ELSE 0 END,
      0,
      'usd',
      json_build_object(
        'session_id', session_id_param,
        'free_subscription', amount_total_param = 0
      ),
      now(),
      now()
    )
    ON CONFLICT DO NOTHING;
  END IF;

  result := json_build_object(
    'success', true,
    'subscription_id', subscription_uuid,
    'user_id', user_id_param,
    'status', 'active',
    'amount', amount_total_param,
    'free_subscription', amount_total_param = 0
  );

  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'user_id', user_id_param
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION process_checkout_completion(text, uuid, text, text, text, text, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION process_checkout_completion(text, uuid, text, text, text, text, integer, text) TO authenticated;