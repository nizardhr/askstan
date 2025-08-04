// src/hooks/useAuth.ts - Updated with session ID processing and improved error handling

import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, UserProfile, UserSubscription, platformUtils } from '../lib/supabase';

// Prevent infinite loops with better state management
let isFetchingUserData = false;
let lastFetchedUserId: string | null = null;
let lastAuthEvent: string | null = null;

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingCheckout, setProcessingCheckout] = useState(false);
  const [checkoutProcessed, setCheckoutProcessed] = useState(false);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      console.log('🔑 [useAuth] Getting initial session...');
      
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      
      if (session?.user) {
        console.log('🔄 [useAuth] Initial session found for user:', session.user.id);
        await fetchUserData(session.user.id, 'initial');
      }
      
      setLoading(false);
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 [useAuth] Auth state changed:', event);
        
        // Prevent duplicate processing of the same event
        if (event === lastAuthEvent && event !== 'SIGNED_IN') {
          console.log('ℹ️ [useAuth] Ignoring', event, 'event to prevent infinite loops');
          return;
        }
        
        lastAuthEvent = event;
        
        setUser(session?.user ?? null);
        
        if (session?.user) {
          console.log('📋 [useAuth] Auth change - fetching user data for:', session.user.id);
          await fetchUserData(session.user.id, event);
        } else {
          setProfile(null);
          setSubscription(null);
          isFetchingUserData = false;
          lastFetchedUserId = null;
        }
        
        setLoading(false);
      }
    );

    return () => {
      authSubscription.unsubscribe();
    };
  }, []);

  const processStripeCheckout = async (sessionId: string): Promise<boolean> => {
    if (processingCheckout || checkoutProcessed) {
      console.log('⏭️ [useAuth] Checkout already processing or completed');
      return false;
    }
    
    try {
      setProcessingCheckout(true);
      setCheckoutProcessed(true);
      console.log('🔄 [useAuth] Processing Stripe checkout session:', sessionId);
      
      // Simulate successful checkout processing for now
      // In a real implementation, you would validate with Stripe here
      console.log('✅ [useAuth] Checkout session processed (simulated)');
      
      // Force refresh user data after a short delay
      setTimeout(async () => {
        if (user) {
          isFetchingUserData = false; // Reset flag to allow fresh fetch
          await fetchUserData(user.id, 'checkout_success');
        }
      }, 1000);
      
      return true;
    } catch (error) {
      console.error('💥 [useAuth] Error processing checkout:', error);
      return false;
    } finally {
      setProcessingCheckout(false);
    }
  };

  const fetchUserData = async (userId: string, source: string = 'unknown') => {
    // Prevent infinite loops - but allow checkout_success to override
    if (isFetchingUserData && lastFetchedUserId === userId && source !== 'checkout_success') {
      console.log('⏭️ [useAuth] Skipping fetch - already in progress for user:', userId);
      return;
    }
    
    try {
      isFetchingUserData = true;
      lastFetchedUserId = userId;
      console.log('📊 [useAuth] Fetching user data for:', userId, 'source:', source);
      
      // Fetch user profile with better error handling
      console.log('👤 [useAuth] Fetching user profile...');
      
      try {
        const profileData = await platformUtils.getUserProfile(userId);
        if (profileData) {
          setProfile(profileData);
          console.log('✅ [useAuth] Profile loaded successfully');
        } else {
          console.warn('⚠️ [useAuth] No profile found');
          setProfile(null);
        }
      } catch (profileError) {
        console.error('❌ [useAuth] Profile fetch/create failed:', profileError);
        setProfile(null);
      }

      // Fetch user subscription with better error handling
      console.log('💳 [useAuth] Fetching user subscription...');
      
      try {
        const subscriptionData = await platformUtils.getUserSubscription(userId);
        setSubscription(subscriptionData);
        
        if (subscriptionData) {
          console.log('✅ [useAuth] Subscription loaded:', subscriptionData.status);
        } else {
          console.log('ℹ️ [useAuth] No subscription found (expected for new users)');
        }
      } catch (subscriptionError) {
        console.error('❌ [useAuth] Subscription fetch failed:', subscriptionError);
        setSubscription(null);
      }
    } catch (error) {
      console.error('💥 [useAuth] Error fetching user data:', error);
    } finally {
      isFetchingUserData = false;
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      console.log('📝 [useAuth] Attempting signup for:', email);
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        console.error('❌ [useAuth] Signup error:', error);
        
        // Handle specific Supabase errors
        if (error.message?.includes('rate limit exceeded')) {
          throw new Error('Too many signup attempts. Please wait a few minutes before trying again.');
        } else if (error.message?.includes('User already registered')) {
          throw new Error('An account with this email already exists. Try signing in instead.');
        }
        
        throw error;
      }
      
      console.log('✅ [useAuth] Signup successful, user created');
      
      return data;
    } catch (error) {
      console.error('💥 [useAuth] Signup failed:', error);
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log('🔐 [useAuth] Attempting signin for:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('❌ [useAuth] SignIn error:', error);
        throw error;
      }
      
      console.log('✅ [useAuth] SignIn successful');
      
      return data;
    } catch (error) {
      console.error('💥 [useAuth] SignIn failed:', error);
      throw error;
    }
  };

  const signOut = async () => {
    console.log('👋 [useAuth] Signing out...');
    // Clear state immediately
    setUser(null);
    setProfile(null);
    setSubscription(null);
    isFetchingUserData = false;
    lastFetchedUserId = null;
    lastAuthEvent = null;
    
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    console.log('✅ [useAuth] Signed out successfully');
  };

  const resetPassword = async (email: string) => {
    console.log('🔄 [useAuth] Requesting password reset for:', email);
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) throw error;
    console.log('✅ [useAuth] Password reset email sent');
    return data;
  };

  const updatePassword = async (newPassword: string) => {
    try {
      console.log('🔄 [useAuth] Updating user password...');
      
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        console.error('❌ [useAuth] Supabase password update error:', error);
        throw error;
      }

      console.log('✅ [useAuth] Password updated successfully:', data);
      return data;
    } catch (error) {
      console.error('💥 [useAuth] Password update failed:', error);
      throw error;
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) throw new Error('No user logged in');

    console.log('📝 [useAuth] Updating user profile...');
    const updatedProfile = await platformUtils.updateUserProfile(user.id, updates);
    if (updatedProfile) {
      setProfile(updatedProfile);
      console.log('✅ [useAuth] Profile updated successfully');
    }
    
    return updatedProfile;
  };

  const hasActiveSubscription = () => {
    const active = subscription?.status === 'active' || subscription?.status === 'trialing';
    return active;
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
    loading: loading || processingCheckout,
    processingCheckout,
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
    refetchUserData: () => user ? fetchUserData(user.id, 'manual_refetch') : Promise.resolve(),
    processStripeCheckout, // Expose for manual processing if needed
  };
};