import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';
import { WidgetCard } from '@/components/ios';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import debug from '@/utils/debug';
import { fmt1, fmtSigned1, round1, toNum } from './shared';
import type { NBAPrediction, NbaH1Row } from '../../../api/nbaGames';
import type { GameFeedItem, TeamRef } from '../../../types';

/**
 * First-half spread and total from nba_model_preds_h1. Same numbers as the full-game
 * originator row. The total is tracking-only: its tier is never a bet.
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
    <WidgetCard
      icon={<Timer />}
      title="First half"
      subtitle="Each spread names the team it belongs to. The total is tracking only."
    >
      <div className="flex flex-col gap-3">
        {spread && <HalfMarket kind="spread" row={spread} home={game.homeTeam} away={game.awayTeam} />}
        {total && <HalfMarket kind="total" row={total} home={game.homeTeam} away={game.awayTeam} />}
      </div>
    </WidgetCard>
  );
}

function HalfMarket({
  kind,
  row,
  home,
  away,
}: {
  kind: 'spread' | 'total';
  row: NbaH1Row;
  home: TeamRef;
  away: TeamRef;
}) {
  const model =
    kind === 'spread'
      ? (() => {
          const margin = toNum(row.model_home_margin);
          return margin === null ? null : round1(-margin);
        })()
      : toNum(row.model_total) === null
        ? null
        : round1(toNum(row.model_total) as number);
  const market =
    kind === 'spread'
      ? toNum(row.market_home_spread) === null
        ? null
        : round1(toNum(row.market_home_spread) as number)
      : toNum(row.market_total) === null
        ? null
        : round1(toNum(row.market_total) as number);
  const trackingOnly = kind === 'total';
  const tier = trackingOnly && row.tier === 'bet' ? 'tracking' : row.tier;
  const lean = kind === 'spread' ? spreadLean(model, market, home.abbrev, away.abbrev) : null;

  return (
    <div className="rounded-2xl border border-black/5 px-3 py-2.5 dark:border-white/10">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[13px] font-bold text-foreground">{kind === 'spread' ? '1H spread' : '1H total'}</div>
        {tier && (
          <span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground dark:bg-white/[0.06]">
            {tier}
          </span>
        )}
      </div>
      {kind === 'spread' ? (
        <div className="mt-2 grid grid-cols-2 gap-2 text-center">
          <SpreadCell label="Model" homeAbbrev={home.abbrev} awayAbbrev={away.abbrev} homeLine={model} />
          <SpreadCell label="Market" homeAbbrev={home.abbrev} awayAbbrev={away.abbrev} homeLine={market} accent />
        </div>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-2 text-center">
          <NumberCell label="Model" value={model === null ? '—' : fmt1(model)} />
          <NumberCell label="Market" value={market === null ? '—' : fmt1(market)} accent />
        </div>
      )}
      {lean && <p className="mt-2 text-[12px] leading-relaxed text-foreground">{lean}</p>}
      {trackingOnly && (
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Tracking only. The first-half total is never a bet.
        </p>
      )}
    </div>
  );
}

/** Home line is the stored spread. The other side is the negation. Favorite (negative) is listed first. */
function SpreadCell({
  label,
  homeAbbrev,
  awayAbbrev,
  homeLine,
  accent = false,
}: {
  label: string;
  homeAbbrev: string;
  awayAbbrev: string;
  homeLine: number | null;
  accent?: boolean;
}) {
  const tone = accent ? 'text-sky-500' : 'text-foreground';
  if (homeLine === null) {
    return <NumberCell label={label} value="—" accent={accent} />;
  }
  const awayLine = round1(-homeLine);
  const homeText = teamLine(homeAbbrev, homeLine);
  const awayText = teamLine(awayAbbrev, awayLine);
  const favoriteFirst = homeLine > 0;
  const primary = favoriteFirst ? awayText : homeText;
  const secondary = favoriteFirst ? homeText : awayText;
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-[15px] font-bold tabular-nums ${tone}`}>{primary}</div>
      <div className="text-[12px] font-semibold tabular-nums text-muted-foreground">{secondary}</div>
    </div>
  );
}

function teamLine(abbrev: string, line: number): string {
  const name = abbrev || 'Team';
  if (line === 0) return `${name} PK`;
  return `${name} ${fmtSigned1(line)}`;
}

/** Positive model-minus-market on the home line means the model is toward the away team. */
function spreadLean(modelHome: number | null, marketHome: number | null, homeAbbrev: string, awayAbbrev: string): string | null {
  if (modelHome === null || marketHome === null) return null;
  const gap = round1(modelHome - marketHome);
  if (gap === 0) return 'Model and the book have the same first-half spread.';
  const toward = gap > 0 ? awayAbbrev || 'the road team' : homeAbbrev || 'the home team';
  return `Model is ${Math.abs(gap).toFixed(1)} points toward ${toward} versus the book.`;
}

function NumberCell({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-[15px] font-bold tabular-nums ${accent ? 'text-sky-500' : 'text-foreground'}`}>{value}</div>
    </div>
  );
}
