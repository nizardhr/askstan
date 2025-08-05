import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Loader, AlertCircle, ArrowRight, CreditCard } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

const CheckoutSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, refetchUserData } = useAuth();
  const [processing, setProcessing] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [subscriptionDetails, setSubscriptionDetails] = useState<any>(null);

  const sessionId = searchParams.get('session_id');
  const freeSubscription = searchParams.get('free_subscription') === 'true';

  useEffect(() => {
    const processCheckout = async () => {
      console.log('🔄 [CheckoutSuccess] Starting checkout processing...');
      console.log('📋 [CheckoutSuccess] Session ID:', sessionId);
      console.log('👤 [CheckoutSuccess] User:', user?.id);
      console.log('🆓 [CheckoutSuccess] Free subscription:', freeSubscription);

      if (!user) {
        console.log('⏳ [CheckoutSuccess] Waiting for user authentication...');
        return;
      }

      // Handle free subscription (100% promo code)
      if (freeSubscription) {
        console.log('🎉 [CheckoutSuccess] Free subscription detected, redirecting to dashboard');
        setSuccess(true);
        setProcessing(false);
        setTimeout(() => navigate('/dashboard'), 2000);
        return;
      }

      if (!sessionId) {
        console.error('❌ [CheckoutSuccess] No session ID found in URL');
        setError('Invalid checkout session. Please try again.');
        setProcessing(false);
        return;
      }

      console.log('🔄 [CheckoutSuccess] Processing checkout session:', sessionId);
      console.log('👤 [CheckoutSuccess] User ID:', user.id);

      try {
        // Get user session for authorization
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error('No valid session found');
        }

        console.log('📞 [CheckoutSuccess] Calling process-checkout-session edge function...');

        // Call the process-checkout-session edge function
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-checkout-session`;
        
        const requestBody = {
          sessionId: sessionId,
          userId: user.id
        };

        console.log('📤 [CheckoutSuccess] Request body:', requestBody);
        console.log('🌐 [CheckoutSuccess] API URL:', apiUrl);

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'x-requested-with': 'XMLHttpRequest',
          },
          body: JSON.stringify(requestBody),
        });

        console.log('📡 [CheckoutSuccess] Edge function response status:', response.status);
        console.log('📡 [CheckoutSuccess] Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ [CheckoutSuccess] Edge function error response:', errorText);
          throw new Error(`Failed to process checkout: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        console.log('✅ [CheckoutSuccess] Edge function result:', result);

        if (result.success) {
          setSubscriptionDetails(result);
          setSuccess(true);
          
          // Refetch user data to get updated subscription
          console.log('🔄 [CheckoutSuccess] Refetching user data...');
          await refetchUserData();
          
          // Redirect to dashboard after a short delay
          setTimeout(() => {
            console.log('🚀 [CheckoutSuccess] Redirecting to dashboard...');
            navigate('/dashboard');
          }, 3000);
        } else {
          throw new Error(result.error || 'Failed to activate subscription');
        }

      } catch (err: any) {
        console.error('💥 [CheckoutSuccess] Error processing checkout:', err);
        setError(err.message || 'Failed to process checkout. Please contact support.');
      } finally {
        setProcessing(false);
      }
    };

    // Only process if we have user and sessionId (or free subscription)
    if (user && (sessionId || freeSubscription)) {
      processCheckout();
    }
  }, [user, sessionId, freeSubscription, navigate, refetchUserData]);

  if (processing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-amber-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Loader className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Processing Your Subscription
          </h1>
          
          <p className="text-gray-600 mb-6">
            We're activating your AskStan subscription. This will only take a moment...
          </p>

          <div className="space-y-2 text-sm text-gray-500">
            <p>✅ Payment confirmed</p>
            <p>🔄 Activating subscription...</p>
            <p>📊 Setting up your account...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-amber-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Subscription Activation Failed
          </h1>
          
          <p className="text-gray-600 mb-6">
            {error}
          </p>

          <div className="space-y-4">
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors duration-200"
            >
              Try Again
            </button>
            
            <button
              onClick={() => navigate('/subscribe')}
              className="w-full border border-gray-300 text-gray-700 py-3 px-4 rounded-lg font-semibold hover:bg-gray-50 transition-colors duration-200"
            >
              Back to Plans
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Need help? Contact{' '}
              <a href="mailto:support@askstan.com" className="text-blue-600 hover:text-blue-700">
                support@askstan.com
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-amber-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Welcome to AskStan!
        </h1>
        
        <p className="text-gray-600 mb-6">
          Your subscription has been activated successfully. You now have full access to Stan, your personal AI social media growth coach.
        </p>

        {subscriptionDetails && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-center mb-2">
              <CreditCard className="w-5 h-5 text-green-600 mr-2" />
              <span className="font-semibold text-green-800">Subscription Active</span>
            </div>
            <p className="text-sm text-green-700">
              Plan: {subscriptionDetails.planType} • Status: {subscriptionDetails.status}
            </p>
            {subscriptionDetails.freeSubscription && (
              <p className="text-sm text-green-700 mt-1">
                🎉 Free subscription via promo code!
              </p>
            )}
          </div>
        )}

        <div className="space-y-3 text-sm text-gray-600 mb-6">
          <p>✅ Payment processed successfully</p>
          <p>✅ Account activated</p>
          <p>✅ Ready to start growing your social media</p>
        </div>

        <button
          onClick={() => navigate('/dashboard')}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transform hover:scale-[1.02] transition-all duration-200 shadow-lg flex items-center justify-center"
        >
          Start Growing with Stan
          <ArrowRight className="w-5 h-5 ml-2" />
        </button>

        <p className="text-xs text-gray-500 mt-4">
          Redirecting automatically in a few seconds...
        </p>
      </div>
    </div>
  );
};

export default CheckoutSuccess;