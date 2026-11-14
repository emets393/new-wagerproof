import * as React from 'react';
import { Chip } from '@heroui/react';
import { ArrowDown, ArrowUp, BarChart3, Check, CircleDollarSign, History, Sigma, Sparkles, TrendingUp, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetCard } from '@/components/ios';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { getEdgeInfo } from '../../edgeExplanations';
import {
  ModelEdgeRail,
  ModelVsMarketRow,
  MoneylineEdgeBar,
  NCAAB_EDGE_SCALE,
  SpreadCoverBar,
  moneylineOutcome,
} from '../../charts';
import { nbaSpreadHeadline, nbaTotalHeadline } from '../../headlines/nba';
import { TeamTrendsStrip } from '../cfb/FootballTeamTrends';
import {
  GameLevelSignalList,
  type SignalDefinition,
  type SlateFlag,
} from '../cfb/CfbSlateSections';
import { CollegeTeamMark, EmptyNote } from '../cfb/shared';
import {
  CARD_STACK,
  fmt1,
  fmtSigned1,
  Recommendation,
  round1,
  toNum,
} from '../nba/shared';
import { TrendRows, TrendsTeamHeader } from '../nba/TrendsTable';
import type { GameFeedItem, TeamRef } from '../../../types';
import type { NCAABPrediction } from '../../../api/ncaabGames';
import {
  EARLY_SEASON_NOTE,
  THRILL_EMPTY,
  awayResultLetter,
  fetchNcaabGameDetail,
  headToHeadSummary,
  ncaabPredictedScore,
  pointsLabel,
  spreadLabel,
  type FiredSignal,
  type H2HCount,
  type ModelLine,
  type NcaabGameDetail,
  type NcaabH2HGame,
  type NcaabHeadToHead,
} from './ncaabDetail';

export function useNcaabGameDetail(game: GameFeedItem) {
  const raw = game.raw as NCAABPrediction;
  const gameId = Number(raw?.id || game.id);
  const [detail, setDetail] = React.useState<NcaabGameDetail | null>(null);
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>('loading');

  React.useEffect(() => {
    let cancel = false;
    setStatus('loading');
    setDetail(null);
    fetchNcaabGameDetail({
      gameId,
      gameDate: game.gameDate,
      homeName: game.homeTeam.name,
      awayName: game.awayTeam.name,
      homeTeamId: raw?.home_team_id,
      awayTeamId: raw?.away_team_id,
    })
      .then((next) => {
        if (cancel) return;
        setDetail(next);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancel) setStatus('error');
      });
    return () => {
      cancel = true;
    };
  }, [gameId, game.gameDate, game.homeTeam.name, game.awayTeam.name, raw?.home_team_id, raw?.away_team_id]);

  return { detail, status };
}

const SPREAD_SUBTITLE =
  "Which side the model would lay or take points with, and how far its line sits from the book's.";
const TOTAL_SUBTITLE =
  'How many points the model expects versus the posted total, and which way that leans.';
const PASS_NOTE = 'Outside the bet band, so this is the model against the book, not a play.';

function marketKey(raw: string): string {
  const key = raw.toLowerCase().trim();
  if (key === 'ml' || key === 'money_line') return 'moneyline';
  if (key === 'h1_ou' || key === 'h1_over_under') return 'h1_total';
  if (key === 'ou' || key === 'over_under') return 'total';
  if (key.startsWith('team_total') || key === 'tt') return 'team_total';
  return key;
}

function flagsFor(signals: FiredSignal[], market: string): SlateFlag[] {
  return signals
    .filter((signal) => marketKey(signal.market) === market)
    .map((signal) => ({
      signal_key: signal.key,
      market: signal.market,
      side: signal.side,
      tier: signal.play ? 'active' : 'tracking',
    }));
}

function defsFor(signals: FiredSignal[]): Record<string, SignalDefinition> {
  const defs: Record<string, SignalDefinition> = {};
  for (const signal of signals) {
    defs[signal.key] = {
      signal_key: signal.key,
      display_name: signal.name,
      definition: signal.trigger || null,
      record_text: signal.record || null,
      season_record_text: signal.seasonRecord || null,
    };
  }
  return defs;
}

