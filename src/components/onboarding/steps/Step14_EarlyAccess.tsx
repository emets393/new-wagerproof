import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/hooks/useOnboarding";

export function EarlyAccess() {
  const { nextStep } = useOnboarding();

  const handleFeatureRequest = () => {
    // In a real app, this would navigate to a feature request page or open a modal.
    console.log("Navigating to feature request page...");
    nextStep();
  };

  return (
    <div className="flex flex-col items-center justify-center text-center p-8 max-w-2xl mx-auto">
      <motion.h1
        className="text-5xl font-bold mb-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        You’re early—enjoy full access
      </motion.h1>
      <motion.p
        className="text-lg text-muted-foreground mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        You’re among the first users. Enjoy <strong>free full access</strong> during early access. Please share feedback anytime via the <strong>Feature Request</strong> page.
      </motion.p>
      <motion.div
        className="flex flex-col sm:flex-row gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Button onClick={handleFeatureRequest} size="lg" variant="outline">
          Open Feature Request
        </Button>
        <Button onClick={nextStep} size="lg">
          Continue
        </Button>
      </motion.div>
    </div>
  );
}
