import React, { useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, ArrowLeft } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const StripeRedirect: React.FC = () => {
  const { user, hasActiveSubscription } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const stripeCheckoutUrl = import.meta.env.VITE_STRIPE_CHECKOUT_URL;
  
  // Get the page user was trying to access before being redirected
  const from = location.state?.from?.pathname || '/dashboard';

  useEffect(() => {
    // If user already has active subscription, redirect to dashboard
    if (hasActiveSubscription()) {
      navigate(from, { replace: true });
    }
  }, [hasActiveSubscription, navigate, from]);

  const handleStripeCheckout = () => {
    if (stripeCheckoutUrl) {
      // Open Stripe checkout in a new tab to avoid iframe issues
      const newWindow = window.open(stripeCheckoutUrl, '_blank', 'noopener,noreferrer');
      if (!newWindow) {
        // Fallback if popup is blocked
        window.location.href = stripeCheckoutUrl;
      }
    } else {
      console.error('Stripe checkout URL not configured');
      alert('Stripe checkout is not properly configured. Please contact support.');
    }
  };

  const handleBackToAuth = () => {
    navigate('/auth', { state: { from: location.state?.from } });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-amber-50 flex items-center justify-center px-4">
      <div className="absolute top-6 left-6">
        <button
          onClick={handleBackToAuth}
          className="flex items-center text-blue-700 hover:text-blue-800 transition-colors duration-200"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Login
        </button>
      </div>

      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        {hasActiveSubscription() ? (
          <div className="mb-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-blue-900 mb-2">
              You're All Set!
            </h1>
            <p className="text-gray-600">
              Your subscription is active. Access your dashboard now.
            </p>
            <button
              onClick={() => navigate(from, { replace: true })}
              className="mt-6 inline-block bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-6 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transform hover:scale-[1.02] transition-all duration-200 shadow-lg"
            >
              Continue
            </button>
          </div>
        ) : (
          <>
        <div className="mb-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-blue-900 mb-2">
            Complete Your Subscription
          </h1>
          <p className="text-gray-600">
            {user ? 'You\'re one step away from accessing AskStan' : 'Please sign in first to continue'}
          </p>
        </div>

            {user ? (
              <>
        <div className="bg-gradient-to-r from-blue-50 to-amber-50 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">AskStan Pro</h3>
          <div className="text-center">
            <span className="text-3xl font-bold text-blue-900">$4.99</span>
            <span className="text-gray-600">/month</span>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-gray-700">
            <li>✓ Unlimited AI conversations</li>
            <li>✓ Personalized responses</li>
            <li>✓ 24/7 availability</li>
            <li>✓ Priority support</li>
          </ul>
        </div>

        <button
          onClick={handleStripeCheckout}
          className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-amber-600 hover:to-amber-700 transform hover:scale-[1.02] transition-all duration-200 shadow-lg mb-4"
        >
          Subscribe with Stripe
        </button>
              </>
            ) : (
              <div className="mb-8">
                <p className="text-gray-600 mb-4">
                  Please sign in to your account first.
                </p>
                <Link
                  to="/auth"
                  className="inline-block bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-6 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transform hover:scale-[1.02] transition-all duration-200 shadow-lg"
                >
                  Sign In
                </Link>
              </div>
            )}

            <p className="text-xs text-gray-500 mt-4">
              Secure payment processing by Stripe
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default StripeRedirect;