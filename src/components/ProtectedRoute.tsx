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
  const [checkoutProcessed, setCheckoutProcessed] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  // Handle Stripe checkout session completion
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const sessionId = urlParams.get('session_id');
    
    if (sessionId && user && !checkoutProcessed) {
      console.log('🛡️ [ProtectedRoute] Found session_id, processing checkout completion...');
      setCheckoutProcessed(true);
      
      // Clean up URL immediately to prevent reprocessing
      const url = new URL(window.location.href);
      url.searchParams.delete('session_id');
      window.history.replaceState({}, document.title, url.toString());
      
      // Process the checkout session
      processStripeCheckout(sessionId).then((success) => {
        console.log('🛡️ [ProtectedRoute] Checkout processing completed:', success);
      }).catch((error) => {
        console.error('🛡️ [ProtectedRoute] Checkout processing failed:', error);
      });
    }
  }, [user, location.search, checkoutProcessed, processStripeCheckout]);

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
  if (loading) {
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
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Handle subscription requirement
  if (requireSubscription) {
    const userHasActiveSubscription = hasActiveSubscription();
    
    if (!userHasActiveSubscription) {
      if (subscription?.status === 'past_due' || subscription?.status === 'canceled') {
        return <Navigate to="/payment-required" replace />;
      } else {
        return <Navigate to="/subscribe" state={{ from: location }} replace />;
      }
    }
  }

  // Show success message if checkout was successful
  if (showSuccessMessage) {
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
                setShowSuccessMessage(false);
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

  return <>{children}</>;
};

export default ProtectedRoute;