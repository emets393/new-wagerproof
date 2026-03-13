# Onboarding Refactor Plan — Mobile App

## Problem Summary

Two critical UX issues:
1. **Long loading times** between onboarding pages after tapping "Continue" on certain screens
2. **Janky exit transition** — after paywall/completion, user sees a flash back to the onboarding screen before the home screen appears

## Root Cause Analysis

### Issue 1: Long Loading Times
The loading delays are caused by **async operations that block before calling `nextStep()`**:

- **OnboardingAgentBuilder (step 19 → 20)**: `handleCreate()` awaits both `createMutation.mutateAsync()` AND `markOnboardingCompleted()` sequentially before calling `nextStep()`. This means the user waits for 2 network roundtrips.
- **Step14_DataTransparency**: On mount, requests tracking permissions with a hardcoded 500ms delay.
- **StepAgentGeneration (step 20)**: 6 seconds of hardcoded `setTimeout(3000)` × 2 stages that cannot be skipped.
- **StepAgentBorn (step 21)**: 3 second reveal animation + 3 second delay before feedback modal = 6+ seconds before user can interact.

### Issue 2: Janky Exit Transition (Flash Back to Onboarding)
This is caused by **three compounding bugs**:

1. **Wrong navigation path**: Every exit point uses `router.replace('/(tabs)')` but the correct path is `router.replace('/(drawer)/(tabs)')`. The `/(tabs)` route doesn't exist at the root level, so navigation fails silently.

2. **Competing navigation calls**: When the invalid path fails, the user stays on the `(onboarding)` modal. Meanwhile, `submitOnboardingData()` updates the database with `onboarding_completed = true`. The OnboardingGuard detects this change, sees the user is still in `(onboarding)`, and fires its own `router.replace('/(drawer)/(tabs)')`. This second navigation dismisses the modal — but the modal dismissal animation creates a visible flash.

3. **Modal presentation**: The `(onboarding)` group is presented as `presentation: 'modal'` in the root Stack. Modal dismissal has its own native animation (slide down), which compounds with the route change to create the jank.

**Files with wrong `/(tabs)` path:**
- `StepAgentBorn.tsx:93`
- `Step16_Paywall.tsx:142, 158`
- `Step16_RevenueCatPaywall.tsx:74`
- `PaywallBottomSheet.tsx:64`

## Refactor Plan

### Phase 1: Fix the Exit Transition (Critical)

**1a. Create a centralized `completeOnboarding()` function in OnboardingContext**

Add a new function to the context that handles the entire completion flow in one place:
```
completeOnboarding():
  1. Set a local "completing" flag (prevents double-calls)
  2. Call markOnboardingCompleted() (database write)
  3. Set a context flag `isCompleted = true` that OnboardingGuard can react to immediately
  4. Do NOT call router.replace() — let the guard handle all navigation
```

This eliminates the race condition by having a single source of truth for navigation.

**1b. Refactor OnboardingGuard to use in-memory state, not just DB**

Currently the guard only checks the database. We'll add the ability for `OnboardingContext` to signal completion immediately via an in-memory flag, so the guard can react without waiting for a DB refetch:

- Add an `onCompleted` callback prop or shared state between OnboardingContext and OnboardingGuard
- When `completeOnboarding()` sets the flag, OnboardingGuard immediately navigates to `/(drawer)/(tabs)`
- Remove the DB refetch-on-segment-change logic (lines 63-94 in OnboardingGuard) — it's a workaround for the real bug

**1c. Remove ALL `router.replace()` calls from step components**

Every step component that currently calls `router.replace('/(tabs)')` will instead just call `completeOnboarding()` from context. The guard handles the actual navigation. Files to change:
- `StepAgentBorn.tsx` — remove router.replace, call completeOnboarding()
- `Step16_Paywall.tsx` — remove router.replace, call completeOnboarding()
- `Step16_RevenueCatPaywall.tsx` — remove router.replace, call completeOnboarding()
- `PaywallBottomSheet.tsx` — remove router.replace, call completeOnboarding()

**1d. Change onboarding presentation from `modal` to `card` or default**

