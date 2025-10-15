import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useOnboarding } from "@/hooks/useOnboarding";
import { cn } from "@/lib/utils";

const goals = [
  "Find profitable edges faster",
  "Analyze data to improve strategy",
  "Track my performance over time",
  "Get timely alerts for model picks",
];

export function PrimaryGoalSelection() {
  const { nextStep, updateOnboardingData } = useOnboarding();
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);

  const handleSelect = (goal: string) => {
    setSelectedGoal(goal);
  };

  const handleNext = () => {
    if (selectedGoal) {
      updateOnboardingData({ mainGoal: selectedGoal });
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
        What’s your main goal?
      </motion.h1>
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full"
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
      >
        {goals.map((goal) => (
          <motion.div
            key={goal}
            variants={{
              hidden: { opacity: 0, scale: 0.95 },
              visible: { opacity: 1, scale: 1 },
            }}
          >
            <Card
              onClick={() => handleSelect(goal)}
              className={cn(
                "cursor-pointer transition-all duration-200 hover:scale-105 h-full",
                selectedGoal === goal
                  ? "border-honeydew-500 ring-2 ring-honeydew-500"
                  : "border-border"
              )}
            >
              <CardContent className="p-6 flex items-center justify-center">
                <h3 className="text-xl font-semibold">{goal}</h3>
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
        <Button onClick={handleNext} size="lg" disabled={!selectedGoal}>
          Next
        </Button>
      </motion.div>
    </div>
  );
}
