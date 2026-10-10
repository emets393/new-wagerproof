import { cn } from '@/lib/utils';
import type { FpCards } from '@/features/propBreakdown/types';
import {
  actualField,
  formatNum,
  formatPct,
  numField,
  rankPhrase,
  vsPositionStat,
} from '../fpCards';

export type DeepSection = 'playsheet' | 'alignment' | 'defense' | 'scheme' | 'runs' | 'redzone';

const ALIGN_ORDER = ['wide', 'slot', 'inline', 'backfield'] as const;
const SHELL_ORDER = ['Man', 'Zone', 'SingleHigh', 'TwoHigh'] as const;
const COVER_ORDER = ['Cover2', 'Cover3', 'Cover4', 'Cover6', 'Man'] as const;
const RUN_STEPS: Array<[string, string]> = [
  ['runs_1plus', '1+'],
  ['runs_3plus', '3+'],
  ['runs_5plus', '5+'],
  ['runs_10plus', '10+'],
  ['runs_15plus', '15+'],
  ['runs_20plus', '20+'],
];

export const SECTION_COPY: Record<DeepSection, { title: string; subtitle: string }> = {
  playsheet: {
    title: 'Playsheet',
    subtitle: 'How often he runs each route, and how this defense handles it',
  },
  alignment: {
    title: 'Where he lines up',
    subtitle: 'Where he lines up, and what they allow there',
  },
  defense: {
    title: 'Vs this defense',
    subtitle: 'What this defense allows to his position',
  },
  scheme: {
    title: 'Coverage & scheme',
    subtitle: 'How he produces against each shell, and what they play',
  },
  runs: {
    title: 'Run concepts',
    subtitle: 'Man and zone carries, and how far a run goes',
  },
  redzone: {
    title: 'Red zone',
    subtitle: 'Who gets the ball inside the 20, and what they allow',
  },
};

function tone(rank: number | null, of: number | null): string {
  if (rank == null || of == null || of <= 0) return 'text-foreground';
  if (rank <= of / 3) return 'text-primary';
  if (rank > (of * 2) / 3) return 'text-rose-600 dark:text-rose-400';
  return 'text-foreground';
}

function ready(id: DeepSection, cards: FpCards, position: string): boolean {
  if (id === 'playsheet') return (cards.routes?.length ?? 0) > 0 && position !== 'QB';
  if (id === 'alignment') {
    const spots = cards.playsheet?.spots;
    return Boolean(spots && Object.values(spots).some((row) => (row.routes ?? 0) > 0));
  }
  if (id === 'defense') return Boolean(cards.matchup?.vs_position);
  if (id === 'scheme') return Boolean(cards.scheme?.player || cards.coverage?.by);
  if (id === 'runs') return Boolean(cards.run_concept?.by || cards.run_consistency);
  return Boolean(cards.redzone);
}

/** Deep sections, in the order this market should be argued. Absent blobs are left out. */
export function sectionPlan(position: string, market: string, cards: FpCards | null | undefined): DeepSection[] {
  if (!cards) return [];
  const pos = position.toUpperCase();
  const rush = market === 'player_rush_yds' || market === 'player_rush_attempts';
  const recv = market === 'player_reception_yds' || market === 'player_receptions';
  const passTd = market === 'player_pass_tds' || market === 'player_anytime_td';
  const pass = market.startsWith('player_pass');
  let order: DeepSection[];
  if (rush && pos !== 'WR' && pos !== 'TE') order = ['runs', 'defense', 'redzone'];
  else if (passTd) order = ['redzone', 'defense', 'playsheet', 'alignment', 'scheme'];
  else if (pos === 'QB' && pass) order = ['scheme', 'defense', 'redzone'];
  else if (recv || pos === 'WR' || pos === 'TE') order = ['playsheet', 'alignment', 'defense', 'scheme', 'redzone'];
  else order = ['defense', 'playsheet', 'alignment', 'scheme', 'runs', 'redzone'];
  return order.filter((id) => ready(id, cards, pos));
}

export function expectedBlobNames(position: string, market: string): string[] {
  const pos = position.toUpperCase();
  const names = ['baseline', 'matchup'];
  const rush = market.includes('rush');
  const recv = market.includes('reception') || pos === 'WR' || pos === 'TE';
  const scoring = market === 'player_anytime_td' || market === 'player_pass_tds';
  if (recv && !rush) names.push('routes', 'playsheet', 'scheme');
  if (rush) names.push('run_concept', 'run_consistency');
  if (scoring || pos === 'QB') names.push('redzone', 'coverage');
  return names;
}

export function absentBlobNames(cards: FpCards | null | undefined, names: string[]): string[] {
  return names.filter((name) => {
    const value = cards?.[name as keyof FpCards];
    if (value == null) return true;
    return Array.isArray(value) && value.length === 0;
  });
}

