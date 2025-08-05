import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Loader, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

const CheckoutSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, refetchUserData } = useAuth();
  const [processing, setProcessing] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const processCheckout = async () => {
      const sessionId = searchParams.get('session_id');
      
      if (!sessionId || !user) {
        setError('Invalid checkout session or user not found');
        setProcessing(false);
        return;
      }

      try {
        console.log('Processing checkout completion for session:', sessionId);

        // Call the process-checkout-session edge function
        const { data: { session } } = await supabase.auth.getSession();
        
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-checkout-session`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sessionId }),
        });

        const result = await response.json();
        
        if (result.success) {
          console.log('Checkout processed successfully:', result);
          setSuccess(true);
          
          // Refresh user data to get the new subscription
          await refetchUserData();
          
          // Redirect to dashboard after a short delay
          setTimeout(() => {
            navigate('/dashboard', { replace: true });
          }, 2000);
        } else {
          throw new Error(result.error || 'Checkout processing failed');
        }
      } catch (err: any) {
        console.error('Checkout processing error:', err);
        setError(err.message || 'Failed to process checkout');
      } finally {
        setProcessing(false);
      }
    };

    processCheckout();
  }, [searchParams, user, navigate, refetchUserData]);

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
            We're setting up your AskStan account and activating your subscription. This will only take a moment.
          </p>

          <div className="space-y-2 text-sm text-gray-500">
            <p>✅ Payment confirmed</p>
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
            There was an issue processing your subscription. Don't worry - your payment was successful.
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
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Welcome to AskStan!
        </h1>
        
        <p className="text-gray-600 mb-6">
          Your subscription has been activated successfully. You now have full access to Stan, your personal AI social media growth coach.
        </p>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-green-800 font-medium">
            🎉 Subscription Active - Ready to grow your social media presence!
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