// Linemate-style "Today's Outliers" dashboard (rebuild of OutliersTrendsSection).
// A vertical stack of titled bands: filter pills → Today's Matchups → (MLB)
// Parlay God + Props Cheats → per-market trend carousels. Defaults to "All
// Sports", fanning every band across every slate with a live trends source;
// the pills narrow from there. See specs/outliers_spec.md §1-§4.
import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownRight,
  ArrowLeftRight,
  CircleDollarSign,
  CircleDot,
  Clock,
  Dribbble,
  Flag,
  Globe,
  Hand,
  History,
  LayoutGrid,
  LineChart,
  PersonStanding,
  Send,
  Shield,
  Sigma,
  Trophy,
  User,
  Users,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  FilterPill,
  GlassCard,
  MultiFilterPill,
  SkeletonBlock,
  type FilterPillOption,
} from '@/components/ios';
import { OutliersTrendCard } from './OutliersTrendCard';
import { OutliersTrendCardSkeleton } from './OutliersTrendCardSkeleton';
import { HorizontalCardRail } from './HorizontalCardRail';
import { SectionHeader } from './SectionHeader';
import { TodaysMatchupsGrid } from './TodaysMatchupsGrid';
import { ParlayGodSection, PropsCheatsSection } from './ParlayRailSection';
import { buildMarketSections, filterTrendCards, matchupIdsForSport, matchupKey } from '../filtering';
import { useOutliersTrendsMulti } from '../hooks/useOutliersTrends';
import { useHorizontalRail } from '../hooks/useHorizontalRail';
import { useParlayGod } from '@/features/parlayGod';
import {
  OUTLIERS_SPORTS,
  OUTLIERS_SPORT_LABELS,
  OUTLIERS_SUBJECT_LABELS,
  activeSportsFor,
  allowedSubjectsForSports,
  gameLabel,
} from '../types';
import type {
  OutliersSportedCard,
  OutliersTrendsGame,
  OutliersTrendsMarketSection,
  OutliersTrendsMatchupFilter,
  OutliersTrendsSport,
  OutliersTrendsSubject,
} from '../types';

function sportIcon(sport: OutliersTrendsSport) {
  switch (sport) {
    case 'nfl':
      return <Shield />;
    case 'ncaaf':
      return <Trophy />;
    case 'mlb':
      return <CircleDot />;
    default:
      return <Dribbble />;
  }
}

/** The pill's own glyph: one sport's mark when exactly one is picked, else the globe. */
function sportFilterIcon(selection: OutliersTrendsSport[]) {
  return selection.length === 1 ? sportIcon(selection[0]) : <Globe />;
}

function subjectIcon(subject: OutliersTrendsSubject) {
  switch (subject) {
    case 'teams':
      return <Shield />;
    case 'coaches':
      return <User />;
    case 'refs':
      return <Flag />;
    case 'players':
      return <PersonStanding />;
    default:
      return <LayoutGrid />;
  }
}

/** Lucide stand-ins for the iOS SF Symbols per bet-type section. */
function MarketIcon({ marketKey }: { marketKey: string }) {
  const cls = 'h-4 w-4';
  switch (marketKey) {
    case 'spread':
    case 'rl':
    case 'f5_rl':
      return <ArrowLeftRight className={cls} />;
    case 'moneyline':
    case 'ml':
    case 'f5_ml':
      return <CircleDollarSign className={cls} />;
    case 'total':
    case 'ou':
    case 'f5_ou':
      return <Sigma className={cls} />;
    case 'team_total':
      return <Users className={cls} />;
    case 'h1_spread':
      return <History className={cls} />;
    case 'h1_total':
      return <Clock className={cls} />;
    case 'player_anytime_td':
      return <Zap className={cls} />;
    case 'player_rush_yds':
      return <PersonStanding className={cls} />;
    case 'player_reception_yds':
      return <ArrowDownRight className={cls} />;
    case 'player_receptions':
      return <Hand className={cls} />;
    case 'player_pass_yds':
      return <Send className={cls} />;
    case 'player_pass_tds':
      return <Trophy className={cls} />;
    default:
      return <LineChart className={cls} />;
  }
}

