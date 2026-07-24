import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  CheckCircle2,
  LineChart,
  Medal,
  Moon,
  Plane,
  ShieldCheck,
  Trophy,
  Users,
} from 'lucide-react';
import claudeIcon from '../../../wagerproof-ios-native/Wagerproof/Assets.xcassets/AIClaudeIcon.imageset/claude.jpg';
import chatGPTIcon from '../../../wagerproof-ios-native/Wagerproof/Assets.xcassets/AIChatGPTIcon.imageset/chatgpt.jpg';
import geminiIcon from '../../../wagerproof-ios-native/Wagerproof/Assets.xcassets/AIGeminiIcon.imageset/gemini.jpg';
import grokIcon from '../../../wagerproof-ios-native/Wagerproof/Assets.xcassets/AIGrokIcon.imageset/grok.jpg';
import codexIcon from '../../../wagerproof-ios-native/Wagerproof/Assets.xcassets/AICodexIcon.imageset/codex.jpg';
import { cn } from '@/lib/utils';
import { AgentHQ } from '@/components/agents/split/AgentHQ';
import { PixelSpriteAvatar } from '@/components/agents/split/PixelSpriteAvatar';
import { buildDemoAgents } from '@/components/agents/demoAgents';
import { teamVisuals } from '@/features/outliers/teamVisuals';
import {
  RESEARCH_TIME_INFO,
  money,
  resolveResearchTimeBucket,
  resolveStakesBucket,
  stakesEstimates,
} from '@/components/onboarding/research';
import type { PaywallPersonalization } from './CustomPaywallFeaturePages';

const ACCENT = '#22C55E';

// Design height every carousel slide is laid out at before scaling to the slot.
const FEATURE_PAGE_HEIGHT = 510;

export function PaywallFeatureFrame({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb: string;
  children: ReactNode;
}) {
  // Laid out at a fixed design height and scaled down when the slot is shorter,
  // so the visual can be sized for a roomy paywall instead of the worst case.
  return (
    <FitToHeight designHeight={FEATURE_PAGE_HEIGHT}>
      <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-4 px-3 sm:px-4">
        <div className="flex h-[360px] min-h-0 w-full shrink-0 items-center justify-center">
          {children}
        </div>
        <div className="w-full shrink-0 text-center">
          <h2 className="mx-auto max-w-[560px] text-balance text-[25px] font-bold leading-[1.08] tracking-[-0.02em] text-[#F4F6F5] sm:text-[29px]">
            {title}
          </h2>
          <p className="mx-auto mt-2 max-w-[470px] text-balance text-[14.5px] leading-[1.4] text-[#A3AAA6] sm:text-[16.5px]">
            {blurb}
          </p>
        </div>
      </div>
    </FitToHeight>
  );
}

/**
 * Renders children at a fixed design height and uniformly scales them down when
 * the carousel slot is shorter (short laptop windows). Keeps one spacing rhythm
 * instead of letting flex squeeze bands until they overlap.
 */
function FitToHeight({ designHeight, children }: { designHeight: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const available = element.clientHeight;
      if (available > 0) setScale(Math.min(1, available / designHeight));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [designHeight]);

  return (
    <div ref={ref} className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden">
      {/* Inner width is pre-divided by the scale so it still fills the slot after
          transform; shrink-0 keeps flex from undoing that over-wide box. */}
      <div
        className="shrink-0"
        style={{
          // Always the design height — a taller slot centers it rather than
          // stretching the charts (tall windows used to blow them up).
          height: designHeight,
          width: `${100 / scale}%`,
          transform: `scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function TrendChart({
  tint,
  rising,
  active,
}: {
  tint: string;
  rising: boolean;
  active: boolean;
}) {
  const bars = rising ? [0.3, 0.22, 0.36, 0.26] : [0.82, 0.68, 0.92, 0.76];
  const path = rising
    ? 'M4 76 C22 63,28 58,44 61 S66 43,84 47 S110 28,130 24 S158 10,182 4'
    : 'M4 7 C20 18,29 27,45 23 S66 39,83 42 S110 55,130 59 S159 72,182 78';

  // Fills whatever height the parent gives it — the paywall carousel slot is
  // short, so a fixed-height chart is what used to push this slide out of view.
  return (
    <div className="relative min-h-[44px] w-full flex-1">
      <div className="absolute inset-x-0 top-0 h-px bg-white/[0.07]" />
      <div className="absolute inset-x-0 bottom-[13px] top-1 flex items-end gap-2">
        {bars.map((height, index) => (
          <motion.span
            key={index}
            className="min-w-0 flex-1 rounded-t-[3px]"
            style={{ background: `linear-gradient(to top, ${tint}8c, ${tint})` }}
            initial={{ height: 3 }}
            animate={{ height: active ? `${height * 100}%` : 3 }}
            transition={{ type: 'spring', stiffness: 170, damping: 20, delay: index * 0.07 }}
          />
        ))}
      </div>
      {/* Explicit height: a viewBox gives the SVG an intrinsic ratio, so
          top+bottom alone would leave height:auto and overflow the card. */}
      <svg
        className="absolute inset-x-1 top-1 h-[calc(100%-17px)] w-[calc(100%-8px)] overflow-visible"
        viewBox="0 0 186 82"
        preserveAspectRatio="none"
      >
        <motion.path
          d={path}
          fill="none"
          stroke={rising ? '#8EF0B6' : '#FF8F8F'}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: active ? 1 : 0, opacity: active ? 1 : 0 }}
          transition={{ duration: 0.7, delay: 0.25, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 4px ${rising ? '#8EF0B6' : '#FF8F8F'})` }}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex justify-around font-mono text-[8px] font-bold text-white/30">
        {['M', 'T', 'W', 'T'].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}
      </div>
    </div>
  );
}

