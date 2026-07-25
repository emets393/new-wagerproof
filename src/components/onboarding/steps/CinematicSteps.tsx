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

// ── Generation theater bits ──────────────────────────────────────────────────

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

const TOOL_LABELS = ['Model', 'Odds', 'Splits', 'News', 'Sims', 'Write-up'];

const LINE_INTERVAL_MS = 1100;
const MIN_THEATER_MS = 14000;
const MAX_THEATER_MS = 30000;

function GlyphMatrix({ accent }: { accent: string }) {
  return (
    <span className="agent-generation-glyph" style={{ color: accent }} aria-hidden>
      {Array.from({ length: 9 }, (_, index) => (
        <i key={index} style={{ animationDelay: `${index * 80}ms` }} />
      ))}
    </span>
  );
}

function ToolStack({ count, accent }: { count: number; accent: string }) {
  const visible = Math.min(count, 4);
  // Fixed-height slot so dealing cards never shove the theater upward.
  return (
    <div className="relative mx-auto h-20 w-full max-w-xs" aria-hidden>
      {Array.from({ length: visible }, (_, index) => (
        <motion.div
          key={`${TOOL_LABELS[index]}-${index}`}
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1 - index * 0.16, y: index * 8, scale: 1 - index * 0.02 }}
          transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          className="absolute inset-x-0 top-0 rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2.5 backdrop-blur-sm"
          style={{ zIndex: visible - index, borderLeftWidth: 3, borderLeftColor: accent }}
        >
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-sm" style={{ background: accent }} />
            <span className="text-[11px] font-bold text-white/80">{TOOL_LABELS[index]}</span>
            <span className="ml-auto h-1.5 w-12 rounded-full bg-white/10" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

interface StatusLine {
  id: number;
  text: string;
}

export function GenerationStep() {
  const { draft, createDraftAgent, nextStep, accent } = useOnboarding();
  const [lines, setLines] = useState<StatusLine[]>([]);
  const [toolCount, setToolCount] = useState(0);
  const [done, setDone] = useState(false);
  const startedRef = useRef(false);
  const nextLineId = useRef(0);

  const agentName = draft.name.trim() || 'Your agent';

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const startedAt = Date.now();
    let cancelled = false;
    let lineIndex = 0;

    const pushLine = (text: string) => {
      const id = nextLineId.current++;
      setLines((prev) => [{ id, text }, ...prev].slice(0, 4));
    };

    const lineTimer = window.setInterval(() => {
      if (cancelled) return;
      if (lineIndex < CONSOLE_LINES.length) {
        pushLine(CONSOLE_LINES[lineIndex]);
        setToolCount((c) => Math.min(6, c + 1));
        lineIndex += 1;
      }
    }, LINE_INTERVAL_MS);

    const creation = createDraftAgent();

    const finish = async () => {
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
      pushLine(`Done. Meet ${draft.name.trim() || 'your agent'}.`);
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
    <div className="flex min-h-full w-full flex-col px-6 text-center">
      {/* Fixed-height console — newest drops in from top; older slide down & fade (iOS). */}
      <div className="relative mx-auto mt-10 h-[110px] w-full max-w-sm overflow-hidden">
        <AnimatePresence initial={false}>
          {lines.map((line, index) => (
            <motion.p
              key={line.id}
              initial={{ opacity: 0, y: -22 }}
              animate={{
                opacity: Math.max(0.3, 1 - index * 0.24),
                y: index * 26,
              }}
              exit={{ opacity: 0, y: 110 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="absolute inset-x-0 top-0 truncate text-left font-mono text-sm font-bold text-white"
            >
              {line.text}
            </motion.p>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-5">
        <div className="relative">
          {!done &&
            [0, 1, 2].map((ring) => (
              <motion.span
                key={ring}
                className="pointer-events-none absolute inset-[-18%] rounded-[32px] border"
                style={{ borderColor: `${accent}55` }}
                initial={{ opacity: 0.45, scale: 0.85 }}
                animate={{ opacity: 0, scale: 1.35 }}
                transition={{ duration: 2.2, delay: ring * 0.55, repeat: Infinity, ease: 'easeOut' }}
              />
            ))}

          <motion.div
            animate={done ? { scale: [1, 1.12, 1] } : { y: [0, -4, 0] }}
            transition={done ? { duration: 0.5 } : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            className="relative grid h-28 w-28 place-items-center overflow-hidden rounded-3xl"
            style={{
              background: getAvatarBackground(draft.avatar_color),
              boxShadow: `0 10px 40px ${getPrimaryColor(draft.avatar_color)}66`,
            }}
          >
            <PixelSpriteAvatar spriteIndex={draft.sprite_index ?? 0} height={96} />
          </motion.div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-center gap-2.5">
            <GlyphMatrix accent={done ? accent : '#ff8a00'} />
            <p className="text-base font-extrabold text-white sm:text-lg">
              {done ? `Done. Meet ${agentName}.` : `Building ${agentName}...`}
            </p>
          </div>
          <div className="mx-auto h-1.5 w-56 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full"
              style={{ background: accent }}
              initial={{ width: '4%' }}
              animate={{ width: done ? '100%' : '92%' }}
              transition={{ duration: done ? 0.4 : MIN_THEATER_MS / 1000, ease: done ? 'easeOut' : 'linear' }}
            />
          </div>
        </div>
      </div>

      <div className="pb-12 pt-4">
        <ToolStack count={toolCount} accent={accent} />
      </div>
    </div>
  );
}

// ── Reveal ───────────────────────────────────────────────────────────────────

const TEASER_PICKS = [
  { matchup: 'Tonight · NFL', selection: 'Underdog +6.5', odds: '-108' },
  { matchup: 'Tonight · NBA', selection: 'Home ML', odds: '+124' },
];

const CONFETTI = ['🏈', '🏀', '💵', '📈', '🎯', '🎟️', '⚾️', '💰'];

export function RevealStep() {
  const { draft, createdAgent, nextStep, accent } = useOnboarding();
  const agentName = createdAgent?.name || draft.name.trim() || 'Your Agent';
  const sports = (createdAgent?.preferred_sports ?? draft.preferred_sports).map((s) => s.toUpperCase());

  return (
    <div className="relative flex min-h-full w-full flex-col items-center justify-center gap-6 overflow-hidden px-6 py-10 text-center">
      {/* Soft confetti burst */}
      {CONFETTI.map((emoji, i) => {
        const angle = (i / CONFETTI.length) * Math.PI * 2;
        return (
          <motion.span
            key={emoji + i}
            className="pointer-events-none absolute text-2xl"
            initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
            animate={{
              opacity: [0, 1, 0],
              x: Math.cos(angle) * (110 + (i % 3) * 28),
              y: Math.sin(angle) * (90 + (i % 2) * 36) - 20,
              scale: [0.4, 1.1, 0.8],
            }}
            transition={{ duration: 1.6, delay: 0.15 + i * 0.05, ease: 'easeOut' }}
          >
            {emoji}
          </motion.span>
        );
      })}

      {/* Agent row card stand-in */}
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        className="flex w-full max-w-sm items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.07] p-3.5 text-left"
        style={{ boxShadow: `0 0 0 1px ${accent}33, 0 12px 40px ${getPrimaryColor(draft.avatar_color)}33` }}
      >
        <div
          className="grid h-14 w-14 place-items-center overflow-hidden rounded-xl"
          style={{ background: getAvatarBackground(draft.avatar_color) }}
        >
          <PixelSpriteAvatar spriteIndex={draft.sprite_index ?? 0} height={48} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-white">{agentName}</p>
          <p className="mt-0.5 text-xs text-white/55">
            {sports.length ? sports.join(' · ') : 'Multi-sport'} · Live
          </p>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-black"
          style={{ background: accent }}
        >
          New
        </span>
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

// ── Time summary + fist-bump explosion ───────────────────────────────────────

type FistParticle = {
  id: number;
  dx: number;
  dy: number;
  spin: number;
  scale: number;
  emoji: string;
};

function makeParticles(): FistParticle[] {
  const pool = ['🏈', '🏀', '⚾️', '🏒', '⚽️', '💵', '💰', '🎟️', '📈', '🎯'];
  const count = 48;
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.36;
    const dist = 180 + Math.random() * 220;
    return {
      id: i,
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist,
      spin: (Math.random() - 0.5) * 520,
      scale: 0.7 + Math.random() * 0.8,
      emoji: pool[i % pool.length],
    };
  });
}

function FistBumpExplosion({ onFinished }: { onFinished: () => void }) {
  const [fistScale, setFistScale] = useState(0.35);
  const [wiggle, setWiggle] = useState(false);
  const [punch, setPunch] = useState(1);
  const [bursting, setBursting] = useState(false);
  const particles = useMemo(() => makeParticles(), []);
  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    let cancelled = false;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const run = async () => {
      if (reduceMotion) {
        setFistScale(1);
        setBursting(true);
        await sleep(900);
        if (!cancelled) onFinished();
        return;
      }

      setFistScale(1);
      await sleep(420);
      if (cancelled) return;
      setWiggle(true);
      await sleep(500);
      if (cancelled) return;
      setWiggle(false);
      setBursting(true);
      setPunch(1.42);
      await sleep(90);
      if (cancelled) return;
      setPunch(1);
      await sleep(1400);
      if (!cancelled) onFinished();
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [onFinished, reduceMotion]);

  return (
    <div className="relative flex min-h-full w-full items-center justify-center overflow-hidden">
      {bursting &&
        particles.map((p) => (
          <motion.span
            key={p.id}
            className="pointer-events-none absolute text-[28px]"
            initial={{ opacity: 1, x: 0, y: 0, scale: 0.15, rotate: 0 }}
            animate={{
              opacity: [1, 1, 0],
              x: p.dx,
              y: p.dy,
              scale: p.scale,
              rotate: p.spin,
            }}
            transition={{ duration: 1.55, ease: [0.16, 1, 0.3, 1] }}
          >
            {p.emoji}
          </motion.span>
        ))}

      <motion.span
        className="relative z-10 select-none text-[96px] leading-none"
        animate={{
          scale: fistScale * punch,
          rotate: wiggle ? [ -8, 8, -8, 8, 0 ] : 0,
        }}
        transition={
          wiggle
            ? { rotate: { duration: 0.44, ease: 'easeInOut' }, scale: { type: 'spring', stiffness: 260, damping: 16 } }
            : { type: 'spring', stiffness: 260, damping: 16 }
        }
      >
        👊
      </motion.span>
    </div>
  );
}

export function TimeSummaryStep({ onFinish }: { onFinish: () => void }) {
  const { survey, accent } = useOnboarding();
  const [beat, setBeat] = useState<'summary' | 'fistBump'>('summary');

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

  if (beat === 'fistBump') {
    return <FistBumpExplosion onFinished={onFinish} />;
  }

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
        onClick={() => setBeat('fistBump')}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.85 }}
        className="w-full max-w-sm rounded-2xl py-4 text-base font-extrabold text-black transition-transform active:scale-[0.96]"
        style={{ background: accent }}
      >
        👊{'\u2002'}Let{'\u2019'}s Do It
      </motion.button>
    </div>
  );
}
