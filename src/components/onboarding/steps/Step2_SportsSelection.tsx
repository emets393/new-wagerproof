import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { cn } from "@/lib/utils";

const sportsOptions = [
  "NFL",
  "College Football",
  "NBA",
  "MLB",
  "NCAAB",
  "Soccer",
  "Other",
];

export function SportsSelection() {
  const { nextStep, updateOnboardingData } = useOnboarding();
  const [selectedSports, setSelectedSports] = useState<string[]>([]);

  const handleToggleSport = (sport: string) => {
    setSelectedSports((prev) =>
      prev.includes(sport)
        ? prev.filter((s) => s !== sport)
        : [...prev, sport]
    );
  };

  const handleNext = () => {
    updateOnboardingData({ favoriteSports: selectedSports });
    nextStep();
  };

  return (
    <div className="flex flex-col items-center justify-center text-center w-full">
      <motion.h1
        className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-4 sm:mb-6 text-white"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Which sports do you follow most?
      </motion.h1>
      <motion.div
        className="flex flex-wrap justify-center gap-2 sm:gap-3 my-4 sm:my-6 max-w-2xl px-2"
        initial="hidden"
        animate="visible"
        variants={{
          visible: { transition: { staggerChildren: 0.05 } },
        }}
      >
        {sportsOptions.map((sport) => (
          <motion.div
            key={sport}
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 },
            }}
          >
            <Button
              variant="outline"
              size="default"
              onClick={() => handleToggleSport(sport)}
              className={cn(
                "transition-all duration-200 bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white",
                selectedSports.includes(sport) && "bg-green-400 border-green-400 text-black hover:bg-green-400 hover:text-black"
              )}
            >
              {sport}
            </Button>
          </motion.div>
        ))}
      </motion.div>
      <motion.p
        className="text-xs sm:text-sm text-white/70 mb-4 sm:mb-6 px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        You can change this later in Settings.
      </motion.p>
      <motion.div
        className="flex gap-4"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
    
        <Button onClick={handleNext} size="lg" className="px-8 bg-green-500 hover:bg-green-600 text-white border-0">
          Next
        </Button>
      </motion.div>
    </div>
  );
}
