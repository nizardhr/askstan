// src/components/ProtectedRoute.tsx - Updated with better session ID handling and improved loading states

import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from './LoadingSpinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireSubscription?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireSubscription = false 
}) => {
  const { 
    user, 
    profile, 
    subscription, 
    loading, 
    processingCheckout, 
    hasActiveSubscription,
    processStripeCheckout 
  } = useAuth();
  const location = useLocation();
  const [initialLoad, setInitialLoad] = useState(true);
  const [checkoutProcessed, setCheckoutProcessed] = useState(false);

  // Handle Stripe checkout session completion
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const sessionId = urlParams.get('session_id');
    
    if (sessionId && user && !checkoutProcessed && !processingCheckout) {
      console.log('🛡️ [ProtectedRoute] Found session_id, processing checkout completion...');
      setCheckoutProcessed(true);
      
      // Process the checkout session
      processStripeCheckout(sessionId).then(() => {
        console.log('🛡️ [ProtectedRoute] Checkout processing completed');
      }).catch((error) => {
        console.error('🛡️ [ProtectedRoute] Checkout processing failed:', error);
      });
    }
  }, [user, location.search, checkoutProcessed, processingCheckout, processStripeCheckout]);

  // Clear initial loading state after a reasonable time
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        setInitialLoad(false);
      }, 10000); // 10 second maximum wait

      return () => clearTimeout(timer);
    } else {
      setInitialLoad(false);
    }
  }, [loading]);

  // Debug logging
  useEffect(() => {
    const debugInfo = {
      hasUser: !!user,
      hasProfile: !!profile,
      loading,
      processingCheckout,
      requireSubscription,
      hasActiveSubscription: hasActiveSubscription(),
      subscriptionStatus: subscription?.status || 'none',
      initialLoad
    };
    
    // Only log when there are significant changes
    if (loading || processingCheckout || !user || !profile) {
      console.log('🛡️ [ProtectedRoute] Route protection check:', debugInfo);
    }
    
    if (loading || processingCheckout) {
      console.log('⏳ [ProtectedRoute] Loading user data...');
    }
  }, [user, profile, subscription, loading, processingCheckout, requireSubscription, hasActiveSubscription, initialLoad]);

  // Show loading spinner while processing checkout or initial load
  if (processingCheckout) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-lg font-medium text-gray-900">Processing your subscription...</p>
          <p className="text-sm text-gray-600">Please wait while we complete your purchase.</p>
        </div>
      </div>
    );
  }

  // Show loading spinner during initial load
  if (loading && initialLoad) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-lg font-medium text-gray-900">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if no user
  if (!user) {
    console.log('🛡️ [ProtectedRoute] No authenticated user, redirecting to login');
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // If profile is required but missing, show a profile creation prompt
  if (!profile && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Setting up your account...</h2>
            <LoadingSpinner size="md" />
            <p className="mt-4 text-sm text-gray-600">
              We're creating your profile. This should only take a moment.
            </p>
            <p className="mt-2 text-xs text-gray-500">
              If this takes longer than expected, please refresh the page.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Handle subscription requirement
  if (requireSubscription) {
    const userHasActiveSubscription = hasActiveSubscription();
    
    if (!userHasActiveSubscription && !loading) {
      // Check if user has completed onboarding or has valid subscription
      const hasCompletedOnboarding = profile?.onboarding_completed === true;
      const isInTrial = subscription?.status === 'trialing';
      const isPastDue = subscription?.status === 'past_due';
      
      if (!isInTrial && !isPastDue) {
        console.log('🛡️ [ProtectedRoute] No active subscription, redirecting to pricing');
        return <Navigate to="/subscribe" state={{ from: location }} replace />;
      }
    }
  }

  // Show success message if just completed checkout
  const urlParams = new URLSearchParams(location.search);
  const sessionId = urlParams.get('session_id');
  
  if (sessionId && hasActiveSubscription() && checkoutProcessed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Welcome to AskStan Pro!</h2>
            <p className="text-sm text-gray-600 mb-4">
              Your subscription has been activated successfully.
            </p>
            <button 
              onClick={() => {
                // Clean up URL and continue to dashboard
                const url = new URL(window.location.href);
                url.searchParams.delete('session_id');
                window.history.replaceState({}, document.title, url.toString());
                window.location.reload();
              }}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Continue to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // All checks passed, render the protected content
  if (!loading && !processingCheckout) {
    console.log('✅ [ProtectedRoute] All checks passed, rendering protected content');
  }
  return <>{children}</>;
};

export default ProtectedRoute;