export function AlignmentSection({ cards }: { cards: FpCards }) {
  const spots = cards.playsheet?.spots ?? {};
  const rows = ALIGN_ORDER
    .map((key) => {
      const spot = spots[key];
      return { key, routes: spot?.routes ?? 0 };
    })
    .filter((row) => row.routes > 0);
  const total = rows.reduce((sum, row) => sum + row.routes, 0);
  if (total <= 0) return null;
  const allowed = cards.matchup?.vs_alignment ?? {};
  return (
    <div className="min-w-0">
      <div className="flex h-8 overflow-hidden rounded-full bg-muted">
        {rows.map((row, index) => (
          <div
            key={row.key}
            className="flex items-center justify-center overflow-hidden bg-foreground text-[10px] font-bold uppercase text-background"
            style={{ width: `${(row.routes / total) * 100}%`, opacity: 1 - index * 0.18 }}
            title={row.key}
          >
            {(row.routes / total) >= 0.16 ? row.key : ''}
          </div>
        ))}
      </div>
      <ul className="mt-3 space-y-2">
        {rows.map((row) => {
          const bag = allowed[row.key];
          const yards = bag ? actualField(bag, 'yds') : null;
          const rank = bag?.yds_rank ?? null;
          const of = bag?.yds_of ?? null;
          const phrase = rankPhrase(rank, of);
          return (
            <li key={row.key} className="grid grid-cols-[88px_1fr_auto] items-baseline gap-2 text-[13px]">
              <span className="font-bold uppercase tracking-wide">{row.key}</span>
              <span className="text-muted-foreground">{formatPct(row.routes / total)} of his routes</span>
              <span className="text-right">
                {yards != null && <span className="mr-2 font-mono text-[12px] text-muted-foreground">{formatNum(yards, 1)} yds/g</span>}
                {phrase && <span className={cn('font-black', tone(rank, of))}>{phrase}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function DefenseSection({ cards, market, position, opponent }: { cards: FpCards; market: string; position: string; opponent: string }) {
  const spec = vsPositionStat(market, position);
  const bag = cards.matchup?.vs_position;
  if (!spec || !bag) return null;
  const value = actualField(bag, spec.key);
  const rank = numField(bag, `${spec.key}_rank`);
  const of = numField(bag, `${spec.key}_of`);
  const league = numField(bag, `${spec.key}_league`);
  const phrase = rankPhrase(rank, of);
  if (value == null && !phrase) return null;
  const games = numField(bag, 'games');
  return (
    <div className="min-w-0">
      <p className="text-[12px] text-muted-foreground">What {opponent} {spec.verb} a {position}</p>
      {phrase && <div className={cn('mt-1 font-black leading-none tracking-tight text-[32px] sm:text-[40px]', tone(rank, of))}>{phrase}</div>}
      <p className="mt-2 text-[13px] text-muted-foreground">
        {value != null && <span className="font-mono text-foreground">{formatNum(value, 1)}</span>} {spec.unit}
        {league != null && <span> · league {formatNum(league, 1)}</span>}
        {games != null && <span> · {Math.round(games)} games</span>}
      </p>
    </div>
  );
}

export function SchemeSection({ cards, position }: { cards: FpCards; position: string }) {
  const qb = position.toUpperCase() === 'QB';
  const source = qb ? cards.coverage?.by : cards.scheme?.player;
  const order = qb ? COVER_ORDER : SHELL_ORDER;
  const rows = order.flatMap((key) => {
    const row = source?.[key];
    const value = row?.yards_per_route;
    if (typeof value !== 'number') return [];
    const shells = cards.scheme?.defense_shells;
    const rate = qb ? row?.def_plays_rate : shells?.[`${key}_rate`];
    return [{ key, value, rate: typeof rate === 'number' ? rate : null }];
  });
  if (rows.length === 0) return null;
  const overall = cards.route_overall?.yards_per_route ?? cards.scheme?.player_overall?.yards_per_route ?? null;
  const max = Math.max(...rows.map((row) => row.value), typeof overall === 'number' ? overall : 0, 0.01);
  return (
    <div className="space-y-2.5">
      {typeof overall === 'number' && (
        <p className="text-[12px] text-muted-foreground">His overall rate is {formatNum(overall, 2)} yards per route.</p>
      )}
      {rows.map((row) => (
        <div key={row.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[12px]">
            <span className="font-semibold">{row.key.replace(/([a-z])([A-Z])/g, '$1 $2')}</span>
            <span className="font-mono font-bold">
              {formatNum(row.value, 2)}
              {row.rate != null && <span className="ml-2 font-sans font-medium text-muted-foreground">they play it {formatPct(row.rate)}</span>}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RunSection({ cards }: { cards: FpCards }) {
  const by = cards.run_concept?.by ?? {};
  const concepts = (['Man', 'Zone'] as const).flatMap((key) => {
    const row = by[key];
    if (!row || typeof row.yards_per_attempt !== 'number') return [];
    return [{
      key,
      his: row.yards_per_attempt,
      theirs: typeof row.def_yards_per_attempt === 'number' ? row.def_yards_per_attempt : null,
      rank: typeof row.def_rank === 'number' ? row.def_rank : null,
      of: typeof row.def_of === 'number' ? row.def_of : null,
    }];
  });
  const steps = RUN_STEPS.flatMap(([key, label]) => {
    const value = cards.run_consistency?.[key];
    return typeof value === 'number' ? [{ key, label, value }] : [];
  });
  if (concepts.length === 0 && steps.length === 0) return null;
  return (
    <div className="space-y-4">
      {concepts.length > 0 && (
        <ul className="space-y-3">
          {concepts.map((row) => {
            const phrase = rankPhrase(row.rank, row.of);
            return (
              <li key={row.key}>
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{row.key}</div>
                {phrase && <div className={cn('text-[28px] font-black leading-none', tone(row.rank, row.of))}>{phrase}</div>}
                <p className="mt-1 text-[13px] text-muted-foreground">
                  <span className="font-mono text-foreground">{formatNum(row.his, 2)}</span> yards per carry
                  {row.theirs != null && <span> · they allow {formatNum(row.theirs, 2)}</span>}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      {steps.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">How far a carry goes</div>
          {steps.map((step) => (
            <div key={step.key}>
              <div className="mb-1 flex justify-between text-[12px]">
                <span>{step.label} yards</span>
                <span className="font-mono font-bold">{formatPct(step.value)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-foreground/70" style={{ width: `${Math.max(2, step.value * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const ZONE_FACTS: Array<{ key: string; label: string; market: string[] }> = [
  { key: 'rush_tds_allowed', label: 'Rushing touchdowns allowed', market: ['player_rush_yds', 'player_rush_attempts', 'player_anytime_td'] },
  { key: 'ez_tds_allowed', label: 'End-zone touchdowns allowed', market: ['player_anytime_td', 'player_pass_tds', 'player_reception_yds'] },
  { key: 'ez_targets_faced', label: 'End-zone targets faced', market: ['player_receptions', 'player_reception_yds', 'player_anytime_td'] },
  { key: 'i5_carries_faced', label: 'Carries faced inside the 5', market: ['player_rush_yds', 'player_rush_attempts'] },
];

export function RedZoneSection({ cards, market }: { cards: FpCards; market: string }) {
  const him = cards.redzone?.him;
  const defense = cards.redzone?.defense;
  const shares = [
    ['Inside the 5', him?.rz5_snap_share],
    ['Inside the 10', him?.rz10_snap_share],
    ['Inside the 20', him?.rz20_snap_share],
  ].filter((row): row is [string, number] => typeof row[1] === 'number');
  const facts = ZONE_FACTS.filter((fact) => fact.market.includes(market) && defense && typeof defense[`${fact.key}_rank`] === 'number');
  const inside = cards.situational?.Inside10;
  if (shares.length === 0 && facts.length === 0 && !inside) return null;
  return (
    <div className="space-y-3">
      {facts.map((fact) => {
        const rank = Number(defense?.[`${fact.key}_rank`]);
        const of = Number(defense?.[`${fact.key}_of`]);
        const value = actualField(defense, fact.key) ?? numField(defense, fact.key);
        const phrase = rankPhrase(rank, of);
        return (
          <div key={fact.key}>
            <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{fact.label}</div>
            {phrase && <div className={cn('text-[28px] font-black leading-none', tone(rank, of))}>{phrase}</div>}
            {value != null && <p className="mt-1 font-mono text-[13px] text-muted-foreground">{formatNum(value, 2)} a game</p>}
          </div>
        );
      })}
      {shares.length > 0 && (
        <ul className="space-y-1 text-[13px]">
          {shares.map(([label, value]) => (
            <li key={label} className="flex justify-between gap-3">
              <span>{label}</span>
              <span className="font-mono font-bold">{formatPct(value)} of snaps</span>
            </li>
          ))}
        </ul>
      )}
      {inside && typeof inside.pass_rate === 'number' && (
        <p className="text-[13px] text-muted-foreground">
          Inside the 10, the offense passes {formatPct(inside.pass_rate)} of snaps
          {inside.pass_rate_rank != null && inside.pass_rate_of != null && (
            <span className={cn('ml-1 font-bold', tone(inside.pass_rate_rank, inside.pass_rate_of))}>
              {rankPhrase(inside.pass_rate_rank, inside.pass_rate_of)}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
