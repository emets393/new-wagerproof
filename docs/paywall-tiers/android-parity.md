# Native Android tiered paywall

The native Android implementation lives in `wagerproof-android-native`. It ports the current iOS tiered experience. The existing custom/RevenueCat paywalls remain the fallback for legacy offerings.

## Names and billing identity

| Display name | Permanent tier key | RevenueCat entitlement | Google subscription |
| --- | --- | --- | --- |
| Premium | `standard` | `WagerProof Standard` | `wp_tiers_standard` |
| Premium Plus | `premium` | `WagerProof Premium` | `wp_tiers_premium` |
| Pro | `pro` | `WagerProof Pro` | `wp_tiers_pro` |

Each Google subscription has `monthly` and `yearly` base plans. Packages are `standard_monthly`, `standard_yearly`, etc. The client checks both the package identifier and exact `subscription:base-plan` product identifier before enabling checkout. Live prices come from Play through RevenueCat. Preview prices cannot be purchased.

The name change does not rename products, entitlements, cohort markers, or placements. Store and hosted-checkout product display names are separate dashboard configuration, not changed by this code patch.

## Rendering and checkout

- Placement-resolved `wagerproof_tiers_v1` selects the new renderer. `tiered_catalog_ready` must be true before Play checkout is enabled. No offering retains the existing retry/fallback experience.
- Onboarding requests `onboarding`; in-app entry points use their existing placement or `tier_upgrade_standard`, `tier_upgrade_premium`, `tier_upgrade_pro`.
- Pro monthly is selected by default and has the Most popular tag. Yearly comparisons, savings tags, six real review quotes, full feature list, and tier summary card match iOS.
- The three tier artwork families and review backdrop are the actual iOS-generated assets. Selected borders are static and equal in thickness. Premium Plus and Pro text have static linear gradients and increasingly strong glow.
- Gate CTA text alone shimmers. It pauses outside the resumed lifecycle and obeys Android's disabled-animation setting. Locked feature content consumes input and is removed from accessibility; nested gates do not produce duplicate cards.
- The footer samples the screen through Haze for a gradient-masked backdrop blur. Android checkout says **Continue with Google Play**. The second button uses the Stripe wordmark and **30% off / additional**.
- Hosted checkout requires the offering's `tiered_hosted_web_ready` flag, its trusted `https://pay.rev.cat/<link>` URL, and an exact match between the authenticated user and RevenueCat customer. The URL specifies USD and lets RevenueCat show all web plans. Returning from the browser invalidates cached customer info and refreshes access.
- Existing Play subscriptions use subscription replacement with time proration. Purchases from another store are not passed as Play replacements. Real Play purchase, upgrade, restore, and cross-store behavior still requires a Play-distributed licensed tester build; sideloaded debug UI tests do not prove that flow.
- The onboarding host is hard by default, including system Back. In-app paywalls are dismissible. Only onboarding renders the picks countdown. The three-hour deadline persists across launches. With notification permission already granted, backgrounding actual onboarding posts an Android chronometer notification as the counterpart of the iOS Live Activity; subscribing cancels it. This does not request new notification permission.

## Access protection

Highest active entitlement wins. All existing `WagerProof Pro` subscriptions retain full access. Legacy free accounts retain their previous previews and gates. New restrictions apply only after a new-catalog product or lower-tier entitlement has established the cohort, including expired customers. Trusted refreshes can downgrade; untrusted listener updates cannot downgrade an existing tier. Historical RevenueCat identities are reconciled through `resolve-my-entitlement`, so an existing Pro identity outranks a lower tier on the current identity.

| Feature | New catalog minimum |
| --- | --- |
| Existing protected game data, predictions, market insights, Discord, WagerBot | Premium |
| Outliers, Props, Parlay God, Cheat Sheets, historical and situational trends, research tools | Premium Plus |
| Agents, agent picks, full leaderboard, inline agent consensus | Pro |

Gate coverage includes main tabs, public/private agent details, Search destinations, shared trends sheets, direct historical screens, prop details, matchup prop widgets and expanded lists, best-picks screens, and Parlay God detail sheets. Agent creation preflight rejects lower-tier creation before calling the backend. Server policies remain authoritative and are not replaced by the preview controls.

Developer Settings includes session-only **Actual, Legacy free, New expired, Premium, Premium Plus, Pro, Legacy Pro** modes and a separate design paywall preview. Android preview overrides are debug-only, never written to RevenueCat, and invalidated on identity changes.

