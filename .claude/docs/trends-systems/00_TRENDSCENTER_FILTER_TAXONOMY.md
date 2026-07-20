# TrendsCenter Filter Taxonomy (reverse-engineered reference)

**Source:** three screen recordings of the TrendsCenter iOS app's "Create trend" screen
(NFL / Spread, MLB / Money line, NBA / Over), captured 2026-07-18 and transcribed frame-by-frame.

**Why this exists:** WagerProof is building a TrendsCenter-style "Systems" feature (verdict-first
trends users can build, save, rank on a leaderboard, and get today's matching games for). This is the
inventory of what TrendsCenter offers so we can match/beat it. See the sibling docs in this folder for
the feature spec.

**Legend:** `+` = configurable value/range picker (numeric). `○` = boolean toggle condition.
👑 = premium-gated in TrendsCenter.

---

## Screen model (how TrendsCenter presents it)

- Top: **sport picker** (NCAAB, NCAAF, NFL, NHL, NBA, MLB) + **bet-type tabs**.
  - NFL/NBA/NCAA bet types: **Spread · Money line · Over · Under**
  - MLB bet types: **Money line · Over · Under** (+ Run Line as a *filter*, not a top tab)
- A stat strip that updates live as conditions are added: **Units · ROI · Win rate · Record · Score · Active · Last 10 · Streak**
- A horizontal scroller of **category tabs**; each tab reveals a scrolling list of filter rows.
- "N conditions" collapsible summary. "Next" saves the trend.

The atomic unit is a **condition** (independent predicate). A trend = a stack of conditions →
**one system record** (units/ROI/win%/record/streak/last-10). This single-verdict output is the whole
UX difference vs. WagerProof's current multi-breakdown analytics page.

---

## Category tabs (union across sports)

Game · Day and Time · Betting Info · Playoffs · Team · Opponent · Previous Season · League ·
Previous Game · Previous Matchup · Opponent Previous Game · Team Wins · Opponent Wins · Team ATS ·
Opponent ATS · Team O/U · Opponent O/U · Team Stats · Opponent Stats · Quarterback / Pitcher ·
Opponent Quarterback / Opponent Pitcher · Referee (NFL, label only)

NBA adds richer **Playoffs** (series state). MLB swaps ATS→Run Line semantics and QB→Pitcher.

---

## NFL (Spread) — full filter list

### Game
- Season `+`, Week # `+`, Game # `+`
- 2026 season ○, Home ○, Away ○, Regular Season ○

### Day and Time
- Date `+`, Time `+`
- Prime time 👑 (after 7 PM EST), Non Prime time ○ (before 7 PM EST)
- Monday ○, Tuesday ○, Wednesday ○, Thursday ○, Friday ○, Saturday ○, Sunday ○
- Monday Night Football ○, Thursday Night Football ○

### Playoffs
- Playoffs 👑, Wild Card 👑, Divisional Round 👑, Championship Round 👑, Super Bowl 👑

### Betting Info
- Moneyline `+`, Opponent's Moneyline `+`, O/U `+`, Spread `+`
- Favorite ○, Underdog ○

### Team
- Team `+`, Rest `+` (days rest before game)
- Rest Advantage 👑, Rest Disadvantage 👑, Equal Rest 👑

### Opponent
- Opponent `+`, Opponent Rest `+`

### Previous Season (all 👑 for numeric; ○ for booleans)
- Previous Season Wins 👑, Opp Previous Season Wins 👑, Previous Season Losses 👑, Opp Previous Season Losses 👑
- Previous Season Win % 👑, Opp Previous Season Win % 👑, Previous Season Playoff Wins 👑, Opp Previous Season Playoff Wins 👑
- More Wins Than Opponent ○, Less Wins Than Opponent ○
- Made Playoffs Last Season ○, Missed Playoffs Last Season ○, Opp Made Playoffs Last Season ○, Opp Missed Playoffs Last Season ○

### Previous Game (numeric all 👑)
- Home Stand 👑 (consecutive home games), Road trip 👑 (consecutive away games)
- Points Scored 👑, Points Allowed 👑, Spread 👑, Moneyline 👑, O/U 👑, Margin of victory/loss 👑, ATS Margin of victory/loss 👑
- Loss ○, Win ○, Home ○, Away ○
- Bye 👑, No Bye 👑, ATS Win 👑, ATS Loss 👑, Over 👑, Under 👑, Underdog 👑, Favorite 👑

### Previous Matchup (H2H last meeting vs this opponent)
- Week `+`, Spread `+`, Moneyline `+`, O/U `+`, Margin of victory/loss 👑
- Loss ○, Win ○, Home ○, Away ○, ATS Win ○, ATS Loss ○, Over ○, Under ○, Underdog ○, Favorite ○
- Lower Spread 👑, Higher Spread 👑, Lower Or Equal Spread 👑, Higher Or Equal Spread 👑
- Overtime ○, Prime Time ○, Non Prime Time ○, Same Season ○, Different Season ○, Playoffs ○, Regular Season ○

### Opponent Previous Game (mirror of Previous Game; numeric 👑)
- Opp Home Stand 👑, Opp Road Trip 👑, Opp Points Scored 👑, Opp Points Allowed 👑, Opp Spread 👑, Opp O/U 👑, Opp Margin 👑, Opp ATS Margin 👑
- Opp Loss ○, Opp Win ○, Opp Home ○, Opp Away ○
- Opp Overtime 👑, Opp ATS Win 👑, Opp ATS Loss 👑, Opp Over 👑, Opp Under 👑, Opp Underdog 👑, Opp Favorite 👑

### League (conference/division membership — all ○)
- Non Conference Opponent, Conference Opponent, Non Divisional Opponent, Divisional Opponent
- AFC + AFC East/West/South/North, NFC + NFC East/West/South/North (team)
- Same set of "… Opponent" variants (opponent's conference/division)

### Team Wins (season-to-date, "at the time of the game")
- Win % `+`, Win % Differential `+`, Winning Streak `+`, Losing Streak `+`
- Below .500 ○, Above .500 ○
- Win % {Greater / Greater-or-Equal / Less / Less-or-Equal / Equal} to Opponent's ○

### Opponent Wins
- Opp Win % `+`, Opp Winning Streak `+`, Opp Losing Streak `+`, Opp Below .500 ○, Opp Above .500 ○

### Team ATS (season-to-date, all 👑)
- Average ATS Margin 👑, ATS Win % 👑, ATS Win Streak 👑, ATS Loss Streak 👑

### Opponent ATS (all 👑)
- Opp Average ATS Margin 👑, Opp ATS Win % 👑, Opp ATS Win Streak 👑, Opp ATS Loss Streak 👑

### Team O/U (season-to-date)
- Team Over % `+`, Team Under % `+`, Team Over Streak `+`, Team Under Streak `+`

### Opponent O/U
- Opp Over % `+`, Opp Under % `+`, Opp Over Streak `+`, Opp Under Streak `+`

### Team Stats (season-to-date)
- Points Differential 👑, Points Per Game 👑, Points Allowed Per Game 👑
- Touchdowns/G `+`, Passing TD/G `+`, Rushing TD/G `+`, Passing Yds/G `+`, Rushing Yds/G `+`
- More/Less Points Per Game than League Average 👑, More/Less Points Allowed Per Game than League Average 👑

### Opponent Stats (mirror)

### Quarterback
- Starting QB `+`

### Opponent Quarterback
- Opposing Starting QB `+`

### Referee
- Tab exists; contents not captured (never opened in recording).

---

## MLB (Money line) — deltas vs NFL

- **Game:** Series Game # `+` (game # of the series), Double Header Game 1 👑, Double Header Game 2 👑
- **Day and Time:** Night game ○ / Day game ○ (instead of Prime/Non-Prime)
- **Betting Info:** Run Line `+` (instead of Spread)
- **Playoffs:** Wild Card 👑, Divisional Series 👑, Championship Series 👑, World Series 👑
- **League:** Interleague ○, Same league ○, American League ○, National League ○ + AL East/West/Central, NL East/West/Central (team + opponent variants)
- **Previous Game:** Runs Scored/Allowed 👑, Same Opponent 👑, Extra Innings 👑, Sunday Night Baseball 👑
- **Team Stats:** Run Differential 👑, Batting Average 👑, Slugging % 👑, Runs/G 👑, Runs Allowed/G 👑, More/Less Runs vs League Avg 👑
- **Pitcher:** Starter 👑, Starter ERA 👑, Starter Earned Runs Allowed in last start 👑, Lefty Pitcher 👑, Righty Pitcher 👑
- **Opponent Pitcher:** mirror, all 👑
- No ATS tabs (baseball has no spread; Run Line is the substitute — note TrendsCenter did NOT show Run-Line ATS-style season tabs).

---

## NBA (Over) — deltas vs NFL

- **Game:** 2025 season ○ (current season)
- **Playoffs (richer):** Series Game # `+`, Round # `+`, Playoff Series Wins `+`, Playoff Series Losses `+`, Playoffs 👑, Series Lead 👑, Series Deficit 👑, Series Tied 👑
- **Team / Opponent:** Third game in 4 days ○ (fatigue), Rest Advantage/Disadvantage/Equal 👑
- **League:** Western/Eastern Conference + Pacific/Atlantic/Southeast/Central/Southwest/Northwest divisions (team + opponent)
- **Previous Game:** Same Opponent 👑, Overtime 👑 (no Bye — NBA)
- **Team Stats:** Points Differential 👑, PPG 👑, PA/G 👑, Field Goal % 👑, 3PT Made/G 👑, More/Less vs League Avg 👑
- No QB/Pitcher tabs.

---

## Gap analysis vs WagerProof (as of 2026-07-18)

TrendsCenter's ~150 filters/sport fall into three buckets for us:

### Bucket A — WagerProof already has (static game/line attributes)
Season, week/game #, current-season, home/away, reg/playoffs + rounds, date/time, primetime & day-of-week,
ML/spread/total/run-line ranges, favorite/underdog, team, opponent, rest/bye, divisional/conference,
starting QB (NFL), starting pitcher + handedness + ERA (MLB). WagerProof is actually **ahead** here — we
also have weather, dome, park factor, xFIP, bullpen IP, temp/wind, coach, referee.

### Bucket B — WagerProof partially has (last-game / previous-game)
Our "Last game" filters (football) cover result / ATS / total / role / blowout / OT. TrendsCenter goes
further: previous-game numeric (points scored/allowed, prev spread/ML/O·U, margins), Home Stand / Road trip,
plus a full **Opponent Previous Game** mirror and a **Previous Matchup (H2H)** chain we don't have.

### Bucket C — NET-NEW data engineering (most of their 👑 premium filters)
Season-to-date, "**at the time of the game**" rolling state, computed per team-game:
- Win % / win%-differential / winning & losing streaks / above-below .500 / win% vs opponent comparisons
- ATS: avg ATS margin, ATS win %, ATS win/loss streaks (team & opponent)
- O/U: over% / under% / over-streak / under-streak (team & opponent)
- Team & Opponent season stats: PPG, PA/G, differential, TD/G, pass/rush yds/g (NFL); batting avg, slugging,
  run diff, runs/g (MLB); FG%, 3PT/G (NBA); "more/less than league average" booleans
- Previous Season: wins/losses/win%/playoff-wins, made/missed playoffs, more/less wins than opponent
- Previous Matchup (H2H last meeting) full chain
- Playoff series state (NBA): series lead/deficit/tied, series wins/losses, round #
- Fatigue: consecutive home/away (home stand / road trip), third-game-in-4-days (NBA), bye (NFL)

**Bucket C is the crux of doing this cleanly.** It requires an *as-of-game feature store*: one row per
team-per-game with every rolling/season-to-date value computed using only games that had already happened
at kickoff (leak-safe). Some seeds already exist (`nfl/cfb_analysis_base`, `*_team_trends` game_log with
is_home/spread/results/splits/matchups, plus the research warehouses). This is a feature-engineering job,
not just UI.
