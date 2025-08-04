import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Loader } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireSubscription?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireSubscription = false 
}) => {
  const { user, profile, loading, hasActiveSubscription } = useAuth();
  const location = useLocation();

  // Check if user is coming back from Stripe payment
  const urlParams = new URLSearchParams(location.search);
  const hasStripeSession = urlParams.has('session_id');

  console.log('🛡️ [ProtectedRoute] Route protection check:', {
    hasUser: !!user,
    hasProfile: !!profile,
    loading,
    requireSubscription,
    hasActiveSubscription: hasActiveSubscription(),
    hasStripeSession,
    pathname: location.pathname
  });

  if (loading) {
    console.log('⏳ [ProtectedRoute] Loading user data...');
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

  // If user exists but no profile, show loading (profile might still be creating)
  if (user && !profile && !loading) {
    console.log('⏳ [ProtectedRoute] User exists but no profile, waiting...');
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Setting up your account...</p>
        </div>
      </div>
    );
  }

  // IMPORTANT: If user is coming from Stripe payment, temporarily allow access
  // to dashboard even without active subscription so session validation can run
  if (requireSubscription && hasStripeSession && location.pathname === '/dashboard') {
    console.log('💳 [ProtectedRoute] Stripe session detected, allowing temporary dashboard access for validation');
    return <>{children}</>;
  }

  // Normal subscription check for other routes or when no Stripe session
  if (requireSubscription && !hasActiveSubscription()) {
    console.log('🚫 [ProtectedRoute] Subscription required but not found, redirecting to payment-required');
    return <Navigate to="/payment-required" state={{ from: location }} replace />;
  }

  console.log('✅ [ProtectedRoute] All checks passed, rendering children');
  return <>{children}</>;
};

export default ProtectedRoute;