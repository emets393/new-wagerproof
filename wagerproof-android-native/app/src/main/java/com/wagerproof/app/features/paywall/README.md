# Paywall

Everything that asks an Android user for money, plus the Pro gates that send
them here. Port of iOS `Wagerproof/Features/Paywall/` +
`Features/Onboarding/PostOnboardingPaywall.swift`.

## Two checkout surfaces

| Surface | File | Used by |
|---|---|---|
| **Post-onboarding gate** | `PostOnboardingPaywall.kt` | `nav/RootHost.kt` once onboarding completes and the user is not Pro; also the Developer Settings "Test Custom Paywall" row |
| **In-app upgrade** | `PaywallScreen.kt` | every Pro gate — Settings, Developer Settings, `ProFeatureGate`, `ProContentSection`, `LockedGameCard`, `LockedOverlay` |

`PaywallScreen` hands the offering straight to RevenueCatUI's `Paywall`
composable (dashboard-owned layout). The post-onboarding gate does not — see
below.

## The post-onboarding gate is remote-configured

`PostOnboardingPaywall` reads two booleans off the **placement offering's
metadata** (`onboarding` placement), so the owner can change behaviour from the
RevenueCat dashboard with no app release. Both defaults match iOS exactly:

| Key | Default when absent | Effect |
|---|---|---|
| `custom_paywall_enabled` | **true** | `true` → the custom Compose checkout (`CustomPaywallView`). `false` is the kill switch back to the RevenueCatUI template. |
| `paywall_close_enabled` | **false (HARD)** | `false` → no ✕ **and** back is swallowed. `true` softens the gate (e.g. an App Review build). |

Metadata booleans are parsed by `PaywallPlanResolver.metadataBoolean`, which
accepts only real booleans and `0`/`1` numbers — the same values iOS's
`as? Bool` NSNumber bridge accepts. A value typed as the string `"true"`
resolves to the DEFAULT on both platforms, so a dashboard typo cannot
accidentally open the hard gate.

### The hard gate has exactly one escape

`paywall_close_enabled = false` removes the ✕ *and* neuters back. The only
unconditional way out is the error/timeout surface's **"Continue without
subscription"**, which fires when the offering fetch fails or exceeds the 10 s
watchdog — a user must never be stranded on a paywall that could not load.

Back is gated in `RootHost` via `onCloseEnabledChanged`, not independently:

```
ModalOverlay(onBack = { if (paywallCloseEnabled) dismissPaywall() }) { … }
```

The handler stays **registered** either way. Swallowing back is the point —
letting it fall through reaches `MainScaffold`'s handler, which is disabled at
the Games tab root (exactly where a freshly onboarded user lands), so back would
finish the Activity. `paywallCloseEnabled` starts `false`, so the gate is hard
while the offering is still loading.

## Custom checkout

`CustomPaywallView.kt` + `CustomPaywallFeaturePages.kt` + `CustomPaywallPlans.kt`.

