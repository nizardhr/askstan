import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Loader, Crown, Zap, TrendingUp, Users, Target } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Plan } from '../types/subscription';

const plans: Plan[] = [
  {
    id: 'monthly',
    name: 'Monthly Pro',
    price: 4.99,
    interval: 'month',
    stripePriceId: 'price_XXXX', // Replace with your actual monthly price ID
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
    stripePriceId: 'price_XXXXXX', // Replace with your actual yearly price ID
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

const PlanSelection: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handlePlanSelect = async (plan: Plan) => {
    if (!user) {
      navigate('/auth');
      return;
    }

    setLoading(plan.id);
    setError('');

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId: plan.stripePriceId,
          userId: user.id,
          planType: plan.interval === 'month' ? 'monthly' : 'yearly',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message || 'An error occurred');
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

        {error && (
          <div className="max-w-md mx-auto mb-8 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-center">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
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
                  <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                  <span className="text-gray-600">/{plan.interval}</span>
                </div>

                {plan.interval === 'year' && (
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
                    Creating Checkout...
                  </>
                ) : (
                  <>
                    Start Growing with {plan.name}
                    <TrendingUp className="w-5 h-5 ml-2" />
                  </>
                )}
              </button>

              {plan.popular && (
                <div className="mt-4 text-center">
                  <p className="text-xs text-gray-500">
                    ⭐ Recommended for serious creators
                  </p>
                </div>
              )}
            </div>
          ))}
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlanSelection;