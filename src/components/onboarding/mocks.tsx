/**
 * Sample-data visuals shared by the onboarding pitch pages and the custom
 * paywall — mock leaderboard, trend (outliers) card, pick tickets and the
 * illustrative win-rate curves. All data here is clearly-labeled sample data,
 * copied from the iOS onboarding so both platforms pitch identically.
 */
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { PixelSpriteAvatar } from '@/components/agents/split/PixelSpriteAvatar';
import type { OutliersTrendsCard } from '@/features/outliers/types';
import { getAvatarBackground, getPrimaryColor } from '@/utils/agentColors';

// ── Mock leaderboard (OnboardingLeaderboardPage data) ────────────────────────

export interface MockLeaderboardRow {
  rank: number;
  name: string;
  avatarColor: string;
  sports: string[];
  record: string;
  netUnits: number;
  winRate: number;
  streak: number;
  spriteIndex: number;
}

export const MOCK_LEADERBOARD: MockLeaderboardRow[] = [
  { rank: 1, name: 'Sharp Signal', avatarColor: 'gradient:#22C55E,#0EA5E9', sports: ['NFL', 'NBA'], record: '48-30', netUnits: 21.4, winRate: 0.615, streak: 7, spriteIndex: 2 },
  { rank: 2, name: 'Fade the Public', avatarColor: 'gradient:#F97316,#EF4444', sports: ['NFL'], record: '51-35-2', netUnits: 14.2, winRate: 0.593, streak: 4, spriteIndex: 6 },
  { rank: 3, name: 'Totals Lab', avatarColor: 'gradient:#8B5CF6,#EC4899', sports: ['NBA', 'MLB'], record: '44-32', netUnits: 9.8, winRate: 0.579, streak: 3, spriteIndex: 4 },
  { rank: 4, name: 'Dog Money', avatarColor: '#3B82F6', sports: ['MLB'], record: '39-31', netUnits: 6.1, winRate: 0.557, streak: 2, spriteIndex: 1 },
  { rank: 5, name: 'Prime Time', avatarColor: '#EAB308', sports: ['NFL', 'CFB'], record: '41-34', netUnits: 4.5, winRate: 0.547, streak: 0, spriteIndex: 5 },
];

export function MockAvatarTile({ color, spriteIndex, size = 44 }: { color: string; spriteIndex: number; size?: number }) {
  return (
    <div
      className="grid shrink-0 place-items-center overflow-hidden rounded-xl"
      style={{
        width: size,
        height: size,
        background: getAvatarBackground(color),
        boxShadow: `0 3px 14px ${getPrimaryColor(color)}40`,
      }}
    >
      <PixelSpriteAvatar spriteIndex={spriteIndex} height={size - Math.round(size * 0.12)} />
    </div>
  );
}

