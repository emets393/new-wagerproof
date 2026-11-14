# Simulator QA, September 15, 2026

## Scope and result

Built the current Debug source, installed it, and exercised it on the existing iPhone 17 Pro Max, iOS 26.0, `D69B4254-398D-4806-921B-56411888C597`. Rebuilt and reinstalled after the debug fixes below. The simulator is left open on the monthly Pro design preview. Native and web rollout flags remain false. No store products, targeting rules, customer entitlements, or production backend deployments changed.

This is a simulator UI and local-policy test pass, not a complete billing release sign-off. Tier accounts are debug fixtures. Preview Continue/Restore/browser actions deliberately do not transact.

## Passed runtime checks

| Check | Observed result |
| --- | --- |
| Default selection | Pro monthly selected; Most popular badge on Pro only |
| All six tier/period combinations | Monthly $19.99/$29.99/$79.99; yearly $199.99/$299.99/$359.99 |
| Billing switch | Switching monthly/yearly retains the selected tier |
| Annual tags | Premium 17%, Pro 62%; no Early Bird label |
| Feature comparison | Standard 4 included/7 locked; Premium 8/3; Pro 11/0; correct Premium/Pro labels on locked rows |
| Tier summary | Correct tier name and included-feature count |
| Continue preview | Pro yearly reports $359.99/year and explicitly starts no purchase |
| Browser preview | Standard yearly reports $139.99/year, 30% off, and explicitly disables checkout |
| Footer | Reviews, Restore, Sign out, Terms, Privacy, renewal disclosure, copyright, and fixed checkout controls rendered |
| Restore/sign-out previews | Informative messages; no restore transaction or account sign-out |
| Standard basic access | NFL game cards with odds/market labels and Discord link/join screen accessible |
| Standard Props | Premium gate; contextual paywall contains Premium/Pro only, Pro selected; closing returns to gate |
| Standard Outliers | Premium gate after debug-harness fix |
| Premium Props and Outliers | Screens accessible; current data state is empty, not an upgrade gate |
| Premium Agents | Pro gate; contextual paywall contains only Pro |
| New Pro Agents | Populated office with three fixture agents |
| Legacy Pro Agents | Same populated office, no new tier gate |
| Expired new-tier Agents | Pro gate, no office access |
| No Offering | Deterministic debug fixture shows No options and Retry, no purchase options; retry stays safe |
| Offering fetch error | Deterministic debug fixture shows connection error and Retry, no purchase options |
| Countdown | Persisted countdown survives relaunches instead of resetting each time |
| Live Activity | Minimizing creates an active PicksExpiryAttributes activity; permission accepted in simulator; countdown card visually verified on Lock Screen |
| Largest accessibility text setting | Controls remain present and layout does not overlap; much of this custom design uses fixed font sizes, so this is not a full Dynamic Type compliance claim. Original large setting restored |

## Automated verification

- 34 Vitest tests passed: billing amounts/catalog validation, tier access, RevenueCat identities and outages, placement routing, account-switch/sign-out races, and package attribution.
- Six Swift policy tests passed against copies of the exact current model/test source in `.context/subscription-policy-tests`. This is an isolated host Swift package, not the entire iOS XCTest suite.
- Applied fixtures and the tier migration to a new disposable Supabase Postgres container, then passed SQL assertions for lower-tier denial, Pro/legacy access, self-only reads, and blocked client tier writes. Container removed after testing; existing local databases untouched.
- Deno checks passed for shared entitlements, resolve-my-entitlement, revenuecat-webhook, and agent-authorized-action-v1.
- Final simulator build and `git diff --check` passed.

## Fixes made during this pass

1. `ScreenshotHarness.makeOutliers` and the Outliers SwiftUI preview were missing `ParlayGodStore`, causing the standalone screen to crash. Added the dependency and verified Standard/Premium routes after rebuilding.
2. The old `paywallError` harness assumed RevenueCat would return no catalog, but it successfully loaded the legacy offering. Added DEBUG-only `-paywallTestResult none|error` controls, requiring `-uiScreenshotMode`, to reliably exercise the existing failure UI. No live targeting changes are needed.

## Remaining boundaries

- No StoreKit configuration file is wired for local purchase simulation. No actual purchase, restore, renewal, refund, pending payment, or subscription change was performed through StoreKit/RevenueCat in this pass.
- Live tiered placement rules remain inactive. Their actual audience/version matching and end-to-end checkout still need QA enablement and purchase tests.
- Server tests used local fixtures. The production migration, webhook delivery, background agents, and Premium data-source authorization remain release work.
- Old released binaries, real legacy customer accounts, and new lower-tier accounts on old apps were not tested. The legacy result above uses a current-build fixture.
- Props and Outliers had empty research data. Populated advanced-tool/detail routes, full leaderboard behavior, and actual Discord role assignment need authenticated integration testing.
- No Offering/error are root-mounted harness screens, so their Close controls are present but root dismissal cannot be verified there. Actual contextual tiered-sheet dismissal was verified separately.
- Footer reached using the debug scroll anchor; this pass does not claim swipe-gesture or full VoiceOver/Reduce Motion/Reduce Transparency verification.
- Live Activity creation/rendering passed; purchase-triggered cleanup and expiration were not exercised.
- Web purchase/return and Android billing were not exercised by the iOS simulator run.

## Evidence and repeatable launches

Screenshots and Live Activity log: `.context/paywall-qa-20260915/`. Build, Swift, and Deno logs: `.context/paywall-qa-{build,swift,deno}-20260915.log`.

```sh
xcrun simctl launch --terminate-running-process D69B4254-398D-4806-921B-56411888C597 com.wagerproof.mobile -uiScreenshotMode tieredPaywall
xcrun simctl launch --terminate-running-process D69B4254-398D-4806-921B-56411888C597 com.wagerproof.mobile -uiScreenshotMode propsLoaded -tieredTestAccess standard
xcrun simctl launch --terminate-running-process D69B4254-398D-4806-921B-56411888C597 com.wagerproof.mobile -uiScreenshotMode agentsLoaded -tieredTestAccess legacy
xcrun simctl launch --terminate-running-process D69B4254-398D-4806-921B-56411888C597 com.wagerproof.mobile -uiScreenshotMode paywallError -tieredTestAccess legacy -paywallTestResult none
xcrun simctl launch --terminate-running-process D69B4254-398D-4806-921B-56411888C597 com.wagerproof.mobile -uiScreenshotMode paywallError -tieredTestAccess legacy -paywallTestResult error
```
