import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOnboarding } from "@/contexts/OnboardingContext";

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
    <div className="flex flex-col items-center justify-center text-center w-full max-w-md mx-auto px-4">
      <motion.h1
        className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-4 sm:mb-6 text-white"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Confirm your age
      </motion.h1>
      <motion.p
        className="text-sm sm:text-base md:text-lg text-white/80 mb-6 sm:mb-8"
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
        className="mt-6 sm:mt-8"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        <Button onClick={handleNext} size="lg" disabled={!age} className="px-6 sm:px-8 bg-green-500 hover:bg-green-600 text-white border-0 disabled:bg-gray-500 disabled:text-gray-300">
          Continue
        </Button>
      </motion.div>
    </div>
  );
}
