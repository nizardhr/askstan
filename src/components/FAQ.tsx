import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const faqs = [
  {
    question: 'How does AskStan work?',
    answer: 'AskStan uses advanced AI technology to understand your questions and provide personalized, accurate responses. Simply type your question and get instant, intelligent answers tailored to your needs.',
  },
  {
    question: 'What makes AskStan different from other AI assistants?',
    answer: 'AskStan focuses on personalization, learning from your interactions to provide increasingly relevant responses. We prioritize privacy, speed, and accuracy in every conversation.',
  },
  {
    question: 'Is my data secure with AskStan?',
    answer: 'Absolutely. We use enterprise-grade encryption and follow strict privacy protocols. Your conversations are private and secure, and we never share your personal information.',
  },
  {
    question: 'Can I cancel my subscription anytime?',
    answer: 'Yes, you can cancel your subscription at any time. There are no long-term commitments, and you\'ll continue to have access until the end of your current billing period.',
  },
  {
    question: 'What kind of questions can I ask AskStan?',
    answer: 'You can ask AskStan almost anything! From general knowledge and advice to specific technical questions, creative writing help, and problem-solving assistance.',
  },
  {
    question: 'Is there a free trial available?',
    answer: 'We offer a 7-day free trial for new users. Experience all the features of AskStan risk-free and see how it can enhance your daily workflow.',
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