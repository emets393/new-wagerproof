/**
 * Feature carousel pages for the custom paywall — web port of the iOS
 * CustomPaywallFeaturePages: value, social proof, Agent HQ, leaderboard,
 * picks, outliers and community/connectors.
 */
import React from 'react';
import { Star } from 'lucide-react';
import { PixelSpriteAvatar } from '@/components/agents/split/PixelSpriteAvatar';
import {
  MockLeaderboardCard,
  MockParlayTicket,
  MockPickTicket,
  MockTrendCard,
  PAYWALL_REVIEWS,
} from '@/components/onboarding/mocks';
import {
  RESEARCH_TIME_INFO,
  money,
  resolveResearchTimeBucket,
  resolveStakesBucket,
  stakesEstimates,
} from '@/components/onboarding/research';
import type { ResearchTimeBucket, StakesBucket } from '@/components/onboarding/research';

export interface PaywallPersonalization {
  agentName?: string;
  spriteIndex?: number | null;
  avatarColor?: string;
  researchTimeBucket?: ResearchTimeBucket | string;
  weeklyStakesBucket?: StakesBucket | string;
}

function PageShell({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col items-center gap-4">
      <h2 className="max-w-md text-center text-xl font-extrabold leading-snug text-white sm:text-2xl">{title}</h2>
      <div className="w-full max-w-md flex-1">{children}</div>
    </div>
  );
}

// ── Page 0: value ────────────────────────────────────────────────────────────

function BeforeAfterBars({ personalization }: { personalization: PaywallPersonalization }) {
  const bucket = resolveResearchTimeBucket(personalization.researchTimeBucket);
  const hoursPerWeek = Math.round(RESEARCH_TIME_INFO[bucket].hoursPerDay * 7);
  const afterHours = Math.max(1, Math.round(hoursPerWeek * 0.25));
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-2xl border border-white/12 bg-white/[0.06] p-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-white/45">Before</p>
        <p className="mt-1 text-2xl font-extrabold text-red-400">~40%</p>
        <p className="text-[11px] text-white/55">typical win rate</p>
        <div className="mt-3 h-1.5 w-full rounded-full bg-white/10">
          <div className="h-full w-[40%] rounded-full bg-red-400/80" />
        </div>
        <p className="mt-2 text-[11px] text-white/55">{hoursPerWeek} hrs/week checking apps</p>
      </div>
      <div className="rounded-2xl border border-green-500/30 bg-green-500/[0.08] p-4">
        <p className="text-[11px] font-bold uppercase tracking-wide text-green-400/80">After</p>
        <p className="mt-1 text-2xl font-extrabold text-green-400">~65%</p>
        <p className="text-[11px] text-white/55">top-agent win rate</p>
        <div className="mt-3 h-1.5 w-full rounded-full bg-white/10">
          <div className="h-full w-[65%] rounded-full bg-green-400" />
        </div>
        <p className="mt-2 text-[11px] text-white/55">~{afterHours} hrs/week — agents run the rest</p>
      </div>
    </div>
  );
}

