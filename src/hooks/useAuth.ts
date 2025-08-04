import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, UserProfile, UserSubscription, platformUtils } from '../lib/supabase';

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
          // Update user activity
          await platformUtils.updateUserActivity(session.user.id);
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
      // Fetch user profile using platform utils
      const profileData = await platformUtils.getUserProfile(userId);
      if (profileData) {
        setProfile(profileData);
      } else {
        console.warn('No profile found for user:', userId);
        // Don't set profile to null, keep existing state
      }

      // Fetch user subscription using platform utils
      const subscriptionData = await platformUtils.getUserSubscription(userId);
      setSubscription(subscriptionData); // Will be null for new users without subscription, which is expected
    } catch (error) {
      console.error('Error fetching user data:', error);
      // Don't reset profile to null on subscription fetch error
      // New users won't have subscriptions, so this is expected
      setSubscription(null);
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        console.error('Signup error:', error);
        
        // Handle specific Supabase errors
        if (error.message?.includes('rate limit exceeded')) {
          throw new Error('Too many signup attempts. Please wait a few minutes before trying again.');
        } else if (error.message?.includes('User already registered')) {
          throw new Error('An account with this email already exists. Try signing in instead.');
        }
        
        throw error;
      }
      
      // Wait a moment for the database trigger to complete
      if (data.user) {
        setTimeout(() => {
          fetchUserData(data.user!.id);
        }, 1000);
      }
      
      return data;
    } catch (error) {
      console.error('Signup failed:', error);
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('SignIn error:', error);
        throw error;
      }
      
      // Update user activity on successful login
      if (data.user) {
        await platformUtils.updateUserActivity(data.user.id);
        // Ensure user data is fetched
        await fetchUserData(data.user.id);
      }
      
      return data;
    } catch (error) {
      console.error('SignIn failed:', error);
      throw error;
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const resetPassword = async (email: string) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) throw error;
    return data;
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

    const updatedProfile = await platformUtils.updateUserProfile(user.id, updates);
    if (updatedProfile) {
      setProfile(updatedProfile);
    }
    
    return updatedProfile;
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

  const isTrialing = () => {
    return subscription?.status === 'trialing';
  };

  const getTrialEndDate = () => {
    return subscription?.trial_end ? new Date(subscription.trial_end) : null;
  };

  const getPlanDisplayName = () => {
    if (!subscription?.plan_type) return 'No Plan';
    return subscription.plan_type === 'monthly' ? 'Monthly Pro' : 'Yearly Pro';
  };

  const getNextBillingAmount = () => {
    if (!subscription?.plan_type) return 0;
    return subscription.plan_type === 'monthly' ? 4.99 : 49.99;
  };

  return {
    user,
    profile,
    subscription,
    loading,
    signUp,
    signIn,
    signOut,
    resetPassword,
    resetPassword,
    updatePassword,
    updateProfile,
    hasActiveSubscription,
    isSubscriptionPastDue,
    isSubscriptionCanceled,
    isTrialing,
    getSubscriptionEndDate,
    getTrialEndDate,
    getPlanDisplayName,
    getNextBillingAmount,
    refetchUserData: () => user ? fetchUserData(user.id) : Promise.resolve(),
  };
};