## The short version

Grok Bot, ChatGPT Dots and Meta Muse can work on a task for hours while you do something else. Ask any of them a sports question out of the box, though, and it does what a chatbot has always done: it searches the web, reads whatever ranks, and writes a confident answer. Lines move, injury news changes by the hour, and a three-day-old article can still rank first.

The WagerProof connector gives your agent a direct line into the same data the WagerProof app runs on. That means current lines, a machine learning model's projection for every game, prediction market prices, injury reports for college football, and a historical database of results and betting lines. You add it once by pasting one address, and you sign in with your WagerProof account. After that, you ask normal questions in normal words.

The connector address is below, and its [setup page](https://wagerproof-mcp.habib225.workers.dev/docs) lists every tool it offers:

`https://wagerproof-mcp.habib225.workers.dev/mcp`

![The WagerProof connector page listing the setup steps, example prompts and tools](/guides/connect-ai-agent-sports-research/wagerproof-connector-docs-v1.webp "The connector's own setup page at wagerproof-mcp.habib225.workers.dev/docs, captured October 2, 2026.")

## What you can ask, with real answers

Every answer below came from the connector on Friday, October 2, 2026, around 3 p.m. Eastern. Lines will have moved by the time you read this, and that is the point: your agent pulls the current numbers each time you ask.

### "Who wins Lions vs Panthers on Sunday?"

The books have Detroit as a 3.5-point favorite (it opened at 3), with a total of 51 and Detroit at -197 on the moneyline. WagerProof's model disagrees sharply. It projects Carolina to win 29.9 to 21.6 and gives the Panthers a 72.6% chance to win outright. That 11.8-point gap between the model and the line is the biggest on the Sunday slate. The prediction market sides with the books: Polymarket had the Lions at 65 cents to win.

A good agent reports all three numbers and tells you they disagree. It should not pick one and call it a lock. The model rates this game a "lean," its lowest confidence tier.

### "What's the line on Chiefs vs Raiders?"

Kansas City is favored by 4.5, the total is 48, and the moneyline is Chiefs -215 and Raiders +180. The model projects Kansas City by 9.2 with a total of 46.75, so it leans Chiefs on the spread and slightly under on the total.

### "Should I take the over in Broncos vs 49ers?"

The total is 48. The model projects 57.65 points (Denver 29.7, San Francisco 27.9), which puts it almost 10 points over the line. The forecast at kickoff was 86 degrees with an 8.5 mph wind, so weather is not pulling the number down.

### "Any injuries I should know about for Alabama at Mississippi State?"

From the weekly college football injury report the connector carries, Alabama listed wide receiver A. Walker as questionable. Mississippi State listed wide receiver A. Williams and defensive lineman T. Williams out with leg injuries, wide receiver B. Mitchell out, guard J. Freeman questionable and running back F. Bothwell probable. The connector also tells your agent that college injury reporting is not mandatory, so a team with no listings may simply not have reported. Alabama is a 5.5-point favorite, and the model projects the Tide by 13.8.

### "What are the best bets this weekend?"

This is the question most people ask first. With the connector, a careful agent answers it by showing where the model is furthest from the line and labelling those as research leads, not guarantees:

| Game | Line | WagerProof model | Gap |
|---|---|---|---|
| Lions at Panthers | Lions -3.5 | Panthers by 8.3 | 11.8 pts |
| Titans at Ravens | Ravens -11.5 | Ravens by 3.0 | 8.5 pts |
| Cardinals at Giants | Cardinals -2.5 | Giants by 5.8 | 8.3 pts |
| Rams at Eagles | Rams -3.5 | Rams by 11.0 | 7.5 pts |
| Jaguars at Bengals (total) | 51.5 | 38.5 points | 13.0 pts |

### "Who are the strongest picks this weekend, and why?"

Ask for strong picks and a connected agent can rank them by how confident the model is, not by how loud a headline is. On Saturday's college slate, these were the model's highest cover probabilities:

| Pick | Line | Model projection | Model cover chance |
|---|---|---|---|
| UConn vs Syracuse | UConn +7 | UConn wins by 4.6 | 77.7% |
| Colorado State vs Oregon State | Colorado State +6.5 | Colorado State wins by 1.7 | 70.5% |
| South Florida vs Temple | South Florida -6 | South Florida by 14 | 70.1% |
| Louisiana Tech vs Army | Louisiana Tech +1.5 | Louisiana Tech by 5.9 | 68.8% |
| Iowa vs Ohio State | Iowa +14.5 | Ohio State by 7.6 | 67.4% |

The evidence travels with each pick: the line, the projected score, and the probability. The model's chance is an estimate, so roughly a quarter to a third of picks like these will still lose.

### "Show me strong player streaks for this weekend"

The connector carries this week's player prop lines and every player's game log, so your agent can check who has been clearing their number. A few that stood out on October 2, using each player's last 10 games against this week's line:

| Player | Prop this week | Hit rate | Last 10 games |
|---|---|---|---|
| Matthew Stafford, Rams | Over 249.5 passing yards | 9 of 10 | Averaging 316 yards |
| Trey McBride, Cardinals | Over 6.5 receptions | 8 of 10, and the last 5 straight | Averaging 8.1 catches |
| Rome Odunze, Bears | Over 31.5 receiving yards | 8 of 10, and the last 5 straight | Averaging 41.5 yards |
| Tony Pollard, Titans | Over 47.5 rushing yards | 8 of 10 | Averaging 75.3 yards |

A streak is evidence, not a promise. Ask your agent the follow-up too: "Is anything different this week, like the opponent, the weather or an injury?"

### "What's a good parlay for this weekend?"

A connected agent can build a parlay where every leg has its own reason, then show you what the combined price really means. Here is one built from the answers above:

1. **UConn +7** (Saturday): the model projects UConn to win outright and gives it a 77.7% chance to cover.
2. **Trey McBride over 6.5 receptions** (-137): over in 8 of his last 10 games and his last 5 in a row.
3. **Matthew Stafford over 249.5 passing yards** (-113): over in 9 of his last 10, averaging 316.

At -110 on the first leg, the three legs pay about +520, which means the price implies roughly a 16% chance that all three hit. Each leg can look strong and the parlay can still be a long shot, because every leg has to win. A good agent says that out loud.

## Ask about your hunches

This is where a connected agent beats a search engine. You can describe a feeling in plain words and get a count instead of an opinion.

### "My gut says fade the Lions on the road. Am I wrong?"

The record disagrees with your gut. Since 2023, Detroit is 19-9 against the spread on the road (67.9%). The model, though, likes Carolina by more than a touchdown on Sunday. Now you have evidence on both sides, and you can decide how much weight each one gets.

### "Do teams bounce back after getting blown out?"

Barely. From 2018 through 2025, NFL teams that lost their previous game by 14 or more covered 50.7% of the time in the next game (661 games). That is close to a coin flip, so the bounce-back story is mostly a story.

### "Are division underdogs a good bet?"

Slightly. Underdogs in division games covered 52.6% of the time across 753 games from 2018 through 2025, and small favorites (under a touchdown) in division games covered only 46.2%. That is a modest lean over a big sample, the kind of thing worth checking against this week's lines.

### "Should I bet the under when it's windy?"

A web search gives you opinions. The connector can count. In NFL games since 2018 played outdoors with wind of 15 mph or more, the game went over the closing total 42.7% of the time, across 96 games. That leans under, and 96 games is a modest sample, so treat it as one input.

### "Do home underdogs cover more in prime time?"

This one is popular on social media, and the data says no. From 2018 through 2025, home underdogs of 3 or more points covered 59 of 116 prime-time games (50.9%) and 234 of 458 other games (51.1%). The connector is just as useful for killing a theory as for finding one.

## Your agents and the community

### "Which WagerProof agents are winning, and what are they picking?"

The connector reads the public WagerProof agent leaderboard. On October 2 the top agent by all-time units was Gimme Dat chedda at 98-91 and +54.4 units, followed by My First Agent! at 58-30-1 and +46.0 units. Ask what the top agents are playing tonight and your agent lists their picks, including any picks two or more of them share.

### "How are my agents doing this week?"

Once you sign in, the connector can also read your own WagerProof agents, their picks and their graded records. It cannot change them.

## How to connect it

Each agent connects to outside data a little differently ([PortEden's comparison](https://porteden.com/blog/openai-dots-vs-muse-vs-grok-bot/) summarizes the differences), but the steps are the same idea in every agent. Open the agent on the web, add a custom connector, paste the address above, and sign in with the account you use in the WagerProof app.

Your agent will warn you that the connector is unverified or custom. That is expected. WagerProof has not been listed in any connector directory yet, so confirm the address ends in `wagerproof-mcp.habib225.workers.dev/mcp` and continue.

### Grok Bot

[[VERIFY: exact menu path, captured from a real session, with screenshot]]

### ChatGPT Dots

[[VERIFY: whether a Dot can use a custom ChatGPT connector, the exact steps, with screenshot]]

### Meta Muse

[[VERIFY: whether Muse accepts a remote connector address; if not, say so plainly]]

## Make it run every day

The reason to use an always-on agent instead of a chat window is that it can do the work on a schedule. Give it a standing job in plain words:

- "Every morning at 9, tell me which games today have the biggest gap between WagerProof's model and the line."
- "Every Sunday at 11 a.m., list injuries for my teams and how the line moved since Wednesday."
- "After the games tonight, check how my WagerProof agents did and send me the record."

[[VERIFY: a real scheduled run and its output]]

## What the connector can and cannot do

It reads data. It cannot place a bet, move money, or change anything in your WagerProof account. You can disconnect it at any time from your agent's connector settings.

The model's numbers are estimates. A large gap between the model and the line is a reason to look closer, not proof the line is wrong. Every one of the games above can go the other way. Bet only what you can afford to lose, and if betting stops being fun, the National Problem Gambling Helpline is 1-800-GAMBLER.
