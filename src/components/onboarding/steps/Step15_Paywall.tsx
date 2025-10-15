import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useNavigate } from "react-router-dom";

export function Paywall() {
  const { submitOnboardingData } = useOnboarding();
  const navigate = useNavigate();

  const handleContinue = () => {
    submitOnboardingData();
    navigate("/home"); // or wherever the main app dashboard is
  };

  const handleSeePlans = () => {
    // In a real app, this would navigate to the pricing/subscription page.
    console.log("Navigating to plans page...");
    handleContinue(); // For now, just continue to the site.
  };

  return (
    <div className="flex flex-col items-center justify-center text-center p-8 max-w-2xl mx-auto">
      <motion.h1
        className="text-5xl font-bold mb-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Free for you—enter now
      </motion.h1>
      <motion.p
        className="text-lg text-muted-foreground mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        Early access applies to your account. Upgrade anytime for upcoming sports and advanced dashboards.
      </motion.p>
      <motion.div
        className="flex flex-col sm:flex-row gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Button onClick={handleSeePlans} size="lg" variant="outline">
          See Plans
        </Button>
        <Button onClick={handleContinue} size="lg">
          Continue to Site (Free)
        </Button>
      </motion.div>
    </div>
  );
}