export function BeforeAfterHero({
  personalization,
  active,
}: {
  personalization: PaywallPersonalization;
  active: boolean;
}) {
  const bucket = resolveResearchTimeBucket(personalization.researchTimeBucket);
  const beforeHours = RESEARCH_TIME_INFO[bucket].hoursPerDay * 7;
  const afterHours = Math.max(0.5, beforeHours * 0.25);
  const stakes = stakesEstimates(resolveStakesBucket(personalization.weeklyStakesBucket));

  const benefits = [
    {
      icon: ShieldCheck,
      lead: stakes.yearlyAction > 0 ? `Protect your ${money(stakes.yearlyAction)}` : 'Hours back',
      rest: stakes.yearlyAction > 0 ? ' in projected bets this year' : ' every week',
    },
    { icon: LineChart, lead: 'Find high multiple parlays', rest: ' in seconds' },
    { icon: CheckCircle2, lead: 'Public leaderboards', rest: ' with real graded wins you can copy' },
  ];

  const columns = [
    { phase: 'Before', rate: 25, hours: beforeHours, tint: '#EF4444', rising: false },
    { phase: 'After', rate: 68, hours: afterHours, tint: ACCENT, rising: true },
  ];

  // Opal-style layout: Before/After captions sit above one shared stats panel,
  // then the headline, then the benefit rows. Laid out at a fixed design height
  // and scaled to whatever the carousel slot allows, so nothing ever collides.
  return (
    <FitToHeight designHeight={FEATURE_PAGE_HEIGHT}>
      <div className="flex h-full min-h-0 w-full flex-col gap-3 px-2 sm:gap-4 sm:px-4">
        <div className="grid shrink-0 grid-cols-2">
          {columns.map((item) => (
            <div key={item.phase} className="text-center">
              <p className="text-[24px] font-semibold leading-none tracking-[-0.02em] text-white sm:text-[28px]">
                {item.phase}
              </p>
              <p className="mt-1.5 text-[15px] font-black leading-none tracking-tight text-white/85 sm:text-[17px]">
                Wager<span className="text-[#22C55E]">Proof</span>
              </p>
            </div>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-2 overflow-hidden rounded-[18px] border border-white/[0.07] bg-white/[0.028]">
          {columns.map((item, index) => (
            <div
              key={item.phase}
              className={cn(
                'flex min-h-0 flex-col px-3 py-3 sm:px-4',
                index === 1 && 'border-l border-white/[0.07]'
              )}
            >
              <div className="shrink-0">
                <p className="font-mono text-[9.5px] font-black tracking-[0.08em] text-white/45 sm:text-[11px]">
                  WIN RATE
                </p>
                <p className="font-mono text-[28px] font-black leading-none sm:text-[33px]" style={{ color: item.tint }}>
                  {item.rate}%
                </p>
                <p className="mt-2.5 font-mono text-[9.5px] font-black tracking-[0.08em] text-white/45 sm:mt-3 sm:text-[11px]">
                  APP TIME
                </p>
                <p className="font-mono text-[20px] font-black leading-none sm:text-[24px]" style={{ color: item.tint }}>
                  {item.hours >= 10 ? Math.round(item.hours) : item.hours.toFixed(1)}
                  <span className="ml-1 text-[13px] sm:text-[14px]">hrs/wk</span>
                </p>
              </div>
              <div className="mt-2.5 flex min-h-0 flex-1 flex-col sm:mt-3">
                <TrendChart tint={item.tint} rising={item.rising} active={active} />
              </div>
            </div>
          ))}
        </div>

        <p className="shrink-0 text-balance text-center text-[26px] font-medium leading-none tracking-[-0.025em] text-white sm:text-[30px]">
          Check <em className="font-thin text-white/70">less</em>. Enjoy <strong className="font-black">more</strong>.
        </p>

        <div className="mx-auto flex w-full max-w-[440px] shrink-0 flex-col gap-3 sm:gap-3.5">
          {benefits.map(({ icon: Icon, lead, rest }) => (
            <div key={lead} className="flex items-center gap-3 text-white">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-emerald-500/15 text-emerald-400 sm:h-10 sm:w-10">
                <Icon className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
              </span>
              <p className="text-left text-[15px] leading-tight sm:text-[17px]">
                <strong className="font-bold">{lead}</strong>{rest}
              </p>
            </div>
          ))}
        </div>
      </div>
    </FitToHeight>
  );
}

const REVIEWS = [
  ['BEST AI FOR SPORTS BETTING', '“Takes complicated data and makes it easy to read.”', 'SpaceGuy4'],
  ['LOVE THIS APP', '“Tons of data for every game.”', 'TendyBoi'],
  ['LINE SHOPPING FINALLY CLICKS', '“The model-versus-market view makes it obvious when a line is worth taking.”', 'Marcus T.'],
  ['MY PARLAYS HAVE A PROCESS', '“I can see why every leg made the ticket instead of blindly stacking picks.”', 'Julien R.'],
] as const;

export function SocialProofHero({ active }: { active: boolean }) {
  return (
    <div className="w-full max-w-[560px]">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: active ? 1 : 0.6, y: active ? 0 : 8 }}
        className="mb-2.5 flex h-[72px] items-center gap-2.5 rounded-[18px] border border-white/10 bg-white/[0.05] px-5"
      >
        <span className="text-2xl"></span>
        <span className="text-[34px] font-black leading-none text-white">4.7</span>
        <span className="flex text-amber-400">{'★★★★★'}</span>
        <span className="ml-1 font-mono text-[9px] font-black tracking-[0.08em] text-white/45">LOVED BY THOUSANDS</span>
      </motion.div>
      <div className="grid grid-cols-2 gap-2">
        {REVIEWS.map(([title, body, name], index) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: active ? 1 : 0, y: active ? 0 : 12 }}
            transition={{ delay: index * 0.06 }}
            className="min-h-[136px] rounded-[17px] border border-white/10 bg-white/[0.045] p-3.5"
          >
            <p className="text-[10px] leading-none text-amber-400">★★★★★</p>
            <p className="mt-1.5 font-mono text-[9px] font-black tracking-[0.06em] text-white/75">{title}</p>
            <p className="mt-1 text-[12px] font-semibold leading-[1.25] text-white/90">{body}</p>
            <p className="mt-2 text-[10px] font-semibold text-white/25">{name}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function AgentHQHero({
  personalization,
}: {
  personalization: PaywallPersonalization;
}) {
  const agents = useMemo(
    () => buildDemoAgents({
      name: personalization.agentName,
      spriteIndex: personalization.spriteIndex,
      avatarColor: personalization.avatarColor,
    }),
    [personalization.agentName, personalization.spriteIndex, personalization.avatarColor],
  );

  return (
    <div className="relative aspect-[864/800] h-full max-h-[360px] w-auto max-w-full overflow-hidden rounded-[18px] border border-white/15 shadow-[0_18px_44px_rgba(0,0,0,0.3)]">
      <AgentHQ agents={agents} hideControls hideStats interactive={false} onSelectAgent={() => undefined} />
    </div>
  );
}

const LEADERS = [
  { sprite: 2, name: 'Sharp Signal', sport: 'NFL', record: '53–18', units: '+28.7u', rate: '74.6%', streak: 12 },
  { sprite: 6, name: 'Fade Finder', sport: 'NBA', record: '46–19', units: '+23.1u', rate: '70.8%', streak: 10 },
  { sprite: 4, name: 'Totals Lab', sport: 'MLB', record: '52–24', units: '+19.6u', rate: '68.4%', streak: 8 },
  { sprite: 1, name: 'Line Hawk', sport: 'CFB', record: '48–24', units: '+16.2u', rate: '66.7%', streak: 6 },
  { sprite: 7, name: 'Value Hunter', sport: 'NCAAB', record: '44–23', units: '+13.9u', rate: '65.7%', streak: 5 },
] as const;

const WON_PICKS = [
  {
    teams: ['BUF', 'KC'],
    matchup: 'BUF @ KC',
    selection: 'Bills ML',
    market: 'Moneyline',
    odds: '+105',
    units: '1.0u',
    confidence: 5,
    reasoning: 'Rest edge + stronger late-down profile',
  },
  {
    teams: ['BAL', 'CIN'],
    matchup: 'BAL @ CIN',
    selection: 'Ravens +3.5',
    market: 'Spread',
    odds: '-110',
    units: '1.0u',
    confidence: 4,
    reasoning: 'Model closes 2.1 points inside market',
  },
  {
    teams: ['DAL', 'PHI'],
    matchup: 'DAL @ PHI',
    selection: 'Over 47.5',
    market: 'Total',
    odds: '-105',
    units: '1.0u',
    confidence: 4,
    reasoning: 'Both offenses top five in early-down EPA',
  },
] as const;

function TeamLogo({ team }: { team: string }) {
  const visual = teamVisuals('nfl', team);
  return visual.logoUrl ? <img src={visual.logoUrl} alt="" className="h-5 w-5 object-contain" /> : <span>{team}</span>;
}

function MiniWonTicket({ pick, visible, delay }: { pick: typeof WON_PICKS[number]; visible: boolean; delay: number }) {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: visible ? 1 : 0, x: visible ? 0 : 70, scale: visible ? 1 : 0.96 }}
      transition={{ type: 'spring', stiffness: 220, damping: 24, delay }}
      className="relative flex min-w-0 flex-1 flex-col rounded-[12px] bg-gradient-to-b from-[#141927] to-[#0D101A] p-2 shadow-xl"
    >
      <span className="absolute right-2 top-2 rounded-full bg-emerald-500 px-1.5 py-0.5 font-mono text-[7px] font-black text-black">WON</span>
      <p className="font-mono text-[7px] font-black tracking-[0.07em] text-white/45">◈ NFL · {pick.matchup}</p>
      <div className="mt-3 flex items-center justify-between">
        <TeamLogo team={pick.teams[0]} /><span className="text-white/30">•</span><TeamLogo team={pick.teams[1]} />
      </div>
      <p className="mt-2 truncate text-[10px] font-black text-white">{pick.selection}</p>
      <p className="mt-1 line-clamp-2 min-h-[20px] flex-1 text-[7px] leading-[1.35] text-white/45">{pick.reasoning}</p>
      <div className="mt-2 grid grid-cols-3 border-t border-dashed border-white/10 pt-2 text-[6px] text-white/40">
        <span>MARKET<br/><b className="text-[7px] text-white/80">{pick.market}</b></span>
        <span className="text-center">ODDS<br/><b className="font-mono text-[7px] text-white">{pick.odds}</b></span>
        <span className="text-right">UNITS<br/><b className="font-mono text-[7px] text-emerald-400">{pick.units}</b></span>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="font-mono text-[6px] font-black tracking-[0.06em] text-white/35">CONFIDENCE</span>
        <span className="flex gap-0.5">
          {[0, 1, 2, 3, 4].map((dot) => (
            <span
              key={dot}
              className={`h-1 w-1 rounded-full ${dot < pick.confidence ? 'bg-emerald-400' : 'bg-white/15'}`}
            />
          ))}
        </span>
      </div>
    </motion.div>
  );
}

