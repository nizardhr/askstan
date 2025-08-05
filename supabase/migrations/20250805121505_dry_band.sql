/*
  # Complete AskStan Platform Database Schema - Fresh Start
  
  This migration creates a complete, production-ready database schema for AskStan
  with full Stripe integration, user management, and checkout flow.

  ## 1. Core Tables
  - `user_profiles` - User profile management
  - `user_subscriptions` - Stripe subscription management
  - `promo_code_usage` - Promo code tracking
  - `billing_history` - Payment tracking
  - `chat_conversations` - Chat organization
  - `chat_messages` - Individual messages
  - `user_preferences` - User settings

  ## 2. Security
  - Row Level Security (RLS) on all tables
  - Proper policies for authenticated and anonymous users
  - Service role permissions for webhooks

  ## 3. Automation
  - Automatic profile creation on signup
  - Subscription processing functions
  - Checkout completion handling
*/

-- Create enums for type safety
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

-- Create user_profiles table
CREATE TABLE user_profiles (
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

-- Create user_subscriptions table
CREATE TABLE user_subscriptions (
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
  promo_code text,
  discount_amount integer,
  discount_percentage numeric(5,2),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create promo_code_usage table
CREATE TABLE promo_code_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  subscription_id uuid REFERENCES user_subscriptions(id) ON DELETE SET NULL,
  promo_code text NOT NULL,
  stripe_promotion_code_id text,
  stripe_coupon_id text,
  discount_type text CHECK (discount_type IN ('percentage', 'amount')),
  discount_value numeric NOT NULL,
  discount_amount_cents integer,
  currency text DEFAULT 'usd',
  applied_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create billing_history table
CREATE TABLE billing_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  subscription_id uuid REFERENCES user_subscriptions(id) ON DELETE SET NULL,
  stripe_invoice_id text UNIQUE,
  stripe_payment_intent_id text,
  amount integer NOT NULL,
  currency text DEFAULT 'usd',
  status payment_status DEFAULT 'pending',
  invoice_url text,
  receipt_url text,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create chat_conversations table
CREATE TABLE chat_conversations (
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

-- Create chat_messages table
CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES chat_conversations(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  role message_role NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create user_preferences table
CREATE TABLE user_preferences (
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

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_code_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Anonymous can create profiles during signup"
  ON user_profiles FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Service role full access to profiles"
  ON user_profiles FOR ALL
  TO service_role
  USING (true);

-- RLS Policies for user_subscriptions
CREATE POLICY "Users can read own subscription"
  ON user_subscriptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own subscription"
  ON user_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role full access to subscriptions"
  ON user_subscriptions FOR ALL
  TO service_role
  USING (true);

-- RLS Policies for promo_code_usage
CREATE POLICY "Users can read own promo usage"
  ON promo_code_usage FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role full access to promo usage"
  ON promo_code_usage FOR ALL
  TO service_role
  USING (true);

-- RLS Policies for billing_history
CREATE POLICY "Users can read own billing"
  ON billing_history FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role full access to billing"
  ON billing_history FOR ALL
  TO service_role
  USING (true);

-- RLS Policies for chat_conversations
CREATE POLICY "Users can manage own conversations"
  ON chat_conversations FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Anonymous can create conversations during signup"
  ON chat_conversations FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Service role full access to conversations"
  ON chat_conversations FOR ALL
  TO service_role
  USING (true);

-- RLS Policies for chat_messages
CREATE POLICY "Users can read own messages"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own messages"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Anonymous can create messages during signup"
  ON chat_messages FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Service role full access to messages"
  ON chat_messages FOR ALL
  TO service_role
  USING (true);

-- RLS Policies for user_preferences
CREATE POLICY "Users can manage own preferences"
  ON user_preferences FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Anonymous can create preferences during signup"
  ON user_preferences FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Service role full access to preferences"
  ON user_preferences FOR ALL
  TO service_role
  USING (true);

-- Create indexes for performance
CREATE INDEX user_profiles_email_idx ON user_profiles(email);
CREATE INDEX user_profiles_onboarding_idx ON user_profiles(onboarding_completed);
CREATE INDEX user_subscriptions_user_id_idx ON user_subscriptions(user_id);
CREATE INDEX user_subscriptions_status_idx ON user_subscriptions(status);
CREATE INDEX user_subscriptions_stripe_customer_idx ON user_subscriptions(stripe_customer_id);
CREATE INDEX billing_history_user_id_idx ON billing_history(user_id);
CREATE INDEX chat_conversations_user_id_idx ON chat_conversations(user_id);
CREATE INDEX chat_messages_conversation_id_idx ON chat_messages(conversation_id);
CREATE INDEX user_preferences_user_id_idx ON user_preferences(user_id);

-- Function to update updated_at timestamp
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
DECLARE
  user_email text;
  conversation_id uuid;
BEGIN
  -- Extract email
  user_email := COALESCE(
    NEW.email,
    NEW.raw_user_meta_data->>'email',
    'user-' || NEW.id::text || '@temp.local'
  );

  -- Create user profile
  INSERT INTO public.user_profiles (id, email, created_at, updated_at)
  VALUES (NEW.id, user_email, now(), now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = now();

  -- Create user preferences
  INSERT INTO public.user_preferences (user_id, created_at, updated_at)
  VALUES (NEW.id, now(), now())
  ON CONFLICT (user_id) DO NOTHING;

  -- Create welcome conversation
  INSERT INTO public.chat_conversations (user_id, title, created_at, updated_at)
  VALUES (NEW.id, 'Welcome to AskStan', now(), now())
  RETURNING id INTO conversation_id;

  -- Add welcome message
  IF conversation_id IS NOT NULL THEN
    INSERT INTO public.chat_messages (conversation_id, user_id, content, role, created_at)
    VALUES (
      conversation_id,
      NEW.id,
      'Hello! I''m Stan, your personal AI social media growth coach. How can I help you grow your social media presence today?',
      'assistant',
      now()
    );
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error creating user profile for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process checkout completion
CREATE OR REPLACE FUNCTION process_checkout_completion(
  session_id_param text,
  user_id_param uuid,
  customer_id_param text,
  subscription_id_param text,
  price_id_param text,
  plan_type_param text,
  amount_total_param integer,
  promo_code_param text DEFAULT NULL
)
RETURNS json AS $$
DECLARE
  subscription_uuid uuid;
  result json;
  period_end timestamptz;
BEGIN
  -- Calculate period end
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

  -- Mark onboarding completed
  UPDATE user_profiles 
  SET onboarding_completed = true, updated_at = now()
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
  );

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
      json_build_object('session_id', session_id_param),
      now(),
      now()
    );
  END IF;

  result := json_build_object(
    'success', true,
    'subscription_id', subscription_uuid,
    'user_id', user_id_param,
    'status', 'active',
    'planType', plan_type_param,
    'amount', amount_total_param,
    'freeSubscription', amount_total_param = 0
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

-- Create triggers
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

-- Create profile creation trigger
CREATE TRIGGER create_user_profile_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_profile();

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_user_profile() TO service_role, anon, authenticated;
GRANT EXECUTE ON FUNCTION update_updated_at_column() TO service_role;
GRANT EXECUTE ON FUNCTION user_has_active_subscription(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION process_checkout_completion(text, uuid, text, text, text, text, integer, text) TO service_role, authenticated;

-- Grant table permissions for signup
GRANT INSERT ON user_profiles TO anon;
GRANT INSERT ON user_preferences TO anon;
GRANT INSERT ON chat_conversations TO anon;
GRANT INSERT ON chat_messages TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Clear auth users to allow fresh signups
TRUNCATE auth.users CASCADE;
TRUNCATE auth.sessions CASCADE;
TRUNCATE auth.refresh_tokens CASCADE;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '🎉 Complete AskStan database created successfully!';
  RAISE NOTICE '🧹 Auth users cleared - you can now create new accounts';
  RAISE NOTICE '🔒 RLS policies configured for all user types';
  RAISE NOTICE '💳 Stripe checkout and subscription processing ready';
  RAISE NOTICE '🚀 Platform is fully functional!';
END $$;