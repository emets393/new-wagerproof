import { cn } from '@/lib/utils';
import { GlassCard } from '@/components/ios';
import type {
  DefenseDim,
  NflPropPlayerPage,
  SchemeGameSplitEntry,
} from '../types';
import {
  DEFENSE_LABELS,
  GAME_SPLIT_BUCKET_LABELS,
  LOOK_BUCKET_LABELS,
  type DefenseKey,
} from '../marketMap';
import { formatPerGame, formatPctile, formatRatePct } from '../format';
import { DEFENSE_TIPS } from '../statTips';
import {
  GAME_SPLIT_STAT_FOR_MARKET,
  resolveSchemeCompare,
  type CompareLookRow,
  type SchemeCompareResolved,
} from '../schemeCompare';
import { StatTip } from './StatTip';

function isDim(v: unknown): v is DefenseDim {
  return Boolean(v) && typeof v === 'object' && 'rate' in (v as object) && 'pctile' in (v as object);
}

function SampleBadge({ sample }: { sample?: 'ok' | 'thin' }) {
  if (sample !== 'thin') return null;
  return (
    <span className="ml-1 rounded bg-amber-500/20 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">
      Thin
    </span>
  );
}

function GameSplitsBlock({
  entry,
  overall,
  marketKey,
  opp,
  applicable,
}: {
  entry: SchemeGameSplitEntry;
  overall: SchemeGameSplitEntry | undefined;
  marketKey: string;
  opp: string;
  applicable: string[];
}) {
  const statKey = GAME_SPLIT_STAT_FOR_MARKET[marketKey];
  if (!statKey) return null;
  const overallV = overall?.[statKey];
  const lookV = entry[statKey];
  if (typeof lookV !== 'number') return null;
  const delta = entry.delta?.[statKey];
  const up = delta != null && delta > 0;
  const down = delta != null && delta < 0;

  return (
    <div className="rounded-2xl border border-black/5 bg-muted/25 p-3 dark:border-white/10">
      <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
        Per-game avg vs defenses like {opp}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px]">
        {typeof overallV === 'number' && (
          <span className="text-muted-foreground">
            {formatPerGame(overallV, 1)} overall
            <span className="mx-1.5 text-muted-foreground/60">→</span>
          </span>
        )}
        <span
          className={cn(
            'font-mono font-black',
            up && 'text-emerald-600 dark:text-emerald-300',
            down && 'text-rose-600 dark:text-rose-300'
          )}
        >
          {formatPerGame(lookV, 1)}
        </span>
        <span className="text-muted-foreground">
          vs {applicable.map((b) => GAME_SPLIT_BUCKET_LABELS[b] ?? b).join(' / ')}
          {entry.n != null ? ` · n=${entry.n}` : ''}
        </span>
        {delta != null && (
          <span
            className={cn(
              'font-mono text-[12px] font-bold',
              up && 'text-emerald-600 dark:text-emerald-300',
              down && 'text-rose-600 dark:text-rose-300'
            )}
          >
            {delta > 0 ? '+' : ''}
            {formatPerGame(delta, 1)}
          </span>
        )}
      </div>
    </div>
  );
}

function SchemeLinearComparison({
  compare,
  row,
  opp,
}: {
  compare: SchemeCompareResolved;
  row: CompareLookRow;
  opp: string;
}) {
  const overall = Number(compare.overallValue);
  const matchup = Number(row.value);
  const digits = compare.mode === 'receiving' ? 1 : 2;
  const delta = row.delta ?? matchup - overall;
  const up = delta >= row.deltaThreshold;
  const down = delta <= -row.deltaThreshold;
  const metricName = compare.mode === 'qb'
    ? 'EPA per dropback'
    : compare.mode === 'rush'
      ? 'EPA per rush'
      : 'yards per target';
  const direction = delta > 0 ? 'higher' : delta < 0 ? 'lower' : 'the same';
  const lookLabel = row.label.replace(/^vs\s+/i, '').toLowerCase();
  const gap = Math.abs(matchup - overall);
  const padding = Math.max(compare.mode === 'receiving' ? 0.1 : 0.01, gap * 0.5);
  const scaleMin = Math.min(overall, matchup) - padding;
  const scaleMax = Math.max(overall, matchup) + padding;
  const scaleSpan = Math.max(scaleMax - scaleMin, 0.0001);
  const position = (value: number) => 6 + ((value - scaleMin) / scaleSpan) * 88;
  const overallPosition = position(overall);
  const matchupPosition = position(matchup);
  const connectorLeft = Math.min(overallPosition, matchupPosition);
  const connectorWidth = Math.abs(overallPosition - matchupPosition);
  const deltaLabel = `${delta > 0 ? '+' : ''}${formatPerGame(delta, Math.abs(delta) < 1 ? 2 : 1)} ${row.unit}`;

  return (
    <div className="grid gap-4 py-1 md:grid-cols-[minmax(0,0.9fr)_minmax(320px,1.1fr)] md:items-center">
      <ul className="text-[13px] font-semibold leading-relaxed text-foreground">
        <li className="flex gap-2.5">
          <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.65)]" />
          <span>
            He produces {formatPerGame(matchup, digits)} {metricName} against {lookLabel}, compared with {formatPerGame(overall, digits)} across his career—{formatPerGame(Math.abs(delta), Math.abs(delta) < 1 ? 2 : 1)} {row.unit} {direction} against the look {opp} prefers.
          </span>
        </li>
      </ul>

      <div className="min-w-0">
        <span className="text-[9px] font-black uppercase tracking-[0.13em] text-muted-foreground">Production comparison</span>
        <div className="relative mt-2 h-[126px]">
          <div className="absolute inset-x-[5%] top-[68px] h-1 rounded-full bg-muted-foreground/20" />
          <div
            className={cn(
              'absolute top-[68px] h-1',
              up && 'bg-emerald-500/55',
              down && 'bg-rose-500/55',
              !up && !down && 'bg-muted-foreground/40',
            )}
            style={{ left: `${connectorLeft}%`, width: `${connectorWidth}%` }}
          />

          <div className="absolute top-0 w-[104px] -translate-x-1/2 text-center" style={{ left: `${overallPosition}%` }}>
            <span className="whitespace-nowrap text-[9px] font-black uppercase tracking-wide text-muted-foreground">Career avg</span>
            <p className="mt-0.5 font-mono text-[14px] font-black leading-none">{formatPerGame(overall, digits)}</p>
            <p className="mt-1 text-[9px] font-bold text-muted-foreground">{compare.overallUnit}</p>
            <div className="mx-auto mt-1.5 h-[20px] w-px bg-slate-400/60" />
          </div>
          <div className="absolute top-[63px] h-3 w-3 -translate-x-1/2 rounded-full bg-slate-400 ring-2 ring-background" style={{ left: `${overallPosition}%` }} />

          <div className="absolute top-0 w-[104px] -translate-x-1/2 text-center" style={{ left: `${matchupPosition}%` }}>
            <span className="whitespace-nowrap text-[9px] font-black uppercase tracking-wide text-amber-600 dark:text-amber-300">Vs {opp}&apos;s look</span>
            <p className="mt-0.5 font-mono text-[14px] font-black leading-none">{formatPerGame(matchup, digits)}</p>
            <p className="mt-1 text-[9px] font-bold text-muted-foreground">{row.unit}</p>
            <div className="mx-auto mt-1.5 h-[20px] w-px bg-amber-500/60" />
          </div>
          <div className="absolute top-[63px] h-3 w-3 -translate-x-1/2 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)] ring-2 ring-background" style={{ left: `${matchupPosition}%` }} />

          <span
            className={cn(
              'absolute top-[82px] -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-[10px] font-black',
              up && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
              down && 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
              !up && !down && 'bg-muted text-muted-foreground',
            )}
            style={{ left: `${connectorLeft + connectorWidth / 2}%` }}
          >
            {deltaLabel}
          </span>

          <span className="absolute bottom-0 left-[5%] text-[9px] font-bold text-muted-foreground">Lower production</span>
          <span className="absolute bottom-0 right-[5%] text-[9px] font-bold text-muted-foreground">Higher production</span>
        </div>
      </div>
    </div>
  );
}

/**
 * The page's core job: make "who he is" vs "who he is against THIS defense"
 * impossible to miss. Career average on the left, vs-look on the right, delta
 * in the middle. Layer is receiving YPT, QB EPA/db, or RB box depending on market.
 */
