import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Loader, Crown, Zap, TrendingUp, Users, Target, Tag, X, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Plan } from '../types/subscription';

const plans: Plan[] = [
  {
    id: 'monthly',
    name: 'Monthly Pro',
    price: 4.99,
    interval: 'month',
    stripePriceId: import.meta.env.VITE_STRIPE_MONTHLY_PRICE_ID || 'price_monthly_default',
    features: [
      'Unlimited AI conversations with Stan',
      'Real-time social media growth coaching',
      'Daily posting strategies & content ideas',
      'LinkedIn, X, Instagram, Threads optimization',
      'Engagement tactics that convert followers',
      'Personal brand development guidance',
      'Algorithm-beating posting schedules',
      '24/7 growth strategy support'
    ]
  },
  {
    id: 'yearly',
    name: 'Yearly Pro',
    price: 49.99,
    interval: 'year',
    stripePriceId: import.meta.env.VITE_STRIPE_YEARLY_PRICE_ID || 'price_yearly_default',
    popular: true,
    features: [
      'Everything in Monthly Pro',
      '2 months free (save $10/year)',
      'Advanced growth analytics & insights',
      'Exclusive viral content templates',
      'Priority coaching & faster responses',
      'Custom growth strategy sessions',
      'Platform-specific masterclasses',
      'Direct access to growth experts',
      'Revenue optimization strategies',
      'Community of successful creators'
    ]
  }
];

interface PromoCodeData {
  valid: boolean;
  promotionCodeId?: string;
  couponId?: string;
  code?: string;
  discount?: {
    type: 'percentage' | 'amount';
    value: number;
    currency?: string;
    duration?: string;
    duration_in_months?: number;
  };
  description?: string;
  name?: string;
  error?: string;
}

