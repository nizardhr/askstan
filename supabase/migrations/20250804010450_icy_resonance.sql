/*
  # Add Promo Codes Support to AskStan Platform

  1. Database Updates
    - Add `promo_code` column to user_subscriptions table
    - Add `discount_amount` and `discount_percentage` for tracking applied discounts
    - Update webhook functions to handle promo code data

  2. Security
    - Maintains existing RLS policies
    - Secure promo code validation through Stripe API

  3. Analytics
    - Track promo code usage for business insights
    - Monitor discount effectiveness
*/

-- Add promo code support to user_subscriptions table
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

-- Create index for promo code analytics
CREATE INDEX IF NOT EXISTS user_subscriptions_promo_code_idx ON user_subscriptions(promo_code) WHERE promo_code IS NOT NULL;

-- Update the subscription creation function to handle promo codes
CREATE OR REPLACE FUNCTION update_subscription_from_stripe_with_promo(
  stripe_customer_id_param text,
  stripe_subscription_id_param text,
  status_param text,
  plan_type_param text DEFAULT NULL,
  stripe_price_id_param text DEFAULT NULL,
  current_period_start_param timestamptz DEFAULT NULL,
  current_period_end_param timestamptz DEFAULT NULL,
  cancel_at_period_end_param boolean DEFAULT false,
  trial_start_param timestamptz DEFAULT NULL,
  trial_end_param timestamptz DEFAULT NULL,
  promo_code_param text DEFAULT NULL,
  discount_amount_param integer DEFAULT NULL,
  discount_percentage_param numeric DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  mapped_status subscription_status;
  mapped_plan_type plan_type;
  target_user_id uuid;
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
  
  -- Map plan type if provided
  IF plan_type_param IS NOT NULL THEN
    mapped_plan_type := CASE plan_type_param
      WHEN 'monthly' THEN 'monthly'::plan_type
      WHEN 'yearly' THEN 'yearly'::plan_type
      ELSE NULL
    END;
  END IF;
  
  -- Find user by Stripe customer ID or subscription ID
  SELECT up.id INTO target_user_id
  FROM user_profiles up
  LEFT JOIN user_subscriptions us ON up.id = us.user_id
  WHERE us.stripe_customer_id = stripe_customer_id_param 
     OR us.stripe_subscription_id = stripe_subscription_id_param
  LIMIT 1;
  
  -- Update or insert subscription with promo code data
  INSERT INTO user_subscriptions (
    user_id,
    stripe_customer_id,
    stripe_subscription_id,
    stripe_price_id,
    status,
    plan_type,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    trial_start,
    trial_end,
    promo_code,
    discount_amount,
    discount_percentage,
    canceled_at,
    updated_at
  ) VALUES (
    target_user_id,
    stripe_customer_id_param,
    stripe_subscription_id_param,
    stripe_price_id_param,
    mapped_status,
    mapped_plan_type,
    current_period_start_param,
    current_period_end_param,
    cancel_at_period_end_param,
    trial_start_param,
    trial_end_param,
    promo_code_param,
    discount_amount_param,
    discount_percentage_param,
    CASE WHEN mapped_status = 'canceled' THEN now() ELSE NULL END,
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
    cancel_at_period_end = EXCLUDED.cancel_at_period_end,
    trial_start = EXCLUDED.trial_start,
    trial_end = EXCLUDED.trial_end,
    promo_code = COALESCE(EXCLUDED.promo_code, user_subscriptions.promo_code),
    discount_amount = COALESCE(EXCLUDED.discount_amount, user_subscriptions.discount_amount),
    discount_percentage = COALESCE(EXCLUDED.discount_percentage, user_subscriptions.discount_percentage),
    canceled_at = EXCLUDED.canceled_at,
    updated_at = EXCLUDED.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions for the new function
GRANT EXECUTE ON FUNCTION update_subscription_from_stripe_with_promo(text, text, text, text, text, timestamptz, timestamptz, boolean, timestamptz, timestamptz, text, integer, numeric) TO service_role;

-- Create analytics view for promo code usage
CREATE OR REPLACE VIEW promo_code_analytics AS
SELECT 
  promo_code,
  COUNT(*) as usage_count,
  AVG(discount_amount) / 100.0 as avg_discount_dollars,
  AVG(discount_percentage) as avg_discount_percentage,
  MIN(created_at) as first_used,
  MAX(created_at) as last_used,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as active_subscriptions
FROM user_subscriptions
WHERE promo_code IS NOT NULL
GROUP BY promo_code
ORDER BY usage_count DESC;

-- Grant access to analytics view
GRANT SELECT ON promo_code_analytics TO service_role;

-- Add helpful comments
COMMENT ON COLUMN user_subscriptions.promo_code IS 'Stripe promotion code used during subscription creation';
COMMENT ON COLUMN user_subscriptions.discount_amount IS 'Discount amount in cents applied via promo code';
COMMENT ON COLUMN user_subscriptions.discount_percentage IS 'Discount percentage applied via promo code';