export function OutliersDashboard() {
  // Sport and matchup are multi-select; an empty array means "everything", so
  // the default (the whole board, unfiltered) needs no sentinel value.
  const [sportSelection, setSportSelection] = useState<OutliersTrendsSport[]>([]);
  const [subject, setSubject] = useState<OutliersTrendsSubject>('all');
  const [matchupSelection, setMatchupSelection] = useState<OutliersTrendsMatchupFilter[]>([]);

  const sports = useMemo(() => activeSportsFor(sportSelection), [sportSelection]);
  const { bySport, isLoading, isError, refetch } = useOutliersTrendsMulti(sports);

  const includesMlb = sports.includes('mlb');
  // The two premium rails are MLB-only; the hook is inert when MLB is out of scope.
  const parlay = useParlayGod(includesMlb);
  const queryClient = useQueryClient();
  // useParlayGod doesn't expose refetch — invalidate its bundle key to retry
  // (only the bundle can hard-error; props degrade to empty). Key mirrors
  // useParlayGod.ts's ['parlay-god-bundle'].
  const retryParlay = () => queryClient.invalidateQueries({ queryKey: ['parlay-god-bundle'] });

  // Mirrors OutliersTrendsStore.onSportChanged(): a narrower sport scope can
  // retire the active subject (MLB is teams-only, NCAAF has no refs/players).
  // Matchup resets because its options are scoped to the sports on screen.
  const handleSportChange = (next: OutliersTrendsSport[]) => {
    setSportSelection(next);
    const allowed = allowedSubjectsForSports(activeSportsFor(next));
    if (allowed.length > 0 && !allowed.includes(subject)) {
      setSubject(allowed[0]);
    }
    setMatchupSelection([]);
  };

  // Filter each slate on its own terms (the line/subject rules are sport-specific),
  // then merge and re-sort so a market rail is best-first across every sport.
  const sections = useMemo(() => {
    const merged: OutliersSportedCard[] = bySport.flatMap((d) =>
      filterTrendCards(
        d.cards,
        d.games,
        d.sport,
        subject,
        matchupIdsForSport(matchupSelection, d.sport),
      ).map((card) => ({ ...card, sport: d.sport })),
    );
    merged.sort((a, b) => b.trendValue - a.trendValue || b.trendSampleN - a.trendSampleN);
    return buildMarketSections(merged);
  }, [bySport, subject, matchupSelection]);

  // Keyed by sport-qualified id — raw game ids aren't unique across merged slates.
  const gamesById = useMemo(() => {
    const map = new Map<string, OutliersTrendsGame>();
    for (const d of bySport) {
      for (const g of d.games) map.set(matchupKey(d.sport, g.id), g);
    }
    return map;
  }, [bySport]);

  const gamesBySport = useMemo(() => {
    const out: Partial<Record<OutliersTrendsSport, OutliersTrendsGame[]>> = {};
    for (const d of bySport) out[d.sport] = d.games;
    return out;
  }, [bySport]);

  const hasData = sports.length > 0;
  const multiSport = sports.length > 1;
  const subjects = allowedSubjectsForSports(sports);
  const subjectOptions: FilterPillOption<OutliersTrendsSubject>[] = subjects.map((s) => ({
    value: s,
    label: OUTLIERS_SUBJECT_LABELS[s],
    icon: subjectIcon(s),
  }));

  const matchupOptions = useMemo(
    () =>
      bySport.flatMap((d) =>
        d.games.map((g) => ({
          value: matchupKey(d.sport, g.id),
          label: multiSport
            ? `${OUTLIERS_SPORT_LABELS[d.sport]} · ${gameLabel(g)}`
            : gameLabel(g),
        })),
      ),
    [bySport, multiSport],
  );

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* Filter pills */}
      <div className="flex items-center gap-2.5 overflow-x-auto scrollbar-transparent">
        <MultiFilterPill
          icon={sportFilterIcon(sportSelection)}
          allLabel="All Sports"
          noun="sports"
          options={OUTLIERS_SPORTS.map((s) => ({
            value: s,
            label: OUTLIERS_SPORT_LABELS[s],
            icon: sportIcon(s),
          }))}
          values={sportSelection}
          onChange={handleSportChange}
        />
        {hasData && subjects.length > 1 && (
          <FilterPill
            icon={subjectIcon(subject)}
            label={OUTLIERS_SUBJECT_LABELS[subject]}
            options={subjectOptions}
            value={subject}
            // Wrapped, not `onChange={setSubject}`: a Dispatch<SetStateAction<T>>
            // accepts `T | ((prev) => T)`, so inferring FilterPill's `T extends
            // string` from it picks up a function type and collapses T to `string`.
            onChange={(value) => setSubject(value)}
          />
        )}
        {hasData && (
          <MultiFilterPill
            icon={<LayoutGrid />}
            allLabel="All games"
            noun="games"
            options={matchupOptions}
            values={matchupSelection}
            onChange={setMatchupSelection}
          />
        )}
        {/* The trend window differs by sport, so only claim one when a single sport is pinned. */}
        {hasData && !multiSport && (
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {includesMlb ? 'Today' : 'This week'}
          </span>
        )}
      </div>

      {!hasData ? (
        <ComingSoonCard
          label={sportSelection.map((s) => OUTLIERS_SPORT_LABELS[s]).join(' and ')}
        />
      ) : (
        <>
          {/* Always the first band — the slate is the page's anchor. */}
          <TodaysMatchupsGrid
            sports={sports}
            gamesBySport={gamesBySport}
            slateLoading={isLoading}
          />

          {/* MLB-only premium bands — hidden entirely when MLB is out of scope (no data). */}
          {includesMlb && (
            <ParlayGodSection
              tickets={parlay.slateTickets}
              isLoading={parlay.slateLoading}
              isError={parlay.isError}
              onRetry={retryParlay}
            />
          )}
          {includesMlb && (
            <PropsCheatsSection
              tickets={parlay.propsTickets}
              isLoading={parlay.propsLoading}
            />
          )}

          {/* Per-market trend carousels. */}
          {isLoading ? (
            <LoadingSections />
          ) : isError ? (
            <ErrorCard onRetry={refetch} />
          ) : sections.length === 0 ? (
            <EmptyCard />
          ) : (
            sections.map((section) => (
              <MarketSection key={section.marketKey} section={section} gamesById={gamesById} />
            ))
          )}
        </>
      )}
    </div>
  );
}

