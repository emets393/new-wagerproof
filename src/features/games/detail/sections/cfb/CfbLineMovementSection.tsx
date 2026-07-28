import { ArrowRight, TrendingUp } from 'lucide-react';
import { WidgetCard } from '@/components/ios';
import { cn } from '@/lib/utils';
import type { CFBPrediction } from '../../../api/cfbGames';
import type { GameFeedItem } from '../../../types';
import { EmptyNote } from './shared';

function toNum(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const fmt = (value: number | null | undefined): string =>
  value === null || value === undefined ? 'N/A' : value.toFixed(1);

function MoveSummary({
  label,
  open,
  current,
}: {
  label: string;
  open: number | null;
  current: number | null;
}) {
  const delta = open !== null && current !== null ? current - open : null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
        {label}
      </span>
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
            Open
          </span>
          <span className="text-base font-bold tabular-nums text-muted-foreground">{fmt(open)}</span>
        </div>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
        <div className="flex flex-col">
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
            Now
          </span>
          <span className="text-base font-bold tabular-nums text-foreground">{fmt(current)}</span>
        </div>
        {delta !== null && (
          <div className="ml-auto flex flex-col items-end">
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
              Moved
            </span>
            <span
              className={cn(
                'font-mono text-[13px] font-bold tabular-nums',
                delta === 0
                  ? 'text-muted-foreground'
                  : delta > 0
                    ? 'text-emerald-600 dark:text-emerald-300'
                    : 'text-red-600 dark:text-red-300',
              )}
            >
              {delta > 0 ? '+' : ''}
              {delta.toFixed(1)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * CFB has no `cfb_betting_lines` history table. Show open → close from
 * `cfb_dryrun_games.fg_*_open/close` (same scalars the native app surfaces).
 * Full time-series charts remain a future port when a history source exists.
 */
export function CfbLineMovementSection({ game }: { game: GameFeedItem<CFBPrediction> }) {
  const raw = game.raw;
  const spreadOpen = toNum(raw.fg_spread_open);
  const spreadClose = toNum(raw.fg_spread_close) ?? toNum(raw.home_spread) ?? game.lines.homeSpread;
  const totalOpen = toNum(raw.fg_total_open);
  const totalClose =
    toNum(raw.fg_total_close) ?? toNum(raw.over_line) ?? toNum(raw.api_over_line) ?? game.lines.total;

  const hasAny =
    spreadOpen !== null ||
    spreadClose !== null ||
    totalOpen !== null ||
    totalClose !== null;

  return (
    <WidgetCard
      icon={<TrendingUp />}
      title="Line Movement"
      subtitle="Opening vs current Odds-API lines on this slate (CFB has no snapshot history table)."
      className="@xl:col-span-2"
      contentClassName="space-y-4"
    >
      {!hasAny ? (
        <EmptyNote>No open/close lines posted for this game yet.</EmptyNote>
      ) : (
        <>
          <MoveSummary
            label={`${game.homeTeam.abbrev} spread`}
            open={spreadOpen}
            current={spreadClose}
          />
          <MoveSummary label="Game total" open={totalOpen} current={totalClose} />
        </>
      )}
    </WidgetCard>
  );
}
