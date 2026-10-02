# Research: connect an AI agent to WagerProof sports data

October 2, 2026, America/Chicago. New article, DRAFT, not published. Companion post for the WagerProof YouTube tutorial
(video project `video-pipeline/projects/2026-10-02-wp-yt-agents-real-data`). The article must be live before the video.

## Status gates before publish
- Every `[[VERIFY: ...]]` marker in content.md must be replaced with steps and screenshots captured in a real Grok Bot, Dots and Muse session. Any agent that cannot take a remote connector is described as not supported, never shown as working.
- sources.json: replace the PortEden secondary source with first-party xAI, OpenAI and Meta documentation found during setup, and cite each inline.
- Re-pull every example number on publish day; the answers are dated in the copy.
- Known connector issue to fix or work around before recording: get_game_detail returned 175k to 238k characters for one game because Polymarket matching pulls other teams' markets with full hourly price history.

## Example answers (pulled 2026-10-02 about 3 p.m. ET)
Raw notes: `video-pipeline/projects/2026-10-02-wp-yt-agents-real-data/research/example-queries.md`.
- Lions at Panthers: line DET -3.5 (open -3), total 51 (open 49.5), DET -197 / CAR +165. Model CAR 29.9 to 21.6, CAR win 72.6%, gap 11.8, tier lean. Polymarket Lions 65 cents.
- Chiefs at Raiders: KC -4.5, 48, KC -215 / LV +180. Model KC by 9.2, total 46.75.
- Broncos at 49ers: total 48, model 57.65 (DEN 29.7, SF 27.9), 86 F, wind 8.5 mph.
- Alabama at Mississippi State injuries (covers.com weekly via connector): listed as in copy. Line BAMA -5.5; model BAMA by 13.8.
- Wind query: nfl_analysis_base home rows, season >= 2018, outdoors, wind >= 15 mph: 96 games, 42.7% over (pushes count as not over).
- Home underdogs of 3+, regular season 2018 to 2025: prime time 59 of 116 (50.9%), other 234 of 458 (51.1%).
- Leaderboard: Gimme Dat chedda 98-91 +54.39u; My First Agent! 58-30-1 +46.04u.

## Keyword notes
YouTube search 2026-10-02: on-topic videos for grok bot sports betting and chatgpt dots sports betting are few and small (top on-topic about 2.4k views); general Dots explainers drew 30k to 150k views in two days. Ahrefs volumes not pulled yet.

## Added 2026-10-02 (user: parlays, streaks, strong picks with evidence, hunches)
- Strong picks = highest model cover probability (spread_confidence = home cover prob; verified equal to fg_home_cover_prob on DET@CAR). CFB Saturday: UConn +7 77.7%, Colorado State +6.5 70.5% (model CSU by 1.7), USF -6 70.1%, La Tech +1.5 68.8%, Iowa +14.5 67.4%.
- Streaks: nfl_player_props_current (lines priced -140 to +120, median across books) vs last 10 games in nfl_player_game_logs ordered by season, week (game_date is NULL for every row). Quoted only plausible main lines: Stafford o249.5 pass 9/10 avg 316.1; McBride o6.5 rec 8/10, L5 5/5, avg 8.1 (-137); Odunze o31.5 rec yds 8/10, L5 5/5, avg 41.5; Pollard o47.5 rush 8/10 avg 75.3. Excluded suspicious low lines (Singletary 5.5 rush, Ridley 6.5 rec yds).
- Parlay: UConn +7 (-110 assumed) x McBride o6.5 (-137) x Stafford o249.5 (-113) = decimal 6.23, +523, implied 16.1%.
- Hunches (nfl_analysis_base, regular season 2018-2025 unless noted): Lions road ATS 2023-2026 19-9 (67.9%); after losing by 14+ cover 50.7% (661); division dogs 52.6% (753); division favorites under 7 46.2% (511).
