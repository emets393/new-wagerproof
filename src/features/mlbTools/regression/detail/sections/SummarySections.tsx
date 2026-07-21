import * as React from 'react';
import { BarChart3, BookOpen, CalendarDays, Sparkles, Trophy, Users, Zap } from 'lucide-react';
import { SegmentedControl, WidgetCard } from '@/components/ios';
import { cn } from '@/lib/utils';
import type { MLBBucketAccuracy } from '@/hooks/useMLBBucketAccuracy';
import type { ModelBreakdownRow } from '@/hooks/useMLBModelBreakdownAccuracy';
import type { MLBPerfectStormRecords, PerfectStormTier } from '@/hooks/useMLBPerfectStormRecords';
import type { YesterdayRecap } from '@/hooks/useMLBRegressionReport';
import { espnMlb500LogoUrlFromAbbrev } from '@/utils/mlbTeamLogos';
import {
  BAD_TEXT,
  Callout,
  Disclosure,
  DivergingBar,
  GOOD_TEXT,
  PickText,
  RoiHeader,
  RoiRow,
  TierChip,
  WinRateMeter,
  signed,
} from '../shared';
import { PageFiller, Pager, usePaged } from '../paging';
import {
  ACCURACY_BET_TYPES,
  ACCURACY_BET_TYPE_LABEL,
  TIER_META,
  type AccuracyBetType,
} from '../../types';

const TIERS: PerfectStormTier[] = ['hammer', 'ps', 'lean', 'watch'];

function recordString(wins: number, losses: number, pushes: number): string {
  return pushes > 0 ? `${wins}-${losses}-${pushes}` : `${wins}-${losses}`;
}

/**
 * "Is this report making money?" — the one number the whole page has to answer,
 * so it leads the summary.
 *
 * Only the four published tiers count. The report payload's legacy
 * `cumulative_record` also included untiered picks, and that history stopped
 * being relevant once only tiered picks shipped.
 */
export function OverallRecordSection({ records }: { records: MLBPerfectStormRecords | null }) {
  if (!records) return null;
  let wins = 0;
  let losses = 0;
  let pushes = 0;
  let units = 0;
  for (const tier of TIERS) {
    wins += records[tier].wins;
    losses += records[tier].losses;
    pushes += records[tier].pushes;
    units += records[tier].units;
  }
  const graded = wins + losses;
  const winPct = graded > 0 ? Math.round((1000 * wins) / graded) / 10 : null;
  const roi = graded > 0 ? Math.round((1000 * units) / graded) / 10 : null;

  return (
    <WidgetCard
      icon={<Trophy />}
      title="All-time record"
      subtitle="Every pick this report has published, across all four conviction tiers, graded to date."
    >
      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
              Record
            </span>
            <span className="text-2xl font-bold leading-none tabular-nums text-foreground">
              {recordString(wins, losses, pushes)}
            </span>
          </div>
          <div className="flex shrink-0 flex-col items-end">
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
              Units
            </span>
            <span
              className={cn(
                'font-mono text-2xl font-bold leading-none tabular-nums',
                units >= 0 ? GOOD_TEXT : BAD_TEXT,
              )}
            >
              {signed(units, 2)}
            </span>
          </div>
        </div>

        <WinRateMeter
          winPct={winPct}
          record={recordString(wins, losses, pushes)}
          sample={`${graded} graded`}
          label="of published picks have won"
        />

        <div className="flex items-center gap-2">
          <span className="w-[68px] shrink-0 text-[11px] font-semibold text-foreground">ROI</span>
          <span
            className={cn(
              'w-14 shrink-0 text-right text-[11px] font-bold tabular-nums',
              (roi ?? 0) >= 0 ? GOOD_TEXT : BAD_TEXT,
            )}
          >
            {roi != null ? `${signed(roi)}%` : '—'}
          </span>
          <DivergingBar value={roi} cap={25} />
        </div>

        <Callout>
          Return per unit staked. A record above 52.4% is the bar a -110 bet has to clear before it
          makes money.
        </Callout>
      </div>
    </WidgetCard>
  );
}

/**
 * "Which conviction tiers are actually worth following?" — the same four tiers
 * that badge every pick, ranked so a Hammer can be compared to a Watch.
 */
