import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const faqs = [
  {
    question: 'How does AskStan help me grow on social media?',
    answer: 'AskStan is your real-time social media growth coach, specifically designed to help you build a dynamic and profitable social media business. We provide personalized strategies for LinkedIn, X (Twitter), Instagram, Threads, and other platforms, focusing on daily posting and engagement as your growth engine.',
  },
  {
    question: 'What social media platforms does AskStan support?',
    answer: 'AskStan specializes in LinkedIn, X (Twitter), Instagram, Threads, and other major social platforms. We provide platform-specific strategies, content ideas, engagement tactics, and growth hacks tailored to each platform\'s unique algorithm and audience behavior.',
  },
  {
    question: 'How quickly can I see results with AskStan?',
    answer: 'Many users see engagement improvements within the first week of implementing AskStan\'s daily posting and engagement strategies. Our AI coach provides real-time feedback and adjustments to optimize your content performance and audience growth continuously.',
  },
  {
    question: 'What kind of content strategies does AskStan provide?',
    answer: 'AskStan helps you create viral-worthy content, optimize posting times, craft engaging captions, develop your personal brand voice, and build authentic engagement. We focus on turning your social media presence into a profitable business through strategic daily actions.',
  },
  {
    question: 'Can AskStan help me monetize my social media following?',
    answer: 'Absolutely! AskStan provides strategies for turning your social media presence into revenue streams through content monetization, brand partnerships, product launches, and audience building techniques that convert followers into customers.',
  },
  {
    question: 'Do you offer different pricing plans?',
    answer: 'Yes! We offer flexible monthly and yearly plans to fit your growth journey. Start with our monthly plan at $4.99/month, or save with our yearly plan at $49.99/year. Cancel anytime with no long-term commitments.',
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