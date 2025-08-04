import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, User, Settings, Send, MessageCircle, CheckCircle, Loader } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

const Dashboard: React.FC = () => {
  const { signOut, user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [showDropdown, setShowDropdown] = useState(false);
  const [chatbotLoaded, setChatbotLoaded] = useState(false);
  const [chatbotError, setChatbotError] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hello! I'm Stan, your personal AI assistant powered by Yvexan Agency. How can I help you today?",
      sender: 'bot',
      timestamp: new Date(),
    },
  ]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [validatingSession, setValidatingSession] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const validateSession = async (sessionId: string) => {
    console.log('[Dashboard] Validating Stripe session:', sessionId);
    setValidatingSession(true);
    setValidationError(null);
    
    try {
      // Get current session token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.access_token) {
        throw new Error('Authentication required. Please sign in again.');
      }

      console.log('[Dashboard] Making validation request...');
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-checkout-session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'x-requested-with': 'XMLHttpRequest',
          },
          body: JSON.stringify({ 
            sessionId, 
            userId: profile?.id 
          }),
        }
      );

      console.log('[Dashboard] Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Dashboard] Response error:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('[Dashboard] Validation API response:', result);

      if (result.success) {
        console.log('[Dashboard] Stripe session validated successfully!');
        setShowSuccess(true);
        
        // Show success message for 3 seconds
        setTimeout(() => {
          setShowSuccess(false);
        }, 3000);
      } else {
        console.error('[Dashboard] Stripe session validation failed:', result.error);
        setValidationError(result.error || 'Payment validation failed');
      }
    } catch (error: any) {
      console.error('[Dashboard] Error validating Stripe session:', error);
      setValidationError(error.message || 'Failed to validate payment');
    } finally {
      // Clean URL after validation attempt
      const urlParams = new URLSearchParams(location.search);
      urlParams.delete('session_id');
      const newUrl = window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : '');
      console.log('[Dashboard] Cleaning URL to:', newUrl);
      window.history.replaceState({}, document.title, newUrl);
      setValidatingSession(false);
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const sessionId = urlParams.get('session_id');

    console.log('[Dashboard] URL params:', location.search);
    console.log('[Dashboard] session_id:', sessionId);
    console.log('[Dashboard] user:', user);
    console.log('[Dashboard] profile:', profile);

    if (!sessionId) {
      console.log('[Dashboard] No session_id in URL, skipping validation.');
      return;
    }

    if (user && profile && !validatingSession) {
      console.log('[Dashboard] All data ready. Starting session validation...');
      validateSession(sessionId);
    } else {
      console.log('[Dashboard] user/profile not ready yet. Waiting...');
    }
  }, [user, profile, location.search]);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    const userMessage = {
      id: messages.length + 1,
      text: message,
      sender: 'user' as const,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setMessage('');

    setTimeout(() => {
      const botResponse = {
        id: messages.length + 2,
        text:
          "I'm currently running in fallback mode. The full AskStan chatbot service by Yvexan Agency will be available once the service is restored. In the meantime, I can provide basic assistance.",
        sender: 'bot' as const,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botResponse]);
    }, 1000);
  };

  useEffect(() => {
    if (!user) return;

    const script = document.createElement('script');
    script.src = 'https://cdn.voiceflow.com/widget-next/bundle.mjs';
    script.type = 'text/javascript';

    script.onload = function () {
      try {
        (window as any).voiceflow.chat.load({
          verify: { projectID: '688d150bdb7293eb99bdbe16' },
          url: 'https://general-runtime.voiceflow.com',
          versionID: 'production',
          voice: { url: 'https://runtime-api.voiceflow.com' },
        });
        setChatbotLoaded(true);
        setChatbotError(false);
      } catch (error) {
        setChatbotError(true);
        setChatbotLoaded(false);
      }
    };

    script.onerror = function () {
      setChatbotError(true);
      setChatbotLoaded(false);
    };

    const firstScript = document.getElementsByTagName('script')[0];
    if (firstScript && firstScript.parentNode) {
      firstScript.parentNode.insertBefore(script, firstScript);
    } else {
      document.head.appendChild(script);
    }

    return () => {
      try {
        if ((window as any).voiceflow) {
          (window as any).voiceflow.chat.destroy();
        }
      } catch (error) {
        console.error('Error cleaning up Voiceflow:', error);
      }
    };
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-amber-50">
      {/* Payment Success Notification */}
      {showSuccess && (
        <div className="fixed top-4 right-4 z-50 bg-green-100 border border-green-400 text-green-700 px-6 py-4 rounded-lg shadow-lg">
          <div className="flex items-center">
            <CheckCircle className="w-5 h-5 mr-2" />
            <span className="font-semibold">Payment successful! Welcome to AskStan Pro!</span>
          </div>
        </div>
      )}

      {/* Payment Validation Loading */}
      {validatingSession && (
        <div className="fixed top-4 right-4 z-50 bg-blue-100 border border-blue-400 text-blue-700 px-6 py-4 rounded-lg shadow-lg">
          <div className="flex items-center">
            <Loader className="w-5 h-5 mr-2 animate-spin" />
            <span>Validating your payment...</span>
          </div>
        </div>
      )}

      {/* Payment Validation Error */}
      {validationError && (
        <div className="fixed top-4 right-4 z-50 bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Payment validation failed: {validationError}</span>
            <button 
              onClick={() => setValidationError(null)}
              className="ml-4 text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-amber-500 rounded-lg flex items-center justify-center mr-3">
                  <MessageCircle className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-900">AskStan</span>
              </Link>
            </div>

            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600 hidden sm:block">
                Welcome back, {profile?.email || 'User'}!
              </span>
              
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-amber-500 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                </button>

                {showDropdown && (
                  <div className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                    <div className="py-1">
                      <Link
                        to="/settings"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setShowDropdown(false)}
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Settings
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h1>
            <p className="text-gray-600">
              Welcome to your AskStan dashboard! Chat with Stan below to get started.
            </p>
          </div>

          {/* Chat Interface */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Chat with Stan</h2>
              
              {/* Messages Container */}
              <div className="h-96 overflow-y-auto border rounded-lg p-4 mb-4 bg-gray-50">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`mb-4 ${
                      msg.sender === 'user' ? 'text-right' : 'text-left'
                    }`}
                  >
                    <div
                      className={`inline-block max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        msg.sender === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-900 border'
                      }`}
                    >
                      <p className="text-sm">{msg.text}</p>
                      <p className="text-xs mt-1 opacity-70">
                        {msg.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Message Input */}
              <form onSubmit={handleSendMessage} className="flex">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 border border-gray-300 rounded-l-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="submit"
                  disabled={!message.trim()}
                  className="bg-blue-600 text-white px-6 py-2 rounded-r-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;