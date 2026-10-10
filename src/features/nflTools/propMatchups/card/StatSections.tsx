import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FpCards, FpRouteLeaf } from '@/features/propBreakdown/types';
import {
  actualField,
  allowanceClaim,
  depthBands,
  depthLabel,
  formatNum,
  formatPct,
  numField,
  overGames,
  positionPlural,
  prettyKey,
  rankPhrase,
  readRoute,
  scriptBuckets,
  scriptLabel,
  sectionsFor,
  shellKeys,
  sortRoutes,
  traitReading,
  type CardSection,
  vsPositionStat,
} from '../fpCards';

function Block({
  title,
  teaser,
  defaultOpen,
  children,
}: {
  title: string;
  teaser?: string | null;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => setOpen(defaultOpen), [defaultOpen]);
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-black/5 bg-white/40 dark:border-white/10 dark:bg-white/[0.03]">
      <button
        type="button"
        className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{title}</span>
          {!open && teaser && <span className="mt-0.5 block truncate text-[12px] text-foreground">{teaser}</span>}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="min-w-0 border-t border-black/5 px-3 py-3 dark:border-white/10">{children}</div>}
    </section>
  );
}

function ScrollTable({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-full overflow-x-auto overscroll-x-contain">
      <table className="w-full min-w-[520px] border-collapse text-left text-[12px]">{children}</table>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="whitespace-nowrap px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{children}</th>;
}

function Fact({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return <p className={cn('text-[13px] leading-snug', muted ? 'text-muted-foreground' : 'text-foreground')}>{children}</p>;
}

function RouteRows({ routes, overall, mode }: { routes: FpRouteLeaf[]; overall: number | null | undefined; mode: 'yards' | 'targets' }) {
  const ordered = sortRoutes(routes);
  return (
    <ScrollTable>
      <thead>
        <tr>
          <Th>Route</Th>
          <Th>Share</Th>
          <Th>{mode === 'targets' ? 'Targets / route' : 'His yds / route'}</Th>
          <Th>His routes</Th>
          <Th>They allow</Th>
          <Th>Rank</Th>
          <Th>Routes faced</Th>
        </tr>
      </thead>
      <tbody>
        {ordered.map((row) => {
          const read = readRoute(row, overall);
          const his = mode === 'targets' ? formatNum(row.targets_per_route, 2) : formatNum(row.yards_per_route, 2);
          const theirs = formatNum(row.def_yards_per_route_actual, 2);
          const thin = read.hisThin || read.theirThin;
          const gap =
            mode === 'yards' && !read.hisThin && row.yards_per_route != null && overall != null
              ? row.yards_per_route - overall
              : null;
          return (
            <tr key={row.route} className={cn('border-t border-black/5 dark:border-white/10', thin ? 'text-muted-foreground' : 'text-foreground', read.highlight && 'bg-primary/[0.06]')}>
              <td className="whitespace-nowrap px-2 py-2 font-semibold">{row.route}</td>
              <td className="px-2 py-2 font-mono">{formatPct(row.share) ?? '—'}</td>
              <td className="px-2 py-2 font-mono">
                {his ?? '—'}
                {gap != null && (
                  <span className="ml-1 text-[10px] text-muted-foreground">
                    {gap > 0 ? '+' : ''}{formatNum(gap, 2)} vs his {formatNum(overall, 2)}
                  </span>
                )}
              </td>
              <td className="px-2 py-2 font-mono">{read.hisN != null ? Math.round(read.hisN) : '—'}</td>
              <td className="px-2 py-2 font-mono">{theirs ?? '—'}</td>
              <td className="whitespace-nowrap px-2 py-2">{read.theirThin ? '—' : rankPhrase(row.def_rank, row.def_of) ?? '—'}</td>
              <td className="px-2 py-2 font-mono">{row.def_routes_faced != null ? Math.round(row.def_routes_faced) : '—'}</td>
            </tr>
          );
        })}
      </tbody>
    </ScrollTable>
  );
}

function RoutesBlock({ cards, market, open }: { cards: FpCards; market: string; open: boolean }) {
  const routes = cards.routes ?? [];
  const overall = cards.route_overall?.yards_per_route;
  const top = sortRoutes(routes)[0];
  const mode = market === 'player_receptions' ? 'targets' : 'yards';
  const teaser = top
    ? `${routes.length} routes · ${top.route ?? 'Top'} ${formatPct(top.share) ?? ''} of his tree`
    : null;
  return (
    <Block title="Route tree" teaser={teaser} defaultOpen={open}>
      <p className="mb-2 text-[12px] text-muted-foreground">
        Ordered by how often he runs each route. A grey row is a thin sample — the number is real, the comparison is not.
        {mode === 'targets' ? ' This market leads with targets per route. Bar weight on the diagram is still his route share.' : ''}
      </p>
      <RouteRows routes={routes} overall={overall} mode={mode} />
    </Block>
  );
}

const ALIGN_ORDER = ['wide', 'slot', 'inline', 'backfield'] as const;

function AlignmentBlock({ cards, opponent, market, position, open }: { cards: FpCards; opponent: string; market: string; position: string; open: boolean }) {
  const spots = cards.playsheet?.spots ?? {};
  const allowed = cards.matchup?.vs_alignment ?? {};
  const leadBackfield = position.toUpperCase() === 'RB' && (market === 'player_reception_yds' || market === 'player_receptions');
  const keys = leadBackfield
    ? ['backfield', ...ALIGN_ORDER.filter((key) => key !== 'backfield')]
    : [...ALIGN_ORDER];
  const shareKey: Record<string, string> = {
    wide: 'align_wide_share',
    slot: 'align_slot_share',
    inline: 'align_inline_share',
    backfield: 'align_backfield_share',
  };
  const rows = keys.filter((key) => spots[key] || allowed[key] || cards.role?.[shareKey[key]] != null);
  return (
    <Block title="Alignment" teaser={rows[0] ? `${prettyKey(rows[0])} is the spot to read first` : null} defaultOpen={open}>
      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map((key) => {
          const spot = spots[key];
          const defense = allowed[key];
          const share = cards.role?.[shareKey[key]];
          const claim = allowanceClaim({
            subject: `${opponent} allow`,
            value: defense ? numField(defense, 'yds_actual') : null,
            unit: `yards a game from the ${key}`,
            rank: defense ? numField(defense, 'yds_rank') : null,
            of: defense ? numField(defense, 'yds_of') : null,
            games: defense ? numField(defense, 'games') : null,
          });
          return (
            <div key={key} className="min-w-0 rounded-xl border border-black/5 px-3 py-2 dark:border-white/10">
              <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{prettyKey(key)}</div>
              <div className="mt-1 font-mono text-[18px] font-bold">{typeof share === 'number' ? formatPct(share) : '—'}</div>
              <div className="text-[11px] text-muted-foreground">of his routes</div>
              {spot?.yards_per_route != null && (
                <Fact>He gains {formatNum(spot.yards_per_route, 2)} yards per route here{overGames(spot.games) ? `, ${overGames(spot.games)}` : ''}.</Fact>
              )}
              {claim && <Fact muted={!defense}>{claim}</Fact>}
            </div>
          );
        })}
      </div>
    </Block>
  );
}

function SchemeBlock({ cards, open }: { cards: FpCards; open: boolean }) {
  const shells = shellKeys(cards.scheme?.player);
  const defense = cards.scheme?.defense_shells;
  return (
    <Block title="Coverage and scheme" teaser={shells.length ? `${shells.length} shells` : null} defaultOpen={open}>
      <div className="grid gap-2 md:grid-cols-2">
        {shells.map((key) => {
          const row = cards.scheme?.player?.[key];
          const rate = defense ? numField(defense, `${key}_rate_actual`) : null;
          const rank = defense ? rankPhrase(numField(defense, `${key}_rate_rank`), numField(defense, `${key}_rate_of`)) : null;
          return (
            <div key={key} className="rounded-xl border border-black/5 px-3 py-2 dark:border-white/10">
              <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{prettyKey(key)}</div>
              <div className="mt-1 font-mono text-[18px] font-bold">{formatNum(row?.yards_per_route, 2) ?? '—'}</div>
              <div className="text-[11px] text-muted-foreground">yards per route · {formatNum(row?.routes, 1) ?? '—'} routes{overGames(row?.games) ? ` ${overGames(row?.games)}` : ''}</div>
              {rate != null && <Fact muted>They play it on {formatPct(rate)} of dropbacks{rank ? `, ${rank}` : ''}.</Fact>}
            </div>
          );
        })}
      </div>
    </Block>
  );
}

function ThrowDepthBlock({ cards, opponent, open }: { cards: FpCards; opponent: string; open: boolean }) {
  const bands = depthBands(cards.throw_depth?.by);
  return (
    <Block title="Throw depth" teaser={bands.length ? `${bands.length} depth bands` : null} defaultOpen={open}>
      <ScrollTable>
        <thead>
          <tr>
            <Th>Depth</Th>
            <Th>Attempts</Th>
            <Th>Yds / att</Th>
            <Th>Comp</Th>
            <Th>{opponent} allow</Th>
            <Th>Rank</Th>
            <Th>Faced</Th>
          </tr>
        </thead>
        <tbody>
          {bands.map((key) => {
            const row = cards.throw_depth?.by?.[key];
            return (
              <tr key={key} className="border-t border-black/5 dark:border-white/10">
                <td className="whitespace-nowrap px-2 py-2 font-semibold">{depthLabel(key)}</td>
                <td className="px-2 py-2 font-mono">{formatNum(row?.attempts, 1) ?? '—'}</td>
                <td className="px-2 py-2 font-mono">{formatNum(row?.yards_per_attempt, 2) ?? '—'}</td>
                <td className="px-2 py-2 font-mono">{formatPct(row?.completion_pct) ?? '—'}</td>
                <td className="px-2 py-2 font-mono">{formatNum(row?.def_yards_per_attempt, 2) ?? '—'}</td>
                <td className="whitespace-nowrap px-2 py-2">{rankPhrase(row?.def_rank, row?.def_of) ?? '—'}</td>
                <td className="px-2 py-2 font-mono">{formatNum(row?.def_attempts_faced, 0) ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </ScrollTable>
    </Block>
  );
}

function RoleBlock({ cards, open }: { cards: FpCards; open: boolean }) {
  const entries = Object.entries(cards.role ?? {}).filter(([, value]) => typeof value === 'number');
  return (
    <Block title="Role" teaser={entries.length ? `${entries.length} usage rates` : null} defaultOpen={open}>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {entries.map(([key, value]) => (
          <div key={key} className="min-w-0 rounded-xl bg-muted/40 px-2.5 py-2">
            <div className="truncate text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{prettyKey(key)}</div>
            <div className="font-mono text-[16px] font-bold">{/share|pct|rate/i.test(key) ? formatPct(value) : formatNum(value, 1)}</div>
          </div>
        ))}
      </div>
    </Block>
  );
}

function EfficiencyBlock({ cards, open }: { cards: FpCards; open: boolean }) {
  const entries = Object.entries(cards.efficiency ?? {}).filter(([, value]) => typeof value === 'number');
  return (
    <Block title="Efficiency" teaser={entries.length ? `${entries.length} rates` : null} defaultOpen={open}>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {entries.map(([key, value]) => (
          <div key={key} className="min-w-0 rounded-xl bg-muted/40 px-2.5 py-2">
            <div className="truncate text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{prettyKey(key)}</div>
            <div className="font-mono text-[16px] font-bold">{/share|pct|rate/i.test(key) ? formatPct(value) : formatNum(value, key === 'adot' ? 1 : 2)}</div>
          </div>
        ))}
      </div>
    </Block>
  );
}

function VsPositionBlock({ cards, market, position, opponent, open }: { cards: FpCards; market: string; position: string; opponent: string; open: boolean }) {
  const bag = cards.matchup?.vs_position;
  const spec = vsPositionStat(market, position);
  const games = bag ? numField(bag, 'games') : null;
  const window = typeof bag?.window === 'string' ? bag.window : null;
  const primary = spec
    ? allowanceClaim({
        subject: `${opponent} ${spec.verb}`,
        value: actualField(bag, spec.key),
        unit: `${spec.unit} to ${positionPlural(position)}`,
        rank: numField(bag, `${spec.key}_rank`),
        of: numField(bag, `${spec.key}_of`),
        games,
        window,
      })
    : null;
  const league = spec ? numField(bag, `${spec.key}_league`) : null;
  const pressure = traitReading(cards.scheme?.defense_traits, 'Pressured');
  const pressureText = pressure?.actual != null
    ? `${opponent} have pressured the quarterback on ${formatPct(pressure.actual)} of dropbacks${rankPhrase(pressure.rank, pressure.of) ? `, ${rankPhrase(pressure.rank, pressure.of)}` : ''}${pressure.league != null ? `, league ${formatPct(pressure.league)}` : ''}.`
    : null;
  return (
    <Block title="What they allow" teaser={primary} defaultOpen={open}>
      <div className="space-y-2">
        {primary && <Fact>{primary}{league != null ? ` League ${formatNum(league, 1)}.` : ''}</Fact>}
        {pressureText && (market.startsWith('player_pass') || market.includes('reception')) && <Fact>{pressureText}</Fact>}
      </div>
    </Block>
  );
}

function RunConceptBlock({ cards, opponent, open }: { cards: FpCards; opponent: string; open: boolean }) {
  const by = cards.run_concept?.by ?? {};
  const keys = Object.keys(by).sort((a, b) => (by[b]?.attempts ?? 0) - (by[a]?.attempts ?? 0));
  return (
    <Block title="Run concepts" teaser={keys[0] ? `${prettyKey(keys[0])} leads his carries` : null} defaultOpen={open}>
      <div className="grid gap-2 md:grid-cols-2">
        {keys.map((key) => {
          const row = by[key];
          const claim = allowanceClaim({
            subject: `${opponent} allow`,
            value: row?.def_yards_per_attempt,
            unit: `yards per ${key.toLowerCase()} carry`,
            rank: row?.def_rank,
            of: row?.def_of,
            games: row?.def_attempts_faced != null ? undefined : row?.games,
          });
          return (
            <div key={key} className="rounded-xl border border-black/5 px-3 py-2 dark:border-white/10">
              <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{prettyKey(key)}</div>
              <div className="mt-1 font-mono text-[18px] font-bold">{formatNum(row?.yards_per_attempt, 2) ?? '—'}</div>
              <div className="text-[11px] text-muted-foreground">yards per carry · {formatNum(row?.attempts, 1) ?? '—'} attempts{overGames(row?.games) ? ` ${overGames(row?.games)}` : ''}</div>
              {claim && <Fact>{claim}{row?.def_attempts_faced != null ? ` ${Math.round(row.def_attempts_faced)} carries faced.` : ''}</Fact>}
            </div>
          );
        })}
      </div>
    </Block>
  );
}

function ConsistencyBlock({ cards, open }: { cards: FpCards; open: boolean }) {
  const bag = cards.run_consistency ?? {};
  const order = ['runs_1plus', 'runs_5plus', 'runs_10plus', 'runs_3plus', 'runs_15plus', 'runs_20plus'];
  const keys = [...order.filter((key) => typeof bag[key] === 'number'), ...Object.keys(bag).filter((key) => !order.includes(key) && typeof bag[key] === 'number' && !key.includes('share'))];
  return (
    <Block title="How far a carry goes" teaser="Share of carries that reach each distance" defaultOpen={open}>
      <div className="grid grid-cols-3 gap-2">
        {keys.map((key) => (
          <div key={key} className="rounded-xl bg-muted/40 px-2 py-2 text-center">
            <div className="font-mono text-[18px] font-bold">{formatPct(bag[key])}</div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{prettyKey(key).replace('Runs ', '')}</div>
          </div>
        ))}
      </div>
    </Block>
  );
}

function ScriptBlock({ cards, market, open }: { cards: FpCards; market: string; open: boolean }) {
  const keys = scriptBuckets(market, cards.situational);
  const rush = market === 'player_rush_yds' || market === 'player_rush_attempts';
  return (
    <Block title="Game script" teaser={keys[0] ? scriptLabel(keys[0]) : null} defaultOpen={open}>
      <div className="space-y-2">
        {keys.map((key) => {
          const row = cards.situational?.[key];
          const rate = row?.pass_rate;
          const rank = rankPhrase(row?.pass_rate_rank, row?.pass_rate_of);
          const snaps = formatNum(row?.snaps, 1);
          if (rate == null) return null;
          const passPct = formatPct(rate);
          const runShare = Math.abs(rate) <= 1.5 ? 1 - rate : null;
          return (
            <Fact key={key}>
              {scriptLabel(key)}: they pass on {passPct} of snaps
              {rank ? `, ${rank} for pass rate` : ''}
              {snaps ? `, ${snaps} snaps a game` : ''}.
              {rush && runShare != null ? ` The other ${formatPct(runShare)} of those snaps are runs.` : ''}
            </Fact>
          );
        })}
      </div>
    </Block>
  );
}

function CoverageBlock({ cards, open }: { cards: FpCards; open: boolean }) {
  const coverage = cards.coverage?.by;
  const by = coverage && Object.keys(coverage).length > 0 ? coverage : (cards.scheme?.player ?? {});
  const order = ['Cover2', 'Cover3', 'Cover4', 'Cover6', 'Man'];
  const keys = [...order.filter((key) => by[key]), ...Object.keys(by).filter((key) => !order.includes(key) && key !== 'Overall')];
  return (
    <Block title="Coverage faced" teaser={keys.length ? `${keys.length} coverages` : null} defaultOpen={open}>
      <div className="grid gap-2 md:grid-cols-2">
        {keys.map((key) => {
          const row = by[key];
          return (
            <div key={key} className="rounded-xl border border-black/5 px-3 py-2 dark:border-white/10">
              <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{prettyKey(key)}</div>
              <div className="mt-1 font-mono text-[18px] font-bold">{formatNum(row?.yards_per_route ?? row?.ppr_per_dropback, 2) ?? '—'}</div>
              <div className="text-[11px] text-muted-foreground">
                {row?.yards_per_route != null ? 'yards per route' : 'per dropback'}
                {row?.routes != null ? ` · ${formatNum(row.routes, 1)} routes` : ''}
                {row?.dropbacks != null ? ` · ${formatNum(row.dropbacks, 1)} dropbacks` : ''}
                {overGames(row?.games) ? ` ${overGames(row.games)}` : ''}
              </div>
              {row?.def_plays_rate != null && (
                <Fact muted>They play it on {formatPct(row.def_plays_rate)} of dropbacks{rankPhrase(row.def_plays_rank, row.def_plays_of) ? `, ${rankPhrase(row.def_plays_rank, row.def_plays_of)}` : ''}.</Fact>
              )}
            </div>
          );
        })}
      </div>
    </Block>
  );
}

const RZ_LABEL: Record<string, string> = {
  rz5_snap_share: 'Inside 5, on the field',
  rz10_snap_share: 'Inside 10, on the field',
  rz20_snap_share: 'Inside 20, on the field',
  ez_targets: 'End-zone targets a game',
  rz20_targets: 'Targets inside 20 a game',
  ez_tds: 'End-zone touchdowns a game',
  rec_td_share: 'Share of receiving touchdowns',
  rz5_carry_share: 'Share of carries inside 5',
  rz10_carry_share: 'Share of carries inside 10',
  rz5_carries: 'Carries inside 5 a game',
  rz10_carries: 'Carries inside 10 a game',
  ez_attempts: 'End-zone attempts a game',
  rz5_carries_team: 'Team carries inside 5',
  ez_targets_team: 'Team end-zone targets',
  i5_carries_faced: 'Inside-5 carries faced a game',
  rush_tds_allowed: 'Rushing touchdowns allowed a game',
  ez_targets_faced: 'End-zone targets faced a game',
  ez_tds_allowed: 'End-zone touchdowns allowed a game',
  i20_targets_faced: 'Inside-20 targets faced a game',
  ez_attempts_faced: 'End-zone attempts faced a game',
};

function formatRz(key: string, value: number): string {
  if (/share|pct|rate/i.test(key)) return formatPct(value) ?? '—';
  return formatNum(value, 2) ?? '—';
}

function RedZoneBlock({ cards, opponent, open }: { cards: FpCards; opponent: string; open: boolean }) {
  const him = cards.redzone?.him ?? {};
  const defense = cards.redzone?.defense ?? {};
  const himKeys = Object.keys(RZ_LABEL).filter((key) => typeof him[key] === 'number');
  const defenseKeys = Object.keys(defense).filter((key) => typeof defense[key] === 'number' && !/_rank$|_of$|_league$/.test(key));
  return (
    <Block title="Red zone" teaser={himKeys[0] ? RZ_LABEL[himKeys[0]] ?? prettyKey(himKeys[0]) : null} defaultOpen={open}>
      <div className="grid gap-3 md:grid-cols-2">
        {himKeys.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Him</div>
            {himKeys.map((key) => (
              <div key={key} className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="text-muted-foreground">{RZ_LABEL[key] ?? prettyKey(key)}</span>
                <span className="font-mono font-bold">{formatRz(key, him[key] as number)}</span>
              </div>
            ))}
          </div>
        )}
        {defenseKeys.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{opponent} allow</div>
            {defenseKeys.map((key) => {
              const rank = rankPhrase(
                typeof defense[`${key}_rank`] === 'number' ? defense[`${key}_rank`] : null,
                typeof defense[`${key}_of`] === 'number' ? defense[`${key}_of`] : null,
              );
              return (
                <div key={key} className="text-[13px]">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-muted-foreground">{RZ_LABEL[key] ?? prettyKey(key)}</span>
                    <span className="font-mono font-bold">{formatNum(defense[key], 2)}</span>
                  </div>
                  {rank && <div className="text-[11px] text-muted-foreground">{rank}</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Block>
  );
}

export function StatSections({
  cards,
  market,
  position,
  opponent,
  defaultOpen,
}: {
  cards: FpCards | null | undefined;
  market: string;
  position: string;
  opponent: string;
  defaultOpen: boolean;
}) {
  const sections = sectionsFor(position, market, cards);
  if (!cards || sections.length === 0) return null;
  return (
    <div className="space-y-2">
      {sections.map((section) => (
        <SectionSwitch
          key={`${market}-${section}`}
          section={section}
          cards={cards}
          market={market}
          position={position}
          opponent={opponent}
          open={defaultOpen}
        />
      ))}
    </div>
  );
}

function SectionSwitch({
  section,
  cards,
  market,
  position,
  opponent,
  open,
}: {
  section: CardSection;
  cards: FpCards;
  market: string;
  position: string;
  opponent: string;
  open: boolean;
}) {
  if (section === 'routes') return <RoutesBlock cards={cards} market={market} open={open} />;
  if (section === 'alignment') return <AlignmentBlock cards={cards} opponent={opponent} market={market} position={position} open={open} />;
  if (section === 'scheme') return <SchemeBlock cards={cards} open={open} />;
  if (section === 'throw_depth') return <ThrowDepthBlock cards={cards} opponent={opponent} open={open} />;
  if (section === 'role') return <RoleBlock cards={cards} open={open} />;
  if (section === 'efficiency') return <EfficiencyBlock cards={cards} open={open} />;
  if (section === 'vs_position') return <VsPositionBlock cards={cards} market={market} position={position} opponent={opponent} open={open} />;
  if (section === 'run_concept') return <RunConceptBlock cards={cards} opponent={opponent} open={open} />;
  if (section === 'run_consistency') return <ConsistencyBlock cards={cards} open={open} />;
  if (section === 'script') return <ScriptBlock cards={cards} market={market} open={open} />;
  if (section === 'coverage') return <CoverageBlock cards={cards} open={open} />;
  return <RedZoneBlock cards={cards} opponent={opponent} open={open} />;
}
