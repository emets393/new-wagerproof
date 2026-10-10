import { cn } from '@/lib/utils';
import type { NflPropSpotlight } from '@/features/propBreakdown/types';
import { formatPickLine, formatSignedNet, qualifiedPlayerCount, resultWord } from '../fpCards';

export function SpotlightRecord({
  record,
}: {
  record: { wins: number; losses: number; pushes: number; graded: number } | undefined;
}) {
  if (!record || record.graded === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-black/10 px-3 py-3 text-[13px] leading-snug text-muted-foreground dark:border-white/10">
        No spotlight picks have been graded yet. This table is the record — it stays empty until games are played.
      </p>
    );
  }
  return (
    <p className="rounded-2xl border border-black/5 bg-white/40 px-3 py-3 text-[13px] dark:border-white/10 dark:bg-white/[0.03]">
      <span className="font-bold text-foreground">Spotlight record </span>
      <span className="font-mono font-bold">{record.wins}-{record.losses}-{record.pushes}</span>
      <span className="text-muted-foreground"> from {record.graded} graded {record.graded === 1 ? 'pick' : 'picks'}.</span>
    </p>
  );
}

export function SpotlightBoard({
  picks,
  playerCount,
  selectedKey,
  onSelect,
  record,
  picksLoading = false,
  pagesLoading = false,
}: {
  picks: NflPropSpotlight[];
  playerCount: number;
  selectedKey: string | null;
  onSelect: (pick: NflPropSpotlight) => void;
  record?: { wins: number; losses: number; pushes: number; graded: number };
  picksLoading?: boolean;
  pagesLoading?: boolean;
}) {
  const qualified = qualifiedPlayerCount(picks);
  if (picksLoading) {
    return (
      <div className="min-w-0 space-y-2 px-3 pb-6 pt-1">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-16 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    );
  }
  return (
    <div className="min-w-0 space-y-2 px-3 pb-6">
      <SpotlightRecord record={record} />
      {pagesLoading ? (
        <div className="mx-1 h-4 w-56 animate-pulse rounded bg-muted" />
      ) : (
        <p className="px-1 text-[12px] leading-snug text-muted-foreground">
          {qualified} of {playerCount} players are on the board this week
          {picks.length !== qualified ? `, across ${picks.length} picks` : ''}. Ranked by the board, not by a projection.
        </p>
      )}
      <ol className="space-y-2">
        {picks.map((pick) => {
          const key = `${pick.player_id}:${pick.market}`;
          const selected = key === selectedKey;
          const net = formatSignedNet(pick.net);
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => onSelect(pick)}
                className={cn(
                  'flex min-h-11 w-full items-start gap-3 rounded-2xl border px-3 py-2.5 text-left',
                  selected
                    ? 'border-primary/70 bg-primary/[0.08]'
                    : 'border-black/5 bg-white/50 hover:bg-white/80 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]',
                )}
              >
                <span className="mt-0.5 w-6 shrink-0 font-mono text-[12px] font-bold text-muted-foreground">
                  {pick.board_rank ?? '–'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-bold">{pick.player_name}</span>
                  <span className="mt-0.5 block text-[12px] text-muted-foreground">
                    {pick.position} · {pick.team} vs {pick.opponent}
                  </span>
                  <span className="mt-1 block text-[13px] font-semibold text-foreground">{formatPickLine(pick)}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{resultWord(pick.result)}</span>
                  {net && <span className="mt-1 block font-mono text-[12px] font-bold">{net}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {picks.length === 0 && (
        <p className="rounded-2xl border border-dashed border-black/10 px-3 py-8 text-center text-[13px] text-muted-foreground dark:border-white/10">
          No spotlight picks are stamped for this week yet.
        </p>
      )}
    </div>
  );
}