function totalHeadline(model: number, market: number, isOver: boolean, magnitude: number): string {
  const written = nbaTotalHeadline({ modelTotal: model, marketTotal: market, isOver, magnitude });
  if (written) return written;
  const dir = isOver ? 'OVER' : 'UNDER';
  if (magnitude === 0) return `Model's ${model.toFixed(1)} lands right on the posted ${market.toFixed(1)} — no total edge.`;
  return `Model projects ${model.toFixed(1)} vs the posted ${market.toFixed(1)} — a ${magnitude.toFixed(1)}-point lean ${dir}.`;
}

function TrendFooter({
  game,
  detail,
  cardGroup,
}: {
  game: GameFeedItem;
  detail: NcaabGameDetail;
  cardGroup: 'spread' | 'total' | 'moneyline' | 'team_total' | 'h1_spread' | 'h1_total';
}) {
  return (
    <TeamTrendsStrip
      cardGroup={cardGroup}
      away={game.awayTeam}
      home={game.homeTeam}
      trendsByKey={detail.trendsByKey}
      sport="cfb"
    />
  );
}

function MarketSignals({
  game,
  detail,
  market,
}: {
  game: GameFeedItem;
  detail: NcaabGameDetail;
  market: string;
}) {
  const flags = flagsFor(detail.signals, market);
  if (flags.length === 0) return null;
  return (
    <GameLevelSignalList
      flags={flags}
      away={game.awayTeam}
      home={game.homeTeam}
      signalDefs={defsFor(detail.signals)}
      signalPerformance={{}}
      showLifecycleRecords
      listTitle="Pick Signals"
    />
  );
}

function SpreadBody({
  game,
  line,
  marketLabel,
}: {
  game: GameFeedItem;
  line: ModelLine;
  marketLabel: string;
}) {
  const margin = line.modelMargin;
  const vegasHome = line.marketSpread;
  const fairHome = margin === null ? null : -margin;
  const homeSpreadDiff =
    vegasHome !== null && fairHome !== null
      ? vegasHome - fairHome
      : line.disagreementPts;
  const edgeInfo = getEdgeInfo(homeSpreadDiff, game.awayTeam.name, game.homeTeam.name);
  if (!edgeInfo || margin === null || vegasHome === null) {
    return <EmptyNote>{line.disagreement || 'No line posted.'}</EmptyNote>;
  }

  const pickIsHome = edgeInfo.isHomeEdge;
  const pickTeam = pickIsHome ? game.homeTeam : game.awayTeam;
  const modelLine = round1(pickIsHome ? fairHome! : -fairHome!);
  const marketLine = round1(pickIsHome ? vegasHome : -vegasHome);
  const edgePts = round1(marketLine - modelLine);

  return (
    <div className={CARD_STACK}>
      <Recommendation
        market={line.play ? marketLabel : 'Projection'}
        pick={`${pickTeam.abbrev} ${fmtSigned1(marketLine)}`}
        team={pickTeam}
        edge={`+${Math.abs(edgePts).toFixed(1)}`}
        edgeIcon={<TrendingUp className="h-3.5 w-3.5" />}
      />
      <SpreadCoverBar
        line={marketLine}
        modelMargin={-modelLine}
        scale={NCAAB_EDGE_SCALE}
        pickAbbrev={pickTeam.abbrev}
        opponentAbbrev={(pickIsHome ? game.awayTeam : game.homeTeam).abbrev}
      />
    </div>
  );
}

