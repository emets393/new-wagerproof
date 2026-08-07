import { ArrowRight, Equal, TrendingDown, TrendingUp } from 'lucide-react';
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
import { formatPerGame, formatPctile, formatRatePct, topBadge } from '../format';
import { DEFENSE_TIPS } from '../statTips';
import { GAME_SPLIT_STAT_FOR_MARKET, resolveSchemeCompare } from '../schemeCompare';
import { StatTip } from './StatTip';
import { WhoHeIsSection } from './WhoHeIsSection';

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

function DeltaGlyph({
  delta,
  threshold,
}: {
  delta: number | null;
  threshold: number;
}) {
  const up = delta != null && delta >= threshold;
  const down = delta != null && delta <= -threshold;
  const even = delta != null && !up && !down;
  return (
    <div className="flex w-16 flex-col items-center justify-center gap-1">
      {up && <TrendingUp className="h-4 w-4 text-emerald-500" />}
      {down && <TrendingDown className="h-4 w-4 text-rose-500" />}
      {even && <Equal className="h-4 w-4 text-muted-foreground" />}
      {delta == null && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
      <span
        className={cn(
          'font-mono text-[12px] font-black',
          up && 'text-emerald-600 dark:text-emerald-300',
          down && 'text-rose-600 dark:text-rose-300',
          even && 'text-muted-foreground'
        )}
      >
        {delta == null
          ? '—'
          : delta === 0
            ? 'even'
            : `${delta > 0 ? '+' : ''}${formatPerGame(delta, Math.abs(delta) < 1 ? 2 : 1)}`}
      </span>
    </div>
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
  const baseline = page.baseline;
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
    <div className="space-y-3">
      {/* 1) Who he is — season baseline only */}
      <GlassCard radius={18} className="p-4">
        <div className="mb-1 flex items-end justify-between gap-2">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              Who he is
            </div>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              Season averages — his normal production, before the matchup.
            </p>
          </div>
          {baseline && (
            <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
              {baseline.season} · {baseline.games} g
            </span>
          )}
        </div>

        {!baseline ? (
          <p className="mt-3 text-[13px] text-muted-foreground">No NFL sample yet · 2026 rookie</p>
        ) : (
          <WhoHeIsSection page={page} marketKey={marketKey} />
        )}
      </GlassCard>

      {/* 2) THE comparison — career avg vs this defense's look */}
      <GlassCard radius={18} className="overflow-hidden border-amber-500/35 p-0 shadow-[0_0_24px_rgba(245,158,11,0.12)]">
        <div className="border-b border-amber-500/25 bg-amber-500/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-800 dark:text-amber-200">
              Him vs this defense
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
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Left = his career average. Right = how he produces against the looks this defense
            actually plays
            {compare?.mode === 'qb'
              ? ' (EPA per dropback).'
              : compare?.mode === 'rush'
                ? ' (EPA per rush; YPC as support).'
                : ' (yards per target).'}
          </p>
        </div>

        <div className="space-y-3 p-4">
          {hasCompare && compare ? (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                <span>His career avg</span>
                <span className="w-16 text-center">Diff</span>
                <span className="text-right">Vs {opp}&apos;s look</span>
              </div>

              {compare.lookRows.map((row) => {
                const up = row.delta != null && row.delta >= row.deltaThreshold;
                const down = row.delta != null && row.delta <= -row.deltaThreshold;
                return (
                  <div
                    key={row.key}
                    className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 rounded-2xl border border-black/5 bg-muted/20 p-2 dark:border-white/10"
                  >
                    <div className="rounded-xl bg-background/80 px-3 py-2.5 dark:bg-black/30">
                      <div className="flex items-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        {compare.overallLabel}
                        <SampleBadge sample={compare.sample} />
                      </div>
                      <div className="mt-1 font-mono text-[22px] font-black leading-none">
                        {formatPerGame(
                          compare.overallValue,
                          compare.mode === 'receiving' ? 1 : 2
                        )}
                        <span className="ml-1 text-[11px] font-bold text-muted-foreground">
                          {compare.overallUnit}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {compare.overallDetail}
                      </div>
                      {compare.overallSupport && (
                        <div className="mt-0.5 text-[10px] text-muted-foreground">
                          {compare.overallSupport}
                        </div>
                      )}
                    </div>

                    <DeltaGlyph delta={row.delta} threshold={row.deltaThreshold} />

                    <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2.5">
                      <div className="flex items-center text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                        {row.label}
                        <SampleBadge sample={row.sample} />
                      </div>
                      <div
                        className={cn(
                          'mt-1 font-mono text-[22px] font-black leading-none',
                          up && 'text-emerald-700 dark:text-emerald-300',
                          down && 'text-rose-700 dark:text-rose-300'
                        )}
                      >
                        {formatPerGame(row.value, compare.mode === 'receiving' ? 1 : 2)}
                        <span className="ml-1 text-[12px] font-bold text-muted-foreground">
                          {row.unit}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] font-semibold text-muted-foreground">
                        {row.detail}
                        {row.pctile != null ? ` · ${topBadge(row.pctile)}` : ''}
                      </div>
                      {row.support && (
                        <div className="mt-0.5 text-[10px] text-muted-foreground">{row.support}</div>
                      )}
                    </div>
                  </div>
                );
              })}

              <p className="px-1 text-[11px] leading-snug text-muted-foreground">
                {compare.mode === 'rush'
                  ? 'Diff is EPA per rush vs his career average (more stable than ypc alone). YPC is shown as support.'
                  : compare.mode === 'qb'
                    ? 'Diff is EPA per dropback vs his career average. Positive = he beats his own baseline against that look.'
                    : 'Positive diff = he beats his own career average against that look. Negative = he produces less than usual when the defense plays it.'}
              </p>
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
