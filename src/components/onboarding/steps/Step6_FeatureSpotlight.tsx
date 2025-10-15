import { motion } from "framer-motion";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { FeatureDemo } from "../FeatureDemo";

export function FeatureSpotlight() {
  const { nextStep } = useOnboarding();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="w-full"
    >
      <FeatureDemo onComplete={nextStep} />
    </motion.div>
  );
}
