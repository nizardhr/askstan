import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const faqs = [
  {
    question: 'How does AskStan help me dominate social media and build a profitable business?',
    answer: 'AskStan is your personal AI-powered social media growth coach, specifically engineered to help you build a dynamic and profitable social media empire. We provide real-time, personalized strategies for LinkedIn, X (Twitter), Instagram, Threads, and other platforms. Our focus is on daily posting and strategic engagement as your primary growth engine - turning your social presence into a revenue-generating machine.',
  },
  {
    question: 'Which social media platforms can AskStan help me conquer?',
    answer: 'AskStan is your expert coach for LinkedIn, X (Twitter), Instagram, Threads, TikTok, and all major social platforms. We provide platform-specific growth strategies, viral content ideas, engagement tactics, and algorithm-beating techniques tailored to each platform\'s unique ecosystem. Whether you\'re building professional authority on LinkedIn or going viral on TikTok, AskStan has the strategies you need.',
  },
  {
    question: 'How fast will I see explosive growth with AskStan?',
    answer: 'Most users experience significant engagement boosts within their first week of implementing AskStan\'s proven daily posting and engagement strategies. Our real-time AI coach continuously analyzes your performance, providing instant feedback and strategic adjustments to maximize your reach, engagement, and follower growth. The key is consistency - AskStan keeps you accountable and strategic every single day.',
  },
  {
    question: 'What content strategies will make me stand out and go viral?',
    answer: 'AskStan provides battle-tested strategies for creating viral-worthy content, optimizing posting times for maximum reach, crafting irresistible captions that drive engagement, developing your unique personal brand voice, and building authentic community engagement. We focus on transforming your social media presence into a profit-generating business through strategic daily actions that compound over time.',
  },
  {
    question: 'Can AskStan help me turn my followers into serious money?',
    answer: 'Absolutely! AskStan specializes in monetization strategies that convert your growing audience into multiple revenue streams. We guide you through content monetization, securing lucrative brand partnerships, launching your own products/services, building email lists that sell, and implementing conversion tactics that turn casual followers into paying customers. Your social media becomes your most powerful business asset.',
  },
  {
    question: 'What investment do I need to unlock this growth potential?',
    answer: 'We offer two powerful plans designed for serious growth: Monthly Pro at $4.99/month for immediate access, or Yearly Pro at $49.99/year (saving you $10). Both plans give you unlimited access to AskStan\'s growth coaching, real-time strategy sessions, and profit-building techniques. Cancel anytime - but once you see the results, you won\'t want to stop growing.',
  },
];

const FAQ: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="py-20 bg-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-xl text-gray-600">
            Everything you need to know about AskStan
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="bg-white border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-300"
            >
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full flex items-center justify-between p-6 text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset rounded-2xl"
              >
                <span className="text-lg font-semibold text-gray-900">
                  {faq.question}
                </span>
                {openIndex === index ? (
                  <ChevronUp className="w-5 h-5 text-blue-600 flex-shrink-0 ml-4" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0 ml-4" />
                )}
              </button>
              {openIndex === index && (
                <div className="px-6 pb-6">
                  <p className="text-gray-600 leading-relaxed">
                    {faq.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <p className="text-gray-600 mb-4">
            Still have questions?
          </p>
          <a
            href="mailto:support@askstan.com"
            className="text-blue-600 hover:text-blue-700 font-semibold transition-colors duration-200"
          >
            Contact our support team
          </a>
        </div>
      </div>
    </section>
  );
};

export default FAQ;