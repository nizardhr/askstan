/*
  # Complete AskStan Platform Database Schema
  
  This migration creates a comprehensive database schema for the AskStan SaaS platform
  with complete Stripe integration, user management, and social media growth features.

  ## 1. Core Tables
  - `user_profiles` - Enhanced user profile management
  - `user_subscriptions` - Complete Stripe subscription lifecycle
  - `billing_history` - Payment and invoice tracking
  - `user_sessions` - Session management and security
  - `chat_conversations` - Conversation organization
  - `chat_messages` - Individual chat messages
  - `user_preferences` - User settings and preferences
  - `growth_metrics` - Social media growth tracking
  - `content_templates` - Pre-built content templates

  ## 2. Enums & Types
  - Subscription status tracking
  - Payment status management
  - Message role definitions
  - Platform types for social media

  ## 3. Security
  - Comprehensive RLS policies
  - Secure webhook functions
  - User data protection
  - Service role permissions

  ## 4. Performance
  - Optimized indexes
  - Efficient queries
  - Proper constraints
  - Data integrity

  ## 5. Automation
  - Profile creation triggers
  - Timestamp updates
  - Subscription management
  - Data cleanup functions
*/

-- Drop existing objects if they exist to avoid conflicts
DROP VIEW IF EXISTS user_subscription_details CASCADE;
DROP TYPE IF EXISTS subscription_status CASCADE;
DROP TYPE IF EXISTS plan_type CASCADE;
DROP TYPE IF EXISTS payment_status CASCADE;
DROP TYPE IF EXISTS message_role CASCADE;
DROP TYPE IF EXISTS social_platform CASCADE;

-- Create comprehensive enums
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

CREATE TYPE payment_status AS ENUM ('paid', 'pending', 'failed', 'refunded', 'canceled');

CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system');

CREATE TYPE social_platform AS ENUM ('linkedin', 'twitter', 'instagram', 'threads', 'tiktok', 'facebook', 'youtube');

-- Create user_profiles table (comprehensive user management)
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text,
  avatar_url text,
  timezone text DEFAULT 'UTC',
  onboarding_completed boolean DEFAULT false,
  last_active_at timestamptz DEFAULT now(),
  preferences jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_subscriptions table (complete Stripe integration)
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
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
  updated_at timestamptz DEFAULT now()
);

-- Create billing_history table (payment tracking)
CREATE TABLE IF NOT EXISTS billing_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  subscription_id uuid REFERENCES user_subscriptions(id) ON DELETE SET NULL,
  stripe_invoice_id text UNIQUE,
  stripe_payment_intent_id text,
  amount integer NOT NULL, -- Amount in cents
  currency text DEFAULT 'usd',
  status payment_status DEFAULT 'pending',
  invoice_url text,
  receipt_url text,
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

-- Create chat_conversations table (conversation management)
CREATE TABLE IF NOT EXISTS chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  title text DEFAULT 'New Conversation',
  last_message_at timestamptz DEFAULT now(),
  message_count integer DEFAULT 0,
  is_archived boolean DEFAULT false,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create chat_messages table (message storage)
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES chat_conversations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  role message_role NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create user_preferences table (settings management)
CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email_notifications boolean DEFAULT true,
  push_notifications boolean DEFAULT true,
  marketing_emails boolean DEFAULT false,
  theme text DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'auto')),
  language text DEFAULT 'en',
  social_platforms jsonb DEFAULT '[]',
  growth_goals jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create growth_metrics table (social media tracking)
CREATE TABLE IF NOT EXISTS growth_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  platform social_platform NOT NULL,
  metric_type text NOT NULL, -- followers, engagement_rate, posts_count, etc.
  metric_value numeric NOT NULL,
  recorded_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  
  -- Ensure unique metrics per user/platform/type/date
  UNIQUE(user_id, platform, metric_type, recorded_at::date)
);

