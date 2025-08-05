import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Loader, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

const CheckoutSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  
  const [processing, setProcessing] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  const sessionId = searchParams.get('session_id');
  const freeSubscription = searchParams.get('free_subscription') === 'true';

  const processCheckoutSession = async (sessionId: string, userId: string) => {
    try {
      console.log('Processing checkout session:', sessionId, 'for user:', userId);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Authentication required');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-checkout-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            sessionId,
            userId
          }),
        }
      );

      const result = await response.json();
      console.log('Process checkout session result:', result);

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      if (result.success) {
        setSuccess(true);
        setProcessing(false);
        
        // Wait a moment for the UI to show success, then redirect
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 2000);
      } else {
        throw new Error(result.error || 'Failed to process checkout session');
      }

    } catch (err: any) {
      console.error('Error processing checkout session:', err);
      
      // Retry logic for transient errors
      if (retryCount < 3 && (
        err.message.includes('Failed to fetch') ||
        err.message.includes('timeout') ||
        err.message.includes('500')
      )) {
        console.log(`Retrying... attempt ${retryCount + 1}`);
        setRetryCount(prev => prev + 1);
        
        // Exponential backoff
        setTimeout(() => {
          processCheckoutSession(sessionId, userId);
        }, Math.pow(2, retryCount) * 1000);
      } else {
        setError(err.message || 'Failed to process payment');
        setProcessing(false);
      }
    }
  };

  useEffect(() => {
    if (freeSubscription) {
      // For free subscriptions (100% promo codes), redirect directly
      console.log('Free subscription detected, redirecting to dashboard');
      navigate('/dashboard?welcome=true', { replace: true });
      return;
    }

    if (!sessionId) {
      console.error('No session ID found in URL');
      setError('Invalid checkout session');
      setProcessing(false);
      return;
    }

    // ProtectedRoute ensures user and profile are available, so we can proceed directly
    processCheckoutSession(sessionId, user.id);
  }, [sessionId, user, freeSubscription]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4 text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Payment Processing Error
          </h2>
          <p className="text-gray-600 mb-4">
            {error}
          </p>
          <div className="space-y-2">
            <button
              onClick={() => {
                setError('');
                setProcessing(true);
                setRetryCount(0);
                if (sessionId && user) {
                  processCheckoutSession(sessionId, user.id);
                }
              }}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate('/subscribe', { replace: true })}
              className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Back to Plans
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4 text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Payment Successful!
          </h2>
          <p className="text-gray-600 mb-4">
            Your subscription has been activated. Redirecting to your dashboard...
          </p>
          <div className="animate-pulse bg-blue-100 text-blue-800 px-4 py-2 rounded-lg">
            Redirecting...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Processing Your Payment
        </h2>
        <p className="text-gray-600 mb-4">
          Please wait while we confirm your subscription and set up your account.
        </p>
        {retryCount > 0 && (
          <p className="text-sm text-yellow-600">
            Retry attempt {retryCount}/3...
          </p>
        )}
      </div>
    </div>
  );
};

export default CheckoutSuccess;