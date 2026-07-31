# College basketball — what the NBA ideas did when we ported them

Plain-English companion to NBA_REPORT_PLAIN_ENGLISH.md. Five studies, all of the ideas from
the NBA program run again on college. Sources: NCAAB_HEAT_BRIEF.md, NCAAB_HEAT_VALIDATION.md,
NCAAB_HEAT_REFINE.md, NCAAB_LUCK_BRIEF.md, NCAAB_AVAILABILITY_BRIEF.md,
NCAAB_AVAIL_VALIDATION.md, NCAAB_BOX_PLAYERS.md, NCAAB_AVAIL_CONSENSUS.md.

**Why college was worth re-running at all:** 23,163 priced games over four seasons against
the NBA's 5,278, and it is the market where we had already proven absences go unpriced. A
rule that needs 800 bets to show itself has four times the room to show itself.

---

## The short version

**One thing worked, and it is something we already knew — with a twist worth having.** Fading
a college team that is missing rotation players is worth about +9 to +10% on the full-game
spread. That is real and it survives every test we threw at it. But it is the same effect as
S1 (big freshly out, +10.4%) and S6 (impact-weighted absences, +3.3 to +5.4%) already in the
vault. Not a new edge.

The twist: **the simplest weighting wins.** S6 weights each absence by the player's measured
on/off impact — an on-court plus-minus model. Plain missing minutes, with no impact model at
all, scored +10.0% where S6's production RAPM version scores +3.3%. We got the same result
inside this study too: the impact-valued variant underperformed raw minutes on the same data.
That points at S6 being over-engineered, and it is the one part of this worth acting on.

**The genuinely new and useful finding is a negative one.** We now know there is no cheap
workaround for the injury feed. Using "who was out in the team's last game" — which needs no
external data at all — is worth nothing (+1.1%). The entire edge lives in knowing who is out
*tonight*, before tip. That forecloses the shortcut and makes the case for buying the
pregame feed a straightforward one.

**Three ideas ported from the NBA and died.** Player shooting heat, team luck regression, and
non-shooting heat. All three failed the same way, and the way they failed is worth trusting:
the placebo scored as well as the real signal.

---

## 1. The absence edge — real, replicated, but not new

The rule: on any given night, work out how much of each team's rotation is missing, weight it
by how many minutes those players normally play, and bet against whichever team is more
shorthanded.

We built this twice, from two completely unrelated data sources — a five-man-lineup table and
a vendor box-score feed with a different player-id system. Where both fire they agree 98% of
the time, so they are measuring the same thing.

| Version | Bets | Win % | Baseline | ROI at the close | Seasons |
|---|---|---|---|---|---|
| Both feeds agree | 498 | 57.8% | 50.6% | **+10.5%** | 57 / 58 / 59 |
| Either feed | 1,097 | 57.2% | 50.9% | **+9.2%** | 53 / 59 / 56 / 56 |
| S1, already in the vault | 751 | 57.8% | — | +10.4% | 57 / 57 / 59 / 58 |
| S6 v2 (RAPM-weighted), in the vault | 690 | 54.1% | — | +3.3% | — |

Note the bottom two rows. **This does not beat S1**, and it is built from the same data as
**S6**. S1 fades a team when its top rebounder is freshly out; S6 fades a team by its
RAPM-weighted missing impact; this fades a team when its rotation minutes are down, whoever
they belong to. Three selection rules landing in the same place is a replication of the
underlying effect — good evidence it is real and not an artifact of how "the big" was defined
— but it is not an additional edge to stack on top of either.

What *is* new is the ordering. S6's production version weights each absence by a ridge-RAPM
impact estimate and scores +3.3%. Dropping the impact model entirely and counting plain
missing minutes scores +10.0% on the same games. More machinery, worse result.

It survived the tests that killed our NBA near-misses:

- **It is not a home or favourite bias in disguise.** Inside the exact same set of games,
  blind home loses 6.3%, blind favourite loses 3.2%. The rule makes +10.5%.
- **It beats a random cut.** Betting the top 30% of games by how lopsided the absences are
  beats a random 30% of the same pool 99.9% of the time.
- **It survives walk-forward.** Setting the cutoff using only earlier seasons and applying it
  blind still returns +8.6%.
