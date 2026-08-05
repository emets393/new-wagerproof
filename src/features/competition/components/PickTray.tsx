import { Lock, Star, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassCard } from '@/components/ios';
import type { CompDraftPick, CompEntry, CompGame, CompPick } from '../types';
import {
  formatCountdown,
  formatSignedLine,
  matchupLabel,
  pickSummaryLabel,
} from '../format';

export function PickTray({
  picks,
  gamesById,
  entry,
  stampedPicks,
  locked,
  now,
  saving,
  submitting,
  onStar,
  onRemove,
  onSubmit,
  onEdit,
}: {
  picks: CompDraftPick[];
  gamesById: Map<number, CompGame>;
  entry: CompEntry | null;
  /** Server picks with stamped lines (after submit). */
  stampedPicks: CompPick[];
  locked: boolean;
  now: number;
  saving: boolean;
  submitting: boolean;
  onStar: (gameId: number, market: CompDraftPick['market']) => void;
  onRemove: (gameId: number, market: CompDraftPick['market']) => void;
  onSubmit: () => void;
  onEdit: () => void;
}) {
  const submitted = entry?.status === 'submitted';
  const editableUntil = entry?.editable_until ? new Date(entry.editable_until).getTime() : 0;
  const inGrace = submitted && editableUntil > now;
  const graceLeft = Math.max(0, editableUntil - now);
  const potwCount = picks.filter((p) => p.is_potw).length;
  const canSubmit = picks.length === 6 && potwCount === 1 && !locked && !submitted;

  const stampedByKey = new Map(
    stampedPicks.map((p) => [`${p.game_id}:${p.market}`, p] as const)
  );

  const slots: Array<CompDraftPick | null> = [
    ...picks,
    ...Array.from({ length: Math.max(0, 6 - picks.length) }, () => null),
  ].slice(0, 6);

  return (
    <GlassCard radius={20} className="flex h-full min-h-0 max-h-full flex-col p-3 sm:p-4">
      <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Your picks
          </div>
          <div className="mt-0.5 font-mono text-[22px] font-black leading-none">
            {picks.length}
            <span className="text-muted-foreground">/6</span>
          </div>
        </div>
        {saving && <span className="text-[11px] text-muted-foreground">Saving…</span>}
      </div>

      {/* Submit at top — always visible without scrolling the pick list. */}
      {!submitted && (
        <div className="mb-2 shrink-0 space-y-1.5 sm:mb-3">
          {picks.length === 6 && potwCount === 0 && !locked && (
            <p className="text-center text-[12px] font-semibold text-amber-700 dark:text-amber-300">
              Star your Play of the Week
            </p>
          )}
          <button
            type="button"
            disabled={!canSubmit || submitting}
            onClick={onSubmit}
            className={cn(
              'w-full rounded-2xl py-3 text-[14px] font-black uppercase tracking-wide transition-all',
              canSubmit
                ? 'bg-amber-500 text-black shadow-[0_0_24px_rgba(245,158,11,0.35)] hover:bg-amber-400'
                : 'cursor-not-allowed bg-muted text-muted-foreground'
            )}
          >
            {locked
              ? 'Week locked'
              : submitting
                ? 'Submitting…'
                : picks.length < 6
                  ? `Submit picks (${picks.length}/6)`
                  : potwCount !== 1
                    ? 'Star Play of the Week'
                    : 'Submit picks'}
          </button>
        </div>
      )}

      {submitted && (
        <div
          className={cn(
            'mb-2 shrink-0 rounded-xl border px-3 py-2 text-[12px] font-semibold sm:mb-3',
            inGrace
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100'
              : 'border-black/5 bg-muted/40 text-muted-foreground dark:border-white/10'
          )}
        >
          {inGrace ? (
            <div className="flex items-center justify-between gap-2">
              <span>Edits allowed for {formatCountdown(graceLeft)}</span>
              <button
                type="button"
                onClick={onEdit}
                className="rounded-full bg-background/80 px-2.5 py-1 text-[11px] font-bold"
              >
                Edit picks
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" />
              Picks locked · reveal Friday 12:00 PM ET
            </div>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain sm:space-y-2">
        {slots.map((pick, i) => {
          if (!pick) {
            return (
              <div
                key={`empty-${i}`}
                className="flex h-12 items-center justify-center rounded-xl border border-dashed border-black/10 text-[12px] font-semibold text-muted-foreground dark:border-white/15 sm:h-[64px]"
              >
                Pick {i + 1} of 6
              </div>
            );
          }
          const game = gamesById.get(pick.game_id);
          const stamped = stampedByKey.get(`${pick.game_id}:${pick.market}`);
          const lineForDisplay =
            submitted && stamped?.line != null ? stamped.line : null;
          const readOnly = locked || (submitted && !inGrace);

          return (
            <div
              key={`${pick.game_id}-${pick.market}`}
              className={cn(
                'rounded-xl border border-black/5 bg-muted/25 p-2 dark:border-white/10 sm:p-2.5',
                pick.is_potw && 'border-amber-500/40 bg-amber-500/10'
              )}
            >
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {game && (
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[9px] font-bold uppercase',
                          game.sport === 'nfl'
                            ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                            : 'bg-amber-500/15 text-amber-800 dark:text-amber-200'
                        )}
                      >
                        {game.sport}
                      </span>
                    )}
                    <span className="truncate text-[12px] font-semibold text-muted-foreground">
                      {game ? matchupLabel(game) : 'Game'}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[13px] font-bold sm:text-[14px]">
                    {pickSummaryLabel(game, {
                      ...pick,
                      line: lineForDisplay,
                    })}
                    {submitted && stamped?.line != null && (
                      <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        stamped {formatSignedLine(stamped.line)}
                      </span>
                    )}
                  </div>
                </div>
                {!readOnly && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onStar(pick.game_id, pick.market)}
                      className={cn(
                        'rounded-full p-1.5 transition-colors',
                        pick.is_potw
                          ? 'bg-amber-500/25 text-amber-600'
                          : 'text-muted-foreground hover:bg-muted'
                      )}
                      aria-label="Play of the Week"
                    >
                      <Star className={cn('h-4 w-4', pick.is_potw && 'fill-current')} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(pick.game_id, pick.market)}
                      className="rounded-full p-1.5 text-muted-foreground hover:bg-muted"
                      aria-label="Remove pick"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
                {readOnly && pick.is_potw && (
                  <Star className="h-4 w-4 shrink-0 fill-amber-500 text-amber-500" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}
