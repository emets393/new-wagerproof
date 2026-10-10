import type { ReactNode } from 'react';

export type CoverageShell = {
  name: string;
  pct: number;
  yardsPerRoute: number | null;
  routes: number | null;
  delta?: number | null;
  pctile?: number | null;
};

const CX = 168;
const CY = 168;

function point(radius: number, angle: number) {
  return [CX + radius * Math.cos(angle), CY + radius * Math.sin(angle)] as const;
}

function wedge(inner: number, outer: number, start: number, end: number) {
  const large = end - start > Math.PI ? 1 : 0;
  const [x0, y0] = point(outer, start);
  const [x1, y1] = point(outer, end);
  const [x2, y2] = point(inner, end);
  const [x3, y3] = point(inner, start);
  const n = (value: number) => value.toFixed(1);
  return `M ${n(x0)} ${n(y0)} A ${n(outer)} ${n(outer)} 0 ${large} 1 ${n(x1)} ${n(y1)} L ${n(x2)} ${n(y2)} A ${n(inner)} ${n(inner)} 0 ${large} 0 ${n(x3)} ${n(y3)} Z`;
}

function shellFill(shell: CoverageShell, season: number) {
  if (shell.delta != null) {
    if (shell.delta > 0) return 'var(--pc-leak)';
    if (shell.delta < 0) return 'var(--pc-stingy)';
    return 'var(--pc-don-off)';
  }
  if (shell.yardsPerRoute == null) return 'var(--pc-don-off)';
  return shell.yardsPerRoute > season ? 'var(--pc-leak)' : 'var(--pc-stingy)';
}

function ordinalPct(value: number): string {
  const n = Math.round(value);
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const mod10 = n % 10;
  if (mod10 === 1) return `${n}st`;
  if (mod10 === 2) return `${n}nd`;
  if (mod10 === 3) return `${n}rd`;
  return `${n}th`;
}

function shellInk(shell: CoverageShell, season: number) {
  if (shell.yardsPerRoute == null) return 'var(--pc-flat)';
  return shellFill(shell, season);
}

