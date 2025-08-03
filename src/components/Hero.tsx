import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';

const Hero: React.FC = () => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-amber-50">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100/20 via-transparent to-amber-100/20"></div>
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <div className="text-center">
          <div className="inline-flex items-center bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium mb-8">
            <Sparkles className="w-4 h-4 mr-2" />
            Introducing Your Personal AI Companion
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Meet{' '}
            <span className="bg-gradient-to-r from-blue-600 to-amber-500 bg-clip-text text-transparent">
              AskStan
            </span>
            {' '}–<br />
            Your Personal AI Companion
          </h1>

          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
            Subscribe. Ask. Get personalized answers in seconds.
            <br />
            Experience the future of AI assistance with instant, intelligent responses tailored just for you.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link
              to="/auth"
              className="group bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-4 rounded-full font-semibold text-lg hover:from-blue-700 hover:to-blue-800 transform hover:scale-105 transition-all duration-200 shadow-xl flex items-center justify-center"
            >
              Get Started
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform duration-200" />
            </Link>
            <button 
              onClick={() => {
                document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-full font-semibold text-lg hover:border-blue-300 hover:text-blue-600 transition-all duration-200"
            >
              Learn More
            </button>
          </div>

          {/* Hero Image Placeholder */}
          <div className="relative max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-8">
              <div className="bg-gradient-to-br from-blue-50 to-amber-50 rounded-xl h-64 sm:h-80 flex items-center justify-center relative overflow-hidden">
                {/* Stan's Photo */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <img 
                    src="https://via.placeholder.com/300x300/3B82F6/FFFFFF?text=Stan" 
                    alt="Stan - Your AI Social Media Growth Coach"
                    className="w-48 h-48 object-cover rounded-full border-4 border-white shadow-xl hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      // Fallback if image fails to load
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                      if (fallback) fallback.style.display = 'block';
                    }}
                  />
                  <div className="hidden text-center">
                    <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-amber-500 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
                        <Sparkles className="w-6 h-6 text-blue-600" />
                      </div>
                    </div>
                    <p className="text-gray-600 font-medium">
                      Stan - Your AI Growth Coach
                    </p>
                  </div>
                </div>
                <div className="text-center mt-4">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Meet Stan</h3>
                  <p className="text-gray-600">Your AI Social Media Growth Coach by Yvexan Agency</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;