import debug from '@/utils/debug';
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useNavigate } from "react-router-dom";

export function EarlyAccess() {
  const { submitOnboardingData } = useOnboarding();
  const navigate = useNavigate();

  const handleContinue = async () => {
    try {
      debug.log('Completing onboarding from EarlyAccess...');
      await submitOnboardingData();
      debug.log('Onboarding data submitted, navigating to app...');
      // Small delay to ensure database update completes
      setTimeout(() => {
        navigate("/wagerbot-chat");
      }, 500);
    } catch (error) {
      debug.error('Error completing onboarding:', error);
      // Still navigate even if there's an error
      navigate("/wagerbot-chat");
    }
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
       
        <Button onClick={handleContinue} size="lg" className="bg-green-500 hover:bg-green-600 text-white border-0">
          Continue to WagerProof
        </Button>
      </motion.div>
    </div>
  );
}
