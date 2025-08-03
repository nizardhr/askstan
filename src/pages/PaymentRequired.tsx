import React from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, ArrowRight, AlertTriangle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const PaymentRequired: React.FC = () => {
  const { subscription } = useAuth();

  const getStatusMessage = () => {
    switch (subscription?.status) {
      case 'past_due':
        return {
          title: 'Payment Required',
          message: 'Your payment is past due. Please update your payment method to continue using AskStan.',
          action: 'Update Payment Method'
        };
      case 'canceled':
        return {
          title: 'Subscription Canceled',
          message: 'Your subscription has been canceled. Reactivate your plan to continue growing your social media presence.',
          action: 'Reactivate Subscription'
        };
      default:
        return {
          title: 'Subscription Required',
          message: 'You need an active subscription to access AskStan\'s social media growth coaching features.',
          action: 'Choose a Plan'
        };
    }
  };

  const { title, message, action } = getStatusMessage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-amber-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-red-600" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          {title}
        </h1>

        <p className="text-gray-600 mb-8 leading-relaxed">
          {message}
        </p>

        <div className="space-y-4">
          {subscription?.status === 'past_due' || subscription?.status === 'canceled' ? (
            <Link
              to="/settings"
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-4 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transform hover:scale-[1.02] transition-all duration-200 shadow-lg flex items-center justify-center"
            >
              <CreditCard className="w-5 h-5 mr-2" />
              {action}
            </Link>
          ) : (
            <Link
              to="/subscribe"
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-amber-600 hover:to-amber-700 transform hover:scale-[1.02] transition-all duration-200 shadow-lg flex items-center justify-center"
            >
              {action}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          )}

          <Link
            to="/"
            className="block text-gray-600 hover:text-blue-600 transition-colors duration-200"
          >
            Return to Home
          </Link>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Need help? Contact our support team at{' '}
            <a href="mailto:support@askstan.com" className="text-blue-600 hover:text-blue-700">
              support@askstan.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentRequired;