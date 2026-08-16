import { cn } from '@/lib/utils';
import type { MarketProjection, NflPropPlayerPage, PropMarket } from '../types';
import { formatPerGame } from '../format';
import { StatTip } from './StatTip';

const PREVIEW_TIP =
  'Based on his 2025 game-by-game distribution. Live model projections replace this at kickoff week.';

/**
 * Model Strip — point projection / TD rate under the market toggle.
 * Render-only: numbers come served; layout math only for placing ticks on the bar.
 */
export function ModelStrip({
  page,
  marketKey,
  market,
  marketLine,
  vegasOdds,
}: {
  page: NflPropPlayerPage;
  marketKey: string;
  market: PropMarket | undefined;
  marketLine?: number | null;
  vegasOdds?: number | null;
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
        <RateStrip proj={proj} marketKey={marketKey} vegasOdds={vegasOdds} />
      </StripShell>
    );
  }

  return (
    <StripShell>
      <PointStrip proj={proj} market={market} marketKey={marketKey} line={marketLine} vegasOdds={vegasOdds} />
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

function RateStrip({
  proj,
  marketKey,
  vegasOdds,
}: {
  proj: Extract<MarketProjection, { kind: 'rate' }>;
  marketKey: string;
  vegasOdds?: number | null;
}) {
  const pct = Math.round(Number(proj.score_rate) * 100);
  const isTouchdown = marketKey.includes('td');
  if (isTouchdown) {
    return <TouchdownOddsComparison probability={Number(proj.score_rate)} vegasOdds={vegasOdds} />;
  }
  return (
    <div className="flex items-center gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            {isTouchdown ? 'Touchdown probability' : 'WagerProof hit probability'}
          </span>
          {!isTouchdown && <StatusChip status={String(proj.status)} />}
        </div>
        <p className="mt-2 text-[15px] font-semibold leading-snug text-foreground">
          {isTouchdown ? 'We think he has a ' : 'We think this market has a '}
          <span className="font-mono text-lg font-black text-amber-500">{pct}%</span>
          {isTouchdown ? ' chance to score a touchdown.' : ' chance to hit.'}
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
          {!isTouchdown && (
            <span className="mt-1 text-[7px] font-black uppercase tracking-[0.14em] text-muted-foreground">
              Hit chance
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function probabilityToAmerican(probability: number): number | null {
  if (!(probability > 0 && probability < 1)) return null;
  return probability >= 0.5
    ? -Math.round((probability / (1 - probability)) * 100)
    : Math.round(((1 - probability) / probability) * 100);
}

function americanToProbability(odds: number): number | null {
  if (!Number.isFinite(odds) || odds === 0) return null;
  return odds > 0 ? 100 / (odds + 100) : Math.abs(odds) / (Math.abs(odds) + 100);
}

function formatAmerican(odds: number | null): string {
  if (odds == null) return '—';
  return `${odds > 0 ? '+' : ''}${Math.round(odds)}`;
}

function TouchdownOddsComparison({
  probability,
  vegasOdds,
}: {
  probability: number;
  vegasOdds?: number | null;
}) {
  const modelPct = probability * 100;
  const fairOdds = probabilityToAmerican(probability);
  const vegasProbability = vegasOdds == null ? null : americanToProbability(vegasOdds);
  const vegasPct = vegasProbability == null ? null : vegasProbability * 100;
  const delta = vegasPct == null ? null : modelPct - vegasPct;
  const modelHigher = delta != null && delta > 0.05;
  const modelLower = delta != null && delta < -0.05;
  const comparisonGap = vegasPct == null ? 0 : Math.abs(modelPct - vegasPct);
  const chartPadding = Math.max(0.5, comparisonGap * 0.5);
  const chartMin = vegasPct == null ? 0 : Math.max(0, Math.min(modelPct, vegasPct) - chartPadding);
  const chartMax = vegasPct == null
    ? Math.max(20, Math.ceil(modelPct / 5) * 5)
    : Math.max(modelPct, vegasPct) + chartPadding;
  const chartSpan = Math.max(chartMax - chartMin, 1);
  const chartPosition = (value: number) => 6 + ((value - chartMin) / chartSpan) * 88;
  const modelPosition = chartPosition(modelPct);
  const vegasPosition = vegasPct == null ? null : chartPosition(vegasPct);
  const comparisonLeft = vegasPosition == null ? modelPosition : Math.min(modelPosition, vegasPosition);
  const comparisonWidth = vegasPosition == null ? 0 : Math.abs(modelPosition - vegasPosition);
  const directionPhrase = modelHigher
    ? 'more likely to score than Vegas does'
    : modelLower
      ? 'less likely to score than Vegas does'
      : 'about as likely to score as Vegas does';

  return (
    <div>
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        Touchdown probability
      </span>
      <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,0.9fr)_minmax(320px,1.1fr)] md:items-center">
        <ul className="text-[13px] font-semibold leading-relaxed text-foreground">
          <li className="flex gap-2.5">
            <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.65)]" />
            <span>
              We calculate a {modelPct.toFixed(1)}% chance to score—fair odds of {formatAmerican(fairOdds)}—so we think he is {directionPhrase}.
            </span>
          </li>
        </ul>

        <div className="min-w-0">
          <span className="text-[9px] font-black uppercase tracking-[0.13em] text-muted-foreground">Probability comparison</span>

          <div className="relative mt-2 h-[126px]">
            <div className="absolute inset-x-[5%] top-[68px] h-1 rounded-full bg-muted-foreground/20" />
            {vegasPosition != null && (
              <div
                className={cn('absolute top-[68px] h-1', modelHigher ? 'bg-emerald-500/55' : modelLower ? 'bg-rose-500/55' : 'bg-muted-foreground/40')}
                style={{ left: `${comparisonLeft}%`, width: `${comparisonWidth}%` }}
              />
            )}

            <div className="absolute top-0 w-[92px] -translate-x-1/2 text-center" style={{ left: `${modelPosition}%` }}>
              <span className="whitespace-nowrap text-[9px] font-black uppercase tracking-wide text-amber-600 dark:text-amber-300">WagerProof</span>
              <p className="mt-0.5 font-mono text-[14px] font-black leading-none">{modelPct.toFixed(1)}%</p>
              <p className="mt-1 font-mono text-[10px] font-bold text-muted-foreground">{formatAmerican(fairOdds)}</p>
              <div className="mx-auto mt-1.5 h-[20px] w-px bg-amber-500/60" />
            </div>
            <div className="absolute top-[63px] h-3 w-3 -translate-x-1/2 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)] ring-2 ring-background" style={{ left: `${modelPosition}%` }} />

            {vegasPosition != null && vegasPct != null && (
              <>
                <div className="absolute top-[63px] h-3 w-3 -translate-x-1/2 rounded-full bg-slate-400 ring-2 ring-background" style={{ left: `${vegasPosition}%` }} />
                <div className="absolute top-0 w-[92px] -translate-x-1/2 text-center" style={{ left: `${vegasPosition}%` }}>
                  <span className="whitespace-nowrap text-[9px] font-black uppercase tracking-wide text-muted-foreground">Vegas</span>
                  <p className="mt-0.5 font-mono text-[14px] font-black leading-none">{vegasPct.toFixed(1)}%</p>
                  <p className="mt-1 font-mono text-[10px] font-bold text-muted-foreground">{formatAmerican(vegasOdds ?? null)}</p>
                  <div className="mx-auto mt-1.5 h-[20px] w-px bg-slate-400/60" />
                </div>
              </>
            )}

            {delta != null && (
              <span
                className={cn(
                  'absolute top-[82px] -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-[10px] font-black',
                  modelHigher && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
                  modelLower && 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
                  !modelHigher && !modelLower && 'bg-muted text-muted-foreground',
                )}
                style={{ left: `${comparisonLeft + comparisonWidth / 2}%` }}
              >
                {delta > 0 ? '+' : ''}{delta.toFixed(1)} pts
              </span>
            )}

            <span className="absolute bottom-0 left-[5%] text-[9px] font-bold text-muted-foreground">No score</span>
            <span className="absolute bottom-0 right-[5%] text-[9px] font-bold text-muted-foreground">Scores TD</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PointStrip({
  proj,
  market,
  marketKey,
  line,
  vegasOdds,
}: {
  proj: Extract<MarketProjection, { kind: 'point' }>;
  market: PropMarket | undefined;
  marketKey: string;
  line?: number | null;
  vegasOdds?: number | null;
}) {
  const value = Number(proj.value);
  const vegasLine = Number.isFinite(line) ? Number(line) : null;
  const projectedLabel = (() => {
    if (marketKey === 'player_reception_yds') return 'receiving yards';
    if (marketKey === 'player_receptions') return 'receptions';
    if (marketKey === 'player_rush_yds') return 'rushing yards';
    if (marketKey === 'player_pass_yds') return 'passing yards';
    if (marketKey === 'player_rush_attempts') return 'rushing attempts';
    if (marketKey === 'player_pass_attempts') return 'passing attempts';
    if (marketKey === 'player_pass_completions') return 'pass completions';
    if (marketKey === 'player_pass_tds') return 'passing touchdowns';
    return market?.label.toLowerCase() ?? 'for this market';
  })();
  const shortUnit = (() => {
    if (marketKey.includes('yds')) return 'yds';
    if (marketKey.includes('attempts')) return 'att';
    if (marketKey.includes('completions')) return 'cmp';
    if (marketKey.includes('receptions')) return 'rec';
    if (marketKey.includes('tds')) return 'TDs';
    return '';
  })();
  const delta = vegasLine == null ? null : value - vegasLine;
  const higher = delta != null && delta > 0;
  const lower = delta != null && delta < 0;
  const values = vegasLine == null ? [value] : [value, vegasLine];
  const valueMin = Math.min(...values);
  const valueMax = Math.max(...values);
  const valueSpan = Math.max(valueMax - valueMin, 1);
  const padding = Math.max(valueSpan * 0.18, marketKey.includes('yds') ? 1 : 0.25);
  const scaleMin = Math.max(0, valueMin - padding);
  const scaleMax = valueMax + padding;
  const scaleSpan = Math.max(scaleMax - scaleMin, 0.0001);
  const position = (value: number) => 5 + ((value - scaleMin) / scaleSpan) * 90;
  const projectionPosition = position(value);
  const vegasPosition = vegasLine == null ? null : position(vegasLine);
  const connectorLeft = vegasPosition == null ? projectionPosition : Math.min(projectionPosition, vegasPosition);
  const connectorWidth = vegasPosition == null ? 0 : Math.abs(projectionPosition - vegasPosition);
  const differenceText = delta == null
    ? null
    : `${delta > 0 ? '+' : ''}${formatPerGame(delta, Math.abs(delta) < 1 ? 2 : 1)}${shortUnit ? ` ${shortUnit}` : ''}`;
  const projectionSentence = vegasLine == null
    ? `We project ${formatPerGame(value, 1)} ${projectedLabel}.`
    : delta === 0
      ? `We project ${formatPerGame(value, 1)} ${projectedLabel}—even with Vegas’ ${formatPerGame(vegasLine, 1)} line.`
      : `We project ${formatPerGame(value, 1)} ${projectedLabel}—${formatPerGame(Math.abs(delta!), Math.abs(delta!) < 1 ? 2 : 1)} ${higher ? 'above' : 'below'} Vegas’ ${formatPerGame(vegasLine, 1)} line.`;

  return (
    <div>
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        WagerProof projection
      </span>
      <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,0.9fr)_minmax(320px,1.1fr)] md:items-center">
        <ul className="text-[13px] font-semibold leading-relaxed text-foreground">
          <li className="flex gap-2.5">
            <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.65)]" />
            <span>{projectionSentence}</span>
          </li>
        </ul>

        <div className="min-w-0">
          <span className="text-[9px] font-black uppercase tracking-[0.13em] text-muted-foreground">Projection comparison</span>
          <div className="relative mt-2 h-[132px]">
            <div className="absolute inset-x-[5%] top-[68px] h-1 rounded-full bg-muted-foreground/20" />
            {vegasPosition != null && (
              <div
                className={cn('absolute top-[68px] h-1', higher ? 'bg-emerald-500/55' : lower ? 'bg-rose-500/55' : 'bg-muted-foreground/40')}
                style={{ left: `${connectorLeft}%`, width: `${connectorWidth}%` }}
              />
            )}

            <div className="absolute top-0 w-[116px] -translate-x-1/2 text-center" style={{ left: `${projectionPosition}%` }}>
              <span className="whitespace-nowrap text-[9px] font-black uppercase tracking-wide text-amber-600 dark:text-amber-300">WagerProof</span>
              <p className="mt-0.5 font-mono text-[26px] font-black leading-none">{formatPerGame(value, 1)} <span className="text-[11px] text-muted-foreground">{shortUnit}</span></p>
              <div className="mx-auto mt-1.5 h-[20px] w-px bg-amber-500/60" />
            </div>
            <div className="absolute top-[63px] h-3 w-3 -translate-x-1/2 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)] ring-2 ring-background" style={{ left: `${projectionPosition}%` }} />

            {vegasPosition != null && vegasLine != null && (
              <>
                <div className="absolute top-0 w-[104px] -translate-x-1/2 text-center" style={{ left: `${vegasPosition}%` }}>
                  <span className="whitespace-nowrap text-[9px] font-black uppercase tracking-wide text-muted-foreground">Vegas line</span>
                  <p className="mt-0.5 font-mono text-[14px] font-black leading-none">{formatPerGame(vegasLine, 1)}</p>
                  <p className="mt-1 text-[9px] font-bold text-muted-foreground">{formatAmerican(vegasOdds ?? null)}</p>
                  <div className="mx-auto mt-1.5 h-[20px] w-px bg-slate-400/60" />
                </div>
                <div className="absolute top-[63px] h-3 w-3 -translate-x-1/2 rounded-full bg-slate-400 ring-2 ring-background" style={{ left: `${vegasPosition}%` }} />
              </>
            )}

            {differenceText != null && (
              <span
                className={cn(
                  'absolute top-[84px] -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-[10px] font-black',
                  higher && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
                  lower && 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
                  !higher && !lower && 'bg-muted text-muted-foreground',
                )}
                style={{ left: `${connectorLeft + connectorWidth / 2}%` }}
              >
                {differenceText}
              </span>
            )}

            <span className="absolute bottom-0 left-[5%] text-[9px] font-bold text-muted-foreground">Lower total</span>
            <span className="absolute bottom-0 right-[5%] text-[9px] font-bold text-muted-foreground">Higher total</span>
          </div>
        </div>
      </div>
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
