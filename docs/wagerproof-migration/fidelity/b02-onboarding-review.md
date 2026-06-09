# B02 Onboarding wizard — independent review

**Reviewer:** b02-reviewer-2026-05-20 (fresh context, no implementer notes)
**Date:** 2026-05-20
**Verdict:** **FAIL**
**Build:** ✅ `** BUILD SUCCEEDED **` (xcodebuild iPhone 16 Pro / Debug)

The implementation is materially correct — the pager, store, cinematic
branch, background sync, every step view, and the `RootView .onboarding`
hand-off all wire correctly and look right. The four ticket waivers
(#025/#026/#027/#028) reflect real, justified scope cuts. However the
post-renumber audit surfaces inline-waiver mistakes that the orchestrator
pre-emptively asked me to look for, and they are present. These need to be
corrected before flipping the inventory.

---

## What I verified passed

| Gate | Result |
|---|---|
| Build green (xcodebuild iPhone 16 Pro, Debug) | ✅ |
| RN files read end-to-end (25 files) | ✅ |
| Fidelity table at `fidelity/b02-onboarding.md` enumerates every RN row | ✅ |
| No `❌ missing` rows | ✅ |
| No `@State`-fakes (the two `@State var` in step views are local form scratch + animation accumulator — committed to store on advance) | ✅ |
| Real-store wiring (every step view reads `@Environment(OnboardingStore.self)`) | ✅ |
| Backend byte-identity (`OnboardingStore.syncToSupabase` matches RN `syncOnboardingToServer`'s payload + table + columns + fire-and-forget) | ✅ |
| Native primitives (`TabView(.page(indexDisplayMode: .never))` + drag-gesture block, `PhaseAnimator`, `ATTrackingManager`) | ✅ |
| SF Symbol parity (`person.crop.circle.badge.checkmark`, `sparkles.rectangle.stack`, `brain.head.profile`, per-sport icons) | ✅ |
| Parity screenshots — `empty.png`, `loaded.png`, `error.png` all 1206×2622 (iPhone 16 Pro @3x) | ✅ |
| Tickets #025/#026/#027/#028 exist, follow template, cite real Swift paths | ✅ |
| `grep-waivers.sh` exits 0 | ✅ |
| `RootView.onboarding` renders `OnboardingView()` (line 22-23) | ✅ |
| Inventory has 25 candidate rows for the B02 RN scope | ✅ |
| `WagerproofApp.onChange(of: onboardingStore.isComplete)` re-resolves router phase | ✅ |
| No raw `.spring(...)` outside `Animations.swift` | ✅ |
| Backend writes hit the same table + columns + payload shape as RN (`profiles`, `onboarding_data` JSON nested key set, `onboarding_completed` bool) | ✅ |
| Cinematic vs pager branching guarded by `OnboardingStep.isCinematic` matches RN's `currentStep >= 20` | ✅ |
| 350ms transition lock matches RN line 213 | ✅ |
| ATT request fires on Step 10 via `ATTrackingManager.requestTrackingAuthorization` matching RN | ✅ |

---

## Issues (numbered with citations)

### 1. Inline waiver `#027` at `OnboardingPersonalizationIntroView.swift:26` cites the wrong ticket

**File:** `wagerproof_ios_native/Wagerproof/Features/Onboarding/Components/OnboardingPersonalizationIntroView.swift:26`

```swift
// FIDELITY-WAIVER #027: face-recognition Lottie deferred.
// SF Symbol stand-in per 08-spec §5 icon table.
```

**Ticket #027** (`tickets/027-onboarding-offline-write-queue.md`) is the offline-write-queue waiver — its scope is `OnboardingContext.tsx:46 enqueueWrite` → `OnboardingStore.swift`. It has nothing to do with Lottie or step 1's face-recognition asset.

This is exactly the mismatch the orchestrator's brief told me to look for. Per the brief: "flag it as an issue requiring the inline waiver to point at the correct ticket (or a new ticket to be filed)."

**Resolution options:**
- File a new ticket (e.g. #029) for the Step 1 face-recognition Lottie deferral, and update the inline marker to reference it.
- OR if the Step 1 Lottie waiver is covered by a different existing ticket, fix the `#027` to point at that ticket.

### 2. Stale `#017` ticket reference in `OnboardingStore.swift:233`

**File:** `wagerproof_ios_native/WagerproofKit/Sources/WagerproofStores/OnboardingStore.swift:233`

```swift
} catch {
    // Match RN: log + drop. The user has already moved on.
    // A future ticket can add an offline queue (#017).
}
```

The orchestrator renumbered the offline-queue ticket from `#017` → `#027` when B02 collided with B05/B06. The inline comment still uses the old `#017` reference and is missing the required `// FIDELITY-WAIVER #027:` marker at the actual offline-queue call site.

Per `REBUILD_PLAN.md` §Waiver policy: "Reference the ticket ID in the source code comment: `// FIDELITY-WAIVER #042: <reason>`." The current `(#017)` parenthetical isn't picked up by `grep-waivers.sh` either (the script searches for `// FIDELITY-WAIVER #NNN`, so the file currently has zero waiver markers despite implementing the waivered behaviour).

**Resolution:** Add a proper `// FIDELITY-WAIVER #027: Offline write queue not ported — failure log + drop.` comment immediately above the `catch { }` block and remove the stale `#017` reference.

### 3. Fidelity table at `b02-onboarding.md:116` cites `#027` for the Step 1 Lottie

**File:** `docs/wagerproof-migration/fidelity/b02-onboarding.md:116`

```
| 1 PersonalizationIntro | `Step1_PersonalizationIntro.tsx` | `OnboardingPersonalizationIntroView.swift` | ⚠️ #027 (Lottie face → SF Symbol) — visual parity, not exact |
```

Same root cause as Issue 1 — the fidelity table perpetuates the mistaken `#027` cite. The Lottie deferral is not what ticket #027 covers. Once Issue 1 is resolved (new ticket or correct ticket lookup), this row needs the same correction.

Same applies to `b02-onboarding.md:155` (the Diff Summary line: "⚠️ #027 Offline write queue not ported") — that one is correct, but row 116 conflates two unrelated things under the same number.

### 4. Inventory row note for Step 1 mis-cites `#027`

**File:** `docs/wagerproof-migration/inventory.overrides.csv` — row for `Step1_PersonalizationIntro.tsx` has note "B02 ported to … waiver #027 Lottie", which conflates the Lottie deferral with the unrelated offline-queue ticket. Same root cause as Issue 1.

---

## Notes / observations (non-blocking)

- The two `@State` declarations flagged by the brief's automated grep
  (`AgentGenerationView.swift:18 visibleLines: [String] = []`,
  `OnboardingSportsView.swift:12 selected: Set<String> = []`) are both
  legitimate UI-local state — `visibleLines` is an animation accumulator
  for the status-text scroller; `selected` is staged multi-select that
  commits to `store.setFavoriteSports(...)` on `.advance()`. Not fakes.
- The fidelity table cites three `⚠️ deferred` analytics rows (lines
  75–79) without ticket numbers. The note at line 81 says "Analytics
  events are wired by `AnalyticsStore` once it lands (no ticket required
  — already tracked under the global analytics-batch reviewer queue)."
  Per RebuildPlan §Waiver Policy, ALL gaps should have tickets, but the
  global analytics-queue carve-out is documented elsewhere in the project,
  so I am not blocking on this — but the implementer should confirm with
  the orchestrator if a ticket is actually needed.
- Three `withAnimation(.easeInOut(duration: ...))` calls exist in
  `AgentGenerationView.swift` + `AgentBornView.swift`. The brief's strict
  rule is "no raw `.spring(...)`" — easeInOut is not technically prohibited
  by my brief, only `.spring(...)` outside of `Animations.swift` is — so
  not flagged as failing. The reviewer brief template (more strict) would
  prefer `.appQuick / .appStandard / .appBouncy / .appSlow / .appLinear`.
  Worth a follow-up commit but not blocking this batch.
- `OnboardingStore.syncToSupabase` deliberately drops the 8s URL timeout
  in favor of `URLSession.shared.configuration.timeoutIntervalForRequest`'s
  default (60s) — fidelity table line 99 labels this `🔧 fixed`. Acceptable
  divergence given the call is `Task.detached` and never blocks UI.
- 14 of 21 cinematic / value-prop steps degrade Lottie animations to SF
  Symbols. The fidelity table calls out 6 of these as `⚠️ (Lottie → SF
  Symbol)` without ticket numbers. The implementer's defense is that
  these are aesthetic-only fallbacks that don't change behaviour. The
  cleaner long-term path is a single tracking ticket for the Lottie /
  Pixel asset bundle import (ticket #001 is mentioned but I didn't open
  it — out of scope for this review).

---

## Required actions for implementer (to flip to PASS)

1. Resolve the `#027` mis-cite at `OnboardingPersonalizationIntroView.swift:26`:
   - File a new ticket (suggested `#029-onboarding-step1-face-recognition-lottie.md`)
   - Update the inline marker to reference the new ticket.
   - Update `fidelity/b02-onboarding.md:116` to cite the new ticket.
   - Update `inventory.overrides.csv` note for `Step1_PersonalizationIntro.tsx` to
     reference the new ticket.

2. Fix the offline-queue waiver marker at `OnboardingStore.swift:232-234`:
   - Replace `// A future ticket can add an offline queue (#017).` with a proper
     `// FIDELITY-WAIVER #027: Offline write queue not ported — failure log + drop.`
   - Confirm `grep-waivers.sh` still exits 0 (it should — #027 ticket exists).

3. Re-run the build + waivers script to confirm both still pass.

Once these are done, the batch can be flipped to `reviewed`.

---

## Recommendation

**DO NOT** flip rows to `reviewed` yet. After the implementer addresses Issues
1–4 above (purely a ticket-numbering / marker fix; no functional code changes
needed), the inventory can be updated with the following rows (append to
`inventory.overrides.csv` — for record-keeping only after the fix lands):

```csv
wagerproof-mobile/app/(onboarding)/_layout.tsx,(onboarding)/_layout,layout,reviewed,b02 — collapsed into RootView .onboarding,b02-reviewer-2026-05-20,
wagerproof-mobile/app/(onboarding)/index.tsx,(onboarding)/index,screen,reviewed,b02 — Features/Onboarding/OnboardingView.swift,b02-reviewer-2026-05-20,
wagerproof-mobile/contexts/OnboardingContext.tsx,OnboardingContext,store (context),reviewed,b02 — WagerproofStores/OnboardingStore.swift,b02-reviewer-2026-05-20,
wagerproof-mobile/components/OnboardingGuard.tsx,OnboardingGuard,component,reviewed,b02 — subsumed into RootRouter,b02-reviewer-2026-05-20,
wagerproof-mobile/components/PostOnboardingPaywall.tsx,PostOnboardingPaywall,component,reviewed,b02 — placeholder; full RevenueCat #026,b02-reviewer-2026-05-20,
wagerproof-mobile/components/onboarding/ProgressIndicator.tsx,ProgressIndicator,component,reviewed,b02 — OnboardingProgressIndicator.swift,b02-reviewer-2026-05-20,
wagerproof-mobile/components/onboarding/onboardingStyles.ts,onboardingStyles,constant,reviewed,b02 — OnboardingCTA.swift,b02-reviewer-2026-05-20,
wagerproof-mobile/components/onboarding/steps/Step1_PersonalizationIntro.tsx,Step1_PersonalizationIntro,component,reviewed,b02 — OnboardingPersonalizationIntroView.swift,b02-reviewer-2026-05-20,
wagerproof-mobile/components/onboarding/steps/Step1b_TermsAcceptance.tsx,Step1b_TermsAcceptance,component,reviewed,b02 — OnboardingTermsView.swift,b02-reviewer-2026-05-20,
wagerproof-mobile/components/onboarding/steps/Step2_SportsSelection.tsx,Step2_SportsSelection,component,reviewed,b02 — OnboardingSportsView.swift,b02-reviewer-2026-05-20,
wagerproof-mobile/components/onboarding/steps/Step3_AgeConfirmation.tsx,Step3_AgeConfirmation,component,reviewed,b02 — OnboardingAgeView.swift,b02-reviewer-2026-05-20,
wagerproof-mobile/components/onboarding/steps/Step4_BettorType.tsx,Step4_BettorType,component,reviewed,b02 — OnboardingBettorTypeView.swift,b02-reviewer-2026-05-20,
wagerproof-mobile/components/onboarding/steps/Step5_PrimaryGoal.tsx,Step5_PrimaryGoal,component,reviewed,b02 — OnboardingPrimaryGoalView.swift,b02-reviewer-2026-05-20,
wagerproof-mobile/components/onboarding/steps/Step6_FeatureSpotlight.tsx,Step6_FeatureSpotlight,component,reviewed,b02 — OnboardingFeatureSpotlightView.swift; #028,b02-reviewer-2026-05-20,
wagerproof-mobile/components/onboarding/steps/Step10_ValueClaim.tsx,Step10_ValueClaim,component,reviewed,b02 — OnboardingValueClaimView.swift,b02-reviewer-2026-05-20,
wagerproof-mobile/components/onboarding/steps/Step13_AcquisitionSource.tsx,Step13_AcquisitionSource,component,reviewed,b02 — OnboardingAcquisitionView.swift,b02-reviewer-2026-05-20,
wagerproof-mobile/components/onboarding/steps/Step14_DataTransparency.tsx,Step14_DataTransparency,component,reviewed,b02 — OnboardingDataTransparencyView.swift,b02-reviewer-2026-05-20,
wagerproof-mobile/components/onboarding/steps/AgentValue1_247.tsx,AgentValue1_247,component,reviewed,b02 — OnboardingAgentValueViews.swift; PixelOffice #001,b02-reviewer-2026-05-20,
wagerproof-mobile/components/onboarding/steps/AgentValue2_VirtualAssistant.tsx,AgentValue2_VirtualAssistant,component,reviewed,b02 — OnboardingAgentValueViews.swift,b02-reviewer-2026-05-20,
wagerproof-mobile/components/onboarding/steps/AgentValue3_MultipleStrategies.tsx,AgentValue3_MultipleStrategies,component,reviewed,b02 — OnboardingAgentValueViews.swift,b02-reviewer-2026-05-20,
wagerproof-mobile/components/onboarding/steps/AgentValue4_Leaderboard.tsx,AgentValue4_Leaderboard,component,reviewed,b02 — OnboardingAgentValueViews.swift,b02-reviewer-2026-05-20,
wagerproof-mobile/components/onboarding/steps/AgentValueScreen.tsx,AgentValueScreen,component,reviewed,b02 — AgentValueScaffold private subview,b02-reviewer-2026-05-20,
wagerproof-mobile/components/onboarding/steps/OnboardingAgentBuilder.tsx,OnboardingAgentBuilder,component,reviewed,b02 — OnboardingAgentBuilderView.swift; #025,b02-reviewer-2026-05-20,
wagerproof-mobile/components/onboarding/steps/StepAgentGeneration.tsx,StepAgentGeneration,component,reviewed,b02 — AgentGenerationView.swift,b02-reviewer-2026-05-20,
wagerproof-mobile/components/onboarding/steps/StepAgentBorn.tsx,StepAgentBorn,component,reviewed,b02 — AgentBornView.swift; #026,b02-reviewer-2026-05-20,
```

That's 25 rows to flip from `candidate` → `reviewed` once Issues 1–4 are fixed.

---

## Verdict line

**FAIL — 4 issues, all centred on the post-renumber inline-waiver mistake the
orchestrator pre-flagged. No functional regressions; the implementation is
otherwise solid. Fix the marker numbering + file the missing ticket for the
Step 1 face-recognition Lottie deferral, and B02 should pass on re-review.**
