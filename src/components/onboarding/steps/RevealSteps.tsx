/**
 * The staged cost/reclaim reveals — web port of OnboardingResearchRevealPages.
 * Numbers roll up in stages on a timed script; Continue stays disabled until
 * the full reveal has played (mirrors hasSeenCostReveal / hasSeenReclaimReveal
 * gating on iOS). Reduced motion shows everything at once.
 */
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { RollingNumber } from '@/components/onboarding/OnboardingShared';
import {
  COST_FOOTNOTE,
  RECLAIM_DISCLOSURE,
  money,
  researchTimeEstimates,
  resolveResearchTimeBucket,
  resolveStakesBucket,
  stakesEstimates,
  yearsWord,
} from '@/components/onboarding/research';

function useStagedScript(stages: number[], onDone: () => void): number {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setStage(stages.length);
      onDone();
      return;
    }
    let cancelled = false;
    const timers: number[] = [];
    let elapsed = 0;
    stages.forEach((delay, index) => {
      elapsed += delay;
      timers.push(
        window.setTimeout(() => {
          if (cancelled) return;
          setStage(index + 1);
          if (index === stages.length - 1) onDone();
        }, elapsed * 1000)
      );
    });
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return stage;
}

const stageAnim = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
};

export function ResearchCostStep() {
  const { survey, setCostRevealSeen } = useOnboarding();
  const time = useMemo(() => researchTimeEstimates(resolveResearchTimeBucket(survey.researchTimeBucket)), [survey.researchTimeBucket]);
  const stakes = useMemo(() => stakesEstimates(resolveStakesBucket(survey.weeklyStakesBucket)), [survey.weeklyStakesBucket]);

  // showDays → 2.6s → showMeaning → 0.9s → showYears → 2.4s → showClose (matches iOS)
  const stage = useStagedScript([0.2, 2.6, 0.9, 2.4], setCostRevealSeen);

  return (
    <div className="flex w-full flex-col items-center gap-5 text-center">
      <AnimatePresence>
        {stage >= 1 && (
          <motion.div key="days" {...stageAnim} className="flex flex-col items-center gap-1.5">
            <p className="text-lg font-semibold text-white/85">This year, you'll spend</p>
            <p className="text-5xl font-extrabold text-white sm:text-6xl">
              <RollingNumber value={time.daysThisYear} suffix=" days" duration={1.6} />
            </p>
            <p className="text-2xl font-bold text-red-400 sm:text-3xl">
              <RollingNumber value={stakes.yearlyAction} prefix="and risk $" duration={1.8} />
            </p>
            <p className="text-base text-white/70">checking scores, odds, and apps</p>
          </motion.div>
        )}
        {stage >= 2 && (
          <motion.p key="meaning" {...stageAnim} className="text-lg font-semibold text-white/85">
            Across your life, you'll spend
          </motion.p>
        )}
        {stage >= 3 && (
          <motion.div key="years" {...stageAnim} className="flex flex-col items-center gap-1.5">
            <p className="text-5xl font-extrabold text-white sm:text-6xl">
              <RollingNumber value={time.yearsOfLife} suffix={` ${yearsWord(time.yearsOfLife)}`} duration={1.6} />
            </p>
            <p className="text-2xl font-bold text-red-400 sm:text-3xl">
              <RollingNumber value={stakes.lifetimeAction} prefix="and risk $" duration={1.8} />
            </p>
          </motion.div>
        )}
        {stage >= 4 && (
          <motion.div key="close" {...stageAnim} className="flex flex-col items-center gap-4">
            <p className="text-lg text-white/85">
              on the board. <span className="font-extrabold text-white">Yep — you read that right.</span>
            </p>
            <p className="max-w-sm text-xs leading-relaxed text-white/45">{COST_FOOTNOTE}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ResearchReclaimStep() {
  const { survey, setReclaimRevealSeen } = useOnboarding();
  const time = useMemo(() => researchTimeEstimates(resolveResearchTimeBucket(survey.researchTimeBucket)), [survey.researchTimeBucket]);
  const stakes = useMemo(() => stakesEstimates(resolveStakesBucket(survey.weeklyStakesBucket)), [survey.weeklyStakesBucket]);

  // showLead → 1.6s → showNumber → 2.4s → showClose (matches iOS)
  const stage = useStagedScript([0.2, 1.6, 2.4], setReclaimRevealSeen);

  return (
    <div className="flex w-full flex-col items-center gap-5 text-center">
      <AnimatePresence>
        {stage >= 1 && (
          <motion.p key="lead" {...stageAnim} className="text-xl font-bold text-white sm:text-2xl">
            The good news: WagerProof researches for you.
          </motion.p>
        )}
        {stage >= 2 && (
          <motion.div key="number" {...stageAnim} className="flex flex-col items-center gap-2">
            <p className="text-5xl font-extrabold text-green-400 sm:text-6xl">
              <RollingNumber value={time.reclaimYears} suffix={`+ ${yearsWord(time.reclaimYears)}`} duration={1.6} />
            </p>
            <p className="max-w-sm text-base text-white/80">
              of your life back — about {time.reclaimHoursPerWeek} hours a week you'll never scan again.
            </p>
            <p className="max-w-sm text-xs leading-relaxed text-white/45">{RECLAIM_DISCLOSURE}</p>
          </motion.div>
        )}
        {stage >= 3 && (
          <motion.p key="close" {...stageAnim} className="max-w-sm text-lg text-white/85">
            Protect your <span className="font-extrabold text-white">{money(stakes.yearlyAction)}</span> and spend
            more time enjoying the games.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
