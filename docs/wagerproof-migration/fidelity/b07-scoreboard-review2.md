# B07 Scoreboard — Reviewer Verdict (Re-Review #2)

**Verdict:** FAIL
**Build:** ❌ (`** BUILD FAILED **` on iPhone 16 Pro, Debug — see Issue #1; root cause is outside B07 scope)
**Date:** 2026-05-20
**Reviewer:** b07-reviewer-2026-05-20 (independent re-review, read-only on code)

---

## Summary

The B07 fix-up itself landed cleanly. Every required artifact is in place:

- Fidelity table (`fidelity/b07-scoreboard.md`) has zero `❌` rows; all three previously-failing rows now read `⚠️ #009`, `⚠️ #010`, `⚠️ #011` with notes pointing to the relevant tickets (lines 58, 81, 101). The two existing `⚠️` rows (#007, #008) are unchanged.
- Three new tickets (`tickets/009-*`, `tickets/010-*`, `tickets/011-*`) all follow the template (Status / Filed by / Filed / Affects / What we couldn't ship / Why / Impact / Acceptance criteria / Linked code / Notes), cite real Swift files, and point at the inline waiver comments.
- All three new `// FIDELITY-WAIVER #NNN` markers are present in the correct Swift files:
  - `ScoreboardView.swift:82` — `FIDELITY-WAIVER #009: WagerBotSuggestionStore.onPageChange(.scoreboard) …` (inside `.task`)
  - `ScoreboardView.swift:84` — `FIDELITY-WAIVER #010: LiveScoresStore.games will sync to WagerBotSuggestionStore.setScoreboardData(_:) after B17 lands.` (inside `.task`)
  - `LiveScoresStore.swift:55` — `FIDELITY-WAIVER #011: Polling fires unconditionally; network-state gating … lands in B22 hardening.` (start of polling-loop body)
- The previous `⚠️ #007` and `⚠️ #008` waivers still have their inline markers at `ScoreboardView.swift:154` and `LiveScorePredictionCard.swift:197` respectively.
- All native primitives from the first review (NavigationStack, `.refreshable`, `.sheet(item:)`, `.presentationDetents`, `LazyVStack(pinnedViews:)`, `ContentUnavailableView`, `.sensoryFeedback`) are unchanged.
- `LiveScoresService.swift` backend byte-identity is unchanged.
- All three parity screenshots are still present in `docs/wagerproof-migration/parity/scoreboard/` (empty.png 23 KB, loaded.png 40 KB, error.png 24 KB).
- `scripts/wagerproof-migration/grep-waivers.sh` exits 0 ("Tracked waivers: 11 / ✅ All waivers map to tickets.").

What blocks PASS: the project no longer builds. There is one compile error, and it is **outside B07 scope** — it lives in `WagerproofKit/Sources/WagerproofStores/EditorPicksStore.swift:624` (a B06 file). The B07 fix-up demonstrably did not touch that file, but per the brief's "Build green" gate, `** BUILD SUCCEEDED **` is required, so I cannot flip B07 to `reviewed` while the workspace is red.

---

## Issues

### 1. Build fails — `EditorPicksStore.swift:624:71: cannot find 'raw' in scope` (OUT OF B07 SCOPE)

- **File:** `wagerproof_ios_native/WagerproofKit/Sources/WagerproofStores/EditorPicksStore.swift:624`
- **Error:** `error: cannot find 'raw' in scope`
- **Code:**
  ```swift
  private static func formatNBADateTime(gameDate: String?, tipoffEt: String?) -> (String?, String?) {
      let date: String? = {
          guard let raw = gameDate, raw.contains("-") else { return raw }  // ← line 624: `raw` used in else branch where the guard binding is out of scope
          …
      }()
  }
  ```
- **Why this blocks B07:** It doesn't, semantically — this is a B06 (Editor Picks) regression. But the orchestrator's brief says `** BUILD SUCCEEDED **` is required, and the workspace is currently broken. The first B07 review (`b07-scoreboard-review.md`) explicitly noted "Build: ✅" — so the regression landed between that review and this one, outside the B07 fix-up's footprint.
- **Recommended action:** Have the B06 owner (or the implementer who is closer to the EditorPicks port) fix the `guard let raw` → `else { return gameDate }` mistake (or similar). Once that lands, re-run the B07 build check; if it succeeds and no B07 file has been touched, B07 is eligible to flip on the next pass without re-reviewing the fidelity content.
- **Workaround for the orchestrator:** If the orchestrator wants to land B07 ahead of B06's fix, it can defer the inventory flip until after the B06 fix. The B07 fidelity surface is otherwise green.

### 2. (No other issues.)

Every other check passed:

- ✅ Fidelity table: zero `❌` rows; #009/#010/#011 wired with notes pointing at tickets.
- ✅ Inline waivers: all three new markers in the expected files with correct deferral comments.
- ✅ Tickets: all three follow the template; "Affects" cites real Swift files; "Linked code" cites the waiver-comment locations.
- ✅ Pre-existing waivers (#007, #008) still in place at the same lines.
- ✅ Native primitives, backend byte-identity, animation tokens, SF Symbol parity, tap-target audit — all unchanged from the first review's PASS items.
- ✅ Parity screenshots: all 3 present.
- ✅ `grep-waivers.sh`: exits 0, 11 tracked waivers, all map to tickets.

---

## Recommendation

**Hold the inventory flip** until the B06 compile error in `EditorPicksStore.swift:624` is resolved. Once the workspace builds clean again, the eight B07 rows below should be **appended** (not amended) to `inventory.overrides.csv`. The inventory builder uses the LAST row per `rn_path`, so an append is equivalent to a status flip and preserves the audit trail.

```csv
wagerproof-mobile/app/(drawer)/(tabs)/scoreboard.tsx,scoreboard,screen,reviewed,B07 re-review PASS; ⚠️ waivers #007/#008/#009/#010/#011 deferred per tickets,b07-reviewer-2026-05-20,
wagerproof-mobile/components/LiveScoreCard.tsx,LiveScoreCard,component,reviewed,B07 re-review PASS,b07-reviewer-2026-05-20,
wagerproof-mobile/components/LiveScoreCardShimmer.tsx,LiveScoreCardShimmer,component,reviewed,B07 re-review PASS,b07-reviewer-2026-05-20,
wagerproof-mobile/components/LiveScorePredictionCard.tsx,LiveScorePredictionCard,component,reviewed,B07 re-review PASS; team-colors ticket #008 still open,b07-reviewer-2026-05-20,
wagerproof-mobile/components/LiveScoreDetailModal.tsx,LiveScoreDetailModal,sheet,reviewed,B07 re-review PASS; native .sheet,b07-reviewer-2026-05-20,
wagerproof-mobile/services/liveScoresService.ts,liveScoresService,service,reviewed,B07 re-review PASS; backend byte-identical,b07-reviewer-2026-05-20,
wagerproof-mobile/hooks/useLiveScores.ts,useLiveScores,hook,reviewed,B07 re-review PASS; ported to LiveScoresStore,b07-reviewer-2026-05-20,
wagerproof-mobile/types/liveScores.ts,liveScores,type,reviewed,B07 re-review PASS; ported to WagerproofModels/LiveScore.swift,b07-reviewer-2026-05-20,
```

These rows are **conditional on the B06 build fix landing**. If the orchestrator wants to flip B07 now despite the red build, it must accept that the next batch's build check will also fail until B06 is repaired. My strict reading of the brief is FAIL until the build is green; my practical reading is "B07 is content-clean, B06 is blocking, flip B07 the moment B06 unblocks."

---

## Verification commands run

```bash
# Waiver markers
grep -nE "FIDELITY-WAIVER #009" wagerproof_ios_native/Wagerproof/Features/Scoreboard/ScoreboardView.swift
#   → ScoreboardView.swift:82  ✅
grep -nE "FIDELITY-WAIVER #010" wagerproof_ios_native/Wagerproof/Features/Scoreboard/ScoreboardView.swift
#   → ScoreboardView.swift:84  ✅
grep -nE "FIDELITY-WAIVER #011" wagerproof_ios_native/WagerproofKit/Sources/WagerproofStores/LiveScoresStore.swift
#   → LiveScoresStore.swift:55  ✅
grep -nE "FIDELITY-WAIVER #007" wagerproof_ios_native/Wagerproof/Features/Scoreboard/ScoreboardView.swift
#   → ScoreboardView.swift:154  ✅ (still present)
grep -nE "FIDELITY-WAIVER #008" wagerproof_ios_native/Wagerproof/Features/Scoreboard/Components/LiveScorePredictionCard.swift
#   → LiveScorePredictionCard.swift:197  ✅ (still present)

# Fidelity table — no ❌ rows
grep -nE "❌" docs/wagerproof-migration/fidelity/b07-scoreboard.md
#   → only matches in legend (line 7) + "Diff summary (every 🔧/⚠️/❌ row)" header (line 131). No actual table rows.  ✅

# Waivers script
bash scripts/wagerproof-migration/grep-waivers.sh
#   → "Tracked waivers: 11 / ✅ All waivers map to tickets."  Exit 0.  ✅

# Build
cd wagerproof_ios_native && xcodebuild -project Wagerproof.xcodeproj -scheme Wagerproof \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro' -configuration Debug build
#   → ** BUILD FAILED **  (single error: EditorPicksStore.swift:624 — B06 territory, NOT B07)  ❌

# Parity screenshots
ls -la docs/wagerproof-migration/parity/scoreboard/
#   → empty.png (23 KB), loaded.png (40 KB), error.png (24 KB)  ✅
```