export function ComparisonBlock({
  page,
  marketKey,
}: {
  page: NflPropPlayerPage;
  marketKey: string;
}) {
  const scheme = page.scheme;
  const defense = scheme?.defense;
  const opp = scheme?.opponent ?? page.opponent;
  const identity = defense?.identity ?? null;
  const compare = resolveSchemeCompare(page, marketKey);

  const hitEntries = scheme?.look_hit_rates
    ? Object.entries(scheme.look_hit_rates).flatMap(([bucket, byMkt]) => {
        const rec = byMkt?.[marketKey];
        if (!rec || rec.n < 3) return [];
        return [{ bucket, ...rec }];
      })
    : [];

  /**
   * "What they play" must mirror the opponent's identity / look_focus — NOT the
   * market's static defense list. (Receptions used to KEY man+pressure even for
   * zone-heavy defenses, which is the confusion in the screenshot.)
   */
  const defenseDims = (() => {
    if (!defense) return [];

    const focusKeys: string[] =
      compare?.mode === 'rush'
        ? (scheme?.rush_look_focus?.length ? scheme.rush_look_focus : ['neutral'])
        : (scheme?.look_focus?.length ? scheme.look_focus : []);

    // Map look_focus → defense-rate dims we can actually show.
    const ordered: Array<{
      key: DefenseKey;
      label: string;
      tip?: string;
      rate: number;
      pctile: number;
      emphasized: boolean;
    }> = [];

    const push = (
      key: DefenseKey,
      opts?: { label?: string; rate?: number; pctile?: number; tip?: string }
    ) => {
      if (ordered.some((d) => d.key === key && d.label === (opts?.label ?? DEFENSE_LABELS[key]))) {
        return;
      }
      const raw = defense[key];
      const rate = opts?.rate ?? (isDim(raw) ? raw.rate : null);
      const pctile = opts?.pctile ?? (isDim(raw) ? raw.pctile : null);
      if (rate == null || pctile == null) return;
      ordered.push({
        key,
        label: opts?.label ?? DEFENSE_LABELS[key],
        tip: opts?.tip ?? DEFENSE_TIPS[key],
        rate,
        pctile,
        emphasized: true,
      });
    };

    for (const look of focusKeys) {
      if (look === 'zone') {
        // Warehouse serves man rate only; zone-heavy = low man. Show zone as the
        // complement so the card matches the ZONE-HEAVY identity above.
        const man = defense.man;
        if (isDim(man)) {
          push('zone', {
            label: DEFENSE_LABELS.zone,
            tip: DEFENSE_TIPS.zone,
            rate: Math.max(0, Math.min(1, 1 - man.rate)),
            pctile: Math.max(0, Math.min(100, 100 - man.pctile)),
          });
        }
      } else if (look === 'man') {
        push('man');
      } else if (look === 'two_high') {
        push('two_high');
      } else if (look === 'one_high') {
        // No one-high rate served — show two-high as the shell axis (low = single-high).
        const th = defense.two_high;
        if (isDim(th)) {
          push('two_high', {
            label: 'Single-high shell',
            tip: 'Share of snaps in two-high; this defense lives in single-high (low two-high rate).',
          });
        }
      } else if (look === 'pressure') {
        push('pressure');
      } else if (look === 'blitz') {
        push('blitz');
      } else if (look === 'heavy_box') {
        push('heavy_box');
      } else if (look === 'light_box') {
        push('light_box');
      } else if (look === 'neutral') {
        // No neutral rate — skip; focus cards cover heavy/light when relevant.
      }
    }

    // If focus produced nothing, fall back to extreme dims (pctile ≥60 or ≤40).
    if (ordered.length === 0) {
      const candidates: DefenseKey[] = [
        'man',
        'two_high',
        'pressure',
        'blitz',
        'heavy_box',
        'light_box',
      ];
      for (const key of candidates) {
        const raw = defense[key];
        if (!isDim(raw)) continue;
        if (raw.pctile >= 60 || raw.pctile <= 40) {
          ordered.push({
            key,
            label: DEFENSE_LABELS[key],
            tip: DEFENSE_TIPS[key],
            rate: raw.rate,
            pctile: raw.pctile,
            emphasized: true,
          });
        }
      }
    }

    return ordered;
  })();

  const hasCompare = Boolean(compare && compare.lookRows.length > 0 && compare.overallValue != null);
  const gs = page.scheme_game_splits;
  const applicable = gs?.applicable ?? [];
  const gameSplitEntry =
    gs?.splits && applicable.length
      ? applicable
          .map((b) => gs.splits?.[b])
          .find((e) => e && !e.insufficient && (e.n ?? 0) >= 3)
      : undefined;

  const emptyCopy =
    compare?.emptyReason === 'rookie'
      ? `No NFL sample yet — ${page.player_name.split(' ').slice(-1)[0]} is listed as a rookie.`
      : compare?.emptyReason === 'thin'
        ? `Sample is too thin to compare him to ${opp}'s scheme yet. Defense mix below is still useful context.`
        : `We need career production vs the looks ${opp} plays to compare him to that scheme. Below is how often that defense uses each look.`;

  return (
    <div className="space-y-3" data-card="dynamic" aria-label="Dynamic player matchup comparison">
      {/* Career baseline vs this defense's look. */}
      <GlassCard radius={18} className="overflow-hidden border-amber-500/35 p-0 shadow-[0_0_24px_rgba(245,158,11,0.12)]">
        <div className="border-b border-amber-500/25 bg-amber-500/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-800 dark:text-amber-200">
              Dynamic
            </div>
            <SampleBadge sample={compare?.sample} />
          </div>
          <p className="mt-1 text-[14px] font-semibold leading-snug text-foreground">
            {identity ? (
              <>
                Facing <span className="text-amber-700 dark:text-amber-300">{opp}</span>
                {': '}
                <span className="text-amber-800 dark:text-amber-200">{identity}</span>
              </>
            ) : (
              <>Facing {opp}</>
            )}
          </p>
        </div>

        <div className="space-y-3 p-4">
          {hasCompare && compare ? (
            <div className="divide-y divide-black/[0.06] dark:divide-white/10">
              {compare.lookRows.map((row) => (
                <SchemeLinearComparison key={row.key} compare={compare} row={row} opp={opp} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-amber-500/30 bg-amber-500/[0.04] px-4 py-5 text-center">
              <p className="text-[14px] font-semibold">
                {compare?.emptyReason === 'thin'
                  ? 'Thin sample vs this look'
                  : compare?.emptyReason === 'rookie'
                    ? 'No career scheme split yet'
                    : 'No scheme production split for this player yet'}
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground">{emptyCopy}</p>
            </div>
          )}

          {gameSplitEntry && gs?.overall && (
            <GameSplitsBlock
              entry={gameSplitEntry}
              overall={gs.overall}
              marketKey={marketKey}
              opp={opp}
              applicable={applicable.filter((b) => {
                const e = gs.splits?.[b];
                return Boolean(e && !e.insufficient && (e.n ?? 0) >= 3);
              })}
            />
          )}

          {hitEntries.length > 0 && (
            <div className="rounded-2xl border border-black/5 bg-muted/25 p-3 dark:border-white/10">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                Did he clear the line vs defenses like {opp}?
              </div>
              <div className="space-y-2">
                {hitEntries.map((h) => {
                  const good = h.pct != null && h.pct >= 0.6;
                  const bad = h.pct != null && h.pct <= 0.4;
                  return (
                    <div
                      key={h.bucket}
                      className="flex items-center justify-between gap-3 rounded-xl bg-background/70 px-3 py-2 dark:bg-black/20"
                    >
                      <span className="text-[13px] font-semibold">
                        {LOOK_BUCKET_LABELS[h.bucket] ?? h.bucket}
                      </span>
                      <span
                        className={cn(
                          'font-mono text-[15px] font-black',
                          good && 'text-emerald-600 dark:text-emerald-300',
                          bad && 'text-rose-600 dark:text-rose-300'
                        )}
                      >
                        {h.h}/{h.n}
                        {h.pct != null ? ` · ${Math.round(h.pct * 100)}%` : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {defenseDims.length > 0 && (
            <div>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                What {opp} actually plays
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {defenseDims.map((d) => (
                  <div
                    key={`${d.key}-${d.label}`}
                    className={cn(
                      'rounded-xl border px-3 py-2',
                      d.emphasized
                        ? 'border-amber-500/40 bg-amber-500/10'
                        : 'border-black/5 bg-muted/30 dark:border-white/10'
                    )}
                  >
                    <div className="flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      {d.tip ? <StatTip tip={d.tip} label={d.label} /> : d.label}
                      {d.emphasized && (
                        <span className="ml-1 rounded bg-amber-500/20 px-1 text-[8px] font-bold text-amber-800 dark:text-amber-200">
                          KEY
                        </span>
                      )}
                    </div>
                    <div className="mt-1 font-mono text-[18px] font-bold leading-none">
                      {formatRatePct(d.rate)}
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {formatPctile(d.pctile)} %ile
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
