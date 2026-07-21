import * as React from 'react';
import { Chip } from '@heroui/react';
import { AlertCircle, Clock } from 'lucide-react';
import { TeamAura, TeamLogoDiscs } from '@/components/ios';
// Shared with /games on purpose: the packing rule ("a short widget shouldn't
// hold open a full-height row") is identical and the hook is sport-agnostic.
import { useMasonryGrid } from '@/features/games/detail/useMasonryGrid';
import { NoPicksCard, PickCard } from './sections/PickSections';
import {
  BattingRegressionSection,
  BullpenSection,
  PitcherRegressionSection,
} from './sections/RegressionSections';
import {
  HandednessSplitsSection,
  ModelFormSection,
  SeriesSignalsSection,
  WeatherSection,
} from './sections/ContextSections';
import {
  DayOfWeekSection,
  MarketAccuracySection,
  MethodologySection,
  NarrativeSection,
  OverallRecordSection,
  TeamFormSection,
  TierRecordSection,
  YesterdaySection,
} from './sections/SummarySections';
import { TierChip } from './shared';
import type { RegressionData } from '../hooks/useRegressionData';
import type { RegressionGame } from '../types';

/** The grid every pane uses — `@container` measures this resizable pane, not the viewport. */
const GRID_CLASS =
  'grid grid-cols-1 items-start gap-x-4 gap-y-4 px-4 pb-10 [--widget-card-bg:rgba(241,245,249,0.92)] [--widget-card-border:rgba(15,23,42,0.1)] @xl:grid-cols-2';

export function timeAgo(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return null;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'generated just now';
  if (mins < 60) return `generated ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `generated ${hrs}h ${mins % 60}m ago`;
}

function formatReportDate(date: string | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(`${date.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Matchup header for a selected game: teams, first pitch, strongest tier. */
function GameHero({ game }: { game: RegressionGame }) {
  const { away, home } = game;
  return (
    <div className="px-4 pb-3 pt-5">
      <div className="flex items-center gap-3">
        <TeamLogoDiscs
          away={{ logoUrl: away.logoUrl, abbrev: away.abbrev, color: away.colors.primary }}
          home={{ logoUrl: home.logoUrl, abbrev: home.abbrev, color: home.colors.primary }}
          size={52}
          overlap={12}
        />
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-xl font-bold leading-tight tracking-tight text-foreground">
            {away.abbrev} <span className="text-muted-foreground">@</span> {home.abbrev}
          </h1>
          <p className="truncate text-[12px] text-muted-foreground">
            {away.name} at {home.name}
          </p>
        </div>
        <div className="ml-auto flex shrink-0 flex-col items-end gap-1">
          {game.topTier ? (
            <TierChip tier={game.topTier} size="md" />
          ) : (
            <Chip size="sm" variant="flat" classNames={{ content: 'text-[10px] font-bold' }}>
              No picks
            </Chip>
          )}
          <span className="flex items-center gap-1 font-mono text-[11px] font-semibold text-muted-foreground">
            <Clock className="h-3 w-3" />
            {game.gameTimeLabel}
          </span>
        </div>
      </div>
      {game.isDoubleheader && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Game {game.gameNumber} of a doubleheader — team-level signals apply to both games of the
          day.
        </p>
      )}
    </div>
  );
}

/** Header for the report-wide summary. */
function SummaryHero({
  dateLabel,
  generatedLabel,
}: {
  dateLabel: string | null;
  generatedLabel: string | null;
}) {
  return (
    <div className="px-4 pb-3 pt-5">
      <h1 className="text-xl font-bold leading-tight tracking-tight text-foreground">
        MLB Regression Report
      </h1>
      <p className="mt-0.5 text-[12px] text-muted-foreground">
        {dateLabel ?? 'Today'}
        {generatedLabel ? ` · ${generatedLabel}` : ''}
      </p>
    </div>
  );
}

interface RegressionDetailPaneProps {
  game: RegressionGame | null;
  data: RegressionData;
}

/**
 * Right split-view pane. With a game selected it shows that matchup's picks and
 * regression signals; with nothing selected it shows the report-wide record,
 * accuracy and method — which is a destination in its own right, not an empty
 * state, so none of it has to be repeated inside every game.
 */
export function RegressionDetailPane({ game, data }: RegressionDetailPaneProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const gridRef = React.useRef<HTMLDivElement>(null);

  useMasonryGrid(gridRef, game?.id ?? 'summary');

  React.useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [game?.id]);

  const { report, isLoading, error } = data;
  const dateLabel = formatReportDate(report?.report_date);
  const generatedLabel = timeAgo(report?.generated_at);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="flex max-w-sm flex-col items-center gap-2 text-center">
          <AlertCircle className="h-8 w-8 text-red-500" />
          <p className="text-sm font-semibold text-foreground">Couldn't load the regression report</p>
          <p className="text-[12px] text-muted-foreground">{String(error)}</p>
        </div>
      </div>
    );
  }

  if (!report && !isLoading) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <div className="flex max-w-sm flex-col items-center gap-2 text-center">
          <AlertCircle className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm font-semibold text-foreground">No report for today yet</p>
          <p className="text-[12px] text-muted-foreground">
            Reports generate at 9 AM, 11 AM and 4 PM ET.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="relative h-full overflow-y-auto">
      {game && (
        <TeamAura awayColor={game.away.colors.primary} homeColor={game.home.colors.primary} />
      )}
      <div className="relative mx-auto max-w-5xl @container">
        {game ? (
          <GameHero game={game} />
        ) : (
          <SummaryHero dateLabel={dateLabel} generatedLabel={generatedLabel} />
        )}
        <div ref={gridRef} className={GRID_CLASS}>
          {game ? (
            <GameSections game={game} data={data} />
          ) : (
            <SummarySections data={data} generatedLabel={generatedLabel} />
          )}
        </div>
      </div>
    </div>
  );
}

function GameSections({ game, data }: { game: RegressionGame; data: RegressionData }) {
  const reportDate = data.report?.report_date ?? '';
  return (
    <>
      {game.picks.length > 0 ? (
        game.picks.map((pick, i) => (
          <PickCard
            key={`${pick.bet_type}-${i}`}
            pick={pick}
            game={game}
            tierRecords={data.tierRecords}
            breakdownRows={data.breakdownRows}
            reportDate={reportDate}
          />
        ))
      ) : (
        <NoPicksCard game={game} />
      )}
      <PitcherRegressionSection game={game} />
      <BattingRegressionSection game={game} />
      <BullpenSection game={game} />
      <SeriesSignalsSection game={game} />
      <HandednessSplitsSection game={game} splitLookup={data.f5SplitLookup} />
      <WeatherSection game={game} />
      <ModelFormSection game={game} breakdownRows={data.breakdownRows} reportDate={reportDate} />
    </>
  );
}

function SummarySections({
  data,
  generatedLabel,
}: {
  data: RegressionData;
  generatedLabel: string | null;
}) {
  const { report } = data;
  return (
    <>
      <OverallRecordSection records={data.tierRecords} />
      <TierRecordSection records={data.tierRecords} />
      {report?.narrative_text && <NarrativeSection text={report.narrative_text} />}
      <YesterdaySection recap={report?.yesterday_recap ?? []} />
      <MarketAccuracySection accuracy={data.bucketAccuracy} />
      <DayOfWeekSection rows={data.breakdownRows} />
      <TeamFormSection rows={data.breakdownRows} />
      <MethodologySection
        generatedLabel={generatedLabel}
        version={report?.generation_version ?? null}
      />
    </>
  );
}
