import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useInViewAnimation } from '@/hooks/useInViewAnimation';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQProps {
  questions?: FAQItem[];
}

const defaultQuestions: FAQItem[] = [
  {
    question: "What is WagerProof?",
    answer: "WagerProof is a data-driven sports betting analytics platform that provides professional-grade predictions, insights, and advanced analytics tools for NFL, College Football, NBA, and other major sports. We use real data and sophisticated models to help users make informed betting decisions."
  },
  {
    question: "How accurate are WagerProof's predictions?",
    answer: "Our predictions are powered by advanced statistical models and real-time data analysis. While no prediction system can guarantee 100% accuracy, our models are continuously refined to provide the most reliable insights possible based on historical patterns, team performance, and betting market trends."
  },
  {
    question: "What sports does WagerProof cover?",
    answer: "WagerProof currently covers NFL, College Football, NBA, and other major sports. We provide comprehensive analytics, predictions, and betting insights for each sport with dedicated tools and models."
  },
  {
    question: "Do I need to be an expert to use WagerProof?",
    answer: "No! WagerProof is designed for both beginners and experienced bettors. Our platform provides easy-to-understand insights and recommendations, while also offering advanced analytics tools for those who want to dive deeper into the data."
  },
  {
    question: "Do you have data on Player Props?",
    answer: "No. Player Props are currently not covered by WagerProof. We focus on the highest probability bets that have the best value, not the lowest probability bets that have the best payouts."
  },
  {
    question: "Is WagerProof a gambling site?",
    answer: "No, WagerProof is not a gambling operator or bookmaker. We provide analytical tools, predictions, and insights to help you make informed decisions. You are responsible for your own betting decisions and compliance with local gambling laws."
  },
  {
    question: "Can I cancel my subscription anytime?",
    answer: "Yes, you can cancel your subscription at any time with no penalties or fees. Your access will continue until the end of your current billing period."
  },
  {
    question: "How do I get started?",
    answer: "Simply sign up for a free account to explore our platform. You can upgrade to a paid subscription at any time to access advanced features, unlimited predictions, and priority support."
  }
];

const FAQ: React.FC<FAQProps> = ({ questions = defaultQuestions }) => {
  const [sectionRef, inView] = useInViewAnimation<HTMLDivElement>();

  return (
    <section
      ref={sectionRef}
      className={`py-16 bg-transparent transition-opacity duration-700 ${
        inView ? "opacity-100 animate-fade-in" : "opacity-0"
      }`}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className={`text-center max-w-3xl mx-auto mb-12 transition-all duration-700 ${
            inView ? "animate-fade-in" : "opacity-0 translate-y-10"
          }`}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Everything you need to know about WagerProof
          </p>
        </div>

        <div
          className={`max-w-3xl mx-auto transition-all duration-700 ${
            inView ? "animate-fade-in" : "opacity-0 translate-y-10"
          }`}
        >
          <Accordion type="single" collapsible className="w-full space-y-4">
            {questions.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <AccordionTrigger className="text-left hover:no-underline py-5">
                  <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {faq.question}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-5">
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                    {faq.answer}
                  </p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <div
          className={`text-center mt-12 transition-all duration-700 ${
            inView ? "animate-fade-in" : "opacity-0 translate-y-10"
          }`}
        >
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Still have questions?
          </p>
          <a
            href="mailto:support@wagerproof.bet"
            className="text-[#4f9777] hover:text-[#3d7a5e] dark:text-[#6bb491] dark:hover:text-[#4f9777] font-medium transition-colors"
          >
            Contact our support team →
          </a>
        </div>
      </div>
    </section>
  );
};

export default FAQ;

