import { AnimatePresence, motion } from "framer-motion";
import { useOnboarding } from "@/hooks/useOnboarding";
import { ProgressIndicator } from "@/components/onboarding/ProgressIndicator";
import { PersonalizationIntro } from "@/components/onboarding/steps/Step1_PersonalizationIntro";
import { SportsSelection } from "@/components/onboarding/steps/Step2_SportsSelection";
import { AgeConfirmation } from "@/components/onboarding/steps/Step3_AgeConfirmation";
import { BettorTypeSelection } from "@/components/onboarding/steps/Step4_BettorType";
import { PrimaryGoalSelection } from "@/components/onboarding/steps/Step5_PrimaryGoal";
import { FeatureSpotlight } from "@/components/onboarding/steps/Step6_FeatureSpotlight";
import { EmailOptIn } from "@/components/onboarding/steps/Step7_EmailOptIn";
import { SocialProof } from "@/components/onboarding/steps/Step8_SocialProof";
import { ValueClaim } from "@/components/onboarding/steps/Step9_ValueClaim";
import { MethodologyClaim1 } from "@/components/onboarding/steps/Step10_Methodology1";
import { MethodologyClaim2 } from "@/components/onboarding/steps/Step11_Methodology2";
import { AcquisitionSource } from "@/components/onboarding/steps/Step12_AcquisitionSource";
import { DataTransparency } from "@/components/onboarding/steps/Step13_DataTransparency";
import { EarlyAccess } from "@/components/onboarding/steps/Step14_EarlyAccess";
import { Paywall } from "@/components/onboarding/steps/Step15_Paywall";
import Aurora from "@/components/magicui/aurora";

const stepComponents = {
  1: PersonalizationIntro,
  2: SportsSelection,
  3: AgeConfirmation,
  4: BettorTypeSelection,
  5: PrimaryGoalSelection,
  6: FeatureSpotlight,
  7: EmailOptIn,
  8: SocialProof,
  9: ValueClaim,
  10: MethodologyClaim1,
  11: MethodologyClaim2,
  12: AcquisitionSource,
  13: DataTransparency,
  14: EarlyAccess,
  15: Paywall,
};

const TOTAL_STEPS = 15;

export default function OnboardingPage() {
  const { currentStep, direction } = useOnboarding();

  const CurrentStepComponent = stepComponents[currentStep] || (() => <div>Step {currentStep} not found</div>);

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
      scale: 0.95,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 300 : -300,
      opacity: 0,
      scale: 0.95,
    }),
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      {/* Aurora Background Effect */}
      <div className="absolute inset-0 overflow-hidden">
        <Aurora
          colorStops={['#22c55e', '#4ade80', '#16a34a']}
          amplitude={1.2}
          blend={0.3}
          speed={0.5}
        />
      </div>
      
      {/* Modal Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="relative z-10 w-full max-w-4xl mx-4 bg-card/95 backdrop-blur-md border border-border/50 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Progress Indicator */}
        <div className="p-6 pb-0">
          <ProgressIndicator currentStep={currentStep} totalSteps={TOTAL_STEPS} />
        </div>
        
        {/* Content Area */}
        <div className="relative h-[600px] overflow-hidden">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={currentStep}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 },
                scale: { duration: 0.2 },
              }}
              className="absolute inset-0 flex items-center justify-center p-8"
            >
              <CurrentStepComponent />
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
