import React, { useState } from 'react';
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import debug from '@/utils/debug';

const Paywall: React.FC = () => {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly' | null>(null);

  const plans = [
    {
      id: 'monthly',
      name: 'Monthly',
      price: '$40',
      frequency: '/mo',
      link: 'https://buy.stripe.com/test_00wbJ00GG6jD7OEgMM4Rq01',
      description: 'Billed monthly',
      features: [
        'Everything in Season Pass!',
      ],
    },
    {
      id: 'yearly',
      name: 'Season Pass',
      price: '$199',
      frequency: '/yr',
      link: 'https://buy.stripe.com/test_7sYbJ0fBA4bv9WM7cc4Rq02',
      description: 'Best value',
      features: [
        'Access to all picks',
        'All Sports',
        'Advanced analytics',
        'Mobile app access',
        'Discord community',
        'Auto-pick notifications',
        'AI with live model data',
      ],
    },
  ];

  const competitorCard = {
    id: 'competitors',
    name: 'Our Competitors',
    details: [
      'Charge $80+ per week',
      'Only picks and/or lists',
      'No transparency on picks',
      'No mobile app',
      'No auto-pick notifications',
      'No AI with live data',
    ],
  };

  const handleSelectPlan = (planId: 'monthly' | 'yearly') => {
    setSelectedPlan(planId);
  };

  const handleJoinWagerProof = () => {
    if (selectedPlan) {
      const link = selectedPlan === 'monthly' ? plans[0].link : plans[1].link;
      debug.log('Opening Stripe checkout for:', selectedPlan);
      window.open(link, '_blank');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center text-center p-4 sm:p-6 md:p-8 max-w-5xl mx-auto">
      <motion.h1
        className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-6 sm:mb-8 text-white"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Choose Your Plan
      </motion.h1>

      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6 w-full mb-8 sm:mb-12"
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
      >
        {plans.map(({ id, name, price, frequency, link, description }) => (
          <motion.div
            key={id}
            variants={{
              hidden: { opacity: 0, scale: 0.95 },
              visible: { opacity: 1, scale: 1 },
            }}
          >
            <Card
              onClick={() => handleSelectPlan(id as 'monthly' | 'yearly')}
              className={cn(
                "cursor-pointer transition-all duration-200 hover:scale-105 bg-white/10 backdrop-blur-sm border-white/20 hover:bg-white/20 h-full relative",
                selectedPlan === id
                  ? "border-green-400 ring-2 ring-green-400 bg-green-400/20"
                  : "border-white/20"
              )}
            >
              {id === 'yearly' && (
                <div className="absolute top-0 right-0 bg-green-500 text-white px-3 py-1 rounded-tr-lg rounded-bl-lg text-xs sm:text-sm font-semibold">
                  Best Value
                </div>
              )}
              {id === 'monthly' && (
                <div className="absolute top-0 right-0 bg-blue-500 text-white px-3 py-1 rounded-tr-lg rounded-bl-lg text-xs sm:text-sm font-semibold">
                  Most Flexible
                </div>
              )}
              <CardContent className="p-6 sm:p-8 flex flex-col items-start justify-start h-full">
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-2 w-full text-center">{name}</h3>
                <p className="text-3xl sm:text-4xl font-bold text-white mb-1 w-full text-center">
                  {id === 'yearly' ? '$16.58' : price}<span className="text-sm sm:text-base font-normal">{id === 'yearly' ? '/mo' : frequency}</span>
                </p>
                <p className="text-xs sm:text-sm text-white/70 mb-4 w-full text-center">{id === 'yearly' ? 'Billed yearly ($199)' : description}</p>
                <ul className="space-y-2 w-full">
                  {plans.find(p => p.id === id)?.features.map((feature, index) => (
                    <li key={index} className="flex items-start">
                      <svg className="w-4 h-4 text-green-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                      <span className="text-xs sm:text-sm text-white/80">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </motion.div>
        ))}

        {/* Competitor Card */}
        <motion.div
          variants={{
            hidden: { opacity: 0, scale: 0.95 },
            visible: { opacity: 1, scale: 1 },
          }}
        >
          <Card className="bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/5 transition-all duration-200 opacity-60 h-full">
            <CardContent className="p-6 sm:p-8 flex flex-col items-center justify-start">
              <h3 className="text-lg sm:text-xl font-semibold text-white/70 mb-4">{competitorCard.name}</h3>
              <ul className="space-y-2 text-left w-full">
                {competitorCard.details.map((detail, index) => (
                  <li key={index} className="flex items-start">
                    <svg className="w-4 h-4 text-red-400 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                    <span className="text-xs sm:text-sm text-white/60">{detail}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      <motion.div
        className="flex gap-4 flex-wrap justify-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <Button
          onClick={handleJoinWagerProof}
          size="lg"
          disabled={!selectedPlan}
          className="bg-green-500 hover:bg-green-600 text-white border-0 disabled:bg-gray-500 disabled:text-gray-300 disabled:cursor-not-allowed"
        >
          Go to Checkout
        </Button>
      </motion.div>
    </div>
  );
};

export default Paywall;
