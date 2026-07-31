# The NBA, in plain English

What we tested, what we found, what we can actually bet. Written 2026-07-30, covering the
whole NBA research program: 5,278 games with real closing prices, four seasons, plus 2.5
million play-by-play events.

---

## Part 1 — The luck question you asked

**Your question.** Same as MLB: who has been getting lucky, who has been playing fine and
losing anyway, and can we bet the correction on the next game.

**What we built.** A luck ledger for every team before every game. For each team we tracked
thirteen things over its last 5 and last 10 games, and — this is the important part — we
compared each one to **that team's own normal**, not to the league's. A team that always
shoots 38% from three is not lucky when it shoots 38%. The thirteen:

- *Result luck* — did they win more games than their point differential deserved? Did they go
  4-1 in games decided by four points or less? Were their margins better than their own norm?
- *Shooting luck* — did the ball go in at more than their own rate? Did opponents hit shots
  against them that normally miss? (This last one is basketball's version of a pitcher giving
  up bloop singles — defenses barely control whether the threes they concede actually drop.)

We also stripped out garbage time, so a 22-point blowout's meaningless fourth quarter doesn't
pollute a team's shooting numbers.

**What we tested it against.** Every market we have prices for. Full-game spread at the
opener and at the closing number, moneyline, full-game total, first-half spread, first-half
total, and both team totals. Eight markets.

**The answer: it does not work. Anywhere.**

We attacked it four different ways, because one negative result is not proof.

1. **The wide sweep.** 352 combinations — every luck measure, both windows, every market. Best
   result: 55%. Sounds fine. But when you test 352 things, *pure noise* produces a 54–55%
   cell almost every time. We measured that directly by scrambling the outcomes 300 times and
   asking how good the best cell looked. Answer: this good, 17% of the time. That's not an
   edge, that's the number of tickets we bought.

2. **The gradient test.** This is the one that matters most, and it's the one people skip.
   Regression to the mean is a *slope*, not a switch. If lucky teams are due to give it back,
   then the luckier the team, the less it should cover — steadily, across the whole range. We
   sorted every game into ten buckets from unluckiest to luckiest and looked at the cover
   rate. **Flat.** Dead flat, in every market. 50, 48, 55, 52, 53, 50, 48, 51, 50, 48. There
   is no slope to bet.

3. **The "market hasn't noticed yet" test.** Maybe raw luck is priced but the *unpriced part*
   isn't. So we mathematically removed everything the closing line and the line movement
   already knew, and bet only the leftover. It got worse.

4. **Your exact scenario.** "A team that just played flat-out bad for a stretch." We isolated
   games where a team had *both* bad results *and* bad luck at the same time — the double-due
   case. Every version lost money. And the control cell — teams where the two signals
   *disagree*, which should behave differently — scored the same.

**The single most damning number.** We ran a fake signal alongside the real one the entire
way: how often a team *shoots* threes and how often it *allows* them. That's playing style. It
cannot regress — a team that shoots a lot of threes just shoots a lot of threes. **The fake
signal scored as well as or better than the real ones in every single table.** When your
placebo beats your drug, you don't have a drug.

**Why this fails in basketball when it works in baseball.** In MLB, a hitter's bad month is
about 100 at-bats, and nobody — not us, not the market — can tell a real slump from noise at
that sample. That gap is where the money is. An NBA team plays 82 games with roughly the same
nine guys. By game ten the market already knows what that team is. Our luck score is telling
the market something it priced weeks ago.

**One near-miss, reported honestly.** The one idea with a real mechanism — both teams shooting
over their heads means the total is set too high, so play the under — did show 53.1% pooled.
But when we only used cutoffs learned from *earlier* seasons and applied them blind to later
ones, the return was **−0.9%**. Below break-even. And it didn't get stronger as we got more
selective, which a real regression effect has to. Close, but no.

---

## Part 2 — What we *did* find in the NBA

The luck angle is dead, but the program is not. Four signals cleared their controls. Three of
them come from a very different idea: **not who got lucky, but who is in a situation the
market misprices.**