In `_layout.tsx`, change:
```
presentation: 'modal'  →  presentation: 'card'  (or remove entirely)
```
This eliminates the modal dismiss animation that causes the flash. The `router.replace()` from the guard will do a clean swap.

### Phase 2: Fix Loading Delays Between Steps

**2a. Parallelize agent creation and onboarding completion**

In `OnboardingAgentBuilder.handleCreate()`:
- Call `nextStep()` IMMEDIATELY after `createMutation.mutateAsync()` succeeds
- Fire `markOnboardingCompleted(newAgent.id)` in the background (don't await it before navigating to the generation step)
- This is safe because the generation animation (step 20) takes 6 seconds, giving plenty of time for the DB write

Current:
```
await createMutation.mutateAsync(...)  // wait
await markOnboardingCompleted(...)     // wait
nextStep()                             // finally navigate
```

Refactored:
```
const newAgent = await createMutation.mutateAsync(...)  // wait (necessary)
nextStep()                                               // navigate immediately
markOnboardingCompleted(newAgent.id)                     // fire and forget
```

**2b. Remove the 300ms setTimeout delays before navigation**

In `Step16_Paywall.tsx`, `Step16_RevenueCatPaywall.tsx`, and `PaywallBottomSheet.tsx`, remove the artificial `setTimeout(() => { router.replace(...) }, 300)` pattern. Since we're moving navigation to the guard, this is automatically resolved.

**2c. Remove the artificial 500ms delay in Step14_DataTransparency**

The tracking permission request has a hardcoded 500ms `setTimeout` before calling `requestTrackingPermissionsAsync()`. Remove this delay — call it immediately.

### Phase 3: Cleanup & Hardening

**3a. Remove duplicate onboarding completion calls**

Currently, `submitOnboardingData()` and `markOnboardingCompleted()` can both be called from different places for the same completion event. In the agent builder flow:
1. `OnboardingAgentBuilder` calls `markOnboardingCompleted()` after agent creation
2. `StepAgentBorn` calls `submitOnboardingData()` again on "Let's see the picks!"

This means the DB is written to twice. With the new centralized `completeOnboarding()`, we ensure it's called exactly once (the `hasCompletedOnboarding` ref already guards against this, but the architecture should make it impossible, not just guarded).

**3b. Simplify OnboardingGuard**

After the refactor, the guard becomes simpler:
- On initial load: check DB for `onboarding_completed`
- On context signal: react to in-memory completion flag
- Single `router.replace('/(drawer)/(tabs)')` call
- Remove the segment-watching refetch useEffect entirely

**3c. Remove the `submitOnboardingData` wrapper**

`submitOnboardingData()` is just a wrapper around `markOnboardingCompleted()` that adds no value. Replace all usages with the new `completeOnboarding()` function directly.

## Files to Modify

| File | Changes |
|------|---------|
| `contexts/OnboardingContext.tsx` | Add `completeOnboarding()`, add `isCompleted` state, expose it |
| `components/OnboardingGuard.tsx` | React to in-memory completion flag, remove refetch logic, simplify |
| `app/_layout.tsx` | Change `(onboarding)` presentation from 'modal' to 'card' |
| `components/onboarding/steps/StepAgentBorn.tsx` | Remove router.replace, use completeOnboarding() |
| `components/onboarding/steps/Step16_Paywall.tsx` | Remove router.replace, use completeOnboarding() |
| `components/onboarding/steps/Step16_RevenueCatPaywall.tsx` | Remove router.replace, use completeOnboarding() |
| `components/onboarding/PaywallBottomSheet.tsx` | Remove router.replace, use completeOnboarding() |
| `components/onboarding/steps/OnboardingAgentBuilder.tsx` | Parallelize: nextStep() before markOnboardingCompleted() |
| `components/onboarding/steps/Step14_DataTransparency.tsx` | Remove 500ms artificial delay |

## What We're NOT Changing

- The 21-step structure and step components themselves (only their exit behavior)
- The animation system in `index.tsx` (it's well-built at 320ms)
- The agent generation animation timing (6s is intentional UX)
- The agent born reveal animation (3s is intentional UX)
- Analytics tracking
- The overall Context + Guard architecture pattern (it's sound, just implemented with race conditions)
