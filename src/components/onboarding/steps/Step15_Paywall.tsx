import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useNavigate } from "react-router-dom";

export function Paywall() {
  const { submitOnboardingData } = useOnboarding();
  const navigate = useNavigate();

  const handleContinue = () => {
    submitOnboardingData();
    navigate("/wagerbot-chat"); // Navigate to WagerBot chat page where all logged in users go
  };

  const handleSeePlans = () => {
    // In a real app, this would navigate to the pricing/subscription page.
    console.log("Navigating to plans page...");
    handleContinue(); // For now, just continue to the site.
  };

  return (
    <div className="flex flex-col items-center justify-center text-center p-8 max-w-2xl mx-auto">
      <motion.h1
        className="text-5xl font-bold mb-4 text-white"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Free for you—enter now
      </motion.h1>
      <motion.p
        className="text-lg text-white/80 mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        Early access applies to your account. Enjoy WagerProof and share with a friend!
      </motion.p>
      <motion.div
        className="flex flex-col sm:flex-row gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
       
        <Button onClick={handleContinue} size="lg" className="bg-green-500 hover:bg-green-600 text-white border-0">
          Continue to Site (Free)
        </Button>
      </motion.div>
    </div>
  );
}
