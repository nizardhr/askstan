import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, User, Settings, Send, MessageCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const Dashboard: React.FC = () => {
  const { signOut, user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [showDropdown, setShowDropdown] = useState(false);
  const [chatbotLoaded, setChatbotLoaded] = useState(false);
  const [chatbotError, setChatbotError] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([
    { id: 1, text: "Hello! I'm Stan, your personal AI assistant powered by Yvexan Agency. How can I help you today?", sender: 'bot', timestamp: new Date() }
  ]);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const sessionId = urlParams.get('session_id');

    const validateCheckoutSession = async () => {
      if (!sessionId || !user) return;

      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_EDGE_URL}/validate-checkout-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, userId: user.id })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          console.log('Subscription validated successfully:', data.subscriptionStatus);
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 5000);
        } else {
          console.error('Subscription validation failed:', data.error);
        }
      } catch (error) {
        console.error('Error validating checkout session:', error);
      }

      urlParams.delete('session_id');
      window.history.replaceState({}, document.title, `${location.pathname}`);
    };

    validateCheckoutSession();
  }, [location.search, user]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    const userMessage = {
      id: messages.length + 1,
      text: message,
      sender: 'user' as const,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setMessage('');

    setTimeout(() => {
      const botResponse = {
        id: messages.length + 2,
        text: "I'm currently running in fallback mode. The full AskStan chatbot service by Yvexan Agency will be available once the service is restored. In the meantime, I can provide basic assistance.",
        sender: 'bot' as const,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botResponse]);
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
          voice: { url: 'https://runtime-api.voiceflow.com' }
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
      const existingScript = document.querySelector('script[src="https://cdn.voiceflow.com/widget-next/bundle.mjs"]');
      if (existingScript) existingScript.remove();
      if ((window as any).voiceflow?.chat?.destroy) {
        (window as any).voiceflow.chat.destroy();
      }
    };
  }, [user]);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-amber-500 bg-clip-text text-transparent">
                AskStan
              </h1>
            </div>

            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center space-x-2 text-gray-700 hover:text-blue-600"
              >
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
                <span className="hidden sm:block">{profile?.email || 'Account'}</span>
              </button>

              {showDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  <Link to="/settings" className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    <Settings className="w-4 h-4 mr-3" />
                    Settings
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="w-4 h-4 mr-3" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {showSuccess && (
        <div className="bg-green-100 border border-green-200 text-green-800 px-4 py-2 text-sm text-center">
          Subscription activated successfully!
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome to AskStan{profile?.email ? `, ${profile.email.split('@')[0]}` : ''}
          </h2>
          <p className="text-gray-600">Your personal AI companion is ready to help. Start a conversation below.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 h-[600px] flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Chat with Stan</h3>
            <p className="text-sm text-gray-500">{chatbotLoaded ? 'Powered by Yvexan Agency' : 'Ask anything, get personalized answers instantly'}</p>
          </div>

          <div id="askstan-chat" className="flex-1 bg-gradient-to-br from-blue-50 to-amber-50 p-4 relative">
            {!chatbotLoaded && !chatbotError ? (
              <div className="h-full flex items-center justify-center">Loading AskStan chatbot...</div>
            ) : chatbotLoaded ? (
              <div id="askstan-chatbot" className="h-full"></div>
            ) : chatbotError ? (
              <div className="h-full flex flex-col">
                <div className="flex-1 overflow-y-auto mb-4 space-y-4">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${msg.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-white text-gray-800 border'}`}>
                        {msg.sender === 'bot' && (
                          <div className="flex items-center mb-1">
                            <MessageCircle className="w-4 h-4 mr-2 text-blue-600" />
                            <span className="text-xs font-medium text-blue-600">Stan</span>
                          </div>
                        )}
                        <p className="text-sm">{msg.text}</p>
                        <p className="text-xs opacity-70 mt-1">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleSendMessage} className="flex space-x-2">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                  />
                  <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg">
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
