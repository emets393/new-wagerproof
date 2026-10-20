import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, CircleDollarSign, Sigma, TrendingUp } from 'lucide-react';
import { WidgetCard } from '@/components/ios';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import debug from '@/utils/debug';
import { getEdgeInfo } from '../../edgeExplanations';
import { ModelEdgeRail, ModelVsMarketRow, NBA_EDGE_SCALE, SpreadCoverBar } from '../../charts';
import { nbaSpreadHeadline, nbaTotalHeadline } from '../../headlines/nba';
import {
  CARD_STACK,
  fmt1,
  fmtSigned1,
  OverUnderPickRow,
  Recommendation,
  round1,
  SpreadPickRow,
  toNum,
} from './shared';
import type { NBAPrediction, NbaH1Row } from '../../../api/nbaGames';
import type { GameFeedItem } from '../../../types';

/**
 * First-half spread and total from nba_model_preds_h1.
 * The spread card is the full-game spread card. The total card is the full-game
 * total card, and it stays tracking-only: its tier is never a bet.
 */
export function NbaFirstHalfSection({ game }: { game: GameFeedItem }) {
  const raw = game.raw as unknown as NBAPrediction;
  const attached = raw.nba_h1;
  const [fetched, setFetched] = useState<NbaH1Row[] | null>(attached && attached.length > 0 ? attached : null);

  useEffect(() => {
    if (attached && attached.length > 0) {
      setFetched(attached);
      return;
    }
    const gameId = raw.game_id;
    const date = String(raw.game_date || '').slice(0, 10);
    const home = game.homeTeam.abbrev;
    const away = game.awayTeam.abbrev;
    if (!gameId && (!date || !home || !away)) return;
    let cancelled = false;
    const columns = 'market, model_home_margin, model_total, market_home_spread, market_total, disagreement, tier, game_id, home_abbr, away_abbr, game_date';
    const request = gameId
      ? collegeFootballSupabase.from('nba_model_preds_h1').select(columns).eq('game_id', gameId)
      : collegeFootballSupabase.from('nba_model_preds_h1').select(columns).eq('game_date', date).eq('home_abbr', home).eq('away_abbr', away);
    request.then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        debug.warn('nba_model_preds_h1 error:', error.message);
        setFetched([]);
        return;
      }
      setFetched((data || []) as NbaH1Row[]);
    });
    return () => {
      cancelled = true;
    };
  }, [attached, raw.game_date, raw.game_id, game.homeTeam.abbrev, game.awayTeam.abbrev]);

  const rows = attached && attached.length > 0 ? attached : fetched;
  if (!rows || rows.length === 0) return null;

  const spread = rows.find((row) => row.market === 'h1_spread');
  const total = rows.find((row) => row.market === 'h1_total');

  return (
    <>
      {spread && <FirstHalfSpread game={game} row={spread} />}
      {total && <FirstHalfTotal row={total} />}
    </>
  );
}

