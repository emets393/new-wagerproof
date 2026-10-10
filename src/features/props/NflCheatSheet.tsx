import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  TABLE_LABEL,
  TABLE_ORDER,
  columnsFor,
  formatActual,
  formatGap,
  metricLabel,
  rankLabel,
  sortRows,
  type CheatRow,
} from '@/features/nflTools/propMatchups/cheatsheet';
import type { NflPropGameFeedItem } from '@/features/nflTools/propMatchups/model';

const FAMILIES = ['passing', 'rushing', 'receiving'] as const;

function kickoffLabel(iso: string | null): string {
  if (!iso) return 'Kickoff not posted';
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function CheatTable({
  tableKey,
  rows,
  games,
  onTeam,
  onPlayer,
}: {
  tableKey: string;
  rows: CheatRow[];
  games: NflPropGameFeedItem[];
  onTeam: (gameId: string) => void;
  onPlayer: (playerId: string) => void;
}) {
  const columns = columnsFor(tableKey);
  const headline = rows.find((row) => row.headline && columns.includes(row.headline))?.headline ?? columns[0];
  const [sortKey, setSortKey] = React.useState(headline ?? '');
  const [direction, setDirection] = React.useState<'asc' | 'desc'>('desc');
  const ordered = sortRows(rows, sortKey, direction);

  function toggle(key: string) {
    if (sortKey === key) setDirection((current) => current === 'desc' ? 'asc' : 'desc');
    else {
      setSortKey(key);
      setDirection('desc');
    }
  }

  return (
    <section className="min-w-0">
      <h3 className="mb-2 text-[13px] font-bold">{TABLE_LABEL[tableKey] ?? tableKey}</h3>
      <div className="overflow-x-auto rounded-xl border border-black/5 dark:border-white/10">
        <table className="w-max min-w-full border-separate border-spacing-0 text-left text-[12px]">
          <thead>
            <tr className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              <th className="sticky left-0 z-10 bg-background px-3 py-2">Team</th>
              {columns.map((key) => (
                <th key={key} className="px-3 py-2">
                  <button type="button" className={cn('whitespace-nowrap', key === headline && 'text-foreground')} onClick={() => toggle(key)}>
                    {metricLabel(key)}{sortKey === key ? (direction === 'desc' ? ' ↓' : ' ↑') : ''}
                  </button>
                </th>
              ))}
              <th className="px-3 py-2">Player</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((row) => {
              const game = games.find((item) => item.away.abbrev === row.team || item.home.abbrev === row.team);
              return (
                <tr key={`${row.team}-${row.opponent}`} className="border-t border-black/5 dark:border-white/10">
                  <td className="sticky left-0 z-10 bg-background px-3 py-2 align-top">
                    {game ? (
                      <button type="button" className="text-left font-bold text-primary" onClick={() => onTeam(game.id)}>
                        {row.team}
                      </button>
                    ) : <div className="font-bold">{row.team}</div>}
                    <div className="mt-0.5 whitespace-nowrap text-[10px] font-medium text-muted-foreground">
                      vs {row.opponent} · {kickoffLabel(row.kickoff)}
                    </div>
                  </td>
                  {columns.map((key) => {
                    const metric = row.metrics[key];
                    const gap = metric ? formatGap(key, metric) : null;
                    const featured = key === headline;
                    return (
                      <td key={key} className={cn('px-3 py-2 align-top tabular-nums', featured && 'bg-primary/5')}>
                        {metric?.actual == null ? (
                          <span className="text-muted-foreground">not charted this week</span>
                        ) : (
                          <>
                            <div className="font-semibold">{formatActual(key, metric.actual)}</div>
                            {gap ? (
                              <div className={cn('text-[10px] font-bold', gap.tone === 'pos' && 'text-primary', gap.tone === 'neg' && 'text-destructive', gap.tone === 'nil' && 'text-muted-foreground')}>
                                {gap.text} vs league
                              </div>
                            ) : null}
                            {rankLabel(metric) ? <div className="text-[10px] text-muted-foreground">{rankLabel(metric)}</div> : null}
                          </>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 align-top">
                    {row.player ? (
                      <button type="button" className="text-left" onClick={() => onPlayer(row.player!.player_id)}>
                        <div className="font-bold text-primary">{row.player.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          {row.player.share_label ?? row.player.position}
                          {row.player.share != null ? ` · ${(row.player.share * 100).toFixed(1)}%` : ''}
                        </div>
                      </button>
                    ) : <span className="text-muted-foreground">{'\u2014'}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function NflCheatSheet({
  rows,
  games,
  isLoading,
  onClose,
  onTeam,
  onPlayer,
}: {
  rows: CheatRow[];
  games: NflPropGameFeedItem[];
  isLoading: boolean;
  onClose: () => void;
  onTeam: (gameId: string) => void;
  onPlayer: (playerId: string) => void;
}) {
  const [family, setFamily] = React.useState<string>('all');
  const [side, setSide] = React.useState<string>('all');
  const [team, setTeam] = React.useState<string>('all');
  const teams = [...new Set(rows.map((row) => row.team))].sort();
  const visible = rows.filter((row) => (
    (family === 'all' || row.family === family)
    && (side === 'all' || row.side === side)
    && (team === 'all' || row.team === team)
  ));

  return (
    <div className="min-w-0 px-3 py-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-bold">Cheat sheet</h2>
        <button type="button" onClick={onClose} className="ml-auto text-[12px] font-bold text-primary">Close</button>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <select aria-label="Family" value={family} onChange={(event) => setFamily(event.target.value)} className="h-8 rounded-full border border-black/10 bg-background px-3 text-[12px] font-bold dark:border-white/10">
          <option value="all">All families</option>
          {FAMILIES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select aria-label="Side" value={side} onChange={(event) => setSide(event.target.value)} className="h-8 rounded-full border border-black/10 bg-background px-3 text-[12px] font-bold dark:border-white/10">
          <option value="all">Offense and defense</option>
          <option value="offense">Offense</option>
          <option value="defense">Defense</option>
        </select>
        <select aria-label="Team" value={team} onChange={(event) => setTeam(event.target.value)} className="h-8 rounded-full border border-black/10 bg-background px-3 text-[12px] font-bold dark:border-white/10">
          <option value="all">All teams</option>
          {teams.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>
      {isLoading ? <p className="text-[13px] text-muted-foreground">Loading the week.</p> : null}
      {!isLoading && visible.length === 0 ? <p className="text-[13px] text-muted-foreground">No cheat sheet rows for this filter.</p> : null}
      <div className="space-y-6">
        {FAMILIES.filter((item) => family === 'all' || family === item).map((item) => {
          const tables = TABLE_ORDER.filter((key) => visible.some((row) => row.family === item && row.tableKey === key));
          if (!tables.length) return null;
          return (
            <div key={item} className="space-y-4">
              <h2 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{item}</h2>
              {tables.map((key) => (
                <CheatTable
                  key={key}
                  tableKey={key}
                  rows={visible.filter((row) => row.tableKey === key)}
                  games={games}
                  onTeam={onTeam}
                  onPlayer={onPlayer}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
