/**
 * Survey steps 2–7 of the iOS-style onboarding: bettor type, betting
 * pitfalls, acquisition source, primary goal, research time and weekly
 * stakes. Copy mirrors the iOS onboarding pages exactly.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { OptionList, PillGrid, StepHeader } from '@/components/onboarding/OnboardingShared';
import {
  ACQUISITION_SOURCES,
  BETTING_PITFALLS,
  BETTOR_TYPE_OPTIONS,
  PRIMARY_GOALS,
} from '@/components/onboarding/flow';
import {
  RESEARCH_TIME_BUCKETS,
  RESEARCH_TIME_INFO,
  STAKES_BUCKETS,
  STAKES_INFO,
  type ResearchTimeBucket,
  type StakesBucket,
} from '@/components/onboarding/research';

export function BettorTypeStep() {
  const { survey, updateSurvey } = useOnboarding();
  return (
    <div className="w-full">
      <StepHeader title="What kind of bettor are you?" subtitle="We tune your experience around this." />
      <OptionList
        options={BETTOR_TYPE_OPTIONS}
        value={survey.bettorType}
        onSelect={(bettorType) => updateSurvey({ bettorType })}
      />
    </div>
  );
}

export function PitfallsStep() {
  const { survey, updateSurvey } = useOnboarding();
  const toggle = (item: string) => {
    const next = survey.bettingPitfalls.includes(item)
      ? survey.bettingPitfalls.filter((p) => p !== item)
      : [...survey.bettingPitfalls, item];
    updateSurvey({ bettingPitfalls: next });
  };
  return (
    <div className="w-full">
      <StepHeader
        title="Select Every Pitfall You've Hit 🎯"
        subtitle="Tap everything that sounds familiar — it helps us tailor your agents."
      />
      <PillGrid items={BETTING_PITFALLS} selected={survey.bettingPitfalls} onToggle={toggle} />
    </div>
  );
}

export function AcquisitionStep() {
  const { survey, updateSurvey } = useOnboarding();
  return (
    <div className="w-full">
      <StepHeader title="Where did you hear about us?" />
      <OptionList
        options={ACQUISITION_SOURCES.map((s) => ({ value: s, label: s }))}
        value={survey.acquisitionSource as (typeof ACQUISITION_SOURCES)[number] | undefined}
        onSelect={(acquisitionSource) => updateSurvey({ acquisitionSource })}
      />
    </div>
  );
}

export function PrimaryGoalStep() {
  const { survey, updateSurvey } = useOnboarding();
  return (
    <div className="w-full">
      <StepHeader title="What's your main goal?" />
      <OptionList
        options={PRIMARY_GOALS.map((g) => ({ value: g, label: g }))}
        value={survey.mainGoal as (typeof PRIMARY_GOALS)[number] | undefined}
        onSelect={(mainGoal) => updateSurvey({ mainGoal })}
      />
    </div>
  );
}

function EchoReply({ echo, reply }: { echo: string; reply: string }) {
  return (
    <motion.div
      key={echo}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.3 }}
      className="mt-4 w-full rounded-2xl border border-white/12 bg-white/[0.06] p-4 text-left"
    >
      <p className="text-sm font-semibold text-white">{echo}</p>
      <p className="mt-1 text-sm text-white/65">{reply}</p>
    </motion.div>
  );
}

export function ResearchTimeStep() {
  const { survey, updateSurvey } = useOnboarding();
  const selected = survey.researchTimeBucket;
  return (
    <div className="w-full">
      <StepHeader
        title="How much time do you spend checking sports apps each day?"
        subtitle="Scores, odds, lines, and feeds. Your best guess is fine."
      />
      <OptionList
        options={RESEARCH_TIME_BUCKETS.map((bucket) => ({
          value: bucket,
          label: RESEARCH_TIME_INFO[bucket].label,
        }))}
        value={selected}
        onSelect={(researchTimeBucket: ResearchTimeBucket) => updateSurvey({ researchTimeBucket })}
      />
      <AnimatePresence mode="wait">
        {selected && (
          <EchoReply echo={RESEARCH_TIME_INFO[selected].echoLine} reply={RESEARCH_TIME_INFO[selected].replyLine} />
        )}
      </AnimatePresence>
    </div>
  );
}

export function WeeklyStakesStep() {
  const { survey, updateSurvey } = useOnboarding();
  const selected = survey.weeklyStakesBucket;
  return (
    <div className="w-full">
      <StepHeader
        title="How much do you bet in a typical week?"
        subtitle="Your best guess is fine. Just sizing it up."
      />
      <OptionList
        options={STAKES_BUCKETS.map((bucket) => ({
          value: bucket,
          label: STAKES_INFO[bucket].label,
        }))}
        value={selected}
        onSelect={(weeklyStakesBucket: StakesBucket) => updateSurvey({ weeklyStakesBucket })}
      />
      <AnimatePresence mode="wait">
        {selected && (
          <EchoReply echo={STAKES_INFO[selected].echoLine} reply={STAKES_INFO[selected].replyLine} />
        )}
      </AnimatePresence>
    </div>
  );
}