function ValuePage({ personalization }: { personalization: PaywallPersonalization }) {
  const stakes = stakesEstimates(resolveStakesBucket(personalization.weeklyStakesBucket));
  const bullets = [
    `Protect your ${money(stakes.yearlyAction)} — every slate screened against the model before you fire`,
    'Find high multiple parlays with correlated, model-backed edges',
    'Public leaderboards — tail agents with real, graded receipts',
  ];
  return (
    <PageShell
      title={
        <>
          Check <em className="not-italic text-white/60 line-through decoration-2">less</em>. Enjoy{' '}
          <strong className="text-green-400">more</strong>.
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <BeforeAfterBars personalization={personalization} />
        <div className="flex flex-col gap-2">
          {bullets.map((bullet) => (
            <div key={bullet} className="flex items-start gap-2.5 rounded-xl bg-white/[0.05] px-3.5 py-2.5">
              <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-green-500/20 text-[10px] font-black text-green-400">
                ✓
              </span>
              <p className="text-xs leading-relaxed text-white/80">{bullet}</p>
            </div>
          ))}
        </div>
        <p className="text-center text-[10px] text-white/35">Illustrative — results vary. Estimates from your answers.</p>
      </div>
    </PageShell>
  );
}

// ── Page 1: social proof ─────────────────────────────────────────────────────

function SocialPage() {
  return (
    <PageShell title="Loved by bettors who want the why">
      <div className="flex flex-col gap-2.5">
        {PAYWALL_REVIEWS.map((review) => (
          <div key={review.title} className="rounded-2xl border border-white/12 bg-white/[0.06] p-3.5 text-left">
            <div className="mb-1 flex items-center gap-1">
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-white">{review.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-white/65">{review.body}</p>
            <p className="mt-1.5 text-[11px] font-semibold text-white/40">{review.name}</p>
          </div>
        ))}
      </div>
    </PageShell>
  );
}

// ── Page 2: Agent HQ ─────────────────────────────────────────────────────────

function AgentHQPage({ personalization }: { personalization: PaywallPersonalization }) {
  const name = personalization.agentName?.trim();
  const roster = [
    { sprite: personalization.spriteIndex ?? 2, label: 'WORKING', color: '#f97316' },
    { sprite: 6, label: 'THINKING', color: '#8b5cf6' },
    { sprite: 4, label: 'PICKS READY', color: '#22c55e' },
  ];
  return (
    <PageShell title={name ? `${name} is already clocked in` : 'Your agents clock in around the clock'}>
      <div className="relative w-full overflow-hidden rounded-2xl border border-white/12 bg-[#0f1118] p-6">
        <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full border border-white/20 bg-black/40 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-md">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
          Agent HQ — Live
        </span>
        <div className="mt-7 flex items-end justify-center gap-8">
          {roster.map((agent, index) => (
            <div key={index} className="flex flex-col items-center gap-2">
              <span className="rounded px-1.5 py-0.5 text-[9px] font-extrabold text-white" style={{ background: agent.color }}>
                {agent.label}
              </span>
              <PixelSpriteAvatar spriteIndex={agent.sprite ?? 2} height={72} />
              <div className="h-2 w-14 rounded bg-white/10" />
            </div>
          ))}
        </div>
        <p className="mt-5 text-center text-xs text-white/55">
          A team of AI analysts working every board, 24/7 — so you never start from a blank page.
        </p>
      </div>
    </PageShell>
  );
}

// ── Page 3: leaderboard ──────────────────────────────────────────────────────

function LeaderboardPage() {
  return (
    <PageShell title="Tail picks from the top strategies others created">
      <MockLeaderboardCard animated={false} />
    </PageShell>
  );
}

// ── Page 4: picks ────────────────────────────────────────────────────────────

function PicksPage() {
  return (
    <PageShell title="Picks that show their work">
      <div className="flex flex-col gap-3">
        <MockPickTicket
          matchup="BUF @ KC · NFL"
          selection="KC -2.5"
          odds="-108"
          reasoning="Model gives KC a 61% cover probability against this number. Line moved from -3 with sharp money confirming — public still leaning the dog."
        />
        <MockParlayTicket />
      </div>
    </PageShell>
  );
}

// ── Page 5: outliers ─────────────────────────────────────────────────────────

function OutliersPage() {
  return (
    <PageShell title="The signals most bettors miss">
      <MockTrendCard />
    </PageShell>
  );
}

// ── Page 6: community / connectors ───────────────────────────────────────────

const CONNECTORS = ['Claude', 'ChatGPT', 'Gemini', 'Grok', 'Codex'];

function CommunityPage() {
  return (
    <PageShell title="Your data, wherever you research">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#5865F2]/20 text-xl">💬</span>
            <div>
              <p className="text-sm font-bold text-white">Discord community</p>
              <p className="text-xs text-white/55">Private channels with other data-driven bettors</p>
            </div>
          </div>
          <span className="rounded-full bg-green-500/15 px-2.5 py-1 text-[11px] font-extrabold text-green-400">Included</span>
        </div>
        <div className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-4">
          <p className="text-sm font-bold text-white">AI connectors</p>
          <p className="mt-0.5 text-xs text-white/55">Pipe WagerProof data straight into your favorite assistant</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {CONNECTORS.map((connector) => (
              <span key={connector} className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/85">
                {connector}
              </span>
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

// ── Export ───────────────────────────────────────────────────────────────────

export function getPaywallFeaturePages(personalization: PaywallPersonalization): React.ReactNode[] {
  return [
    <ValuePage key="value" personalization={personalization} />,
    <SocialPage key="social" />,
    <AgentHQPage key="hq" personalization={personalization} />,
    <LeaderboardPage key="leaderboard" />,
    <PicksPage key="picks" />,
    <OutliersPage key="outliers" />,
    <CommunityPage key="community" />,
  ];
}