### The two we'd bet today, on the full-game spread

**Dead teams inflate their opponents.** Late in the season (both teams 50+ games in), when the
**home** team is mathematically eliminated or openly tanking, **back the favourite**. 62.3%,
+19% return, 324 bets, and it worked in all four seasons (60/58/68/63). Roughly 80 bets a
year. Important honesty note: favourites already cover 53% in late-season games, so the real
edge is +9 points over the right baseline, not +12 over a coin flip. Needs no injury data at
all — just the standings.

**Fade the guy who's been shooting out of his mind.** For each player we measured how much
he's been scoring above what his shot locations say he should, versus **his own career rate**.
When that heat is concentrated in one or two players on a team, fade that team. 54%, +3.2%,
446 bets. Thin, but it clears the closing number.

Two things make this one credible rather than lucky. First, the *team-level* version of the
same idea loses money — averaging across a roster destroys the information. Second, fading
the guy who's merely been *scoring a lot* (without subtracting his own baseline) loses 7.9%.
Subtracting his own sustainable rate is the whole trick.

**Run together they're the product.** They overlap on only 23 of 895 games, so combining them
is nearly free: **862 bets, 55.3%, +5.6%, positive all four seasons, ~215 bets a season.** You
trade some edge for four times the volume.

### The two in the first half, which is where the NBA market is laziest

**Somebody's out, but not a star.** When exactly one moderate scorer (18–25 ppg) is *freshly*
out, the opponent is healthy, and the game is close on the spread — **back the depleted team
in the first half.** 60.9%, +16%, 271 bets, 63/60/60 by season. The market overcorrects for
the absence; the team's remaining starters absorb the minutes early and the correction shows
up after halftime, not before it.

**Both teams on the same first-half streak.** When both teams are riding the *same* 3+ game
first-half over/under streak, bet against it. 61.9%, +18.1%. Both directions work — both on
over-streaks → under (64.3%), both on under-streaks → over (59.6%). One team on a streak is
worth nothing; the conjunction is the signal.

### The pattern
Everything that works in the NBA is either a **situation** (dead team, injury, schedule) or a
**player-level** measurement. Nothing that works is a team-level statistical trend. That is
the single most useful thing this program has learned, and it now saves us from rebuilding
this category again.

---

## Part 3 — What we deliberately are *not* betting

One cell looked better than anything else in the program: the dead-home-team rule filtered to
games where shot-quality data agrees. **61%, +16.5% return, 213 bets.** We are not betting it,
for two reasons worth knowing because they'll come up again:

1. When your rule says "bet the favourite," comparing it to "how often do favourites win" is
   comparing it to itself. Against an honest comparator the filter adds far less than it looked.
2. Cutting a validated signal in half and reporting the good half is rigged by construction —
   the good half is good *because* the bad half is bad. We tested whether that specific cut
   beats a **random** cut of the same size. It does, but only 90% of the time. Not enough.

It's on the tracking list. If it survives a fifth season, it converts.

---

## Part 4 — What's left

Not everything from the play-by-play data has been mined. Three things remain genuinely
untested: which shots are created by teammates vs. taken solo, non-shooting hot streaks
(rebounding, turnovers, free throws), and five-man lineup efficiency from the 303,000
substitutions we pulled. Expectation is low given everything above, but they are different
questions rather than re-slices of the same one.

The more promising direction is porting the player-heat rule to **college basketball**, where
we've already proven the market *doesn't* price absences the way the NBA does — the exact same
absence signal that dies at the NBA close is worth +10% in CBB.

---

## The one-paragraph version

We built a full luck ledger for every NBA team, measured against each team's own baseline,
and bet it into all eight markets four different ways. It doesn't work — the NBA market has
82 games and a stable rotation to look at, and it prices team-level luck before we can. It
works in baseball because a slump there is 100 at-bats and genuinely ambiguous. What *does*
work in the NBA is situational and player-level: dead teams late in the year, individual
players shooting over their own heads, one non-star freshly out in a close game, and both
teams sharing a first-half streak. Four validated signals, two markets, roughly 300 bets a
season between them.