export function TierRecordSection({ records }: { records: MLBPerfectStormRecords | null }) {
  if (!records) return null;

  return (
    <WidgetCard
      icon={<Zap />}
      title="By conviction tier"
      subtitle="Every pick carries one of these four labels. This is how each has performed season to date."
    >
      <div className="space-y-1">
        <RoiHeader first="Tier" />
        {TIERS.map((tier) => {
          const r = records[tier];
          return (
            <RoiRow
              key={tier}
              leading={<TierChip tier={tier} />}
              record={recordString(r.wins, r.losses, r.pushes)}
              winPct={r.win_pct}
              roiPct={r.roi_pct}
            />
          );
        })}
        <Callout>
          {TIER_META.hammer.short} is the highest bar — every regression angle and the model agree.{' '}
          {TIER_META.watch.short} is the lowest tier published; anything weaker is dropped from the
          report entirely.
        </Callout>
      </div>
    </WidgetCard>
  );
}

/**
 * "How is the underlying model doing per market?" One row per market so the
 * four are directly comparable, with the per-edge-tier detail behind a
 * disclosure rather than a second table on screen.
 */
export function MarketAccuracySection({ accuracy }: { accuracy: MLBBucketAccuracy | null }) {
  const [betType, setBetType] = React.useState<AccuracyBetType>('full_ml');
  const buckets = React.useMemo(() => {
    const data = accuracy?.[betType];
    if (!data) return [];
    // 3+ graded games is the same floor the per-game bucket lookup applies.
    return data.by_bucket.filter((b) => b.games >= 3).sort((a, b) => b.win_pct - a.win_pct);
  }, [accuracy, betType]);
  const paged = usePaged(buckets, 5);

  if (!accuracy) return null;

  return (
    <WidgetCard
      icon={<BarChart3 />}
      title="Model accuracy"
      subtitle="How the prediction model itself has graded per market — the engine the regression picks are built on."
    >
      <div className="space-y-1">
        <RoiHeader first="Market" />
        {ACCURACY_BET_TYPES.map((type) => {
          const overall = accuracy[type]?.overall;
          if (!overall) return null;
          return (
            <RoiRow
              key={type}
              label={ACCURACY_BET_TYPE_LABEL[type]}
              record={`${overall.wins}-${overall.games - overall.wins}`}
              winPct={overall.games > 0 ? overall.win_pct : null}
              roiPct={overall.games > 0 ? overall.roi_pct : null}
            />
          );
        })}

        <Disclosure
          title="Break down by edge size"
          summary={`${ACCURACY_BET_TYPE_LABEL[betType]}`}
          intro="Bigger model edges should win more often. Each row is one edge band, filtered to bands with at least three graded games."
        >
          <SegmentedControl
            layoutId="regression-accuracy-bet-type"
            size="sm"
            className="mb-2 w-full [&>button]:flex-1"
            options={ACCURACY_BET_TYPES.map((t) => ({ value: t, label: ACCURACY_BET_TYPE_LABEL[t] }))}
            value={betType}
            onChange={(v) => setBetType(v)}
          />
          {buckets.length === 0 ? (
            <p className="py-3 text-[11px] text-muted-foreground">
              No edge band has three graded games yet.
            </p>
          ) : (
            <>
              <RoiHeader first="Edge" />
              {paged.visible.map((b, i) => (
                <RoiRow
                  key={`${b.bucket}-${b.side ?? ''}-${b.direction ?? ''}-${i}`}
                  label={[b.bucket, b.side, b.fav_dog, b.direction].filter(Boolean).join(' / ')}
                  record={`${b.wins}-${b.games - b.wins}`}
                  winPct={b.win_pct}
                  roiPct={b.roi_pct}
                />
              ))}
              <PageFiller count={5 - paged.visible.length} height={26} />
              <Pager
                pageCount={paged.pageCount}
                page={paged.page}
                onChange={paged.setPage}
                label="Edge bands"
              />
            </>
          )}
        </Disclosure>
      </div>
    </WidgetCard>
  );
}

