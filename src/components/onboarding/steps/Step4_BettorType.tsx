import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { cn } from "@/lib/utils";

type BettorType = "casual" | "serious" | "professional";

const bettorTypes: { type: BettorType; title: string; description: string }[] = [
  { type: "casual", title: "Casual", description: "Occasional bets" },
  { type: "serious", title: "Serious", description: "Research lines and trends" },
  { type: "professional", title: "Professional", description: "Track units and ROI" },
];

export function BettorTypeSelection() {
  const { nextStep, updateOnboardingData } = useOnboarding();
  const [selectedType, setSelectedType] = useState<BettorType | null>(null);

  const handleSelect = (type: BettorType) => {
    setSelectedType(type);
  };

  const handleNext = () => {
    if (selectedType) {
      updateOnboardingData({ bettorType: selectedType });
      nextStep();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center text-center p-8 max-w-2xl mx-auto">
      <motion.h1
        className="text-5xl font-bold mb-8 text-white"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        What kind of bettor are you?
      </motion.h1>
      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full"
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
      >
        {bettorTypes.map(({ type, title, description }) => (
          <motion.div
            key={type}
            variants={{
              hidden: { opacity: 0, scale: 0.95 },
              visible: { opacity: 1, scale: 1 },
            }}
          >
            <Card
              onClick={() => handleSelect(type)}
              className={cn(
                "cursor-pointer transition-all duration-200 hover:scale-105 bg-white/10 backdrop-blur-sm border-white/20 hover:bg-white/20",
                selectedType === type
                  ? "border-green-400 ring-2 ring-green-400 bg-green-400/20"
                  : "border-white/20"
              )}
            >
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold text-white">{title}</h3>
                <p className="text-white/70 mt-2">{description}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>
      <motion.div
        className="mt-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
      >
        <Button onClick={handleNext} size="lg" disabled={!selectedType} className="bg-green-500 hover:bg-green-600 text-white border-0 disabled:bg-gray-500 disabled:text-gray-300">
          Next
        </Button>
      </motion.div>
    </div>
  );
}
