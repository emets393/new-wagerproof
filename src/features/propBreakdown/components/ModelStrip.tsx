import { cn } from '@/lib/utils';
import type { MarketProjection, NflPropPlayerPage, PropMarket } from '../types';
import { formatPerGame } from '../format';
import { StatTip } from './StatTip';

const PREVIEW_TIP =
  'Based on his 2025 game-by-game distribution. Live model projections replace this at kickoff week.';

/**
 * Model Strip — projection band / TD rate under the market toggle.
 * Render-only: numbers come served; layout math only for placing ticks on the bar.
 */
export function ModelStrip({
  page,
  marketKey,
  market,
}: {
  page: NflPropPlayerPage;
  marketKey: string;
  market: PropMarket | undefined;
}) {
  if (page.rookie) {
    return <StripShell><Fallback message="Projection coming soon" /></StripShell>;
  }

  const proj = page.projection?.[marketKey];
  if (!proj) {
    return <StripShell><Fallback message="Projection coming soon" /></StripShell>;
  }

  if (proj.kind === 'rate') {
    return (
      <StripShell>
        <RateStrip proj={proj} />
      </StripShell>
    );
  }

  return (
    <StripShell>
      <BandStrip proj={proj} market={market} />
    </StripShell>
  );
}

function StripShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white/55 px-3.5 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.05]">
      {children}
    </div>
  );
}

function Fallback({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        WagerProof Projection
      </span>
      <span className="text-[13px] text-muted-foreground">{message}</span>
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const isPreview = status !== 'model';
  if (isPreview) {
    return (
      <StatTip tip={PREVIEW_TIP} label="PREVIEW">
        <span className="inline-flex cursor-help rounded-full border border-amber-500/35 bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-amber-800 dark:text-amber-200">
          Preview
        </span>
      </StatTip>
    );
  }
  return (
    <span className="inline-flex rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">
      Model
    </span>
  );
}

function RateStrip({ proj }: { proj: Extract<MarketProjection, { kind: 'rate' }> }) {
  const pct = Math.round(Number(proj.score_rate) * 100);
  return (
    <div className="flex items-center gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            WagerProof Projection
          </span>
          <StatusChip status={String(proj.status)} />
        </div>
        <p className="mt-1 text-[12px] text-muted-foreground">
          of {proj.source} with a TD
        </p>
        {proj.vs_line != null && <VsLineChip vsLine={proj.vs_line} />}
      </div>
      <div
        className="relative flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(from -90deg, rgb(245 158 11) ${pct}%, rgba(120,120,120,0.18) 0)`,
          boxShadow: '0 0 20px rgba(245,158,11,0.25)',
        }}
      >
        <div className="absolute inset-[6px] flex flex-col items-center justify-center rounded-full bg-background/95 dark:bg-black/80">
          <span className="font-mono text-[20px] font-black leading-none">{pct}%</span>
        </div>
      </div>
    </div>
  );
}

function BandStrip({
  proj,
  market,
}: {
  proj: Extract<MarketProjection, { kind: 'band' }>;
  market: PropMarket | undefined;
}) {
  const line =
    market?.status === 'posted' && market.line != null && !Number.isNaN(Number(market.line))
      ? Number(market.line)
      : null;

  const low = Number(proj.low);
  const high = Number(proj.high);
  const median = Number(proj.median);

  // Layout scale only — expand to include the posted line so the tick always lands on-bar.
  const scaleMin = line != null ? Math.min(low, line) : low;
  const scaleMax = line != null ? Math.max(high, line) : high;
  const span = Math.max(scaleMax - scaleMin, 1e-6);

  const pct = (v: number) => `${((v - scaleMin) / span) * 100}%`;
  const bandLeft = ((low - scaleMin) / span) * 100;
  const bandWidth = ((high - low) / span) * 100;
  const medianLeft = ((median - scaleMin) / span) * 100;
  const lineLeft = line != null ? ((line - scaleMin) / span) * 100 : null;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          WagerProof Projection
        </span>
        <div className="flex items-center gap-2">
          {proj.vs_line != null && <VsLineChip vsLine={proj.vs_line} />}
          <StatusChip status={String(proj.status)} />
        </div>
      </div>

      {/* Median number sits above the marker */}
      <div className="relative mb-1 h-6">
        <div
          className="absolute -translate-x-1/2 font-mono text-[18px] font-black leading-none tracking-tight"
          style={{ left: pct(median) }}
        >
          {formatPerGame(median, 1)}
        </div>
      </div>

      <div className="relative h-3.5">
        {/* Base track */}
        <div className="absolute inset-y-[5px] left-0 right-0 rounded-full bg-muted/70 dark:bg-white/10" />

        {/* Soft-glow projection band */}
        <div
          className="absolute inset-y-[2px] rounded-full"
          style={{
            left: `${bandLeft}%`,
            width: `${Math.max(bandWidth, 1.5)}%`,
            background:
              'linear-gradient(90deg, rgba(245,158,11,0.25), rgba(245,158,11,0.55), rgba(245,158,11,0.25))',
            boxShadow: '0 0 14px rgba(245,158,11,0.45), inset 0 0 8px rgba(245,158,11,0.25)',
          }}
        />

        {/* Median marker */}
        <div
          className="absolute top-1/2 z-[1] h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.9)] ring-2 ring-background"
          style={{ left: `${medianLeft}%` }}
          title={`Median ${formatPerGame(median, 1)}`}
        />

        {/* Posted line tick */}
        {lineLeft != null && line != null && (
          <div
            className="absolute top-0 z-[2] flex h-full -translate-x-1/2 flex-col items-center"
            style={{ left: `${lineLeft}%` }}
          >
            <div className="h-full w-[2px] rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)] dark:bg-white" />
          </div>
        )}
      </div>

      <div className="relative mt-1.5 h-4 text-[11px] font-semibold text-muted-foreground">
        <span className="absolute left-0 font-mono">{formatPerGame(low, 1)}</span>
        {line != null && (
          <span
            className="absolute -translate-x-1/2 whitespace-nowrap text-[10px] font-bold uppercase tracking-wide text-foreground"
            style={{ left: pct(line) }}
          >
            Line {formatPerGame(line, 1)}
          </span>
        )}
        <span className="absolute right-0 font-mono">{formatPerGame(high, 1)}</span>
      </div>

      <p className="mt-1 text-[10px] text-muted-foreground">
        {proj.source} · n={proj.n}
        {line == null ? ' · line pending' : ''}
      </p>
    </div>
  );
}

function VsLineChip({ vsLine }: { vsLine: number }) {
  const up = vsLine > 0;
  const down = vsLine < 0;
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 font-mono text-[11px] font-bold',
        up && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
        down && 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
        !up && !down && 'bg-muted text-muted-foreground'
      )}
    >
      {vsLine > 0 ? '+' : ''}
      {formatPerGame(vsLine, 1)} vs line
    </span>
  );
}