/** Same body as NbaSpreadSection. Home spread is the negated first-half margin. */
function FirstHalfSpread({ game, row }: { game: GameFeedItem; row: NbaH1Row }) {
  const raw = game.raw as unknown as NBAPrediction;
  const margin = toNum(row.model_home_margin);
  const vegasHomeSpread = toNum(row.market_home_spread);
  const predSpread = margin === null ? null : -margin;
  const homeSpreadDiff =
    vegasHomeSpread !== null && predSpread !== null ? vegasHomeSpread - predSpread : null;

  const edgeInfo = getEdgeInfo(homeSpreadDiff, raw.away_team, raw.home_team);
  if (!edgeInfo) return null;

  const pickIsHome = edgeInfo.isHomeEdge;
  const pickTeam = pickIsHome ? game.homeTeam : game.awayTeam;
  const modelLine = predSpread === null ? null : round1(pickIsHome ? predSpread : -predSpread);
  const marketLine =
    vegasHomeSpread === null ? null : round1(pickIsHome ? vegasHomeSpread : -vegasHomeSpread);
  const derivedEdge =
    modelLine !== null && marketLine !== null ? round1(marketLine - modelLine) : null;
  const edgePts = derivedEdge ?? round1(Math.abs(homeSpreadDiff as number));
  const awayLine = vegasHomeSpread === null ? '—' : fmtSigned1(round1(-vegasHomeSpread));
  const homeLine = vegasHomeSpread === null ? '—' : fmtSigned1(round1(vegasHomeSpread));

  return (
    <WidgetCard
      icon={<CircleDollarSign />}
      title="1H Spread"
      headline={nbaSpreadHeadline({
        pickAbbrev: pickTeam.abbrev,
        modelLine,
        marketLine,
        edgePts,
      }) ?? undefined}
      subtitle="Which side the model would lay or take points with, and how far its line sits from the book's."
    >
      <div className={CARD_STACK}>
        <Recommendation
          market="1H Spread"
          pick={`${pickTeam.abbrev} ${marketLine !== null ? fmtSigned1(marketLine) : ''}`.trim()}
          team={pickTeam}
          edge={`+${edgePts.toFixed(1)}`}
          edgeIcon={<TrendingUp className="h-3.5 w-3.5" />}
        />
        <SpreadPickRow
          awayTeam={game.awayTeam}
          homeTeam={game.homeTeam}
          awayLine={awayLine}
          homeLine={homeLine}
          pickIsHome={pickIsHome}
        />
        {modelLine !== null && marketLine !== null && (
          <SpreadCoverBar
            line={marketLine}
            modelMargin={-modelLine}
            scale={NBA_EDGE_SCALE}
            pickAbbrev={pickTeam.abbrev}
            opponentAbbrev={(pickIsHome ? game.awayTeam : game.homeTeam).abbrev}
          />
        )}
      </div>
    </WidgetCard>
  );
}

/** Same body as NbaTotalSection. First-half totals are tracking, never a bet. */
function FirstHalfTotal({ row }: { row: NbaH1Row }) {
  const modelRaw = toNum(row.model_total);
  const marketRaw = toNum(row.market_total);
  if (modelRaw === null || marketRaw === null) return null;

  const overLineDiff = modelRaw - marketRaw;
  const modelTotal = round1(modelRaw);
  const marketTotal = round1(marketRaw);
  const gap = round1(modelTotal - marketTotal);
  const isOver = overLineDiff > 0;
  const magnitude = Math.abs(gap);
  const railAgreesWithPick = gap === 0 || gap > 0 === isOver;

  return (
    <WidgetCard
      icon={<Sigma />}
      title="1H Total"
      headline={nbaTotalHeadline({ modelTotal, marketTotal, isOver, magnitude }) ?? undefined}
      subtitle="Tracking only. The first-half total is never a bet."
    >
      <div className={CARD_STACK}>
        <Recommendation
          market="1H Total"
          pick={isOver ? 'OVER' : 'UNDER'}
          tone={isOver ? 'over' : 'under'}
          edge={`+${magnitude.toFixed(1)}`}
          edgeIcon={isOver ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
        />
        <OverUnderPickRow isOver={isOver} />
        {railAgreesWithPick ? (
          <ModelEdgeRail
            market={marketTotal}
            model={modelTotal}
            scale={NBA_EDGE_SCALE}
            format={(v) => fmt1(v)}
          />
        ) : (
          <ModelVsMarketRow
            model={fmt1(modelTotal)}
            market={fmt1(marketTotal)}
            gapDisplay={`${gap > 0 ? '+' : ''}${gap.toFixed(1)}`}
            gapUnit="pts"
            tone={isOver ? 'over' : 'under'}
            lean={
              <>
                Model projects{' '}
                <span className="font-bold text-foreground">
                  {magnitude.toFixed(1)} points {isOver ? 'more' : 'fewer'}
                </span>{' '}
                than the posted total, but the model&apos;s own direction column says{' '}
                {isOver ? 'OVER' : 'UNDER'}
              </>
            }
          />
        )}
      </div>
    </WidgetCard>
  );
}
