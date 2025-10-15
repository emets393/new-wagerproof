import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/hooks/useOnboarding";

export function SocialProof() {
  const { nextStep } = useOnboarding();

  const handleJoinCommunity = () => {
    // In a real app, this would navigate to a community page/Discord/etc.
    console.log("Redirecting to community chat...");
    nextStep();
  };

  return (
    <div className="flex flex-col items-center justify-center text-center p-8 max-w-2xl mx-auto">
      <motion.h1
        className="text-5xl font-bold mb-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        Trusted by data-driven bettors
      </motion.h1>
      <motion.p
        className="text-lg text-muted-foreground mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        See community results, discussions, and model transparency.
      </motion.p>
      
      {/* Placeholder for reviews carousel */}
      <motion.div 
        className="w-full h-32 bg-muted rounded-lg flex items-center justify-center my-8"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <p className="text-muted-foreground">[Reviews Carousel Placeholder]</p>
      </motion.div>

      <motion.div
        className="flex flex-col sm:flex-row gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
      >
        <Button onClick={handleJoinCommunity} size="lg" variant="outline">
          Join Community Chat
        </Button>
        <Button onClick={nextStep} size="lg">
          Continue
        </Button>
      </motion.div>
    </div>
  );
}
