import * as React from 'react';
import { Check, ChevronRight, Info, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getContrastingTextColor } from '@/utils/teamColors';
import { renderTextWithLinks } from '@/utils/markdownLinks';
import { roundToHalf } from '../../edgeExplanations';
import type { TeamRef } from '../../../types';

/**
 * Shared widget primitives for the two college sports.
 *
 * CFB and NCAAB run the same model shape (`pred_spread`/`home_spread_diff`,
 * `pred_over_line`/`over_line_diff`) and therefore the same widgets, so the
 * pieces live here once and NCAAB imports them rather than keeping a second
 * copy that would drift. Visual language follows `sections/mlb/shared.tsx` — see
 * `detail/WIDGET_DESIGN.md` for the rules these implement.
 */

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** Signed half-point display for spreads ("+3.5", "-7"). */
export function formatSignedHalf(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A';
  const rounded = roundToHalf(Number(value));
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

export function toNum(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

/** getContrastingTextColor assumes `#rrggbb`; DB colors occasionally aren't. */
function safeContrastColor(primary: string, secondary: string): string {
  const ok = (c: string) => /^#[0-9a-f]{6}$/i.test(c);
  if (!ok(primary) || !ok(secondary)) return '#ffffff';
  return getContrastingTextColor(primary, secondary);
}

// ---------------------------------------------------------------------------
// Team marks
// ---------------------------------------------------------------------------

/**
 * Round team mark: logo when we have one, otherwise the abbreviation on the
 * club's own colors.
 *
 * The fallback is the *common* case in CFB — most rows carry no logo URL — so it
 * is sized and colored to look like the intended treatment rather than a broken
 * image: full-bleed club gradient, contrast-checked text, and a font size scaled
 * to both the disc and the abbreviation length (school abbrevs run to 4 chars).
 */
export function CollegeTeamMark({
  team,
  size = 30,
  dimmed = false,
}: {
  team: TeamRef;
  size?: number;
  dimmed?: boolean;
}) {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [team.logoUrl]);

  const url = team.logoUrl ?? '';
  const hasLogo = url.trim() !== '' && url !== '/placeholder.svg' && !failed;
  const abbrev = (team.abbrev || team.name || '?').slice(0, 4).toUpperCase();
  const fontSize = Math.max(8, Math.round(size / (abbrev.length > 3 ? 3.5 : 2.9)));

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full transition-opacity',
        dimmed && 'opacity-40',
      )}
      style={{
        width: size,
        height: size,
        background: hasLogo
          ? 'hsl(var(--background))'
          : `linear-gradient(135deg, ${team.colors.primary}, ${team.colors.secondary})`,
      }}
      aria-hidden
    >
      {hasLogo ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          className="h-full w-full object-contain p-px"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className="font-bold leading-none"
          style={{
            fontSize,
            letterSpacing: '-0.02em',
            color: safeContrastColor(team.colors.primary, team.colors.secondary),
          }}
        >
          {abbrev}
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Recommendation
// ---------------------------------------------------------------------------

export type EdgeTone = 'primary' | 'over' | 'under';

function toneClassFor(tone: EdgeTone): string {
  if (tone === 'over') return 'text-emerald-600 dark:text-emerald-300';
  if (tone === 'under') return 'text-blue-600 dark:text-blue-300';
  return 'text-primary';
}

/**
 * The pick, stated first and largest. Market name is a caption, not a heading;
 * everything below this in a card is evidence for it.
 */
export function Recommendation({
  market,
  pick,
  edge,
  team,
  tone = 'primary',
  icon,
}: {
  market: string;
  pick: string;
  /** Right-aligned edge value, already formatted. */
  edge: string;
  team?: TeamRef;
  tone?: EdgeTone;
  icon?: React.ReactNode;
}) {
  const toneClass = toneClassFor(tone);
  return (
    <div className="flex items-center gap-2.5">
      {team && <CollegeTeamMark team={team} size={38} />}
      <div className="flex min-w-0 flex-col">
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
          {market}
        </span>
        <span
          className={cn(
            'truncate text-xl font-bold leading-tight tracking-tight',
            // OVER/UNDER carry their direction color on the word itself.
            tone === 'primary' ? 'text-foreground' : toneClass,
          )}
        >
          {pick}
        </span>
      </div>
      <span
        className={cn('ml-auto flex shrink-0 items-center gap-0.5 font-mono text-sm font-bold', toneClass)}
      >
        {icon}
        {edge}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Which side
// ---------------------------------------------------------------------------

/**
 * Both teams at their market prices with the model's side marked and the other
 * dimmed. "Who's favored" and "who the model would bet" are different questions,
 * so the pick gets a check mark rather than being left to inference.
 */
export function PickSideRow({
  away,
  home,
  awayValue,
  homeValue,
  pickIsHome,
}: {
  away: TeamRef;
  home: TeamRef;
  awayValue: string;
  homeValue: string;
  /** Null when the card makes no side pick (totals). */
  pickIsHome: boolean | null;
}) {
  const awayDim = pickIsHome === true;
  const homeDim = pickIsHome === false;

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex min-w-0 items-center gap-1.5">
        <CollegeTeamMark team={away} size={28} dimmed={awayDim} />
        <span className="flex min-w-0 flex-col">
          <span
            className={cn(
              'truncate text-[13px] font-bold leading-tight',
              awayDim ? 'text-muted-foreground' : 'text-foreground',
            )}
          >
            {away.abbrev}
          </span>
          <span className="text-[11px] font-semibold tabular-nums leading-tight text-muted-foreground">
            {awayValue}
          </span>
        </span>
        {pickIsHome === false && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
      </span>

      <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/50">
        at
      </span>

      <span className="flex min-w-0 items-center justify-end gap-1.5">
        {pickIsHome === true && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
        <span className="flex min-w-0 flex-col items-end">
          <span
            className={cn(
              'truncate text-[13px] font-bold leading-tight',
              homeDim ? 'text-muted-foreground' : 'text-foreground',
            )}
          >
            {home.abbrev}
          </span>
          <span className="text-[11px] font-semibold tabular-nums leading-tight text-muted-foreground">
            {homeValue}
          </span>
        </span>
        <CollegeTeamMark team={home} size={28} dimmed={homeDim} />
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Supporting copy + disclosure
// ---------------------------------------------------------------------------

/**
 * "What this means" prose. Flat — the widget card is already a surface, so this
 * is a hairline rule and a paragraph, not a box inside a box.
 */
export function ExplanationNote({
  aiExplanation,
  staticExplanation,
}: {
  aiExplanation?: string;
  staticExplanation: string;
}) {
  return (
    <div className="border-t border-black/5 pt-2 dark:border-white/10">
      <div className="mb-1 flex items-center gap-1.5">
        <Info className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
          What this means
        </span>
        {aiExplanation && (
          <span
            className="ml-auto flex shrink-0 items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider text-primary"
            title="Written by our AI analyst for this specific game"
          >
            <Sparkles className="h-3 w-3" />
            AI
          </span>
        )}
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {renderTextWithLinks(aiExplanation || staticExplanation)}
      </p>
    </div>
  );
}

/**
 * Collapsed supporting detail. The summary is always visible so the disclosure
 * isn't a blind door.
 */
export function Disclosure({
  label,
  summary,
  children,
  defaultOpen = false,
}: {
  label: string;
  summary?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="border-t border-black/5 pt-2 dark:border-white/10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left"
      >
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-90',
          )}
        />
        <span className="text-[11px] font-semibold text-foreground">{label}</span>
        {summary !== undefined && (
          <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground">{summary}</span>
        )}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compact model-vs-market comparison
// ---------------------------------------------------------------------------

/** Point gap that pins the diverging bar; past a touchdown the exact size stops mattering. */
const GAP_BAR_CAP = 7;

/** Column captions for a group of MarketGapRows. */
export function MarketGapHeader() {
  return (
    <div className="flex items-center gap-2 pb-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/60">
      <span className="w-14 shrink-0" />
      <span className="w-14 shrink-0">Ours</span>
      <span className="min-w-0 flex-1 text-center">Disagreement</span>
      <span className="w-14 shrink-0 text-right">Vegas</span>
      <span className="w-12 shrink-0 text-right">Edge</span>
    </div>
  );
}

/**
 * One market's model number against the book's, with the gap as a bar diverging
 * from a centre zero line. Three metric boxes reading "Vegas 48 / Ours 51 /
 * Edge +3" made the reader do the comparison; the bar does it before any number
 * is read.
 */
export function MarketGapRow({
  label,
  model,
  vegas,
  gap,
  format = (v: number) => String(roundToHalf(v)),
  emphasis = 'neutral',
}: {
  label: string;
  model: number | null;
  vegas: number | null;
  /**
   * Omit to derive model − vegas (the only way the three numbers are guaranteed
   * to reconcile); pass `null` to show no gap at all.
   */
  gap?: number | null;
  format?: (value: number) => string;
  /** 'signed' colours the gap green/red; 'neutral' leaves it in the primary tone. */
  emphasis?: 'signed' | 'neutral';
}) {
  const resolvedGap =
    gap !== undefined ? gap : model !== null && vegas !== null ? model - vegas : null;
  const magnitude = resolvedGap === null ? 0 : Math.min(Math.abs(resolvedGap) / GAP_BAR_CAP, 1) * 50;
  const positive = (resolvedGap ?? 0) >= 0;
  const gapClass =
    resolvedGap === null
      ? 'text-muted-foreground'
      : emphasis === 'signed'
        ? positive
          ? 'text-emerald-600 dark:text-emerald-300'
          : 'text-red-600 dark:text-red-300'
        : 'text-primary';

  return (
    <div className="flex items-center gap-2 py-1">
      <span className="w-14 shrink-0 truncate text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="w-14 shrink-0 text-[12px] font-bold tabular-nums text-foreground">
        {model === null ? '—' : format(model)}
      </span>
      <span className="relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-sm bg-muted/60">
        <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-muted-foreground/30" />
        {resolvedGap !== null && (
          <span
            className={cn(
              'absolute inset-y-0 rounded-sm',
              emphasis === 'signed'
                ? positive
                  ? 'bg-emerald-500/80'
                  : 'bg-red-500/80'
                : 'bg-primary/70',
            )}
            style={positive ? { left: '50%', width: `${magnitude}%` } : { right: '50%', width: `${magnitude}%` }}
          />
        )}
      </span>
      <span className="w-14 shrink-0 text-right text-[12px] font-semibold tabular-nums text-muted-foreground">
        {vegas === null ? '—' : format(vegas)}
      </span>
      <span className={cn('w-12 shrink-0 text-right text-[11px] font-bold tabular-nums', gapClass)}>
        {resolvedGap === null ? '—' : `${resolvedGap > 0 ? '+' : ''}${format(resolvedGap)}`}
      </span>
    </div>
  );
}

/** Card body wrapper: one flat stack, sections split by hairlines only. */
export const STACK = 'flex flex-col gap-3';

/** Empty-state copy inside a widget card — no nested surface. */
export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="py-1 text-[11px] leading-relaxed text-muted-foreground">{children}</p>;
}