-- Create content_templates table (growth coaching templates)
CREATE TABLE IF NOT EXISTS content_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  platform social_platform NOT NULL,
  category text NOT NULL, -- viral_posts, engagement_hooks, growth_strategies, etc.
  template_content text NOT NULL,
  tags text[] DEFAULT '{}',
  is_premium boolean DEFAULT false,
  usage_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_achievements table (gamification)
CREATE TABLE IF NOT EXISTS user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  achievement_type text NOT NULL, -- first_post, 100_followers, viral_content, etc.
  platform social_platform,
  achieved_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}',
  
  UNIQUE(user_id, achievement_type, platform)
);

-- Enable Row Level Security on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- User Profiles Policies
CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Service role can manage all profiles"
  ON user_profiles FOR ALL
  TO service_role
  USING (true);

-- User Subscriptions Policies
CREATE POLICY "Users can read own subscription"
  ON user_subscriptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all subscriptions"
  ON user_subscriptions FOR ALL
  TO service_role
  USING (true);

-- Billing History Policies
CREATE POLICY "Users can read own billing history"
  ON billing_history FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all billing history"
  ON billing_history FOR ALL
  TO service_role
  USING (true);

-- User Sessions Policies
CREATE POLICY "Users can read own sessions"
  ON user_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own sessions"
  ON user_sessions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all sessions"
  ON user_sessions FOR ALL
  TO service_role
  USING (true);

-- Chat Conversations Policies
CREATE POLICY "Users can manage own conversations"
  ON chat_conversations FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all conversations"
  ON chat_conversations FOR ALL
  TO service_role
  USING (true);

-- Chat Messages Policies
CREATE POLICY "Users can read own messages"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own messages"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role can manage all messages"
  ON chat_messages FOR ALL
  TO service_role
  USING (true);

-- User Preferences Policies
CREATE POLICY "Users can manage own preferences"
  ON user_preferences FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all preferences"
  ON user_preferences FOR ALL
  TO service_role
  USING (true);

-- Growth Metrics Policies
CREATE POLICY "Users can manage own metrics"
  ON growth_metrics FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all metrics"
  ON growth_metrics FOR ALL
  TO service_role
  USING (true);

-- Content Templates Policies (public read, admin write)
CREATE POLICY "Anyone can read content templates"
  ON content_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage content templates"
  ON content_templates FOR ALL
  TO service_role
  USING (true);

-- User Achievements Policies
CREATE POLICY "Users can read own achievements"
  ON user_achievements FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own achievements"
  ON user_achievements FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role can manage all achievements"
  ON user_achievements FOR ALL
  TO service_role
  USING (true);

-- Create comprehensive indexes for performance
CREATE INDEX IF NOT EXISTS user_profiles_email_idx ON user_profiles(email);
CREATE INDEX IF NOT EXISTS user_profiles_last_active_idx ON user_profiles(last_active_at);

CREATE INDEX IF NOT EXISTS user_subscriptions_user_id_idx ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS user_subscriptions_stripe_customer_id_idx ON user_subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS user_subscriptions_stripe_subscription_id_idx ON user_subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS user_subscriptions_status_idx ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS user_subscriptions_current_period_end_idx ON user_subscriptions(current_period_end);

