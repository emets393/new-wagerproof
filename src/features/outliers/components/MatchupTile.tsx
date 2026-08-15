// One Today's Matchups tile: away logo · time · home logo, the whole thing a
// deep-link into the unified /games page. Each side carries a soft radial glow
// in that team's primary color so the grid reads as a wall of matchups at a
// glance. See specs/outliers_spec.md §4d.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { PixelSpriteAvatar } from '@/components/agents/split/PixelSpriteAvatar';
import { agentSpriteIndex } from '@/utils/agentSprites';
import { avatarBackground } from '@/features/games/components/AgentConsensusStrip';
import { consensusLeaderLine } from '@/features/games/consensusCopy';
import type { GameAgentConsensus } from '@/services/agentConsensusService';

export interface MatchupTileData {
  key: string;
  href: string;
  awayAbbr: string;
  homeAbbr: string;
  awayLogoUrl: string | null;
  homeLogoUrl: string | null;
  awayColors: { primary: string; secondary: string };
  homeColors: { primary: string; secondary: string };
  awayInitials: string;
  homeInitials: string;
  /** "Today" or a weekday abbreviation. */
  dayLabel: string;
  /** "5:40 PM" (ET). */
  timeLabel: string;
  /** League tag, shown only when the grid spans more than one sport. */
  sportLabel?: string;
  /** Kickoff/first-pitch epoch ms, for ordering a merged multi-sport slate. */
  startMs: number | null;
  /** ET date key (YYYY-MM-DD), used to scope the agent-consensus lookup. */
  gameDate: string;
}

/**
 * Pixel-person stack + what the agents took, shown only when agents actually
 * bet the game. This used to render a bare "83% agree" naming NO side and no
 * denominator — a percentage about an unstated selection.
 */
function ConsensusRow({ consensus }: { consensus: GameAgentConsensus }) {
  const { sideAgents, flagged, avatars } = consensus;
  const shown = avatars.slice(0, 3);
  // Winning-side count in BOTH states: the faces are winning-side agents, so
  // counting the whole game beside them mislabels the stack.
  const overflow = sideAgents - shown.length;

  return (
    <div className="relative flex w-full items-center justify-center gap-1.5">
      <div className="flex shrink-0 -space-x-1.5">
        {shown.map((a, i) => (
          <span
            key={a.avatarId}
            title={a.name}
            className="flex h-[18px] w-[18px] items-end justify-center overflow-hidden rounded-full border border-black/10 dark:border-white/15"
            style={{
              background: avatarBackground(a.color),
              zIndex: shown.length - i,
            }}
          >
            <PixelSpriteAvatar spriteIndex={agentSpriteIndex(a.avatarId, a.spriteIndex)} height={20} />
          </span>
        ))}
        {overflow > 0 && (
          <span
            className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-black/10 bg-black/[0.06] px-1 text-[8px] font-bold text-muted-foreground dark:border-white/15 dark:bg-white/10"
            style={{ zIndex: 0 }}
          >
            +{overflow}
          </span>
        )}
      </div>

      {flagged ? (
        <span className="flex shrink-0 items-center gap-0.5 rounded bg-emerald-500 px-1 py-px text-[8px] font-bold uppercase tracking-wide text-white">
          Consensus
        </span>
      ) : null}

      <span
        className={cn(
          'truncate text-[9px] font-semibold',
          flagged ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'
        )}
      >
        {consensusLeaderLine(consensus)}
      </span>
    </div>
  );
}

function TeamMark({
  logoUrl,
  initials,
  colors,
  label,
}: {
  logoUrl: string | null;
  initials: string;
  colors: { primary: string; secondary: string };
  label: string;
}) {
  const [failed, setFailed] = useState(false);
  const showLogo = Boolean(logoUrl) && !failed;
  useEffect(() => {
    setFailed(false);
  }, [logoUrl]);

  return (
    <div className="relative flex min-w-0 flex-col items-center gap-1">
      <div
        className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full"
        style={{
          background: showLogo
            ? 'hsl(var(--background))'
            : `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
        }}
      >
        {showLogo ? (
          <img
            src={logoUrl as string}
            alt={label}
            loading="lazy"
            className="h-full w-full object-contain p-0.5"
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="text-[11px] font-bold text-white [text-shadow:0_1px_1px_rgba(0,0,0,0.35)]">
            {initials}
          </span>
        )}
      </div>
      <span className="text-[11px] font-bold text-muted-foreground">{label}</span>
    </div>
  );
}

/** Team-colored wash anchored to one edge, sitting under the tile content. */
function EdgeGlow({ color, side }: { color: string; side: 'left' | 'right' }) {
  const anchor = side === 'left' ? '0%' : '100%';
  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-y-0 w-3/5 opacity-20 transition-opacity duration-200',
        'group-hover:opacity-40 dark:opacity-30 dark:group-hover:opacity-50',
        side === 'left' ? 'left-0' : 'right-0',
      )}
      style={{
        background: `radial-gradient(125% 100% at ${anchor} 50%, ${color} 0%, transparent 72%)`,
      }}
    />
  );
}

export function MatchupTile({
  data,
  consensus,
}: {
  data: MatchupTileData;
  consensus?: GameAgentConsensus;
}) {
  const showConsensus = Boolean(consensus && consensus.agents > 0);

  return (
    <Link
      to={data.href}
      className={cn(
        // Fixed height regardless of the consensus row so the 3x3 grid stays
        // even; the teams row absorbs the slack when there's no row to show.
        'group relative flex h-[104px] flex-col justify-center gap-1 overflow-hidden rounded-2xl px-4 py-2',
        'border bg-[#F8FAFC] transition-colors dark:bg-[#141414]',
        consensus?.flagged
          ? 'border-emerald-500/40 hover:border-emerald-500/60 dark:border-emerald-500/35 dark:hover:border-emerald-500/55'
          : 'border-black/5 hover:border-black/10 dark:border-white/10 dark:hover:border-white/20',
      )}
    >
      <EdgeGlow color={data.awayColors.primary} side="left" />
      <EdgeGlow color={data.homeColors.primary} side="right" />

      <div className="relative flex w-full items-center justify-between">
        <TeamMark
          logoUrl={data.awayLogoUrl}
          initials={data.awayInitials}
          colors={data.awayColors}
          label={data.awayAbbr}
        />
        <div className="relative flex flex-col items-center px-1 text-center">
          {data.sportLabel && (
            <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground/70">
              {data.sportLabel}
            </span>
          )}
          <span className="text-[11px] text-muted-foreground">{data.dayLabel}</span>
          <span className="text-xs font-semibold text-foreground">{data.timeLabel}</span>
        </div>
        <TeamMark
          logoUrl={data.homeLogoUrl}
          initials={data.homeInitials}
          colors={data.homeColors}
          label={data.homeAbbr}
        />
      </div>

      {showConsensus && <ConsensusRow consensus={consensus!} />}
    </Link>
  );
}
