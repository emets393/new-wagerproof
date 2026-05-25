import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { BarChart3 } from 'lucide-react';
import type {
  PitcherArchetypeProfile,
  PitcherArsenalByHand,
  PitcherArsenalRow,
  PitcherBattedBallProfile,
  PitcherBattedBallRow,
} from '@/types/mlb-matchups';
import { usePitcherRecentStarts, type PitcherStartLog } from '@/hooks/usePitcherRecentStarts';
import { formatPct, formatRate, mlbHeadshotUrl } from '@/utils/mlbPitcherMatchups';
import { cn } from '@/lib/utils';

interface PitcherStatsAccordionProps {
  pitcherId: number;
  season: number;
  /** Tonight's game date — used to exclude in-progress / same-day starts from the L3 panel. */
  gameDate: string;
  arsenal: PitcherArsenalByHand | null | undefined;
  battedBall: PitcherBattedBallProfile | null | undefined;
  archetype: PitcherArchetypeProfile | null | undefined;
}

function n(v: number | null | undefined): number | null {
  return v == null || !Number.isFinite(Number(v)) ? null : Number(v);
}

// L3-vs-season delta classifier. Direction = "lower is better for this stat?"
function deltaTone(
  delta: number | null,
  lowerIsBetter: boolean,
  threshold = 0.005,
): 'good' | 'bad' | 'neutral' {
  if (delta == null) return 'neutral';
  const positiveTone = lowerIsBetter ? 'bad' : 'good';
  const negativeTone = lowerIsBetter ? 'good' : 'bad';
  if (delta > threshold) return positiveTone;
  if (delta < -threshold) return negativeTone;
  return 'neutral';
}

function avg(values: (number | null | undefined)[]): number | null {
  const real = values.map(n).filter((v): v is number => v != null);
  if (real.length === 0) return null;
  return real.reduce((a, b) => a + b, 0) / real.length;
}

function StatCell({
  label,
  value,
  delta,
  lowerIsBetter,
  format,
  tooltip,
}: {
  label: string;
  value: number | null;
  delta?: number | null;
  lowerIsBetter?: boolean;
  format: (v: number | null) => string;
  tooltip: string;
}) {
  const tone = deltaTone(delta ?? null, lowerIsBetter ?? false);
  return (
    <div
      title={tooltip}
      className="rounded-md border border-border/50 bg-card/40 px-2.5 py-2 cursor-help"
    >
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-base font-bold tabular-nums leading-tight mt-0.5">{format(value)}</p>
      {delta != null && Number.isFinite(delta) ? (
        <p
          className={cn(
            'text-[10px] tabular-nums leading-tight',
            tone === 'good' && 'text-primary font-semibold',
            tone === 'bad' && 'text-red-500 font-semibold',
            tone === 'neutral' && 'text-muted-foreground',
          )}
        >
          L3 {delta >= 0 ? '+' : ''}{format(delta).replace(/^[-+]/, '')}
          {tone === 'good' ? ' ▲' : tone === 'bad' ? ' ▼' : ''}
        </p>
      ) : null}
    </div>
  );
}

function HandColumn({ label, row }: { label: string; row: PitcherBattedBallRow | null | undefined }) {
  if (!row) return null;
  const bf = n(row.batters_faced) ?? 0;
  if (bf < 10) {
    return (
      <div className="rounded-md border border-dashed border-border/40 px-2.5 py-2 text-xs text-muted-foreground">
        {label}: small sample ({bf} BF)
      </div>
    );
  }
  return (
    <div className="rounded-md border border-border/50 bg-card/40 px-2.5 py-2 text-xs space-y-0.5">
      <p className="font-semibold text-foreground">{label} <span className="text-muted-foreground font-normal">· {bf} BF</span></p>
      <p className="tabular-nums text-muted-foreground">
        xwOBA <span className="text-foreground font-semibold">{formatRate(row.xwoba_allowed)}</span>
        {' · '}K% <span className="text-foreground font-semibold">{formatPct(row.k_pct)}</span>
        {' · '}BB% <span className="text-foreground font-semibold">{formatPct(row.bb_pct)}</span>
      </p>
      <p className="tabular-nums text-muted-foreground">
        Barrel% <span className="text-foreground font-semibold">{formatPct(row.barrel_pct)}</span>
        {' · '}HR/FB <span className="text-foreground font-semibold">{formatPct(row.hr_per_fb_pct)}</span>
        {' · '}GB/FB <span className="text-foreground font-semibold">{formatPct(row.gb_pct)}/{formatPct(row.fb_pct)}</span>
      </p>
    </div>
  );
}