CREATE INDEX IF NOT EXISTS billing_history_user_id_idx ON billing_history(user_id);
CREATE INDEX IF NOT EXISTS billing_history_subscription_id_idx ON billing_history(subscription_id);
CREATE INDEX IF NOT EXISTS billing_history_stripe_invoice_id_idx ON billing_history(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS billing_history_status_idx ON billing_history(status);
CREATE INDEX IF NOT EXISTS billing_history_paid_at_idx ON billing_history(paid_at);

CREATE INDEX IF NOT EXISTS user_sessions_user_id_idx ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS user_sessions_expires_at_idx ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS user_sessions_session_token_idx ON user_sessions(session_token);

CREATE INDEX IF NOT EXISTS chat_conversations_user_id_idx ON chat_conversations(user_id);
CREATE INDEX IF NOT EXISTS chat_conversations_last_message_at_idx ON chat_conversations(last_message_at);
CREATE INDEX IF NOT EXISTS chat_conversations_archived_idx ON chat_conversations(is_archived);

CREATE INDEX IF NOT EXISTS chat_messages_conversation_id_idx ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS chat_messages_user_id_idx ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS chat_messages_role_idx ON chat_messages(role);

CREATE INDEX IF NOT EXISTS user_preferences_user_id_idx ON user_preferences(user_id);

CREATE INDEX IF NOT EXISTS growth_metrics_user_id_idx ON growth_metrics(user_id);
CREATE INDEX IF NOT EXISTS growth_metrics_platform_idx ON growth_metrics(platform);
CREATE INDEX IF NOT EXISTS growth_metrics_recorded_at_idx ON growth_metrics(recorded_at);
CREATE INDEX IF NOT EXISTS growth_metrics_composite_idx ON growth_metrics(user_id, platform, recorded_at);

CREATE INDEX IF NOT EXISTS content_templates_platform_idx ON content_templates(platform);
CREATE INDEX IF NOT EXISTS content_templates_category_idx ON content_templates(category);
CREATE INDEX IF NOT EXISTS content_templates_premium_idx ON content_templates(is_premium);

CREATE INDEX IF NOT EXISTS user_achievements_user_id_idx ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS user_achievements_platform_idx ON user_achievements(platform);

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
  -- Create user profile
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
  
  -- Create user preferences with defaults
  INSERT INTO public.user_preferences (user_id, created_at, updated_at)
  VALUES (NEW.id, now(), now())
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Create welcome conversation
  INSERT INTO public.chat_conversations (user_id, title, created_at, updated_at)
  VALUES (NEW.id, 'Welcome to AskStan', now(), now());
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail user creation
    RAISE LOG 'Error creating user profile for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update conversation stats when messages are added/removed
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

-- Function to get user subscription status
CREATE OR REPLACE FUNCTION get_user_subscription_status(user_uuid uuid)
RETURNS subscription_status AS $$
DECLARE
  user_status subscription_status;
BEGIN
  SELECT status INTO user_status
  FROM user_subscriptions
  WHERE user_id = user_uuid
  ORDER BY created_at DESC
  LIMIT 1;
  
  RETURN COALESCE(user_status, 'inactive'::subscription_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update subscription from Stripe webhook
CREATE OR REPLACE FUNCTION update_subscription_from_stripe(
  stripe_customer_id_param text,
  stripe_subscription_id_param text,
  status_param text,
  plan_type_param text DEFAULT NULL,
  stripe_price_id_param text DEFAULT NULL,
  current_period_start_param timestamptz DEFAULT NULL,
  current_period_end_param timestamptz DEFAULT NULL,
  cancel_at_period_end_param boolean DEFAULT false,
  trial_start_param timestamptz DEFAULT NULL,
  trial_end_param timestamptz DEFAULT NULL
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
  
  -- Update or insert subscription
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
    canceled_at,
    updated_at
  )
  SELECT 
    up.id,
    stripe_customer_id_param,
    stripe_subscription_id_param,
    COALESCE(stripe_price_id_param, us.stripe_price_id),
    mapped_status,
    COALESCE(mapped_plan_type, us.plan_type),
    COALESCE(current_period_start_param, us.current_period_start),
    COALESCE(current_period_end_param, us.current_period_end),
    cancel_at_period_end_param,
    COALESCE(trial_start_param, us.trial_start),
    COALESCE(trial_end_param, us.trial_end),
    CASE WHEN mapped_status = 'canceled' THEN now() ELSE us.canceled_at END,
    now()
  FROM user_profiles up
  LEFT JOIN user_subscriptions us ON up.id = us.user_id
  WHERE up.id = (
    SELECT user_id FROM user_subscriptions 
    WHERE stripe_customer_id = stripe_customer_id_param 
       OR stripe_subscription_id = stripe_subscription_id_param
    LIMIT 1
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
    canceled_at = EXCLUDED.canceled_at,
    updated_at = EXCLUDED.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record billing events
CREATE OR REPLACE FUNCTION record_billing_event(
  stripe_customer_id_param text,
  stripe_invoice_id_param text,
  stripe_payment_intent_id_param text DEFAULT NULL,
  amount_param integer,
  currency_param text DEFAULT 'usd',
  status_param text DEFAULT 'paid',
  invoice_url_param text DEFAULT NULL,
  receipt_url_param text DEFAULT NULL,
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
  LEFT JOIN user_subscriptions us ON up.id = us.user_id
  WHERE us.stripe_customer_id = stripe_customer_id_param;
  
  -- Map payment status
  mapped_status := CASE status_param
    WHEN 'paid' THEN 'paid'::payment_status
    WHEN 'pending' THEN 'pending'::payment_status
    WHEN 'failed' THEN 'failed'::payment_status
    WHEN 'refunded' THEN 'refunded'::payment_status
    WHEN 'canceled' THEN 'canceled'::payment_status
    ELSE 'pending'::payment_status
  END;
  
  -- Insert billing record
  INSERT INTO billing_history (
    user_id,
    subscription_id,
    stripe_invoice_id,
    stripe_payment_intent_id,
    amount,
    currency,
    status,
    invoice_url,
    receipt_url,
    paid_at,
    created_at
  ) VALUES (
    user_uuid,
    subscription_uuid,
    stripe_invoice_id_param,
    stripe_payment_intent_id_param,
    amount_param,
    currency_param,
    mapped_status,
    invoice_url_param,
    receipt_url_param,
    COALESCE(paid_at_param, now()),
    now()
  )
  ON CONFLICT (stripe_invoice_id) DO UPDATE SET
    status = EXCLUDED.status,
    paid_at = EXCLUDED.paid_at,
    receipt_url = EXCLUDED.receipt_url;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get comprehensive user stats
CREATE OR REPLACE FUNCTION get_user_stats(user_uuid uuid)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'profile', json_build_object(
      'email', up.email,
      'full_name', up.full_name,
      'member_since', up.created_at,
      'last_active', up.last_active_at,
      'onboarding_completed', up.onboarding_completed
    ),
    'subscription', json_build_object(
      'status', us.status,
      'plan_type', us.plan_type,
      'current_period_end', us.current_period_end,
      'cancel_at_period_end', us.cancel_at_period_end,
      'trial_end', us.trial_end
    ),
    'usage', json_build_object(
      'total_conversations', COUNT(DISTINCT cc.id),
      'total_messages', COUNT(cm.id),
      'last_conversation', MAX(cc.last_message_at)
    ),
    'growth', json_build_object(
      'tracked_platforms', COUNT(DISTINCT gm.platform),
      'total_achievements', COUNT(DISTINCT ua.id),
      'latest_metrics', COUNT(gm.id)
    )
  ) INTO result
  FROM user_profiles up
  LEFT JOIN user_subscriptions us ON up.id = us.user_id
  LEFT JOIN chat_conversations cc ON up.id = cc.user_id AND cc.is_archived = false
  LEFT JOIN chat_messages cm ON cc.id = cm.conversation_id
  LEFT JOIN growth_metrics gm ON up.id = gm.user_id AND gm.recorded_at > now() - interval '30 days'
  LEFT JOIN user_achievements ua ON up.id = ua.user_id
  WHERE up.id = user_uuid
  GROUP BY up.id, up.email, up.full_name, up.created_at, up.last_active_at, up.onboarding_completed,
           us.status, us.plan_type, us.current_period_end, us.cancel_at_period_end, us.trial_end;
  
  RETURN COALESCE(result, '{}'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup old data (maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
  -- Clean up expired sessions
  DELETE FROM user_sessions WHERE expires_at < now() - interval '7 days';
  
  -- Clean up old growth metrics (keep last 90 days)
  DELETE FROM growth_metrics WHERE recorded_at < now() - interval '90 days';
  
  -- Archive old conversations (no activity for 30 days)
  UPDATE chat_conversations 
  SET is_archived = true, updated_at = now()
  WHERE last_message_at < now() - interval '30 days' 
    AND is_archived = false;
  
  -- Clean up very old archived conversations (keep for 1 year)
  DELETE FROM chat_conversations 
  WHERE is_archived = true 
    AND updated_at < now() - interval '1 year';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track user activity
CREATE OR REPLACE FUNCTION update_user_activity(user_uuid uuid)
RETURNS void AS $$
BEGIN
  UPDATE user_profiles 
  SET last_active_at = now(), updated_at = now()
  WHERE id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to award achievements
CREATE OR REPLACE FUNCTION award_achievement(
  user_uuid uuid,
  achievement_type_param text,
  platform_param text DEFAULT NULL,
  metadata_param jsonb DEFAULT '{}'
)
RETURNS boolean AS $$
DECLARE
  mapped_platform social_platform;
BEGIN
  -- Map platform if provided
  IF platform_param IS NOT NULL THEN
    mapped_platform := platform_param::social_platform;
  END IF;
  
  -- Insert achievement (will fail silently if already exists due to unique constraint)
  INSERT INTO user_achievements (user_id, achievement_type, platform, metadata, achieved_at)
  VALUES (user_uuid, achievement_type_param, mapped_platform, metadata_param, now())
  ON CONFLICT (user_id, achievement_type, platform) DO NOTHING;
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
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

CREATE TRIGGER user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER content_templates_updated_at
  BEFORE UPDATE ON content_templates
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

-- Grant necessary permissions to functions
GRANT EXECUTE ON FUNCTION create_user_profile() TO service_role;
GRANT EXECUTE ON FUNCTION update_updated_at_column() TO service_role;
GRANT EXECUTE ON FUNCTION update_conversation_stats() TO service_role;
GRANT EXECUTE ON FUNCTION user_has_active_subscription(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_user_subscription_status(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_subscription_from_stripe(text, text, text, text, text, timestamptz, timestamptz, boolean, timestamptz, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION record_billing_event(text, text, text, integer, text, text, text, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION get_user_stats(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION cleanup_old_data() TO service_role;
GRANT EXECUTE ON FUNCTION update_user_activity(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION award_achievement(uuid, text, text, jsonb) TO authenticated, service_role;

-- Insert sample content templates for social media growth
INSERT INTO content_templates (title, description, platform, category, template_content, tags, is_premium) VALUES
('LinkedIn Thought Leadership Post', 'Establish authority in your industry', 'linkedin', 'thought_leadership', 'Here''s what I learned about [TOPIC] after [EXPERIENCE]:\n\n1. [KEY INSIGHT 1]\n2. [KEY INSIGHT 2]\n3. [KEY INSIGHT 3]\n\nThe biggest game-changer? [MAIN TAKEAWAY]\n\nWhat''s your experience with [TOPIC]?', ARRAY['leadership', 'insights', 'engagement'], false),

('Twitter Viral Thread Starter', 'Create engaging Twitter threads', 'twitter', 'viral_content', '🧵 THREAD: [NUMBER] lessons I wish I knew about [TOPIC] when I started:\n\n1/ [LESSON 1 - Hook them with a strong opener]', ARRAY['threads', 'viral', 'education'], false),

('Instagram Story Engagement', 'Boost Instagram story interactions', 'instagram', 'engagement', 'Quick question for my amazing followers! 👇\n\n[ENGAGING QUESTION]\n\nA) [OPTION A]\nB) [OPTION B]\n\nVote in the poll below! 📊', ARRAY['stories', 'polls', 'engagement'], false),

('LinkedIn Company Update', 'Share company news and updates', 'linkedin', 'company_updates', '🎉 Exciting news from [COMPANY NAME]!\n\n[MAIN ANNOUNCEMENT]\n\nThis means [BENEFIT TO AUDIENCE].\n\nWant to learn more? [CALL TO ACTION]', ARRAY['announcements', 'company', 'updates'], true),

('Twitter Engagement Hook', 'Start conversations on Twitter', 'twitter', 'engagement', 'Unpopular opinion about [INDUSTRY/TOPIC]:\n\n[CONTROVERSIAL BUT THOUGHTFUL TAKE]\n\nAm I wrong? What''s your take? 👇', ARRAY['opinions', 'debate', 'engagement'], false),

('Instagram Carousel Post', 'Educational carousel content', 'instagram', 'educational', 'Slide 1: [ATTENTION-GRABBING TITLE]\n\nSlide 2-5: [STEP-BY-STEP CONTENT]\n\nSlide 6: [SUMMARY + CTA]\n\nCaption: [DETAILED EXPLANATION WITH HASHTAGS]', ARRAY['carousel', 'education', 'tutorial'], true)

ON CONFLICT DO NOTHING;

-- Create helpful views for common queries
CREATE OR REPLACE VIEW active_subscriptions AS
SELECT 
  us.*,
  up.email,
  up.full_name
FROM user_subscriptions us
JOIN user_profiles up ON us.user_id = up.id
WHERE us.status IN ('active', 'trialing')
  AND (us.current_period_end IS NULL OR us.current_period_end > now());

CREATE OR REPLACE VIEW subscription_revenue AS
SELECT 
  DATE_TRUNC('month', bh.paid_at) as month,
  COUNT(DISTINCT bh.user_id) as paying_customers,
  SUM(bh.amount) as total_revenue_cents,
  SUM(bh.amount) / 100.0 as total_revenue_dollars,
  AVG(bh.amount) / 100.0 as avg_revenue_per_customer
FROM billing_history bh
WHERE bh.status = 'paid'
  AND bh.paid_at IS NOT NULL
GROUP BY DATE_TRUNC('month', bh.paid_at)
ORDER BY month DESC;

-- Grant access to views
GRANT SELECT ON active_subscriptions TO service_role;
GRANT SELECT ON subscription_revenue TO service_role;

-- Add helpful table comments
COMMENT ON TABLE user_profiles IS 'Enhanced user profiles with preferences and activity tracking';
COMMENT ON TABLE user_subscriptions IS 'Complete Stripe subscription management with lifecycle tracking';
COMMENT ON TABLE billing_history IS 'Comprehensive payment and billing event tracking';
COMMENT ON TABLE user_sessions IS 'User session management for security and analytics';
COMMENT ON TABLE chat_conversations IS 'Organized chat conversations with archiving support';
COMMENT ON TABLE chat_messages IS 'Individual chat messages with role-based content';
COMMENT ON TABLE user_preferences IS 'User settings and notification preferences';
COMMENT ON TABLE growth_metrics IS 'Social media growth tracking and analytics';
COMMENT ON TABLE content_templates IS 'Pre-built content templates for social media growth';
COMMENT ON TABLE user_achievements IS 'Gamification system for user engagement';

-- Add column comments for clarity
COMMENT ON COLUMN user_subscriptions.status IS 'Stripe subscription status: active, inactive, trialing, past_due, canceled, unpaid, incomplete, incomplete_expired';
COMMENT ON COLUMN user_subscriptions.plan_type IS 'Subscription plan type: monthly or yearly';
COMMENT ON COLUMN billing_history.amount IS 'Payment amount in cents (e.g., 499 = $4.99)';
COMMENT ON COLUMN growth_metrics.metric_value IS 'Numeric value for the metric (followers count, engagement rate, etc.)';
COMMENT ON COLUMN content_templates.is_premium IS 'Whether template requires active subscription to access';

-- Final success message
DO $$
BEGIN
  RAISE NOTICE 'AskStan platform database schema created successfully!';
  RAISE NOTICE 'Tables created: user_profiles, user_subscriptions, billing_history, user_sessions, chat_conversations, chat_messages, user_preferences, growth_metrics, content_templates, user_achievements';
  RAISE NOTICE 'Security: RLS enabled on all tables with comprehensive policies';
  RAISE NOTICE 'Performance: Optimized indexes created for all common queries';
  RAISE NOTICE 'Automation: Triggers and functions set up for data consistency';
  RAISE NOTICE 'Ready for Stripe integration and social media growth coaching!';
END $$;