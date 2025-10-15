import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/hooks/useOnboarding";
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
        className="text-3xl md:text-4xl font-bold mb-6"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Which sports do you follow most?
      </motion.h1>
      <motion.div
        className="flex flex-wrap justify-center gap-3 my-6 max-w-2xl"
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
                "transition-all duration-200",
                selectedSports.includes(sport) && "bg-honeydew-500 text-white border-honeydew-500"
              )}
            >
              {sport}
            </Button>
          </motion.div>
        ))}
      </motion.div>
      <motion.p
        className="text-sm text-muted-foreground mb-6"
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
        <Button onClick={nextStep} variant="ghost">
          Skip
        </Button>
        <Button onClick={handleNext} size="lg" className="px-8">
          Next
        </Button>
      </motion.div>
    </div>
  );
}
