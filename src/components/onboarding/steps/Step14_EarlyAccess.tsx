import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/contexts/OnboardingContext";

export function EarlyAccess() {
  const { nextStep } = useOnboarding();

  const handleFeatureRequest = () => {
    // In a real app, this would navigate to a feature request page or open a modal.
    console.log("Navigating to feature request page...");
    nextStep();
  };

  return (
    <div className="flex flex-col items-center justify-center text-center p-4 sm:p-6 md:p-8 max-w-2xl mx-auto">
      <motion.h1
        className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4 text-white"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        You're early—enjoy full access
      </motion.h1>
      <motion.p
        className="text-sm sm:text-base md:text-lg text-white/80 mb-6 sm:mb-8 px-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        You're among the first users. Enjoy <strong className="text-white">free full access</strong> during early access. Please share feedback anytime via the <strong className="text-white">Feature Request</strong> page.
      </motion.p>
      <motion.div
        className="flex flex-col sm:flex-row gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
       
        <Button onClick={nextStep} size="lg" className="bg-green-500 hover:bg-green-600 text-white border-0">
          Continue
        </Button>
      </motion.div>
    </div>
  );
}
