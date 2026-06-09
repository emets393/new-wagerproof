# B09 Feature Requests — Independent Review

- **Verdict:** PASS
- **Build:** ✅ `** BUILD SUCCEEDED **` on `iPhone 16 Pro` simulator, Debug configuration
- **Reviewer:** b09-reviewer-2026-05-20 (fresh context, read-only)

## What was reviewed

Source: `wagerproof-mobile/app/(drawer)/(tabs)/feature-requests.tsx` (909 lines, read end-to-end).

Targets:
- `wagerproof_ios_native/Wagerproof/Features/FeatureRequests/FeatureRequestsView.swift` (346 lines)
- `wagerproof_ios_native/Wagerproof/Features/FeatureRequests/Components/FeatureRequestRow.swift` (291 lines)
- `wagerproof_ios_native/Wagerproof/Features/FeatureRequests/Sheets/SubmitFeatureRequestSheet.swift` (147 lines)
- `wagerproof_ios_native/Wagerproof/Features/FeatureRequests/FeatureRequestsFixtures.swift` (109 lines, DEBUG-only)
- `wagerproof_ios_native/WagerproofKit/Sources/WagerproofStores/FeatureRequestsStore.swift` (278 lines)
- `wagerproof_ios_native/WagerproofKit/Sources/WagerproofModels/FeatureRequest.swift` (108 lines)
- `wagerproof_ios_native/Wagerproof/Features/Navigation/SideMenuSheet.swift` (B09 row, lines 209–235)
- `wagerproof_ios_native/Wagerproof/Features/Navigation/MainTabView.swift` (sheet binding, lines 84–91)

Fidelity claim: `docs/wagerproof-migration/fidelity/b09-feature-requests.md`.

## Checks performed

1. **Build green** — ✅ `** BUILD SUCCEEDED **`.

2. **Fidelity table** — present, comprehensive. Sampled 5 rows; all verified against source:
   - `feature_requests` `.in("status", ["approved","roadmap"]).order("created_at", ascending: false)` — verified at `FeatureRequestsStore.swift:85–94` vs RN:82–86.
   - Vote delete branch — verified at `FeatureRequestsStore.swift:146–151` vs RN:174–178.
   - Vote update branch — verified at `FeatureRequestsStore.swift:153–159` vs RN:183–187.
   - Vote insert branch — verified at `FeatureRequestsStore.swift:161–172` vs RN:193–197.
   - Submit insert with `submitter_display_name` "Anonymous" fallback — verified at `FeatureRequestsStore.swift:204–213` vs RN:139–145.

3. **No `❌ missing` rows** — fidelity table confirms `❌ Nothing missing` (line 149).

4. **No `@State` fakes / mock data in production paths** — `grep -rE "@State.*=\s*\[" Features/FeatureRequests/` returns empty; `grep -rEi "(mock|sample|placeholder|stub)Data"` returns empty. `FeatureRequestsFixtures.swift` (the only sample-data source) is wrapped in `#if DEBUG` and only invoked from `ScreenshotHarness.makeFeatureRequests`. Verified.

5. **Real-store wiring** — `FeatureRequestsView` reads `@Environment(AuthStore.self)` and `@State private var store: FeatureRequestsStore`. Store calls `MainSupabase.shared.client` for both `feature_requests` and `feature_request_votes` (lines 81, 102, 140, 168, 205, 214).

6. **Backend byte-identity** — every table / column / status string matches RN exactly:
   - Tables: `feature_requests`, `feature_request_votes` ✅
   - Columns: `feature_request_id`, `vote_type`, `user_id`, `status`, `submitted_by`, `submitter_display_name`, `roadmap_status`, `upvotes`, `downvotes`, `created_at`, `updated_at` ✅
   - Statuses: `'pending'`, `'approved'`, `'roadmap'` ✅
   - Vote types: `'upvote'`, `'downvote'` ✅
   - Order: `created_at` DESC ✅

7. **Native primitives** — every required primitive used:
   - `NavigationStack` rooted (FeatureRequestsView.swift:51) ✅
   - `List` with `.listStyle(.insetGrouped)` (FeatureRequestsView.swift:128, 195) ✅
   - `.refreshable { await store.refresh(userId:) }` (FeatureRequestsView.swift:82–84) ✅
   - `.sheet(isPresented:)` for submit modal with `.presentationDetents([.medium, .large])` + `.presentationDragIndicator(.visible)` (FeatureRequestsView.swift:90–107) ✅
   - `.contextMenu` per row for Copy / Share (FeatureRequestsView.swift:215–224) ✅
   - `Form` w/ `TextField` axis vertical (SubmitFeatureRequestSheet.swift:45–87) ✅
   - `ContentUnavailableView` empty states (FeatureRequestsView.swift:132, 288) ✅

   Note: the spec mentioned `.swipeActions` as one option for vote affordances; the implementer correctly chose `.contextMenu` (also explicitly allowed by the spec). No swipe-actions needed because vote buttons are visible in-row.

