import React from 'react';
import { Clock, AlertTriangle, RefreshCw } from 'lucide-react';

interface RateLimitNoticeProps {
  onRetry: () => void;
  isRetrying: boolean;
}

const RateLimitNotice: React.FC<RateLimitNoticeProps> = ({ onRetry, isRetrying }) => {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-6">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <AlertTriangle className="w-6 h-6 text-amber-600" />
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-amber-800 mb-2">
            Rate Limit Reached
          </h3>
          <div className="text-sm text-amber-700 space-y-2">
            <p>
              Too many authentication attempts have been made. This is a security measure to protect the platform.
            </p>
            <div className="flex items-center space-x-2 text-amber-600">
              <Clock className="w-4 h-4" />
              <span className="font-medium">Please wait 5-10 minutes before trying again</span>
            </div>
          </div>
          
          <div className="mt-4 space-y-2">
            <p className="text-sm text-amber-700 font-medium">What you can do:</p>
            <ul className="text-sm text-amber-700 space-y-1 ml-4">
              <li>• Wait 5-10 minutes and try again</li>
              <li>• If you already have an account, try signing in instead</li>
              <li>• Check your email for any confirmation links</li>
              <li>• Contact support if the issue persists</li>
            </ul>
          </div>

          <div className="mt-4">
            <button
              onClick={onRetry}
              disabled={isRetrying}
              className="inline-flex items-center px-3 py-2 border border-amber-300 shadow-sm text-sm leading-4 font-medium rounded-md text-amber-700 bg-white hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRetrying ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Checking...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Try Again
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RateLimitNotice;