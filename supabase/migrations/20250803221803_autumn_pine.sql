/*
  # Comprehensive AskStan Platform Database Schema

  1. New Tables
    - `user_profiles`
      - `id` (uuid, primary key, references auth.users)
      - `email` (text, unique, not null)
      - `full_name` (text)
      - `avatar_url` (text)
      - `timezone` (text, default UTC)
      - `preferences` (jsonb for user settings)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `user_subscriptions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `stripe_customer_id` (text, unique)
      - `stripe_subscription_id` (text, unique)
      - `stripe_price_id` (text)
      - `status` (subscription_status enum)
      - `plan_type` (plan_type enum)
      - `current_period_start` (timestamptz)
      - `current_period_end` (timestamptz)
      - `cancel_at_period_end` (boolean)
      - `canceled_at` (timestamptz)
      - `trial_start` (timestamptz)
      - `trial_end` (timestamptz)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `billing_history`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `subscription_id` (uuid, references user_subscriptions)
      - `stripe_invoice_id` (text, unique)
      - `amount` (integer, in cents)
      - `currency` (text, default USD)
      - `status` (payment_status enum)
      - `invoice_url` (text)
      - `paid_at` (timestamptz)
      - `created_at` (timestamptz)
    
    - `user_sessions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `session_token` (text, unique)
      - `ip_address` (inet)
      - `user_agent` (text)
      - `expires_at` (timestamptz)
      - `created_at` (timestamptz)
    
    - `chat_conversations`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references user_profiles)
      - `title` (text)
      - `last_message_at` (timestamptz)
      - `message_count` (integer, default 0)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `chat_messages`
      - `id` (uuid, primary key)
      - `conversation_id` (uuid, references chat_conversations)
      - `user_id` (uuid, references user_profiles)
      - `content` (text, not null)
      - `role` (message_role enum)
      - `metadata` (jsonb)
      - `created_at` (timestamptz)

  2. Enums
    - `subscription_status`: active, inactive, trialing, past_due, canceled, unpaid, incomplete, incomplete_expired
    - `plan_type`: monthly, yearly
    - `payment_status`: paid, pending, failed, refunded
    - `message_role`: user, assistant, system

  3. Security
    - Enable RLS on all tables
    - Add comprehensive policies for user data access
    - Service role policies for webhook operations
    - Secure functions for subscription management

  4. Functions & Triggers
    - Auto-create user profile on signup
    - Update timestamps automatically
    - Subscription status change notifications
    - Chat conversation management

  5. Indexes
    - Performance indexes for common queries
    - Unique constraints for Stripe IDs
    - Composite indexes for efficient lookups
*/

-- Create custom types/enums
CREATE TYPE subscription_status AS ENUM (
  'active', 
  'inactive', 
  'trialing', 
  'past_due', 
  'canceled', 
  'unpaid', 
  'incomplete', 
  'incomplete_expired'
);

CREATE TYPE plan_type AS ENUM ('monthly', 'yearly');

CREATE TYPE payment_status AS ENUM ('paid', 'pending', 'failed', 'refunded');

CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system');

-- Create user_profiles table (enhanced user management)
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text,
  avatar_url text,
  timezone text DEFAULT 'UTC',
  preferences jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_subscriptions table (comprehensive subscription management)
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text UNIQUE,
  stripe_price_id text,
  status subscription_status DEFAULT 'inactive',
  plan_type plan_type,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  canceled_at timestamptz,
  trial_start timestamptz,
  trial_end timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Ensure one active subscription per user
  CONSTRAINT unique_active_subscription_per_user 
    EXCLUDE (user_id WITH =) WHERE (status IN ('active', 'trialing'))
);

-- Create billing_history table (payment tracking)
CREATE TABLE IF NOT EXISTS billing_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  subscription_id uuid REFERENCES user_subscriptions(id) ON DELETE SET NULL,
  stripe_invoice_id text UNIQUE,
  amount integer NOT NULL, -- Amount in cents
  currency text DEFAULT 'usd',
  status payment_status DEFAULT 'pending',
  invoice_url text,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create user_sessions table (session management)
CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  session_token text UNIQUE NOT NULL,
  ip_address inet,
  user_agent text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create chat_conversations table (chat history)
CREATE TABLE IF NOT EXISTS chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  title text DEFAULT 'New Conversation',
  last_message_at timestamptz DEFAULT now(),
  message_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create chat_messages table (individual messages)
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES chat_conversations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  role message_role NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- User Profiles Policies
CREATE POLICY "Users can read own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Service role can manage all profiles"
  ON user_profiles
  FOR ALL
  TO service_role
  USING (true);

-- User Subscriptions Policies
CREATE POLICY "Users can read own subscription"
  ON user_subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all subscriptions"
  ON user_subscriptions
  FOR ALL
  TO service_role
  USING (true);

-- Billing History Policies
CREATE POLICY "Users can read own billing history"
  ON billing_history
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all billing history"
  ON billing_history
  FOR ALL
  TO service_role
  USING (true);

-- User Sessions Policies
CREATE POLICY "Users can read own sessions"
  ON user_sessions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own sessions"
  ON user_sessions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all sessions"
  ON user_sessions
  FOR ALL
  TO service_role
  USING (true);

-- Chat Conversations Policies
CREATE POLICY "Users can manage own conversations"
  ON chat_conversations
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all conversations"
  ON chat_conversations
  FOR ALL
  TO service_role
  USING (true);

-- Chat Messages Policies
CREATE POLICY "Users can read own messages"
  ON chat_messages
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own messages"
  ON chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role can manage all messages"
  ON chat_messages
  FOR ALL
  TO service_role
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS user_profiles_email_idx ON user_profiles(email);
CREATE INDEX IF NOT EXISTS user_subscriptions_user_id_idx ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS user_subscriptions_stripe_customer_id_idx ON user_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS user_subscriptions_stripe_subscription_id_idx ON user_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS user_subscriptions_status_idx ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS billing_history_user_id_idx ON billing_history(user_id);
CREATE INDEX IF NOT EXISTS billing_history_subscription_id_idx ON billing_history(subscription_id);
CREATE INDEX IF NOT EXISTS billing_history_stripe_invoice_id_idx ON billing_history(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS user_sessions_user_id_idx ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS user_sessions_expires_at_idx ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS chat_conversations_user_id_idx ON chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS chat_messages_conversation_id_idx ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS chat_messages_user_id_idx ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx ON chat_messages(created_at);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, created_at, updated_at)
  VALUES (
    NEW.id, 
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', ''), 
    now(), 
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = now();
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail user creation
    RAISE LOG 'Error creating user profile for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update conversation message count
CREATE OR REPLACE FUNCTION update_conversation_stats()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE chat_conversations 
    SET 
      message_count = message_count + 1,
      last_message_at = NEW.created_at,
      updated_at = now()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE chat_conversations 
    SET 
      message_count = GREATEST(message_count - 1, 0),
      updated_at = now()
    WHERE id = OLD.conversation_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM user_sessions 
  WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user subscription status
CREATE OR REPLACE FUNCTION get_user_subscription_status(user_uuid uuid)
RETURNS subscription_status AS $$
DECLARE
  user_status subscription_status;
BEGIN
  SELECT status INTO user_status
  FROM user_subscriptions
  WHERE user_id = user_uuid
    AND status IN ('active', 'trialing')
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN COALESCE(user_status, 'inactive'::subscription_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has active subscription
CREATE OR REPLACE FUNCTION user_has_active_subscription(user_uuid uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_subscriptions
    WHERE user_id = user_uuid
      AND status IN ('active', 'trialing')
      AND (current_period_end IS NULL OR current_period_end > now())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for updated_at columns
CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER chat_conversations_updated_at
  BEFORE UPDATE ON chat_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for user profile creation
DROP TRIGGER IF EXISTS create_user_profile_trigger ON auth.users;
CREATE TRIGGER create_user_profile_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_profile();

-- Create trigger for conversation stats
CREATE TRIGGER update_conversation_stats_trigger
  AFTER INSERT OR DELETE ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_stats();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION create_user_profile() TO service_role;
GRANT EXECUTE ON FUNCTION update_updated_at_column() TO service_role;
GRANT EXECUTE ON FUNCTION update_conversation_stats() TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_expired_sessions() TO service_role;
GRANT EXECUTE ON FUNCTION get_user_subscription_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_active_subscription(uuid) TO authenticated;

-- Create views for easier data access
CREATE OR REPLACE VIEW user_subscription_details AS
SELECT 
  up.id,
  up.email,
  up.full_name,
  up.created_at as user_created_at,
  us.id as subscription_id,
  us.stripe_customer_id,
  us.stripe_subscription_id,
  us.status as subscription_status,
  us.plan_type,
  us.current_period_start,
  us.current_period_end,
  us.cancel_at_period_end,
  us.trial_end,
  CASE 
    WHEN us.status IN ('active', 'trialing') AND (us.current_period_end IS NULL OR us.current_period_end > now()) 
    THEN true 
    ELSE false 
  END as has_active_subscription
FROM user_profiles up
LEFT JOIN user_subscriptions us ON up.id = us.user_id
  AND us.status IN ('active', 'trialing', 'past_due', 'canceled');

-- Grant access to the view
GRANT SELECT ON user_subscription_details TO authenticated;
GRANT SELECT ON user_subscription_details TO service_role;

-- Create RLS policy for the view
CREATE POLICY "Users can read own subscription details"
  ON user_subscription_details
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Insert default data for testing (optional)
-- This creates a sample conversation structure for new users
CREATE OR REPLACE FUNCTION create_welcome_conversation(user_uuid uuid)
RETURNS uuid AS $$
DECLARE
  conversation_uuid uuid;
BEGIN
  INSERT INTO chat_conversations (user_id, title, created_at, updated_at)
  VALUES (user_uuid, 'Welcome to AskStan', now(), now())
  RETURNING id INTO conversation_uuid;
  
  INSERT INTO chat_messages (conversation_id, user_id, content, role, created_at)
  VALUES (
    conversation_uuid, 
    user_uuid, 
    'Hello! I''m Stan, your personal AI assistant powered by Yvexan Agency. How can I help you grow your social media presence today?', 
    'assistant', 
    now()
  );
  
  RETURN conversation_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION create_welcome_conversation(uuid) TO service_role;

-- Create comprehensive subscription management functions
CREATE OR REPLACE FUNCTION update_subscription_from_stripe(
  stripe_customer_id_param text,
  stripe_subscription_id_param text,
  status_param text,
  plan_type_param text DEFAULT NULL,
  current_period_start_param timestamptz DEFAULT NULL,
  current_period_end_param timestamptz DEFAULT NULL,
  cancel_at_period_end_param boolean DEFAULT false
)
RETURNS void AS $$
DECLARE
  mapped_status subscription_status;
  mapped_plan_type plan_type;
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
  
  -- Update subscription
  UPDATE user_subscriptions SET
    status = mapped_status,
    plan_type = COALESCE(mapped_plan_type, plan_type),
    current_period_start = COALESCE(current_period_start_param, current_period_start),
    current_period_end = COALESCE(current_period_end_param, current_period_end),
    cancel_at_period_end = cancel_at_period_end_param,
    canceled_at = CASE WHEN mapped_status = 'canceled' THEN now() ELSE canceled_at END,
    updated_at = now()
  WHERE stripe_customer_id = stripe_customer_id_param
    OR stripe_subscription_id = stripe_subscription_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_subscription_from_stripe(text, text, text, text, timestamptz, timestamptz, boolean) TO service_role;

-- Create function to record billing event
CREATE OR REPLACE FUNCTION record_billing_event(
  stripe_customer_id_param text,
  stripe_invoice_id_param text,
  amount_param integer,
  currency_param text DEFAULT 'usd',
  status_param text DEFAULT 'paid',
  invoice_url_param text DEFAULT NULL,
  paid_at_param timestamptz DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  user_uuid uuid;
  subscription_uuid uuid;
  mapped_status payment_status;
BEGIN
  -- Find user and subscription
  SELECT up.id, us.id INTO user_uuid, subscription_uuid
  FROM user_profiles up
  JOIN user_subscriptions us ON up.id = us.user_id
  WHERE us.stripe_customer_id = stripe_customer_id_param;
  
  -- Map payment status
  mapped_status := CASE status_param
    WHEN 'paid' THEN 'paid'::payment_status
    WHEN 'pending' THEN 'pending'::payment_status
    WHEN 'failed' THEN 'failed'::payment_status
    WHEN 'refunded' THEN 'refunded'::payment_status
    ELSE 'pending'::payment_status
  END;
  
  -- Insert billing record
  INSERT INTO billing_history (
    user_id,
    subscription_id,
    stripe_invoice_id,
    amount,
    currency,
    status,
    invoice_url,
    paid_at,
    created_at
  ) VALUES (
    user_uuid,
    subscription_uuid,
    stripe_invoice_id_param,
    amount_param,
    currency_param,
    mapped_status,
    invoice_url_param,
    COALESCE(paid_at_param, now()),
    now()
  )
  ON CONFLICT (stripe_invoice_id) DO UPDATE SET
    status = EXCLUDED.status,
    paid_at = EXCLUDED.paid_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION record_billing_event(text, text, integer, text, text, text, timestamptz) TO service_role;

-- Create function to clean up old data (for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
  -- Clean up expired sessions
  DELETE FROM user_sessions WHERE expires_at < now() - interval '7 days';
  
  -- Clean up old chat messages (keep last 1000 per user)
  DELETE FROM chat_messages 
  WHERE id NOT IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
      FROM chat_messages
    ) ranked
    WHERE rn <= 1000
  );
  
  -- Clean up empty conversations
  DELETE FROM chat_conversations 
  WHERE message_count = 0 AND created_at < now() - interval '1 day';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION cleanup_old_data() TO service_role;

-- Create helpful utility functions
CREATE OR REPLACE FUNCTION get_user_stats(user_uuid uuid)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_conversations', COUNT(DISTINCT cc.id),
    'total_messages', COUNT(cm.id),
    'subscription_status', us.status,
    'plan_type', us.plan_type,
    'member_since', up.created_at,
    'last_activity', MAX(cm.created_at)
  ) INTO result
  FROM user_profiles up
  LEFT JOIN chat_conversations cc ON up.id = cc.user_id
  LEFT JOIN chat_messages cm ON cc.id = cm.conversation_id
  LEFT JOIN user_subscriptions us ON up.id = us.user_id AND us.status IN ('active', 'trialing', 'past_due')
  WHERE up.id = user_uuid
  GROUP BY up.id, up.created_at, us.status, us.plan_type;
  
  RETURN COALESCE(result, '{}'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_user_stats(uuid) TO authenticated;

-- Add helpful comments for documentation
COMMENT ON TABLE user_profiles IS 'Enhanced user profile information with preferences and settings';
COMMENT ON TABLE user_subscriptions IS 'Comprehensive subscription management with Stripe integration';
COMMENT ON TABLE billing_history IS 'Complete billing and payment history tracking';
COMMENT ON TABLE user_sessions IS 'User session management for security and analytics';
COMMENT ON TABLE chat_conversations IS 'Chat conversation threads for organizing user interactions';
COMMENT ON TABLE chat_messages IS 'Individual chat messages with role-based content';

COMMENT ON FUNCTION get_user_subscription_status(uuid) IS 'Get current subscription status for a user';
COMMENT ON FUNCTION user_has_active_subscription(uuid) IS 'Check if user has an active subscription';
COMMENT ON FUNCTION update_subscription_from_stripe(text, text, text, text, timestamptz, timestamptz, boolean) IS 'Update subscription data from Stripe webhook events';
COMMENT ON FUNCTION record_billing_event(text, text, integer, text, text, text, timestamptz) IS 'Record billing events from Stripe invoices';
COMMENT ON FUNCTION cleanup_old_data() IS 'Maintenance function to clean up old sessions and messages';
COMMENT ON FUNCTION get_user_stats(uuid) IS 'Get comprehensive user statistics and activity data';