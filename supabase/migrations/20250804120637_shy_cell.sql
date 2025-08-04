/*
  # Implement Complete Stripe Promo Code System for AskStan

  1. Database Updates
    - Add promo code tracking columns to user_subscriptions
    - Create promo_code_usage table for detailed tracking
    - Add indexes for analytics and performance
    - Update webhook functions to handle promo code data

  2. Security
    - Maintains existing RLS policies
    - Secure promo code validation through Stripe API
    - Proper user data isolation

  3. Analytics & Tracking
    - Track promo code usage for business insights
    - Monitor discount effectiveness
    - Revenue impact analysis
    - User acquisition tracking

  4. Functions
    - Enhanced subscription creation with promo support
    - Promo code usage recording
    - Analytics functions for business intelligence
*/

-- Add promo code support to user_subscriptions table if not already present
DO $$
BEGIN
  -- Add promo_code column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_subscriptions' AND column_name = 'promo_code'
  ) THEN
    ALTER TABLE user_subscriptions ADD COLUMN promo_code text;
  END IF;

  -- Add discount tracking columns if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_subscriptions' AND column_name = 'discount_amount'
  ) THEN
    ALTER TABLE user_subscriptions ADD COLUMN discount_amount integer; -- Amount in cents
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_subscriptions' AND column_name = 'discount_percentage'
  ) THEN
    ALTER TABLE user_subscriptions ADD COLUMN discount_percentage numeric(5,2); -- Percentage (e.g., 25.50)
  END IF;
END $$;

-- Create promo_code_usage table for detailed tracking
CREATE TABLE IF NOT EXISTS promo_code_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  subscription_id uuid REFERENCES user_subscriptions(id) ON DELETE SET NULL,
  promo_code text NOT NULL,
  stripe_promotion_code_id text,
  stripe_coupon_id text,
  discount_type text CHECK (discount_type IN ('percentage', 'amount')),
  discount_value numeric NOT NULL,
  discount_amount_cents integer, -- Actual discount applied in cents
  currency text DEFAULT 'usd',
  applied_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on promo_code_usage table
ALTER TABLE promo_code_usage ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for promo_code_usage
CREATE POLICY "Users can read own promo code usage"
  ON promo_code_usage FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all promo code usage"
  ON promo_code_usage FOR ALL
  TO service_role
  USING (true);

-- Create indexes for performance and analytics
CREATE INDEX IF NOT EXISTS user_subscriptions_promo_code_idx ON user_subscriptions(promo_code) WHERE promo_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS promo_code_usage_user_id_idx ON promo_code_usage(user_id);
CREATE INDEX IF NOT EXISTS promo_code_usage_promo_code_idx ON promo_code_usage(promo_code);
CREATE INDEX IF NOT EXISTS promo_code_usage_applied_at_idx ON promo_code_usage(applied_at);
CREATE INDEX IF NOT EXISTS promo_code_usage_discount_type_idx ON promo_code_usage(discount_type);

-- Function to record promo code usage
CREATE OR REPLACE FUNCTION record_promo_code_usage(
  user_uuid uuid,
  subscription_uuid uuid,
  promo_code_param text,
  stripe_promotion_code_id_param text,
  stripe_coupon_id_param text,
  discount_type_param text,
  discount_value_param numeric,
  discount_amount_cents_param integer,
  currency_param text DEFAULT 'usd',
  metadata_param jsonb DEFAULT '{}'
)
RETURNS uuid AS $$
DECLARE
  usage_id uuid;
BEGIN
  INSERT INTO promo_code_usage (
    user_id,
    subscription_id,
    promo_code,
    stripe_promotion_code_id,
    stripe_coupon_id,
    discount_type,
    discount_value,
    discount_amount_cents,
    currency,
    metadata,
    applied_at,
    created_at
  ) VALUES (
    user_uuid,
    subscription_uuid,
    promo_code_param,
    stripe_promotion_code_id_param,
    stripe_coupon_id_param,
    discount_type_param,
    discount_value_param,
    discount_amount_cents_param,
    currency_param,
    metadata_param,
    now(),
    now()
  )
  RETURNING id INTO usage_id;
  
  RETURN usage_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions for promo code usage function
