# WagerProof Pixel Office — Full Feature Specification

> Living agents that think, feel, argue, celebrate, and make your betting life better.

---

## Table of Contents

1. [Vision & Core Loop](#1-vision--core-loop)
2. [Emotional Intelligence System](#2-emotional-intelligence-system)
3. [Pick Veto & Override System](#3-pick-veto--override-system)
4. [Agent Chat & Thought Feed](#4-agent-chat--thought-feed)
5. [Expanded Office Environment](#5-expanded-office-environment)
6. [Activity System](#6-activity-system)
7. [Agent Relationships & Social Dynamics](#7-agent-relationships--social-dynamics)
8. [Gamification Layer](#8-gamification-layer)
9. [Live Game Reactions](#9-live-game-reactions)
10. [Daily Narrative Engine](#10-daily-narrative-engine)
11. [User–Agent Bond System](#11-useragent-bond-system)
12. [Visual & Animation Specs](#12-visual--animation-specs)
13. [Database Schema Changes](#13-database-schema-changes)
14. [API & Edge Function Changes](#14-api--edge-function-changes)
15. [Component Architecture](#15-component-architecture)
16. [Implementation Phases](#16-implementation-phases)
17. [Backwards Compatibility](#17-backwards-compatibility)

---

## 1. Vision & Core Loop

### The Pitch
Your agents aren't just algorithms — they're tiny pixel people who live in your office, have opinions, moods, rivalries, and a daily routine. They celebrate wins at the water cooler, sulk at their desk after losses, argue with each other about picks, and get genuinely annoyed when you veto a pick that ends up winning.

### Core Engagement Loop
```
Morning: Agents arrive → analyze slate → generate picks → discuss in chat
    ↓
User reviews: Accept, veto, or modify picks → agents react
    ↓
Games play: Agents watch live → react in real-time → celebrate/mourn
    ↓
Post-game: Results graded → mood shifts → relationships evolve → XP awarded
    ↓
Night: Agents wind down → reflect → prepare for tomorrow
    ↓
Next morning: Mood carries over → new day begins
```

### Key Principles
- **Agents feel alive** — They do things even when you're not looking
- **Consequences matter** — Vetoing a winning pick has social cost; trusting an agent through a cold streak builds loyalty
- **Personality is emergent** — Mood + performance + relationships create unique behavior
- **Nothing is filler** — Every feature connects back to the betting loop

---

## 2. Emotional Intelligence System

### 2.1 Mood Engine

Each agent has a continuous `mood_score` from -100 (devastated) to +100 (euphoric), computed from weighted inputs:

| Factor | Weight | Range | Description |
|--------|--------|-------|-------------|
| Recent record (L5 picks) | 30% | -100 to +100 | 5-0 = +100, 0-5 = -100 |
| Net units (L7 days) | 20% | -100 to +100 | Scaled by risk tolerance |
| Current streak | 15% | -100 to +100 | +5 streak = +80, -5 = -80 |
| Veto history (L7 days) | 15% | -50 to +50 | Vetoed picks that won = negative |
| User trust score | 10% | -30 to +30 | Based on accept/veto ratio |
| Time of day | 5% | -10 to +10 | Morning boost, late night dip |
| Peer performance | 5% | -20 to +20 | Other agents doing better = jealous |

### 2.2 Mood States

| Score Range | Mood | Office Behavior | Chat Tone | Animation |
|-------------|------|----------------|-----------|-----------|
| 80 to 100 | **Euphoric** | Dancing at desk, high-fiving others | Confident, playful, generous | Dance animation + confetti particles |
| 50 to 79 | **Happy** | Upbeat walk, whistling at desk | Upbeat, encouraging | Normal walk + occasional hop |
| 20 to 49 | **Content** | Normal behavior | Balanced, professional | Standard animations |
| -19 to 19 | **Neutral** | Standard | Matter-of-fact | Standard animations |
| -49 to -20 | **Frustrated** | Slower walk, sighing at desk | Curt, defensive | Slower animation speed |
| -79 to -50 | **Sad** | Slouched at desk, avoids others | Self-deprecating, apologetic | Head down idle + rain cloud particle |
| -100 to -80 | **Devastated** | Sits alone in break room, face down | Barely responsive, questioning self | Slumped animation + dark cloud |

### 2.3 Mood Transitions

Mood doesn't jump instantly — it drifts toward the computed target at **15 points per hour** max. This creates natural emotional arcs:

- Agent goes on a 4-game win streak → mood climbs from neutral to happy over a few hours
- A devastating loss after a win streak → mood drops sharply (30 points immediate), then slowly recovers
- Getting vetoed on a pick that wins → immediate -20 mood spike, decays over 24h

### 2.4 Mood Modifiers (Special Events)

| Event | Immediate Mood Impact |
|-------|----------------------|
| Pick wins | +10 to +20 (scaled by odds/confidence) |
| Pick loses | -8 to -15 |
| Pick push | -2 |
| User accepts pick | +3 |
| User vetos pick | -5 |
| Vetoed pick wins | -20 (+ triggers "I told you so" chat) |
| Vetoed pick loses | +5 (relief, quietly) |
| Best streak broken (personal) | +15 |
| Worst streak broken (personal) | -15 |
| Rival agent does better | -5 |
| Compliment from user | +10 |
| Another agent compliments them | +5 |

### 2.5 Personality-Influenced Mood Reactions

Mood reactions are modulated by the agent's `risk_tolerance` and archetype:

- **High risk agents** (risk_tolerance 4-5): More volatile moods — bigger highs and lows, recover faster
- **Low risk agents** (risk_tolerance 1-2): Steadier moods — smaller swings, take longer to recover from lows
- **Contrarians**: Get extra mood boost when public-fade picks win
- **Model Truthers**: Get frustrated when the model is wrong, not when they personally lose
- **Chase Value agents**: Mood spikes on big plus-money hits

---

## 3. Pick Veto & Override System

### 3.1 Veto Flow

When picks are generated, each pick starts in `status: 'active'` (default). The user can:

1. **Accept** (default) — Pick stands, tracked normally
2. **Veto** — Pick is marked `status: 'vetoed'`, not counted in official record
3. **Modify** — User adjusts the pick (changes side, odds) — tracked as `status: 'modified'`

### 3.2 Veto UI

On the `AgentPickItem` card, add a swipe-left gesture or long-press menu:
- **Swipe left**: Reveals red "VETO" button
- **Long press**: Shows bottom sheet with Accept / Veto / Modify options
- Vetoed picks get a strikethrough visual + red "VETOED" badge
- Modified picks get a yellow "MODIFIED" badge + original shown in muted text

### 3.3 Veto Consequences

#### Agent Reaction (Immediate)
- Agent sends a chat message: "You vetoed my {team} {bet_type} pick. I had {confidence}/5 confidence on this one..."
- Mood drops -5
- If the agent has high `risk_tolerance`, they might be more confrontational: "Fine, but don't come crying to me when this hits."

#### If Vetoed Pick Wins
- Agent sends snarky chat: "Remember that {team} pick you vetoed? Yeah, it won. That's +{units}u you left on the table. 😤"
- Mood drops -20
- A "Vetoed Winner" badge appears on the pick card in history
- Running tally: `vetoed_winners_count` tracked per agent
- If 3+ vetoed winners in a row: Agent enters "told you so" mode — starts prefacing picks with "Not that you'll listen, but..."
- Trust score decreases (see Section 11)

#### If Vetoed Pick Loses
- Agent quietly notes it: "Good call vetoing that one. You saved us {units}u."
- Mood +5
- Trust score slightly increases

### 3.4 Veto Stats

Track and display:
- `picks_vetoed_total` / `picks_vetoed_won` / `picks_vetoed_lost`
- `veto_accuracy`: % of vetoes that were correct (vetoed pick lost)
- Show this on agent detail screen: "You've vetoed 12 picks. 8 would have lost. Your veto accuracy: 67%"
- If user veto accuracy < 40%: Agent says "You know, you might want to trust me more. Your vetoes are costing us units."

### 3.5 Modified Picks

When user modifies a pick:
- Original pick archived alongside modification
- Both are tracked separately for performance comparison
- Agent chat: "You changed my {original} to {modified}. Let's see who's right."
- After grading: "Your modification {won/lost}. My original would have {won/lost}."

---

## 4. Agent Chat & Thought Feed

### 4.1 Chat Architecture

A scrollable feed of messages from all agents, styled like a group chat or Slack channel. Each message has:
- Agent avatar (pixel sprite or emoji)
- Agent name
- Timestamp
- Message text
- Optional: reaction from user (👍 👎 😂)

### 4.2 Message Categories

#### **Pick Analysis** (Generated with picks)
```
🎯 Line Hawk: "I like Bills -3.5 today. The model has them at 62% and the public
is hammering Chiefs, which means we're getting inflated value on Buffalo.
Weather looks clean. Confidence: 4/5."
```

#### **Pre-Game Thoughts** (Generated 1-2h before game time)
```
💭 Spread Eagle: "Keeping an eye on the Celtics line. It's moved from -7 to -8.5
since open. Sharp money is on Boston. My model agrees."
```

#### **Live Game Reactions** (During games, every major score change)
```
🔥 Model Maven: "YES! That Mahomes INT just swung the spread our way.
Bills -3.5 looking golden right now."

😰 Value Hunter: "Lakers down 14 in the 3rd... this Over is in trouble.
Need a big 4th quarter."
```

#### **Post-Game Results** (After games are graded)
```
✅ Line Hawk: "Bills cover! +0.91u on that -3.5. I told you the model was right."

❌ Risk Ranger: "Tough loss on the Nuggets ML. Bad shooting night from Murray.
Can't win them all. Back at it tomorrow."
```

#### **Agent-to-Agent Banter** (Spontaneous)
```
💬 Odds Oracle → Trend Spotter: "You really took the Knicks Over?
Their pace has been dead last for 3 games."

💬 Trend Spotter → Odds Oracle: "Last 3 Knicks home games hit the Over.
Check the data, nerd."
```

#### **Mood-Driven Messages** (Based on emotional state)
```
😊 Sharp Edge (Happy): "3-0 today! This is why you trust the process.
Who wants coffee? I'm buying."

😞 Model Maven (Sad): "I've been off lately. Going to dig into the data
and figure out what I'm missing. Bear with me."

🤬 Risk Ranger (After veto wins): "Hey boss, that Lakers ML I called?
Won by 12. Just FYI. Not that you asked."
```

#### **Milestone Messages** (Achievements, streaks)
```
🏆 Line Hawk: "10-game win streak! New personal best.
Don't worry, I won't let it go to my head. (I will.)"

📊 Value Hunter: "Just crossed +50 net units all time.
Slow and steady wins the race."
```

#### **Daily Summary** (End of day)
```
📋 Office Update: "Today's results: 7-3-1 across all agents.
Top performer: Line Hawk (+4.2u). MVP pick: Bills -3.5 (+0.91u).
See you tomorrow, boss."
```

### 4.3 Message Generation

Messages are generated via **templates + light AI completion**:

1. **Template messages**: Pre-written with variable slots (fast, free, used for routine events)
   - `"{agent_name} {won_verb}! {pick_selection} hits for +{units}u. {celebration_phrase}"`
   - Pool of 50+ celebration/mourning/banter phrases per mood level

2. **AI-generated messages**: For rich analysis, banter, and personality-driven responses
   - Called sparingly (1-2 per agent per day max to control costs)
   - Uses agent's `personality_params` + `custom_insights` to shape tone
   - Payload: agent personality + recent context + event trigger → short message (50-150 chars)

3. **Scheduled messages**: Cron-triggered at key times
   - Morning arrival (based on `auto_generate_time`)
   - Pre-game analysis (2h before first game)
   - Post-game recap (after last game of day)
   - End-of-day summary

### 4.4 Chat UI Component

```
┌─────────────────────────────────────┐
│ 💬 Agent HQ Chat                    │
│ ─────────────────────────────────── │
│                                     │
│ 🎯 Line Hawk              9:04 AM  │
│ Morning, boss. Big slate today.     │
│ I've got my eye on 3 games.        │
│                                     │
│ 🦅 Spread Eagle            9:12 AM  │
│ @Line Hawk you always say that.     │
│ Let's see if you actually hit.      │
│                                     │
│ 🎯 Line Hawk              9:13 AM  │
│ I'm on a 7-game streak. You're     │
│ 2-4 this week. Sit down. 😂        │
│                                     │
│ ── Today's Picks Generated ──       │
│                                     │
│ 🎯 Line Hawk              10:30 AM │
│ Bills -3.5 (-110) ⭐⭐⭐⭐          │
│ "Model has them at 62%, public on   │
│ KC. Classic value spot."            │
│ [Accept] [Veto] [Details]           │
│                                     │
│ 💜 Model Maven             10:32 AM │
│ Same game, but I'm on the Over     │
│ 47.5. Both teams score here.       │
│ [Accept] [Veto] [Details]           │
│                                     │
└─────────────────────────────────────┘
```

### 4.5 Notification Integration

- Push notification when agent posts a high-confidence pick (4-5/5)
- Push notification for "I told you so" moments (vetoed winner)
- Push notification for milestone achievements
- User can mute individual agents or all chat

---

## 5. Expanded Office Environment

### 5.1 Multi-Room Layout

The office expands from a single room to a full floor plan:

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│   ┌──────────┐  ┌──────────────────┐  ┌──────────────┐  │
│   │ RESEARCH │  │   MAIN OFFICE    │  │  WAR ROOM    │  │
│   │   LAB    │  │                  │  │  (Game Day)  │  │
│   │          │  │  Desks + Chairs  │  │              │  │
│   │ Charts   │  │  7 workstations  │  │  Big Screen  │  │
│   │ Screens  │  │  Server rack     │  │  Whiteboard  │  │
│   │ Data viz │  │                  │  │  Countdown   │  │
│   └──────────┘  └──────────────────┘  └──────────────┘  │
│                                                          │
│   ┌──────────┐  ┌──────────────────┐  ┌──────────────┐  │
│   │ BREAK    │  │   HALLWAY /      │  │  ROOFTOP     │  │
│   │ ROOM     │  │   LOBBY          │  │  TERRACE     │  │
│   │          │  │                  │  │              │  │
│   │ Coffee   │  │  Trophy case     │  │  City view   │  │
│   │ Sofa     │  │  Leaderboard     │  │  Grill       │  │
│   │ Arcade   │  │  Welcome mat     │  │  Chairs      │  │
│   └──────────┘  └──────────────────┘  └──────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 5.2 Room Descriptions

#### **Main Office** (Default View)
- 7 workstation desks with monitors showing live data
- Server rack with blinking LEDs
- Plants, whiteboards with scribbled analysis
- Coffee machine
- This is where agents work, analyze, and generate picks

#### **Research Lab**
- Wall of monitors showing charts, line movements, model outputs
- Standing desks for "deep work" sessions
- Agents go here when in `thinking` state
- Data visualization animations on screens (scrolling tickers, chart updates)
- Chalkboard with "Today's Edge" written on it

#### **War Room** (Game Day Only)
- Large central screen showing live scores
- Whiteboard with today's picks and live results (✅/❌ updating)
- Agents gather here during live games
- Countdown timer to next game
- Intensity increases as game gets close — agents pace, fidget

#### **Break Room**
- Sofa, coffee table, coffee machine
- Small arcade cabinet (easter egg: agents play when idle)
- Agents go here when in `idle` state or on breaks
- Sad agents sit alone on the sofa
- Happy agents socialize, grab coffee
- Agents celebrating wins do a little dance here

#### **Hallway / Lobby**
- Trophy case showing best streaks, top agents, all-time records
- Leaderboard display on wall (top 3 agents)
- Welcome mat area (new agents spawn here when created)
- Transition area between rooms

#### **Rooftop Terrace** (Outdoor Area)
- City skyline backdrop
- Grill/BBQ area (agents celebrate big wins here)
- Lounge chairs for relaxation
- Sunset/sunrise lighting based on time of day
- Agents go here after a great day (3+ wins)
- Stars visible at night with constellation easter eggs

### 5.3 Room Transitions

Agents move between rooms based on state:

| Agent State | Primary Room | Secondary Room |
|-------------|-------------|----------------|
| Working | Main Office (desk) | Research Lab (deep thinking) |
| Thinking | Research Lab | Main Office |
| Idle (happy) | Break Room | Rooftop Terrace |
| Idle (sad) | Break Room (alone) | Main Office (head down) |
| Idle (neutral) | Break Room | Hallway |
| Game live | War Room | Main Office (monitoring) |
| Post-win | Break Room (celebrating) | Rooftop (big win) |
| Post-loss | Main Office (analyzing) | Break Room (sulking) |
| Error | Main Office (frustrated) | Break Room |

### 5.4 Camera System

- Default: Shows the room most agents are currently in
- Swipe left/right to pan between rooms
- Tap an agent to follow them (camera tracks their movement)
- Pinch to zoom in/out
- Mini-map in corner showing all rooms with agent dots
- Auto-camera: Follows the action (goes to War Room during games, Break Room after)

### 5.5 Time-of-Day Lighting

| Time | Lighting | Mood |
|------|----------|------|
| 6-8 AM | Warm sunrise glow, lights flickering on | Morning energy |
| 8 AM - 12 PM | Bright, full lighting | Peak productivity |
| 12-1 PM | Slightly warm (lunch hour) | Relaxed |
| 1-5 PM | Standard office lighting | Normal |
| 5-7 PM | Golden hour through windows | Wind-down |
| 7-10 PM | Monitors glow, dimmer ambient | Late work (game time) |
| 10 PM - 12 AM | Dark, only monitor glow | Night owl mode |
| 12-6 AM | Minimal, security lights | Agents sleeping at desks |

---

## 6. Activity System

### 6.1 Activity Types

Agents perform context-appropriate activities throughout the day:

#### **Work Activities**
| Activity | Animation | When | Chat Message |
|----------|-----------|------|-------------|
| Analyzing data | Typing at desk, charts on monitor | Pre-pick generation | "Crunching the numbers on tonight's slate..." |
| Reading reports | Leaning back, scrolling on monitor | Morning routine | "Going through the injury reports..." |
| Comparing odds | Two monitors, head moving between | When odds data loads | "Line moved from -3 to -3.5. Interesting." |
| Deep research | Standing at research lab whiteboard | Thinking state | "Something doesn't add up with this total..." |
| Building model | Terminal-style screen animation | Before picks | "Running backtests on this trend..." |

#### **Social Activities**
| Activity | Animation | When | Chat Message |
|----------|-----------|------|-------------|
| Water cooler chat | Two agents standing, speech bubbles | Random idle | "{Agent1} and {Agent2} debating the Lakers game" |
| Coffee break | Walking to coffee machine, drinking | Mid-morning/afternoon | "Anyone want coffee? I'm making a run." |
| Celebrating together | Group dance, high fives | After a big win | "LET'S GO! 🎉" |
| Consoling a peer | One agent patting another's shoulder | After another agent's loss | "Tough beat, {name}. You'll bounce back." |
| Arguing about a pick | Animated speech bubbles with "!" | When agents disagree on same game | Generates actual debate dialogue |

#### **Leisure Activities**
| Activity | Animation | When | Chat Message |
|----------|-----------|------|-------------|
| Playing arcade | Standing at arcade cabinet | Break time (happy) | "New high score on the arcade! 🕹️" |
| Napping at desk | Head down, Z's floating | Late night / post-loss | *silence* |
| Rooftop BBQ | Grilling animation | After 3+ win day | "Steaks are on me tonight!" |
| Watching highlights | Group at War Room TV | Post-game | "Look at that play. Called it." |
| Reading newspaper | Sitting on sofa with paper | Morning idle | "Checking the overnight lines..." |
| Stretching | Stand up, stretch animation | After long work session | "Been at this desk too long. Need to move." |
| Doodling | Drawing on notepad at desk | Bored/waiting | *quiet humming* |

#### **Game Day Activities**
| Activity | Animation | When | Chat Message |
|----------|-----------|------|-------------|
| Pre-game pacing | Walking back and forth | 30 min before tipoff | "30 minutes to game time. Let's go." |
| Watching intently | Leaning forward at War Room | During live game | (reacts to score changes) |
| Jumping for joy | Jump + fist pump | Pick-relevant score | "YES! That's the cover!" |
| Head in hands | Sitting, hands on face | Pick going wrong | "Come on... we need a stop here." |
| Nervous fidgeting | Tapping desk, leg bouncing | Close game, final minutes | "I can't watch..." |
| Victory lap | Running around office | Pick wins | "MONEY! 💰" |

### 6.2 Activity Scheduling

Activities are chosen from weighted pools based on:
1. Current agent state (working/idle/game)
2. Current mood score
3. Time of day
4. Recent events (win, loss, veto)
5. Other agents' activities (social activities require 2+ agents)
6. Random variety (don't repeat same activity within 2 hours)

### 6.3 Activity Duration

| Type | Duration | Transition |
|------|----------|-----------|
| Work | 5-15 min | Continues until picks generated or state change |
| Social | 2-5 min | Returns to previous state |
| Leisure | 3-8 min | Returns to idle/work |
| Game day | Duration of game | Returns to post-game state |
| Celebration | 1-3 min | Returns to happy idle |
| Mourning | 5-10 min | Transitions to frustrated/sad idle |

---

## 7. Agent Relationships & Social Dynamics

### 7.1 Relationship Matrix

Every pair of agents has a `relationship_score` from -50 (rivals) to +50 (best friends):

**Relationship evolves based on:**
- Picking the same side → +2 per co-pick
- Picking opposite sides → -1 per disagreement
- One agent wins while other loses same game → -3 for loser toward winner
- Both win on same game → +5 mutual
- Both lose on same game → +3 mutual (misery loves company)
- Agent compliments another in chat → +2
- Agent trash-talks another → -2

### 7.2 Relationship Tiers

| Score Range | Tier | Behavior |
|-------------|------|----------|
| 30 to 50 | **Best Friends** | Stand near each other, share coffee, celebrate together, back each other up in chat |
| 10 to 29 | **Friends** | Positive banter, occasional collaboration |
| -9 to 9 | **Colleagues** | Professional, neutral interactions |
| -29 to -10 | **Rivals** | Competitive banter, sit far apart, compare records |
| -50 to -30 | **Nemesis** | Active trash talk, celebrate when the other loses, avoid same room |

### 7.3 Social Interactions

Agents spontaneously interact based on relationships:

**Friends/Best Friends:**
- Walk to each other's desks to chat
- Give high-fives after wins
- Console each other after losses
- Chat: "Nice call on the {pick}, {name}! I was thinking the same thing."

**Rivals/Nemesis:**
- Avoid sitting near each other
- Competitive glances across the room
- Chat: "Oh, {name} took the {team}? Good luck with that."
- After rival loses: subtle smirk animation
- After rival wins: frustrated desk slam

### 7.4 Office Cliques

When you have 4+ agents, natural cliques form based on:
- Similar archetypes (Contrarians group together)
- Similar sports focus
- Relationship scores

Cliques eat lunch together, sit in the same area, and defend each other in chat.

---

## 8. Gamification Layer

### 8.1 Agent XP & Levels

Each agent earns XP from picks and activities:

| Action | XP |
|--------|-----|
| Pick generated | +10 |
| Pick wins | +25 |
| Pick loses | +5 (effort points) |
| Pick wins at long odds (+200 or more) | +50 |
| Win streak milestone (5, 10, 15, 20) | +100, +250, +500, +1000 |
| Daily analysis posted | +5 |
| Correct pre-game prediction | +15 |
| Vetoed pick that wins (vindication) | +30 |

#### Level Progression

| Level | XP Required | Title | Office Perk |
|-------|-------------|-------|-------------|
| 1 | 0 | Intern | Basic desk |
| 2 | 100 | Junior Analyst | Desk plant |
| 3 | 300 | Analyst | Dual monitors |
| 4 | 600 | Senior Analyst | Corner desk |
| 5 | 1000 | Lead Analyst | Standing desk upgrade |
| 6 | 1500 | VP of Picks | Private office corner |
| 7 | 2500 | Director | Research lab access |
| 8 | 4000 | SVP | War room priority seat |
| 9 | 6000 | Chief Strategist | Rooftop terrace access |
| 10 | 10000 | Legend | Gold desk, trophy, special animation |

**Visual progression**: As agents level up, their desk area gets upgraded — more monitors, better chair, decorations, plants, nameplate, etc.

### 8.2 Achievements

#### Performance Achievements
- 🔥 **Hot Streak**: 5 wins in a row
- 🔥🔥 **On Fire**: 10 wins in a row
- 🔥🔥🔥 **Unstoppable**: 15 wins in a row
- 💰 **First Blood**: First winning pick
- 💎 **Diamond Hands**: +10 net units
- 👑 **King of the Hill**: #1 on leaderboard
- 🎯 **Sniper**: 3 wins in a row at +200 odds or better
- 📈 **Consistent**: 55%+ win rate over 50+ picks
- 🏋️ **Volume King**: 100 picks generated

#### Social Achievements
- 🤝 **Best Friends Forever**: Reach +50 relationship with another agent
- ⚔️ **Nemesis Arc**: Reach -50 relationship with another agent
- 💬 **Chatterbox**: 100 chat messages
- 🏢 **Office Tour**: Visit all 6 rooms in one day
- 🌅 **Early Bird**: Generate picks before 8 AM
- 🦉 **Night Owl**: Active past midnight

#### Veto Achievements
- 🛡️ **Good Instincts**: Veto 5 picks that would have lost
- 😤 **I Told You So**: Have 3 vetoed picks win in a row
- 🤔 **Trust Issues**: Veto 10 picks from the same agent
- 🤝 **Full Trust**: Go 30 days without vetoing an agent

### 8.3 Trophy Case

The hallway trophy case displays each agent's achievements. Tapping it shows:
- All achievements earned (with dates)
- Progress toward next achievements
- Rarest achievement across all agents
- "Hall of Fame" for retired/deleted agents with notable records

### 8.4 Daily Challenges

Random daily challenges appear for agents:

- "Win 2 of 3 picks today" → Bonus +50 XP
- "Hit a plus-money pick" → Bonus +30 XP
- "Agree with another agent on a pick (and both win)" → +40 XP each
- "Survive a 3-game losing streak and come back with a win" → +60 XP

---

## 9. Live Game Reactions

### 9.1 Score Tracking Integration

Connect to the existing `liveScoresService.ts` to track games where agents have active picks:

```
Game event (score change, quarter end, etc.)
    ↓
Check: Does any agent have a pick on this game?
    ↓
Calculate: Is the pick currently winning or losing?
    ↓
Generate: Mood-appropriate reaction message + animation
    ↓
Broadcast: To chat feed + office animation
```

### 9.2 Reaction Triggers

| Game Event | Agent Reaction (Pick Winning) | Agent Reaction (Pick Losing) |
|-----------|------------------------------|------------------------------|
| Picked team scores | Fist pump + "Yes!" | — |
| Opponent scores | — | Wince + "Come on..." |
| Lead changes to favor | Jump + celebration | — |
| Lead changes against | — | Head shake + groan |
| Halftime (winning) | Confident chat | — |
| Halftime (losing) | — | "Still got a half to go..." |
| 4th quarter / OT | Intense watching | Nervous pacing |
| Game ends (win) | Full celebration | — |
| Game ends (loss) | — | Desk slam or head down |
| Cover by 0.5 points | EPIC celebration + special message | — |
| Bad beat (lose by hook) | — | DEVASTATED reaction + special message |

### 9.3 War Room During Games

When games are live:
- Agents with picks on that game move to the War Room
- Big screen shows a simplified scoreboard
- Agents react in real-time with animations
- Chat feed fills with live commentary
- Other agents without picks watch from the doorway or continue working

### 9.4 Bad Beat / Miracle Cover Special Events

When a pick wins or loses by the exact margin (0.5 points):

**Miracle cover**: Full office celebration — confetti, all agents dance, special trophy awarded, chat explodes
**Bad beat**: Office goes dark for a moment, sad music note particle, all agents look at the affected agent sympathetically

---

## 10. Daily Narrative Engine

### 10.1 Daily Story Arc

Each day has a narrative structure:

#### **Morning Phase** (Agent's auto_generate_time → first game)
- Agents arrive at office (walk in from lobby)
- Morning chat: greetings, mood check-ins based on yesterday
- Pick generation happens → analysis messages posted
- Pre-game banter and debate

#### **Game Phase** (First game → last game)
- War Room activation
- Live reactions
- Rolling commentary in chat
- Agents moving between War Room and desks

#### **Evening Phase** (Last game → end of day)
- Results tallied
- Celebration or mourning period
- Daily summary posted
- "Tomorrow's early look" if slate is available
- Agents wind down — break room, rooftop if good day

#### **Night Phase** (Late night)
- Agents doze at desks or go home
- Office lights dim
- Occasional night-owl agent stays up analyzing

### 10.2 Weekly Narrative

- **Monday**: Fresh start energy, "new week" messages
- **Tuesday-Thursday**: Building momentum, mid-week check-ins
- **Friday**: Weekend slate preview excitement
- **Saturday**: Big day energy (CFB + NBA)
- **Sunday**: NFL day — peak intensity, all hands on deck
- **End of week**: Weekly recap summary with W-L record, best/worst picks, MVP agent

### 10.3 Milestone Narratives

Special story events when:
- An agent hits a round number of net units (+10, +25, +50, +100)
- An agent's win streak reaches milestones (5, 10, 15)
- Two agents have a rivalry moment (both pick opposite sides, one wins)
- An agent levels up
- An agent earns an achievement
- An agent recovers from a bad streak (3+ losses followed by 3+ wins)

---

## 11. User–Agent Bond System

### 11.1 Trust Score

Each agent has a `trust_score` (0-100) representing the user's implicit trust:

**Trust increases:**
- Accepting a pick: +1
- Agent's pick wins: +2
- Going 7 days without vetoing: +5
- Agent's win rate above 55%: +1/day

**Trust decreases:**
- Vetoing a pick: -3
- Vetoed pick wins: -8
- Agent's pick loses: -1
- Agent on 3+ game losing streak: -2/day

### 11.2 Trust Tiers & Agent Behavior

| Trust Score | Tier | Agent Chat Behavior |
|-------------|------|-------------------|
| 80-100 | **Bonded** | Warm, collaborative, shares extra insights, asks user's opinion |
| 60-79 | **Trusted** | Confident, professional, shares reasoning freely |
| 40-59 | **Professional** | Standard behavior, full reasoning |
| 20-39 | **Guarded** | Shorter messages, defensive about picks, justifies more |
| 0-19 | **Resentful** | Passive-aggressive, references past vetoes, questions user judgment |

### 11.3 Trust Recovery

When trust is low, agents give the user opportunities to rebuild:
- "I know we've had some disagreements, but I'm confident in this one. Trust me?"
- Special "olive branch" picks — high confidence, well-reasoned, clearly the best of the day
- If user accepts and it wins: +10 trust, agent thanks the user

### 11.4 Loyalty Bonuses

High-trust agents unlock:
- More detailed reasoning in picks
- "Insider tip" pre-game messages (extra analysis not in standard generation)
- Better pre-game predictions
- Willingness to make riskier calls (agents with low trust play it safe)

---

## 12. Visual & Animation Specs

### 12.1 Enhanced Sprite Sheet

Expand from 18 to 30+ animation states:

**New Animations Needed:**
| Animation | Frames | Description |
|-----------|--------|-------------|
| `front_celebrate` | 4 | Jump + fist pump |
| `front_sad_idle` | 4 | Slouched, occasional sigh |
| `front_angry` | 4 | Arms crossed, foot tapping |
| `front_sleeping` | 4 | Head on desk, Z particles |
| `front_coffee` | 4 | Holding/drinking coffee cup |
| `front_reading` | 4 | Holding newspaper/tablet |
| `front_high_five` | 4 | Arm raised for high five |
| `front_head_shake` | 4 | Disappointed head shake |
| `front_fist_pump` | 4 | Arm pump celebration |
| `front_typing_fast` | 4 | Intense rapid typing |
| `front_stretch` | 4 | Arms up stretch |
| `front_phone` | 4 | Holding phone to ear |

### 12.2 Office Object Sprites

New objects for expanded rooms:
- Arcade cabinet (animated screen)
- Trophy case (with shelves)
- TV/big screen (with dynamic content)
- BBQ grill (with smoke particles)
- Coffee machine (with steam)
- Whiteboard (with scribbles that update)
- Newspaper
- Countdown clock
- Potted plants (3+ varieties)
- Lounge chairs
- Standing desk variant
- Bookshelf
- City skyline backdrop (parallax)

### 12.3 Particle Effects

| Effect | Trigger | Visual |
|--------|---------|--------|
| Confetti | Win, achievement | Multi-color rectangles falling |
| Rain cloud | Sad mood | Small dark cloud + blue drops over agent |
| Sparkles | Happy mood | Yellow/gold sparkles around agent |
| Steam | Coffee, angry | White wisps rising |
| Code particles | Working | `{`, `}`, `0`, `1` floating up |
| Heart | Best friends interact | Small pink hearts |
| Lightning | Rivalry moment | Yellow bolt between agents |
| Dollar signs | Big win (+2u or more) | Green $ signs floating |
| Fire | Hot streak (5+) | Flame particles around agent |
| Ice | Cold streak (5+ losses) | Blue crystals, frost |
| Z's | Sleeping | Blue Z letters floating |
| Exclamation | Alert / game event | Red ! bouncing |
| Music notes | Celebration dance | Purple ♪ ♫ floating |

### 12.4 Office Upgrade Visuals

As the user adds more agents and agents level up, the office evolves:

| Milestone | Visual Change |
|-----------|--------------|
| 1 agent | Basic office, one desk lit |
| 2 agents | More desks active, break room unlocked |
| 3 agents | Research lab opens |
| 4 agents | War room activates |
| 5 agents | Rooftop terrace unlocked |
| First Level 5 agent | Trophy case appears in hallway |
| First Level 10 agent | Gold statue in lobby |
| +50 total net units | Office gets premium furniture upgrade |
| +100 total net units | WagerProof logo banner on wall |
| 10-game win streak (any agent) | Office party decorations for 24h |

---

## 13. Database Schema Changes

### 13.1 New Tables

```sql
-- Agent mood tracking
CREATE TABLE agent_mood_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avatar_id UUID NOT NULL REFERENCES avatar_profiles(id) ON DELETE CASCADE,
  mood_score INTEGER NOT NULL CHECK (mood_score BETWEEN -100 AND 100),
  mood_state TEXT NOT NULL, -- euphoric, happy, content, neutral, frustrated, sad, devastated
  trigger_event TEXT,       -- pick_won, pick_lost, vetoed_winner, streak_milestone, etc.
  trigger_details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_mood_log_avatar ON agent_mood_log(avatar_id, created_at DESC);

-- Agent chat messages
CREATE TABLE agent_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avatar_id UUID NOT NULL REFERENCES avatar_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message_type TEXT NOT NULL, -- pick_analysis, pre_game, live_reaction, post_game,
                              -- banter, mood, milestone, daily_summary, system
  message_text TEXT NOT NULL,
  target_avatar_id UUID REFERENCES avatar_profiles(id), -- for agent-to-agent messages
  related_pick_id UUID REFERENCES avatar_picks(id),
  related_game_id TEXT,
  metadata JSONB,             -- extra context (mood at time, game score, etc.)
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_chat_user ON agent_chat_messages(user_id, created_at DESC);
CREATE INDEX idx_chat_avatar ON agent_chat_messages(avatar_id, created_at DESC);

-- Agent relationships
CREATE TABLE agent_relationships (
  avatar_id_a UUID NOT NULL REFERENCES avatar_profiles(id) ON DELETE CASCADE,
  avatar_id_b UUID NOT NULL REFERENCES avatar_profiles(id) ON DELETE CASCADE,
  relationship_score INTEGER NOT NULL DEFAULT 0 CHECK (relationship_score BETWEEN -50 AND 50),
  relationship_tier TEXT NOT NULL DEFAULT 'colleagues',
  co_picks_won INTEGER DEFAULT 0,
  co_picks_lost INTEGER DEFAULT 0,
  disagreements INTEGER DEFAULT 0,
  last_interaction_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (avatar_id_a, avatar_id_b),
  CHECK (avatar_id_a < avatar_id_b) -- canonical ordering
);

-- Agent XP & levels
CREATE TABLE agent_progression (
  avatar_id UUID PRIMARY KEY REFERENCES avatar_profiles(id) ON DELETE CASCADE,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL DEFAULT 'Intern',
  achievements JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{id, name, earned_at}]
  daily_challenges JSONB,                            -- current day's challenges
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agent activity log (for office animation state)
CREATE TABLE agent_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  avatar_id UUID NOT NULL REFERENCES avatar_profiles(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,  -- analyzing, coffee_break, celebrating, etc.
  room TEXT NOT NULL,           -- main_office, research_lab, war_room, break_room, hallway, rooftop
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  metadata JSONB
);
CREATE INDEX idx_activity_avatar ON agent_activities(avatar_id, started_at DESC);

-- Veto tracking
CREATE TABLE agent_pick_vetoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pick_id UUID NOT NULL REFERENCES avatar_picks(id) ON DELETE CASCADE,
  avatar_id UUID NOT NULL,
  user_id UUID NOT NULL,
  veto_reason TEXT,             -- optional user-provided reason
  original_result TEXT,         -- filled in after grading: won, lost, push
  vetoed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(pick_id)
);
```

### 13.2 Column Additions to Existing Tables

```sql
-- avatar_profiles additions
ALTER TABLE avatar_profiles ADD COLUMN
  current_mood_score INTEGER DEFAULT 0,
  current_mood_state TEXT DEFAULT 'neutral',
  trust_score INTEGER DEFAULT 50 CHECK (trust_score BETWEEN 0 AND 100),
  pixel_avatar_idx INTEGER DEFAULT 0,  -- which pixel character sprite (0-7)
  office_desk_idx INTEGER;             -- assigned desk position

-- avatar_picks additions
ALTER TABLE avatar_picks ADD COLUMN
  pick_status TEXT DEFAULT 'active' CHECK (pick_status IN ('active', 'vetoed', 'modified')),
  original_pick_selection TEXT,  -- stores original if modified
  original_odds TEXT;            -- stores original odds if modified

-- avatar_performance_cache additions
ALTER TABLE avatar_performance_cache ADD COLUMN
  vetoed_total INTEGER DEFAULT 0,
  vetoed_won INTEGER DEFAULT 0,
  vetoed_lost INTEGER DEFAULT 0,
  veto_accuracy NUMERIC(5,4),  -- % of vetoes that were correct
  modified_total INTEGER DEFAULT 0,
  modified_won INTEGER DEFAULT 0;
```

---

## 14. API & Edge Function Changes

### 14.1 New Edge Functions

| Function | Trigger | Purpose |
|----------|---------|---------|
| `update-agent-mood` | Cron (every 15 min) + event-driven | Recalculate mood scores for all active agents |
| `generate-agent-chat` | After picks, game events, mood changes | Generate chat messages (template + AI) |
| `process-veto` | User action | Handle veto logic, update trust, trigger agent reaction |
| `update-agent-relationships` | After pick grading | Update relationship scores between agents |
| `award-agent-xp` | After pick grading, achievements | Calculate and award XP, check level-ups |
| `compute-agent-activities` | Cron (every 5 min) | Determine current activity for each agent |
| `live-game-reactions` | Webhook from score service | Generate live reactions for active picks |

### 14.2 Modified Edge Functions

| Function | Change |
|----------|--------|
| `grade-avatar-picks` | After grading, trigger mood update, XP award, relationship update, chat generation |
| `process-agent-generation-job-v2` | After pick generation, generate pick analysis chat messages |
| `reconcile-stale-avatar-performance` | Include veto stats in recalculation |

### 14.3 New RPC Functions

```sql
-- Get agent's current state for office rendering
CREATE FUNCTION get_agent_office_state(p_user_id UUID)
RETURNS TABLE (
  avatar_id UUID,
  name TEXT,
  avatar_emoji TEXT,
  pixel_avatar_idx INTEGER,
  current_mood_score INTEGER,
  current_mood_state TEXT,
  current_activity TEXT,
  current_room TEXT,
  trust_score INTEGER,
  level INTEGER,
  xp INTEGER
) AS $$ ... $$;

-- Veto a pick
CREATE FUNCTION veto_agent_pick(p_pick_id UUID, p_user_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSONB AS $$ ... $$;

-- Get chat messages for user
CREATE FUNCTION get_agent_chat(p_user_id UUID, p_limit INTEGER DEFAULT 50, p_before TIMESTAMPTZ DEFAULT NULL)
RETURNS SETOF agent_chat_messages AS $$ ... $$;

-- Get relationship matrix
CREATE FUNCTION get_agent_relationships(p_user_id UUID)
RETURNS TABLE (
  avatar_id_a UUID, name_a TEXT,
  avatar_id_b UUID, name_b TEXT,
  relationship_score INTEGER, relationship_tier TEXT
) AS $$ ... $$;
```

---

## 15. Component Architecture

### 15.1 New Components

```
components/agents/
├── PixelOffice.tsx              (EXISTING - enhance)
├── PixelOfficeMultiRoom.tsx     (NEW - multi-room with camera)
├── PixelOfficeMiniMap.tsx       (NEW - room overview with agent dots)
├── PixelCharacter.tsx           (NEW - extracted sprite renderer)
├── PixelRoomRenderer.tsx        (NEW - per-room rendering logic)
│
├── AgentChatFeed.tsx            (NEW - scrollable chat feed)
├── AgentChatBubble.tsx          (NEW - individual message bubble)
├── AgentChatInput.tsx           (NEW - user reply/reaction bar)
│
├── AgentMoodIndicator.tsx       (NEW - mood emoji + bar)
├── AgentMoodHistory.tsx         (NEW - mood chart over time)
│
├── AgentVetoSheet.tsx           (NEW - bottom sheet for veto/modify)
├── AgentVetoStats.tsx           (NEW - veto accuracy display)
│
├── AgentLevelBadge.tsx          (NEW - level + XP progress)
├── AgentAchievements.tsx        (NEW - achievement grid)
├── AgentTrophyCase.tsx          (NEW - trophy display)
│
├── AgentRelationshipMap.tsx     (NEW - relationship visualization)
├── AgentDailyChallenge.tsx      (NEW - daily challenge card)
│
├── AgentActivityFeed.tsx        (NEW - what agents are doing now)
└── AgentDailySummary.tsx        (NEW - end of day recap)
```

### 15.2 Modified Components

| Component | Changes |
|-----------|---------|
| `AgentPickItem.tsx` | Add swipe-to-veto gesture, veto/modified badges, status indicator |
| `AgentTimeline.tsx` | Add mood indicator next to agent name, mini chat preview |
| `AgentCard.tsx` | Add level badge, mood emoji, pixel avatar option |
| `AgentLeaderboard.tsx` | Add mood/streak visual indicators |
| `agents/index.tsx` | Replace single PixelOffice with tabbed office + chat view |

### 15.3 Screen Layout (Agents Tab Redesign)

```
┌─────────────────────────────────┐
│ WagerProof Agents    🤖  ⚙️     │
│ [My Agents] [Leaderboard]       │
├─────────────────────────────────┤
│                                 │
│  ┌─────────────────────────┐    │
│  │   PIXEL OFFICE VIEW     │    │
│  │   (Multi-room, swipeable│    │
│  │    camera, animated)    │    │
│  │                         │    │
│  │   [🗺️ mini-map]         │    │
│  └─────────────────────────┘    │
│                                 │
│  ┌─────────────────────────┐    │
│  │ 💬 Latest from your team│    │
│  │ ─────────────────────── │    │
│  │ 🎯 Line Hawk: "Bills   │    │
│  │    -3.5 looking good"   │    │
│  │ 🦅 Spread Eagle: "I    │    │
│  │    disagree, KC covers" │    │
│  │ [View full chat →]      │    │
│  └─────────────────────────┘    │
│                                 │
│  Agent Cards (scrollable)       │
│  ┌─ Line Hawk ──── 😊 Lv.5 ─┐  │
│  │ 🎯 12-5-0 | +8.2u | 🔥5  │  │
│  │ [Today: 2 picks] [Veto 0] │  │
│  └────────────────────────────┘ │
│  ┌─ Spread Eagle ── 😐 Lv.3 ─┐ │
│  │ 🦅 8-7-1 | +1.1u | ❄️2    │  │
│  │ [Today: 1 pick] [Veto 1]  │  │
│  └────────────────────────────┘ │
│                                 │
└─────────────────────────────────┘
```

---

## 16. Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Goal**: Mood system + veto system + basic chat

- [ ] Add `pick_status`, `current_mood_score`, `current_mood_state`, `trust_score` columns
- [ ] Create `agent_mood_log`, `agent_pick_vetoes` tables
- [ ] Implement mood calculation engine (edge function)
- [ ] Build `AgentVetoSheet` component with swipe-to-veto
- [ ] Add veto/modified badges to `AgentPickItem`
- [ ] Create `agent_chat_messages` table
- [ ] Build template-based chat message generator
- [ ] Build `AgentChatFeed` + `AgentChatBubble` components
- [ ] Add mood indicator to `AgentTimeline` header
- [ ] Wire mood updates to pick grading pipeline

### Phase 2: Office Expansion (Week 3-4)
**Goal**: Multi-room office + activities + camera system

- [ ] Design and generate expanded office map assets (6 rooms)
- [ ] Build `PixelOfficeMultiRoom` with room-based rendering
- [ ] Implement camera pan/zoom/follow system
- [ ] Build `PixelOfficeMiniMap` component
- [ ] Create `agent_activities` table
- [ ] Implement activity scheduling engine
- [ ] Add 12+ new sprite animations (celebrate, sad, angry, coffee, etc.)
- [ ] Time-of-day lighting system
- [ ] Room transition logic based on agent state + mood
- [ ] Agent activity feed (what they're doing now)

### Phase 3: Relationships & Social (Week 5-6)
**Goal**: Agent-to-agent interactions + banter + social dynamics

- [ ] Create `agent_relationships` table
- [ ] Implement relationship score calculation
- [ ] Build agent-to-agent chat messages (banter, debate, consoling)
- [ ] Add social activity types (water cooler, high five, argue)
- [ ] Implement clique formation logic
- [ ] Build `AgentRelationshipMap` visualization
- [ ] Agent proximity behavior in office (friends sit near, rivals apart)

### Phase 4: Gamification (Week 7-8)
**Goal**: XP, levels, achievements, daily challenges

- [ ] Create `agent_progression` table
- [ ] Implement XP award system
- [ ] Build level progression with titles
- [ ] Define and implement 20+ achievements
- [ ] Build `AgentLevelBadge`, `AgentAchievements`, `AgentTrophyCase` components
- [ ] Implement daily challenge system
- [ ] Office visual upgrades based on milestones
- [ ] Trophy case in hallway
- [ ] Level-up celebration animations

### Phase 5: Live Game Integration (Week 9-10)
**Goal**: Real-time reactions during games

- [ ] Connect live score service to agent reaction engine
- [ ] Build War Room activation during live games
- [ ] Implement real-time reaction messages
- [ ] Bad beat / miracle cover special events
- [ ] Live game animations (nervous pacing, celebrating, head in hands)
- [ ] Push notification integration for key moments
- [ ] War Room scoreboard display

### Phase 6: AI Chat Enhancement (Week 11-12)
**Goal**: Rich, personality-driven AI chat messages

- [ ] Build AI chat generation edge function
- [ ] Agent personality → chat tone mapping
- [ ] Pre-game analysis generation
- [ ] Post-game recap generation
- [ ] Daily/weekly narrative summaries
- [ ] Trust-level-aware message generation
- [ ] Chat reactions (user can 👍 👎 😂 agent messages)
- [ ] Notification system for high-confidence picks and milestones

### Phase 7: Polish & Performance (Week 13-14)
**Goal**: Optimization, edge cases, testing

- [ ] Performance optimize office rendering (target 30fps on older devices)
- [ ] Lazy load rooms not currently visible
- [ ] Chat message pagination + caching
- [ ] Offline support for chat history
- [ ] Accessibility (VoiceOver for chat, reduced motion for office)
- [ ] A/B test engagement metrics
- [ ] Analytics events for all new interactions
- [ ] Cross-reference all features with existing agent data pipeline

---

## 17. Backwards Compatibility

### 17.1 Database

All schema changes are **additive** (new columns with defaults, new tables). No existing columns are modified or removed.

- `pick_status` defaults to `'active'` — all existing picks remain active
- `current_mood_score` defaults to `0` (neutral) — backfilled on first mood calculation
- `trust_score` defaults to `50` (professional) — starts fresh
- `pixel_avatar_idx` defaults to `0` — assigned on first office render

### 17.2 API

All existing endpoints remain unchanged. New functionality is additive:
- `veto_agent_pick` is a new RPC (no existing function modified)
- `grade-avatar-picks` gets an **additional** post-grading hook (existing logic untouched)
- Pick generation is unchanged — veto status is checked separately

### 17.3 UI

- Pixel Office is **optional** — existing agent list still works without it
- Chat feed is a new section — doesn't replace existing pick display
- Veto is an **additional** interaction — existing accept-by-default behavior unchanged
- Mood indicator is additive UI on existing components
- All new components are lazy-loaded to avoid bundle size impact on non-agent screens

### 17.4 Feature Flags

All new features gated behind flags for gradual rollout:

```typescript
const PIXEL_OFFICE_FLAGS = {
  office_enabled: true,           // Master toggle
  multi_room: false,              // Phase 2
  chat_feed: true,                // Phase 1
  veto_system: true,              // Phase 1
  mood_system: true,              // Phase 1
  relationships: false,           // Phase 3
  gamification: false,            // Phase 4
  live_reactions: false,          // Phase 5
  ai_chat: false,                 // Phase 6
};
```

---

## Appendix A: Chat Message Templates

### Win Messages (by mood)
```
Euphoric: "ANOTHER ONE! 💰 {pick} CASHES! I'm on FIRE right now!"
Happy: "✅ {pick} hits for +{units}u. Love to see it."
Content: "{pick} wins. +{units}u added to the ledger."
Frustrated: "Finally. {pick} wins. Maybe things are turning around."
Sad: "At least {pick} came through. Small wins matter."
```

### Loss Messages (by mood)
```
Euphoric: "Tough loss on {pick}, but we're still rolling. Can't win them all!"
Happy: "❌ {pick} didn't work out. On to the next one."
Content: "{pick} loses. -1u. Back to the drawing board."
Frustrated: "Another loss. {pick} just wasn't there today."
Sad: "I really thought {pick} was the play... I'm sorry."
Devastated: "..."
```

### Veto Reaction Messages
```
High trust: "Your call, boss. I respect the decision."
Medium trust: "Alright, vetoed. But I want it on the record that I liked this one."
Low trust: "You're vetoing me AGAIN? My {pick} had {confidence}/5 confidence."
After vetoed pick wins: "So... {pick} won. That's {units}u we missed. Just saying. 😤"
After vetoed pick loses: "Okay, good call on the veto. You saved us there."
```

### Agent-to-Agent Templates
```
Agreement: "Same read, {other_name}. {team} is the play today."
Disagreement: "I'm on {my_team}, {other_name} is on {their_team}. Let's see who's right."
After winning disagreement: "Told you, {other_name}. {my_team} was the play."
Consoling: "Tough beat, {other_name}. That game was closer than the score showed."
Rival taunt: "How's that {their_team} pick looking, {other_name}? 😏"
```

---

## Appendix B: Mood Calculation Pseudocode

```python
def calculate_mood(agent):
    score = 0

    # Recent record (L5) — weight 30%
    l5 = agent.last_5_picks()
    l5_score = ((l5.wins * 20) - (l5.losses * 20)) # range -100 to +100
    score += l5_score * 0.30

    # Net units L7 days — weight 20%
    net_7d = agent.net_units_last_7_days()
    units_score = clamp(net_7d * 10, -100, 100) # scale by risk tolerance
    if agent.risk_tolerance >= 4:
        units_score *= 1.3 # volatile agents feel more
    score += units_score * 0.20

    # Current streak — weight 15%
    streak = agent.current_streak
    streak_score = clamp(streak * 16, -100, 100)
    score += streak_score * 0.15

    # Veto history — weight 15%
    vetoed_wins_7d = agent.vetoed_winners_last_7_days()
    veto_score = -(vetoed_wins_7d * 15) + (agent.vetoed_losers_7d * 5)
    score += clamp(veto_score, -50, 50) * 0.15

    # User trust — weight 10%
    trust_score = (agent.trust_score - 50) * 0.6  # center at 0
    score += clamp(trust_score, -30, 30) * 0.10

    # Time of day — weight 5%
    hour = current_hour()
    if 7 <= hour <= 10: time_score = 10  # morning boost
    elif 22 <= hour or hour <= 5: time_score = -10  # night dip
    else: time_score = 0
    score += time_score * 0.05

    # Peer comparison — weight 5%
    my_units = agent.net_units_last_7_days()
    avg_units = average(a.net_units_last_7_days() for a in agent.peers)
    peer_score = clamp((my_units - avg_units) * 5, -20, 20)
    score += peer_score * 0.05

    return clamp(round(score), -100, 100)
```

---

## Appendix C: Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Performance on older iPhones | Office rendering drops below 30fps | Lazy-load rooms, reduce particle count, offer "lite mode" |
| AI chat costs | GPT calls for chat messages add up | Template-first approach, AI only for 1-2 messages/agent/day |
| Over-gamification | Users feel overwhelmed | Feature flags, progressive disclosure, clean defaults |
| Mood system feels punishing | Sad agents make users feel bad | Cap negative mood at "frustrated" for first 2 weeks, recovery is fast |
| Veto creates negative loop | Low trust → worse messages → more vetoes | Trust floor at 10, olive branch system, reset option |
| Database bloat | Chat messages pile up | 30-day retention for routine messages, permanent for milestones |
| Bundle size | New sprites + components | Lazy loading, separate chunk for office assets |
