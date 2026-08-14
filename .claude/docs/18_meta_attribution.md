# Meta (Facebook) Attribution & Conversion Funnel

How WagerProof reports its acquisition funnel to Meta Ads, across iOS native, Android native
and web.

Reference implementation this was modelled on: `honeydew-swift/HoneydewKit/Sources/HoneydewServices/Analytics/AnalyticsService.swift`.

## The events

| Funnel step | Meta event | iOS | Android | Web |
|---|---|---|---|---|
| App install | `fb_mobile_activate_app` | auto-logged by FB SDK | auto-logged by FB SDK | n/a |
| Page view | `PageView` | n/a | n/a | pixel snippet in `index.html` |
| Registration | `fb_mobile_complete_registration` / `CompleteRegistration` | `OnboardingStore.markComplete()` | `OnboardingStore.markComplete()` | `AuthContext` (email signup + OAuth first sign-in) |
| Paywall impression | `fb_mobile_content_view` / `ViewContent` | `CustomPaywallView`, `RevenueCatPaywallView` | `PaywallScreen`, `PostOnboardingPaywall` | `CustomPaywall` |
| Checkout intent | `fb_mobile_initiated_checkout` / `InitiateCheckout` | both paywalls | both paywalls | `CustomPaywall.handlePurchase` |
| Trial start | `StartTrial` | `PaywallConversionTracker` | `PaywallConversionTracker` | **RevenueCat** (not the browser) |
| Paid subscription | `Subscribe` | `PaywallConversionTracker` | `PaywallConversionTracker` | **RevenueCat** (not the browser) |

iOS and Android previously sent `fb_mobile_purchase` for trial starts (inherited from the RN
app) while everything else used `StartTrial`, so the same funnel step landed in two different
Meta standard events depending on platform. Normalized 2026-07-26. The one definition of the
trial-vs-paid split lives in `MetaAnalyticsService.trackConversionEvent` (iOS) and
`trackMetaConversion` (Android); don't re-derive it at a call site.

Identifiers: Meta app id `935005752525075` (mobile), pixel/dataset `1731090704521232` (web).
Neither is secret — the client token ships in SDK traffic and pixel ids appear in page source.

## ⚠️ RevenueCat owns the purchase conversions

`Subscribe` and `StartTrial` are sent **server-side by RevenueCat's Facebook integration**,
configured in the RevenueCat dashboard. This repo sends no purchase conversion to Meta from
anywhere — not from the webhook, not from the browser.

That is deliberate, and it is the constraint to respect when extending this. RevenueCat's
events carry no `event_id` that we can reproduce, so Meta cannot deduplicate a second sender
against them. **Any additional Subscribe/StartTrial sender double-counts every subscription.**

Consequences:
- `supabase/functions/revenuecat-webhook/` updates the profile and stops. There is no
  Conversions API call there, and no `META_CAPI_ACCESS_TOKEN` to set.
- `src/lib/metaPixel.ts` intentionally has no `trackSubscribe`. The browser covers only the
  top of the funnel that RevenueCat does *not* report.
- The mobile SDKs *do* send their own `Subscribe`/`StartTrial`. That overlap predates this
  work and is how RevenueCat's app integration is designed to operate (it dedupes on
  `fb_order_id` + `fb_anon_id`), which is why `setFBAnonymousID` below matters so much.

If you ever move off RevenueCat's integration, the browser and webhook senders need to come
back together, sharing one deterministic `event_id` derived from RevenueCat's own
`purchased_at_ms` — never a locally-stamped clock.

## iOS

- **SDK boot**: `MetaAnalyticsService.initialize()` from `WagerproofApp.init()`. It must run at
  process launch, not lazily from a view, or the SDK misses the activate event for that cold
  launch and the SKAdNetwork registration window.
- **Auto-logging is ON** (`FacebookAutoLogAppEventsEnabled` in `Info.plist`). It was previously
  force-disabled in code, which silently removed Meta's install signal entirely.
- **`SKAdNetworkItems`**: 30 identifiers in `Info.plist`. Required for install attribution when
  a user declines ATT.
- **Advanced Matching + external ID**: `AuthStore.identifyForAnalytics` sets the hashed
  email/name and the Supabase user id on every event. `setAdvancedMatching` *replaces* the whole
  hashed set rather than merging, so it must stay a single call site.
- **All conversions go through `PaywallConversionTracker`** — do not fire Meta events inline in a
  paywall view. Conversion reporting used to live only in `PostOnboardingPaywall`, so the seven
  in-app gates (Settings, Discord, WagerBot Voice, `ProFeatureGate`, `LockedGameCard`,
  `LockedOverlay`, `ProContentSection`) reported nothing at all. The tracker dedupes by order id,
  so multiple surfaces reporting the same purchase is safe.
- **RevenueCat link**: `RevenueCatService.bootstrap` calls
  `attribution.setFBAnonymousID(MetaAnalyticsService.anonymousID())`. Without it, RevenueCat's
  server-side Meta events cannot be joined back to the install — this closes ticket
  `docs/wagerproof-migration/tickets/055-meta-sdk-events.md`.

## Android

Same shape as iOS, same file names (`core/services/MetaAnalyticsService.kt`,
`PaywallConversionTracker.kt`, `core/stores/AuthStore.kt`).

