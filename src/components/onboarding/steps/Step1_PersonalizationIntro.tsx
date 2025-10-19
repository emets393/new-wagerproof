import debug from '@/utils/debug';
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/contexts/OnboardingContext";

export function PersonalizationIntro() {
  const { nextStep } = useOnboarding();

  const handleContinue = () => {
    debug.log('Continue button clicked!');
    nextStep();
  };

  return (
    <div className="flex flex-col items-center justify-center text-center w-full">
      <motion.h1
        className="text-2xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6 text-white"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Welcome!
      </motion.h1>
      
      <motion.h1
        className="text-xl sm:text-2xl md:text-5xl font-bold mb-4 sm:mb-6 text-white"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Let's personalize your experience.
      </motion.h1>
      <motion.p
        className="text-sm sm:text-base md:text-lg text-white/80 mb-6 sm:mb-8 max-w-full sm:max-w-lg px-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        Answer a few quick questions so we can tune your dashboard and picks.
      </motion.p>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Button onClick={handleContinue} size="lg" className="px-8 bg-green-500 hover:bg-green-600 text-white border-0">
          Continue
        </Button>
      </motion.div>
    </div>
  );
}
