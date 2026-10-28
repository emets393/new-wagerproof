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
