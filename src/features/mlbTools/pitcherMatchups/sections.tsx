import * as React from 'react';
import { Chip } from '@heroui/react';
import { CloudSun, Flame, MapPin, Sparkles, Target, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SegmentedControl, WidgetCard } from '@/components/ios';
import { Headshot } from '@/components/mlb/pitcher-matchups/Headshot';
import type { ParkHRFactors } from '@/hooks/usePark';
import type { PitcherArchetypeProfile, PitcherArsenalByHand } from '@/types/mlb-matchups';
import { formatPropLine, formatPropOdds } from '@/utils/mlbPlayerProps';
import {
  abbrevPitchLabel,
  formatMoneyline,
  getTopThreePitches,
  windBannerTone,
} from '@/utils/mlbPitcherMatchups';
import { PageFiller, Pager, usePaged } from '../shared/paging';
import type { MlbToolTeam } from '../shared/types';
import {
  DivergingBar,
  Disclosure,
  LeanCallout,
  Recommendation,
  TeamMark,
  ThresholdMeter,
  WidgetEmpty,
  formatSigned,
} from '../shared/visuals';
import { MIN_PROP_GAMES, shortPlayerName, type PropMatchupFeedItem, type PropPlay } from './model';

/** Park HR factor is a multiplier around 1.00; ±25% pins the bar. */
const PARK_FACTOR_CAP = 0.25;

/** Batter rows shown per page before the pager takes over. */
const PROP_ROWS_PER_PAGE = 5;
const PROP_ROW_HEIGHT = 44;

/** Last-10 clear history as a strip — cleared games filled, misses hollow. */
function LastTenStrip({ strip }: { strip: { cleared: boolean }[] }) {
  if (strip.length === 0) return null;
  return (
    <span className="flex items-center gap-0.5" role="img" aria-label="Last 10 games, oldest first">
      {strip.map((g, i) => (
        <span
          key={i}
          className={cn(
            'h-3 w-1.5 rounded-[2px]',
            g.cleared ? 'bg-emerald-500' : 'bg-muted-foreground/25',
          )}
        />
      ))}
    </span>
  );
}

function ArchetypeChip({ archetype }: { archetype: PitcherArchetypeProfile | null }) {
  if (!archetype?.archetype) return null;
  return (
    <Chip size="sm" variant="flat" classNames={{ content: 'text-[10px] font-bold capitalize' }}>
      {String(archetype.archetype).replace(/_/g, ' ')}
    </Chip>
  );
}

function playSideTeam(play: PropPlay, item: PropMatchupFeedItem): MlbToolTeam | null {
  if (play.side === 'away') return item.away;
  if (play.side === 'home') return item.home;
  return null;
}

/**
 * Card 1 — the one prop most worth a look: the biggest gap between a player's
 * recent clear rate and the break-even the posted price implies. The legacy
 * page listed every market and never said which one stood out.
 */
