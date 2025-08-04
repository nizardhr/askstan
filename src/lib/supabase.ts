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
  stripe_customer_id: string;
  stripe_subscription_id: string;
  stripe_price_id: string;
  status: 'active' | 'inactive' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'incomplete_expired';
  plan_type: 'monthly' | 'yearly';
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end?: boolean;
  canceled_at?: string;
  trial_start?: string;
  trial_end?: string;
  created_at: string;
  updated_at: string;
};

export type BillingHistory = {
  id: string;
  user_id: string;
  subscription_id?: string;
  stripe_invoice_id?: string;
  stripe_payment_intent_id?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded' | 'canceled';
  invoice_url?: string;
  receipt_url?: string;
  paid_at?: string;
  created_at: string;
};

export type ChatConversation = {
  id: string;
  user_id: string;
  title: string;
  last_message_at: string;
  message_count: number;
  is_archived?: boolean;
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

export type PromoCodeUsage = {
  id: string;
  user_id: string;
  promo_code: string;
  stripe_promotion_code_id: string;
  discount_amount: number | null;
  discount_percentage: number | null;
  applied_at: string;
  subscription_id: string | null;
};

// ============================================================================
// FIXED PLATFORM UTILS - NO MORE TIMEOUTS!
// ============================================================================
export const platformUtils = {
  // User Profile Management - COMPLETELY REMOVED TIMEOUTS
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      console.log('🔍 [platformUtils] Getting profile for user:', userId);
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('❌ [platformUtils] Error fetching user profile:', error);
        // Try to create profile if it doesn't exist
        return await this.createUserProfile(userId);
      }

      if (!data) {
        console.log('⚠️ [platformUtils] No profile found, attempting to create one...');
        return await this.createUserProfile(userId);
      }

      console.log('✅ [platformUtils] Profile found:', data.email);
      return data;
    } catch (error) {
      console.error('💥 [platformUtils] Exception in getUserProfile:', error);
      // Fallback to profile creation
      return await this.createUserProfile(userId);
    }
  },

  // Profile creation - NO TIMEOUTS, DIRECT APPROACH
  async createUserProfile(userId?: string): Promise<UserProfile | null> {
    try {
      if (!userId) {
        // Get current user ID from auth
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error('❌ [platformUtils] No authenticated user for profile creation');
          return null;
        }
        userId = user.id;
      }

      console.log('🔨 [platformUtils] Creating profile for user:', userId);

      // Get user info from auth for email
      const { data: { user } } = await supabase.auth.getUser();
      const email = user?.email || `user-${userId}@temp.local`;
      
      console.log('📧 [platformUtils] Creating profile with email:', email);

      const { data, error } = await supabase
        .from('user_profiles')
        .upsert({
          id: userId,
          email: email,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('❌ [platformUtils] Error creating user profile:', error);
        return null;
      }

      console.log('✅ [platformUtils] Profile created successfully:', data.email);

      // Create user preferences asynchronously (don't wait)
      this.createUserPreferences(userId).catch(prefError => {
        console.error('⚠️ [platformUtils] Failed to create preferences (non-blocking):', prefError);
      });

      return data;
    } catch (error) {
      console.error('💥 [platformUtils] Exception in createUserProfile:', error);
      return null;
    }
  },

  // Create user preferences - NO TIMEOUTS
  async createUserPreferences(userId: string): Promise<void> {
    try {
      console.log('🔧 [platformUtils] Creating preferences for user:', userId);
      
      const { error } = await supabase
        .from('user_preferences')
        .upsert({
          user_id: userId,
          email_notifications: true,
          push_notifications: true,
          marketing_emails: false,
          theme: 'auto',
          language: 'en',
          social_platforms: [],
          growth_goals: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (error && !error.message?.includes('duplicate key')) {
        console.error('❌ [platformUtils] Error creating preferences:', error);
      } else {
        console.log('✅ [platformUtils] Preferences created successfully');
      }
    } catch (error) {
      console.error('💥 [platformUtils] Error creating preferences:', error);
    }
  },

  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
    try {
      console.log('📝 [platformUtils] Updating profile for user:', userId);
      
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
        console.error('❌ [platformUtils] Error updating user profile:', error);
        return null;
      }

      console.log('✅ [platformUtils] Profile updated successfully');
      return data;
    } catch (error) {
      console.error('💥 [platformUtils] Exception in updateUserProfile:', error);
      return null;
    }
  },

  // Subscription Management - NO TIMEOUTS
  async getUserSubscription(userId: string): Promise<UserSubscription | null> {
    try {
      console.log('💳 [platformUtils] Getting subscription for user:', userId);
      
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('❌ [platformUtils] Error fetching subscription:', error);
        return null;
      }

      if (!data) {
        console.log('ℹ️ [platformUtils] No subscription found (expected for new users)');
        return null;
      }

      console.log('✅ [platformUtils] Subscription found:', data.status);
      return data;
    } catch (error) {
      console.error('💥 [platformUtils] Exception in getUserSubscription:', error);
      return null;
    }
  },

  async hasActiveSubscription(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .rpc('user_has_active_subscription', { user_uuid: userId });

      if (error) {
        console.error('❌ [platformUtils] Error checking subscription status:', error);
        return false;
      }

      return data || false;
    } catch (error) {
      console.error('💥 [platformUtils] Exception in hasActiveSubscription:', error);
      return false;
    }
  },

  async getSubscriptionStatus(userId: string): Promise<string> {
    try {
      const { data, error } = await supabase
        .rpc('get_user_subscription_status', { user_uuid: userId });

      if (error) {
        console.error('❌ [platformUtils] Error getting subscription status:', error);
        return 'inactive';
      }

      return data || 'inactive';
    } catch (error) {
      console.error('💥 [platformUtils] Exception in getSubscriptionStatus:', error);
      return 'inactive';
    }
  },

  // NEW: Session ID Processing for Stripe Checkout Completion
  async processStripeCheckoutSession(sessionId: string): Promise<boolean> {
    try {
      console.log('🔄 [platformUtils] Processing Stripe checkout session:', sessionId);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.error('❌ [platformUtils] No authenticated session for checkout processing');
        return false;
      }

      // Call the new edge function to process the checkout session
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-checkout-session`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ [platformUtils] Checkout session processing failed:', errorData);
        return false;
      }

      const result = await response.json();
      console.log('✅ [platformUtils] Checkout session processed successfully:', result);
      return result.success === true;
    } catch (error) {
      console.error('💥 [platformUtils] Exception in processStripeCheckoutSession:', error);
      return false;
    }
  },

  // Activity Tracking - Improved error handling
  async updateUserActivity(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .rpc('update_user_activity', { user_uuid: userId });

      if (error) {
        console.error('❌ [platformUtils] Error updating user activity:', error);
      }
    } catch (error) {
      console.error('💥 [platformUtils] Exception in updateUserActivity:', error);
    }
  },

  // User Stats - Improved error handling
  async getUserStats(userId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .rpc('get_user_stats', { user_uuid: userId });

      if (error) {
        console.error('❌ [platformUtils] Error fetching user stats:', error);
        return {};
      }

      return data || {};
    } catch (error) {
      console.error('💥 [platformUtils] Exception in getUserStats:', error);
      return {};
    }
  },

  // Chat Management
  async getConversations(userId: string, includeArchived = false): Promise<ChatConversation[]> {
    try {
      let query = supabase
        .from('chat_conversations')
        .select('*')
        .eq('user_id', userId);

      if (!includeArchived) {
        query = query.eq('is_archived', false);
      }

      const { data, error } = await query.order('last_message_at', { ascending: false });

      if (error) {
        console.error('❌ [platformUtils] Error fetching conversations:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('💥 [platformUtils] Exception in getConversations:', error);
      return [];
    }
  },

  async getMessages(conversationId: string): Promise<ChatMessage[]> {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('❌ [platformUtils] Error fetching messages:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('💥 [platformUtils] Exception in getMessages:', error);
      return [];
    }
  },

  async createConversation(userId: string, title: string = 'New Conversation'): Promise<ChatConversation | null> {
    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .insert({
          user_id: userId,
          title,
          message_count: 0,
          last_message_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('❌ [platformUtils] Error creating conversation:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('💥 [platformUtils] Exception in createConversation:', error);
      return null;
    }
  },

  async addMessage(conversationId: string, userId: string, content: string, role: 'user' | 'assistant' | 'system' = 'user'): Promise<ChatMessage | null> {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          user_id: userId,
          content,
          role,
          metadata: {},
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('❌ [platformUtils] Error adding message:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('💥 [platformUtils] Exception in addMessage:', error);
      return null;
    }
  },

  // User Preferences
  async getUserPreferences(userId: string): Promise<UserPreferences | null> {
    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('❌ [platformUtils] Error fetching user preferences:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('💥 [platformUtils] Exception in getUserPreferences:', error);
      return null;
    }
  },

  async updateUserPreferences(userId: string, updates: Partial<UserPreferences>): Promise<UserPreferences | null> {
    try {
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
        console.error('❌ [platformUtils] Error updating user preferences:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('💥 [platformUtils] Exception in updateUserPreferences:', error);
      return null;
    }
  },

  // Billing Management
  async getBillingHistory(userId: string): Promise<BillingHistory[]> {
    try {
      const { data, error } = await supabase
        .from('billing_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ [platformUtils] Error fetching billing history:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('💥 [platformUtils] Exception in getBillingHistory:', error);
      return [];
    }
  },

  // Session Management
  async createUserSession(userId: string, sessionToken: string, expiresAt: Date, ipAddress?: string, userAgent?: string): Promise<UserSession | null> {
    try {
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
        console.error('❌ [platformUtils] Error creating user session:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('💥 [platformUtils] Exception in createUserSession:', error);
      return null;
    }
  },

  async getUserSessions(userId: string): Promise<UserSession[]> {
    try {
      const { data, error } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ [platformUtils] Error fetching user sessions:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('💥 [platformUtils] Exception in getUserSessions:', error);
      return [];
    }
  },

  async revokeUserSession(sessionToken: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_sessions')
        .delete()
        .eq('session_token', sessionToken);

      if (error) {
        console.error('❌ [platformUtils] Error revoking user session:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('💥 [platformUtils] Exception in revokeUserSession:', error);
      return false;
    }
  },

  // Promo Code Management
  async validatePromoCode(promoCode: string): Promise<any> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Authentication required');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-promo-code`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
        },
        body: JSON.stringify({ promoCode: promoCode.trim() }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ [platformUtils] Error validating promo code:', error);
      throw error;
    }
  },

  async getUserPromoHistory(userId: string): Promise<PromoCodeUsage[]> {
    try {
      const { data, error } = await supabase
        .from('promo_code_usage')
        .select('*')
        .eq('user_id', userId)
        .order('applied_at', { ascending: false });

      if (error) {
        console.error('❌ [platformUtils] Error fetching promo code history:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('💥 [platformUtils] Exception in getUserPromoHistory:', error);
      return [];
    }
  },

  async createCheckoutSession(priceId: string, userId: string, planType: string, promoCode?: string, promotionCodeId?: string): Promise<any> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Authentication required');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`;
      
      const requestBody: any = {
        priceId,
        userId,
        planType,
      };

      if (promoCode && promotionCodeId) {
        requestBody.promoCode = promoCode;
        requestBody.promotionCodeId = promotionCodeId;
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ [platformUtils] Error creating checkout session:', error);
      throw error;
    }
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