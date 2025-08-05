import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Loader, AlertTriangle, Gift } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

const CheckoutSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, refetchUserData } = useAuth();
  const [processing, setProcessing] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isFreeSubscription, setIsFreeSubscription] = useState(false);

  useEffect(() => {
    const processCheckout = async () => {
      const sessionId = searchParams.get('session_id');
      const freeSubscription = searchParams.get('free_subscription') === 'true';
      
      console.log('🔄 Processing checkout with session ID:', sessionId);
      console.log('👤 Current user:', user?.id);
      
      if (!user) {
        console.error('❌ No user found during checkout processing');
        setError('User not found - please sign in again');
        setProcessing(false);
        return;
      }

      if (!sessionId) {
        console.error('❌ No session ID found in URL');
        setError('Invalid checkout session - no session ID found');
        setProcessing(false);
        return;
      }

      try {
        setIsFreeSubscription(freeSubscription);
        console.log('🚀 Calling process-checkout-session edge function...');

        // Get current session for authorization
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session?.access_token) {
          throw new Error('Authentication session not found');
        }

        // Call the process-checkout-session edge function
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-checkout-session`;
        
        console.log('📡 Making request to:', apiUrl);
        console.log('📋 Request payload:', { sessionId, userId: user.id });

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

        console.log('📡 Response status:', response.status);
        console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Edge function error response:', errorText);
          throw new Error(`Edge function failed (${response.status}): ${errorText}`);
        }

        const result = await response.json();
        console.log('✅ Edge function result:', result);
        
        if (result.success) {
          console.log('🎉 Checkout processed successfully!');
          setSuccess(true);
          
          // Clean up URL parameters immediately
          window.history.replaceState({}, '', '/checkout-success');
          
          // Refresh user data to get the new subscription
          console.log('🔄 Refreshing user data...');
          await refetchUserData();
          
          // Redirect to dashboard after showing success message
          setTimeout(() => {
            console.log('🏠 Redirecting to dashboard...');
            navigate('/dashboard', { replace: true });
          }, 3000);
        } else {
          throw new Error(result.error || 'Checkout processing failed');
        }
      } catch (err: any) {
        console.error('💥 Checkout processing error:', err);
        setError(err.message || 'Failed to process checkout');
      } finally {
        setProcessing(false);
      }
    };

    // Only process if we have both user and sessionId
    if (user && searchParams.get('session_id')) {
      processCheckout();
    } else if (!user) {
      console.log('⏳ Waiting for user authentication...');
    } else {
      console.log('⏳ Waiting for session ID...');
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
            {isFreeSubscription 
              ? "We're activating your free AskStan account with the promo code. This will only take a moment."
              : "We're setting up your AskStan account and activating your subscription. This will only take a moment."
            }
          </p>

          <div className="space-y-2 text-sm text-gray-500">
            <p>✅ {isFreeSubscription ? 'Promo code applied' : 'Payment confirmed'}</p>
            <p>🔄 Activating subscription...</p>
            <p>📱 Setting up your account</p>
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
            There was an issue processing your subscription. {!isFreeSubscription && "Don't worry - your payment was successful."}
          </p>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-800">{error}</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-200"
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

        <div className="flex items-center justify-center">
          <Loader className="w-5 h-5 animate-spin text-blue-600 mr-2" />
          <span className="text-blue-600">Redirecting to dashboard...</span>
        </div>
      </div>
    </div>
  );
};

export default CheckoutSuccess;