function TopPlaySection({ item }: { item: PropMatchupFeedItem }) {
  const play = item.topPlay;

  if (!play) {
    return (
      <WidgetCard
        icon={<Sparkles />}
        title="Top prop play"
        subtitle="The posted prop whose recent clear rate most exceeds the break-even its price implies."
      >
        <WidgetEmpty>
          {item.propsLoading
            ? 'Loading tonight’s posted props…'
            : 'No props posted for this game yet — books usually post closer to first pitch.'}
        </WidgetEmpty>
      </WidgetCard>
    );
  }

  const team = playSideTeam(play, item);
  const thin = play.computed.l10.games < MIN_PROP_GAMES;

  return (
    <WidgetCard
      icon={<Sparkles />}
      title="Top prop play"
      subtitle="The posted prop whose recent clear rate most exceeds the break-even its price implies."
      accessory={
        thin ? (
          <Chip size="sm" variant="flat" color="warning" classNames={{ content: 'text-[10px] font-bold' }}>
            Thin sample
          </Chip>
        ) : null
      }
    >
      <div className="space-y-3">
        <Recommendation
          market={play.marketLabel}
          pickTeam={team}
          pickText={`${shortPlayerName(play.playerName)} O${formatPropLine(play.computed.line)}`}
          edge={play.edgePts === null ? '—' : `${formatSigned(play.edgePts, 1)}%`}
          edgeCaption="vs price"
        />

        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="flex items-center gap-2">
            <Headshot playerId={play.playerId} size={34} alt={play.playerName} />
            <span className="flex flex-col">
              <span className="font-semibold text-foreground">{play.playerName}</span>
              <span className="font-mono tabular-nums text-muted-foreground">
                Over {formatPropLine(play.computed.line)} · {formatPropOdds(play.computed.overOdds)}
              </span>
            </span>
          </span>
          <LastTenStrip strip={play.computed.miniStrip} />
        </div>

        <ThresholdMeter
          pct={play.l10Pct}
          threshold={play.impliedPct ?? 50}
          thresholdTitle={
            play.impliedPct !== null
              ? `The price implies ${play.impliedPct.toFixed(1)}% to break even`
              : undefined
          }
          label={
            <>
              Cleared{' '}
              <span
                className={cn(
                  'font-bold',
                  (play.l10Pct ?? 0) >= (play.impliedPct ?? 50)
                    ? 'text-emerald-600 dark:text-emerald-300'
                    : 'text-red-600 dark:text-red-300',
                )}
              >
                {play.computed.l10.over} of {play.computed.l10.games}
              </span>{' '}
              recent games
            </>
          }
          trailing={play.impliedPct !== null ? `${play.impliedPct.toFixed(0)}% break-even` : undefined}
        />

        {play.edgePts !== null && (
          <LeanCallout>
            Recent form clears this line{' '}
            <span className="font-bold text-foreground">
              {Math.abs(play.edgePts).toFixed(1)} pts {play.edgePts >= 0 ? 'more' : 'less'}
            </span>{' '}
            often than {formatPropOdds(play.computed.overOdds)} needs to break even
          </LeanCallout>
        )}

        <Disclosure
          title="Same prop, other contexts"
          summary={`${play.computed.season.over}/${play.computed.season.games} all season`}
          intro="The same line measured over the full season and, where there's a sample, in matching day/night and opposing-archetype spots."
        >
          <div className="space-y-1">
            {[
              { label: 'Season', split: play.computed.season },
              { label: 'Day / night match', split: play.computed.contextualDayNight },
              { label: 'Vs this archetype', split: play.computed.contextualArchetype },
            ].map(({ label, split }) => (
              <div key={label} className="flex items-center gap-2 py-0.5">
                <span className="w-[110px] shrink-0 truncate text-[11px] font-semibold text-foreground">
                  {label}
                </span>
                <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                  {split ? `${split.over}/${split.games}` : '—'}
                </span>
                <DivergingBar value={split?.pct != null ? split.pct - 50 : null} cap={25} />
                <span className="w-10 shrink-0 text-right text-[11px] font-bold tabular-nums text-foreground">
                  {split?.pct != null ? `${split.pct}%` : '—'}
                </span>
              </div>
            ))}
          </div>
        </Disclosure>
      </div>
    </WidgetCard>
  );
}