export function LeaderboardHero({ active }: { active: boolean }) {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!active) {
      setPhase(0);
      return;
    }
    if (reduceMotion) {
      setPhase(3);
      return;
    }
    let cancelled = false;
    const timers: number[] = [];
    const run = () => {
      setPhase(0);
      timers.push(window.setTimeout(() => !cancelled && setPhase(1), 1250));
      timers.push(window.setTimeout(() => !cancelled && setPhase(2), 1970));
      timers.push(window.setTimeout(() => !cancelled && setPhase(3), 2490));
      timers.push(window.setTimeout(() => !cancelled && run(), 5900));
    };
    run();
    return () => {
      cancelled = true;
      timers.forEach(window.clearTimeout);
    };
  }, [active, reduceMotion]);

  return (
    <div className="flex h-full max-h-[360px] w-full max-w-[560px] flex-col rounded-[24px] border border-white/10 bg-[#121513]/95 p-2.5 shadow-[0_18px_42px_rgba(0,0,0,0.32)] sm:p-3">
      <div className="mb-1.5 flex h-6 items-center font-mono text-[8px] font-black tracking-[0.07em]">
        {phase >= 1 ? (
          <><span className="text-emerald-400">● &nbsp; TOP AGENT SELECTED</span><span className="ml-auto text-white/35">{phase >= 2 ? '3 WON PICKS' : 'OPENING CARD'}</span></>
        ) : (
          <><span className="rounded-full bg-emerald-500 px-2 py-1 text-black">WIN %</span><span className="ml-1 rounded-full bg-white/[0.07] px-2 py-1 text-white/45">SEASON</span></>
        )}
      </div>
      <div className="flex items-center gap-1.5 rounded-[14px] border border-emerald-400/70 bg-emerald-500/10 px-2 py-1.5 shadow-[0_0_18px_rgba(34,197,94,0.16)]">
        <Trophy className="h-4 w-4 shrink-0 text-yellow-400" />
        <PixelSpriteAvatar spriteIndex={LEADERS[0].sprite} height={28} />
        <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold text-white">{LEADERS[0].name}</p><p className="font-mono text-[8px] font-black text-white/40">{LEADERS[0].sport}</p></div>
        <div className="text-right font-mono"><p className="text-[9px] text-white">{LEADERS[0].record}</p><p className="text-[8px] font-bold text-emerald-400">{LEADERS[0].units}</p></div>
        <span className="rounded-full bg-emerald-500 px-1.5 py-1 font-mono text-[8px] font-black text-black">{LEADERS[0].rate}</span>
        <span className="rounded-full bg-amber-500 px-1.5 py-1 font-mono text-[8px] font-black text-black">🔥 W{LEADERS[0].streak}</span>
      </div>
      <div className="relative mt-1.5 min-h-0 flex-1">
        <motion.div animate={{ opacity: phase >= 1 ? 0 : 1, y: phase >= 1 ? 10 : 0 }} className="absolute inset-0 flex flex-col gap-1">
          {LEADERS.slice(1).map((leader, index) => (
            <div key={leader.name} className="flex min-h-0 flex-1 items-center gap-1.5 rounded-[12px] border border-white/[0.05] bg-white/[0.025] px-2">
              <Medal className="h-3.5 w-3.5 shrink-0 text-[#CD8A4B]" />
              <PixelSpriteAvatar spriteIndex={leader.sprite} height={24} />
              <div className="min-w-0 flex-1"><p className="truncate text-[10px] font-bold text-white">{leader.name}</p><p className="font-mono text-[7px] text-white/35">{leader.sport}</p></div>
              <div className="text-right font-mono"><p className="text-[8px] text-white/80">{leader.record}</p><p className="text-[7px] text-emerald-400">{leader.units}</p></div>
              <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[7px] font-black text-emerald-400">{leader.rate}</span>
              <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 font-mono text-[7px] font-black text-amber-400">🔥 W{leader.streak}</span>
            </div>
          ))}
        </motion.div>
        <div className="absolute inset-0 flex gap-1.5 pt-1">
          {WON_PICKS.map((pick, index) => <MiniWonTicket key={pick.selection} pick={pick} visible={phase >= 2} delay={index * 0.12} />)}
        </div>
      </div>
    </div>
  );
}