/** "Is there a day of the week the model is reliably good or bad on?" */
export function DayOfWeekSection({ rows }: { rows: ModelBreakdownRow[] }) {
  const [betType, setBetType] = React.useState<AccuracyBetType>('full_ml');
  const DOW_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const dowRows = React.useMemo(
    () =>
      rows
        .filter((r) => r.bet_type === betType && r.breakdown_type === 'dow')
        .sort(
          (a, b) => DOW_ORDER.indexOf(a.breakdown_value) - DOW_ORDER.indexOf(b.breakdown_value),
        ),
    [rows, betType],
  );

  if (rows.length === 0) return null;

  return (
    <WidgetCard
      icon={<CalendarDays />}
      title="Form by weekday"
      subtitle="Where the model has been hottest and coldest this season. Refreshed nightly."
    >
      <div className="space-y-1">
        <SegmentedControl
          layoutId="regression-dow-bet-type"
          size="sm"
          className="mb-2 w-full [&>button]:flex-1"
          options={ACCURACY_BET_TYPES.map((t) => ({ value: t, label: ACCURACY_BET_TYPE_LABEL[t] }))}
          value={betType}
          onChange={(v) => setBetType(v)}
        />
        <RoiHeader first="Day" />
        {dowRows.length === 0 ? (
          <p className="py-3 text-[11px] text-muted-foreground">No graded games for this market yet.</p>
        ) : (
          dowRows.map((r) => (
            <RoiRow
              key={r.breakdown_value}
              label={r.breakdown_value}
              record={`${r.wins}-${r.losses}${r.pushes ? `-${r.pushes}` : ''}`}
              winPct={r.win_pct}
              roiPct={r.roi_pct}
            />
          ))
        )}
      </div>
    </WidgetCard>
  );
}

/** "Which clubs has the model read best?" — ranked by ROI, paged six at a time. */
export function TeamFormSection({ rows }: { rows: ModelBreakdownRow[] }) {
  const [betType, setBetType] = React.useState<AccuracyBetType>('full_ml');

  const teamRows = React.useMemo(
    () =>
      rows
        .filter((r) => r.bet_type === betType && r.breakdown_type === 'team')
        .sort((a, b) => b.roi_pct - a.roi_pct),
    [rows, betType],
  );
  const paged = usePaged(teamRows, 6);

  if (rows.length === 0) return null;

  return (
    <WidgetCard
      icon={<Users />}
      title="Form by team"
      subtitle="Ranked by return per unit staked, best first. Refreshed nightly."
    >
      <div className="space-y-1">
        <SegmentedControl
          layoutId="regression-team-bet-type"
          size="sm"
          className="mb-2 w-full [&>button]:flex-1"
          options={ACCURACY_BET_TYPES.map((t) => ({ value: t, label: ACCURACY_BET_TYPE_LABEL[t] }))}
          value={betType}
          onChange={(v) => setBetType(v)}
        />
        <RoiHeader first="Team" />
        {teamRows.length === 0 ? (
          <p className="py-3 text-[11px] text-muted-foreground">No graded games for this market yet.</p>
        ) : (
          <>
            {paged.visible.map((r) => (
              <RoiRow
                key={r.breakdown_value}
                leading={
                  <>
                    <img
                      src={espnMlb500LogoUrlFromAbbrev(r.breakdown_value)}
                      alt=""
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-[18px] w-[18px] shrink-0 object-contain"
                    />
                    <span className="truncate">{r.breakdown_value}</span>
                  </>
                }
                record={`${r.wins}-${r.losses}${r.pushes ? `-${r.pushes}` : ''}`}
                winPct={r.win_pct}
                roiPct={r.roi_pct}
              />
            ))}
            <PageFiller count={6 - paged.visible.length} height={26} />
            <Pager
              pageCount={paged.pageCount}
              page={paged.page}
              onChange={paged.setPage}
              label="Teams"
            />
          </>
        )}
      </div>
    </WidgetCard>
  );
}

/** "How did yesterday's card go?" — the headline result, then every leg. */
export function YesterdaySection({ recap }: { recap: YesterdayRecap[] }) {
  const paged = usePaged(recap, 5);
  if (recap.length === 0) return null;

  const wins = recap.filter((r) => r.result === 'won').length;
  const losses = recap.filter((r) => r.result === 'lost').length;
  const pushes = recap.filter((r) => r.result === 'push').length;
  const graded = wins + losses;
  const winPct = graded > 0 ? Math.round((1000 * wins) / graded) / 10 : null;

  return (
    <WidgetCard
      icon={<Trophy />}
      title="Yesterday"
      subtitle="Every pick this report published yesterday, graded against the final score."
    >
      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
              Result
            </span>
            <span className="text-2xl font-bold leading-none tabular-nums text-foreground">
              {recordString(wins, losses, pushes)}
            </span>
          </div>
          <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
            {recap.length} {recap.length === 1 ? 'pick' : 'picks'}
          </span>
        </div>

        <WinRateMeter
          winPct={winPct}
          record={recordString(wins, losses, pushes)}
          label="of yesterday's picks landed"
        />

        <div className="divide-y divide-black/5 dark:divide-white/10">
          {paged.visible.map((r, i) => (
            <div key={`${r.game_pk}-${r.bet_type}-${i}`} className="flex items-center gap-2 py-2">
              <span
                className={cn(
                  'w-1 shrink-0 self-stretch rounded-full',
                  r.result === 'won'
                    ? 'bg-emerald-500'
                    : r.result === 'lost'
                      ? 'bg-red-500'
                      : 'bg-muted-foreground/40',
                )}
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[12px] font-bold text-foreground">
                  <PickText pick={r.pick} />
                </span>
                <span className="truncate text-[10px] text-muted-foreground">{r.matchup}</span>
              </span>
              <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                {r.actual_score}
              </span>
              <span
                className={cn(
                  'w-10 shrink-0 text-right text-[10px] font-bold uppercase tracking-wide',
                  r.result === 'won' ? GOOD_TEXT : r.result === 'lost' ? BAD_TEXT : 'text-muted-foreground',
                )}
              >
                {r.result}
              </span>
            </div>
          ))}
          <PageFiller count={5 - paged.visible.length} height={40} />
        </div>
        <Pager
          pageCount={paged.pageCount}
          page={paged.page}
          onChange={paged.setPage}
          label="Yesterday's picks"
        />
      </div>
    </WidgetCard>
  );
}

