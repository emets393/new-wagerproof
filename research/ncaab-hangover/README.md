# NCAAB hangover spots (2026-10-28)

**Owner's theory:** a team wins a huge game -- beats a ranked team or a rival, a tight national-TV game, a big upset -- and plays again
4-5 days later; is there a hangover? Same vein: the game after a buzzer beater, an OT game, a lucky win or an undeserved cover.

**Verdict in one line:** there is no hangover anywhere, and the biggest "hangover" spot runs the other way: **an unranked underdog that
just beat an AP top-25 team covers its next game 254-194 (56.7%, +8.3%)**, and the longer the layoff the better (4+ days 140-87, 61.7%).
Buzzer beaters, OT, close games, luck, rivals, national TV: all flat.

Scripts: `hangover_wide.py` → `HANGOVER_WIDE.txt` (every trigger × days of rest × venue × side × month), `hangover_deep.py` → `HANGOVER_DEEP.txt`.
Six seasons, 61,740 team-games with a previous game, T-60 close, shuffle null within season-month. Triggers are about the PREVIOUS game.

## The one that moves: beat a ranked team while unranked → back the next game

| previous game | next game ATS | % | ROI | p | seasons |
|---|---|---|---|---|---|
| unranked team beat an AP top-25 team | 315-266 | 54.2% | +3.6% | .027 | 5/6 (39-38 in 2020-21) |
| **… as an UNDERDOG** | **254-194** | **56.7%** | **+8.3%** | **.007** | 5/6 (30-32, 40-25, 40-30, 64-43, 49-35, 31-29) |
| … as the favorite (control) | 61-72 | 45.9% | | | the market had this one |
| dog version, 4+ days until the next game | 140-87 | 61.7% | +17.8% | .003 | **6/6** |
| dog version, ≤ 3 days | 114-107 | 51.6% | | | |
| dog version, next vs an unranked opponent | 203-146 | 58.2% | | | |
| dog version, next on the road / at home | 128-92 / 110-92 | 58.2% / 54.5% | | | |
| unranked LOST to a ranked team → next (control) | 1,183-1,173 | 50.2% | | | |
| the ranked LOSER's next game | 294-278 | 51.4% | | | no bounce-back edge |
| unranked beat an unranked team → next (base) | 12,413-12,483 | 49.9% | | | |

Opener agrees (54.5%) and the line moves only +0.12, so the market never prices it in. Dose: beat a top-10 team 58.1%; won by 13+ 58.9%;
the first ranked scalp of the season 56.5% vs a repeat scalp 50.8%. The owner's rest theory is right about the variable and wrong about the
sign: more days off after the big win → more covers, not fewer. Built as **`ncaab_ranked_upset_back`** (held with the stack).

## Everything else is flat (do not re-run)

| trigger (previous game) | next game ATS | total | note |
|---|---|---|---|
| won as a dog of 7+ / 10+ / 14+ | 52.2% / 52.8% / 56.2% | flat | lean only at 14+ (n 211); the favorite that lost to a 10+ dog 51.3% |
| won a national-TV game with \|spread\| ≤ 3 | 49.4% | over 52.9% (p .06) | nothing |
| upset on national TV / beat ranked on national TV | 50.6% / 49.0% | flat | "electric" adds nothing |
| beat a same-state conference rival (proxy) | 49.8% | flat | |
| hit a buzzer beater (≤ 1s / ≤ 5s / ≤ 24s) | 46.7% / 50.0% / 50.6% | over 52% | n 560 at ≤ 1s, inside the null |
| gave up a buzzer beater | 50.1% / 49.2% / 49.4% | flat | |
| won in OT / lost in OT | 51.0% / 50.6% | flat | |
| won by 1-3 / lost by 1-3 in regulation | 50.3% / 50.0% | over 51.7-52.2% | |
| lucky win (time-weighted WP < .5 and won) | 50.0% (n 7,713) | flat | confirms the CBB luck study: the CFB lucky-winner fade does not port |
| undeserved cover (covered with WP < .5) | 50.5% | over 51.5% | |
| deserved loss (WP ≥ .6 and lost) | 49.9% here | | the known 54% back needs the 2H-control definition (`ncaab_lost_controlling_2h`), not full-game WP |
| blew a 15+ lead and lost / came back from 15+ and won | 50.2% / 48.1% | flat | |
| any "big win" then 4-5 days off | 50.7% | flat | the rest gap matters only inside the ranked-upset cell |

## After a THRILLER (KenPom ThrillScore of the previous game) — `thriller_next.py` → `THRILLER_NEXT.txt` (2026-10-28)

Owner's follow-up: the previous game had a high KenPom thrill score; does the result, the venue of the thriller, or the venue of the next
game matter? 57,510 team-games with a previous-game thrill score. **Verdict: nothing in the main cuts; one venue pocket moved.**

- Previous-game thrill decile → next-game ATS runs 49.2-50.7% at every decile, after a win and after a loss alike; over % 49.5-52.4 with no
  ladder. Top-decile thriller last game: ATS 49.3% (won it 49.6%, lost it 48.9%), won/lost by 1-5 47.4/48.5%, OT 50.9%. Showcase (≥ 70) 49.3%.
  Rest gap flat (49.0-50.5%). The market shades neither team (next spread −5.4 winners / −4.9 losers, ATS margin −0.06).
- Venue of the thriller alone: home 48.5%, road 49.5%, neutral 50.8-54.6% (showcase neutral 233-194, thin). Next venue alone: home 48.5%, road 49.5%.
- **The pocket: thriller at HOME → next game also at HOME → fade the home team.** Top-decile: home team 313-387 (fade 55.3%, +5.5% at −110),
  shuffle p .007, six of six seasons from the fade side (51-50, 57-50, 56-49, 82-52, 72-57, 69-55), won the thriller 43.9% / lost it 45.6%.
  Deciles 9-10 together 726-823 (fade 53.1%, p .017). Control ladder for home→home by previous-game decile: 51.6, 48.5, 49.3, 52.4, 49.5, 50.0,
  50.6, 49.4, 48.6, **44.7** — a step at the top, not a dose; dull deciles 1-5 home→home 50.3%. Showcase ≥ 70 version 46.1% (p .16, n 351).
  The other three venue pairs: home→road 50.3%, road→home 49.6%, road→road 48.0%.
  Finer cuts of the previous game's thrill (home→home, fade %): 40-50 52.1 · 50-55 50.3 · 55-60 52.0 · **60-65 52.9 · 65-70 58.3 · 70-80 52.6 ·
  80+ 60.0** — every bin at 60+ is above 52%, nothing below 60 is. Fixed production cut **thrill ≥ 60: fade 446-370 (54.7%, +4.5%), p .010,
  five of six seasons** (78-82, 57-50, 64-54, 85-54, 77-62, 85-68); ≥ 65: 302-242 (55.5%, p .003). Won the thriller 55.5% / lost it 53.7%;
  next as favorite 54.9%, favored by 10+ 53.9%, as dog 53.0%; conference 54.6%, non-conference 53.6%; Jan+ 54.9%. Rest gap: 2 days 54.8%,
  3 days 49.1%, **4-5 days 183-113 (61.8%)**, 6+ 52.3%. Opener and close agree.
  Reading: a marquee home night followed by a lesser home game (next spread −7.3); the crowd and the number carry over, the performance does
  not. **Built as `ncaab_home_thriller_letdown`** (owner call 2026-10-28): previous game a true home game with KenPom thrill ≥ 60, tonight a
  regular-season home game → bet the visitor. 446-370.
