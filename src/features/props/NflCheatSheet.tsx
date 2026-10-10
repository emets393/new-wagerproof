import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { getNFLTeamLogo } from '@/features/games/api/nflGames';
import {
  activeCheat,
  columnsFor,
  formatActual,
  formatGap,
  metricDirection,
  metricHelp,
  metricLabel,
  rankLabel,
  sortRows,
  type CheatMetric,
  type CheatRow,
  type CheatTone,
} from '@/features/nflTools/propMatchups/cheatsheet';
import type { NflPropGameFeedItem } from '@/features/nflTools/propMatchups/model';
import type { NflPropPlayerPage } from '@/features/propBreakdown/types';
import { buildTrenchRows, formatTrenchEdge, type TrenchRow } from '@/features/nflTools/propMatchups/trenchSheet';

const FAMILIES = [
  { value: 'passing', label: 'Passing' },
  { value: 'rushing', label: 'Rushing' },
  { value: 'receiving', label: 'Receiving' },
] as const;
const FILTER_CLASS = 'h-8 rounded-full border border-black/10 bg-background px-3 text-[12px] font-bold dark:border-white/10';

function TeamLogo({ abbr, size = 'h-7 w-7' }: { abbr: string; size?: string }) {
  const src = abbr ? getNFLTeamLogo(abbr) : '';
  if (!src || src.endsWith('placeholder.svg')) return null;
  return <img src={src} alt="" className={cn(size, 'shrink-0 object-contain')} />;
}

function TeamLockup({
  team,
  opponent,
  kickoff,
  onOpen,
}: {
  team: string;
  opponent: string;
  kickoff: string | null;
  onOpen?: () => void;
}) {
  const body = (
    <span className="flex items-center gap-2">
      <TeamLogo abbr={team} />
      <span className="min-w-0">
        <span className="block font-bold">{team}</span>
        <span className="mt-0.5 block whitespace-nowrap text-[10px] font-medium text-muted-foreground">
          vs {opponent} · {kickoffLabel(kickoff)}
        </span>
      </span>
    </span>
  );
  if (!onOpen) return <div className="text-left">{body}</div>;
  return (
    <button type="button" className="text-left text-primary" onClick={onOpen}>
      {body}
    </button>
  );
}

const HEAD = 'sticky top-0 z-20 bg-background px-3 py-2 shadow-[inset_0_-1px_0_0_rgba(0,0,0,0.08)] dark:shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.08)]';

function ColumnTitle({ label, help, onSort, mark }: { label: string; help: string; onSort?: () => void; mark?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" onClick={onSort} className="whitespace-nowrap text-left underline decoration-dotted decoration-muted-foreground/50 underline-offset-[3px]">
          {label}{mark ?? ''}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="!z-[100] max-w-xs text-left text-[12px] font-medium normal-case tracking-normal">{help}</TooltipContent>
    </Tooltip>
  );
}

function toneClass(tone: CheatTone): string {
  if (tone === 'pos') return 'text-primary';
  if (tone === 'neg') return 'text-destructive';
  return 'text-muted-foreground';
}

