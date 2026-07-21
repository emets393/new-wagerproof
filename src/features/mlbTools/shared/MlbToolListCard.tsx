import * as React from 'react';
import { cn } from '@/lib/utils';
import { GlassCard, TeamLogoDiscs } from '@/components/ios';
import type { MlbToolFeedItem } from './types';

/**
 * Selection indicator: a team-colored wash bleeding in from each edge. Mirrors
 * GameListCard and TrendsListCard rather than a `ring-2` outline, which competed
 * with the card's own hairline border and read as a focus state.
 */
function SelectionGlow({ color, side }: { color: string; side: 'left' | 'right' }) {
  const anchor = side === 'left' ? '0%' : '100%';
  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-y-0 w-3/5 opacity-30 dark:opacity-40',
        side === 'left' ? 'left-0' : 'right-0',
      )}
      style={{ background: `radial-gradient(125% 100% at ${anchor} 50%, ${color} 0%, transparent 72%)` }}
    />
  );
}

/** Small capsule for the per-tool summary pills, so they read as one row. */
export function FeedPill({
  label,
  children,
  trailing,
}: {
  label: string;
  children: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-black/5 bg-white/55 px-2 py-0.5 text-[10px] font-bold backdrop-blur-md dark:border-white/10 dark:bg-white/[0.08]">
      <span className="text-muted-foreground">{label}</span>
      {children}
      {trailing && <span className="tabular-nums text-muted-foreground">{trailing}</span>}
    </span>
  );
}

interface MlbToolListCardProps {
  item: MlbToolFeedItem;
  isSelected: boolean;
  onSelect: (id: string) => void;
  /** Caption under the matchup line — the tool's own one-liner for this game. */
  caption?: React.ReactNode;
  /** Per-tool summary pills, rendered under a hairline rule. */
  pills?: React.ReactNode;
}

/**
 * Feed card for one game, shared by every MLB tool: merged team discs, matchup,
 * first-pitch pill, plus whatever the tool wants to say about the game. The
 * summary lives on the card (not only in the detail pane) so the list itself is
 * scannable for "which game is worth opening".
 */
export function MlbToolListCard({
  item,
  isSelected,
  onSelect,
  caption,
  pills,
}: MlbToolListCardProps) {
  const { away, home } = item;

  return (
    <GlassCard
      interactive
      onClick={() => onSelect(item.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(item.id);
        }
      }}
      // overflow-hidden clips the selection glow to the card's radius.
      className="relative overflow-hidden px-3 py-2.5"
    >
      {isSelected && (
        <>
          <SelectionGlow color={away.colors.primary} side="left" />
          <SelectionGlow color={home.colors.primary} side="right" />
        </>
      )}

      <div className="relative flex items-center gap-2.5">
        <TeamLogoDiscs
          away={{ logoUrl: away.logoUrl, abbrev: away.abbrev, color: away.colors.primary }}
          home={{ logoUrl: home.logoUrl, abbrev: home.abbrev, color: home.colors.primary }}
          size={32}
          overlap={8}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[13px] font-bold leading-tight text-foreground">
            {away.abbrev} <span className="text-muted-foreground">@</span> {home.abbrev}
          </span>
          {caption && (
            <span className="truncate text-[10px] font-semibold text-muted-foreground">
              {caption}
            </span>
          )}
        </div>
        <span className="shrink-0 rounded-md border border-black/5 bg-white/50 px-2 py-0.5 font-mono text-[10px] font-bold text-muted-foreground backdrop-blur-md dark:border-white/10 dark:bg-white/[0.08]">
          {item.gameTimeLabel}
        </span>
      </div>

      {pills && (
        <>
          <div className="relative mt-2 border-t border-black/5 dark:border-white/10" />
          <div className="relative mt-2 flex flex-wrap items-center gap-1.5">{pills}</div>
        </>
      )}
    </GlassCard>
  );
}