- **Credentials are committed, not injected** (`app/build.gradle.kts`) — app id
  `935005752525075` plus the client token, the same pair iOS hardcodes in `Info.plist`
  (`FacebookAppID` / `FacebookClientToken`). A Meta client token is an embeddable client
  credential, not a server secret: it ships inside every app binary by design and grants
  nothing beyond logging events to this app. `-PFACEBOOK_APP_ID` /
  `-PFACEBOOK_CLIENT_TOKEN` (or env vars) still override, together.

  **This is why Android reported nothing to Meta from launch until 2026-08-13.** The
  credentials were injected-only and nothing injected them: the repo has no Actions
  secrets, and release AABs were hand-built without the `-P` flags. So
  `BuildConfig.FACEBOOK_APP_ID` compiled to `""`, `initialize()` returned at its blank
  check on every launch, and each event method then no-oped on `initialized`. The whole
  integration was present in the binary and inert: `BUILD SUCCESSFUL`, no warning, no
  events, not even the auto-logged install. Confirmed against two shipped artifacts —
  the Meta app id appears zero times in either.
- **`scripts/verify-meta-attribution.sh <artifact>`** fails a release AAB/APK whose dex
  has no Meta app id. Both Android workflows run it after `bundleRelease`, and
  `/build-android` step 3 runs it for hand builds. Only the artifact tells the truth here.
- **SDK boot**: `MetaAnalyticsService.initialize()` from `AppGraph.bootstrap()`, called in
  `WagerproofApplication.onCreate` — before the first Activity, so the SDK's
  `ActivityLifecycleTracker` catches this cold launch.
- **Auto-logging and advertiser-ID collection are ON.** Both were force-disabled — in the
  manifest *and* with runtime setters — which killed `fb_mobile_activate_app` and, because the
  GAID is Android's primary join key, made every install from a Meta ad unattributable.
  `AutoInitEnabled` stays **false** so init remains credential-gated.
  The runtime `setAutoLogAppEventsEnabled(true)` / `setAdvertiserIDCollectionEnabled(true)`
  calls are NOT redundant with the manifest: FBSDK's `UserSettingsManager` reads its
  SharedPreferences cache *before* the manifest, and shipped builds persisted `false` there, so
  upgrading installs would ignore a manifest-only change.
- **Advanced Matching + external ID**: `AuthStore.identifyForAnalytics`, guarded by
  `lastIdentifiedUserId` so a token refresh doesn't re-hash. `clearUser()` on the
  signed-in → signed-out transition only — Supabase also emits `NotAuthenticated` on a cold
  launch with no session, and clearing there would release the registration guard every launch.
- **Registration fires once per install** (`meta.completeRegistrationFired` in
  `wagerproof_prefs`) with the persisted `AuthStore.lastAuthProvider`, then flushes.
  Developer Settings → Reset Onboarding cannot re-fire it.
- **All conversions go through `PaywallConversionTracker`**, which every paywall surface uses:
  `PostOnboardingPaywall` plus `PaywallScreen`, which is what Settings, Developer Settings,
  `ProFeatureGate`, `ProContentSection`, `LockedGameCard` and `LockedOverlay` all present.
- **`fb_order_id` is synthesized when Play omits it** (`productId_purchaseSeconds`). Play leaves
  `StoreTransaction.orderId` null for test purchases and some promo flows, and without that key
  neither our own dedup nor RevenueCat's reconciliation can work.

## Web

- **Pixel** loads in `index.html` before React so `PageView` fires on first paint;
  `src/lib/metaPixel.ts` is the only module that should call `fbq`.
- It sends `PageView`, `ViewContent`, `InitiateCheckout` and `CompleteRegistration` only —
  the steps RevenueCat's integration does not report. See the warning above before adding
  any purchase event here.
- Registration is guarded per user id in `localStorage`
  (`wagerproof_meta_registered_users`) and additionally requires the Supabase account to
  have been created in the last 10 minutes, so an existing user signing in after this
  shipped is not reported as a new registration.

## Configuration

Nothing to configure for conversions — RevenueCat's dashboard integration handles them, and
the pixel id is a literal in `index.html`.

`META_ADS_ACCESS_TOKEN` in the root `.env` is for Graph API / campaign-management work only.
**Do not set it as a Supabase function secret**; there is no code path that reads it
server-side, and wiring one up would double-count conversions.

The campaign tooling in `marketing/meta-ads/` reads its own `META_ACCESS_TOKEN` from
`marketing/meta-ads/.env`.

## Verifying

- iOS / Android: Meta Events Manager → Test Events, add the device, run the app. Expect
  `fb_mobile_activate_app` on launch and the funnel events as you move through onboarding.
  On Android, `fb_mobile_activate_app` appearing at all is the check that auto-logging survived
  — it was silently absent for the whole period both flags were false.
- Android, before shipping: `wagerproof-android-native/scripts/verify-meta-attribution.sh
  <aab|apk>`. A green build proves nothing here; the app id in the artifact does.
- Web: Meta Pixel Helper extension. Expect PageView / ViewContent / InitiateCheckout /
  CompleteRegistration — and deliberately NO Subscribe.
- After any change here, check Events Manager → Data Sources → WagerProof → event volume
  split by source. `Subscribe` should appear as `SERVER_ONLY` (RevenueCat). If it starts
  showing browser-side volume too, something re-introduced a duplicate sender.