RevenueCat remains the source of truth for offerings, localized prices, offer
eligibility, purchases, restores and the `WagerProof Pro` entitlement — it just
doesn't own a pixel. Purchases go through `RevenueCatService.purchase(activity,
package)`; restores through `RevenueCatService.restorePurchases()`.

### Plan resolution (`CustomPaywallPlans.kt`)

Pure Kotlin, no RevenueCat or Android types, unit-tested in
`app/src/test/.../PaywallPlanResolverTest.kt`. The Compose layer flattens each
`Package` into a `PaywallProduct` once (`Package.toPaywallProduct()`), and every
decision after that is testable.

Rules ported verbatim from iOS:

- **Yearly card** = the discounted annual (`$rc_yearly_discount`) *without* a
  free trial, else any other non-trial annual. It **fails closed**: if only a
  trial-backed annual exists, no Yearly card renders at all. Presenting the
  trial product under a card that promises no trial is the bug this rule exists
  to prevent.
- **Entry card** = monthly, unless offering metadata `entry_offer = intro_annual`
  AND the `yearly_intro` package carries an eligible pay-up-front intro. It
  falls back to monthly otherwise, so a returning customer is never stranded on
  an intro price they cannot get.
- The `yearly_intro` package can only ever fill the entry slot, never the
  headline Yearly card.
- Savings badge = `(monthlyAnnualized − annualAnnualized) / monthlyAnnualized`,
  rounded, shown only when positive. Per-month figures use iOS's 30.4375 /
  4.345 divisors so the two platforms never advertise different numbers.

### Trial / intro eligibility differs by store — on purpose

iOS calls `Purchases.checkTrialOrIntroDiscountEligibility`. **Android has no
equivalent and does not need one**: Play Billing only returns offers in
`subscriptionOptions` that the signed-in shopper is eligible for, so a present
free trial or intro offer *is* the eligibility signal. `PaywallProduct.introOffer`
being non-null therefore means "eligible", and `introDisplayEligible()` is a
presence check.

### Feature carousel

Seven pages in `CustomPaywallFeaturePages.kt`. Heroes reuse the REAL production
components — `AgentPickMiniTicket`, `AgentParlayMiniTicket`, `OutliersTrendCard`,
`PixelOffice`, `AIConnectorBanner` — so the pitch cannot drift from the product.
Fixtures live at the MODEL boundary (`PaywallTicketFixtures`), never as
recreated UI.

Page 1 is personalized from the onboarding buckets: APP TIME comes from
`ResearchTimeEstimates(researchTimeBucket)`, and bullet 1 becomes the money line
from `StakesEstimates(weeklyStakesBucket)` when that answer exists.

`PaywallPageKeys` are **wire values** — `paywall_feature_page_viewed.page_key`
rolls up with iOS in Mixpanel. Never rename one.

## Analytics

Mixpanel event names and property keys are byte-identical to iOS so the funnel
reports cross-platform off one set of events:

`paywall_presented` · `paywall_feature_page_viewed` · `paywall_plan_selected` ·
`paywall_checkout_started` · `paywall_purchase_cancelled` ·
`paywall_purchase_failed` · `paywall_converted` · `paywall_restore_tapped` ·
`paywall_restore_completed` · `paywall_dismissed` · `paywall_signed_out`

`variant` is `custom_v2_product_hero` on the custom path and
`revenuecat_template` on the legacy path. `paywall_presented` fires from exactly
one place per render: `CustomPaywallView` on the custom path, the host on the
legacy path.

Meta conversions go through `PaywallConversionTracker` (never inline) — it
dedupes by order id, which is what makes it safe for both `CustomPaywallView`
and the host to report the same purchase. **Never add a second `Subscribe` /
`StartTrial` sender**; RevenueCat's server-side Facebook integration already
reports the sale and the two reconcile on `fb_order_id`. See
`.claude/docs/18_meta_attribution.md`.

## Log Out is deliberate, and deliberately not a dismiss

The hard gate means a user signed into the wrong account would otherwise be
trapped. The Log Out button signs out but does **not** call `onRequestClose()` —
that would latch the host's `paywallDismissed` flag and suppress the paywall for
whoever signs in next this session. Sign-out alone drops the overlay because
`RootRouter` leaves the `Ready` phase.

## Debug preview

Developer Settings → **Test Custom Paywall** presents `PostOnboardingPaywall`
with `isDebugPreview = true`, which forces the close control on and renders it as
a loud red DEBUG pill — a tester can escape, and can never mistake a debug run
for the real hard gate. Its own `BackHandler` stops back from closing Developer
Settings behind the still-visible paywall.

## Known gaps vs iOS

- No haptics on plan selection / page change (iOS uses `.sensoryFeedback`).
- The CTA shimmer is a plain white sweep; Compose has no `.blendMode(.screen)`.
- `PixelOffice`'s floor/time control chips can't be hidden (no `showsControls`
  flag in `core:design`), so the Agent HQ page absorbs taps over that corner
  instead.
