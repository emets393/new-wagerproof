# Picks Expiry Hold (paywall countdown + Live Activity)

> iOS native only. Shipped in `wagerproof-ios-native/`. No web, Android, or RN equivalent.

A new user finishes onboarding, watches their agent generate its first picks, and
sees them as blurred tickets. Then the paywall asks for money. This feature puts
a **3-hour clock on those picks** — an amber pill on the paywall, and, the moment
the user closes or minimizes the paywall without subscribing, a **Live Activity** that keeps
counting down on the Lock Screen and in the Dynamic Island.

One deadline, two renderers. They cannot disagree because they read the same two
dates out of the same App Group record.

## Where the pieces live

| Piece | File |
|---|---|
| Live Activity contract (shared app ↔ widget) | `WagerproofKit/Sources/WagerproofModels/PicksExpiryActivity.swift` |
| Window persistence + ActivityKit lifecycle | `WagerproofKit/Sources/WagerproofServices/PicksExpiryService.swift` |
| Paywall pill | `Wagerproof/Features/Paywall/PicksExpiryPill.swift` |
| Live Activity widget (Dynamic Island + config) | `WagerProofWidgetExtension/PicksExpiryLiveActivity.swift` |
| Live Activity Lock Screen card | `WagerProofWidgetExtension/Views/PicksExpiryLockScreenView.swift` |

Wired from: `OnboardingRevealView` (arms), `CustomPaywallView` (renders the pill),
`PostOnboardingPaywall` (starts / ends the activity), `RootView` (reconciles on
foreground, re-presents the paywall on activity tap).

## The window

`PicksExpiryService.holdDuration` = 3 hours. The window is three App Group keys
(`picks_expiry_started_at_v1`, `..._pick_count_v1`, `..._agent_name_v1`) — not
in-memory state, because a countdown that resets on cold launch reads as fake.

- **`arm(pickCount:agentName:)`** — starts a FRESH window, discarding any prior
  one. Called once, from `OnboardingRevealView.finish()`, which is the only place
  that knows the real ticket count and agent name.
- **`ensureWindow(pickCount:agentName:)`** — returns the running window, arming a
  new one only if there is none or the last lapsed. Called from
  `CustomPaywallView.onAppear` with a fallback count of 3.

**Re-arming on lapse is intentional.** Agents generate a new slate daily, so a
permanently-expired countdown would be both inaccurate and dead weight. A
returning free user gets a fresh hold when the paywall re-presents.

## The clock ticks with no runtime

Both surfaces use `Text(timerInterval:countsDown:)` (and
`ProgressView(timerInterval:)` in the Live Activity). SwiftUI drives those from
a date range at second resolution.

That means **the Live Activity is never updated after it starts** — no push
channel, no background task, no update budget. `staleDate` is set to the
deadline, so at expiry the activity goes stale on its own and both widget faces
switch to their expired rendering off `context.isStale`.

## Lifecycle

| Event | Effect |
|---|---|
| Onboarding reveal "See everything" | `arm(...)` — window starts |
| Paywall appears | Pill renders (hidden if the window lapsed) |
| **User minimizes the app from the paywall** | `.inactive` → `startLiveActivity(reason: "app_inactive")` |
| **User leaves the paywall without buying** | `startLiveActivity(reason:)` |
| User purchases / restores | `reconcile(isPro: true)` → clear window, end activity immediately |
| App foregrounds | `reconcile(isPro:)` → ends an activity that lapsed while away |
| Live Activity tapped | `wagerproof://picks-hold` → paywall re-presents |

**Every leave-without-buying path funnels through
`PostOnboardingPaywall.dismissWithoutPurchase(_:)`** — the custom paywall's X,
the legacy RC template's dismissal, the loading-state overlay X, and the
plans-unavailable "Continue without subscription" escape. That is deliberately
the host, not `CustomPaywallView`: the host is the only object that can tell a
bail from a purchase.

Note the post-onboarding cover sets `interactiveDismissDisabled(true)` and ships
HARD by default (no X unless the offering's `paywall_close_enabled` metadata is
`true`). In hard mode the only exits are purchase and the plans-unavailable
fallback — so in production today the Live Activity mostly starts from the
fallback path and from soft-mode/App-Review builds. Softening the gate is a
RevenueCat dashboard change, not an app release.

`ActivityKit` refuses to start an activity from the background without a push
token. The minimize path requests on `.inactive`, while the process is still
foreground-capable, rather than waiting for `.background`.

## Deep link

`wagerproof://picks-hold` → `DeepLinkRoute.picksHold`. It does NOT enter
`pendingDeepLinkRoute` (that queue belongs to the tab shell and has no tab to
select for it); `RootRouter.handle(deepLink:)` sets `reopenPaywallRequested`
instead, and `RootView` clears its `paywallDismissed` flag so the cover comes
back. Without this the card would drop the user into the app it was trying to
sell them out of.

## Requirements

- `NSSupportsLiveActivities` = `true` in `Wagerproof/Info.plist`. Nothing else:
  no new entitlement, no push capability.
- The first `Activity.request` triggers the system "Allow Live Activities from
  WagerProof?" prompt itself — there is nothing to ask for up front.
  `liveActivitiesAvailable` reflects the user's answer; a `false` there is
  tracked as `picks_hold_activity_skipped` and the paywall pill still works.
- `PicksExpiryAttributes` MUST stay in `WagerproofModels`. ActivityKit matches a
  running activity to its renderer by attributes type; a duplicated local copy
  in the app or the widget compiles fine and then silently never renders.

## Analytics (Mixpanel)

| Event | When |
|---|---|
| `picks_hold_armed` | Window starts (`pick_count`, `hold_hours`) |
| `picks_hold_activity_started` | Live Activity requested (`reason`, `pick_count`, `minutes_left`) |
| `picks_hold_activity_skipped` | User has Live Activities disabled |
| `picks_hold_activity_failed` | `Activity.request` threw |
| `picks_hold_activity_ended` | Ended (`reason`: `subscribed` / `expired`) |

## Testing

Live Activities do run in the simulator. Fastest loop:

1. Secret Settings → Reset Onboarding, run the flow to the reveal (arms the real
   window), or just open the paywall — `ensureWindow` arms a fallback one.
2. Secret Settings → paywall preview presents `PostOnboardingPaywall`. Press
   Home to verify the compact Dynamic Island countdown, or use the red DEBUG
   close button to exercise `dismissWithoutPurchase`.
3. Lock the simulator (`Device ▸ Lock`) to see the Lock Screen card.

To exercise the expired face without waiting 3 hours, temporarily lower
`PicksExpiryService.holdDuration`.