export function MockLeaderboardCard({ animated = true }: { animated?: boolean }) {
  return (
    <div className="w-full rounded-2xl border border-white/12 bg-white/[0.06] p-3">
      <div className="mb-2 flex gap-1.5 px-1">
        {['Win Rate', 'Net Units', 'This Season'].map((pill, i) => (
          <span
            key={pill}
            className={cn(
              'rounded-full px-3 py-1 text-[11px] font-bold',
              i === 0 ? 'bg-white text-black' : 'bg-white/10 text-white/60'
            )}
          >
            {pill}
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        {MOCK_LEADERBOARD.map((row, index) => (
          <motion.div
            key={row.name}
            initial={animated ? { opacity: 0, x: 24 } : false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: 0.12 * index }}
            className="flex items-center gap-3 rounded-xl bg-black/25 px-3 py-2.5"
          >
            <span className="w-5 text-center text-sm font-extrabold text-white/50">{row.rank}</span>
            <MockAvatarTile color={row.avatarColor} spriteIndex={row.spriteIndex} size={38} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-bold text-white">{row.name}</p>
                {row.streak >= 7 && (
                  <span className="shrink-0 rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-extrabold text-orange-400">
                    {row.streak} in a row 🔥
                  </span>
                )}
              </div>
              <p className="text-[11px] text-white/50">
                {row.sports.join(' · ')} · {row.record}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-extrabold text-green-400">+{row.netUnits.toFixed(2)}u</p>
              <p className="text-[11px] text-white/50">{(row.winRate * 100).toFixed(1)}%</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Onboarding outliers example (iOS OnboardingAgentPitchPages.exampleTrendCard)

/** Real OutliersTrendsCard shape used by pitch slide 2 + paywall outliers page. */
export const ONBOARDING_EXAMPLE_TREND_CARD: OutliersTrendsCard = {
  id: 'onboarding-trend-example',
  gameId: 'onboarding-trend-example',
  matchupLabel: 'BUF @ KC',
  subjectKind: 'team',
  subjectName: 'Kansas City Chiefs',
  subjectDetail: 'Team trends',
  teamAbbr: 'KC',
  playerId: null,
  marketKey: 'spread',
  betTypeLabel: 'Spread',
  trendValue: 0.8,
  trendSampleN: 5,
  headshotUrl: null,
  isPlayerOverflow: false,
  bettingLines: [
    {
      id: 'onb-line-1',
      label: 'Spread',
      lineText: 'KC -2.5',
      oddsText: '-108',
      bookName: null,
      bookLogoUrl: null,
      teamAbbr: 'KC',
    },
  ],
  rows: [
    { id: 'onb-r1', text: 'Won 5 of last 5 vs this opponent', coverageNote: null, dominantPct: 1.0, sampleN: 5 },
    { id: 'onb-r2', text: 'Covered 6 of last 6 as favorite', coverageNote: null, dominantPct: 1.0, sampleN: 6 },
    { id: 'onb-r3', text: 'Won 4 of last 4 road games', coverageNote: null, dominantPct: 1.0, sampleN: 4 },
    { id: 'onb-r4', text: 'Covered 5 of last 5 in division', coverageNote: null, dominantPct: 1.0, sampleN: 5 },
    { id: 'onb-r5', text: 'Covered 7 of last 8 primetime games', coverageNote: null, dominantPct: 0.88, sampleN: 8 },
    { id: 'onb-r6', text: 'Over hit in 6 of last 7 at home', coverageNote: null, dominantPct: 0.86, sampleN: 7 },
  ],
};

// ── Mock pick tickets ────────────────────────────────────────────────────────

export function MockPickTicket({
  selection,
  odds,
  matchup,
  reasoning,
  blurred = false,
}: {
  selection: string;
  odds: string;
  matchup: string;
  reasoning?: string;
  blurred?: boolean;
}) {
  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-white/12 bg-white/[0.06] p-4">
      <div className={cn(blurred && 'select-none blur-[7px]')}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-white/45">{matchup}</p>
            <p className="text-base font-extrabold text-white">{selection}</p>
          </div>
          <span className="rounded-lg bg-black/30 px-2.5 py-1.5 text-sm font-extrabold text-white">{odds}</span>
        </div>
        {reasoning && <p className="mt-2 text-xs leading-relaxed text-white/60">{reasoning}</p>}
      </div>
      {blurred && (
        <div className="absolute inset-0 grid place-items-center">
          <span className="rounded-full bg-black/60 px-3 py-1.5 text-[11px] font-bold text-white/90">
            Unlocks after tonight's research run
          </span>
        </div>
      )}
    </div>
  );
}

export function MockParlayTicket() {
  const legs = [
    { text: 'DET Lions -3.5', odds: '-110' },
    { text: 'BOS Celtics ML', odds: '-135' },
    { text: 'Over 47.5 · BUF @ KC', odds: '-105' },
  ];
  return (
    <div className="w-full rounded-2xl border border-white/12 bg-white/[0.06] p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-extrabold text-white">3-leg parlay</p>
        <span className="rounded-lg bg-green-500/15 px-2.5 py-1 text-sm font-extrabold text-green-400">+595</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {legs.map((leg) => (
          <div key={leg.text} className="flex items-center justify-between rounded-lg bg-black/25 px-3 py-2">
            <p className="text-xs font-semibold text-white/85">{leg.text}</p>
            <span className="text-xs font-bold text-white/55">{leg.odds}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-white/55">
        Correlated edges with model support on every leg — reasoning attached to each pick.
      </p>
    </div>
  );
}

// ── Illustrative win-rate curves (pitch slide 1) ─────────────────────────────

const CURVE_TOP = 36; // leave room above peaks for the agents label
const CURVE_BOTTOM = 22;

function gaussianPoints(mean: number, sigma: number, width: number, height: number) {
  const domainMin = 15;
  const domainMax = 90;
  const steps = 60;
  const pts: { x: number; y: number }[] = [];
  const plotHeight = height - CURVE_TOP - CURVE_BOTTOM;
  for (let i = 0; i <= steps; i++) {
    const x = domainMin + ((domainMax - domainMin) * i) / steps;
    const y = Math.exp(-((x - mean) ** 2) / (2 * sigma ** 2));
    const px = ((x - domainMin) / (domainMax - domainMin)) * width;
    const py = height - y * plotHeight - CURVE_BOTTOM;
    pts.push({ x: px, y: py });
  }
  return pts;
}

function linePath(pts: { x: number; y: number }[]) {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

function areaPath(pts: { x: number; y: number }[], height: number) {
  if (!pts.length) return '';
  const top = linePath(pts);
  const last = pts[pts.length - 1];
  const first = pts[0];
  const base = height - CURVE_BOTTOM;
  return `${top} L${last.x.toFixed(1)},${base.toFixed(1)} L${first.x.toFixed(1)},${base.toFixed(1)} Z`;
}

export function WinRateCurves({ accent = '#22c55e' }: { accent?: string }) {
  const width = 320;
  const height = 200;
  const xFor = (v: number) => ((v - 15) / (90 - 15)) * width;
  const bettors = gaussianPoints(40, 9, width, height);
  const agents = gaussianPoints(65, 6.5, width, height);
  return (
    <div className="relative w-full rounded-2xl border border-white/12 bg-white/[0.06] p-4 pt-8">
      <span className="absolute right-3 top-3 rounded-full bg-white/10 px-2 py-0.5 text-[8px] font-extrabold tracking-[0.06em] text-white/45">
        ILLUSTRATIVE
      </span>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full">
        {/* Peak guides at 40% / 65% — start below the agents label */}
        <line
          x1={xFor(40)}
          x2={xFor(40)}
          y1={CURVE_TOP}
          y2={height - CURVE_BOTTOM}
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <line
          x1={xFor(65)}
          x2={xFor(65)}
          y1={CURVE_TOP}
          y2={height - CURVE_BOTTOM}
          stroke={`${accent}66`}
          strokeWidth={1}
          strokeDasharray="4 4"
        />

        <path d={areaPath(bettors, height)} fill="rgba(255,255,255,0.16)" />
        <path d={linePath(bettors)} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={2} strokeLinecap="round" />

        <path d={areaPath(agents, height)} fill={accent} fillOpacity={0.28} />
        <path d={linePath(agents)} fill="none" stroke={accent} strokeWidth={2.5} strokeLinecap="round" />

        <text x={xFor(40)} y={height - 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="rgba(255,255,255,0.55)">
          Most bettors ~40%
        </text>
        {/* Baseline sits well above the curve peak (CURVE_TOP) so glyphs don't kiss the stroke */}
        <text x={xFor(65)} y={18} textAnchor="middle" fontSize={11} fontWeight={800} fill={accent}>
          Our agents ~65%
        </text>
      </svg>
    </div>
  );
}

// ── Paywall reviews ──────────────────────────────────────────────────────────

export const PAYWALL_REVIEWS = [
  { title: 'BEST AI FOR SPORTS BETTING', body: 'The agents do the digging for me. I just read the write-up and decide. Total game-changer.', name: 'Jake R.' },
  { title: 'Finally, the "why" behind picks', body: 'Every pick shows its reasoning. No more blind tailing — I can see exactly what the model sees.', name: 'Sarah M.' },
  { title: 'Gave me my evenings back', body: 'I used to grind box scores for hours. My agent runs it all overnight and the shortlist is waiting.', name: 'Marcus T.' },
  { title: 'Transparent and honest', body: 'They track every result publicly. Win or lose, nothing gets hidden. That earned my trust.', name: 'Priya K.' },
];
