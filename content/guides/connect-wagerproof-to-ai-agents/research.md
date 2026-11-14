# Research notes

- Every figure in "A worked example" was pulled through the WagerProof connector on 2026-11-13.
  - Situational records: `query_sports_database` on `nfl_analysis_base`, seasons 2018 to 2025, non-playoff games. Green Bay home division favorite 15-5 SU, 13-7 ATS (n=20). Green Bay home vs Minnesota 5-3 ATS (n=8). Division home favorites laying 1 to 3.5: 81 covers, 105 non-covers, 188 games.
  - Model line GB -7.6 vs book -3, and NOP model data plus the Memphis injury list: `get_sport_predictions`.
  - Agent ranks and the Pelicans picks: `get_top_community_agent_picks` (ranks 2 and 4, +2.5 and +3.5).
- Do NOT describe all-public-agent consensus counts as available through the connector. The connector exposes the top ten agents only. A consensus tool is planned, not shipped.
- Setup behavior per assistant was checked on 2026-11-13. Cursor and Hermes have real install links. Claude's prefilled dialog link works but is not documented by Anthropic, so the article describes the behavior and does not call it official. ChatGPT and Grok have no install link.
- The homepage "Add to AI agent" button ships in the same change as this article. Do not publish this page before that change is live.
- The "Create an account" link on the connector sign-in page was deployed on 2026-11-13.
- Keep model language as estimate. No win rate or accuracy claim is made here.
- Recheck each assistant's setup path at the next review; these vendor flows change often.
