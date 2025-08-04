// src/hooks/useAuth.ts - Updated with session ID processing and improved error handling

import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, UserProfile, UserSubscription, platformUtils } from '../lib/supabase';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingCheckout, setProcessingCheckout] = useState(false);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      console.log('🔑 [useAuth] Getting initial session...');
      
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      
      if (session?.user) {
        console.log('🔄 [useAuth] Auth state changed: SIGNED_IN session exists');
        await fetchUserData(session.user.id);
        
        // Check for session_id parameter from Stripe checkout
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('session_id');
        
        if (sessionId) {
          console.log('💳 [useAuth] Found Stripe session ID, processing checkout...');
          await processStripeCheckout(sessionId);
        }
      }
      
      setLoading(false);
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 [useAuth] Auth state changed:', event, session ? 'session exists' : 'no session');
        setUser(session?.user ?? null);
        
        if (session?.user) {
          console.log('📋 [useAuth] Auth change - fetching user data for:', session.user.id);
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

  const processStripeCheckout = async (sessionId: string) => {
    if (processingCheckout) return; // Prevent duplicate processing
    
    try {
      setProcessingCheckout(true);
      console.log('🔄 [useAuth] Processing Stripe checkout session:', sessionId);
      
      const success = await platformUtils.processStripeCheckoutSession(sessionId);
      
      if (success) {
        console.log('✅ [useAuth] Checkout processed successfully, refreshing user data...');
        // Refresh user data to get updated subscription
        if (user) {
          await fetchUserData(user.id);
        }
        
        // Clean up URL to remove session_id parameter
        const url = new URL(window.location.href);
        url.searchParams.delete('session_id');
        window.history.replaceState({}, document.title, url.toString());
      } else {
        console.error('❌ [useAuth] Checkout processing failed');
      }
    } catch (error) {
      console.error('💥 [useAuth] Error processing checkout:', error);
    } finally {
      setProcessingCheckout(false);
    }
  };

  const fetchUserData = async (userId: string) => {
    try {
      console.log('📊 [useAuth] Fetching user data for:', userId);
      
      // Fetch user profile with better error handling
      console.log('👤 [useAuth] Fetching user profile...');
      
      try {
        const profileData = await platformUtils.getUserProfile(userId);
        if (profileData) {
          setProfile(profileData);
          console.log('✅ [useAuth] Profile loaded successfully');
        } else {
          console.warn('⚠️ [useAuth] No profile found, creating one...');
          const newProfile = await platformUtils.createUserProfile(userId);
          if (newProfile) {
            setProfile(newProfile);
            console.log('✅ [useAuth] Profile created successfully');
          }
        }
      } catch (profileError) {
        console.error('❌ [useAuth] Profile fetch/create failed:', profileError);
        // Set a minimal profile to prevent infinite loops
        setProfile({
          id: userId,
          email: user?.email || 'user@example.com',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
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
      // Don't reset profile/subscription on error to prevent infinite loops
      setSubscription(null);
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
      
      // Wait a moment for the database trigger to complete, then fetch user data
      if (data.user) {
        setTimeout(() => {
          fetchUserData(data.user!.id);
        }, 2000); // Increased timeout to allow database operations to complete
      }
      
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
      
      // Update user activity on successful login
      if (data.user) {
        await platformUtils.updateUserActivity(data.user.id);
        // Ensure user data is fetched
        await fetchUserData(data.user.id);
      }
      
      return data;
    } catch (error) {
      console.error('💥 [useAuth] SignIn failed:', error);
      throw error;
    }
  };

  const signOut = async () => {
    console.log('👋 [useAuth] Signing out...');
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
    console.log('🔍 [useAuth] Checking active subscription:', { status: subscription?.status, active });
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
    refetchUserData: () => user ? fetchUserData(user.id) : Promise.resolve(),
    processStripeCheckout, // Expose for manual processing if needed
  };
};