function MarketSection({
  section,
  gamesById,
}: {
  section: OutliersTrendsMarketSection<OutliersSportedCard>;
  gamesById: Map<string, OutliersTrendsGame>;
}) {
  // Controls live in the header, so the rail owns no chrome of its own.
  const rail = useHorizontalRail(section.cards.length);

  return (
    <section className="group flex min-w-0 flex-col gap-2.5">
      <SectionHeader
        title={section.title}
        icon={<MarketIcon marketKey={section.marketKey} />}
        action={
          rail.hasOverflow
            ? {
                kind: 'chevrons',
                onPrev: rail.scrollPrev,
                onNext: rail.scrollNext,
                canPrev: rail.canScrollLeft,
                canNext: rail.canScrollRight,
                revealOnHover: true,
              }
            : undefined
        }
      />
      <HorizontalCardRail rail={rail} className="scrollbar-transparent">
        {section.cards.map((card) => (
          <div key={`${card.sport}:${card.id}`} className="shrink-0 snap-start">
            <OutliersTrendCard
              card={card}
              sport={card.sport}
              game={gamesById.get(matchupKey(card.sport, card.gameId))}
            />
          </div>
        ))}
      </HorizontalCardRail>
    </section>
  );
}

function LoadingSections() {
  return (
    <>
      {[0, 1, 2].map((s) => (
        <div key={s} className="flex flex-col gap-2.5">
          <div className="flex items-center gap-1.5">
            <SkeletonBlock width={18} height={18} radius={5} />
            <SkeletonBlock width={130} height={18} />
          </div>
          <HorizontalCardRail className="scrollbar-transparent">
            {[0, 1, 2].map((c) => (
              <div key={c} className="shrink-0">
                <OutliersTrendCardSkeleton />
              </div>
            ))}
          </HorizontalCardRail>
        </div>
      ))}
    </>
  );
}

function ComingSoonCard({ label }: { label: string }) {
  return (
    <GlassCard className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <LineChart className="h-8 w-8 text-muted-foreground" />
      <p className="text-base font-semibold text-foreground">Trends coming soon</p>
      <p className="max-w-sm text-[13px] text-muted-foreground">
        {label || 'Those sports'} don't have situational betting trends yet — NFL, NCAAF, and
        MLB are available now.
      </p>
    </GlassCard>
  );
}

function EmptyCard() {
  return (
    <GlassCard className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <LayoutGrid className="h-8 w-8 text-muted-foreground" />
      <p className="text-base font-semibold text-foreground">No trends match</p>
      <p className="max-w-sm text-[13px] text-muted-foreground">
        Try a different matchup or subject — or check back when the slate fills in.
      </p>
    </GlassCard>
  );
}

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <GlassCard className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <p className="text-base font-semibold text-foreground">Couldn't load trends</p>
      <p className="max-w-sm text-[13px] text-muted-foreground">
        Something went wrong fetching this slate's trends.
      </p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </GlassCard>
  );
}
