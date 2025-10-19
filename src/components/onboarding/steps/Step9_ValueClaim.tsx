import debug from '@/utils/debug';
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/contexts/OnboardingContext";
import Lottie from "lottie-react";
import { useState, useEffect } from "react";

export function ValueClaim() {
  const { nextStep } = useOnboarding();
  const [animationData, setAnimationData] = useState(null);

  useEffect(() => {
    // Fetch the Lottie animation data
    fetch('/Statistics%20widget%20_%20Multi%20layout%20(9).json')
      .then(response => response.json())
      .then(data => setAnimationData(data))
      .catch(error => debug.error('Error loading animation:', error));
  }, []);

  return (
    <div className="flex flex-col items-center text-center max-w-1xl mx-auto px-4 pt-16 sm:pt-20">
      <motion.h1
        className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4 text-white"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Stop guessing.
      </motion.h1>
      <motion.p
        className="text-sm sm:text-base md:text-lg text-white/80 mb-6 sm:mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        Users report cutting research time and "wasting less on dumb bets." (their words not ours)
      </motion.p>
      
      
      {/* Statistics Widget Animation */}
      <motion.div
        className="w-full max-w-md mx-auto mb-6 sm:mb-8"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        {animationData ? (
          <Lottie
            animationData={animationData}
            loop={false}
            autoplay={true}
            style={{ width: '100%', height: '250px' }}
            className="sm:h-[300px]"
          />
        ) : (
          <div className="w-full h-[250px] sm:h-[300px] bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        )}
      </motion.div>
      
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.8 }}
      >
        <Button onClick={nextStep} size="lg" className="bg-green-500 hover:bg-green-600 text-white border-0">
          Continue
        </Button>
      </motion.div>
    </div>
  );
}
