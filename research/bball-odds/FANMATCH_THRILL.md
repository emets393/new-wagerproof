# KenPom FanMatch: ThrillScore and KenPom's pregame predictions vs the market (2026-10-28)

**Question (owner):** can we get KenPom's thrill score per college basketball game? **Yes.** `kenpom.com/api.php?endpoint=fanmatch&d=YYYY-MM-DD`
returns every game that day with `ThrillScore`, `HomePred`/`VisitorPred` (KenPom's predicted score), `HomeWP`, `PredTempo`, ranks. The
warehouse already holds six seasons (`data/parquet/kenpom_fanmatch.parquet`, 32,376 games, `fetch_kenpom_fanmatch.py` is idempotent),
96.5% of priced games match the T-60 panel (`fanmatch_study.py` → `FANMATCH_RUN.txt`). For today's games the morning call gives the
pregame value, so it can be stored on the card.

**Is the archive pregame?** Yes. KenPom's archived prediction correlates with the result slightly LESS than the closing line every season
(margin .59-.65 vs .61-.67; total .42-.44 vs .44-.48; MAE 8.97 vs 8.81) and sits at r .98 with the market. A recomputed prediction would
beat the line. Safe to use as a pregame feature.

**KenPom vs the market = priced** (confirms the July movement study): bet KenPom's side of the total at any disagreement band 48-51%; the
spread 49-50% at every band; KenPom-likes-the-home-team more than the moneyline loses 5-10% at every band. Nothing to bet.

**ThrillScore = no bet.** Deciles within season: over % 49.6-53.8 with no ladder (decile 7 is the high, decile 10 the low); favorite ATS
47.8% in the dullest decile (22-point spreads: the big-dog lean) to 51.6% in the top decile; showcase games (thrill ≥ 70, n 1,019) favorite
52.4% / over 48.5% / conference home team 52.7% — all inside the vig. The score is closeness × quality × tempo, i.e. the spread, the ranks and
KenPom tempo, every piece of which the market already carries.

**Use:** a display field ("KenPom thrill 68 — a showcase game") and a pace proxy on the card; not a signal input.