/** Card 2 — who's on the mound and what their anchor prop looks like. */
function StartersSection({
  item,
  awayArchetype,
  homeArchetype,
}: {
  item: PropMatchupFeedItem;
  awayArchetype: PitcherArchetypeProfile | null;
  homeArchetype: PitcherArchetypeProfile | null;
}) {
  const { game, away, home } = item;

  const starters = [
    {
      team: away,
      id: game.away_sp_id,
      name: game.away_sp_name,
      hand: game.away_sp_hand,
      archetype: awayArchetype,
    },
    {
      team: home,
      id: game.home_sp_id,
      name: game.home_sp_name,
      hand: game.home_sp_hand,
      archetype: homeArchetype,
    },
  ];

  return (
    <WidgetCard
      icon={<User />}
      title="Starting pitchers"
      subtitle="Tonight's two starters with their pitch hand, style, and the strikeout line the book has posted."
    >
      <div className="divide-y divide-black/5 dark:divide-white/10">
        {starters.map((sp) => {
          const play = item.plays.find((p) => p.playerId === sp.id) ?? null;
          return (
            <div key={sp.team.abbrev} className="flex items-center gap-2.5 py-2.5 first:pt-0 last:pb-0">
              <Headshot playerId={sp.id} size={38} alt={sp.name} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-center gap-1.5">
                  <TeamMark team={sp.team} size={16} />
                  <span className="truncate text-[13px] font-bold text-foreground">{sp.name}</span>
                  <span className="shrink-0 font-mono text-[10px] font-bold text-muted-foreground">
                    {sp.hand}HP
                  </span>
                </span>
                {play ? (
                  <span className="flex items-center gap-2 font-mono text-[10px] tabular-nums text-muted-foreground">
                    <span>
                      {play.marketLabel} O{formatPropLine(play.computed.line)}{' '}
                      {formatPropOdds(play.computed.overOdds)}
                    </span>
                    <span
                      className={cn(
                        'font-bold',
                        (play.l10Pct ?? 0) >= (play.impliedPct ?? 50)
                          ? 'text-emerald-600 dark:text-emerald-300'
                          : 'text-muted-foreground',
                      )}
                    >
                      {play.computed.l10.over}/{play.computed.l10.games}
                    </span>
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground">No prop posted</span>
                )}
              </div>
              <span className="flex shrink-0 items-center gap-1.5">
                {play && <LastTenStrip strip={play.computed.miniStrip} />}
                <ArchetypeChip archetype={sp.archetype} />
              </span>
            </div>
          );
        })}
      </div>
    </WidgetCard>
  );
}

/** Card 3 — does the venue and the air help or hurt run scoring tonight? */
function ConditionsSection({
  item,
  park,
}: {
  item: PropMatchupFeedItem;
  park: ParkHRFactors | null | undefined;
}) {
  const { game } = item;
  const wind = game.wind_speed_mph ?? 0;
  const windTone = windBannerTone(game.wind_direction);

  const factors = park
    ? [
        { label: 'Right-handed bats', value: park.rhb_hr_factor },
        { label: 'Left-handed bats', value: park.lhb_hr_factor },
      ]
    : [];

  return (
    <WidgetCard
      icon={<CloudSun />}
      title="Ballpark & conditions"
      subtitle="How this park treats home runs by batter hand, plus tonight's wind and temperature."
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {game.venue_name && (
            <span className="flex min-w-0 items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate font-semibold text-foreground">{game.venue_name}</span>
            </span>
          )}
          {park?.has_roof && (
            <Chip size="sm" variant="flat" classNames={{ content: 'text-[10px] font-bold' }}>
              Roof
            </Chip>
          )}
          {game.total_line != null && (
            <span className="tabular-nums">
              O/U <span className="font-bold text-foreground">{game.total_line}</span>
            </span>
          )}
          {game.away_ml != null && (
            <span className="tabular-nums">
              {item.away.abbrev} {formatMoneyline(game.away_ml)}
            </span>
          )}
          {game.home_ml != null && (
            <span className="tabular-nums">
              {item.home.abbrev} {formatMoneyline(game.home_ml)}
            </span>
          )}
        </div>

        {factors.length === 0 ? (
          <WidgetEmpty>No park factors on file for this venue.</WidgetEmpty>
        ) : (
          <div className="border-t border-black/5 pt-2 dark:border-white/10">
            <div className="flex items-center gap-2 pb-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/60">
              <span className="w-[104px] shrink-0">Home runs</span>
              <span className="min-w-0 flex-1 text-center">vs a neutral park</span>
              <span className="w-12 shrink-0 text-right">Factor</span>
            </div>
            {factors.map((f) => (
              <div key={f.label} className="flex items-center gap-2 py-1">
                <span className="w-[104px] shrink-0 truncate text-[11px] font-semibold text-foreground">
                  {f.label}
                </span>
                <DivergingBar value={f.value - 1} cap={PARK_FACTOR_CAP} />
                <span
                  className={cn(
                    'w-12 shrink-0 text-right text-[11px] font-bold tabular-nums',
                    f.value >= 1.05
                      ? 'text-emerald-600 dark:text-emerald-300'
                      : f.value <= 0.95
                        ? 'text-blue-600 dark:text-blue-300'
                        : 'text-muted-foreground',
                  )}
                >
                  {`${Math.round((f.value - 1) * 100) > 0 ? '+' : ''}${Math.round((f.value - 1) * 100)}%`}
                </span>
              </div>
            ))}
          </div>
        )}

        {wind >= 10 && (
          <LeanCallout>
            <span
              className={cn(
                'font-bold',
                windTone === 'warn'
                  ? 'text-emerald-600 dark:text-emerald-300'
                  : windTone === 'info'
                    ? 'text-blue-600 dark:text-blue-300'
                    : 'text-foreground',
              )}
            >
              {Math.round(wind)} mph {game.wind_direction ?? 'wind'}
            </span>
            {game.temperature_f != null ? ` at ${Math.round(game.temperature_f)}°F` : ''} — wind out
            helps the ball carry, wind in knocks it down
          </LeanCallout>
        )}
      </div>
    </WidgetCard>
  );
}

