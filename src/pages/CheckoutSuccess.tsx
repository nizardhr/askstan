import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Loader, AlertTriangle, Gift, ArrowRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

const CheckoutSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, refetchUserData } = useAuth();
  const [processing, setProcessing] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isFreeSubscription, setIsFreeSubscription] = useState(false);
  const [processingStep, setProcessingStep] = useState('Validating checkout session...');

  useEffect(() => {
    const processCheckout = async () => {
      const sessionId = searchParams.get('session_id');
      const freeSubscription = searchParams.get('free_subscription') === 'true';
      
      console.log('🔄 [CheckoutSuccess] Starting checkout processing');
      console.log('📋 [CheckoutSuccess] Session ID:', sessionId);
      console.log('👤 [CheckoutSuccess] User ID:', user?.id);
      console.log('🎁 [CheckoutSuccess] Free subscription:', freeSubscription);
      
      if (!user) {
        console.error('❌ [CheckoutSuccess] No user found');
        setError('User not found - please sign in again');
        setProcessing(false);
        return;
      }

      if (!sessionId) {
        console.error('❌ [CheckoutSuccess] No session ID found');
        setError('Invalid checkout session - no session ID found');
        setProcessing(false);
        return;
      }

      try {
        setIsFreeSubscription(freeSubscription);
        setProcessingStep('Activating your subscription...');
        
        console.log('🚀 [CheckoutSuccess] Calling process-checkout-session edge function...');

        // Get current session for authorization
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session?.access_token) {
          throw new Error('Authentication session not found');
        }

        // Call the process-checkout-session edge function
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-checkout-session`;
        
        console.log('📡 [CheckoutSuccess] Making request to:', apiUrl);
        console.log('📋 [CheckoutSuccess] Request payload:', { sessionId, userId: user.id });

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'x-requested-with': 'XMLHttpRequest',
          },
          body: JSON.stringify({ 
            sessionId,
            userId: user.id 
          }),
        });

        console.log('📡 [CheckoutSuccess] Response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ [CheckoutSuccess] Edge function error:', errorText);
          throw new Error(`Failed to process checkout (${response.status}): ${errorText}`);
        }

        const result = await response.json();
        console.log('✅ [CheckoutSuccess] Edge function result:', result);
        
        if (result.success) {
          console.log('🎉 [CheckoutSuccess] Checkout processed successfully!');
          setProcessingStep('Updating your account...');
          setSuccess(true);
          
          // Clean up URL parameters
          window.history.replaceState({}, '', '/checkout-success');
          
          // Refresh user data to get the new subscription
          console.log('🔄 [CheckoutSuccess] Refreshing user data...');
          await refetchUserData();
          
          setProcessingStep('Redirecting to dashboard...');
          
          // Redirect to dashboard after showing success message
          setTimeout(() => {
            console.log('🏠 [CheckoutSuccess] Redirecting to dashboard...');
            navigate('/dashboard', { replace: true });
          }, 2000);
        } else {
          throw new Error(result.error || 'Checkout processing failed');
        }
      } catch (err: any) {
        console.error('💥 [CheckoutSuccess] Processing error:', err);
        setError(err.message || 'Failed to process checkout');
        setProcessing(false);
      }
    };

    // Only process if we have both user and sessionId
    if (user && searchParams.get('session_id')) {
      processCheckout();
    } else if (!user) {
      console.log('⏳ [CheckoutSuccess] Waiting for user authentication...');
      // Wait a bit for auth to load, then redirect if still no user
      setTimeout(() => {
        if (!user) {
          navigate('/auth', { replace: true });
        }
      }, 3000);
    } else {
      console.log('⏳ [CheckoutSuccess] No session ID found');
      setError('No checkout session found');
      setProcessing(false);
    }
  }, [searchParams, user, navigate, refetchUserData]);

  if (processing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-amber-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Loader className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {isFreeSubscription ? 'Activating Your Free Account' : 'Processing Your Subscription'}
          </h1>
          
          <p className="text-gray-600 mb-6">
            {processingStep}
          </p>

          <div className="space-y-2 text-sm text-gray-500">
            <p>✅ {isFreeSubscription ? 'Promo code applied' : 'Payment confirmed'}</p>
            <p>🔄 Activating subscription...</p>
            <p>📱 Setting up your account</p>
          </div>

          <div className="mt-6 text-xs text-gray-400">
            <p>This usually takes 5-10 seconds</p>
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
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Processing Error
          </h1>
          
          <p className="text-gray-600 mb-6">
            There was an issue processing your subscription. Don't worry - your payment was successful and will be processed.
          </p>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-800">{error}</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-200"
            >
              Try Again
            </button>
            
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full border border-gray-300 text-gray-700 py-3 px-4 rounded-lg font-semibold hover:bg-gray-50 transition-all duration-200"
            >
              Go to Dashboard
            </button>
            
            <p className="text-sm text-gray-500">
              If you continue to have issues, contact support at{' '}
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
          {isFreeSubscription ? (
            <Gift className="w-8 h-8 text-green-600" />
          ) : (
            <CheckCircle className="w-8 h-8 text-green-600" />
          )}
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          {isFreeSubscription ? 'Free Account Activated!' : 'Welcome to AskStan!'}
        </h1>
        
        <p className="text-gray-600 mb-6">
          {isFreeSubscription 
            ? "Your free AskStan account has been activated with the promo code. You now have full access to Stan, your personal AI social media growth coach."
            : "Your subscription has been activated successfully. You now have full access to Stan, your personal AI social media growth coach."
          }
        </p>

        <div className={`border rounded-lg p-4 mb-6 ${
          isFreeSubscription 
            ? 'bg-amber-50 border-amber-200' 
            : 'bg-green-50 border-green-200'
        }`}>
          <p className={`text-sm font-medium ${
            isFreeSubscription ? 'text-amber-800' : 'text-green-800'
          }`}>
            {isFreeSubscription 
              ? '🎉 Free subscription activated with promo code!'
              : '🎉 Subscription Active - Ready to grow your social media presence!'
            }
          </p>
        </div>

        <button
          onClick={() => navigate('/dashboard', { replace: true })}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transform hover:scale-[1.02] transition-all duration-200 shadow-lg flex items-center justify-center"
        >
          Continue to Dashboard
          <ArrowRight className="w-5 h-5 ml-2" />
        </button>
      </div>
    </div>
  );
};

export default CheckoutSuccess;