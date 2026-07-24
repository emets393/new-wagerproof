/**
 * Agent pitch steps — web port of OnboardingAgentHQPage,
 * OnboardingAgentPitchPages and OnboardingLeaderboardPage.
 */
import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, Clock, Cpu, TrendingUp } from 'lucide-react';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { StepHeader } from '@/components/onboarding/OnboardingShared';
import { MockAvatarTile, MockLeaderboardCard, MockTrendCard, WinRateCurves } from '@/components/onboarding/mocks';
import { PixelSpriteAvatar } from '@/components/agents/split/PixelSpriteAvatar';
import {
  researchTimeEstimates,
  resolveResearchTimeBucket,
  yearsWord,
} from '@/components/onboarding/research';

// ── Agent HQ ─────────────────────────────────────────────────────────────────

const HQ_ROSTER = [
  { sprite: 2, color: 'gradient:#22C55E,#0EA5E9', label: 'WORKING' },
  { sprite: 6, color: 'gradient:#F97316,#EF4444', label: 'THINKING' },
  { sprite: 4, color: 'gradient:#8B5CF6,#EC4899', label: 'PICKS READY' },
  { sprite: 1, color: '#3B82F6', label: 'WORKING' },
];

const HQ_LABEL_COLORS: Record<string, string> = {
  WORKING: '#f97316',
  THINKING: '#8b5cf6',
  'PICKS READY': '#22c55e',
};

export function AgentHQStep() {
  return (
    <div className="flex w-full flex-col items-center">
      <StepHeader
        title="We created research agents to save you time!"
        subtitle="Meet Agent HQ — a team of AI analysts that works the data around the clock so you don't have to."
      />
      <div className="relative w-full overflow-hidden rounded-2xl border border-white/12 bg-[#0f1118] p-6">
        <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-white/20 bg-black/40 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-md">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
          Agent HQ — Live
        </span>
        <div className="mt-6 flex items-end justify-center gap-5 sm:gap-8">
          {HQ_ROSTER.map((agent, index) => (
            <motion.div
              key={index}
              className="flex flex-col items-center gap-2"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.12 * index }}
            >
              <span
                className="rounded px-1.5 py-0.5 text-[9px] font-extrabold text-white"
                style={{ background: HQ_LABEL_COLORS[agent.label] }}
              >
                {agent.label}
              </span>
              <PixelSpriteAvatar spriteIndex={agent.sprite} height={72} />
              <div className="h-2 w-14 rounded bg-white/10" />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Pitch intro: "Not another chatbot" (3 slides) ───────────────────────────

export function AgentPitchIntroStep() {
  const { survey, pitchSlide } = useOnboarding();
  const time = useMemo(
    () => researchTimeEstimates(resolveResearchTimeBucket(survey.researchTimeBucket)),
    [survey.researchTimeBucket]
  );

  const markers = [
    {
      icon: Clock,
      color: '#f97316',
      lead: (
        <>
          Get back <strong>{time.reclaimYears}+ {yearsWord(time.reclaimYears)}</strong>
        </>
      ),
      tail: 'of your life',
    },
    {
      icon: CalendarClock,
      color: '#22c55e',
      lead: (
        <>
          Hand off <strong>~{time.reclaimHoursPerWeek} hrs a week</strong>
        </>
      ),
      tail: 'of scores and line checks',
    },
    {
      icon: Cpu,
      color: '#ef4444',
      lead: 'Every slate screened',
      tail: <><strong>24/7</strong>, five leagues</>,
    },
    {
      icon: TrendingUp,
      color: '#3b82f6',
      lead: 'Model vs Vegas',
      tail: <>on <strong>every</strong> line</>,
    },
  ];

  return (
    <div className="flex w-full flex-col items-center">
      <StepHeader title="Not another chatbot" />

      {/* Slide dots */}
      <div className="mb-5 flex gap-1.5">
        {[0, 1, 2].map((dot) => (
          <span
            key={dot}
            className="h-1.5 rounded-full transition-all duration-300"
            style={{
              width: dot === pitchSlide ? 20 : 6,
              background: dot === pitchSlide ? 'white' : 'rgba(255,255,255,0.25)',
            }}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {pitchSlide === 0 && (
          <motion.div
            key="slide-0"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3 }}
            className="w-full"
          >
            <p className="mb-4 text-center text-lg font-bold text-white">With WagerProof you can:</p>
            <div className="flex flex-col gap-3">
              {markers.map((marker, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 * index }}
                  className="flex items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3.5"
                >
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                    style={{ background: `${marker.color}22`, color: marker.color }}
                  >
                    <marker.icon className="h-5 w-5" />
                  </span>
                  <p className="text-sm text-white/85 [&_strong]:font-extrabold [&_strong]:text-white">
                    {marker.lead} {marker.tail}
                  </p>
                </motion.div>
              ))}
            </div>
            <p className="mt-4 text-center text-xs text-white/45">Time estimates from your answers. Results vary.</p>
          </motion.div>
        )}

        {pitchSlide === 1 && (
          <motion.div
            key="slide-1"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3 }}
            className="w-full"
          >
            <p className="mb-4 text-center text-lg font-bold text-white">Picks that actually hit</p>
            <WinRateCurves />
            <p className="mt-4 text-center text-sm text-white/70">
              Most bettors' picks land around a 40% win rate. Our top agents peak far higher. See them on the
              leaderboard and tail their picks.
            </p>
          </motion.div>
        )}

        {pitchSlide === 2 && (
          <motion.div
            key="slide-2"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3 }}
            className="w-full"
          >
            <p className="mb-4 text-center text-lg font-bold text-white">Edges served daily</p>
            <MockTrendCard />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Pitch proof: analyst who never sleeps ────────────────────────────────────

const PROOF_BULLETS = [
  {
    title: 'Works while you sleep',
    body: 'Re-checks every game, every line move, and every injury update. You never start from a blank page.',
  },
  {
    title: 'Thousands of data points per slate',
    body: 'Model probabilities, market prices, public money, and matchup stats turned into actual picks.',
  },
  {
    title: 'Shows its work',
    body: 'Every pick comes with the reasoning behind it. Tail it or fade it in seconds.',
  },
];

export function AgentPitchProofStep() {
  return (
    <div className="flex w-full flex-col items-center">
      <StepHeader
        title="An analyst who never sleeps"
        subtitle="It runs the research grind. You just read the answer."
      />
      <div className="mb-5">
        <MockAvatarTile color="gradient:#22C55E,#0EA5E9" spriteIndex={2} size={72} />
      </div>
      <div className="flex w-full flex-col gap-3">
        {PROOF_BULLETS.map((bullet, index) => (
          <motion.div
            key={bullet.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 * index }}
            className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3.5 text-left"
          >
            <p className="text-sm font-bold text-white">{bullet.title}</p>
            <p className="mt-0.5 text-sm text-white/65">{bullet.body}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Leaderboard ──────────────────────────────────────────────────────────────

export function LeaderboardStep() {
  return (
    <div className="flex w-full flex-col items-center">
      <StepHeader title="Or just tail the best" />
      <MockLeaderboardCard />
      <p className="mt-3 text-center text-xs text-white/50">
        Follow any agent and its picks land in your feed. Sample data shown.
      </p>
    </div>
  );
}
