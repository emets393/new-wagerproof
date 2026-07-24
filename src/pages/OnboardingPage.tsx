/**
 * Onboarding — web port of the iOS native flow: a 21-page carousel
 * (survey → cost reveal → agent pitch → agent builder) with shared
 * Continue/Back chrome, followed by the generation cinematic, reveal,
 * time summary and the custom paywall.
 */
import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { OnboardingProvider, useOnboarding } from '@/contexts/OnboardingContext';
import Dither from '@/components/Dither';
import { cn } from '@/lib/utils';
import { isCarouselStep, STEP_CTA_TITLES, type OnboardingStepId } from '@/components/onboarding/flow';
import { TermsStep } from '@/components/onboarding/steps/TermsStep';
import {
  AcquisitionStep,
  BettorTypeStep,
  PitfallsStep,
  PrimaryGoalStep,
  ResearchTimeStep,
  WeeklyStakesStep,
} from '@/components/onboarding/steps/SurveySteps';
import { ResearchCostStep, ResearchReclaimStep } from '@/components/onboarding/steps/RevealSteps';
import {
  AgentHQStep,
  AgentPitchIntroStep,
  AgentPitchProofStep,
  LeaderboardStep,
} from '@/components/onboarding/steps/PitchSteps';
import {
  BuilderArchetypeStep,
  BuilderIdentityStep,
  BuilderInsightsStep,
  BuilderSportsStep,
} from '@/components/onboarding/steps/BuilderSteps';
import {
  BuilderBetStyleStep,
  BuilderDataTrustStep,
  BuilderMindsetStep,
  BuilderSportRulesStep,
} from '@/components/onboarding/steps/PersonalitySteps';
import { GenerationStep, RevealStep, TimeSummaryStep } from '@/components/onboarding/steps/CinematicSteps';
import { CustomPaywall } from '@/components/paywall/CustomPaywall';

const CAROUSEL_COMPONENTS: Partial<Record<OnboardingStepId, React.ComponentType>> = {
  terms: TermsStep,
  bettorType: BettorTypeStep,
  bettingPitfalls: PitfallsStep,
  acquisitionSource: AcquisitionStep,
  primaryGoal: PrimaryGoalStep,
  researchTime: ResearchTimeStep,
  weeklyStakes: WeeklyStakesStep,
  researchCost: ResearchCostStep,
  researchReclaim: ResearchReclaimStep,
  agentHQ: AgentHQStep,
  agentValueIntro: AgentPitchIntroStep,
  agentValueProof: AgentPitchProofStep,
  agentLeaderboard: LeaderboardStep,
  builderSports: BuilderSportsStep,
  builderArchetype: BuilderArchetypeStep,
  builderMindset: BuilderMindsetStep,
  builderBetStyle: BuilderBetStyleStep,
  builderDataTrust: BuilderDataTrustStep,
  builderSportRules: BuilderSportRulesStep,
  builderInsights: BuilderInsightsStep,
  builderIdentity: BuilderIdentityStep,
};

function hexToRgbFloats(hex: string): [number, number, number] {
  const raw = hex.replace('#', '');
  if (raw.length !== 6) return [0.13, 0.77, 0.37];
  return [
    parseInt(raw.substring(0, 2), 16) / 255,
    parseInt(raw.substring(2, 4), 16) / 255,
    parseInt(raw.substring(4, 6), 16) / 255,
  ];
}