export function CoverageWheel({
  shells,
  composite,
  season,
  seasonLabel,
  unit,
  label,
  defenseName = 'The defense',
  note,
  copy = 'routes',
  measure = 'yards a route',
  sampleNoun = 'routes',
}: {
  shells: CoverageShell[];
  composite: string;
  season: number;
  seasonLabel: string;
  unit: string;
  label: string;
  defenseName?: string;
  note?: ReactNode;
  copy?: 'routes' | 'family';
  measure?: string;
  sampleNoun?: string;
}) {
  const peak = Math.max(season, ...shells.map((shell) => shell.yardsPerRoute ?? 0), 1);
  const barScale = Math.min(11.9, 48 / peak);
  const total = shells.reduce((sum, shell) => sum + shell.pct, 0) || 1;
  let angle = -Math.PI / 2;
  const drawn = shells.map((shell) => {
    const sweep = (shell.pct / total) * Math.PI * 2;
    const gap = Math.min(0.04, sweep * 0.18);
    const start = angle + gap / 2;
    const end = angle + sweep - gap / 2;
    angle += sweep;
    const outer = shell.yardsPerRoute == null ? null : 86 + shell.yardsPerRoute * barScale;
    return { shell, start, end, outer };
  });
  const smallOnes = drawn.filter((slice) => slice.shell.pct < 10);
  const slices = drawn.map((slice) => {
    const midBase = (slice.start + slice.end) / 2;
    const smallIndex = smallOnes.findIndex((item) => item.shell.name === slice.shell.name);
    const mid = slice.shell.pct < 10 ? midBase + (smallIndex - (smallOnes.length - 1) / 2) * 0.34 : midBase;
    const rim = ((slice.outer ?? 80) / 168) * 32;
    const reach = rim + (slice.shell.pct < 10 ? 13 : 11);
    const label = { x: 50 + Math.cos(mid) * reach, y: 50 + Math.sin(mid) * reach };
    const tip = { x: 50 + Math.cos(midBase) * rim, y: 50 + Math.sin(midBase) * rim };
    const dx = tip.x - label.x;
    const dy = tip.y - label.y;
    const len = Math.hypot(dx, dy) || 1;
    const inset = Math.min(7.2, len * 0.55);
    const from = { x: label.x + (dx / len) * inset, y: label.y + (dy / len) * inset };
    return { ...slice, label, tip, from };
  });

  return (
    <>
      <div className="wheel-layout">
        <div className="wheel-stage">
          <svg className="wheel-leads" viewBox="0 0 100 100" aria-hidden="true">
            {slices.map(({ shell, from, tip }) => (
              <g key={shell.name}>
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={tip.x}
                  y2={tip.y}
                  stroke={shellInk(shell, season)}
                  strokeWidth="0.45"
                  strokeLinecap="round"
                />
                <circle cx={tip.x} cy={tip.y} r="0.7" fill={shellInk(shell, season)} />
              </g>
            ))}
          </svg>
          <svg className="wheel" viewBox="0 0 336 336" role="img" aria-label={label}>
            {slices.map(({ shell, start, end, outer }) => (
              <g key={shell.name}>
                <path d={wedge(54, 80, start, end)} fill={shell.yardsPerRoute == null ? 'var(--pc-don-off)' : 'var(--pc-don)'} />
                {outer != null ? (
                  <path d={wedge(86, outer, start, end)} fill={shellFill(shell, season)} opacity="0.92" />
                ) : null}
              </g>
            ))}
            <text x="168" y="160" textAnchor="middle" className="wc">
              {composite}
            </text>
            <text x="168" y="176" textAnchor="middle" className="wcs">
              {unit}
            </text>
            <text x="168" y="191" textAnchor="middle" className="wcs">
              {seasonLabel}
            </text>
          </svg>
          {slices.map(({ shell, label: spot }) => {
            return (
              <span
                className="wheel-tag"
                key={shell.name}
                style={{ left: `${spot.x}%`, top: `${spot.y}%`, color: shellInk(shell, season) }}
              >
                {shell.name}
                <b>{shell.pct}%</b>
              </span>
            );
          })}
        </div>
        <p className="lede">
          {copy === 'family'
            ? `The percent is how often ${defenseName} plays that look. Green is above his usual ${season.toFixed(2)} ${measure}. Red is below. These looks can overlap, so the slices are sized against each other.`
            : `The percent is how often ${defenseName} plays that coverage. The yards are what he gains every time he runs a route in it, and the count is how many routes that number comes from. Green is more than his usual ${season.toFixed(2)} yards a route. Red is less. Grey means no routes on file.`}
        </p>
        <div className="wheel-readout">
          {shells.map((shell) => (
            <div className="lin" key={shell.name}>
              <span className="sec" style={{ color: shellInk(shell, season), borderColor: shellInk(shell, season) }}>
                {shell.name}
              </span>
              <em>
                {defenseName} plays this on {shell.pct}% of snaps.
                {shell.yardsPerRoute == null
                  ? ''
                  : copy === 'family'
                    ? ` He gains ${shell.yardsPerRoute.toFixed(2)} ${measure}${shell.delta == null ? '' : `, ${shell.delta > 0 ? '+' : '−'}${Math.abs(shell.delta).toFixed(2)} versus his usual`}${shell.routes == null ? '' : `, from ${shell.routes} ${sampleNoun}`}${shell.pctile == null ? '' : `, ${ordinalPct(shell.pctile)} percentile`}.`
                    : ` He gains ${shell.yardsPerRoute.toFixed(2)} yards every route he runs against it, across ${shell.routes} routes.`}
              </em>
            </div>
          ))}
        </div>
      </div>
      {note}
    </>
  );
}