function MetricCell({ metricKey, metric, side, featured }: { metricKey: string; metric: CheatMetric | null; side: string; featured?: boolean }) {
  const gap = metric ? formatGap(metricKey, metric, side) : null;
  const rank = metric ? rankLabel(metric, side, metricKey) : null;
  return (
    <td className={cn('px-3 py-2 align-top tabular-nums', featured && 'bg-primary/5')}>
      {metric?.actual == null ? (
        <span className="text-muted-foreground">not charted this week</span>
      ) : (
        <>
          <div className="font-semibold">{formatActual(metricKey, metric.actual)}</div>
          {gap ? <div className={cn('text-[10px] font-bold', toneClass(gap.tone))}>{gap.text} vs league</div> : null}
          {rank ? <div className={cn('text-[10px] font-bold', gap && gap.tone !== 'nil' ? toneClass(gap.tone) : 'text-muted-foreground')}>{rank}</div> : null}
        </>
      )}
    </td>
  );
}

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

  const offense = rows[0]?.side === 'offense';
  const playerLabel = offense ? 'Own player' : 'Opponent';
  const playerHelp = offense
    ? 'This team’s player in the role the filter selected.'
    : 'The opponent’s player in the role the filter selected.';

  return (
    <table className="w-max min-w-full border-separate border-spacing-0 text-left text-[12px]">
          <thead>
            <tr className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              <th className={cn(HEAD, 'left-0 z-30')}>
                <ColumnTitle label="Team" help="The team this row is about. Under the name is the opponent and the local kickoff." />
              </th>
              {columns.map((key) => (
                <th key={key} className={cn(HEAD, key === headline && 'text-foreground')}>
                  <ColumnTitle
                    label={metricLabel(key)}
                    help={`${metricHelp(key)} ${metricDirection(rows[0]?.side ?? 'offense', key)}`}
                    onSort={() => toggle(key)}
                    mark={sortKey === key ? (direction === 'desc' ? ' ↓' : ' ↑') : ''}
                  />
                </th>
              ))}
              <th className={HEAD}>
                <ColumnTitle label={playerLabel} help={playerHelp} />
              </th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((row) => {
              const game = games.find((item) => item.away.abbrev === row.team || item.home.abbrev === row.team);
              return (
                <tr key={`${row.team}-${row.opponent}`} className="border-t border-black/5 dark:border-white/10">
                  <td className="sticky left-0 z-10 bg-background px-3 py-2 align-top">
                    <TeamLockup team={row.team} opponent={row.opponent} kickoff={row.kickoff} onOpen={game ? () => onTeam(game.id) : undefined} />
                  </td>
                  {columns.map((key) => (
                    <MetricCell key={key} metricKey={key} metric={row.metrics[key] ?? null} side={row.side} featured={key === headline} />
                  ))}
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
  );
}

function TrenchBoard({
  rows,
  games,
  team,
  onTeam,
}: {
  rows: TrenchRow[];
  games: NflPropGameFeedItem[];
  team: string;
  onTeam: (gameId: string) => void;
}) {
  const [sortKey, setSortKey] = React.useState<'pass' | 'run'>('pass');
  const [direction, setDirection] = React.useState<'asc' | 'desc'>('desc');
  const filtered = rows.filter((row) => team === 'all' || row.team === team);
  const ordered = [...filtered].sort((a, b) => {
    const av = sortKey === 'pass' ? a.passEdge : a.runEdge;
    const bv = sortKey === 'pass' ? b.passEdge : b.runEdge;
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return (av - bv) * (direction === 'desc' ? -1 : 1);
  });

  function toggle(key: 'pass' | 'run') {
    if (sortKey === key) setDirection((current) => current === 'desc' ? 'asc' : 'desc');
    else {
      setSortKey(key);
      setDirection('desc');
    }
  }

  if (ordered.length === 0) return <p className="text-[13px] text-muted-foreground">Trenches are not charted this week.</p>;

  const columns: { key: 'pass' | 'run' | 'pressure' | 'ybc' | 'frontPressure' | 'frontYbc'; label: string; help: string }[] = [
    { key: 'pass', label: 'Pass edge', help: 'Combined pressure edge. Positive means this offensive line is favored against the front it faces.' },
    { key: 'run', label: 'Run edge', help: 'Combined yards-before-contact edge. Positive means this offensive line is favored.' },
    { key: 'pressure', label: 'Pressure faced', help: 'How often this line allows pressure, versus the league.' },
    { key: 'ybc', label: 'Yards before contact', help: 'Yards this line opens before a defender makes contact, versus the league.' },
    { key: 'frontPressure', label: 'Front pressure', help: 'How often the front they face generates pressure, versus the league.' },
    { key: 'frontYbc', label: 'Front yards', help: 'Yards before contact the front they face allows, versus the league.' },
  ];

  return (
    <table className="w-max min-w-full border-separate border-spacing-0 text-left text-[12px]">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                <th className={cn(HEAD, 'left-0 z-30')}>
                  <ColumnTitle label="Line" help="The offensive line this row is about. Under the name is the opponent and the local kickoff." />
                </th>
                {columns.map((column) => (
                  <th key={column.key} className={HEAD}>
                    <ColumnTitle
                      label={column.label}
                      help={column.help}
                      onSort={column.key === 'pass' || column.key === 'run' ? () => toggle(column.key as 'pass' | 'run') : undefined}
                      mark={sortKey === column.key ? (direction === 'desc' ? ' ↓' : ' ↑') : ''}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ordered.map((row) => {
                const game = games.find((item) => item.away.abbrev === row.team || item.home.abbrev === row.team);
                return (
                  <tr key={row.team} className="border-t border-black/5 dark:border-white/10">
                    <td className="sticky left-0 z-10 bg-background px-3 py-2 align-top">
                      <TeamLockup team={row.team} opponent={row.opponent} kickoff={row.kickoff} onOpen={game ? () => onTeam(game.id) : undefined} />
                    </td>
                    <EdgeCell kind="pass" value={row.passEdge} />
                    <EdgeCell kind="run" value={row.runEdge} />
                    <MetricCell metricKey="sack_rate" metric={row.pressure} side="offense" />
                    <MetricCell metricKey="yoe_per_target" metric={row.yardsBeforeContact} side="offense" />
                    <MetricCell metricKey="sack_rate" metric={row.frontPressure} side="offense" />
                    <MetricCell metricKey="yoe_per_target" metric={row.frontYards} side="offense" />
                  </tr>
                );
              })}
            </tbody>
    </table>
  );
}

function EdgeCell({ kind, value }: { kind: 'pass' | 'run'; value: number | null }) {
  const edge = formatTrenchEdge(kind, value);
  if (!edge) return <td className="px-3 py-2 align-top text-muted-foreground">not charted this week</td>;
  return <td className={cn('px-3 py-2 align-top font-semibold tabular-nums', toneClass(edge.tone))}>{edge.text}</td>;
}

export function NflCheatSheet({
  rows,
  pages = [],
  games,
  isLoading,
  onClose,
  onTeam,
  onPlayer,
}: {
  rows: CheatRow[];
  pages?: NflPropPlayerPage[];
  games: NflPropGameFeedItem[];
  isLoading: boolean;
  onClose: () => void;
  onTeam: (gameId: string) => void;
  onPlayer: (playerId: string) => void;
}) {
  const [family, setFamily] = React.useState('rushing');
  const [side, setSide] = React.useState<'offense' | 'defense'>('defense');
  const [team, setTeam] = React.useState('all');
  const [position, setPosition] = React.useState('RB');
  const [alignment, setAlignment] = React.useState('');
  const teams = [...new Set([...rows.map((row) => row.team), ...pages.map((page) => page.team)])].sort();
  const view = activeCheat({ family, side, position, alignment });
  const tableRows = rows.filter((row) => row.tableKey === view.tableKey && (team === 'all' || row.team === team));
  const trenches = buildTrenchRows(pages);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const overlay = (
    <div className="fixed inset-0 z-[80] flex flex-col bg-background text-foreground" role="dialog" aria-modal="true" aria-label="Cheat sheet">
      <div className="flex items-center gap-3 border-b border-black/10 px-4 py-3 dark:border-white/10">
        <h2 className="text-[17px] font-bold"><span aria-hidden>📊 </span>Cheat sheet</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close cheat sheet"
          className="ml-auto flex h-11 w-11 items-center justify-center rounded-full bg-black/[0.06] text-foreground hover:bg-black/10 dark:bg-white/[0.08] dark:hover:bg-white/15"
        >
          <X className="h-5 w-5" strokeWidth={2.5} />
        </button>
      </div>
      <div className="flex flex-wrap gap-2 border-b border-black/5 px-4 py-3 dark:border-white/10">
        <select
          aria-label="Family"
          value={family}
          onChange={(event) => {
            const next = event.target.value;
            setFamily(next);
            setAlignment('');
            if (next === 'receiving') setPosition('WR');
            if (next === 'rushing') setPosition('RB');
          }}
          className={FILTER_CLASS}
        >
          <option value="trenches">Trenches</option>
          {FAMILIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        {view.showSide ? (
          <select aria-label="Side" value={side} onChange={(event) => { setSide(event.target.value as 'offense' | 'defense'); setAlignment(''); }} className={FILTER_CLASS}>
            <option value="offense">Offense</option>
            <option value="defense">Defense</option>
          </select>
        ) : null}
        <select aria-label="Team" value={team} onChange={(event) => setTeam(event.target.value)} className={FILTER_CLASS}>
          <option value="all">All teams</option>
          {teams.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        {view.positions.length > 0 ? (
          <select aria-label="Position" value={view.positions.some((item) => item.value === position) ? position : view.positions[0].value} onChange={(event) => { setPosition(event.target.value); setAlignment(''); }} className={FILTER_CLASS}>
            {view.positions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        ) : null}
        {view.alignments.length > 0 ? (
          <select aria-label="Alignment" value={alignment} onChange={(event) => { setAlignment(event.target.value); if (event.target.value) setSide('defense'); }} className={FILTER_CLASS}>
            <option value="">By position</option>
            {view.alignments.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        ) : null}
      </div>
      <div className="border-b border-black/5 px-4 py-3 dark:border-white/10">
        <h3 className="text-[15px] font-bold"><span aria-hidden>{family === 'trenches' ? '🛡️' : family === 'passing' ? '🎯' : family === 'receiving' ? '🙌' : '🏃'} </span>{view.title}</h3>
        <p className="mt-1 max-w-3xl text-[13px] leading-snug text-muted-foreground">
          {view.description}{team === 'all' ? '' : ` Showing ${team} only.`}
          {' '}{view.kind === 'trenches'
            ? 'Green favors this offensive line.'
            : 'Green favors the team in the row, and 1st is the best for them. A mix, like man or slot share, stays grey.'}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? <p className="px-4 py-4 text-[13px] text-muted-foreground">Loading the week.</p> : view.kind === 'trenches' ? (
          <TrenchBoard rows={trenches} games={games} team={team} onTeam={onTeam} />
        ) : tableRows.length === 0 ? (
          <p className="px-4 py-4 text-[13px] text-muted-foreground">Nothing is charted for this filter.</p>
        ) : (
          <CheatTable key={view.tableKey} tableKey={view.tableKey ?? ''} rows={tableRows} games={games} onTeam={onTeam} onPlayer={onPlayer} />
        )}
      </div>
    </div>
  );

  if (typeof document === 'undefined' || !document.body) return overlay;
  return createPortal(overlay, document.body);
}
