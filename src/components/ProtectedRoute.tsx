import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import LoadingSpinner from './LoadingSpinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireSubscription?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireSubscription = false 
}) => {
  const { user, profile, subscription, loading, hasActiveSubscription, refetchUserData } = useAuth();
  const location = useLocation();
  const [processingCheckout, setProcessingCheckout] = useState(false);

  // Handle Stripe checkout completion
  useEffect(() => {
    const handleCheckoutCompletion = async () => {
      const urlParams = new URLSearchParams(location.search);
      const sessionId = urlParams.get('session_id');
      
      if (sessionId && user && !processingCheckout) {
        console.log('🛡️ [ProtectedRoute] Processing checkout completion...');
        setProcessingCheckout(true);
        
        // Clean up URL immediately
        const url = new URL(window.location.href);
        url.searchParams.delete('session_id');
        window.history.replaceState({}, document.title, url.toString());
        
        try {
          // Create subscription directly in database
          const { data, error } = await supabase.rpc('handle_checkout_completion', {
            user_uuid: user.id,
            session_id_param: sessionId
          });
          
          if (data?.success) {
            console.log('✅ [ProtectedRoute] Subscription created successfully');
          } else {
            console.log('⚠️ [ProtectedRoute] Subscription creation failed:', data);
          }
          
          // Refresh user data
          await refetchUserData();
          
        } catch (error) {
          console.error('❌ [ProtectedRoute] Checkout processing error:', error);
        } finally {
          setProcessingCheckout(false);
        }
      }
    };

    handleCheckoutCompletion();
  }, [user, location.search, processingCheckout, refetchUserData]);

  // Show loading spinner
  if (loading || processingCheckout) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-lg font-medium text-gray-900">
            {processingCheckout ? 'Processing your subscription...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  // Redirect to login if no user
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Handle subscription requirement
  if (requireSubscription && !hasActiveSubscription()) {
    if (subscription?.status === 'past_due' || subscription?.status === 'canceled') {
      return <Navigate to="/payment-required" replace />;
    } else {
      return <Navigate to="/subscribe" state={{ from: location }} replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;