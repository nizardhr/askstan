import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LogOut, User, Settings, Send, MessageCircle, CheckCircle, Loader, AlertTriangle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const Dashboard: React.FC = () => {
  const { signOut, user, profile, subscription } = useAuth();
  const navigate = useNavigate();

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-amber-50">
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
            {subscription && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  <strong>Subscription Status:</strong> {subscription.status} 
                  {subscription.plan_type && ` (${subscription.plan_type})`}
                </p>
              </div>
            )}
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