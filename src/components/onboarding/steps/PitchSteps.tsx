/**
 * Agent pitch steps — web port of OnboardingAgentHQPage,
 * OnboardingAgentPitchPages and OnboardingLeaderboardPage.
 */
import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarClock, Clock, Cpu, TrendingUp } from 'lucide-react';
import { DEMO_AGENTS } from '@/components/agents/demoAgents';
import { AgentHQ } from '@/components/agents/split/AgentHQ';
import { OutliersTrendCard } from '@/features/outliers/components/OutliersTrendCard';
import { useOnboarding } from '@/contexts/OnboardingContext';
import {
  OnboardingMarkerRow,
  StepHeader,
} from '@/components/onboarding/OnboardingShared';
import {
  MockAvatarTile,
  MockLeaderboardCard,
  ONBOARDING_EXAMPLE_TREND_CARD,
  WinRateCurves,
} from '@/components/onboarding/mocks';
import {
  researchTimeEstimates,
  resolveResearchTimeBucket,
  yearsWord,
} from '@/components/onboarding/research';

// ── Agent HQ ─────────────────────────────────────────────────────────────────

export function AgentHQStep() {
  return (
    <div className="flex w-full flex-col items-center">
      <StepHeader
        title="We created research agents to save you time!"
        subtitle="Meet Agent HQ — a team of AI analysts that works the data around the clock so you don't have to."
      />
      <div className="w-full overflow-hidden rounded-2xl border border-white/12">
        <AgentHQ
          agents={DEMO_AGENTS}
          hideControls
          hideStats
          interactive={false}
          onSelectAgent={() => undefined}
        />
      </div>
    </div>
  );
}

// ── Pitch intro: "Not another chatbot" (3 slides) ───────────────────────────

export function AgentPitchIntroStep() {
  const { survey, pitchSlide, accent } = useOnboarding();
  const time = useMemo(
    () => researchTimeEstimates(resolveResearchTimeBucket(survey.researchTimeBucket)),
    [survey.researchTimeBucket]
  );

  const markers = [
    {
      icon: Clock,
      color: '#f97316',
      lines: [
        <>
          Get back <strong>{time.reclaimYears}+ {yearsWord(time.reclaimYears)}</strong>
        </>,
        'of your life',
      ],
      iconTrailing: false,
    },
    {
      icon: CalendarClock,
      color: '#22c55e',
      lines: [
        <>
          Hand off <strong>~{time.reclaimHoursPerWeek} hrs a week</strong>
        </>,
        'of scores and line checks',
      ],
      iconTrailing: true,
    },
    {
      icon: Cpu,
      color: '#ef4444',
      lines: ['Every slate screened', <><strong>24/7</strong>, five leagues</>],
      iconTrailing: false,
    },
    {
      icon: TrendingUp,
      color: '#3b82f6',
      lines: ['Model vs Vegas', <>on <strong>every</strong> line</>],
      iconTrailing: true,
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
            <p className="mb-5 text-center text-lg font-bold text-white">With WagerProof you can:</p>
            <div className="flex flex-col gap-6 px-1">
              {markers.map((marker, index) => (
                <OnboardingMarkerRow
                  key={index}
                  icon={marker.icon}
                  lines={marker.lines}
                  color={marker.color}
                  iconTrailing={marker.iconTrailing}
                  index={index}
                />
              ))}
            </div>
            <p className="mt-5 text-center text-xs text-white/40">Time estimates from your answers. Results vary.</p>
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
            <WinRateCurves accent={accent} />
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
            <div
              className="dark rounded-[22px] p-2.5"
              style={{
                background: `${accent}24`,
                boxShadow: `inset 0 0 0 1px ${accent}59`,
              }}
            >
              <OutliersTrendCard
                card={ONBOARDING_EXAMPLE_TREND_CARD}
                sport="nfl"
                displayMode="expanded"
                interactive={false}
              />
            </div>
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
