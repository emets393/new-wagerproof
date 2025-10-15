import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/hooks/useOnboarding";
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
    <div className="flex flex-col items-center justify-center text-center p-8 max-w-2xl mx-auto">
      <motion.h1
        className="text-5xl font-bold mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Where did you hear about us?
      </motion.h1>
      <motion.div
        className="flex flex-wrap justify-center gap-4 w-full"
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
                "transition-all duration-200",
                selectedSource === source && "bg-honeydew-500 text-white"
              )}
            >
              {source}
            </Button>
          </motion.div>
        ))}
      </motion.div>
      <motion.div
        className="mt-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <Button onClick={handleNext} size="lg" disabled={!selectedSource}>
          Continue
        </Button>
      </motion.div>
    </div>
  );
}
