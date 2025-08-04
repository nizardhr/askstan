// ProtectedRoute that works without database dependencies
// Replace your ProtectedRoute.tsx with this

import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireSubscription?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireSubscription = false 
}) => {
  const location = useLocation();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Check if user is coming back from Stripe payment
  const urlParams = new URLSearchParams(location.search);
  const hasStripeSession = urlParams.has('session_id');

  useEffect(() => {
    const checkAuth = async () => {
      console.log('🛡️ [ProtectedRoute] Checking authentication...');
      
      try {
        const { data: { user: authUser }, error } = await supabase.auth.getUser();
        
        if (error) {
          console.error('❌ [ProtectedRoute] Auth error:', error);
          setUser(null);
        } else {
          console.log('✅ [ProtectedRoute] User found:', authUser?.id);
          setUser(authUser);
        }
      } catch (error) {
        console.error('💥 [ProtectedRoute] Auth check failed:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔄 [ProtectedRoute] Auth state changed:', event);
      setUser(session?.user || null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  console.log('🛡️ [ProtectedRoute] Current state:', {
    hasUser: !!user,
    loading,
    requireSubscription,
    hasStripeSession,
    pathname: location.pathname
  });

  if (loading) {
    console.log('⏳ [ProtectedRoute] Loading...');
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    console.log('❌ [ProtectedRoute] No user found, redirecting to auth');
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // For payment flows, bypass subscription check completely
  if (hasStripeSession && location.pathname === '/dashboard') {
    console.log('💳 [ProtectedRoute] Payment flow detected - allowing dashboard access');
    return <>{children}</>;
  }

  // For now, bypass subscription checks since we can't access database
  // TODO: Re-enable this once database connectivity is fixed
  if (requireSubscription) {
    console.log('⚠️ [ProtectedRoute] Subscription check bypassed due to database issues');
    // return <Navigate to="/payment-required" state={{ from: location }} replace />;
  }

  console.log('✅ [ProtectedRoute] Access granted');
  return <>{children}</>;
};

export default ProtectedRoute;