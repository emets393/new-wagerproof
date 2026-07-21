import * as React from 'react';

/** rAF count-up that eases toward each new value — makes filter changes feel alive. */
export function useCountUp(target: number, duration = 550): number {
  const [display, setDisplay] = React.useState(target);
  const fromRef = React.useRef(target);
  React.useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = from + (target - from) * eased;
      setDisplay(v);
      fromRef.current = v;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return display;
}

const RAMPS = {
  good: ['#34d399', '#059669'],
  near: ['#fbbf24', '#d97706'],
  bad: ['#f87171', '#dc2626'],
} as const;

/**
 * Hit-rate ring, pure SVG: gradient progress arc with a soft glow, a "beat this" baseline tick,
 * and a count-up center number. Mirrors the iOS HitRateBar baseline semantics.
 */
export function HeroGauge({
  hit,
  baseline,
  outcomeWord,
  size = 140,
}: {
  hit: number;
  baseline: number;
  outcomeWord: string;
  size?: number;
}) {
  const gradId = React.useId();
  const r = 54;
  const stroke = 10;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, hit));
  const offset = c * (1 - clamped / 100);
  const good = hit >= Math.max(baseline, 50);
  const near = !good && hit >= baseline - 3;
  const ramp = RAMPS[good ? 'good' : near ? 'near' : 'bad'];
  const shown = useCountUp(Number.isFinite(hit) ? hit : 0);
  // baseline tick angle (SVG: 0deg = 3 o'clock; the arc group is rotated -90 so 0% = 12 o'clock)
  const tickAngle = (baseline / 100) * 2 * Math.PI - Math.PI / 2;
  const inner = r - stroke / 2 - 2;
  const outer = r + stroke / 2 + 2;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={ramp[0]} />
            <stop offset="100%" stopColor={ramp[1]} />
          </linearGradient>
        </defs>
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          <circle cx={cx} cy={cy} r={r} fill="none" className="stroke-black/[0.06] dark:stroke-white/[0.08]" strokeWidth={stroke} />
          {/* soft glow under the arc */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={ramp[1]}
            strokeWidth={stroke + 6}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            opacity={0.18}
            style={{ filter: 'blur(6px)', transition: 'stroke-dashoffset .6s cubic-bezier(0.32,0.72,0,1), stroke .3s ease' }}
          />
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset .6s cubic-bezier(0.32,0.72,0,1)' }}
          />
        </g>
        {/* baseline "beat this" tick */}
        <line
          x1={cx + inner * Math.cos(tickAngle)}
          y1={cy + inner * Math.sin(tickAngle)}
          x2={cx + outer * Math.cos(tickAngle)}
          y2={cy + outer * Math.sin(tickAngle)}
          className="stroke-foreground/70"
          strokeWidth={2}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[26px] font-bold tabular-nums leading-none tracking-tight">
          {shown.toFixed(Number.isInteger(hit) ? 0 : 1)}%
        </span>
        <span className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {outcomeWord} rate
        </span>
      </div>
    </div>
  );
}
