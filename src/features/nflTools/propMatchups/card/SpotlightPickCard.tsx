import { cn } from '@/lib/utils';
import type { NflPropSpotlight, SpotlightTell } from '@/features/propBreakdown/types';
import { formatPickLine, formatSignedNet, resultWord } from '../fpCards';

function TellRow({ tell }: { tell: SpotlightTell }) {
  const context = tell.dir === 'context';
  return (
    <li className={cn('flex gap-2 rounded-xl px-2 py-2', context ? 'bg-muted/30' : 'bg-background/40')}>
      <span
        className={cn(
          'mt-0.5 inline-flex h-6 shrink-0 items-center rounded-full px-2 text-[10px] font-bold uppercase tracking-wide',
          context && 'bg-muted text-muted-foreground',
          !context && tell.dir === 'under' && 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
          !context && tell.dir !== 'under' && 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200',
        )}
      >
        {tell.dir}
      </span>
      <div className="min-w-0">
        {tell.src && (
          <div className={cn('text-[10px] font-bold uppercase tracking-wide', context ? 'text-muted-foreground/80' : 'text-muted-foreground')}>
            {tell.src}
          </div>
        )}
        <p className={cn('text-[13px] leading-snug', context ? 'text-muted-foreground' : 'text-foreground')}>{tell.text}</p>
      </div>
    </li>
  );
}

export function SpotlightPickCard({ pick }: { pick: NflPropSpotlight }) {
  const nFor = pick.n_for ?? 0;
  const nAgainst = pick.n_against ?? 0;
  const net = formatSignedNet(pick.net);
  const result = resultWord(pick.result);
  const pending = !pick.result;

  return (
    <section className="min-w-0 rounded-2xl border-2 border-primary/70 bg-primary/[0.07] p-3 shadow-[inset_0_0_0_1px_rgba(22,163,74,0.15)] sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-primary-foreground">
          Spotlight pick
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Week {pick.week}
          {pick.board_rank != null ? ` · #${pick.board_rank}` : ''}
        </span>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
            pending && 'bg-muted text-muted-foreground',
            !pending && pick.result === 'win' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
            !pending && pick.result === 'loss' && 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
            !pending && pick.result !== 'win' && pick.result !== 'loss' && 'bg-muted text-foreground',
          )}
        >
          {result}
        </span>
      </div>

      <h3 className="mt-3 text-[18px] font-black leading-tight text-foreground sm:text-[20px]">
        {formatPickLine(pick)}
      </h3>
      {pick.narrative ? (
        <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">{pick.narrative}</p>
      ) : null}
      {(nFor + nAgainst) > 0 && (
        <p className="mt-3 text-[13px] text-foreground">
          {nFor} {nFor === 1 ? 'read agrees' : 'reads agree'}
          {nAgainst === 0 ? ', none disagree' : `, ${nAgainst} ${nAgainst === 1 ? 'disagrees' : 'disagree'}`}
          {net ? <span className="text-muted-foreground"> · net {net}</span> : null}
        </p>
      )}

      {pick.tells.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {pick.tells.map((tell, index) => (
            <TellRow key={`${tell.family ?? 'tell'}-${tell.src ?? ''}-${index}`} tell={tell} />
          ))}
        </ul>
      )}

      {pick.actual_value != null && !pending && (
        <p className="mt-3 text-[12px] text-muted-foreground">Finished at {pick.actual_value}.</p>
      )}
    </section>
  );
}
