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
  name?: string;
  avatar_url?: string;
  subscription_status?: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  created_at: string;
  updated_at: string;
};

export type UserSubscription = {
  id: string;
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  stripe_price_id: string;
  status: 'active' | 'canceled' | 'incomplete' | 'incomplete_expired' | 'past_due' | 'trialing' | 'unpaid';
  plan_type: 'monthly' | 'yearly';
  current_period_start: string;
  current_period_end: string;
  trial_start?: string;
  trial_end?: string;
  canceled_at?: string;
  created_at: string;
  updated_at: string;
};

export type BillingHistory = {
  id: string;
  user_id: string;
  stripe_invoice_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  invoice_url?: string;
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

// Fixed platformUtils with timeout protection and auto profile creation
export const platformUtils = {
  // User Profile Management with timeout and auto-creation
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    console.log('🔍 [platformUtils] Getting profile for user:', userId);
    
    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Profile fetch timeout')), 10000); // 10 second timeout
      });

      const fetchPromise = supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

      if (error) {
        console.error('❌ [platformUtils] Error fetching user profile:', error);
        
        // If profile doesn't exist, try to create it
        if (error.code === 'PGRST116' || error.message?.includes('no rows returned')) {
          console.log('🔧 [platformUtils] Profile not found, attempting to create...');
          return await this.createUserProfile(userId);
        }
        
        return null;
      }

      if (!data) {
        console.log('ℹ️ [platformUtils] No profile found, attempting to create...');
        return await this.createUserProfile(userId);
      }

      console.log('✅ [platformUtils] Profile found:', data.email);
      return data;
    } catch (error: any) {
      console.error('💥 [platformUtils] Unexpected error fetching profile:', error);
      
      if (error.message === 'Profile fetch timeout') {
        console.error('⏰ [platformUtils] Profile fetch timed out');
        return null;
      }
      
      // Try to create profile if fetch failed
      console.log('🔧 [platformUtils] Fetch failed, attempting to create profile...');
      return await this.createUserProfile(userId);
    }
  },

  // Fixed profile creation - creates profile directly without relying on getUser()
  async createUserProfile(userId: string): Promise<UserProfile | null> {
    console.log('🔨 [platformUtils] Creating profile for user:', userId);
    
    try {
      // Instead of relying on getUser(), create profile with fallback email
      // and let the database trigger or later update fix the email
      const fallbackEmail = `user-${userId}@temp.local`;
      
      console.log('📧 [platformUtils] Creating profile with fallback email:', fallbackEmail);

      const { data, error } = await supabase
        .from('user_profiles')
        .insert({
          id: userId,
          email: fallbackEmail,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('❌ [platformUtils] Error creating profile:', error);
        
        // If it's a duplicate key error, try to fetch the existing profile
        if (error.code === '23505') {
          console.log('ℹ️ [platformUtils] Profile already exists, fetching it...');
          try {
            const { data: existingData, error: fetchError } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('id', userId)
              .single();
            
            if (!fetchError) {
              console.log('✅ [platformUtils] Retrieved existing profile:', existingData.email);
              return existingData;
            }
          } catch (fetchExistingError) {
            console.error('❌ [platformUtils] Error fetching existing profile:', fetchExistingError);
          }
        }
        
        return null;
      }

      console.log('✅ [platformUtils] Profile created successfully:', data.email);
      
      // Also create user preferences
      await this.createUserPreferences(userId);
      
      return data;
    } catch (error) {
      console.error('💥 [platformUtils] Error creating profile:', error);
      return null;
    }
  },

  // Create user preferences if they don't exist
  async createUserPreferences(userId: string): Promise<void> {
    console.log('🔧 [platformUtils] Creating preferences for user:', userId);
    
    try {
      const { error } = await supabase
        .from('user_preferences')
        .insert({
          user_id: userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (error && !error.message?.includes('duplicate key')) {
        console.error('❌ [platformUtils] Error creating preferences:', error);
      } else {
        console.log('✅ [platformUtils] Preferences created');
      }
    } catch (error) {
      console.error('💥 [platformUtils] Error creating preferences:', error);
    }
  },

  async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile | null> {
    console.log('🔄 [platformUtils] Updating profile for user:', userId);
    
    try {
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
        console.error('❌ [platformUtils] Error updating profile:', error);
        return null;
      }

      console.log('✅ [platformUtils] Profile updated');
      return data;
    } catch (error) {
      console.error('💥 [platformUtils] Error updating profile:', error);
      return null;
    }
  },

  // Subscription Management with timeout
  async getUserSubscription(userId: string): Promise<UserSubscription | null> {
    console.log('💳 [platformUtils] Getting subscription for user:', userId);
    
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Subscription fetch timeout')), 10000);
      });

      const fetchPromise = supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

      if (error) {
        console.error('❌ [platformUtils] Error fetching subscription:', error);
        return null;
      }

      if (data) {
        console.log('✅ [platformUtils] Subscription found:', data.status);
      } else {
        console.log('ℹ️ [platformUtils] No subscription found (normal for new users)');
      }

      return data;
    } catch (error: any) {
      if (error.message === 'Subscription fetch timeout') {
        console.error('⏰ [platformUtils] Subscription fetch timed out');
      } else {
        console.error('💥 [platformUtils] Error fetching subscription:', error);
      }
      return null;
    }
  },

  async hasActiveSubscription(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .rpc('user_has_active_subscription', { user_uuid: userId });

      if (error) {
        console.error('Error checking subscription status:', error);
        return false;
      }

      return data || false;
    } catch (error) {
      console.error('Error checking subscription status:', error);
      return false;
    }
  },

  async getSubscriptionStatus(userId: string): Promise<string> {
    try {
      const { data, error } = await supabase
        .rpc('get_user_subscription_status', { user_uuid: userId });

      if (error) {
        console.error('Error getting subscription status:', error);
        return 'inactive';
      }

      return data || 'inactive';
    } catch (error) {
      console.error('Error getting subscription status:', error);
      return 'inactive';
    }
  },

  // Activity Tracking with error handling
  async updateUserActivity(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .rpc('update_user_activity', { user_uuid: userId });

      if (error) {
        console.error('Error updating user activity:', error);
      }
    } catch (error) {
      console.error('Error updating user activity:', error);
    }
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
      console.error('Error validating promo code:', error);
      throw error;
    }
  },

  async getUserPromoHistory(userId: string): Promise<PromoCodeUsage[]> {
    const { data, error } = await supabase
      .from('promo_code_usage')
      .select('*')
      .eq('user_id', userId)
      .order('applied_at', { ascending: false });

    if (error) {
      console.error('Error fetching promo code history:', error);
      return [];
    }

    return data || [];
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
      console.error('Error creating checkout session:', error);
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
  getBillingHistory: platformUtils.getBillingHistory,
  getConversations: platformUtils.getConversations,
  getMessages: platformUtils.getMessages,
};