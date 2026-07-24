/**
 * Sample-data visuals shared by the onboarding pitch pages and the custom
 * paywall — mock leaderboard, trend (outliers) card, pick tickets and the
 * illustrative win-rate curves. All data here is clearly-labeled sample data,
 * copied from the iOS onboarding so both platforms pitch identically.
 */
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { PixelSpriteAvatar } from '@/components/agents/split/PixelSpriteAvatar';
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

// ── Mock trend / outliers card (pitch slide 2 data) ──────────────────────────

const TREND_ROWS = [
  { text: 'Won 5 of last 5 vs this opponent', pct: 100 },
  { text: 'Covered 6 of last 6 as favorite', pct: 100 },
  { text: 'Won 4 of last 4 road games', pct: 100 },
  { text: 'Covered 5 of last 5 in division', pct: 100 },
  { text: 'Covered 7 of last 8 primetime games', pct: 88 },
  { text: 'Over hit in 6 of last 7 at home', pct: 86 },
];

export function MockTrendCard() {
  return (
    <div className="w-full rounded-2xl border border-white/12 bg-white/[0.06] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-white/45">BUF @ KC</p>
          <p className="text-sm font-bold text-white">Kansas City Chiefs</p>
          <p className="text-[11px] text-white/50">Team trends</p>
        </div>
        <div className="rounded-xl bg-black/30 px-3 py-2 text-center">
          <p className="text-sm font-extrabold text-white">KC -2.5</p>
          <p className="text-[11px] text-white/50">-108</p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {TREND_ROWS.map((row, index) => (
          <motion.div
            key={row.text}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.08 * index }}
            className="flex items-center gap-3"
          >
            <span
              className={cn(
                'w-11 shrink-0 rounded-md px-1.5 py-0.5 text-center text-[11px] font-extrabold',
                row.pct >= 100 ? 'bg-green-500/20 text-green-400' : 'bg-emerald-500/15 text-emerald-300'
              )}
            >
              {row.pct}%
            </span>
            <p className="text-xs text-white/80">{row.text}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

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

function gaussianPath(mean: number, sigma: number, width: number, height: number): string {
  const points: string[] = [];
  const domainMin = 15;
  const domainMax = 90;
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const x = domainMin + ((domainMax - domainMin) * i) / steps;
    const y = Math.exp(-((x - mean) ** 2) / (2 * sigma ** 2));
    const px = ((x - domainMin) / (domainMax - domainMin)) * width;
    const py = height - y * (height - 12) - 4;
    points.push(`${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`);
  }
  return points.join(' ');
}

export function WinRateCurves() {
  const width = 320;
  const height = 140;
  const xFor = (v: number) => ((v - 15) / (90 - 15)) * width;
  return (
    <div className="w-full rounded-2xl border border-white/12 bg-white/[0.06] p-4">
      <span className="mb-2 inline-block rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-extrabold tracking-widest text-white/55">
        ILLUSTRATIVE
      </span>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full">
        <path d={gaussianPath(40, 9, width, height)} fill="none" stroke="#94a3b8" strokeWidth={2.5} strokeLinecap="round" opacity={0.8} />
        <path d={gaussianPath(65, 6.5, width, height)} fill="none" stroke="#22c55e" strokeWidth={3} strokeLinecap="round" />
        <text x={xFor(40)} y={height - 2} textAnchor="middle" fontSize={11} fontWeight={700} fill="#94a3b8">
          Most bettors ~40%
        </text>
        <text x={xFor(65)} y={16} textAnchor="middle" fontSize={11} fontWeight={800} fill="#22c55e">
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
