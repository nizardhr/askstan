// Safe Diagnostic Component - handles undefined user gracefully
// Add this as a separate component: src/components/DatabaseDiagnostic.tsx

import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

const DatabaseDiagnostic: React.FC = () => {
  const { user } = useAuth(); // Safely get user from useAuth
  const [testResults, setTestResults] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [autoTestRan, setAutoTestRan] = useState(false);

  const runDatabaseTest = async () => {
    if (!user) {
      console.log('🚫 [DIAGNOSTIC] No user available for testing');
      setTestResults({
        success: false,
        message: 'No authenticated user found',
        needsAuth: true
      });
      return;
    }

    setTesting(true);
    setTestResults(null);

    try {
      console.log('🧪 [DIAGNOSTIC] Starting database test for user:', user.id);

      // Test 1: Basic auth check
      console.log('🔐 [DIAGNOSTIC] Test 1: Authentication check');
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !authUser) {
        throw new Error(`Auth failed: ${authError?.message || 'No user'}`);
      }

      console.log('✅ [DIAGNOSTIC] Auth working for user:', authUser.id);

      // Test 2: Test the database function we'll create
      console.log('🧪 [DIAGNOSTIC] Test 2: Database function test');
      let functionResult = null;
      let functionError = null;
      
      try {
        const { data, error } = await supabase.rpc('test_user_access');
        functionResult = data;
        functionError = error;
        console.log('🧪 [DIAGNOSTIC] Function result:', { data, error });
      } catch (err) {
        functionError = err;
        console.log('⚠️ [DIAGNOSTIC] Function not available yet (migration not run)');
      }

      // Test 3: Direct profile read
      console.log('👤 [DIAGNOSTIC] Test 3: Profile read test');
      const profileStartTime = Date.now();
      
      const profilePromise = supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile read timeout')), 5000)
      );

      let profileResult, profileError;
      try {
        const result = await Promise.race([profilePromise, timeoutPromise]);
        profileResult = result.data;
        profileError = result.error;
      } catch (err) {
        profileError = err;
      }

      const profileTime = Date.now() - profileStartTime;
      console.log(`👤 [DIAGNOSTIC] Profile read took ${profileTime}ms:`, { profileResult, profileError });

      // Test 4: If no profile, try to create one
      let createResult = null;
      let createError = null;
      
      if (!profileResult && !profileError) {
        console.log('➕ [DIAGNOSTIC] Test 4: Profile creation test');
        
        try {
          const { data, error } = await supabase
            .from('user_profiles')
            .insert({
              id: user.id,
              email: user.email || `user-${user.id}@temp.local`,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .select()
            .single();
          
          createResult = data;
          createError = error;
          console.log('➕ [DIAGNOSTIC] Profile creation result:', { data, error });
        } catch (err) {
          createError = err;
          console.log('❌ [DIAGNOSTIC] Profile creation failed:', err);
        }
      }

      // Test 5: Subscription table test
      console.log('💳 [DIAGNOSTIC] Test 5: Subscription table test');
      let subscriptionResult = null;
      let subscriptionError = null;
      
      try {
        const subPromise = supabase
          .from('user_subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        const subTimeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Subscription read timeout')), 5000)
        );

        const result = await Promise.race([subPromise, subTimeoutPromise]);
        subscriptionResult = result.data;
        subscriptionError = result.error;
      } catch (err) {
        subscriptionError = err;
      }

      console.log('💳 [DIAGNOSTIC] Subscription test result:', { subscriptionResult, subscriptionError });

      // Compile results
      const overallSuccess = !profileError && (profileResult || createResult);
      
      setTestResults({
        success: overallSuccess,
        message: overallSuccess 
          ? 'Database connectivity working!' 
          : 'Database connectivity issues detected',
        details: {
          auth: { user: authUser.id, working: true },
          function: { result: functionResult, error: functionError?.message },
          profile: { 
            result: profileResult, 
            error: profileError?.message,
            responseTime: profileTime
          },
          profileCreate: { result: createResult, error: createError?.message },
          subscription: { result: subscriptionResult, error: subscriptionError?.message },
        },
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('💥 [DIAGNOSTIC] Test failed:', error);
      setTestResults({
        success: false,
        message: `Test failed: ${error.message}`,
        error: error.message
      });
    } finally {
      setTesting(false);
    }
  };

  // Auto-run test when user becomes available (for Stripe payment flows)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hasStripeSession = urlParams.has('session_id');
    
    if (user && hasStripeSession && !autoTestRan && !testing) {
      console.log('🚨 [DIAGNOSTIC] Auto-running diagnostic for Stripe payment flow...');
      setAutoTestRan(true);
      runDatabaseTest();
    }
  }, [user, autoTestRan, testing]);

  // Don't render anything if no user (for landing pages)
  if (!user) {
    return null;
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
      <h3 className="text-lg font-semibold text-blue-900 mb-4">
        🔍 Database Connection Diagnostic
      </h3>
      
      <p className="text-sm text-blue-700 mb-4">
        This tool helps diagnose database connectivity issues that prevent profile loading.
      </p>
      
      <button
        onClick={runDatabaseTest}
        disabled={testing}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 mb-4"
      >
        {testing ? '🔄 Testing...' : '🧪 Run Database Test'}
      </button>

      {testResults && (
        <div className="mt-4">
          <div className={`p-4 rounded ${
            testResults.success 
              ? 'bg-green-100 border border-green-300' 
              : 'bg-red-100 border border-red-300'
          }`}>
            <p className={`font-semibold ${
              testResults.success ? 'text-green-800' : 'text-red-800'
            }`}>
              {testResults.success ? '✅ Success!' : '❌ Issues Detected'}
            </p>
            <p className={testResults.success ? 'text-green-700' : 'text-red-700'}>
              {testResults.message}
            </p>
            
            {testResults.details && (
              <div className="mt-3 text-sm">
                <p><strong>Profile Read Time:</strong> {testResults.details.profile?.responseTime}ms</p>
                {testResults.details.profile?.error && (
                  <p className="text-red-600">
                    <strong>Profile Error:</strong> {testResults.details.profile.error}
                  </p>
                )}
              </div>
            )}
          </div>
          
          <details className="mt-4">
            <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
              🔍 View detailed test results
            </summary>
            <pre className="mt-2 bg-gray-100 p-4 rounded text-xs overflow-auto max-h-60">
              {JSON.stringify(testResults, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
};

export default DatabaseDiagnostic;