function TotalBody({ line, marketLabel }: { line: ModelLine; marketLabel: string }) {
  const modelRaw = line.modelTotal;
  const marketRaw = line.marketTotal;
  if (modelRaw === null || marketRaw === null) {
    return <EmptyNote>{line.disagreement || 'No line posted.'}</EmptyNote>;
  }
  const overLineDiff = line.disagreementPts ?? modelRaw - marketRaw;
  const modelTotal = round1(modelRaw);
  const marketTotal = round1(marketRaw);
  const gap = round1(modelTotal - marketTotal);
  const isOver = overLineDiff > 0;
  const magnitude = Math.abs(gap);
  const railAgreesWithPick = gap === 0 || gap > 0 === isOver;

  return (
    <div className={CARD_STACK}>
      <Recommendation
        market={marketLabel}
        pick={isOver ? 'OVER' : 'UNDER'}
        tone={isOver ? 'over' : 'under'}
        edge={`+${magnitude.toFixed(1)}`}
        edgeIcon={isOver ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
      />
      {railAgreesWithPick ? (
        <ModelEdgeRail market={marketTotal} model={modelTotal} scale={NCAAB_EDGE_SCALE} format={(v) => fmt1(v)} />
      ) : (
        <ModelVsMarketRow
          model={fmt1(modelTotal)}
          market={fmt1(marketTotal)}
          gapDisplay={`${gap > 0 ? '+' : ''}${gap.toFixed(1)}`}
          gapUnit="pts"
          tone={isOver ? 'over' : 'under'}
          lean={`Model projects ${magnitude.toFixed(1)} points ${isOver ? 'more' : 'fewer'} than the posted total.`}
        />
      )}
    </div>
  );
}

function spreadHeadline(game: GameFeedItem, line: ModelLine): string | undefined {
  const margin = line.modelMargin;
  const vegasHome = line.marketSpread;
  if (margin === null || vegasHome === null) return undefined;
  const fairHome = -margin;
  const pickIsHome = (line.disagreementPts ?? vegasHome - fairHome) > 0;
  const modelLine = round1(pickIsHome ? fairHome : -fairHome);
  const marketLine = round1(pickIsHome ? vegasHome : -vegasHome);
  return (
    nbaSpreadHeadline({
      pickAbbrev: (pickIsHome ? game.homeTeam : game.awayTeam).abbrev,
      modelLine,
      marketLine,
      edgePts: round1(Math.abs(marketLine - modelLine)),
    }) ?? undefined
  );
}

function SpreadCard({
  game,
  detail,
  line,
  title,
  cardGroup,
}: {
  game: GameFeedItem;
  detail: NcaabGameDetail;
  line: ModelLine;
  title: string;
  cardGroup: 'spread' | 'h1_spread';
}) {
  const hasNumbers = line.modelMargin !== null && line.marketSpread !== null;
  return (
    <WidgetCard
      icon={<CircleDollarSign />}
      title={title}
      headline={hasNumbers ? spreadHeadline(game, line) : undefined}
      subtitle={line.play ? SPREAD_SUBTITLE : `${SPREAD_SUBTITLE} ${PASS_NOTE}`}
      accessory={
        line.play ? (
          <Chip size="sm" variant="flat" color="primary" classNames={{ content: 'text-[11px] font-semibold' }}>
            Play
          </Chip>
        ) : undefined
      }
    >
      {hasNumbers ? <SpreadBody game={game} line={line} marketLabel={title} /> : <EmptyNote>No line posted.</EmptyNote>}
      <MarketSignals game={game} detail={detail} market={cardGroup} />
      <TrendFooter game={game} detail={detail} cardGroup={cardGroup} />
    </WidgetCard>
  );
}

function TotalCard({
  game,
  detail,
  line,
  title,
  cardGroup,
  trackingOnly,
}: {
  game: GameFeedItem;
  detail: NcaabGameDetail;
  line: ModelLine;
  title: string;
  cardGroup: 'total' | 'h1_total';
  trackingOnly?: boolean;
}) {
  const model = line.modelTotal === null ? null : round1(line.modelTotal);
  const market = line.marketTotal === null ? null : round1(line.marketTotal);
  const gap = model !== null && market !== null ? round1(model - market) : null;
  const isOver = (line.disagreementPts ?? gap ?? 0) > 0;
  return (
    <WidgetCard
      icon={<Sigma />}
      title={title}
      headline={
        model !== null && market !== null && gap !== null
          ? totalHeadline(model, market, isOver, Math.abs(gap))
          : undefined
      }
      subtitle={
        trackingOnly
          ? 'Tracking only. The first-half total is never a bet.'
          : `${TOTAL_SUBTITLE} Not a bet.`
      }
    >
      {model !== null && market !== null ? (
        <TotalBody line={line} marketLabel={title} />
      ) : (
        <EmptyNote>No line posted.</EmptyNote>
      )}
      <MarketSignals game={game} detail={detail} market={cardGroup} />
      <TrendFooter game={game} detail={detail} cardGroup={cardGroup} />
    </WidgetCard>
  );
}

function MoneylineCard({ game, detail }: { game: GameFeedItem; detail: NcaabGameDetail }) {
  const raw = game.raw as NCAABPrediction;
  const homeProb = toNum(raw.home_away_ml_prob);
  const usable = homeProb !== null && homeProb > 0 && homeProb < 1;
  const pickIsHome = !usable || homeProb! >= 0.5;
  const probability = usable ? (pickIsHome ? homeProb! : 1 - homeProb!) : null;
  const price = toNum(pickIsHome ? raw.home_ml : raw.away_ml);
  const team = pickIsHome ? game.homeTeam : game.awayTeam;
  const canChart = probability !== null && price !== null && Math.abs(price) >= 100;
  const outcome = canChart ? moneylineOutcome(price!, probability!, NCAAB_EDGE_SCALE) : null;

  return (
    <WidgetCard
      icon={<CircleDollarSign />}
      title="Moneyline"
      headline={
        outcome
          ? `Model gives ${team.abbrev} a ${(probability! * 100).toFixed(1)}% chance. The price needs ${outcome.breakEvenPercent.toFixed(1)}% to break even.`
          : undefined
      }
      subtitle="Win probability set against the posted price."
    >
      {outcome && probability !== null ? (
        <div className={CARD_STACK}>
          <Recommendation
            market="Moneyline"
            pick={team.abbrev}
            team={team}
            edge={`${outcome.edge > 0 ? '+' : ''}${outcome.edge.toFixed(1)}`}
            edgeIcon={<TrendingUp className="h-3.5 w-3.5" />}
          />
          <MoneylineEdgeBar
            price={price!}
            modelProbability={probability}
            scale={NCAAB_EDGE_SCALE}
            teamAbbrev={team.abbrev}
          />
        </div>
      ) : (
        <EmptyNote>No moneyline price posted.</EmptyNote>
      )}
      <MarketSignals game={game} detail={detail} market="moneyline" />
      <TrendFooter game={game} detail={detail} cardGroup="moneyline" />
    </WidgetCard>
  );
}

function TeamTotalCard({ game, detail }: { game: GameFeedItem; detail: NcaabGameDetail }) {
  return (
    <WidgetCard
      icon={<Trophy />}
      title="Team Total"
      subtitle="Season record and last five for each team's own total."
    >
      <MarketSignals game={game} detail={detail} market="team_total" />
      <TrendFooter game={game} detail={detail} cardGroup="team_total" />
    </WidgetCard>
  );
}

export function NcaabMarketCards({
  game,
  detail,
  status,
}: {
  game: GameFeedItem;
  detail: NcaabGameDetail | null;
  status: 'loading' | 'ready' | 'error';
}) {
  if (status === 'loading') {
    return (
      <>
        <WidgetCard icon={<CircleDollarSign />} title="Spread" subtitle={SPREAD_SUBTITLE}>
          <Skeleton className="h-24 w-full" />
        </WidgetCard>
        <WidgetCard icon={<Sigma />} title="Total" subtitle={TOTAL_SUBTITLE}>
          <Skeleton className="h-24 w-full" />
        </WidgetCard>
      </>
    );
  }

  if (status === 'error' || !detail) {
    return (
      <WidgetCard icon={<CircleDollarSign />} title="Spread" subtitle={SPREAD_SUBTITLE} className="@xl:col-span-2">
        <Alert>
          <AlertDescription>Could not load this game.</AlertDescription>
        </Alert>
      </WidgetCard>
    );
  }

  const spread = detail.fullGame.find((line) => line.market === 'spread');
  const total = detail.fullGame.find((line) => line.market === 'total');
  const h1Spread = detail.firstHalf.find((line) => line.market === 'h1_spread');
  const h1Total = detail.firstHalf.find((line) => line.market === 'h1_total');

  return (
    <>
      {spread && <SpreadCard game={game} detail={detail} line={spread} title="Spread" cardGroup="spread" />}
      <MoneylineCard game={game} detail={detail} />
      {total && <TotalCard game={game} detail={detail} line={total} title="Total" cardGroup="total" />}
      {h1Spread && (
        <SpreadCard game={game} detail={detail} line={h1Spread} title="1H Spread" cardGroup="h1_spread" />
      )}
      {h1Total && (
        <TotalCard
          game={game}
          detail={detail}
          line={h1Total}
          title="1H Total"
          cardGroup="h1_total"
          trackingOnly
        />
      )}
      <TeamTotalCard game={game} detail={detail} />
    </>
  );
}

export function NcaabTeamStatsSection({
  game,
  detail,
}: {
  game: GameFeedItem;
  detail: NcaabGameDetail | null;
}) {
  if (!detail) return null;
  return (
    <WidgetCard
      icon={<BarChart3 />}
      title="Team Stats"
      subtitle={
        detail.earlySeason
          ? EARLY_SEASON_NOTE
          : 'Which side is the better team on the season ratings.'
      }
      className="@xl:col-span-2"
    >
      <TrendsTeamHeader awayTeam={game.awayTeam} homeTeam={game.homeTeam} />
      {(detail.awayRecord || detail.homeRecord) && (
        <p className="mb-2 text-[11px] tabular-nums text-muted-foreground">
          {game.awayTeam.abbrev} {detail.awayRecord ?? '—'} · {game.homeTeam.abbrev} {detail.homeRecord ?? '—'}
        </p>
      )}
      <TrendRows awayTeam={game.awayTeam} homeTeam={game.homeTeam} rows={detail.ratingRows} />
    </WidgetCard>
  );
}

export function NcaabThrillSection({ detail }: { detail: NcaabGameDetail | null }) {
  if (!detail) return null;
  const thrill = detail.thrill;
  return (
    <WidgetCard
      icon={<Sparkles />}
      title="Thrill score"
      subtitle="How watchable the game projects to be."
    >
      {thrill ? (
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold tabular-nums tracking-tight text-foreground">
            {Math.round(thrill.score)}
          </span>
          <span className="text-[13px] text-muted-foreground">
            {[thrill.projected, thrill.winChance, thrill.tempo].filter(Boolean).join(' · ')}
          </span>
        </div>
      ) : (
        <p className="text-[13px] leading-relaxed text-muted-foreground">{THRILL_EMPTY}</p>
      )}
    </WidgetCard>
  );
}

type H2HTabId =
  | 'spread'
  | 'total'
  | 'moneyline'
  | 'h1_spread'
  | 'h1_total'
  | 'h1_moneyline'
  | 'team_total';

const H2H_TABS: {
  id: H2HTabId;
  label: string;
  kind: 'ats' | 'wins' | 'total';
  shared: boolean;
  half: boolean;
  count: (series: NcaabHeadToHead) => H2HCount;
  line: (game: NcaabH2HGame) => number | null;
  lineKind: 'spread' | 'total' | 'ml';
  letter: (game: NcaabH2HGame) => string | null;
}[] = [
  {
    id: 'spread',
    label: 'Spread',
    kind: 'ats',
    shared: false,
    half: false,
    count: (series) => series.spread,
    line: (game) => game.spread,
    lineKind: 'spread',
    letter: (game) => game.ats,
  },
  {
    id: 'total',
    label: 'Total',
    kind: 'total',
    shared: true,
    half: false,
    count: (series) => series.total,
    line: (game) => game.total,
    lineKind: 'total',
    letter: (game) => game.ou,
  },
  {
    id: 'moneyline',
    label: 'Moneyline',
    kind: 'wins',
    shared: false,
    half: false,
    count: (series) => series.moneyline,
    line: (game) => game.ml,
    lineKind: 'ml',
    letter: (game) => game.su,
  },
  {
    id: 'h1_spread',
    label: '1H Spread',
    kind: 'ats',
    shared: false,
    half: true,
    count: (series) => series.h1_spread,
    line: (game) => game.h1_spread,
    lineKind: 'spread',
    letter: (game) => game.h1_ats,
  },
  {
    id: 'h1_total',
    label: '1H Total',
    kind: 'total',
    shared: true,
    half: true,
    count: (series) => series.h1_total,
    line: (game) => game.h1_total,
    lineKind: 'total',
    letter: (game) => game.h1_ou,
  },
  {
    id: 'h1_moneyline',
    label: '1H Moneyline',
    kind: 'wins',
    shared: false,
    half: true,
    count: (series) => series.h1_moneyline,
    line: (game) => game.h1_ml,
    lineKind: 'ml',
    letter: (game) => game.h1_su,
  },
  {
    id: 'team_total',
    label: 'Team Total',
    kind: 'total',
    shared: true,
    half: false,
    count: (series) => series.team_total,
    line: (game) => game.tt_line,
    lineKind: 'total',
    letter: (game) => game.tt,
  },
];

function formatMeetingDate(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function venueLabel(game: NcaabH2HGame): string {
  const place = game.neutral ? 'Neutral' : game.is_home ? 'Home' : 'Away';
  return game.tournament ? `${place} · ${game.tournament}` : place;
}

function formatMarketLine(value: number | null, kind: 'spread' | 'total' | 'ml'): string {
  if (value === null) return '—';
  if (kind === 'spread') return spreadLabel(value);
  if (kind === 'ml') {
    const rounded = Math.round(value);
    return rounded > 0 ? `+${rounded}` : String(rounded);
  }
  return pointsLabel(value);
}

function resultChipClass(letter: string): string {
  if (letter === 'W' || letter === 'O') return 'bg-emerald-600 text-white';
  if (letter === 'L' || letter === 'U') return 'bg-red-600 text-white';
  if (letter === 'P') return 'bg-muted-foreground/70 text-white';
  return 'bg-muted text-muted-foreground';
}

function ResultChip({ letter }: { letter: string | null }) {
  if (!letter) {
    return <span className="text-[11px] font-semibold text-muted-foreground">—</span>;
  }
  return (
    <span
      className={cn(
        'flex h-[17px] w-[17px] items-center justify-center rounded-full text-[8px] font-black',
        resultChipClass(letter),
      )}
    >
      {letter}
    </span>
  );
}

function ScoreSide({
  team,
  name,
  score,
  won,
}: {
  team: GameFeedItem['homeTeam'];
  name: string;
  score: number | null;
  won: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <CollegeTeamMark team={team} size={20} />
      <span className={cn('text-[12px]', won ? 'font-bold text-foreground' : 'font-semibold text-muted-foreground')}>
        {name}
      </span>
      <span
        className={cn(
          'text-[14px] tabular-nums',
          won ? 'font-bold text-foreground' : 'font-semibold text-muted-foreground',
        )}
      >
        {score ?? '—'}
      </span>
    </span>
  );
}

function MeetingRow({
  game,
  home,
  away,
  tab,
}: {
  game: NcaabH2HGame;
  home: GameFeedItem['homeTeam'];
  away: GameFeedItem['awayTeam'];
  tab: (typeof H2H_TABS)[number];
}) {
  const homeScore = tab.half ? game.h1_team_pts : game.team_pts;
  const awayScore = tab.half ? game.h1_opp_pts : game.opp_pts;
  const decided = homeScore !== null && awayScore !== null && homeScore !== awayScore;
  const homeWon = decided && homeScore > awayScore;
  const awayWon = decided && awayScore > homeScore;
  const homeLetter = tab.letter(game);
  const awayLetter = awayResultLetter(homeLetter, tab.shared);
  const joiner = game.neutral ? 'vs' : '@';
  const listedHome = game.neutral || game.is_home;

  return (
    <div className="rounded-xl border border-black/5 bg-black/[0.02] p-3 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold text-muted-foreground">{formatMeetingDate(game.date)}</span>
        <span className="text-[9px] font-bold uppercase text-sky-600 dark:text-sky-400">{venueLabel(game)}</span>
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {listedHome ? (
          <>
            <ScoreSide team={away} name={away.name} score={awayScore} won={awayWon} />
            <span className="text-[12px] font-bold text-muted-foreground">{joiner}</span>
            <ScoreSide team={home} name={home.name} score={homeScore} won={homeWon} />
          </>
        ) : (
          <>
            <ScoreSide team={home} name={home.name} score={homeScore} won={homeWon} />
            <span className="text-[12px] font-bold text-muted-foreground">{joiner}</span>
            <ScoreSide team={away} name={away.name} score={awayScore} won={awayWon} />
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">
          {tab.label} {formatMarketLine(tab.line(game), tab.lineKind)}
        </span>
        <span className="ml-auto inline-flex items-center gap-2">
          <span className="inline-flex items-center gap-1">
            <span className="text-[10px] font-bold text-muted-foreground">{away.abbrev}</span>
            <ResultChip letter={awayLetter} />
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="text-[10px] font-bold text-muted-foreground">{home.abbrev}</span>
            <ResultChip letter={homeLetter} />
          </span>
        </span>
      </div>
    </div>
  );
}

/**
 * Prior meetings from the home team's matchup entry. A display record, never a pick.
 */
export function NcaabHeadToHeadSection({
  game,
  detail,
  status,
}: {
  game: GameFeedItem;
  detail: NcaabGameDetail | null;
  status: 'loading' | 'ready' | 'error';
}) {
  const [tabId, setTabId] = React.useState<H2HTabId>('spread');
  const series = detail?.headToHead;
  const meetings = series?.meetings ?? 0;
  const tab = H2H_TABS.find((item) => item.id === tabId) ?? H2H_TABS[0];

  if (status === 'error') return null;

  return (
    <WidgetCard
      icon={<History />}
      title={meetings > 0 ? `Head-to-Head · last ${meetings} meetings` : 'Head-to-Head'}
      subtitle="Prior meetings between these teams."
      className="@xl:col-span-2"
    >
      {status === 'loading' || !series ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : meetings === 0 ? (
        <p className="text-[13px] leading-relaxed text-muted-foreground">First meeting since 2020-21</p>
      ) : (
        <>
          <div role="tablist" aria-label="Head-to-head market" className="flex flex-wrap gap-1.5">
            {H2H_TABS.map((item) => {
              const selected = item.id === tab.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setTabId(item.id)}
                  className={cn(
                    'rounded-full px-2.5 py-1 text-[11px] font-semibold',
                    selected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-black/[0.04] text-muted-foreground dark:bg-white/10',
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-[13px] font-semibold text-foreground">
            {headToHeadSummary(tab.count(series), tab.kind, game.homeTeam.name, game.awayTeam.name)}
          </p>
          <div className="mt-3 space-y-2">
            {series.games.map((meeting, index) => (
              <MeetingRow
                key={meeting.cbbd_id ?? `${meeting.date}-${index}`}
                game={meeting}
                home={game.homeTeam}
                away={game.awayTeam}
                tab={tab}
              />
            ))}
          </div>
        </>
      )}
    </WidgetCard>
  );
}

/**
 * Projected final, shown open under the header the way the football slate
 * summary does. Same divided bar: the projected winner stays full strength.
 */
export function NcaabScorePredictionSection({ game }: { game: GameFeedItem }) {
  const score = ncaabPredictedScore(game.raw as NCAABPrediction);
  const homeWins = score !== null && score.home >= score.away;

  return (
    <WidgetCard
      icon={<Trophy />}
      title="Score Prediction"
      subtitle="The final the model projects."
      className="@xl:col-span-2"
    >
      {score ? (
        <ProjectedFinal
          away={game.awayTeam}
          home={game.homeTeam}
          awayScore={score.away}
          homeScore={score.home}
          homeWins={homeWins}
        />
      ) : (
        <EmptyNote>No projected score for this game yet.</EmptyNote>
      )}
    </WidgetCard>
  );
}

function ProjectedFinal({
  away,
  home,
  awayScore,
  homeScore,
  homeWins,
}: {
  away: TeamRef;
  home: TeamRef;
  awayScore: number;
  homeScore: number;
  homeWins: boolean;
}) {
  const total = awayScore + homeScore;
  const awayShare = total > 0 ? (awayScore / total) * 100 : 50;
  const homeShare = 100 - awayShare;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <CollegeTeamMark team={away} size={28} dimmed={homeWins} />
          <span className={cn('text-lg font-bold tabular-nums', homeWins ? 'text-muted-foreground' : 'text-foreground')}>
            {away.abbrev} {awayScore.toFixed(1)}
          </span>
          {!homeWins && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          {homeWins && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
          <span className={cn('text-lg font-bold tabular-nums', homeWins ? 'text-foreground' : 'text-muted-foreground')}>
            {homeScore.toFixed(1)} {home.abbrev}
          </span>
          <CollegeTeamMark team={home} size={28} dimmed={!homeWins} />
        </span>
      </div>
      <div
        className="flex h-2.5 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`Projected ${away.abbrev} ${awayScore.toFixed(1)}, ${home.abbrev} ${homeScore.toFixed(1)}`}
      >
        <div
          style={{ width: `${awayShare}%`, backgroundColor: away.colors.primary }}
          className={cn('transition-opacity', homeWins && 'opacity-35')}
        />
        <div
          style={{ width: `${homeShare}%`, backgroundColor: home.colors.primary }}
          className={cn('transition-opacity', !homeWins && 'opacity-35')}
        />
      </div>
    </div>
  );
}
