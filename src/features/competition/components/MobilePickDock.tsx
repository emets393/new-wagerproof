import * as React from 'react';
import { ChevronUp, Lock, Star, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CompDraftPick, CompEntry, CompGame, CompPick } from '../types';
import {
  formatCountdown,
  formatSignedLine,
  matchupLabel,
  pickSummaryLabel,
} from '../format';

/**
 * Mobile-only sticky dock: keep the game slate readable, with submit always
 * reachable. Expand to manage the pick list — never eat half the viewport.
 */
export function MobilePickDock({
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
  const [open, setOpen] = React.useState(false);
  const submitted = entry?.status === 'submitted';
  const editableUntil = entry?.editable_until ? new Date(entry.editable_until).getTime() : 0;
  const inGrace = submitted && editableUntil > now;
  const graceLeft = Math.max(0, editableUntil - now);
  const potwCount = picks.filter((p) => p.is_potw).length;
  const canSubmit = picks.length === 6 && potwCount === 1 && !locked && !submitted;

  const stampedByKey = new Map(
    stampedPicks.map((p) => [`${p.game_id}:${p.market}`, p] as const)
  );

  React.useEffect(() => {
    if (picks.length === 6 && potwCount === 0 && !submitted) setOpen(true);
  }, [picks.length, potwCount, submitted]);

  const submitLabel = locked
    ? 'Locked'
    : submitting
      ? '…'
      : picks.length < 6
        ? `Submit ${picks.length}/6`
        : potwCount !== 1
          ? 'Star POTW'
          : 'Submit';

  return (
    <div className="shrink-0 border-t border-black/5 bg-background/95 backdrop-blur-xl dark:border-white/10 lg:hidden">
      {open && (
        <div className="max-h-[min(38vh,320px)] space-y-1.5 overflow-y-auto overscroll-contain border-b border-black/5 px-3 py-2 dark:border-white/10">
          {picks.length === 0 ? (
            <p className="py-3 text-center text-[12px] font-semibold text-muted-foreground">
              Tap lines on the slate to fill 6 picks
            </p>
          ) : (
            picks.map((pick) => {
              const game = gamesById.get(pick.game_id);
              const stamped = stampedByKey.get(`${pick.game_id}:${pick.market}`);
              const lineForDisplay =
                submitted && stamped?.line != null ? stamped.line : null;
              const readOnly = locked || (submitted && !inGrace);

              return (
                <div
                  key={`${pick.game_id}-${pick.market}`}
                  className={cn(
                    'rounded-xl border border-black/5 bg-muted/25 px-2.5 py-2 dark:border-white/10',
                    pick.is_potw && 'border-amber-500/40 bg-amber-500/10'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] font-semibold text-muted-foreground">
                        {game ? matchupLabel(game) : 'Game'}
                      </div>
                      <div className="mt-0.5 text-[13px] font-bold">
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
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => onStar(pick.game_id, pick.market)}
                          className={cn(
                            'rounded-full p-1.5',
                            pick.is_potw
                              ? 'bg-amber-500/25 text-amber-600'
                              : 'text-muted-foreground'
                          )}
                          aria-label="Play of the Week"
                        >
                          <Star className={cn('h-4 w-4', pick.is_potw && 'fill-current')} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemove(pick.game_id, pick.market)}
                          className="rounded-full p-1.5 text-muted-foreground"
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
            })
          )}
        </div>
      )}

      {submitted && (
        <div
          className={cn(
            'border-b border-black/5 px-3 py-2 text-[12px] font-semibold dark:border-white/10',
            inGrace
              ? 'bg-amber-500/10 text-amber-900 dark:text-amber-100'
              : 'bg-muted/40 text-muted-foreground'
          )}
        >
          {inGrace ? (
            <div className="flex items-center justify-between gap-2">
              <span>Edit for {formatCountdown(graceLeft)}</span>
              <button
                type="button"
                onClick={onEdit}
                className="rounded-full bg-background/80 px-2.5 py-1 text-[11px] font-bold"
              >
                Edit
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" />
              Picks locked
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-black/5 bg-muted/30 px-3 py-2.5 text-left dark:border-white/10"
          aria-expanded={open}
        >
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              Your picks{saving ? ' · saving' : ''}
            </div>
            <div className="font-mono text-[18px] font-black leading-none">
              {picks.length}
              <span className="text-muted-foreground">/6</span>
              {potwCount === 1 && (
                <span className="ml-1.5 align-middle text-[11px] font-bold text-amber-700 dark:text-amber-300">
                  · POTW
                </span>
              )}
            </div>
          </div>
          <ChevronUp
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-180'
            )}
          />
        </button>

        {!submitted && (
          <button
            type="button"
            disabled={!canSubmit || submitting}
            onClick={onSubmit}
            className={cn(
              'shrink-0 rounded-2xl px-4 py-2.5 text-[13px] font-black uppercase tracking-wide',
              canSubmit
                ? 'bg-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.35)]'
                : 'cursor-not-allowed bg-muted text-muted-foreground'
            )}
          >
            {submitLabel}
          </button>
        )}
      </div>

      {!submitted && picks.length === 6 && potwCount === 0 && !locked && (
        <p className="-mt-1 px-3 pb-2 text-center text-[11px] font-semibold text-amber-700 dark:text-amber-300">
          Open picks and star your Play of the Week
        </p>
      )}
    </div>
  );
}