function topPitches(rows: PitcherArsenalRow[] | undefined | null, max = 5): PitcherArsenalRow[] {
  if (!rows || rows.length === 0) return [];
  return [...rows]
    .filter(r => (n(r.usage_pct) ?? 0) > 0 && r.pitch_type_label)
    .sort((a, b) => (n(b.usage_pct) ?? 0) - (n(a.usage_pct) ?? 0))
    .slice(0, max);
}

function formatStartRow(start: PitcherStartLog): { dateLabel: string; opp: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(start.official_date);
  const dateLabel = m ? `${Number(m[2])}/${Number(m[3])}` : start.official_date.slice(5);
  const opp = start.opponent_team_name ?? '—';
  return { dateLabel, opp };
}

// Baseball notation: 0.33333 → "0.1" (one out), 5.66667 → "5.2" (two outs).
// The DB stores ip_official as decimal innings (1/3 outs), so we convert to the
// universally-recognized .0 / .1 / .2 suffix every box score uses.
function formatInningsPitched(ip: number | null | undefined): string {
  if (ip == null || !Number.isFinite(Number(ip))) return '—';
  const totalOuts = Math.max(0, Math.round(Number(ip) * 3));
  const whole = Math.floor(totalOuts / 3);
  const partial = totalOuts % 3;
  return `${whole}.${partial}`;
}