/**
 * The report's own written summary. Kept collapsible and closed by default —
 * it repeats what the cards already say, and open by default it pushed every
 * number below the fold.
 */
export function NarrativeSection({ text }: { text: string }) {
  const html = React.useMemo(() => simpleMarkdownToHtml(text), [text]);
  return (
    <WidgetCard
      icon={<Sparkles />}
      title="Written summary"
      subtitle="The report's own narrative for today's slate, generated alongside the numbers."
    >
      <Disclosure title="Read the summary" summary="AI generated">
        <div
          className="text-[12px] leading-relaxed text-muted-foreground [&_h2]:mb-1 [&_h2]:mt-3 [&_h2]:text-[15px] [&_h2]:font-bold [&_h2]:text-foreground [&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:text-[13px] [&_h3]:font-bold [&_h3]:text-foreground [&_h4]:mb-1 [&_h4]:mt-2 [&_h4]:text-[12px] [&_h4]:font-semibold [&_h4]:text-foreground [&_li]:ml-4 [&_li]:list-disc"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </Disclosure>
    </WidgetCard>
  );
}

/**
 * Narrative arrives as light markdown from the ETL. Rendered with a hand-rolled
 * converter rather than a parser dependency — the payload only ever uses
 * headings, bold, blockquotes, rules and bullets.
 */
function simpleMarkdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(
      /^> (.+)$/gm,
      '<blockquote class="my-2 rounded-r border-l-2 border-primary/50 bg-primary/5 py-1 pl-3 italic">$1</blockquote>',
    )
    .replace(/^---$/gm, '<hr class="my-3 border-black/5 dark:border-white/10"/>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground">$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p class="my-2">')
    .replace(/\n/g, '<br/>');
}

/** "Where do these numbers come from?" — the one card that isn't a number. */
export function MethodologySection({
  generatedLabel,
  version,
}: {
  generatedLabel: string | null;
  version: number | null;
}) {
  return (
    <WidgetCard
      icon={<BookOpen />}
      title="How this works"
      subtitle="Regression means a team's recent results have run ahead of, or behind, the underlying stats — and should swing back."
    >
      <div className="space-y-2 text-[11px] leading-relaxed text-muted-foreground">
        <p>
          <span className="font-semibold text-foreground">Pitchers</span> are compared on ERA versus
          xFIP — what their strikeouts, walks and fly balls say they should have allowed. A starter
          whose ERA sits well below his xFIP has been lucky and is due to slip.
        </p>
        <p>
          <span className="font-semibold text-foreground">Lineups</span> are compared on wOBA versus
          the quality of contact behind it, with BABIP as the luck check against the .300 league
          line.
        </p>
        <p>
          <span className="font-semibold text-foreground">Picks</span> fire when a regression angle
          points the same way as a priced model edge. Each one is labelled with a conviction tier;
          anything weaker than {TIER_META.watch.short} never reaches this page.
        </p>
        <p>
          Win rates are shown against the{' '}
          <span className="font-semibold text-foreground">52.4%</span> line — break-even on a -110
          bet. ROI is return per unit staked.
        </p>
        <Callout>
          Reports generate at 9 AM, 11 AM and 4 PM ET
          {generatedLabel ? `; this one ${generatedLabel}` : ''}
          {version != null ? ` (v${version})` : ''}.
        </Callout>
      </div>
    </WidgetCard>
  );
}
