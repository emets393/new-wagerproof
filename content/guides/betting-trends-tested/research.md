# Research: betting trends tested

October 9, 2026, America/Chicago. New article, approved by the user 2026-10-09 and published the same day, one day before the video. It is the companion guide for the WagerProof YouTube video "We tested 11 betting hunches on 20,000 real games" (working title).

- **Proposed canonical:** https://wagerproof.bet/guides/betting-trends-tested/
- **publishedAt:** provisional until approval.
- **Repo:** this draft lives in the video project (`projects/2026-10-09-wp-yt-betting-hunches-tested/guide/`). It has not been copied into `content/guides/` yet.
- **Charts:** the source and build script are in `guide/charts/make_charts.mjs`. The WebP files go to `public/guides/betting-trends-tested/`.

## Status
- Published 2026-10-09 (PR to main). The University of Chicago Magazine quote is verified on the page ("anything higher is luck").
- To do after the YouTube upload (scheduled 2026-10-10, 5 PM CT): add the "Prefer to watch?" line and `video.youtubeId`.

## Keyword and intent

Ahrefs, US, pulled 2026-10-09:

| Keyword | Volume | Latest month | KD |
| --- | ---: | ---: | ---: |
| betting trends | 1,800 | 2,566 | 52 |
| nfl betting trends | 1,100 | 2,768 | 74 |
| nfl betting strategy | 400 | 748 | 26 |
| sports betting strategy | 700 | 682 | 49 |
| best sports betting strategy | 1,000 | 1,263 | 61 |

- "Do betting systems work", "sports betting myths" and "betting the favorite" show no measurable volume. "nfl betting trends" is partly current-week intent (Covers-style trend pages).
- This page targets the evergreen question "do betting trends work" and the strategy cluster.
- The primary keyword is in the URL, H1, SEO title and first answer. The title uses "betting trends" because it carries the most search volume. The article and video call them "hunches".

## Method and claim boundaries

Full query results are in `research/yt-longform-ideas-2026-10-09/SYSTEMS_TEST.md` (video-pipeline repo).

### Data

| Sport | Source | Games |
| --- | --- | ---: |
| NFL | `nfl_analysis_base`, 2018-2025 | 2,225 |
| College football | `cfb_analysis_base`, 2016-2025 | 7,026 |
| MLB | `mlb_analysis_base`, 2023 to 2026-10-07 | 9,852 |
| NBA | `v_nba_team_results_enriched`, 2025-26, last pregame snapshot per game | 1,316 |

Total: 20,419.

### Grading

- Closing lines; pushes removed. Spreads and totals use standard -110 for profit.
- Moneylines use the real closing prices, converted to the equivalent win rate at -110 = (1 + ROI) / 1.90909.
- NFL under prices are missing on many rows, so totals are not scored at actual prices.
- 38 sport-by-hunch tests. Multiple testing is stated in the article. Strong results were split into halves (2018-21 vs 2022-25 for the NFL).

### Definitions

- **Rest:**
  - Football: `rest_days` of at least 13, i.e. coming off a bye. College also requires fewer than 60, which excludes season openers.
  - NBA: at least one day off, against an opponent on the second night of a back-to-back (computed from game dates).
  - MLB: `days_rest` greater than the opponent's (0 means played yesterday).
- **Body clock:**
  - NFL: SF, SEA, LAR, LAC or LV on the road, Sunday kickoff before 2 p.m. ET.
  - MLB: SEA, SF, OAK/ATH, LAD, LAA or SD on the road, start time before 2 p.m. ET.
  - College: Pac-12 or Mountain West road team, kickoff before 1 p.m. ET. Only 55 games, so not reported.
- **Weather:**
  - Cold: at or below 32°F in football, 50°F or colder in MLB.
  - Wind: 15 mph or more in football; MLB wind blowing in at 10 mph or more.
  - Domes excluded.
- **Long shots:** +300 or longer; +200 or longer in MLB.
- **Referee:** 12 referees with 40+ games in both 2018-21 and 2022-25. Under rate = 100 minus over rate among non-push games.
- **Fade the public:** `nfl_betting_lines` 2025 only, the last snapshot before kickoff. 284 games matched to results.
- **Primetime:**
  - NFL: `is_primetime`, with Sunday + Monday split from Thursday.
  - College football: `is_primetime`.
  - NBA: `nba_schedule.national_tv`, all 1,316 games matched.
  - MLB: Sunday games starting 7 p.m. ET or later.

### Claims to keep within limits

- **West-coast straight-up wins:** they reflect team quality. The article says the spread result is the fairer test.
- **Cause of primetime unders:** unproven. We show only the totals gap (46.3 vs 45.1 set; 45.4 vs 46.1 scored) and that the public bet overs at the same rate in 2025. No causal claim.
- **Fade the heavy public (61-43):** one season, 104 bets. Labeled promising but small. Against a 52.4% break-even skill level, a result this high has roughly a 1-in-10 chance by luck.
- **Referees:** among the four with 55%+ under rates in 2018-21, only Hochuli stayed above break-even. Others (Wrolstad 52.9%, Novak 52.3%) stayed near it, so the article does not say "only one held".
- **Pro win rate:** 54% per Frohardt-Lane. 55% is described as a common handicapper benchmark, not a measured statistic. No claim about an "average bettor" win rate; no reliable source was found.

## Product claim

The WagerProof connector exposes `query_sports_database` to signed-in users (connector guide). The article says only that it can return a record, sample size and season split for a theory. It makes no claim that WagerProof models beat the market.
