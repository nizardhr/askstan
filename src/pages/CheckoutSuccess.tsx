import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Loader, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

const processCheckoutSession = async (sessionId: string, userId: string) => {
  try {
    console.log('🔄 [CheckoutSuccess] Processing checkout session:', sessionId, 'for user:', userId);
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Authentication required');
    }

    console.log('🔑 [CheckoutSuccess] Auth session found, calling process-checkout-session...');

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-checkout-session`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'x-requested-with': 'XMLHttpRequest',
        },
        body: JSON.stringify({
          sessionId,
          userId
        }),
      }
    );

    console.log('📡 [CheckoutSuccess] Edge function response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [CheckoutSuccess] Edge function error:', errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ [CheckoutSuccess] Process checkout session result:', result);

    return result;
  } catch (err: any) {
    console.error('💥 [CheckoutSuccess] Error processing checkout session:', err);
    throw err;
  }
};

const CheckoutSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, refetchUserData } = useAuth();
  
  const [processing, setProcessing] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [processingStep, setProcessingStep] = useState('Initializing...');

  const sessionId = searchParams.get('session_id');
  const freeSubscription = searchParams.get('free_subscription') === 'true';

  const handleCheckoutProcessing = async (sessionId: string, userId: string) => {
    try {
      setProcessingStep('Verifying payment...');
      setProcessingStep('Activating subscription...');

      const result = await processCheckoutSession(sessionId, userId);

      if (result.success) {
        setProcessingStep('Subscription activated! Redirecting...');
        setSuccess(true);
        
        // Refetch user data to get updated subscription
        await refetchUserData();
        
        // Wait a moment for the UI to show success, then redirect
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 2000);
      } else {
        throw new Error(result.error || 'Failed to activate subscription');
      }

    } catch (err: any) {
      console.error('💥 Error processing checkout session:', err);
      
      // Retry logic for transient errors
      if (retryCount < 3 && (
        err.message.includes('Failed to fetch') ||
        err.message.includes('timeout') ||
        err.message.includes('500') ||
        err.message.includes('502') ||
        err.message.includes('503')
      )) {
        console.log(`🔄 Retrying... attempt ${retryCount + 1}`);
        setRetryCount(prev => prev + 1);
        setProcessingStep(`Retrying... (${retryCount + 1}/3)`);
        
        // Exponential backoff
        setTimeout(() => {
          handleCheckoutProcessing(sessionId, userId);
        }, Math.pow(2, retryCount) * 1000);
      } else {
        setError(err.message || 'Failed to process payment');
        setProcessing(false);
      }
    }
  };

  useEffect(() => {
    console.log('🚀 CheckoutSuccess page loaded with params:', { sessionId, freeSubscription, userId: user?.id });

    if (freeSubscription) {
      // For free subscriptions (100% promo codes), redirect directly
      console.log('💰 Free subscription detected, redirecting to dashboard');
      setProcessingStep('Free subscription activated!');
      setSuccess(true);
      setTimeout(() => {
        navigate('/dashboard?welcome=true', { replace: true });
      }, 1500);
      return;
    }

    if (!sessionId) {
      console.error('❌ No session ID found in URL');
      setError('Invalid checkout session - no session ID found');
      setProcessing(false);
      return;
    }

    if (!user?.id) {
      console.error('❌ No user found');
      setError('User not authenticated');
      setProcessing(false);
      return;
    }

    // Process the checkout session
    console.log('🎯 Starting checkout session processing...');
    handleCheckoutProcessing(sessionId, user.id);
  }, [sessionId, user?.id, freeSubscription]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-amber-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Payment Processing Error
          </h2>
          <p className="text-gray-600 mb-6 leading-relaxed">
            {error}
          </p>
          <div className="space-y-3">
            <button
              onClick={() => {
                setError('');
                setProcessing(true);
                setRetryCount(0);
                setProcessingStep('Retrying...');
                if (sessionId && user) {
                  handleCheckoutProcessing(sessionId, user.id);
                }
              }}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center"
            >
              <ArrowRight className="w-5 h-5 mr-2" />
              Try Again
            </button>
            <button
              onClick={() => navigate('/subscribe', { replace: true })}
              className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-semibold hover:bg-gray-200 transition-colors duration-200"
            >
              Back to Plans
            </button>
          </div>
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Need help? Contact support at{' '}
              <a href="mailto:support@askstan.com" className="text-blue-600 hover:text-blue-700">
                support@askstan.com
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-amber-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            🎉 Welcome to AskStan!
          </h2>
          <p className="text-gray-600 mb-6 leading-relaxed">
            Your subscription has been activated successfully. You now have full access to Stan, your personal AI social media growth coach.
          </p>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-green-800 font-medium">
              ✅ Subscription Status: Active
            </p>
            <p className="text-green-700 text-sm mt-1">
              Redirecting to your dashboard...
            </p>
          </div>
          <div className="flex items-center justify-center text-blue-600">
            <Loader className="w-5 h-5 mr-2 animate-spin" />
            <span className="font-medium">Loading your dashboard...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-amber-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="relative">
          <div className="w-16 h-16 mx-auto mb-6">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600"></div>
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Processing Your Payment
        </h2>
        
        <p className="text-gray-600 mb-6 leading-relaxed">
          Please wait while we confirm your subscription and activate your account.
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-blue-800 font-medium text-sm">
            {processingStep}
          </p>
          {retryCount > 0 && (
            <p className="text-blue-600 text-xs mt-1">
              Retry attempt {retryCount}/3
            </p>
          )}
        </div>

        <div className="text-xs text-gray-500 space-y-1">
          <p>🔒 Your payment is secure and processed by Stripe</p>
          <p>⚡ This usually takes just a few seconds</p>
          <p>📱 You'll have instant access once complete</p>
        </div>
      </div>
    </div>
  );
};

export default CheckoutSuccess;