function OnboardingContent() {
  const {
    step,
    direction,
    carouselProgress,
    accent,
    isLaunchMode,
    pitchSlide,
    canAdvance,
    canGoBack,
    nextStep,
    prevStep,
    markComplete,
    draft,
    survey,
  } = useOnboarding();
  const navigate = useNavigate();

  const onCarousel = isCarouselStep(step);
  const waveColor = useMemo(() => hexToRgbFloats(accent), [accent]);

  const finishToApp = () => {
    navigate('/agents');
  };

  const handleTimeSummaryFinish = () => {
    markComplete();
    if (isLaunchMode) {
      // Free launch mode: no paywall, straight into the app (matches the old
      // launch_mode behavior).
      finishToApp();
    } else {
      nextStep();
    }
  };

  const handlePaywallDismiss = () => {
    localStorage.setItem('wagerproof_paywall_bypassed', 'true');
    finishToApp();
  };

  const variants = {
    enter: (dir: number) => ({ x: dir >= 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir >= 0 ? -60 : 60, opacity: 0 }),
  };

  const CarouselComponent = CAROUSEL_COMPONENTS[step];
  // The pitch-intro page keys its slide so Continue animates between slides.
  const contentKey = step === 'agentValueIntro' ? `${step}-${pitchSlide}` : step;

  return (
    <div className="fixed inset-0 z-50 bg-[#05070c]">
      {/* Animated accent backdrop */}
      <div className="absolute inset-0 overflow-hidden opacity-35">
        <Dither
          waveSpeed={0.05}
          waveFrequency={3}
          waveAmplitude={0.3}
          waveColor={waveColor}
          colorNum={4}
          pixelSize={2}
          disableAnimation={false}
          enableMouseInteraction={false}
          mouseRadius={0}
        />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/70" />

      <div className="relative z-10 mx-auto flex h-full w-full max-w-xl flex-col">
        {onCarousel ? (
          <>
            {/* Top bar: back + progress */}
            <div className="flex items-center gap-3 px-4 pb-2 pt-5 sm:px-6">
              <button
                type="button"
                onClick={prevStep}
                aria-label="Back"
                className={cn(
                  'grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-white transition-opacity hover:bg-white/15',
                  !canGoBack && 'pointer-events-none opacity-0'
                )}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: accent }}
                  animate={{ width: `${Math.round(carouselProgress * 100)}%` }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                />
              </div>
              <div className="w-9 shrink-0" />
            </div>

            {/* Step content */}
            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6" style={{ scrollbarWidth: 'thin' }}>
              <AnimatePresence initial={false} custom={direction} mode="wait">
                <motion.div
                  key={contentKey}
                  custom={direction}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.24, ease: 'easeOut' }}
                  className="flex min-h-full w-full items-start justify-center"
                >
                  {CarouselComponent ? <CarouselComponent /> : null}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Bottom CTA */}
            <div className="px-4 pb-6 pt-3 sm:px-6">
              <motion.button
                type="button"
                onClick={nextStep}
                disabled={!canAdvance}
                whileTap={canAdvance ? { scale: 0.98 } : undefined}
                className="w-full rounded-2xl py-4 text-base font-extrabold text-black transition-all disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/40"
                style={canAdvance ? { background: accent } : undefined}
              >
                {STEP_CTA_TITLES[step as keyof typeof STEP_CTA_TITLES]}
              </motion.button>
            </div>
          </>
        ) : step === 'generation' ? (
          <GenerationStep />
        ) : step === 'reveal' ? (
          <div className="flex-1 overflow-y-auto">
            <RevealStep />
          </div>
        ) : step === 'timeSummary' ? (
          <div className="flex-1 overflow-y-auto">
            <TimeSummaryStep onFinish={handleTimeSummaryFinish} />
          </div>
        ) : (
          /* Paywall */
          <div className="flex-1 overflow-y-auto py-4" style={{ scrollbarWidth: 'thin' }}>
            <CustomPaywall
              personalization={{
                agentName: draft.name.trim() || undefined,
                spriteIndex: draft.sprite_index,
                avatarColor: draft.avatar_color,
                researchTimeBucket: survey.researchTimeBucket,
                weeklyStakesBucket: survey.weeklyStakesBucket,
              }}
              onDismiss={handlePaywallDismiss}
              onPurchased={finishToApp}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <OnboardingProvider>
      <OnboardingContent />
    </OnboardingProvider>
  );
}
