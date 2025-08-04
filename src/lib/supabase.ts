import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Type definitions
export type UserProfile = {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  timezone?: string;
  onboarding_completed?: boolean;
  last_active_at?: string;
  preferences?: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export type UserSubscription = {
  id: string;
  user_id: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  stripe_price_id?: string;
  status: 'active' | 'inactive' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'incomplete_expired';
  plan_type?: 'monthly' | 'yearly';
  current_period_start?: string;
  current_period_end?: string;
  cancel_at_period_end?: boolean;
  canceled_at?: string;
  trial_start?: string;
  trial_end?: string;
  promo_code?: string;
  discount_amount?: number;
  discount_percentage?: number;
  created_at: string;
  updated_at: string;
};