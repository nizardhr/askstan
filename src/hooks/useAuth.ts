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
      console.log('🔑 [useAuth] Getting initial session...');
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ [useAuth] Error getting session:', error);
          setUser(null);
          setProfile(null);
          setSubscription(null);
          setLoading(false);
          return;
        }

        console.log('👤 [useAuth] Initial session:', session ? 'found' : 'not found');
        setUser(session?.user ?? null);
        
        if (session?.user) {
          console.log('📋 [useAuth] Fetching user data for:', session.user.id);
          await fetchUserData(session.user.id);
        }
        
        console.log('✅ [useAuth] Initial session processing complete');
        setLoading(false);
      } catch (error) {
        console.error('💥 [useAuth] Unexpected error in getInitialSession:', error);
        setUser(null);
        setProfile(null);
        setSubscription(null);
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 [useAuth] Auth state changed:', event, session ? 'session exists' : 'no session');
        
        try {
          setUser(session?.user ?? null);
          
          if (session?.user) {
            console.log('📋 [useAuth] Auth change - fetching user data for:', session.user.id);
            await fetchUserData(session.user.id);
            // Update user activity
            try {
              await platformUtils.updateUserActivity(session.user.id);
            } catch (activityError) {
              console.warn('⚠️ [useAuth] Failed to update user activity:', activityError);
              // Don't fail the whole flow for this
            }
          } else {
            console.log('🧹 [useAuth] No session, clearing profile and subscription');
            setProfile(null);
            setSubscription(null);
          }
          
          console.log('✅ [useAuth] Auth state change processing complete');
          setLoading(false);
        } catch (error) {
          console.error('💥 [useAuth] Error in auth state change handler:', error);
          setLoading(false);
        }
      }
    );

    return () => {
      authSubscription.unsubscribe();
    };
  }, []);

  const fetchUserData = async (userId: string) => {
    console.log('📊 [useAuth] Fetching user data for:', userId);
    try {
      // Fetch user profile using platform utils
      console.log('👤 [useAuth] Fetching user profile...');
      const profileData = await platformUtils.getUserProfile(userId);
      
      if (profileData) {
        console.log('✅ [useAuth] Profile found:', profileData.email);
        setProfile(profileData);
      } else {
        console.warn('⚠️ [useAuth] No profile could be created/found for user:', userId);
        // Set profile to null to indicate no profile exists
        setProfile(null);
      }

      // Fetch user subscription using platform utils
      console.log('💳 [useAuth] Fetching user subscription...');
      const subscriptionData = await platformUtils.getUserSubscription(userId);
      
      if (subscriptionData) {
        console.log('✅ [useAuth] Subscription found:', subscriptionData.status);
        setSubscription(subscriptionData);
      } else {
        console.log('ℹ️ [useAuth] No subscription found (expected for new users)');
        setSubscription(null);
      }
      
    } catch (error) {
      console.error('❌ [useAuth] Error fetching user data:', error);
      
      // Don't set profile to null if there's an error - this might be temporary
      // setProfile(null);
      setSubscription(null);
      
      // Don't throw the error - let the app continue
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
        try {
          await platformUtils.updateUserActivity(data.user.id);
        } catch (activityError) {
          console.warn('Failed to update user activity:', activityError);
          // Don't fail login for this
        }
        
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

  const refetchUserData = async () => {
    if (user) {
      console.log('🔄 [useAuth] Manually refetching user data...');
      await fetchUserData(user.id);
    } else {
      console.warn('⚠️ [useAuth] Cannot refetch data - no user');
    }
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
    refetchUserData,
  };
};