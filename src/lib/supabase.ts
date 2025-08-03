import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Enhanced TypeScript types for the comprehensive schema
export type UserProfile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  timezone: string;
  preferences: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export type UserSubscription = {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  status: 'active' | 'inactive' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'incomplete_expired';
  plan_type: 'monthly' | 'yearly' | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  trial_start: string | null;
  trial_end: string | null;
  created_at: string;
  updated_at: string;
};

export type BillingHistory = {
  id: string;
  user_id: string;
  subscription_id: string | null;
  stripe_invoice_id: string | null;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed' | 'refunded';
  invoice_url: string | null;
  paid_at: string | null;
  created_at: string;
};

export type ChatConversation = {
  id: string;
  user_id: string;
  title: string;
  last_message_at: string;
  message_count: number;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  user_id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  metadata: Record<string, any>;
  created_at: string;
};

export type UserSession = {
  id: string;
  user_id: string;
  session_token: string;
  ip_address: string | null;
  user_agent: string | null;
  expires_at: string;
  created_at: string;
};

export type UserSubscriptionDetails = {
  id: string;
  email: string;
  full_name: string | null;
  user_created_at: string;
  subscription_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  plan_type: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  trial_end: string | null;
  has_active_subscription: boolean;
};

// Utility functions for subscription management
export const subscriptionUtils = {
  async getUserSubscriptionDetails(userId: string): Promise<UserSubscriptionDetails | null> {
    const { data, error } = await supabase
      .from('user_subscription_details')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching subscription details:', error);
      return null;
    }

    return data;
  },

  async hasActiveSubscription(userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .rpc('user_has_active_subscription', { user_uuid: userId });

    if (error) {
      console.error('Error checking subscription status:', error);
      return false;
    }

    return data || false;
  },

  async getUserStats(userId: string): Promise<any> {
    const { data, error } = await supabase
      .rpc('get_user_stats', { user_uuid: userId });

    if (error) {
      console.error('Error fetching user stats:', error);
      return {};
    }

    return data || {};
  },

  async getBillingHistory(userId: string): Promise<BillingHistory[]> {
    const { data, error } = await supabase
      .from('billing_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching billing history:', error);
      return [];
    }

    return data || [];
  },

  async getConversations(userId: string): Promise<ChatConversation[]> {
    const { data, error } = await supabase
      .from('chat_conversations')
      .select('*')
      .eq('user_id', userId)
      .order('last_message_at', { ascending: false });

    if (error) {
      console.error('Error fetching conversations:', error);
      return [];
    }

    return data || [];
  },

  async getMessages(conversationId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return [];
    }

    return data || [];
  }
};

// Legacy types for backward compatibility
export type Profile = UserProfile;
export type Subscription = UserSubscription;