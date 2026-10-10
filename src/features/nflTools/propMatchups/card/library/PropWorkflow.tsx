import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SpotlightPickCard } from '@/features/nflTools/propMatchups/card/SpotlightPickCard';
import {
  useNflPropMatchupsPages,
  useNflPropMatchupsSlate,
  useNflPropSeasonWeeks,
  useNflPropSpotlight,
  quotesForPlayer,
  useNflPropBooks,
  useNflPropTrendsBatch,
  slateContextFacts,
  useNflSlateLines,
} from '@/features/nflTools/propMatchups/hooks';
import { buildNflPropGameFeed } from '@/features/nflTools/propMatchups/model';
import type { NflPropPlayerPage } from '@/features/propBreakdown/types';
import { LivePropCard } from './liveCard';

/** Current-season browser: every published week, every player, every posted market. */
export function PropWorkflow() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const slate = useNflPropMatchupsSlate();
  const season = slate.data?.season;
  const weeksQ = useNflPropSeasonWeeks(season);
  const requestedWeek = Number(params.get('week'));
  const week = Number.isFinite(requestedWeek) && requestedWeek > 0 ? requestedWeek : slate.data?.week;
  const pagesQ = useNflPropMatchupsPages(season != null && week != null ? { season, week } : undefined);
  const pages = pagesQ.data ?? [];
  const games = useMemo(() => buildNflPropGameFeed(pages), [pages]);
  const spotlightQ = useNflPropSpotlight(season, week);
  const linesQ = useNflSlateLines(season, week);
  const booksQ = useNflPropBooks(season, week);
  const playerId = params.get('player');
  const market = params.get('market');
  const page = pages.find((item) => item.player_id === playerId) ?? null;
  const playerBooks = useMemo(
    () => quotesForPlayer(booksQ.data, page?.player_id, page?.markets ?? []),
    [booksQ.data, page],
  );
  const trendsQ = useNflPropTrendsBatch(page ? [page.player_id] : []);
  const picks = (spotlightQ.data ?? [])
    .filter((item) => item.player_id === page?.player_id)
    .sort((a, b) => (a.board_rank ?? 99) - (b.board_rank ?? 99));
  const openMarket = market ?? picks[0]?.market ?? null;
  const shownPicks = picks.filter((item) => item.market === (openMarket ?? item.market));
  const needle = query.trim().toLowerCase();

  function openPlayer(next: NflPropPlayerPage, nextMarket?: string | null) {
    const posted = next.markets.find((row) => row.status === 'posted');
    const paramsNext = new URLSearchParams(params);
    if (week != null) paramsNext.set('week', String(week));
    paramsNext.set('player', next.player_id);
    paramsNext.set('market', nextMarket && next.markets.some((row) => row.key === nextMarket) ? nextMarket : posted?.key ?? '');
    setParams(paramsNext, { replace: true });
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid max-w-[1240px] gap-4 px-4 py-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-auto">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            {season ?? '—'} season
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(weeksQ.data ?? []).map((item) => (
              <button
                key={item}
                type="button"
                className={`rounded-full px-3 py-1 text-[12px] font-bold ${item === week ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.set('week', String(item));
                  next.delete('player');
                  next.delete('market');
                  setParams(next, { replace: true });
                }}
              >
                Week {item}
              </button>
            ))}
          </div>
          <input
            className="mt-3 w-full rounded-xl border border-black/10 bg-background px-3 py-2 text-[14px] dark:border-white/10"
            placeholder="Find a player"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="mt-3 space-y-4">
            {pagesQ.isLoading ? <p className="text-[13px] text-muted-foreground">Loading the week.</p> : null}
            {games.map((game) => {
              const players = [...game.awayPlayers, ...game.homePlayers].filter((item) =>
                !needle || item.player_name.toLowerCase().includes(needle) || item.team.toLowerCase().includes(needle),
              );
              if (!players.length) return null;
              return (
                <section key={game.id}>
                  <h2 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    {game.gameLabel} · {game.gameTimeLabel}
                  </h2>
                  <ul className="mt-1">
                    {players.map((item) => (
                      <li key={item.player_id}>
                        <button
                          type="button"
                          className={`flex w-full items-baseline justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[14px] ${item.player_id === page?.player_id ? 'bg-primary/15 font-semibold' : 'hover:bg-muted'}`}
                          onClick={() => {
                            const lead = (spotlightQ.data ?? [])
                              .filter((pick) => pick.player_id === item.player_id)
                              .sort((a, b) => (a.board_rank ?? 99) - (b.board_rank ?? 99))[0];
                            openPlayer(item, lead?.market ?? null);
                          }}
                        >
                          <span>{item.player_name}</span>
                          <span className="text-[11px] text-muted-foreground">{item.position} · {item.team}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </aside>
        <section className="min-w-0">
          {!page && !pagesQ.isLoading ? (
            <p className="text-[15px] text-muted-foreground">Pick a player. Every posted market for that week is on the card.</p>
          ) : null}
          {page ? (
            <>
              {shownPicks.map((pick) => (
                <div key={`${pick.market}-${pick.side}`} className="mb-4">
                  <SpotlightPickCard pick={pick} />
                </div>
              ))}
              <LivePropCard
                page={page}
                marketKey={openMarket}
                onMarket={(next) => openPlayer(page, next)}
                books={playerBooks}
                log={trendsQ.data?.[page.player_id]?.recent_game_log ?? null}
                facts={slateContextFacts(page, linesQ.data ?? [])}
              />
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