- **It has a gradient behind it, not just a threshold.** Sorted into ten buckets from
  "away team most depleted" to "home team most depleted," the home cover rate falls steadily
  from 59% to 40%. Threshold rules with no slope behind them are usually flukes. This has the
  slope.
- **It is not garbage time.** The worry was that "didn't play tonight" partly measures whether
  the game was a blowout — coaches play seven men in a tight game and twelve in a rout. The
  correlation between how lopsided the absences are and the final margin is −0.008. Flat. That
  artifact is not in the data.

**One caveat on the size.** The two feeds give +10.0% and +1.1% at the close on their own; it
is only where they agree that it firms up to +10.5%. The direction replicates everywhere and
every season is positive, but the *magnitude* moves around depending on construction. Treat
+9% as the honest number, not +13%.

## 2. The finding that actually changes a decision: the lag is worthless

Knowing who is out tonight requires a pregame injury feed. We do not own one. So the obvious
question is whether you can approximate it with something we *do* have — namely, who was out
in the team's previous game.

You cannot.

| What you know | Bets | Win % | ROI at the close |
|---|---|---|---|
| Who is out **tonight** (needs a feed) | 872 | 57.6% | **+10.0%** |
| Who was out **last game** (free) | 598 | 51.3% | **−2.0%** |

The entire edge is in the freshness. By the next game the player is either back or the market
has adjusted. This independently confirms what S1 found from a different angle ("stale
absences 51.4%, the edge is a one-game news lag") and it settles the production question:
**there is no free version of this signal.** If we want it, we buy the pregame feed. That is
the decision this work supports.

## 3. Three ports that failed

All three failed in the same specific way, which is why I trust the verdicts. In each case we
carried a **placebo** — a measure that looks like the real signal but describes style or skill
rather than luck, and therefore cannot possibly regress to the mean. In all three, the placebo
scored as well as or better than the real thing.

**Player shooting heat.** In the NBA, fading concentrated shooting heat was the one full-game
spread edge that survived. In college the direction is right and it wins in all four seasons,
but it is worth +0.9% at the opener and −1.0% at the close, and the concentrated-heat split
beats a random cut only 73% of the time — well under the 95% bar. Telling: the version with
*no* own-baseline correction scores just as well. In the NBA that same control loses 7.9% —
subtracting each player's own sustainable rate was the whole trick there, and it does nothing
here.

**Team luck regression** (the MLB "who's been unlucky and is due" question). Comprehensively
null, now on four times the NBA sample. Every gradient is flat, every family loses money at
every market, and the largest slope anywhere in the table belongs to the placebo. Combined
with the NBA result, this closes the whole category: **team-level statistical luck regression
does not work in basketball, in either sport.** It works in baseball because baseball has
genuinely luck-dominated outcomes over short windows; basketball does not.

**Non-shooting heat** (free-throw percentage, turnovers, rebounding, assists). Free-throw
percentage was the strongest a priori candidate in all of basketball — it barely depends on
the opponent, so a hot streak should be close to pure noise. It is not tradeable either. All
four rates lose money at all eight markets, and both placebos outscored all four.

**One failed prediction, reported as failed.** We predicted the heat fade would be stronger
when a hot player's shots were increasingly *assisted* (team context, which decays) than when
he was creating them himself (skill, which persists). The data went the other way. That is
recorded as a wrong prediction rather than flipped into a rule.

---

## What I would do next

1. **Price the pregame CBB availability feed.** Two independent constructions now say the
   same thing S1 and S6 said, and we have shown there is no free substitute. This is the only
   item here with money attached.
2. **Simplify S6.** Its RAPM impact weighting scores +3.3% where plain missing minutes scores
   +10.0% on the same games, and the same ranking showed up inside this study. Re-grade S6
   with raw weighted minutes before shipping the impact model.
3. **Do not stack this on S1 or S6.** All three are the same effect. If the feed arrives, the
   question is which selection rule is best, not whether to bet all three.
4. **Stop testing luck regression in basketball.** Two sports, six designs, placebo-controlled
   throughout. The category is closed.

## A note on how to read these numbers

Every win rate above is printed next to the baseline of **its own slice**, never 50%. A coin
flip scores about −2 against that comparator, so "edge" is read against the permutation null,
not against zero. Breakeven at −110 is 52.4%. Where a result conditions on something only
knowable after the game, it is labelled as a diagnostic and not as a bettable slice.
