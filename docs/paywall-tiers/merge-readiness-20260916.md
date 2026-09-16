# Merge readiness, September 16, 2026

## Compatibility verified live

RevenueCat's public SDK API was queried using the existing, cleaned-up QA customer identity and each iOS marketing version:

| Client | Current/fallback | Placement result |
| --- | --- | --- |
| iOS 3.6.2 | `hardPaywall` | `onboarding` stays legacy |
| iOS 3.6.3 | `hardPaywall` | `onboarding`, `generic_feature`, `tier_upgrade_premium`, `tier_upgrade_pro` use `wagerproof_tiers_v1` |

All 16 legacy products remain attached to `WagerProof Pro`. The new offering contains six packages with Apple, Google, production web, and sandbox web products. No legacy product, subscription price, or entitlement attachment was changed in this merge pass.

The new web placement is `tiered_web_checkout`. Rule `gxnB9Oc2V3` is scoped to the two Web Billing apps, with its former QA attribute condition removed and the legacy fallback preserved. Activate this rule before the catch-all Default Rule after merging. The offering's `tiered_web_ready` metadata is enabled. Mobile's dedicated hosted purchase link remains independently enabled.

Android continues to receive the legacy offer until a separately verified release version is enrolled. Do not target the current Android marketing version indiscriminately. New lower-tier customers require a tier-aware client; old Pro-only clients are not granted artificial Pro access. Existing subscribers keep their existing Pro access.

## Current validation

- The feature branch rebased cleanly onto `0c151748` with the intervening main changes preserved.
- Production website build, prerendering, and guide verification passed using the installed Chrome.
- iOS Debug build passed on the existing iPhone 17 Pro Max simulator (`D69B4254-398D-4806-921B-56411888C597`).
- 13 isolated Swift policy tests passed against byte-identical current model/test sources.
- Complete JavaScript run: 475 passed, one failure in `lineMovement.test.ts` expecting a `seriesNote`. Both that test and implementation are identical to main; no paywall or entitlement test failed.
- Android unit tests, debug/release lint, APK/AAB compilation, and Meta attribution checks run in the PR workflow.
- Backend deployment and real signed-in entitlement checks are documented in [backend-release-20260916.md](backend-release-20260916.md).

## App Store release boundary

Version 3.6.3 exists in Prepare for Submission. The current TestFlight build 383 is internal-only. The main-branch Xcode Cloud workflow is enabled and configured to archive an App Store-eligible build on merge; its next build number is above 383. Actual purchase/restore/upgrade QA and App Store submission follow that build.

The six new subscription products are configured for all 175 territories, including future territories. App-level availability was US-only at audit time; changing it affects the published version too and cannot be bound specifically to version 3.6.3. The user has been asked whether to apply that change now or at release.

Apple also reports `CANNOT_SELL_GAMBLING` for Afghanistan, Gabon, Iraq, Libya, Maldives, Morocco, Saudi Arabia, South Korea, and the United Arab Emirates, and `BRAZIL_GAMBLING_NOT_VERIFIED` for Brazil. Selecting all countries does not clear these restrictions. Do not change content declarations or assert licensing merely to bypass a distribution block.

Local audit responses and logs are retained under `.context/launch-*`; generated artifacts and customer records are excluded from the PR.