const PlanSelection: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promoCodeLoading, setPromoCodeLoading] = useState(false);
  const [promoCodeError, setPromoCodeError] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<PromoCodeData | null>(null);
  const [showPromoInput, setShowPromoInput] = useState(false);

  const validatePromoCode = async () => {
    if (!promoCode.trim()) {
      setPromoCodeError('Please enter a promo code');
      return;
    }

    setPromoCodeLoading(true);
    setPromoCodeError('');

    try {
      // Get user session for authorization
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Please sign in to validate promo codes');
      }

      console.log('Validating promo code:', promoCode.trim());

      // Call the validate-promo-code edge function
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-promo-code`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
        },
        body: JSON.stringify({ promoCode: promoCode.trim() }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: PromoCodeData = await response.json();
      console.log('Promo code validation result:', data);

      if (data.valid) {
        setAppliedPromo(data);
        setPromoCodeError('');
        setShowPromoInput(false);
      } else {
        setPromoCodeError(data.error || 'Invalid promo code');
        setAppliedPromo(null);
      }
    } catch (err: any) {
      console.error('Promo code validation error:', err);
      
      // Provide helpful error messages
      if (err.message.includes('Failed to fetch') || err.message.includes('ERR_FAILED')) {
        setPromoCodeError('Unable to validate promo code. Please check your internet connection and try again.');
      } else if (err.message.includes('HTTP 404')) {
        setPromoCodeError('Promo code validation service is temporarily unavailable. Please try again later.');
      } else {
        setPromoCodeError(err.message || 'Failed to validate promo code. Please try again.');
      }
      
      setAppliedPromo(null);
    } finally {
      setPromoCodeLoading(false);
    }
  };

  const removePromoCode = () => {
    setAppliedPromo(null);
    setPromoCode('');
    setPromoCodeError('');
    setShowPromoInput(false);
  };

  const calculateDiscountedPrice = (originalPrice: number): number => {
    if (!appliedPromo?.discount) return originalPrice;

    if (appliedPromo.discount.type === 'percentage') {
      return originalPrice * (1 - appliedPromo.discount.value / 100);
    } else {
      return Math.max(0, originalPrice - appliedPromo.discount.value);
    }
  };

  const calculateSavings = (originalPrice: number): number => {
    if (!appliedPromo?.discount) return 0;
    return originalPrice - calculateDiscountedPrice(originalPrice);
  };

  const handlePlanSelect = async (plan: Plan) => {
    if (!user) {
      navigate('/auth');
      return;
    }

    setLoading(plan.id);
    setError('');

    try {
      console.log('Starting checkout process for plan:', plan.id);

      // Get user session for authorization
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Please sign in to continue');
      }

      // Try to create checkout session via edge function
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`;
      
      const requestBody: any = {
        priceId: plan.stripePriceId,
        userId: user.id,
        planType: plan.interval === 'month' ? 'monthly' : 'yearly',
      };

      // Include promo code if applied
      if (appliedPromo?.valid) {
        requestBody.promoCode = appliedPromo.code;
        requestBody.promotionCodeId = appliedPromo.promotionCodeId;
        console.log('Including promo code in checkout:', appliedPromo.code);
      }

      console.log('Creating checkout session with:', requestBody);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Checkout session created:', data);
      
      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      
      // Provide helpful error messages
      if (err.message.includes('Failed to fetch') || err.message.includes('ERR_FAILED')) {
        setError('Unable to create checkout session. Please check your internet connection and try again.');
      } else if (err.message.includes('HTTP 404')) {
        setError('Checkout service is temporarily unavailable. Please try again later or contact support.');
      } else if (err.message.includes('User profile not found')) {
        setError('Account setup incomplete. Please try signing out and back in.');
      } else {
        setError(err.message || 'An error occurred during checkout. Please try again.');
      }
      
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-amber-50">
      <div className="absolute top-6 left-6">
        <Link 
          to="/auth" 
          className="flex items-center text-blue-700 hover:text-blue-800 transition-colors duration-200"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Login
        </Link>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <div className="inline-flex items-center bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <TrendingUp className="w-4 h-4 mr-2" />
            Social Media Growth Coaching Platform
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
            Choose Your{' '}
            <span className="bg-gradient-to-r from-blue-600 to-amber-500 bg-clip-text text-transparent">
              AskStan
            </span>
            {' '}Growth Plan
          </h1>
          
          <p className="text-xl text-gray-600 max-w-4xl mx-auto mb-8">
            Unlock the power of AI-driven social media growth coaching. 
            Build your dynamic and profitable social media business with personalized strategies, 
            daily posting guidance, and real-time engagement coaching.
          </p>

          {/* Social Proof */}
          <div className="flex flex-wrap justify-center items-center gap-8 mb-12 text-gray-600">
            <div className="flex items-center">
              <Users className="w-5 h-5 mr-2 text-blue-600" />
              <span className="font-medium">10,000+ Growing Creators</span>
            </div>
            <div className="flex items-center">
              <Target className="w-5 h-5 mr-2 text-amber-600" />
              <span className="font-medium">5x Average Growth Rate</span>
            </div>
            <div className="flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
              <span className="font-medium">$2M+ Revenue Generated</span>
            </div>
          </div>
        </div>

        {/* Promo Code Section */}
        <div className="max-w-md mx-auto mb-8">
          {!appliedPromo && !showPromoInput && (
            <div className="text-center">
              <button
                onClick={() => setShowPromoInput(true)}
                className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium transition-colors duration-200 bg-blue-50 px-4 py-2 rounded-lg hover:bg-blue-100"
              >
                <Tag className="w-4 h-4 mr-2" />
                Have a promo code? Click to apply
              </button>
            </div>
          )}

          {showPromoInput && !appliedPromo && (
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Tag className="w-5 h-5 mr-2 text-blue-600" />
                  Apply Promo Code
                </h3>
                <button
                  onClick={() => {
                    setShowPromoInput(false);
                    setPromoCodeError('');
                    setPromoCode('');
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="flex space-x-3">
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    placeholder="Enter promo code (e.g., SAVE20)"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 uppercase"
                    disabled={promoCodeLoading}
                    maxLength={50}
                  />
                  <button
                    onClick={validatePromoCode}
                    disabled={promoCodeLoading || !promoCode.trim()}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center min-w-[100px] justify-center"
                  >
                    {promoCodeLoading ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      'Validate'
                    )}
                  </button>
                </div>
                
                {promoCodeError && (
                  <div className="flex items-start space-x-2 text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Promo Code Error</p>
                      <p className="text-sm">{promoCodeError}</p>
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-500">
                  <p>💡 <strong>Tip:</strong> Promo codes are case-insensitive and will be automatically formatted.</p>
                </div>
              </div>
            </div>
          )}

          {appliedPromo && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6 mb-6 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-4">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="font-bold text-green-800 text-lg">Promo Code Applied!</p>
                    <p className="text-green-700 font-medium">
                      {appliedPromo.code} - {appliedPromo.description}
                    </p>
                    <p className="text-sm text-green-600">
                      {appliedPromo.discount?.duration === 'forever' && 'Discount applies forever!'}
                      {appliedPromo.discount?.duration === 'once' && 'One-time discount on first payment'}
                      {appliedPromo.discount?.duration === 'repeating' && `Discount for ${appliedPromo.discount.duration_in_months} months`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={removePromoCode}
                  className="text-green-600 hover:text-green-700 transition-colors bg-green-100 hover:bg-green-200 p-2 rounded-full"
                  title="Remove promo code"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="max-w-md mx-auto mb-8">
            <div className="flex items-start space-x-2 text-red-600 bg-red-50 p-4 rounded-lg border border-red-200">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Checkout Error</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => {
            const originalPrice = plan.price;
            const discountedPrice = calculateDiscountedPrice(originalPrice);
            const savings = calculateSavings(originalPrice);
            const hasDiscount = appliedPromo && savings > 0;

            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl shadow-xl border-2 p-8 transform hover:scale-105 transition-all duration-300 ${
                  plan.popular 
                    ? 'border-amber-400 ring-4 ring-amber-100' 
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white px-6 py-2 rounded-full text-sm font-semibold flex items-center">
                      <Crown className="w-4 h-4 mr-2" />
                      Most Popular - Best Value
                    </div>
                  </div>
                )}

                <div className="text-center mb-8">
                  <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${
                    plan.popular 
                      ? 'bg-gradient-to-r from-amber-100 to-amber-200' 
                      : 'bg-gradient-to-r from-blue-100 to-blue-200'
                  }`}>
                    {plan.popular ? (
                      <Crown className="w-8 h-8 text-amber-600" />
                    ) : (
                      <Zap className="w-8 h-8 text-blue-600" />
                    )}
                  </div>
                  
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  
                  <div className="mb-4">
                    {hasDiscount ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-center space-x-3">
                          <span className="text-2xl font-bold text-gray-400 line-through">${originalPrice.toFixed(2)}</span>
                          <span className="text-4xl font-bold text-green-600">${discountedPrice.toFixed(2)}</span>
                        </div>
                        <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-bold inline-block">
                          Save ${savings.toFixed(2)} with {appliedPromo.code}
                        </div>
                      </div>
                    ) : (
                      <span className="text-4xl font-bold text-gray-900">${originalPrice.toFixed(2)}</span>
                    )}
                    <span className="text-gray-600">/{plan.interval}</span>
                  </div>

                  {plan.interval === 'year' && !hasDiscount && (
                    <div className="inline-flex items-center bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium mb-4">
                      💰 Save $10/year - Best Deal!
                    </div>
                  )}

                  <p className="text-gray-600 text-sm">
                    {plan.interval === 'month' 
                      ? 'Perfect for getting started with social media growth'
                      : 'Maximum value for serious creators building profitable businesses'
                    }
                  </p>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <Check className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700 text-sm leading-relaxed">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handlePlanSelect(plan)}
                  disabled={loading === plan.id}
                  className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 flex items-center justify-center ${
                    plan.popular
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow-lg transform hover:scale-[1.02]'
                      : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 shadow-lg transform hover:scale-[1.02]'
                  } disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
                >
                  {loading === plan.id ? (
                    <>
                      <Loader className="w-5 h-5 mr-2 animate-spin" />
                      Creating Secure Checkout...
                    </>
                  ) : (
                    <>
                      {hasDiscount ? (
                        <>Get {plan.name} for ${discountedPrice.toFixed(2)}</>
                      ) : (
                        <>Start Growing with {plan.name}</>
                      )}
                      <TrendingUp className="w-5 h-5 ml-2" />
                    </>
                  )}
                </button>

                {hasDiscount && (
                  <div className="mt-3 text-center">
                    <p className="text-sm text-green-600 font-medium">
                      🎉 You're saving ${savings.toFixed(2)} with {appliedPromo.code}!
                    </p>
                  </div>
                )}

                {plan.popular && !hasDiscount && (
                  <div className="mt-4 text-center">
                    <p className="text-xs text-gray-500">
                      ⭐ Recommended for serious creators
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Trust Indicators */}
        <div className="text-center mt-16">
          <div className="inline-flex items-center space-x-8 text-gray-500 text-sm">
            <div className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
              <span>🔒 Secure payment by Stripe</span>
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
              <span>📱 Instant access after payment</span>
            </div>
            <div className="flex items-center">
              <div className="w-2 h-2 bg-amber-500 rounded-full mr-2"></div>
              <span>🚫 Cancel anytime, no commitments</span>
            </div>
          </div>
          
          <div className="mt-6 max-w-2xl mx-auto">
            <p className="text-gray-600 text-sm leading-relaxed">
              Join thousands of creators who've transformed their social media presence into profitable businesses. 
              Start your growth journey today with Stan, your personal AI growth coach powered by Yvexan Agency.
            </p>
            
            {/* Security Notice */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>🔐 Secure Checkout:</strong> All payments are processed securely through Stripe. 
                Your payment information is never stored on our servers.
                {appliedPromo && (
                  <span className="block mt-1">
                    <strong>✅ Promo Code:</strong> Your discount will be automatically applied at checkout.
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanSelection;