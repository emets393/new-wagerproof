# WagerProof iOS — Release Notes

The `## <version>` section for the version being shipped is the copy pasted into the
App Store Connect **What's New in This Version** field. Keep each section under 4000
characters (Apple's limit) and written for users, not for the repo.

Version strings live in four files and must be bumped together — see
`.claude/CLAUDE.md` → Deployment:
`Wagerproof/Info.plist`, `WagerProofWidgetExtension/Info.plist`,
`Wagerproof/Configuration/Debug.xcconfig`, `Wagerproof/Configuration/Release.xcconfig`.

---

## 3.5.9 (build 77)

NFL and College Football are back — and this is the biggest update we've shipped.

**Football is live for 2026**
Our rebuilt NFL and College Football models are running on the full slate. Game
predictions, live scores, Outliers, and your AI agents all read the new model, with
real sportsbook lines behind every number. College Football streaks now carry across
seasons, so Week 1 isn't a blank page — you get real trailing form and coach trends
from day one.

**Historical Trends, rebuilt**
Finding an angle is a lot faster. MLB gets starting-pitcher and opponent ERA filters,
a proper run-line market, series-game multi-select, and opponent bullpen splits. NFL
adds opponent points-per-game, points-allowed, and loss-streak filters. Weather
temperature and wind are now standard two-thumb range sliders on every sport, filter
pills fit on one row with a scroll hint, and totals results headline the side that
actually won.

**Systems**
Save any trend you build as a System and keep it. Systems are graded every night, so
you can see how your angle is holding up — and there's a public leaderboard to see
which Systems are working across the whole community.

**Follow and copy agents**
See an AI agent you like on the leaderboard? Follow it to track its picks, or copy its
build as the starting point for one of your own.

**Agent Consensus**
Game cards now show what the public AI agents are betting, with a BET flag on the games
where they strongly agree — not just where they've placed a bet.

**Connect WagerProof to your AI assistant**
Link your account to Claude, ChatGPT, or any assistant that supports connectors, and
ask about today's slate, your agents, or historical trends in plain language. Setup is
in Settings, and you can now sign in with Google or Apple.

**Faster and cleaner**
Game detail pages scroll noticeably smoother. We also fixed College Football and FCS
team logos, D-backs and Athletics logos in MLB trends, duplicate home/away splits,
and a handful of filter display bugs.

---

## 3.5.8 (build 75)

Version bump only — 3.5.7 had gone live on the App Store, which blocks new builds on
that version train. No user-facing changes beyond what shipped in 3.5.7.
