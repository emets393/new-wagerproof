# RESEARCH VAULT — validated/candidate findings (do not edit)
This directory holds *snapshot* copies of findings the project has produced, so future edits to scripts
or data don't lose them. Each entry has: the human writeup, the exact code, and the per-game flags
(where applicable).

## Contents
- **01_LOCKED_RULE_key_receiver_out_OVER** — the air-yards-share ≥35% WR/TE/RB Out → OVER rule
  (2018–25: 64.9% OVER, +23.8% ROI, n=185, 7/8 seasons, +4.4 pts over close). Status: CANDIDATE (in-sample);
  graduates to VALIDATED on a clean 2026 forward test at the locked threshold.
- (more added as discoveries are vaulted)

## Adjacent durable findings from prior briefs (live in REPORT.md, in main project)
- WIND ≥17 mph outdoor → UNDER (61.5%, every meaningful season positive). The other validated edge.
- PRE-BYE HOME team → ATS 60% (pre-specified, 6/8 seasons).

## Hard lessons baked in (so we don't redo them)
- Don't grade only against the CLOSE — the bettable bar is the OPENER + CLV.
- LIST_TABLES first (the player-injury + NGS + FTN-raw layer was always there).
- A 7/8-season "trend" from an exhaustive search is *expected by chance* under our null — only mechanism
  + dose-response + above-null + pre-spec or robustness count.
