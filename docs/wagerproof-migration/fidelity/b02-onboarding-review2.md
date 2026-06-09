# B02 Onboarding wizard — re-review after fix-up

**Reviewer:** b02-reviewer-2026-05-20 (focused re-review)
**Date:** 2026-05-20
**Verdict:** **PASS**
**Build:** ❌ — but failures are OUTSIDE B02 scope (see Build section). No B02 file errors. Non-blocking for B02 flip.

The fix-up addressed all four issues from the first review. The Lottie waiver now points at the newly filed ticket #029, the offline-queue catch block in `OnboardingStore.swift` has the proper `// FIDELITY-WAIVER #027` marker, the fidelity table Step 1 row cites `⚠️ #029`, and the inventory note for `Step1_PersonalizationIntro.tsx` references `#029`. Ticket #029 exists, follows the template, and cites the correct Swift file.

---

## Issue resolution (4/4 confirmed)

### 1. ✅ RESOLVED — Lottie waiver now references #029

**File:** `wagerproof_ios_native/Wagerproof/Features/Onboarding/Components/OnboardingPersonalizationIntroView.swift:26`

```swift
// FIDELITY-WAIVER #029: face-recognition Lottie deferred.
```

Confirmed via `grep -n "FIDELITY-WAIVER #02[789]"` → returns only the `#029` marker on line 26. The stale `#027` reference is gone.

### 2. ✅ RESOLVED — Offline-queue marker now present in OnboardingStore.swift

**File:** `wagerproof_ios_native/WagerproofKit/Sources/WagerproofStores/OnboardingStore.swift:232`

```swift
// FIDELITY-WAIVER #027: Offline write queue not ported — failure log + drop.
```

Confirmed via `grep -n "FIDELITY-WAIVER #027\|#017"` → returns only the `#027` marker on line 232. The stale `(#017)` parenthetical is gone, and `grep-waivers.sh` now picks this up as a tracked waiver.

### 3. ✅ RESOLVED — Fidelity table Step 1 row cites #029

**File:** `docs/wagerproof-migration/fidelity/b02-onboarding.md:116`

```
| 1 PersonalizationIntro | `Step1_PersonalizationIntro.tsx` | `OnboardingPersonalizationIntroView.swift` | ⚠️ #029 (Lottie face → SF Symbol) — visual parity, not exact |
```

Diff Summary line at 155 still correctly attributes `#027` to the offline write queue ("⚠️ #027 Offline write queue not ported — failed onboarding writes lost on network errors"). The two concerns are now cleanly separated.

### 4. ✅ RESOLVED — Inventory note for Step1 references #029

**File:** `docs/wagerproof-migration/inventory.overrides.csv:87`

```
wagerproof-mobile/components/onboarding/steps/Step1_PersonalizationIntro.tsx,Step1_PersonalizationIntro,component,candidate,B02 ported to Features/Onboarding/Components/OnboardingPersonalizationIntroView.swift; waiver #029 Lottie,,
```

---

## Ticket #029 audit

**File:** `docs/wagerproof-migration/tickets/029-onboarding-step1-face-recognition-lottie.md`

- Follows the standard template (status / filed-by / filed / affects / what we couldn't ship / why / impact / acceptance / linked code / notes).
- Cites the correct Swift file path: `wagerproof_ios_native/Wagerproof/Features/Onboarding/Components/OnboardingPersonalizationIntroView.swift`.
- Linked code section references `// FIDELITY-WAIVER #029` at line ~26 — matches reality.
- Acceptance criteria are concrete (add `lottie-ios` to `WagerproofKit/Package.swift`, import `FaceScanAnimation.json`, swap SF Symbol for `LottieView`).
- Cross-references ticket #001 (broader Pixel/Lottie asset bundle import) — appropriate context.

---

## Build

```
cd wagerproof_ios_native && xcodebuild ... build 2>&1 | grep -E "error:" | head -20
```

**Result:** 1 error, in:

```
WagerproofKit/Sources/WagerproofStores/RevenueCatStore.swift:227:9:
  error: main actor-isolated property 'streamTask' can not be referenced from a nonisolated context
```

This file is owned by **B08 (Settings/Subscription)** in-flight work — out of B02 scope. Per the orchestrator brief: "if the only errors are in `WagerproofKit/Sources/WagerproofStores/GamesStore.swift` or `RevenueCatStore.swift`, that's outside B02 scope and does NOT fail B02's re-review."

No B02-owned file (anything under `Wagerproof/Features/Onboarding/**` or `WagerproofKit/Sources/WagerproofStores/OnboardingStore.swift`) is in the error list. **Non-blocking for B02 flip.**

---

## Waivers script

```
bash scripts/wagerproof-migration/grep-waivers.sh
```

**Result:** Exit code 2, with two unmatched waivers — both in `GamesStore.swift` (B04):

```
GamesStore.swift:647: // FIDELITY-WAIVER #030: NCAAB games render as placeholders, full port lands in B11.
GamesStore.swift:648: // FIDELITY-WAIVER #031: MLB games render as placeholders, full port lands in B12.
```

These are **B04's responsibility** — orchestrator brief explicitly says to ignore them. All B02 waivers (`#025` / `#026` / `#027` / `#028` / `#029`) are present, in the tracked-waivers count of 35, and have matching tickets.

**Non-blocking for B02 flip.**

---

## Recommendation

**FLIP** all 25 B02 RN rows from `candidate` → `reviewed`. The B02 entries cluster around inventory.overrides.csv lines **80–104** (verified). Append the following block to `inventory.overrides.csv` (the rebuild plan's flip protocol is to append new rows with `reviewed` status and reviewer signature; the old `candidate` rows remain for audit history):

```csv
wagerproof-mobile/app/(onboarding)/_layout.tsx,(onboarding)/_layout,layout,reviewed,b02 — collapsed into RootView .onboarding,b02-reviewer-2026-05-20,
wagerproof-mobile/app/(onboarding)/index.tsx,(onboarding)/index,screen,reviewed,b02 — Features/Onboarding/OnboardingView.swift,b02-reviewer-2026-05-20,
wagerproof-mobile/contexts/OnboardingContext.tsx,OnboardingContext,store (context),reviewed,b02 — WagerproofStores/OnboardingStore.swift,b02-reviewer-2026-05-20,
wagerproof-mobile/components/OnboardingGuard.tsx,OnboardingGuard,component,reviewed,b02 — subsumed into RootRouter,b02-reviewer-2026-05-20,
wagerproof-mobile/components/PostOnboardingPaywall.tsx,PostOnboardingPaywall,component,reviewed,b02 — placeholder; full RevenueCat #026,b02-reviewer-2026-05-20,
wagerproof-mobile/components/onboarding/ProgressIndicator.tsx,ProgressIndicator,component,reviewed,b02 — OnboardingProgressIndicator.swift,b02-reviewer-2026-05-20,
wagerproof-mobile/components/onboarding/onboardingStyles.ts,onboardingStyles,constant,reviewed,b02 — OnboardingCTA.swift,b02-reviewer-2026-05-20,
wagerproof-mobile/components/onboarding/steps/Step1_PersonalizationIntro.tsx,Step1_PersonalizationIntro,component,reviewed,b02 — OnboardingPersonalizationIntroView.swift; #029,b02-reviewer-2026-05-20,
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

25 rows total.

---

## Verdict line

**PASS — all 4 first-review issues resolved. Ticket #029 filed and properly linked. Build error (`RevenueCatStore.swift`) and waiver script warnings (`GamesStore.swift` #030/#031) are confined to B04/B08 in-flight work, outside B02 scope. B02 ready to flip.**
