import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOnboarding } from "@/hooks/useOnboarding";

export function AgeConfirmation() {
  const { nextStep, updateOnboardingData } = useOnboarding();
  const [age, setAge] = useState<number | undefined>();
  const [error, setError] = useState<string | null>(null);

  const handleNext = () => {
    if (age && age >= 18) {
      updateOnboardingData({ age });
      nextStep();
    } else {
      setError("You must be 18 or older to continue.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center text-center w-full max-w-md mx-auto">
      <motion.h1
        className="text-3xl md:text-4xl font-bold mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Confirm your age
      </motion.h1>
      <motion.p
        className="text-lg text-muted-foreground mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        WagerProof provides analytics for educational use only. You must be 18+ to continue.
      </motion.p>
      <motion.div
        className="w-full"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Input
          type="number"
          placeholder="Enter your age"
          value={age || ""}
          onChange={(e) => {
            setAge(parseInt(e.target.value, 10));
            setError(null);
          }}
          className="text-center text-lg h-12"
        />
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </motion.div>
      <motion.div
        className="mt-8"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        <Button onClick={handleNext} size="lg" disabled={!age} className="px-8">
          Continue
        </Button>
      </motion.div>
    </div>
  );
}
