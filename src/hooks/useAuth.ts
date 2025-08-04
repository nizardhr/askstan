import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, UserProfile, UserSubscription } from '../lib/supabase';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  // Simple data fetching without timeouts or complex logic
  const fetchUserData = async (userId: string) => {
    try {
      console.log('📊 [useAuth] Fetching data for user:', userId);

      // Fetch profile
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData);
        console.log('✅ [useAuth] Profile loaded:', profileData.email);
      } else {
        console.log('ℹ️ [useAuth] No profile found');
        setProfile(null);
      }

      // Fetch subscription
      const { data: subscriptionData } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (subscriptionData) {
        setSubscription(subscriptionData);
        console.log('✅ [useAuth] Subscription loaded:', subscriptionData.status);
      } else {
        console.log('ℹ️ [useAuth] No subscription found');
        setSubscription(null);
      }

    } catch (error) {
      console.error('❌ [useAuth] Error fetching user data:', error);
    }
  };

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
        console.log('🔄 [useAuth] Auth state changed:', event);
        
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

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
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
    setUser(null);
    setProfile(null);
    setSubscription(null);
    
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
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) throw error;
    return data;
  };

  const hasActiveSubscription = () => {
    return subscription?.status === 'active' || subscription?.status === 'trialing';
  };

  const refetchUserData = () => {
    if (user) {
      return fetchUserData(user.id);
    }
    return Promise.resolve();
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
    hasActiveSubscription,
    refetchUserData,
  };
};