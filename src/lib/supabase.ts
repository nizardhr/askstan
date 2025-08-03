import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Comprehensive TypeScript types for the complete platform schema
export type UserProfile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  timezone: string;
  onboarding_completed: boolean;
  last_active_at: string;
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
  stripe_payment_intent_id: string | null;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed' | 'refunded' | 'canceled';
  invoice_url: string | null;
  receipt_url: string | null;
  paid_at: string | null;
  created_at: string;
};

export type ChatConversation = {
  id: string;
  user_id: string;
  title: string;
  last_message_at: string;
  message_count: number;
  is_archived: boolean;
  metadata: Record<string, any>;
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

export type UserPreferences = {
  id: string;
  user_id: string;
  email_notifications: boolean;
  push_notifications: boolean;
  marketing_emails: boolean;
  theme: 'light' | 'dark' | 'auto';
  language: string;
  social_platforms: string[];
  growth_goals: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export type GrowthMetrics = {
  id: string;
  user_id: string;
  platform: 'linkedin' | 'twitter' | 'instagram' | 'threads' | 'tiktok' | 'facebook' | 'youtube';
  metric_type: string;
  metric_value: number;
  recorded_at: string;
  metadata: Record<string, any>;
  created_at: string;
};

export type ContentTemplate = {
  id: string;
  title: string;
  description: string | null;
  platform: 'linkedin' | 'twitter' | 'instagram' | 'threads' | 'tiktok' | 'facebook' | 'youtube';
  category: string;
  template_content: string;
  tags: string[];
  is_premium: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
};

export type UserAchievement = {
  id: string;
  user_id: string;
  achievement_type: string;
  platform: 'linkedin' | 'twitter' | 'instagram' | 'threads' | 'tiktok' | 'facebook' | 'youtube' | null;
  achieved_at: string;
  metadata: Record<string, any>;
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

// Comprehensive utility functions for platform management
export const platformUtils = {
  // User Profile Management
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }

    return data;
  },

  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user profile:', error);
      return null;
    }

    return data;
  },

  // Subscription Management
  async getUserSubscription(userId: string): Promise<UserSubscription | null> {
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching subscription:', error);
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

  async getSubscriptionStatus(userId: string): Promise<string> {
    const { data, error } = await supabase
      .rpc('get_user_subscription_status', { user_uuid: userId });

    if (error) {
      console.error('Error getting subscription status:', error);
      return 'inactive';
    }

    return data || 'inactive';
  },

  // Billing Management
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

  // Chat Management
  async getConversations(userId: string, includeArchived = false): Promise<ChatConversation[]> {
    let query = supabase
      .from('chat_conversations')
      .select('*')
      .eq('user_id', userId);

    if (!includeArchived) {
      query = query.eq('is_archived', false);
    }

    const { data, error } = await query.order('last_message_at', { ascending: false });

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
  },

  async createConversation(userId: string, title: string = 'New Conversation'): Promise<ChatConversation | null> {
    const { data, error } = await supabase
      .from('chat_conversations')
      .insert({
        user_id: userId,
        title,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating conversation:', error);
      return null;
    }

    return data;
  },

  async addMessage(conversationId: string, userId: string, content: string, role: 'user' | 'assistant' | 'system' = 'user'): Promise<ChatMessage | null> {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        user_id: userId,
        content,
        role,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding message:', error);
      return null;
    }

    return data;
  },

  // User Preferences
  async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    const { data, error } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching user preferences:', error);
      return null;
    }

    return data;
  },

  async updateUserPreferences(userId: string, updates: Partial<UserPreferences>): Promise<UserPreferences | null> {
    const { data, error } = await supabase
      .from('user_preferences')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user preferences:', error);
      return null;
    }

    return data;
  },

  // Growth Metrics
  async recordGrowthMetric(
    userId: string, 
    platform: string, 
    metricType: string, 
    metricValue: number, 
    metadata: Record<string, any> = {}
  ): Promise<GrowthMetrics | null> {
    const { data, error } = await supabase
      .from('growth_metrics')
      .insert({
        user_id: userId,
        platform,
        metric_type: metricType,
        metric_value: metricValue,
        metadata,
        recorded_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error recording growth metric:', error);
      return null;
    }

    return data;
  },

  async getGrowthMetrics(userId: string, platform?: string, days: number = 30): Promise<GrowthMetrics[]> {
    let query = supabase
      .from('growth_metrics')
      .select('*')
      .eq('user_id', userId)
      .gte('recorded_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

    if (platform) {
      query = query.eq('platform', platform);
    }

    const { data, error } = await query.order('recorded_at', { ascending: false });

    if (error) {
      console.error('Error fetching growth metrics:', error);
      return [];
    }

    return data || [];
  },

  // Content Templates
  async getContentTemplates(platform?: string, category?: string, premiumOnly: boolean = false): Promise<ContentTemplate[]> {
    let query = supabase.from('content_templates').select('*');

    if (platform) {
      query = query.eq('platform', platform);
    }

    if (category) {
      query = query.eq('category', category);
    }

    if (premiumOnly) {
      query = query.eq('is_premium', true);
    }

    const { data, error } = await query.order('usage_count', { ascending: false });

    if (error) {
      console.error('Error fetching content templates:', error);
      return [];
    }

    return data || [];
  },

  async incrementTemplateUsage(templateId: string): Promise<void> {
    const { error } = await supabase
      .from('content_templates')
      .update({
        usage_count: supabase.sql`usage_count + 1`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', templateId);

    if (error) {
      console.error('Error incrementing template usage:', error);
    }
  },

  // User Achievements
  async getUserAchievements(userId: string): Promise<UserAchievement[]> {
    const { data, error } = await supabase
      .from('user_achievements')
      .select('*')
      .eq('user_id', userId)
      .order('achieved_at', { ascending: false });

    if (error) {
      console.error('Error fetching user achievements:', error);
      return [];
    }

    return data || [];
  },

  async awardAchievement(
    userId: string, 
    achievementType: string, 
    platform?: string, 
    metadata: Record<string, any> = {}
  ): Promise<boolean> {
    const { data, error } = await supabase
      .rpc('award_achievement', {
        user_uuid: userId,
        achievement_type_param: achievementType,
        platform_param: platform,
        metadata_param: metadata,
      });

    if (error) {
      console.error('Error awarding achievement:', error);
      return false;
    }

    return data || false;
  },

  // User Stats
  async getUserStats(userId: string): Promise<any> {
    const { data, error } = await supabase
      .rpc('get_user_stats', { user_uuid: userId });

    if (error) {
      console.error('Error fetching user stats:', error);
      return {};
    }

    return data || {};
  },

  // Activity Tracking
  async updateUserActivity(userId: string): Promise<void> {
    const { error } = await supabase
      .rpc('update_user_activity', { user_uuid: userId });

    if (error) {
      console.error('Error updating user activity:', error);
    }
  },

  // Session Management
  async createUserSession(userId: string, sessionToken: string, expiresAt: Date, ipAddress?: string, userAgent?: string): Promise<UserSession | null> {
    const { data, error } = await supabase
      .from('user_sessions')
      .insert({
        user_id: userId,
        session_token: sessionToken,
        ip_address: ipAddress,
        user_agent: userAgent,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating user session:', error);
      return null;
    }

    return data;
  },

  async getUserSessions(userId: string): Promise<UserSession[]> {
    const { data, error } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user sessions:', error);
      return [];
    }

    return data || [];
  },

  async revokeUserSession(sessionToken: string): Promise<boolean> {
    const { error } = await supabase
      .from('user_sessions')
      .delete()
      .eq('session_token', sessionToken);

    if (error) {
      console.error('Error revoking user session:', error);
      return false;
    }

    return true;
  },
};

// Legacy types for backward compatibility
export type Profile = UserProfile;
export type Subscription = UserSubscription;

// Export utility functions with legacy names
export const subscriptionUtils = {
  getUserSubscriptionDetails: platformUtils.getUserSubscription,
  hasActiveSubscription: platformUtils.hasActiveSubscription,
  getUserStats: platformUtils.getUserStats,
  getBillingHistory: platformUtils.getBillingHistory,
  getConversations: platformUtils.getConversations,
  getMessages: platformUtils.getMessages,
};