export function PitcherStatsAccordion({
  pitcherId,
  season,
  gameDate,
  arsenal,
  battedBall,
  archetype,
}: PitcherStatsAccordionProps) {
  const { data: starts = [] } = usePitcherRecentStarts(pitcherId, season, {
    limit: 3,
    beforeDate: gameDate,
  });

  // Season anchors come from the OVERALL batted-ball row (vs both hands).
  const overall = battedBall?.overall ?? null;
  const seasonXwoba = n(overall?.xwoba_allowed);
  const seasonK = n(overall?.k_pct);
  const seasonBB = n(overall?.bb_pct);
  const seasonBarrel = n(overall?.barrel_pct);

  // L3 averages
  const l3K = avg(starts.map(s => s.k_pct));
  const l3BB = avg(starts.map(s => s.bb_pct));
  const l3Xwoba = avg(starts.map(s => s.xwoba_allowed));
  const l3Xera = avg(starts.map(s => s.xera_est));

  const hasAnySeason = overall || arsenal || archetype;
  if (!hasAnySeason && starts.length === 0) return null;

  const topR = topPitches(arsenal?.R);
  const topL = topPitches(arsenal?.L);
  const arsenalRows = topR.length > 0 ? topR : topL.length > 0 ? topL : topPitches(arsenal?.A);

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="pstats" className="border-0">
        <AccordionTrigger
          className={cn(
            'w-full rounded-md border border-primary/40 bg-primary/10 hover:bg-primary/20',
            'px-3 py-2.5 text-sm font-semibold text-foreground hover:no-underline',
            'data-[state=open]:bg-primary/15 transition-colors',
          )}
        >
          <span className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <span>Pitcher stats &amp; recent form</span>
          </span>
        </AccordionTrigger>
        <AccordionContent className="pt-3 pb-1 space-y-4">
          {archetype ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-primary/15 text-primary px-2 py-0.5 font-bold uppercase tracking-wide">
                {archetype.archetype} archetype
              </span>
              {archetype.max_fb_velo != null ? (
                <span className="text-muted-foreground tabular-nums">
                  Max FB velo {archetype.max_fb_velo.toFixed(1)} mph
                </span>
              ) : null}
            </div>
          ) : null}

          {hasAnySeason ? (
            <div>
              <p
                className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5"
                title="Season averages with the change vs the last 3 starts. ▲ = better than season norm, ▼ = worse."
              >
                Season · last 3 starts
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <StatCell
                  label="K%"
                  value={seasonK}
                  delta={l3K != null && seasonK != null ? l3K - seasonK : null}
                  lowerIsBetter={false}
                  format={v => formatPct(v)}
                  tooltip="Strikeout rate this season vs last 3 starts. Higher is better."
                />
                <StatCell
                  label="BB%"
                  value={seasonBB}
                  delta={l3BB != null && seasonBB != null ? l3BB - seasonBB : null}
                  lowerIsBetter
                  format={v => formatPct(v)}
                  tooltip="Walk rate this season vs last 3 starts. Lower is better."
                />
                <StatCell
                  label="xwOBA-A"
                  value={seasonXwoba}
                  delta={l3Xwoba != null && seasonXwoba != null ? l3Xwoba - seasonXwoba : null}
                  lowerIsBetter
                  format={v => formatRate(v)}
                  tooltip="Expected weighted on-base average ALLOWED. Lower is better — it's contact quality you're giving up."
                />
                <StatCell
                  label="Barrel%"
                  value={seasonBarrel}
                  delta={null}
                  format={v => formatPct(v)}
                  tooltip="Share of batted balls hit with 'barrel' contact (high exit velo + ideal launch angle). Lower is better."
                />
              </div>
            </div>
          ) : null}

          {(battedBall?.vs_R || battedBall?.vs_L) ? (
            <div>
              <p
                className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5"
                title="Season contact quality allowed by the hand of the batter facing this pitcher."
              >
                Contact allowed by batter side
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <HandColumn label="vs RHB" row={battedBall?.vs_R} />
                <HandColumn label="vs LHB" row={battedBall?.vs_L} />
              </div>
            </div>
          ) : null}

          {arsenalRows.length > 0 ? (
            <div>
              <p
                className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5"
                title="Top pitches this pitcher throws, ranked by usage. Whiff% = swing-and-miss rate. xwOBA = contact quality allowed on that pitch."
              >
                Arsenal · top pitches
              </p>
              <div className="rounded-md border border-border/50 overflow-hidden">
                <table className="w-full text-xs tabular-nums">
                  <thead className="bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="text-left px-2 py-1.5 font-medium">Pitch</th>
                      <th className="text-right px-2 py-1.5 font-medium">Usage</th>
                      <th className="text-right px-2 py-1.5 font-medium">Velo</th>
                      <th className="text-right px-2 py-1.5 font-medium" title="Swing-and-miss rate on this pitch.">Whiff</th>
                      <th className="text-right px-2 py-1.5 font-medium" title="Expected wOBA allowed on this pitch — the lower, the harder it is to hit.">xwOBA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {arsenalRows.map(r => (
                      <tr key={`${r.pitch_type}-${r.vs_batter_hand}`} className="border-t border-border/40">
                        <td className="px-2 py-1.5">{r.pitch_type_label}</td>
                        <td className="px-2 py-1.5 text-right">{formatPct(r.usage_pct)}</td>
                        <td className="px-2 py-1.5 text-right">{r.avg_velo != null ? `${r.avg_velo.toFixed(1)}` : '—'}</td>
                        <td className="px-2 py-1.5 text-right">{formatPct(r.whiff_pct)}</td>
                        <td className="px-2 py-1.5 text-right">{formatRate(r.xwoba_allowed)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {starts.length > 0 ? (
            <div>
              <p
                className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5"
                title="Each of this pitcher's last few starts with the headline rate stats. K and BB are counts; xFIP and xwOBA-A are predictors of future ERA / quality of contact."
              >
                Last {starts.length} start{starts.length === 1 ? '' : 's'}
              </p>
              <div className="rounded-md border border-border/50 overflow-hidden">
                <table className="w-full text-xs tabular-nums">
                  <thead className="bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="text-left px-2 py-1.5 font-medium">Date</th>
                      <th className="text-left px-2 py-1.5 font-medium">Opp</th>
                      <th className="text-right px-2 py-1.5 font-medium" title="Innings pitched (baseball notation: .1 = ⅓, .2 = ⅔)">IP</th>
                      <th className="text-right px-2 py-1.5 font-medium">H</th>
                      <th className="text-right px-2 py-1.5 font-medium">K</th>
                      <th className="text-right px-2 py-1.5 font-medium">BB</th>
                      <th className="text-right px-2 py-1.5 font-medium">xwOBA-A</th>
                    </tr>
                  </thead>
                  <tbody>
                    {starts.map(s => {
                      const { dateLabel, opp } = formatStartRow(s);
                      return (
                        <tr key={s.game_pk} className="border-t border-border/40">
                          <td className="px-2 py-1.5">{dateLabel}</td>
                          <td className="px-2 py-1.5">{opp}</td>
                          <td className="px-2 py-1.5 text-right">{formatInningsPitched(s.ip_official)}</td>
                          <td className="px-2 py-1.5 text-right">{s.hits_allowed ?? '—'}</td>
                          <td className="px-2 py-1.5 text-right">{s.strikeouts ?? '—'}</td>
                          <td className="px-2 py-1.5 text-right">{s.walks ?? '—'}</td>
                          <td className="px-2 py-1.5 text-right">{formatRate(s.xwoba_allowed)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <p className="text-[10px] text-muted-foreground italic px-1" title="Use these as context — small samples can be noisy. Sample sizes are shown inline (BF / IP / start count).">
            Hover any tile or column for a plain-English explanation. Small samples are noted inline.
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
