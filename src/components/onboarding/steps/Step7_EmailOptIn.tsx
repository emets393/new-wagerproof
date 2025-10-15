import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useAuth } from "@/contexts/AuthContext";

export function EmailOptIn() {
  const { nextStep, updateOnboardingData } = useOnboarding();
  const { user } = useAuth();
  const [optIn, setOptIn] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");

  const handleNext = () => {
    updateOnboardingData({ 
      emailOptIn: optIn, 
      phoneNumber: optIn ? phoneNumber : undefined 
    });
    nextStep();
  };

  return (
    <div className="flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto">
      <motion.h1
        className="text-5xl font-bold mb-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Want picks in your inbox?
      </motion.h1>
      <motion.p
        className="text-lg text-muted-foreground mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        Get daily model summaries, edge alerts, and pre-game updates.
      </motion.p>
      
      <motion.div 
        className="flex items-center space-x-2 mb-4"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Checkbox id="opt-in" checked={optIn} onCheckedChange={(checked) => setOptIn(!!checked)} />
        <Label htmlFor="opt-in" className="text-lg">Yes, sign me up!</Label>
      </motion.div>
      
      <motion.div 
        className="w-full space-y-4"
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: optIn ? 'auto' : 0, opacity: optIn ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      >
        <Input
          type="email"
          value={user?.email || ""}
          disabled
          className="text-center"
        />
        <Input
          type="tel"
          placeholder="Enter phone number (optional)"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          className="text-center"
        />
      </motion.div>

      <motion.div
        className="mt-8"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        <Button onClick={handleNext} size="lg">
          Next
        </Button>
      </motion.div>
    </div>
  );
}