/**
 * Card 4 — what each starter actually throws. The legacy page buried this in a
 * per-pitcher accordion inside an accordion; the pitch mix is the single best
 * predictor of a strikeout prop, so it gets its own card.
 */
function ArsenalSection({
  item,
  awayArsenal,
  homeArsenal,
}: {
  item: PropMatchupFeedItem;
  awayArsenal: PitcherArsenalByHand | null | undefined;
  homeArsenal: PitcherArsenalByHand | null | undefined;
}) {
  const [side, setSide] = React.useState<'away' | 'home'>('away');

  const arsenal = side === 'away' ? awayArsenal : homeArsenal;
  const starterName = side === 'away' ? item.game.away_sp_name : item.game.home_sp_name;
  // The `A` bucket is "vs all batters" — the right default read for a game preview.
  const pitches = React.useMemo(() => getTopThreePitches(arsenal?.A ?? []), [arsenal]);

  return (
    <WidgetCard
      icon={<Target />}
      title="Starter arsenal"
      subtitle="The three pitches this starter throws most, how often he goes to them, and how often batters swing through them."
      accessory={
        <SegmentedControl
          layoutId={`mlb-arsenal-side-${item.gamePk}`}
          size="sm"
          options={[
            { value: 'away' as const, label: item.away.abbrev },
            { value: 'home' as const, label: item.home.abbrev },
          ]}
          value={side}
          onChange={(v) => setSide(v)}
        />
      }
    >
      {pitches.length === 0 ? (
        <WidgetEmpty>No pitch-level data on file for {starterName}.</WidgetEmpty>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 pb-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/60">
            <span className="w-[68px] shrink-0">Pitch</span>
            <span className="w-10 shrink-0 text-right">Velo</span>
            <span className="min-w-0 flex-1">Usage</span>
            <span className="w-12 shrink-0 text-right">Whiff</span>
          </div>
          <div className="divide-y divide-black/5 dark:divide-white/10">
            {pitches.map((pitch) => (
              <div key={pitch.pitch_type} className="flex items-center gap-2 py-1.5">
                <span className="w-[68px] shrink-0 truncate text-[11px] font-semibold text-foreground">
                  {abbrevPitchLabel(pitch.pitch_type, pitch.pitch_type_label)}
                </span>
                <span className="w-10 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                  {pitch.avg_velo != null ? pitch.avg_velo.toFixed(1) : '—'}
                </span>
                {/* Usage is a share of one pitcher's mix, so it fills from zero
                    rather than diverging from a midpoint. */}
                <span className="flex min-w-0 flex-1 items-center gap-1.5">
                  <span className="relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-sm bg-muted/60">
                    <span
                      className="absolute inset-y-0 left-0 rounded-sm bg-primary/80"
                      style={{ width: `${Math.min(pitch.usage_pct ?? 0, 100)}%` }}
                    />
                  </span>
                  <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
                    {pitch.usage_pct != null ? `${Math.round(pitch.usage_pct)}%` : '—'}
                  </span>
                </span>
                <span
                  className={cn(
                    'w-12 shrink-0 text-right text-[11px] font-bold tabular-nums',
                    pitch.whiff_pct == null
                      ? 'text-muted-foreground'
                      : pitch.whiff_pct >= 30
                        ? 'text-emerald-600 dark:text-emerald-300'
                        : 'text-muted-foreground',
                  )}
                >
                  {pitch.whiff_pct != null ? `${Math.round(pitch.whiff_pct)}%` : '—'}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[10px] leading-snug text-muted-foreground/80">
            A whiff rate at or above 30% is swing-and-miss stuff — the pitch that carries a
            strikeout prop.
          </p>
        </div>
      )}
    </WidgetCard>
  );
}

/** One paged batter row: slot, name, market, price, hit rate against the price. */
function PropRow({ play }: { play: PropPlay }) {
  const beatsPrice = (play.l10Pct ?? 0) >= (play.impliedPct ?? 50);
  const thin = play.computed.l10.games < MIN_PROP_GAMES;

  return (
    <div className="flex items-center gap-2 py-1.5" style={{ height: PROP_ROW_HEIGHT }}>
      <span className="w-4 shrink-0 text-right font-mono text-[10px] font-bold text-muted-foreground">
        {play.battingOrder ?? '—'}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[12px] font-semibold text-foreground">
          {play.playerName}
          {play.batSide && (
            <span className="ml-1 font-normal text-muted-foreground">({play.batSide})</span>
          )}
        </span>
        <span className="truncate font-mono text-[10px] tabular-nums text-muted-foreground">
          {play.marketLabel} O{formatPropLine(play.computed.line)}{' '}
          {formatPropOdds(play.computed.overOdds)}
        </span>
      </span>
      <LastTenStrip strip={play.computed.miniStrip} />
      <span
        className={cn(
          'w-14 shrink-0 text-right text-[11px] font-bold tabular-nums',
          thin ? 'text-muted-foreground' : beatsPrice ? 'text-emerald-600 dark:text-emerald-300' : 'text-red-600 dark:text-red-300',
        )}
      >
        {play.computed.l10.games === 0
          ? '—'
          : `${play.computed.l10.over}/${play.computed.l10.games}`}
      </span>
      <span
        className={cn(
          'w-12 shrink-0 text-right font-mono text-[11px] font-bold tabular-nums',
          play.edgePts === null
            ? 'text-muted-foreground'
            : play.edgePts >= 0
              ? 'text-emerald-600 dark:text-emerald-300'
              : 'text-red-600 dark:text-red-300',
        )}
      >
        {play.edgePts === null ? '—' : `${formatSigned(play.edgePts, 0)}%`}
      </span>
    </div>
  );
}

/**
 * Card 4 — every posted batter prop for one lineup at a time. The two lineups
 * are the same question at two scopes, so they share a card behind a segmented
 * control rather than stacking as two identical tables.
 */
function BatterPropsSection({ item }: { item: PropMatchupFeedItem }) {
  const [side, setSide] = React.useState<'away' | 'home'>('away');

  const batters = React.useMemo(
    () => item.plays.filter((p) => !p.isPitcher),
    [item.plays],
  );
  const visibleSide = React.useMemo(
    () =>
      batters
        .filter((p) => p.side === side)
        // Lineup order first when it's posted; unslotted bats fall to the end.
        .sort((a, b) => (a.battingOrder ?? 99) - (b.battingOrder ?? 99)),
    [batters, side],
  );

  const { page, setPage, pageCount, visible } = usePaged(visibleSide, PROP_ROWS_PER_PAGE);

  const beatingPrice = visibleSide.filter(
    (p) => p.edgePts !== null && p.edgePts > 0 && p.computed.l10.games >= MIN_PROP_GAMES,
  ).length;

  return (
    <WidgetCard
      icon={<Flame />}
      title="Batter props"
      subtitle="Every posted batter line for this lineup, with how often the player has cleared it recently against what the price needs."
      accessory={
        <SegmentedControl
          layoutId={`mlb-props-side-${item.gamePk}`}
          size="sm"
          options={[
            { value: 'away' as const, label: item.away.abbrev },
            { value: 'home' as const, label: item.home.abbrev },
          ]}
          value={side}
          // Wrapped rather than passed bare: a Dispatch<SetStateAction<T>> lets
          // T infer as a function type and collapses the generic to `string`.
          onChange={(v) => setSide(v)}
        />
      }
    >
      {visibleSide.length === 0 ? (
        <WidgetEmpty>
          {item.propsLoading
            ? 'Loading tonight’s posted props…'
            : `No batter props posted for ${side === 'away' ? item.away.abbrev : item.home.abbrev} yet.`}
        </WidgetEmpty>
      ) : (
        <div className="space-y-1.5">
          <p className="text-[10px] text-muted-foreground/80">
            <span className="font-bold text-foreground">{beatingPrice}</span> of{' '}
            {visibleSide.length} posted lines have cleared more often than their price implies.
          </p>
          <div className="flex items-center gap-2 pb-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/60">
            <span className="w-4 shrink-0" />
            <span className="min-w-0 flex-1">Player · line</span>
            <span className="w-[52px] shrink-0 text-center">Last 10</span>
            <span className="w-14 shrink-0 text-right">Cleared</span>
            <span className="w-12 shrink-0 text-right">vs price</span>
          </div>
          <div className="divide-y divide-black/5 dark:divide-white/10">
            {visible.map((play) => (
              <PropRow key={`${play.playerId}-${play.market}`} play={play} />
            ))}
          </div>
          {/* Padding lives outside the divide-y wrapper — inside it, blank rows
              would draw their own divider lines. */}
          <PageFiller count={PROP_ROWS_PER_PAGE - visible.length} height={PROP_ROW_HEIGHT} />
          <Pager
            pageCount={pageCount}
            page={page}
            onChange={setPage}
            label="Batter props pages"
          />
        </div>
      )}
    </WidgetCard>
  );
}

/** The widget stack for one game, in recommendation-then-evidence order. */
export function PitcherMatchupsSections({
  item,
  awayArchetype,
  homeArchetype,
  awayArsenal,
  homeArsenal,
  park,
}: {
  item: PropMatchupFeedItem;
  awayArchetype: PitcherArchetypeProfile | null;
  homeArchetype: PitcherArchetypeProfile | null;
  awayArsenal: PitcherArsenalByHand | null | undefined;
  homeArsenal: PitcherArsenalByHand | null | undefined;
  park: ParkHRFactors | null | undefined;
}) {
  return (
    <>
      <TopPlaySection item={item} />
      <StartersSection item={item} awayArchetype={awayArchetype} homeArchetype={homeArchetype} />
      <ArsenalSection item={item} awayArsenal={awayArsenal} homeArsenal={homeArsenal} />
      <ConditionsSection item={item} park={park} />
      <BatterPropsSection item={item} />
    </>
  );
}
