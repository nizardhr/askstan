import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, User, Settings, Send, MessageCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const Dashboard: React.FC = () => {
  const { signOut, user, profile } = useAuth();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [scriptError, setScriptError] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([
    { id: 1, text: "Hello! I'm Stan, your AI assistant. How can I help you today?", sender: 'bot', timestamp: new Date() }
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

    // Add user message
    const userMessage = {
      id: messages.length + 1,
      text: message,
      sender: 'user' as const,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setMessage('');

    // Add bot response after a short delay
    setTimeout(() => {
      const botResponse = {
        id: messages.length + 2,
        text: "I'm currently running in fallback mode. The full AskStan chatbot service will be available once the external service is restored. In the meantime, I can provide basic assistance.",
        sender: 'bot' as const,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botResponse]);
    }, 1000);
  };
  useEffect(() => {
    // Load external chatbot embed script
    console.log('Loading chatbot embed script for ID: fc3ec544-4f73-4a5d-94b9-356b6a953d2e');
    console.log('Full embed URL: https://yvexanchatbots.netlify.app/embed/fc3ec544-4f73-4a5d-94b9-356b6a953d2e.js');
    
    const script = document.createElement('script');
    script.src = 'https://yvexanchatbots.netlify.app/embed/fc3ec544-4f73-4a5d-94b9-356b6a953d2e.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    
    script.onload = function() {
      console.log('Chatbot embed script loaded successfully');
      setScriptLoaded(true);
      setScriptError(false);
    };
    
    script.onerror = function(error) {
      console.error('Failed to load chatbot embed script:', error);
      console.log('Script URL:', script.src);
      setScriptError(true);
      setScriptLoaded(false);
    };
    
    document.head.appendChild(script);

    // Cleanup function to remove script when component unmounts
    return () => {
      const existingScript = document.querySelector(`script[src="${script.src}"]`);
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
    };
  }, []);
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
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
                className="flex items-center space-x-2 text-gray-700 hover:text-blue-600 transition-colors duration-200"
              >
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-600" />
                </div>
                <span className="hidden sm:block">{profile?.email || 'Account'}</span>
              </button>

              {showDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  <Link 
                    to="/settings" 
                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
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

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome to AskStan{profile?.email ? `, ${profile.email.split('@')[0]}` : ''}
          </h2>
          <p className="text-gray-600">
            Your personal AI companion is ready to help. Start a conversation below.
          </p>
        </div>

        {/* Chat Container */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 h-[600px] flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Chat with Stan</h3>
            <p className="text-sm text-gray-500">Ask anything, get personalized answers instantly</p>
          </div>

          {/* Chatbot Container - This is where the external embed will be injected */}
          <div 
            id="askstan-chatbot-container"
            className="flex-1 bg-gradient-to-br from-blue-50 to-amber-50 p-4"
          >
            {!scriptLoaded && !scriptError ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading AskStan chatbot...</p>
                  <p className="text-sm text-gray-500 mt-2">Connecting to chatbot service...</p>
                </div>
              </div>
            ) : scriptLoaded ? (
              <div id="askstan-chatbot" className="h-full">
                {/* External chatbot will be injected here */}
              </div>
            ) : (
              <div className="h-full flex flex-col">
                {/* Fallback Chat Interface */}
                <div className="flex-1 overflow-y-auto mb-4 space-y-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          msg.sender === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-white text-gray-800 shadow-sm border'
                        }`}
                      >
                        {msg.sender === 'bot' && (
                          <div className="flex items-center mb-1">
                            <MessageCircle className="w-4 h-4 mr-2 text-blue-600" />
                            <span className="text-xs font-medium text-blue-600">Stan</span>
                          </div>
                        )}
                        <p className="text-sm">{msg.text}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Message Input */}
                <form onSubmit={handleSendMessage} className="flex space-x-2">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>

                {/* Service Status Notice */}
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-amber-500 rounded-full mr-2"></div>
                    <p className="text-sm text-amber-800">
                      <strong>Fallback Mode:</strong> External chatbot service temporarily unavailable. 
                      <button 
                        onClick={() => window.location.reload()} 
                        className="ml-2 text-blue-600 hover:text-blue-800 underline"
                      >
                        Retry Connection
                      </button>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-2">Quick Questions</h4>
            <p className="text-sm text-gray-600">Get instant answers to common questions</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-2">Personalized Help</h4>
            <p className="text-sm text-gray-600">Tailored assistance based on your needs</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-2">24/7 Availability</h4>
            <p className="text-sm text-gray-600">Stan is always here when you need help</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;