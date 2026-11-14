import type { FpCards, FpRouteLeaf } from '@/features/propBreakdown/types';
import { formatNum, formatPct, readRoute, sortRoutes } from '../fpCards';

const PATHS: Record<string, string> = {
  Go: 'M0 0 V-118',
  Hitch: 'M0 0 V-52 C0 -40 8 -36 8 -28',
  Out: 'M0 0 V-64 H36',
  Slant: 'M0 0 L-62 -48',
  Post: 'M0 0 V-72 L-48 -118',
  Corner: 'M0 0 V-72 L40 -118',
  Crossers: 'M0 0 L-110 -18',
  InDig: 'M0 0 V-56 L-40 -56',
  Comeback: 'M0 0 V-84 C0 -70 12 -66 14 -54',
  Flat: 'M0 0 L28 -14',
  Screens: 'M0 0 L-18 16',
  Backfield: 'M0 0 L-24 18',
};

const ALIGN: Record<string, { x: number; y: number }> = {
  wide: { x: 286, y: 168 },
  slot: { x: 214, y: 168 },
  inline: { x: 164, y: 168 },
  backfield: { x: 180, y: 196 },
};

const SOFT = '#16A34A';
const STIFF = '#D03232';
const NEUTRAL = '#94A3B8';

function stemColor(row: FpRouteLeaf): string {
  const read = readRoute(row, null);
  if (read.theirThin || row.def_rank == null || row.def_of == null || row.def_of <= 0) return NEUTRAL;
  if (row.def_rank <= row.def_of / 3) return SOFT;
  if (row.def_rank > (row.def_of * 2) / 3) return STIFF;
  return NEUTRAL;
}

function shellLabel(shells: Record<string, number | null> | undefined): { text: string; twoHigh: boolean } | null {
  if (!shells) return null;
  const num = (key: string) => (typeof shells[key] === 'number' ? Number(shells[key]) : 0);
  const zone = num('Zone_rate');
  const man = num('Man_rate');
  const single = num('SingleHigh_rate') || num('Cover1_rate') + num('Cover3_rate');
  const two = num('TwoHigh_rate') || num('Cover2_rate') + num('Cover4_rate') + num('Cover6_rate');
  if (zone + man + single + two === 0) return null;
  const family = zone >= man ? 'Zone-heavy' : 'Man-heavy';
  const high = single >= two ? 'Single-High' : 'Two-High';
  const rate = Math.max(zone, man);
  return { text: `${family} · ${high}, ${formatPct(rate) ?? '—'} of dropbacks`, twoHigh: two > single };
}

function primaryAlignment(cards: FpCards): string {
  const spots = cards.playsheet?.spots ?? {};
  const ranked = Object.entries(spots).sort((a, b) => (b[1]?.routes ?? 0) - (a[1]?.routes ?? 0));
  if (ranked[0] && (ranked[0][1]?.routes ?? 0) > 0) return ranked[0][0];
  const role = cards.role ?? {};
  const shares: Array<[string, number]> = [
    ['wide', role.align_wide_share ?? 0],
    ['slot', role.align_slot_share ?? 0],
    ['inline', role.align_inline_share ?? 0],
    ['backfield', role.align_backfield_share ?? 0],
  ];
  shares.sort((a, b) => b[1] - a[1]);
  return shares[0][1] > 0 ? shares[0][0] : 'wide';
}

function XMark({ x, y }: { x: number; y: number }) {
  return (
    <g stroke="currentColor" strokeWidth="1.7" opacity="0.75">
      <line x1={x - 5} y1={y - 5} x2={x + 5} y2={y + 5} />
      <line x1={x - 5} y1={y + 5} x2={x + 5} y2={y - 5} />
    </g>
  );
}

export function RouteDiagram({ cards, opponent }: { cards: FpCards; opponent: string }) {
  const routes = sortRoutes(cards.routes ?? []).slice(0, 8);
  if (routes.length === 0) return null;
  const shell = shellLabel(cards.scheme?.defense_shells);
  const align = primaryAlignment(cards);
  const origin = ALIGN[align] ?? ALIGN.wide;
  const mates = [108, 148, 188, 248].filter((x) => Math.abs(x - origin.x) > 24);

  return (
    <figure className="min-w-0">
      <svg viewBox="0 0 360 230" className="h-auto w-full text-foreground" role="img" aria-label="Playsheet">
        <title>{`Route tree against ${opponent}`}</title>
        {[
          [36, '+20'],
          [68, '+15'],
          [100, '+10'],
          [132, '+5'],
        ].map(([y, label]) => (
          <g key={String(label)}>
            <line x1="28" x2="344" y1={Number(y)} y2={Number(y)} stroke="currentColor" strokeOpacity="0.14" />
            <text x="8" y={Number(y) + 3} fill="currentColor" opacity="0.45" fontSize="8">
              {label}
            </text>
          </g>
        ))}
        <line x1="28" x2="344" y1="168" y2="168" stroke="currentColor" strokeWidth="1.6" />
        <text x="8" y="172" fill="currentColor" opacity="0.55" fontSize="8">LOS</text>
        {(shell?.twoHigh
          ? [[120, 42], [240, 42], [78, 96], [282, 96], [160, 112], [210, 112]]
          : [[180, 38], [78, 92], [282, 92], [140, 114], [180, 108], [230, 114]]
        ).map(([x, y]) => (
          <XMark key={`${x}-${y}`} x={x} y={y} />
        ))}
        {mates.map((x) => (
          <circle key={x} cx={x} cy="168" r="6" fill="none" stroke="currentColor" strokeOpacity="0.45" />
        ))}
        <circle cx={origin.x} cy={origin.y} r="7" fill={SOFT} />
        {routes.map((row, index) => {
          const path = PATHS[row.route ?? ''] ?? 'M0 0 V-70';
          const width = 1.2 + Math.min(1, Math.max(0, row.share ?? 0)) * 6.5;
          const shift = (index - (routes.length - 1) / 2) * 3;
          return (
            <path
              key={row.route ?? index}
              d={path}
              transform={`translate(${origin.x + shift} ${origin.y}) scale(0.88)`}
              fill="none"
              stroke={stemColor(row)}
              strokeWidth={width}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
      </svg>
      {shell && <p className="mt-1 text-center text-[12px] font-semibold text-foreground">{shell.text}</p>}
      <ul className="mt-2 space-y-1">
        {routes.map((row) => {
          const his = formatNum(row.yards_per_route, 2);
          const theirs = formatNum(row.def_yards_per_route_actual, 2);
          return (
            <li key={row.route} className="flex items-baseline justify-between gap-3 text-[12px]" style={{ color: stemColor(row) }}>
              <span className="font-semibold text-foreground">{row.route}</span>
              <span className="font-mono">
                {formatPct(row.share) ?? '—'} · {his ?? '—'} vs {theirs ?? '—'} allowed
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
        Thickness is how often he runs it. Colour is how {opponent} allow it — green where they are soft, red where they are stiff.
      </p>
    </figure>
  );
}
