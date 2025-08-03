/*
  # Update subscriptions table schema for Stripe integration

  1. New Columns
    - `plan_type` (text) - Track whether user has monthly or yearly plan
    - Update status enum to include all Stripe subscription statuses

  2. Changes
    - Add plan_type column to track subscription type
    - Update status check constraint to include all possible Stripe statuses
    - Add indexes for better performance

  3. Security
    - Maintains existing RLS policies
    - No changes to security model
*/

-- Add plan_type column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'subscriptions' AND column_name = 'plan_type'
  ) THEN
    ALTER TABLE subscriptions ADD COLUMN plan_type text CHECK (plan_type IN ('monthly', 'yearly'));
  END IF;
END $$;

-- Update status constraint to include all Stripe statuses
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check 
  CHECK (status IN ('active', 'inactive', 'canceled', 'past_due', 'unpaid', 'trialing', 'incomplete', 'incomplete_expired'));

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions(status);
CREATE INDEX IF NOT EXISTS subscriptions_plan_type_idx ON subscriptions(plan_type);
CREATE INDEX IF NOT EXISTS subscriptions_stripe_subscription_id_idx ON subscriptions(stripe_subscription_id);

-- Update the subscription type in the TypeScript types
COMMENT ON COLUMN subscriptions.plan_type IS 'Subscription plan type: monthly or yearly';
COMMENT ON COLUMN subscriptions.status IS 'Stripe subscription status: active, inactive, canceled, past_due, unpaid, trialing, incomplete, incomplete_expired';