function TicketLogoPair({ teams }: { teams: readonly [string, string] }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5"><TeamLogo team={teams[0]} /><span className="font-mono text-xs font-black text-white">{teams[0]}</span></div>
      <span className="text-white/20">• &nbsp; ◇ &nbsp; •</span>
      <div className="flex items-center gap-1.5"><TeamLogo team={teams[1]} /><span className="font-mono text-xs font-black text-white">{teams[1]}</span></div>
    </div>
  );
}

export function ReasonedPicksHero({ active }: { active: boolean }) {
  return (
    <div className="relative h-[310px] w-full max-w-[540px] sm:h-[350px]">
      <motion.div
        initial={false}
        animate={{ opacity: active ? 1 : 0, y: active ? 0 : 44, rotate: -2.2 }}
        transition={{ type: 'spring', stiffness: 180, damping: 22 }}
        className="absolute bottom-2 left-0 w-[49%] rounded-[18px] bg-gradient-to-b from-[#141927] to-[#0D101A] p-4 shadow-[0_18px_35px_rgba(0,0,0,0.42)]"
      >
        <p className="font-mono text-[9px] font-black tracking-[0.08em] text-white/45">◇ NFL</p>
        <div className="mt-5"><TicketLogoPair teams={['BAL', 'CIN']} /></div>
        <div className="my-4 border-t border-dashed border-white/10" />
        <p className="text-[15px] font-black text-white">Ravens +3.5</p>
        <div className="mt-2 flex justify-between text-[9px] text-white/45"><span>Market<br/><b className="text-white">Spread</b></span><span>Odds<br/><b className="font-mono text-white">−110</b></span></div>
        <p className="mt-3 text-[9px] leading-snug text-white/45">• Model line: Ravens +1.2<br/>• Baltimore has the rest edge</p>
      </motion.div>
      <motion.div
        initial={false}
        animate={{ opacity: active ? 1 : 0, y: active ? 0 : 52, rotate: 1.6 }}
        transition={{ type: 'spring', stiffness: 180, damping: 21, delay: 0.17 }}
        className="absolute right-0 top-0 z-10 w-[49%] rounded-[18px] bg-gradient-to-b from-[#1A2130] to-[#10141E] p-4 shadow-[0_20px_40px_rgba(0,0,0,0.5)]"
      >
        <div className="flex items-center justify-between"><p className="font-mono text-[10px] font-black tracking-[0.08em] text-emerald-400">ↄ PARLAY</p><span className="font-mono text-[9px] font-black text-emerald-400">◉ 4/5</span></div>
        <div className="mt-3 space-y-1 text-[11px] font-semibold text-white/90"><p>• Bills ML</p><p>• Josh Allen 3+ Pass TDs</p><p>• James Cook Anytime TD</p><p>• Khalil Shakir 50+ Rec Yds</p></div>
        <div className="my-3 border-t border-dashed border-white/10" />
        <p className="text-[17px] font-black text-white">4-Leg Ticket</p>
        <div className="mt-2 flex justify-between text-[9px] text-white/45"><span>Legs<br/><b className="text-white">4</b></span><span>Odds<br/><b className="font-mono text-white">+2300</b></span><span>Units<br/><b className="font-mono text-emerald-400">0.5u</b></span></div>
        <p className="mt-3 text-[9px] leading-snug text-white/45">• Correlated pass volume<br/>• All legs clear model value</p>
      </motion.div>
    </div>
  );
}

