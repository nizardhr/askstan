import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, UserProfile, UserSubscription } from '../lib/supabase';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    try {
      console.log('📊 [useAuth] Fetching data for user:', userId);

      // Fetch profile - create if doesn't exist
      let { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('❌ [useAuth] Profile fetch error:', profileError);
        setProfile(null);
      } else if (!profileData) {
        console.log('➕ [useAuth] Creating missing profile...');
        // Create profile if it doesn't exist
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          const { data: newProfile, error: createError } = await supabase
            .from('user_profiles')
            .insert({
              id: userId,
              email: authUser.email || `user-${userId}@temp.local`,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (createError) {
            console.error('❌ [useAuth] Profile creation error:', createError);
            setProfile(null);
          } else {
            console.log('✅ [useAuth] Profile created:', newProfile.email);
            setProfile(newProfile);
          }
        }
      } else {
        console.log('✅ [useAuth] Profile loaded:', profileData.email);
        setProfile(profileData);
      }

      // Fetch subscription
      const { data: subscriptionData, error: subscriptionError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (subscriptionError) {
        console.error('❌ [useAuth] Subscription fetch error:', subscriptionError);
        setSubscription(null);
      } else if (subscriptionData) {
        console.log('✅ [useAuth] Subscription loaded:', subscriptionData.status);
        setSubscription(subscriptionData);
      } else {
        console.log('ℹ️ [useAuth] No subscription found');
        setSubscription(null);
      }

    } catch (error) {
      console.error('❌ [useAuth] Error fetching user data:', error);
      setProfile(null);
      setSubscription(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!mounted) return;
      
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await fetchUserData(session.user.id);
      }
      
      setLoading(false);
    };

    getInitialSession();

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
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
      mounted = false;
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