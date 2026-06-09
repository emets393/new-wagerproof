# B19 Roast — Re-Review #2 Verdict

**Reviewer:** b19-reviewer-2026-05-20 (fresh context, read-only)
**Date:** 2026-05-20
**Verdict:** FAIL (Roast-specific fixes all PASS; external gates blocked by unrelated in-flight batches)

---

## Roast fix-up checklist — ALL FOUR PASS

1. **Raw `.spring(...)` removed** from `Features/Roast/`: clean. The previously-flagged `RoastView.swift:252` now uses `.appStandard`.
2. **`FIDELITY-WAIVER #061` markers** present at `RoastSessionStore.swift:195` (`toggleRecording()`) and `:230` (`connect()`).
3. **Ticket #061** exists at `docs/wagerproof-migration/tickets/061-roast-gemini-live-driver.md` with proper template structure; cites real Swift files and references both inline waiver locations.
4. **Fidelity table** line 152 now `⚠️ #061` with notes. Zero `❌` data rows (legend / section heading text only).

## External gates — BOTH BLOCKED BY OTHER BATCHES

5. **Build FAIL**: `WagerproofKit/Sources/WagerproofStores/RevenueCatStore.swift:227:9: error: main actor-isolated property 'streamTask' can not be referenced from a nonisolated context` (inside `deinit`). Not a Roast file — owned by **B08 (Settings + paywall)**, in-flight at re-review time.
6. **Waivers script EXIT=2**: pre-existing waivers in `WagerproofKit/Sources/WagerproofStores/GamesStore.swift:647-648` reference tickets #030 and #031 that do not yet exist in `tickets/`. Not Roast-related — owned by **B04 (Games tab)**, in-flight at re-review time.

## No regressions on first review's PASS items

- Side-menu `SideMenuSheet.swift:241-264` Roast row present
- `.fullScreenCover` at `MainTabView.swift:95-98`
- Zero `@State` fakes in `Features/Roast/`
- All three parity screenshots (`empty.png`/`loaded.png`/`error.png`) present

## Recommendation

Hold all 6 B19 RN rows at `candidate` until the external gates clear. The Roast batch's own work product is complete and correct; the two failing gates are cross-batch contamination. Once B04 files tickets #030/#031 and B08 fixes the `streamTask` actor-isolation error, B19 is eligible to flip without further audit of its own content.

Suggested follow-up: after B04 + B08 land, run a quick orchestrator re-check (build green + waivers script exit 0) and apply the 6 B19 flips directly without re-spawning a reviewer agent — the content audit is already complete.
