// Web port of ParlayGodCard.swift — one themed parlay ticket. Compact mode is a
// fixed 300×244 rail card (category header + legs + combined odds); clicking it
// opens the expanded Dialog with per-leg evidence + a responsible-gambling line.
// See specs/outliers_spec.md §4c. MLB-only this phase (legs are MLB team/prop).
import { useEffect, useState } from 'react';
import {
  ChevronRight,
  Flame,
  Hash,
  Home,
  LineChart,
  MoonStar,
  PawPrint,
  PersonStanding,
  Shield,
  SlidersHorizontal,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  PARLAY_CATEGORY_ICON,
  PARLAY_CATEGORY_TITLE,
  legFractionText,
  legOddsText,
  type ParlayLeg,
  type ParlayTicket,
} from '@/features/parlayGod';
import { mlbHeadshotUrl } from '@/utils/mlbPitcherMatchups';
import { initialsFrom, teamVisuals } from '../teamVisuals';

/** lucide-react component for each category (names live in the engine module). */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Shield,
  Flame,
  SlidersHorizontal,
  Home,
  LineChart,
  PawPrint,
  MoonStar,
  Hash,
  PersonStanding,
};

const GREEN = '#22C55E';
const GREEN_BG = 'rgba(34,197,94,0.12)';

function categoryIcon(ticket: ParlayTicket): LucideIcon {
  return CATEGORY_ICONS[PARLAY_CATEGORY_ICON[ticket.category]] ?? Flame;
}

// MARK: - Leg avatar (MLB: prop → headshot, team → logo, initials fallback)

function LegAvatar({ leg, size = 22 }: { leg: ParlayLeg; size?: number }) {
  const [failed, setFailed] = useState(false);
  const isProp = leg.kind === 'prop';
  const src = isProp
    ? leg.headshotUrl ?? (leg.playerId != null ? mlbHeadshotUrl(leg.playerId, size * 2) : null)
    : leg.teamAbbr
      ? teamVisuals('mlb', leg.teamAbbr).logoUrl
      : null;

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const showImg = Boolean(src) && !failed;
  const colors = !isProp && leg.teamAbbr ? teamVisuals('mlb', leg.teamAbbr).colors : null;

  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        background: showImg
          ? isProp
            ? 'hsl(var(--muted))'
            : 'hsl(var(--background))'
          : colors
            ? `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`
            : 'hsl(var(--muted))',
      }}
    >
      {showImg ? (
        <img
          src={src as string}
          alt={leg.subject}
          loading="lazy"
          className={cn('h-full w-full', isProp ? 'object-cover' : 'object-contain p-0.5')}
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className={cn(
            'text-[9px] font-bold leading-none',
            colors ? 'text-white [text-shadow:0_1px_1px_rgba(0,0,0,0.35)]' : 'text-muted-foreground',
          )}
        >
          {initialsFrom(leg.subject)}
        </span>
      )}
    </div>
  );
}

// MARK: - Leg row

function LegRow({ leg, expanded }: { leg: ParlayLeg; expanded: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <LegAvatar leg={leg} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs leading-tight">
          <span className="font-bold text-foreground">{leg.subject}</span>{' '}
          <span className="text-muted-foreground">{leg.betText}</span>
        </p>
        {expanded && leg.evidence && (
          <p className="truncate text-[11px] leading-tight text-muted-foreground">{leg.evidence}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="font-mono text-[11px] font-black tabular-nums text-muted-foreground">
          {legOddsText(leg)}
        </span>
        <span
          className="rounded px-1.5 py-0.5 font-mono text-[10px] font-black tabular-nums"
          style={{ backgroundColor: GREEN_BG, color: GREEN }}
        >
          {legFractionText(leg)}
        </span>
      </div>
    </div>
  );
}

// MARK: - Header (category icon tile + title + combined odds)

function TicketHeader({ ticket, iconSize = 22 }: { ticket: ParlayTicket; iconSize?: number }) {
  const Icon = categoryIcon(ticket);
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="flex shrink-0 items-center justify-center rounded-[7px] bg-gradient-to-br from-primary to-primary/70"
        style={{ width: iconSize, height: iconSize }}
      >
        <Icon className="h-3 w-3 text-primary-foreground" />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-extrabold text-foreground">
        {PARLAY_CATEGORY_TITLE[ticket.category]}
      </span>
      <span className="shrink-0 rounded-md bg-primary/10 px-2 py-1 font-mono text-[13px] font-black tabular-nums text-primary">
        {ticket.combinedOddsText}
      </span>
    </div>
  );
}

// MARK: - Card

export function ParlayTicketCard({ ticket }: { ticket: ParlayTicket }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className={cn(
          'flex h-[244px] w-[300px] shrink-0 flex-col gap-2.5 rounded-2xl p-3 text-left',
          'border border-black/5 bg-[#F8FAFC] transition-colors hover:border-black/10',
          'dark:border-white/10 dark:bg-[#141414] dark:hover:border-white/20',
        )}
      >
        <TicketHeader ticket={ticket} />

        <div className="flex flex-col gap-2">
          {ticket.legs.map((leg) => (
            <LegRow key={leg.id} leg={leg} expanded={false} />
          ))}
        </div>

        {/* Footer pinned to the bottom of the fixed-height card. */}
        <div className="mt-auto flex flex-col gap-1.5">
          <div className="h-px bg-black/5 dark:bg-white/10" />
          <div className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 shrink-0" style={{ color: GREEN }} />
            <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-muted-foreground">
              Every leg has hit 100% of its sample
            </span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </div>
        </div>
      </button>

      {/* Expanded ticket — all legs with evidence + the responsible-gambling line. */}
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <TicketHeader ticket={ticket} iconSize={28} />
            </div>
            <DialogTitle className="sr-only">
              {PARLAY_CATEGORY_TITLE[ticket.category]} parlay
            </DialogTitle>
            <DialogDescription className="sr-only">
              {ticket.legs.length}-leg parlay, combined odds {ticket.combinedOddsText}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {ticket.legs.map((leg) => (
              <LegRow key={leg.id} leg={leg} expanded />
            ))}
            <div className="flex items-center gap-1.5 border-t border-black/5 pt-3 dark:border-white/10">
              <Zap className="h-3.5 w-3.5 shrink-0" style={{ color: GREEN }} />
              <span className="text-[11px] font-semibold text-muted-foreground">
                Every leg has hit 100% of its sample
              </span>
            </div>
            <p className="text-[10px] leading-tight text-muted-foreground">
              Streaks are historical, not a prediction — sizes vary per leg. Bet responsibly.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
