# Systems — WagerProof Filter Taxonomy (our naming)

Our own filter/category vocabulary for the Systems feature, mapped 1:1 to the reverse-engineered
TrendsCenter set (`00_TRENDSCENTER_FILTER_TAXONOMY.md`) so nothing is copied verbatim. Covers all five
sports WagerProof supports: **NFL, CFB, MLB, NBA, NCAAB.**

CFB is extrapolated from the NFL recording; NCAAB from the NBA recording (both structurally parallel —
see per-sport deltas for where the parallel intentionally breaks).

---

## Naming principles

1. **Rename category headers and any *distinctive* TrendsCenter phrasing.** Their tab labels ("Betting
   Info", "Previous Matchup", "Team ATS") and coined phrases ("Home Stand", "Margin of victory/loss") get
   our own wording.
2. **Keep industry-standard betting nomenclature as-is.** "Home", "Away", "Favorite", "Underdog", "Win %",
   "Winning Streak", "Over/Under", "Spread", "Moneyline" are shared vocabulary across the whole industry —
   renaming them would just make the app read oddly and buys no protection. Using standard terms is not
   copying.
3. **Reuse WagerProof's existing labels** where our current Historical Analysis pages already name a filter
   (e.g. "Primetime", "Divisional", "Favorite/Underdog") — consistency with our own app beats novelty.
4. **Coin clear names for the net-new "as-of-game" filters** (Bucket C) that we don't have yet.

---

## Category rename map

| TrendsCenter tab | Our category |
|---|---|
| Game | **Game & Situation** |
| Day and Time | **Schedule** |
| Betting Info | **The Line** |
| Playoffs | **Postseason** |
| Team | **Team & Rest** |
| Opponent | **Opponent & Rest** |
| Previous Season | **Prior Year** |
| League | **Conference & Division** |
| Previous Game | **Recent Form** |
| Previous Matchup | **Head-to-Head** |
| Opponent Previous Game | **Opponent Form** |
| Team Wins | **Season Record** |
| Opponent Wins | **Opponent Record** |
| Team ATS | **Cover Profile** |
| Opponent ATS | **Opponent Cover Profile** |
| Team O/U | **Total Profile** |
| Opponent O/U | **Opponent Total Profile** |
| Team Stats | **Season Stats** |
| Opponent Stats | **Opponent Season Stats** |
| Quarterback / Pitcher | **Starters** |
| Opponent Quarterback / Pitcher | **Opponent Starters** |
| Referee | **Officials** |

> Design note (not a naming decision): we may merge each "Team ___" / "Opponent ___" pair into one tab with
> a Team⇄Opponent toggle. That halves the tab count and is a cleaner differentiator from TrendsCenter. The
> taxonomy below keeps them paired for clarity; the builder can consolidate.

---

## CORE taxonomy (shared across all sports)

`+` = value/range input · `○` = toggle · 👑 = premium in TrendsCenter (our gating TBD) ·
**Have?** = ✅ already in WagerProof / 🟡 partial / 🔶 net-new (Bucket C — needs as-of-game feature store).

### Game & Situation
| Our name | TC source | Type | Have? |
|---|---|---|---|
| Season | Season | + | ✅ |
| Week # (football) / Game # of season | Week # / Game # | + | ✅ |
| Current season only | 2026 season | ○ | ✅ |
| Home | Home | ○ | ✅ |
| Away | Away | ○ | ✅ |
| Regular season | Regular Season | ○ | ✅ |
| Neutral site | *(WP-only; CFB/NCAAB)* | ○ | ✅ |

### Schedule
| Our name | TC source | Type | Have? |
|---|---|---|---|
| Date | Date | + | ✅ |
| Start time | Time | + | ✅ |
| Primetime (after 7pm ET) | Prime time 👑 | ○ | ✅ |
| Daytime (before 7pm ET) | Non Prime time | ○ | ✅ |
| Day of week (Mon–Sun) | Monday…Sunday | ○ | ✅ |

### The Line
| Our name | TC source | Type | Have? |
|---|---|---|---|
| Team spread / run line | Spread / Run Line | + | ✅ |
| Team moneyline | Moneyline | + | ✅ |
| Opponent moneyline | Opponent's Moneyline | + | ✅ |
| Game total (O/U) | O/U | + | ✅ |
| Favorite | Favorite | ○ | ✅ |
| Underdog | Underdog | ○ | ✅ |

### Team & Rest / Opponent & Rest
| Our name | TC source | Type | Have? |
|---|---|---|---|
| Team / Opponent | Team / Opponent | + | ✅ |
| Days rest | Rest / Opponent Rest | + | 🟡 (MLB/NFL have some) |
| Rest edge | Rest Advantage 👑 | ○ | 🔶 |
| Rest deficit | Rest Disadvantage 👑 | ○ | 🔶 |
| Even rest | Equal Rest 👑 | ○ | 🔶 |

### Recent Form  *(last completed game)*
| Our name | TC source | Type | Have? |
|---|---|---|---|
| Won / Lost last game | Win / Loss | ○ | 🟡 |
| Last game home / away | Home / Away | ○ | 🔶 |
| Consecutive home games | Home Stand 👑 | ○ | 🔶 |
| Consecutive road games | Road trip 👑 | ○ | 🔶 |
| Points scored / allowed last game | Points Scored/Allowed 👑 | + | 🔶 |
| Final margin last game | Margin of victory/loss 👑 | + | 🔶 |
| Cover margin last game | ATS Margin 👑 | + | 🔶 |
| Covered / didn't cover last game | ATS Win / ATS Loss 👑 | ○ | 🟡 |
| Over / Under last game | Over / Under 👑 | ○ | 🟡 |
| Favorite / Underdog last game | Favorite / Underdog 👑 | ○ | 🔶 |
| Prev game spread / ML / total | Spread / Moneyline / O/U 👑 | + | 🔶 |

*(Opponent Form = same list, mirrored to the opponent.)*

### Head-to-Head  *(most recent meeting vs this opponent)*
| Our name | TC source | Type | Have? |
|---|---|---|---|
| Last meeting: won / lost | Win / Loss | ○ | 🟡 |
| Last meeting: home / away | Home / Away | ○ | 🔶 |
| Last meeting: covered / didn't | ATS Win / ATS Loss | ○ | 🔶 |
| Last meeting: over / under | Over / Under | ○ | 🔶 |
| Last meeting: fav / dog | Underdog / Favorite | ○ | 🔶 |
| Last meeting: final / cover margin | Margin 👑 | + | 🔶 |
| Last meeting: spread / ML / total | Spread / Moneyline / O/U | + | 🔶 |
| Spread lower / higher / ≤ / ≥ than last meeting | Lower/Higher/± Spread 👑 | ○ | 🔶 |
| Same / different season | Same/Different Season | ○ | 🔶 |
| Last meeting in postseason / regular | Playoffs / Regular Season | ○ | 🔶 |

### Prior Year
| Our name | TC source | Type | Have? |
|---|---|---|---|
| Prior-year wins / losses | Previous Season Wins/Losses 👑 | + | 🔶 |
| Prior-year win % | Previous Season Win % 👑 | + | 🔶 |
| Prior-year postseason wins | Previous Season Playoff Wins 👑 | + | 🔶 |
| Made / missed postseason last year | Made/Missed Playoffs | ○ | 🔶 |
| More / fewer wins than opponent last year | More/Less Wins Than Opponent | ○ | 🔶 |

*(each also mirrored to opponent.)*

### Season Record  *(as-of-game standings)*
| Our name | TC source | Type | Have? |
|---|---|---|---|
| Win % | Win % | + | 🔶 |
| Win % gap vs opponent | Win % Differential | + | 🔶 |
| Win streak / Loss streak | Winning/Losing Streak | + | 🔶 |
| Winning record (>.500) / Losing record (<.500) | Above/Below .500 | ○ | 🔶 |
| Win % >, ≥, <, ≤, = opponent | Win % vs Opponent (5) | ○ | 🔶 |

### Cover Profile  *(as-of-game ATS)*
| Our name | TC source | Type | Have? |
|---|---|---|---|
| ATS win % | ATS Win % 👑 | + | 🔶 |
| Avg cover margin | Average ATS Margin 👑 | + | 🔶 |
| ATS win streak / loss streak | ATS Win/Loss Streak 👑 | + | 🔶 |

### Total Profile  *(as-of-game O/U tendencies)*
| Our name | TC source | Type | Have? |
|---|---|---|---|
| Over % / Under % | Team Over/Under % | + | 🔶 |
| Over streak / Under streak | Team Over/Under Streak | + | 🔶 |

### Season Stats — sport-specific (see per-sport deltas)

### Postseason & Conference/Division — sport-specific (see per-sport deltas)

---

## Per-sport deltas

### NFL *(recorded)*
- **Postseason:** Playoffs, Wild Card, Divisional Round, Conference Championship, Super Bowl.
- **Conference & Division:** AFC / NFC + their East/West/North/South (team & opponent); Conference game,
  Divisional game.
- **Schedule extras:** Monday Night Football, Thursday Night Football; Bye / off a bye (Recent Form).
- **Season Stats:** Points differential, PPG, points-allowed/g, TD/g, pass TD/g, rush TD/g, pass yds/g,
  rush yds/g, more/less than league average.
- **Starters:** Starting QB (+ Opponent QB). **Officials:** Referee.

### CFB *(extrapolated from NFL)*
- **Postseason:** Bowl game, CFP First Round, CFP Quarterfinal, CFP Semifinal, National Championship
  *(12-team era; older years: BCS / 4-team CFP — map to nearest round).* We already model this as game-type
  (regular / bowl / playoff / postseason).
- **Conference & Division:** FBS conferences — SEC, Big Ten, Big 12, ACC, American, Mountain West, Sun Belt,
  MAC, Conference USA, Pac-12 *(historical)*, Independents (team & opponent). Conference game /
  Non-conference game. **Note:** most CFB divisions were dropped in 2024 realignment — offer conference
  membership, not divisions.
- **CFB-only (we already have):** Ranked matchup — Both ranked / Neither ranked / Home ranked only / Away
  ranked only / Either ranked. **Neutral site** (bowls) is common — surface it prominently.
- **Season Stats:** same football stat set as NFL.
- **Starters:** Starting QB (data dependent — CFB QB-availability feed is built but not yet live, see
  [[cfb-qb-injury-trigger]]). **Officials:** we dropped CFB referee/coach data — omit the Officials tab.

### MLB *(recorded)*
- **The Line:** Run Line replaces spread; also F5 (First Five) ML / RL / total as bet types.
- **Game & Situation:** Series Game #, Double Header Game 1 / Game 2.
- **Schedule:** Night game / Day game (instead of primetime).
- **Postseason:** Wild Card Series, Division Series, Championship Series, World Series.
- **Conference & Division → League & Division:** American / National League + AL/NL East/Central/West
  (team & opponent); Interleague, Same league, Divisional game.
- **Recent Form extras:** Runs scored/allowed, Same opponent last game, Extra innings, Sunday Night Baseball.
- **Season Stats:** Run differential, batting average, slugging %, runs/g, runs allowed/g, more/less runs
  than league average.
- **Starters:** Starting Pitcher, Starter ERA, Earned runs allowed in last start, Lefty / Righty (+ opponent
  pitcher). No ATS/Cover Profile tabs (baseball has no spread). **Officials:** none.

### NBA *(recorded)*
- **Postseason (series-based):** Series Game #, Round #, Playoff Series Wins / Losses, Playoffs, Series lead
  / Series deficit / Series tied.
- **Team & Rest extras:** 3 games in 4 days (fatigue).
- **Schedule:** Night game / Day game.
- **Conference & Division:** Western / Eastern Conference + Pacific/Atlantic/Southeast/Central/Southwest/
  Northwest (team & opponent); Conference game, Divisional game.
- **Recent Form extras:** Same opponent last game, Overtime.
- **Season Stats:** Points differential, PPG, points-allowed/g, Field Goal %, 3PT made/g, more/less than
  league average.
- **Starters / Officials:** none.

### NCAAB *(extrapolated from NBA)*
- **Postseason — parallel BREAKS (single elimination, no series):** replace all NBA series-state filters
  with tournament rounds — First Four, Round of 64, Round of 32, Sweet 16, Elite Eight, Final Four, National
  Championship. Add toggles: Conference Tournament, NCAA Tournament, Regular season.
- **Conference & Division → Conference only:** ~30+ D-I conferences (ACC, Big Ten, Big 12, SEC, Big East,
  Mountain West, WCC, AAC, A-10, …) for team & opponent; Conference game / Non-conference game. No divisions
  in college hoops.
- **Neutral site:** first-class (tournaments, MTE/holiday events) — surface prominently.
- **Drop "3 games in 4 days":** not a meaningful college pattern; keep plain Days-rest instead.
- **Season Stats:** same basketball set as NBA (PPG, PA/g, differential, FG%, 3PT/g, vs league average).
- **Starters / Officials:** none.

---

## Extrapolation confidence
- **CFB from NFL:** HIGH for structure. Adapted specifics (conferences, 12-team CFP, ranked matchup, neutral
  site, no divisions post-2024, no referee data) from domain knowledge + our existing CFB warehouse. Bowl/CFP
  round labels for pre-2024 seasons need a mapping pass when we wire postseason.
- **NCAAB from NBA:** HIGH for structure, with one deliberate break — series-state → single-elim tournament
  rounds. Conference list is large; pull the authoritative set from our NCAAB data when warehousing.
- Anything marked here as extrapolated is a proposal to confirm against real data at build time, not an
  assumption baked into code.
