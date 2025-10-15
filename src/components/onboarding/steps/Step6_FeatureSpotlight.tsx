import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/hooks/useOnboarding";
import { GradientText } from "@/components/ui/gradient-text";

export function FeatureSpotlight() {
  const { nextStep } = useOnboarding();

  return (
    <div className="flex flex-col items-center justify-center text-center p-8 max-w-2xl mx-auto">
      <motion.h1
        className="text-5xl font-bold mb-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Tools built for your goals
      </motion.h1>
      <motion.p
        className="text-lg text-muted-foreground mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        Use <GradientText text="Edge Finder" className="font-semibold" /> to spot model vs. market discrepancies. Use <GradientText text="AI Game Simulator" className="font-semibold" /> for matchup outcomes and probabilities.
      </motion.p>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Button onClick={nextStep} size="lg">
          Continue
        </Button>
      </motion.div>
    </div>
  );
}