GRANT EXECUTE ON FUNCTION record_promo_code_usage(uuid, uuid, text, text, text, text, numeric, integer, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION record_promo_code_usage(uuid, uuid, text, text, text, text, numeric, integer, text, jsonb) TO authenticated;

-- Enhanced subscription creation function with promo code support
CREATE OR REPLACE FUNCTION create_subscription_with_promo(
  user_uuid uuid,
  stripe_customer_id_param text,
  stripe_subscription_id_param text,
  stripe_price_id_param text,
  status_param text,
  plan_type_param text,
  current_period_start_param timestamptz,
  current_period_end_param timestamptz,
  promo_code_param text DEFAULT NULL,
  discount_amount_param integer DEFAULT NULL,
  discount_percentage_param numeric DEFAULT NULL,
  stripe_promotion_code_id_param text DEFAULT NULL,
  stripe_coupon_id_param text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  subscription_uuid uuid;
  mapped_status subscription_status;
  mapped_plan_type plan_type;
  usage_id uuid;
BEGIN
  -- Map Stripe status to our enum
  mapped_status := CASE status_param
    WHEN 'active' THEN 'active'::subscription_status
    WHEN 'trialing' THEN 'trialing'::subscription_status
    WHEN 'past_due' THEN 'past_due'::subscription_status
    WHEN 'canceled' THEN 'canceled'::subscription_status
    WHEN 'unpaid' THEN 'unpaid'::subscription_status
    WHEN 'incomplete' THEN 'incomplete'::subscription_status
    WHEN 'incomplete_expired' THEN 'incomplete_expired'::subscription_status
    ELSE 'inactive'::subscription_status
  END;
  
  -- Map plan type
  mapped_plan_type := CASE plan_type_param
    WHEN 'monthly' THEN 'monthly'::plan_type
    WHEN 'yearly' THEN 'yearly'::plan_type
    ELSE NULL
  END;
  
  -- Create or update subscription with promo code data
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
    discount_amount,
    discount_percentage,
    updated_at
  ) VALUES (
    user_uuid,
    stripe_customer_id_param,
    stripe_subscription_id_param,
    stripe_price_id_param,
    mapped_status,
    mapped_plan_type,
    current_period_start_param,
    current_period_end_param,
    promo_code_param,
    discount_amount_param,
    discount_percentage_param,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    stripe_price_id = EXCLUDED.stripe_price_id,
    status = EXCLUDED.status,
    plan_type = EXCLUDED.plan_type,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    promo_code = COALESCE(EXCLUDED.promo_code, user_subscriptions.promo_code),
    discount_amount = COALESCE(EXCLUDED.discount_amount, user_subscriptions.discount_amount),
    discount_percentage = COALESCE(EXCLUDED.discount_percentage, user_subscriptions.discount_percentage),
    updated_at = EXCLUDED.updated_at
  RETURNING id INTO subscription_uuid;
  
  -- Record promo code usage if promo code was applied
  IF promo_code_param IS NOT NULL THEN
    SELECT record_promo_code_usage(
      user_uuid,
      subscription_uuid,
      promo_code_param,
      stripe_promotion_code_id_param,
      stripe_coupon_id_param,
      CASE 
        WHEN discount_percentage_param IS NOT NULL THEN 'percentage'
        WHEN discount_amount_param IS NOT NULL THEN 'amount'
        ELSE 'unknown'
      END,
      COALESCE(discount_percentage_param, discount_amount_param::numeric / 100.0),
      discount_amount_param,
      'usd',
      json_build_object(
        'applied_via', 'checkout_session',
        'stripe_promotion_code_id', stripe_promotion_code_id_param,
        'stripe_coupon_id', stripe_coupon_id_param
      )::jsonb
    ) INTO usage_id;
  END IF;
  
  RETURN subscription_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions for subscription creation function
GRANT EXECUTE ON FUNCTION create_subscription_with_promo(uuid, text, text, text, text, text, timestamptz, timestamptz, text, integer, numeric, text, text) TO service_role;

-- Create analytics views for promo code performance
CREATE OR REPLACE VIEW promo_code_analytics AS
SELECT 
  pcu.promo_code,
  COUNT(*) as total_usage,
  COUNT(DISTINCT pcu.user_id) as unique_users,
  AVG(pcu.discount_value) as avg_discount_value,
  SUM(pcu.discount_amount_cents) / 100.0 as total_discount_dollars,
  MIN(pcu.applied_at) as first_used,
  MAX(pcu.applied_at) as last_used,
  COUNT(CASE WHEN us.status = 'active' THEN 1 END) as active_subscriptions,
  AVG(CASE WHEN pcu.discount_type = 'percentage' THEN pcu.discount_value ELSE NULL END) as avg_percentage_discount,
  AVG(CASE WHEN pcu.discount_type = 'amount' THEN pcu.discount_value ELSE NULL END) as avg_amount_discount
FROM promo_code_usage pcu
LEFT JOIN user_subscriptions us ON pcu.subscription_id = us.id
GROUP BY pcu.promo_code
ORDER BY total_usage DESC;

CREATE OR REPLACE VIEW monthly_promo_usage AS
SELECT 
  DATE_TRUNC('month', pcu.applied_at) as month,
  pcu.promo_code,
  COUNT(*) as usage_count,
  COUNT(DISTINCT pcu.user_id) as unique_users,
  SUM(pcu.discount_amount_cents) / 100.0 as total_discount_dollars,
  AVG(pcu.discount_value) as avg_discount_value
FROM promo_code_usage pcu
GROUP BY DATE_TRUNC('month', pcu.applied_at), pcu.promo_code
ORDER BY month DESC, usage_count DESC;

-- Grant access to analytics views
GRANT SELECT ON promo_code_analytics TO service_role;
GRANT SELECT ON monthly_promo_usage TO service_role;

-- Function to get user's promo code history
CREATE OR REPLACE FUNCTION get_user_promo_history(user_uuid uuid)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(
    json_build_object(
      'promo_code', promo_code,
      'discount_type', discount_type,
      'discount_value', discount_value,
      'discount_amount_dollars', discount_amount_cents / 100.0,
      'applied_at', applied_at,
      'subscription_status', (
        SELECT status FROM user_subscriptions 
        WHERE id = promo_code_usage.subscription_id
      )
    )
    ORDER BY applied_at DESC
  ) INTO result
  FROM promo_code_usage
  WHERE user_id = user_uuid;
  
  RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_user_promo_history(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_promo_history(uuid) TO service_role;

-- Add helpful comments for documentation
COMMENT ON TABLE promo_code_usage IS 'Detailed tracking of promo code usage for analytics and business intelligence';
COMMENT ON COLUMN user_subscriptions.promo_code IS 'Stripe promotion code used during subscription creation';
COMMENT ON COLUMN user_subscriptions.discount_amount IS 'Discount amount in cents applied via promo code';
COMMENT ON COLUMN user_subscriptions.discount_percentage IS 'Discount percentage applied via promo code';
COMMENT ON COLUMN promo_code_usage.discount_amount_cents IS 'Actual discount applied in cents for revenue tracking';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '🎯 Stripe Promo Code System Implemented Successfully!';
  RAISE NOTICE '📊 Tables: Enhanced user_subscriptions + new promo_code_usage table';
  RAISE NOTICE '🔒 Security: RLS policies and secure functions created';
  RAISE NOTICE '📈 Analytics: Comprehensive promo code performance tracking';
  RAISE NOTICE '💳 Stripe: Ready for promotion code integration';
  RAISE NOTICE '🚀 Ready for promo code validation and checkout flow!';
END $$;