type TrendItem = {
  id: string;
  sport: 'nfl' | 'mlb';
  team: string;
  title: string;
  matchup: string;
  rows: readonly [string, string][];
};

const TRENDS: TrendItem[] = [
  { id: 'kc', sport: 'nfl', team: 'KC', title: 'Chiefs — Spread', matchup: 'Bills @ Chiefs', rows: [['In primetime games', '6/6'], ['At home', '9/9'], ['Vs Buffalo', '9/10']] },
  { id: 'nyy', sport: 'mlb', team: 'NYY', title: 'Yankees — Moneyline', matchup: 'BOS @ NYY', rows: [['At home', '5/5'], ['Vs right-handed starters', '12/12'], ['In series openers', '9/10']] },
  { id: 'phi', sport: 'mlb', team: 'PHI', title: 'Phillies — Team Total', matchup: 'ATL @ PHI', rows: [['At home', '5/5'], ['Vs Atlanta', '9/9'], ['5+ runs in night games', '11/12']] },
  { id: 'buf', sport: 'nfl', team: 'BUF', title: 'Bills — Moneyline', matchup: 'BUF @ MIA', rows: [['After a loss', '5/5'], ['Division road games', '12/12'], ['As road favorites', '9/10']] },
];

function TrendTile({ item }: { item: TrendItem }) {
  const visual = teamVisuals(item.sport, item.team);
  return (
    <div className="flex h-full w-[300px] shrink-0 flex-col rounded-[18px] border border-white/[0.07] bg-[#101411]/95 p-3.5 shadow-xl sm:w-[345px]">
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-full" style={{ background: visual.colors.primary }}>
          {visual.logoUrl ? <img src={visual.logoUrl} alt="" className="h-8 w-8 object-contain p-0.5" /> : <b className="text-[9px] text-white">{visual.initials}</b>}
        </span>
        <div><p className="text-[13px] font-black text-white">{item.title}</p><p className="text-[10px] text-white/40">{item.matchup}</p></div>
      </div>
      <div className="mt-2 flex flex-1 flex-col justify-center gap-1.5">
        {item.rows.map(([label, value], index) => {
          const Icon = index === 0 ? Moon : index === 1 ? Plane : Users;
          return <div key={label} className="flex items-center gap-2 text-[10px]"><Icon className="h-3 w-3 text-emerald-400" /><span className="flex-1 text-white/55">{label}</span><b className="font-mono text-emerald-400">{value}</b></div>;
        })}
      </div>
    </div>
  );
}

