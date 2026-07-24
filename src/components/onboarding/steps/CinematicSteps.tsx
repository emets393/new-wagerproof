/**
 * The closing cinematic — web port of OnboardingGenerationCinematic,
 * OnboardingRevealView and OnboardingTimeSummaryView. The generation step
 * runs REAL agent creation behind the theater; the reveal shows the new
 * agent; the time summary locks it in and marks onboarding complete.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { PixelSpriteAvatar } from '@/components/agents/split/PixelSpriteAvatar';
import { getAvatarBackground, getPrimaryColor } from '@/utils/agentColors';
import { MockPickTicket } from '@/components/onboarding/mocks';
import {
  money,
  researchTimeEstimates,
  resolveResearchTimeBucket,
  resolveStakesBucket,
  stakesEstimates,
  yearsWord,
} from '@/components/onboarding/research';

// ── Generation ───────────────────────────────────────────────────────────────

const CONSOLE_LINES = [
  "Booting your agent's brain...",
  "Reading today's board...",
  'Pulling model probabilities...',
  'Scanning line movement...',
  'Checking public splits...',
  'Weighing matchup edges...',
  'Pricing value vs the market...',
  'Cross-checking injury news...',
  'Simulating outcomes...',
  'Grading confidence...',
  'Writing up the reasoning...',
  'Stamping the tickets...',
];

const LINE_INTERVAL_MS = 1100;
const MIN_THEATER_MS = 14000;
const MAX_THEATER_MS = 30000;

export function GenerationStep() {
  const { draft, createDraftAgent, nextStep, accent } = useOnboarding();
  const [lines, setLines] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const startedRef = useRef(false);

  const agentName = draft.name.trim() || 'Your agent';

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const startedAt = Date.now();
    let cancelled = false;
    let lineIndex = 0;

    const lineTimer = window.setInterval(() => {
      if (cancelled) return;
      if (lineIndex < CONSOLE_LINES.length) {
        const line = CONSOLE_LINES[lineIndex];
        setLines((prev) => [line, ...prev].slice(0, 4));
        lineIndex += 1;
      }
    }, LINE_INTERVAL_MS);

    const creation = createDraftAgent();

    const finish = async () => {
      // Wait for both the minimum theater time and the real creation call
      // (whichever is longer), but never longer than the hard cap.
      await Promise.race([
        Promise.all([
          creation,
          new Promise((resolve) => setTimeout(resolve, Math.max(0, MIN_THEATER_MS - (Date.now() - startedAt)))),
        ]),
        new Promise((resolve) => setTimeout(resolve, MAX_THEATER_MS)),
      ]);
      if (cancelled) return;
      window.clearInterval(lineTimer);
      setDone(true);
      setLines((prev) => [`Done. Meet ${draft.name.trim() || 'your agent'}.`, ...prev].slice(0, 4));
      setTimeout(() => {
        if (!cancelled) nextStep();
      }, 1400);
    };
    finish();

    return () => {
      cancelled = true;
      window.clearInterval(lineTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-full w-full flex-col items-center justify-center gap-8 px-6 text-center">
      {/* Desk avatar */}
      <motion.div
        animate={done ? { scale: [1, 1.12, 1] } : { y: [0, -4, 0] }}
        transition={done ? { duration: 0.5 } : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        className="grid h-28 w-28 place-items-center overflow-hidden rounded-3xl"
        style={{
          background: getAvatarBackground(draft.avatar_color),
          boxShadow: `0 10px 40px ${getPrimaryColor(draft.avatar_color)}66`,
        }}
      >
        <PixelSpriteAvatar spriteIndex={draft.sprite_index ?? 0} height={96} />
      </motion.div>

      <div>
        <p className="text-xl font-extrabold text-white">{done ? `Done. Meet ${agentName}.` : `Building ${agentName}...`}</p>
        {/* Loading bar */}
        <div className="mx-auto mt-4 h-1.5 w-56 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full"
            style={{ background: accent }}
            initial={{ width: '4%' }}
            animate={{ width: done ? '100%' : '92%' }}
            transition={{ duration: done ? 0.4 : MIN_THEATER_MS / 1000, ease: done ? 'easeOut' : 'linear' }}
          />
        </div>
      </div>

      {/* Console stack (newest first) */}
      <div className="flex w-full max-w-sm flex-col gap-1.5">
        <AnimatePresence initial={false}>
          {lines.map((line, index) => (
            <motion.p
              key={line}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: index === 0 ? 1 : 0.75 - index * 0.18, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="text-left font-mono text-xs text-white/80"
            >
              <span style={{ color: accent }}>▸</span> {line}
            </motion.p>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Reveal ───────────────────────────────────────────────────────────────────

const TEASER_PICKS = [
  { matchup: 'Tonight · NFL', selection: 'Underdog +6.5', odds: '-108' },
  { matchup: 'Tonight · NBA', selection: 'Home ML', odds: '+124' },
];

export function RevealStep() {
  const { draft, createdAgent, nextStep, accent } = useOnboarding();
  const agentName = createdAgent?.name || draft.name.trim() || 'Your Agent';

  return (
    <div className="flex min-h-full w-full flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        className="grid h-28 w-28 place-items-center overflow-hidden rounded-3xl"
        style={{
          background: getAvatarBackground(draft.avatar_color),
          boxShadow: `0 10px 40px ${getPrimaryColor(draft.avatar_color)}66`,
        }}
      >
        <PixelSpriteAvatar spriteIndex={draft.sprite_index ?? 0} height={96} />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <h1 className="text-3xl font-extrabold text-white">{agentName} is live!</h1>
        <p className="mt-1.5 text-base text-white/70">First research run complete — here's a taste.</p>
      </motion.div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        {TEASER_PICKS.map((pick, index) => (
          <motion.div
            key={pick.selection}
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 + index * 0.26, duration: 0.35 }}
          >
            <MockPickTicket matchup={pick.matchup} selection={pick.selection} odds={pick.odds} blurred />
          </motion.div>
        ))}
      </div>

      <motion.button
        type="button"
        onClick={nextStep}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="mt-2 w-full max-w-sm rounded-2xl py-4 text-base font-extrabold text-black transition-transform active:scale-[0.98]"
        style={{ background: accent }}
      >
        See everything
      </motion.button>
    </div>
  );
}

// ── Time summary ─────────────────────────────────────────────────────────────

export function TimeSummaryStep({ onFinish }: { onFinish: () => void }) {
  const { survey, accent } = useOnboarding();
  const [bumped, setBumped] = useState(false);

  const time = useMemo(
    () => researchTimeEstimates(resolveResearchTimeBucket(survey.researchTimeBucket)),
    [survey.researchTimeBucket]
  );
  const stakes = useMemo(
    () => stakesEstimates(resolveStakesBucket(survey.weeklyStakesBucket)),
    [survey.weeklyStakesBucket]
  );

  const cards = [
    {
      title: `About ${time.reclaimHoursPerWeek} hours back every week`,
      body: 'Your agents run the score checks, line refreshes, and model reads for you.',
    },
    {
      title: "Decide, don't grind",
      body: 'Start every slate from a screened shortlist with the reasoning attached.',
    },
    {
      title: `Protect your ${money(stakes.yearlyAction)} this year`,
      body: 'Do more with the money you already put in play.',
    },
  ];

  const handleBump = () => {
    if (bumped) return;
    setBumped(true);
    setTimeout(onFinish, 900);
  };

  return (
    <div className="flex min-h-full w-full flex-col items-center justify-center gap-6 px-6 py-10 text-center">
      <motion.h1
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md text-2xl font-extrabold text-white sm:text-3xl"
      >
        WagerProof will get you back{' '}
        <span style={{ color: accent }}>
          {time.reclaimYears}+ {yearsWord(time.reclaimYears)}
        </span>{' '}
        of your life
      </motion.h1>

      <div className="flex w-full max-w-sm flex-col gap-3">
        {cards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + index * 0.14 }}
            className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3.5 text-left"
          >
            <p className="text-sm font-bold text-white">{card.title}</p>
            <p className="mt-0.5 text-sm text-white/65">{card.body}</p>
          </motion.div>
        ))}
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="text-sm font-semibold text-white/70"
      >
        Let's lock it in with a fist bump
      </motion.p>

      <motion.button
        type="button"
        onClick={handleBump}
        initial={{ opacity: 0 }}
        animate={bumped ? { opacity: 1, scale: [1, 1.25, 0.95, 1.1, 1] } : { opacity: 1 }}
        transition={bumped ? { duration: 0.7 } : { delay: 0.85 }}
        className="w-full max-w-sm rounded-2xl py-4 text-base font-extrabold text-black transition-transform active:scale-[0.96]"
        style={{ background: accent }}
      >
        {bumped ? '👊💥' : '👊\u2002Let\u2019s Do It'}
      </motion.button>
    </div>
  );
}