8. **SF Symbol parity** — all 10 spec swaps verified in code:
   - `lightbulb.fill` (FeatureRequestsView.swift:144, FeatureRequestRow.swift:31) ✅
   - `lightbulb` empty (FeatureRequestsView.swift:133, 289) ✅
   - `map.fill` (FeatureRequestRow.swift:56) ✅
   - `clock` (FeatureRequestsView.swift:156, FeatureRequestRow.swift:38) ✅
   - `paperplane.circle.fill` (FeatureRequestsView.swift:172, FeatureRequestRow.swift:44) ✅
   - `checkmark.circle.fill` (FeatureRequestsView.swift:188, FeatureRequestRow.swift:50) ✅
   - `hand.thumbsup.fill` / `hand.thumbsdown.fill` (FeatureRequestRow.swift:159) ✅
   - `plus` (FeatureRequestsView.swift:71) ✅
   - `xmark` (FeatureRequestsView.swift:61) ✅

9. **Animation tokens** — `.appQuick` and `.appStandard` used (FeatureRequestsView.swift:198–199). No raw `.spring(...)` calls anywhere in B09 scope.

10. **Haptics** — all per spec:
    - `.sensoryFeedback(.impact(weight: .light))` on `+` toolbar (FeatureRequestsView.swift:79) ✅
    - `.sensoryFeedback(.success, trigger: store.justSubmittedAt)` (FeatureRequestsView.swift:108) ✅
    - `.sensoryFeedback(.selection, trigger: store.userVotes)` (FeatureRequestsView.swift:109) ✅
    - `.sensoryFeedback(.warning, trigger: store.lastError)` in submit sheet (SubmitFeatureRequestSheet.swift:114) ✅

11. **Symbol effect + numeric content transition** — `.symbolEffect(.bounce, value: request.roadmapStatus)` on row icon (FeatureRequestRow.swift:78), `.contentTransition(.numericText())` on netBadge (FeatureRequestRow.swift:189) — both match spec §6 animation notes.

12. **Parity screenshots** — all three present and the correct file size (non-empty):
    - `docs/wagerproof-migration/parity/feature-requests/empty.png` (147 KB)
    - `docs/wagerproof-migration/parity/feature-requests/loaded.png` (308 KB)
    - `docs/wagerproof-migration/parity/feature-requests/error.png` (138 KB)

13. **Side menu integration** — `SideMenuSheet.featureRequestsRow` (lines 215–235) replaces the prior B03 placeholder. Tap path: dismiss menu → `DispatchQueue.main.asyncAfter(0.35s)` → `tabStore.isFeatureRequestsPresented = true` → `MainTabView` `.sheet(isPresented: $binding.isFeatureRequestsPresented)` presents `FeatureRequestsView()` (MainTabView.swift:88–91). The 350ms defer is the right call — iOS refuses to chain-present a new sheet while one is on screen.

14. **Tap targets** — vote buttons render 32×32 inside List row padding (≈44pt total surface, HIG-compliant per implementer audit at fidelity:162–166). Toolbar buttons inherit the system 44pt zone. Empty-state action button is `.borderedProminent` ≈ 200×44pt.

15. **Inventory flip** — `inventory.overrides.csv` line 28 has `wagerproof-mobile/app/(drawer)/(tabs)/feature-requests.tsx,feature-requests,screen,candidate,…` flipping `missing` → `candidate`. Correct.

16. **Waivers script** — exits non-zero (2), BUT the orphan waiver is **`Wagerproof/Features/Picks/PicksView.swift:27`** referencing `#012`, which is a **B05** file outside B09's scope. No `FIDELITY-WAIVER` markers exist in any B09 file (`grep -rn "FIDELITY-WAIVER" Features/FeatureRequests/ WagerproofStores/FeatureRequestsStore.swift WagerproofModels/FeatureRequest.swift` returns empty). This does not block B09; it will block B05 reviewer signoff.

## Issues

1. (Informational, not blocking B09) `grep-waivers.sh` exits 2 because of an orphan `FIDELITY-WAIVER #012` in `Wagerproof/Features/Picks/PicksView.swift:27`. This is a B05 leftover — the missing ticket is `docs/wagerproof-migration/tickets/012-*.md`. B05 reviewer must address.

## Minor observations (no action required)

- The implementer added a `.contextMenu` with Copy + Share even though the RN screen has no such affordance — the fidelity table marks this `🔧 fixed` and explains it as a native iOS expectation. Reasonable.
- Empty-state copy diverges slightly from RN ("Be the first to submit one! Tap the green + button up top." vs RN's "Be the first to submit one!") — flagged `🔧 fixed` for actionability. Reasonable.
- Pre-existing B05 fixes inside `EditorPicksStore.swift` + `EditorPickCard.swift` (fidelity:170–176) are out-of-scope rescues that unblock the build. Noted for B05 reviewer.

## Recommendation

PASS. Append the following row to `inventory.overrides.csv` flipping the B09 RN file from `candidate` → `reviewed`:

```
wagerproof-mobile/app/(drawer)/(tabs)/feature-requests.tsx,feature-requests,screen,reviewed,b09-reviewer-2026-05-20 signoff; fidelity at docs/wagerproof-migration/fidelity/b09-feature-requests.md; review at docs/wagerproof-migration/fidelity/b09-feature-requests-review.md,b09-reviewer-2026-05-20,
```

(B09 only has the single RN file in scope per `batches.md` §B09. Discord modal is covered in B08.)