export function OutliersHero({ active }: { active: boolean }) {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!active || reduceMotion) {
      setIndex(0);
      return;
    }
    const timer = window.setInterval(() => setIndex((value) => value + 1), 2000);
    return () => window.clearInterval(timer);
  }, [active, reduceMotion]);

  const first = [TRENDS[index % 2], TRENDS[(index + 1) % 2]];
  const second = [TRENDS[2 + ((index + 1) % 2)], TRENDS[2 + (index % 2)]];
  return (
    <div className="flex w-full max-w-[590px] flex-col gap-2.5 overflow-hidden py-1">
      {[first, second].map((lane, laneIndex) => (
        <div key={laneIndex} className="relative h-[168px]">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={`${laneIndex}-${index}`}
              initial={{ x: laneIndex ? -28 : 28, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: laneIndex ? 28 : -28, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 180, damping: 24 }}
              className={`absolute inset-0 flex gap-2 ${laneIndex ? '-translate-x-[16%]' : 'translate-x-[4%]'}`}
            >
              {lane.map((item, itemIndex) => (
                <div key={item.id} className={`shrink-0 ${itemIndex ? 'opacity-50' : ''}`}>
                  <TrendTile item={item} />
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

const PROVIDERS = [
  ['Claude', claudeIcon], ['ChatGPT', chatGPTIcon], ['Gemini', geminiIcon], ['Grok', grokIcon], ['Codex', codexIcon],
] as const;

export function CommunityHero() {
  return (
    <div className="flex w-full max-w-[560px] flex-col gap-3">
      <div className="relative overflow-hidden rounded-[22px] border border-white/15 bg-gradient-to-r from-[#5B63EC] to-[#9FA8FF] px-5 py-4">
        <div className="absolute inset-0 opacity-10 [background-image:radial-gradient(circle_at_center,white_1px,transparent_1px)] [background-size:18px_18px]" />
        <div className="relative flex items-center justify-between">
          <div><p className="text-[18px] font-bold text-white">Join our Discord</p><p className="text-[13px] text-white/80">Picks, updates, and live chat</p></div>
          <span className="rounded-full border border-white/30 bg-white/15 px-3 py-2 text-[13px] font-semibold text-white">Included ›</span>
        </div>
      </div>
      <div className="relative overflow-hidden rounded-[23px] bg-gradient-to-r from-[#30231F] to-[#D97757] px-4 py-4 shadow-[0_12px_28px_rgba(0,0,0,0.28)] ring-1 ring-inset ring-[#D97757]/30">
        <div className="absolute inset-0 opacity-10 [background-image:radial-gradient(circle_at_center,white_1px,transparent_1px)] [background-size:22px_22px]" />
        <div className="relative">
          <div className="flex -space-x-2.5">
            {PROVIDERS.map(([name, icon]) => (
              <img key={name} src={icon} alt={name} className="h-10 w-10 rounded-full border-2 border-white/80 object-cover shadow-lg sm:h-11 sm:w-11" />
            ))}
          </div>
          <p className="mt-3 text-[16px] font-bold text-white sm:text-[18px]">Connect WagerProof to your AI</p>
          <p className="mt-1 max-w-[430px] text-[13px] font-medium leading-snug text-white/90 sm:text-[15px]">Bring your agents, picks, and model analytics into a read-only AI workflow.</p>
          <p className="mt-3 text-[9px] font-bold text-white/70">Claude · ChatGPT · Gemini · Grok · Codex</p>
        </div>
      </div>
    </div>
  );
}
