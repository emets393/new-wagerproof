// Web port of the iOS Outliers Trends experience
// (wagerproof-ios-native/Wagerproof/Features/Outliers/OutliersTrendsView.swift):
// a filter pill row (sport / subject / matchup) over per-market section headers,
// each with a horizontally-scrolling carousel of fixed-size trend cards.
import { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowLeftRight,
  CircleDollarSign,
  CircleDot,
  Clock,
  Dribbble,
  Flag,
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
import { FilterPill, GlassCard, SkeletonBlock } from '@/components/ios';
import { OutliersTrendCard } from './OutliersTrendCard';
import { OutliersTrendCardSkeleton } from './OutliersTrendCardSkeleton';
import { HorizontalCardRail } from './HorizontalCardRail';
import { buildMarketSections, filterTrendCards } from '../filtering';
import { useOutliersTrends } from '../hooks/useOutliersTrends';
import {
  OUTLIERS_SPORTS,
  OUTLIERS_SPORT_LABELS,
  OUTLIERS_SUBJECT_LABELS,
  allowedSubjects,
  gameLabel,
  sportHasTrendsData,
} from '../types';
import type {
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
  const cls = 'h-3.5 w-3.5';
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

export function OutliersTrendsSection() {
  const [sport, setSport] = useState<OutliersTrendsSport>('nfl');
  const [subject, setSubject] = useState<OutliersTrendsSubject>('all');
  const [matchup, setMatchup] = useState<OutliersTrendsMatchupFilter>('all');

  const { data, isLoading, isError, refetch } = useOutliersTrends(sport);
  const games = data?.games ?? [];
  const cards = data?.cards ?? [];

  // Mirrors OutliersTrendsStore.onSportChanged(): MLB only has team trends,
  // other sports drop a subject they don't support; matchup always resets.
  const handleSportChange = (next: OutliersTrendsSport) => {
    setSport(next);
    if (next === 'mlb') {
      setSubject('teams');
    } else if (!allowedSubjects(next).includes(subject)) {
      setSubject('all');
    }
    setMatchup('all');
  };

  const sections = useMemo(
    () => buildMarketSections(filterTrendCards(cards, games, sport, subject, matchup)),
    [cards, games, sport, subject, matchup],
  );
  const gamesById = useMemo(() => new Map(games.map((g) => [g.id, g])), [games]);

  const hasData = sportHasTrendsData(sport);
  const subjects = allowedSubjects(sport);
  const subjectOptions = subjects.map((s) => ({
    value: s,
    label: OUTLIERS_SUBJECT_LABELS[s],
    icon: subjectIcon(s),
  }));
  const matchupOptions = [
    { value: 'all', label: 'All games' },
    ...games.map((g) => ({ value: g.id, label: gameLabel(g) })),
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* Filter pills */}
      <div className="flex items-center gap-2.5 overflow-x-auto scrollbar-transparent">
        <FilterPill
          icon={sportIcon(sport)}
          label={OUTLIERS_SPORT_LABELS[sport]}
          options={OUTLIERS_SPORTS.map((s) => ({
            value: s,
            label: OUTLIERS_SPORT_LABELS[s],
            icon: sportIcon(s),
          }))}
          value={sport}
          onChange={handleSportChange}
        />
        {hasData && subjects.length > 1 && (
          <FilterPill
            icon={subjectIcon(subject)}
            label={OUTLIERS_SUBJECT_LABELS[subject]}
            options={subjectOptions}
            value={subject}
            onChange={setSubject}
          />
        )}
        {hasData && (
          <FilterPill
            icon={<LayoutGrid />}
            label="All games"
            options={matchupOptions}
            value={matchup}
            onChange={setMatchup}
            defaultValue="all"
          />
        )}
        {hasData && (
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {sport === 'mlb' ? 'Today' : 'This week'}
          </span>
        )}
      </div>

      {!hasData ? (
        <ComingSoonCard sport={sport} />
      ) : isLoading ? (
        <LoadingSections />
      ) : isError ? (
        <ErrorCard onRetry={() => refetch()} />
      ) : sections.length === 0 ? (
        <EmptyCard />
      ) : (
        <div className="flex min-w-0 flex-col gap-5">
          {sections.map((section) => (
            <MarketSection key={section.marketKey} section={section} sport={sport} gamesById={gamesById} />
          ))}
        </div>
      )}
    </div>
  );
}

function MarketSection({
  section,
  sport,
  gamesById,
}: {
  section: OutliersTrendsMarketSection;
  sport: OutliersTrendsSport;
  gamesById: Map<string, OutliersTrendsGame>;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div className="flex items-center gap-1.5 text-[13px] font-semibold uppercase text-muted-foreground">
        <MarketIcon marketKey={section.marketKey} />
        <span>{section.title}</span>
      </div>
      <HorizontalCardRail className="scrollbar-transparent [touch-action:pan-x]">
        {section.cards.map((card) => (
          <div key={card.id} className="shrink-0 snap-start">
            <OutliersTrendCard card={card} sport={sport} game={gamesById.get(card.gameId)} />
          </div>
        ))}
      </HorizontalCardRail>
    </div>
  );
}

function LoadingSections() {
  return (
    <div className="flex min-w-0 flex-col gap-5">
      {[0, 1, 2].map((s) => (
        <div key={s} className="flex flex-col gap-2.5">
          <div className="flex items-center gap-1.5">
            <SkeletonBlock width={14} height={14} radius={4} />
            <SkeletonBlock width={110} height={12} />
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
    </div>
  );
}

function ComingSoonCard({ sport }: { sport: OutliersTrendsSport }) {
  return (
    <GlassCard className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <LineChart className="h-8 w-8 text-muted-foreground" />
      <p className="text-base font-semibold text-foreground">Trends coming soon</p>
      <p className="max-w-sm text-[13px] text-muted-foreground">
        {OUTLIERS_SPORT_LABELS[sport]} situational betting trends aren't live yet — NFL, NCAAF, and
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