## Validation and release boundary

Build/test evidence and emulator screenshots are under `.context/android-tier-qa/` and `.context/android-paywall-*.log`. The existing Pixel 9 API 35 emulator was used. No emulator was created.

The app is built and installed locally as `com.wagerproof.mobile.debug`, alongside the production app. No Play release, production targeting rule, store product activation, or new version number is implied by this implementation. Verify/activate the draft Google base plans and select the Android testing audience in RevenueCat before licensed billing tests. The previous store setup record is not a fresh dashboard audit.

Commands from the Android directory:

```sh
./gradlew :core:models:test :core:services:testDebugUnitTest :app:testDebugUnitTest :app:lintDebug :app:assembleDebug
```

Debug launch examples (internal tier keys deliberately remain unchanged):

```sh
adb shell am start -S -n com.wagerproof.mobile.debug/com.wagerproof.app.MainActivity --es tier_preview premium --ez yearly true --es access_preview legacy_free
adb shell am start -S -n com.wagerproof.mobile.debug/com.wagerproof.app.MainActivity --es tier_preview historical --es access_preview standard
adb shell am start -S -n com.wagerproof.mobile.debug/com.wagerproof.app.MainActivity --es tier_preview agents --es access_preview premium
```

### Verified locally on 2026-09-15

- Native iOS simulator build passed with renamed labels and gate text shimmer.
- Android build and lint passed. 452 unit tests passed: 35 model, 95 service, and 322 app tests.
- Seven Android emulator scenarios passed after supplying the real navigation context to the debug harness: locked/unlocked Historical Trends, locked Agents, legacy Pro Agents, locked Props, locked Outliers, and hard onboarding.
- The trends CTA opened only Premium Plus/Pro upgrade choices. Gate accessibility exposed a single unlock action and no protected controls. System Back left the hard onboarding paywall visible.
- Screenshots cover monthly/yearly selection, savings, Pro artwork/card/reviews, and gates. Billing confirmations and lock-screen notification delivery were not exercised with a live enrolled account.

### Physical-device pass

- Built and installed the latest signed iOS Debug app, version 3.6.3 (383), on the connected iPhone 14 Pro. Remote launch was denied because the phone was locked; installation succeeded and the app can be opened after unlocking.
- Installed the Android debug app on the connected Samsung SM-S266V running Android 16, alongside the production app.
- Eleven entitlement-preview scenarios passed: Historical Trends, Props, Outliers, Agents, Pro and legacy Pro access, and hard onboarding. Eleven interaction checks also passed: default selection, monthly/yearly pricing, savings, tier selection, native/browser preview actions, feature/review/footer scrolling, minimum-tier upgrade choices, and dismissal behavior.
- Visual inspection found unsupported SF Symbol names silently removing several Android feature icons. Switched these rows to typed Android icon mappings, rebuilt and reinstalled, then verified all 11 feature labels share the same leading edge on the physical device.
- Physical-device screenshots, UI hierarchy captures, and JSON results are in `.context/physical-device-qa/`. The crash buffer contained no WagerProof crash during this pass.
- The final icon-corrected build passed `:app:assembleDebug :app:lintDebug`; see `.context/physical-device-qa/android-icon-build.log`.
- The Android debug app is signed out. These are session-only entitlement preview checks, not live account, purchase, restore, or server-authorization verification. No production subscription or store release was changed.

### Search regression fix, 2026-09-16

The signed-in physical-device pass exposed a missed entry point: Search rendered its own Outliers carousel without entering the gated Outliers tab. The shared Search carousel now uses the Premium Plus feature gate, covering All keyword results, the Outliers search filter, and Browse Outliers. Protected cards remain blurred and non-interactive, with their accessibility content hidden behind the unlock action.

The updated debug APK was installed without clearing the user's login. Validation uses the developer subscription modes through the normal Search and Settings screens with live loaded trend cards, rather than the standalone screenshot harness. Evidence is in `.context/android-search-gate-qa/`. The build, lint, and 322 app unit tests passed. No purchase or RevenueCat account mutation is part of these checks.

Premium was blocked on all three Search paths; the CTA offered only Premium Plus/Pro and dismissed back to the gate. Premium Plus retained carousel and full detail-sheet access. Legacy Pro retained carousel access. The phone was returned to the user's original Premium preview with the `seat` query and Outliers filter selected.
