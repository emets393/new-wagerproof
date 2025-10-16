import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { cn } from "@/lib/utils";

const sources = [
  "TikTok",
  "X/Twitter",
  "YouTube",
  "Google",
  "Friend/Referral",
  "Other",
];

export function AcquisitionSource() {
  const { nextStep, updateOnboardingData } = useOnboarding();
  const [selectedSource, setSelectedSource] = useState<string | null>(null);

  const handleSelect = (source: string) => {
    setSelectedSource(source);
  };

  const handleNext = () => {
    if (selectedSource) {
      updateOnboardingData({ acquisitionSource: selectedSource });
      nextStep();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center text-center p-4 sm:p-6 md:p-8 max-w-2xl mx-auto">
      <motion.h1
        className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-6 sm:mb-8 text-white"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Where did you hear about us?
      </motion.h1>
      <motion.div
        className="flex flex-wrap justify-center gap-2 sm:gap-3 md:gap-4 w-full px-2"
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
      >
        {sources.map((source) => (
          <motion.div
            key={source}
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 },
            }}
          >
            <Button
              variant="outline"
              size="lg"
              onClick={() => handleSelect(source)}
              className={cn(
                "transition-all duration-200 bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white",
                selectedSource === source && "bg-green-400 border-green-400 text-black hover:bg-green-400 hover:text-black"
              )}
            >
              {source}
            </Button>
          </motion.div>
        ))}
      </motion.div>
      <motion.div
        className="mt-8 sm:mt-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <Button onClick={handleNext} size="lg" disabled={!selectedSource} className="bg-green-500 hover:bg-green-600 text-white border-0 disabled:bg-gray-500 disabled:text-gray-300">
          Continue
        </Button>
      </motion.div>
    </div>
  );
}
