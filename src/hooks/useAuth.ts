import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, UserProfile, UserSubscription, subscriptionUtils } from '../lib/supabase';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await fetchUserData(session.user.id);
      }
      
      setLoading(false);
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        
        if (session?.user) {
          await fetchUserData(session.user.id);
        } else {
          setProfile(null);
          setSubscription(null);
        }
        
        setLoading(false);
      }
    );

    return () => {
      authSubscription.unsubscribe();
    };
  }, []);

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        setProfile(null);
      } else {
        setProfile(profileData);
      }

      // Fetch user subscription using the comprehensive view
      const subscriptionDetails = await subscriptionUtils.getUserSubscriptionDetails(userId);
      
      if (subscriptionDetails && subscriptionDetails.subscription_id) {
        // Convert the view data to subscription format
        const subscriptionData: UserSubscription = {
          id: subscriptionDetails.subscription_id,
          user_id: subscriptionDetails.id,
          stripe_customer_id: subscriptionDetails.stripe_customer_id,
          stripe_subscription_id: subscriptionDetails.stripe_subscription_id,
          stripe_price_id: null, // Not included in view, would need separate query if needed
          status: subscriptionDetails.subscription_status as any,
          plan_type: subscriptionDetails.plan_type as any,
          current_period_start: subscriptionDetails.current_period_start,
          current_period_end: subscriptionDetails.current_period_end,
          cancel_at_period_end: subscriptionDetails.cancel_at_period_end || false,
          canceled_at: null, // Not included in view
          trial_start: null, // Not included in view
          trial_end: subscriptionDetails.trial_end,
          created_at: '', // Not included in view
          updated_at: '', // Not included in view
        };
        setSubscription(subscriptionData);
      } else {
        setSubscription(null);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      setProfile(null);
      setSubscription(null);
    }
  };

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) throw error;
    return data;
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const updatePassword = async (newPassword: string) => {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        console.error('Supabase password update error:', error);
        throw error;
      }

      console.log('Password updated successfully:', data);
      return data;
    } catch (error) {
      console.error('Password update failed:', error);
      throw error;
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) throw new Error('No user logged in');

    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;
    
    setProfile(data);
    return data;
  };

  const hasActiveSubscription = () => {
    return subscription?.status === 'active' || subscription?.status === 'trialing';
  };

  const isSubscriptionPastDue = () => {
    return subscription?.status === 'past_due';
  };

  const isSubscriptionCanceled = () => {
    return subscription?.status === 'canceled';
  };

  const getSubscriptionEndDate = () => {
    return subscription?.current_period_end ? new Date(subscription.current_period_end) : null;
  };

  return {
    user,
    profile,
    subscription,
    loading,
    signUp,
    signIn,
    signOut,
    updatePassword,
    updateProfile,
    hasActiveSubscription,
    isSubscriptionPastDue,
    isSubscriptionCanceled,
    getSubscriptionEndDate,
    refetchUserData: () => user ? fetchUserData(user.id) : Promise.resolve(),
  };
};